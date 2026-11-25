"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { acquireSocket, releaseSocket } from "@/lib/socket";

/** How often an open chat asks the API for new messages: rarely while live, often while not. */
const POLL_LIVE_MS = 45_000;
const POLL_OFFLINE_MS = 4000;
/** A message that could not be sent is tried again by itself after these waits, then left for a click. */
const RETRY_AFTER_MS = [1500, 4000, 10_000, 20_000];

const byTime = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);

/** An id for a message made here, so sending it twice stores it once. */
export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Worth trying again by itself: the network, a busy server, or "slow down". */
const passing = (e) => !(e instanceof ApiError) || e.status === 0 || e.status >= 500 || e.status === 429;

/**
 * One conversation, kept up to date.
 *
 *   path    the API address of the thread (GET reads, POST sends), or null for "none"
 *   role    the role the signed-in person speaks with here: "dietitian" or "admin"
 *   active  false until the chat is really in front of the person (nothing is loaded or marked read before)
 *   onRead  called whenever what the other side wrote has been marked as read
 *
 * Messages are SAVED through the API with an id made here, so a retry can never store one twice. The
 * live connection brings new messages, "seen", "typing" and "online" at once; while it is down the
 * hook asks the API every few seconds, and anything written meanwhile is sent when the way is back.
 */
export function useChat({ path, role, active = true, onRead }) {
  const [messages, setMessages] = useState(null);
  const [pending, setPending] = useState([]);
  const [seenAt, setSeenAt] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [info, setInfo] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(false);
  const [connected, setConnected] = useState(false);
  const [peer, setPeer] = useState(null);
  const [theyType, setTheyType] = useState(false);

  const newest = useRef(undefined);
  const busy = useRef(false);
  const emit = useRef(() => {});
  const joinRef = useRef(() => {});
  const typingSent = useRef(0);
  const typingStop = useRef(null);
  const timers = useRef(new Map());
  const pendingRef = useRef([]);
  /** Goes up with every new conversation (and on leaving), so a late answer for an old one is dropped. */
  const gen = useRef(0);
  const activeRef = useRef(active);
  const onReadRef = useRef(onRead);
  const threadRef = useRef(null);
  useEffect(() => {
    activeRef.current = active;
    onReadRef.current = onRead;
    pendingRef.current = pending;
    threadRef.current = threadId;
  });

  /** In front of the person right now: switched on, in a visible tab. */
  const watching = useCallback(() => activeRef.current && document.visibilityState === "visible", []);

  const merge = useCallback((incoming) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const ids = new Set((prev ?? []).map((m) => m.id));
      const fresh = incoming.filter((m) => !ids.has(m.id));
      return fresh.length || prev === null ? [...(prev ?? []), ...fresh].sort(byTime) : prev;
    });
    // A message of mine that the server now has is no longer "being sent".
    const done = new Set(incoming.map((m) => m.clientId).filter(Boolean));
    if (done.size) setPending((list) => (list.some((p) => done.has(p.clientId)) ? list.filter((p) => !done.has(p.clientId)) : list));
  }, []);

  const refresh = useCallback(async () => {
    if (!path || busy.current) return;
    busy.current = true;
    const g = gen.current;
    try {
      const after = newest.current;
      const page = await api(`${path}${after ? `?after=${encodeURIComponent(after)}` : ""}`);
      if (g !== gen.current) return;
      if (!after) {
        setMessages((prev) => prev ?? []);
        setHasMore(!!page.hasMore);
      }
      merge(page.messages);
      const last = page.messages[page.messages.length - 1];
      if (last && (!newest.current || last.createdAt > newest.current)) newest.current = last.createdAt;
      setSeenAt(page.seenAt);
      setThreadId(page.threadId ?? null);
      if (page.dietitian) setInfo(page.dietitian);
      setError(null);
      // Asking for the newest part is what marks their messages as read on the server.
      onReadRef.current?.();
    } catch (e) {
      if (g === gen.current) setError(e);
    } finally {
      if (g === gen.current) busy.current = false;
    }
  }, [path, merge]);

  // A new conversation: start clean.
  useEffect(() => {
    const waiting = timers.current;
    return () => {
      gen.current += 1;
      busy.current = false;
      for (const t of waiting.values()) clearTimeout(t);
      waiting.clear();
      newest.current = undefined;
      setMessages(null);
      setPending([]);
      setSeenAt(null);
      setThreadId(null);
      setInfo(null);
      setHasMore(false);
      setError(null);
      setLive(false);
      setPeer(null);
      setTheyType(false);
      setLoadingOlder(false);
    };
  }, [path]);

  // Load when first in view, then keep asking (slowly while the live connection is up).
  useEffect(() => {
    if (!path || !active) return;
    refresh();
    const id = setInterval(() => watching() && refresh(), live ? POLL_LIVE_MS : POLL_OFFLINE_MS);
    return () => clearInterval(id);
  }, [path, active, live, refresh, watching]);

  const deliver = useCallback(async (item, attempt = 0) => {
    timers.current.delete(item.clientId);
    const g = gen.current;
    try {
      const { message } = await api(path, { method: "POST", body: { body: item.body, clientId: item.clientId } });
      if (g === gen.current) merge([message]);
    } catch (e) {
      if (g !== gen.current) return;
      const again = passing(e) && attempt < RETRY_AFTER_MS.length;
      setPending((list) => list.map((p) => (p.clientId === item.clientId ? { ...p, state: again ? "waiting" : "failed", reason: e } : p)));
      if (again) timers.current.set(item.clientId, setTimeout(() => deliver(item, attempt + 1), RETRY_AFTER_MS[attempt]));
    }
  }, [path, merge]);

  /** Everything still unsent goes out again now (the connection is back, or the person asked). */
  const flush = useCallback(() => {
    for (const p of pendingRef.current) {
      if (p.state === "sending") continue;
      if (p.state === "failed" && !passing(p.reason)) continue;
      clearTimeout(timers.current.get(p.clientId));
      setPending((list) => list.map((x) => (x.clientId === p.clientId ? { ...x, state: "sending" } : x)));
      deliver(p, 1);
    }
  }, [deliver]);

  // The live connection.
  useEffect(() => {
    if (!path || !active) return;
    const socket = acquireSocket();
    let typingClear = null;
    emit.current = (event, payload) => socket.connected && socket.emit(event, payload);
    const here = (p) => !!p && p.threadId === threadRef.current;

    const join = () => {
      const id = threadRef.current;
      if (!id || !socket.connected) return;
      socket.emit("chat:join", id, (res) => {
        if (threadRef.current !== id) return;
        setLive(!!res?.ok);
        if (res?.ok) setPeer(res.peer ?? null);
      });
    };
    joinRef.current = join;
    const onConnect = () => {
      setConnected(true);
      // Anything missed while the connection was down, and anything written meanwhile.
      refresh();
      flush();
      join();
    };
    const onDisconnect = () => {
      setConnected(false);
      setLive(false);
      setTheyType(false);
    };
    const onMessage = (p) => {
      if (!here(p)) return;
      const { from, ...rest } = p.message;
      const mine = from === role;
      merge([{ ...rest, mine }]);
      if (!mine) {
        setTheyType(false);
        if (watching()) {
          socket.emit("chat:read", { threadId: p.threadId });
          onReadRef.current?.();
        }
      }
    };
    const onRead = (p) => here(p) && p.by !== role && setSeenAt(p.at);
    const onTyping = (p) => {
      if (!here(p) || p.from === role) return;
      setTheyType(!!p.typing);
      clearTimeout(typingClear);
      // In case the "stopped" signal never arrives.
      if (p.typing) typingClear = setTimeout(() => setTheyType(false), 6000);
    };
    const onPresence = (p) => setPeer((prev) => (prev && p?.id === prev.id ? p : prev));
    // The server emptied the room (the client's dietitian changed, sharing was switched off): ask again.
    const onReset = (p) => {
      if (!here(p)) return;
      setLive(false);
      refresh().then(join);
    };
    // Coming back to the tab: what arrived meanwhile has now been seen.
    const onVisible = () => watching() && refresh();
    const onOnline = () => {
      if (!socket.connected) socket.connect();
      flush();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("chat:message", onMessage);
    socket.on("chat:read", onRead);
    socket.on("chat:typing", onTyping);
    socket.on("chat:presence", onPresence);
    socket.on("chat:reset", onReset);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    if (socket.connected) onConnect();
    return () => {
      clearTimeout(typingClear);
      clearTimeout(typingStop.current);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("chat:message", onMessage);
      socket.off("chat:read", onRead);
      socket.off("chat:typing", onTyping);
      socket.off("chat:presence", onPresence);
      socket.off("chat:reset", onReset);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (socket.connected && threadRef.current) socket.emit("chat:leave", threadRef.current);
      emit.current = () => {};
      joinRef.current = () => {};
      releaseSocket();
    };
  }, [path, active, role, refresh, merge, flush, watching]);

  // The first answer from the API says which thread this is: only then can its room be joined.
  useEffect(() => {
    if (threadId && active) joinRef.current();
  }, [threadId, active]);

  /** Tells the other side "writing…": at most every 2.5 s, and "stopped" after a pause. */
  const typing = useCallback((isWriting) => {
    const id = threadRef.current;
    if (!id) return;
    clearTimeout(typingStop.current);
    if (!isWriting) {
      if (typingSent.current) emit.current("chat:typing", { threadId: id, typing: false });
      typingSent.current = 0;
      return;
    }
    if (Date.now() - typingSent.current > 2500) {
      typingSent.current = Date.now();
      emit.current("chat:typing", { threadId: id, typing: true });
    }
    typingStop.current = setTimeout(() => {
      typingSent.current = 0;
      emit.current("chat:typing", { threadId: id, typing: false });
    }, 3500);
  }, []);

  const send = useCallback((text) => {
    const body = text.trim();
    if (!body || !path) return false;
    const item = { clientId: newId(), body, createdAt: new Date().toISOString(), state: "sending" };
    typing(false);
    setPending((list) => [...list, item]);
    deliver(item);
    return true;
  }, [path, deliver, typing]);

  const retry = useCallback((clientId) => {
    const item = pendingRef.current.find((p) => p.clientId === clientId);
    if (!item) return;
    clearTimeout(timers.current.get(clientId));
    setPending((list) => list.map((p) => (p.clientId === clientId ? { ...p, state: "sending" } : p)));
    deliver(item);
  }, [deliver]);

  const discard = useCallback((clientId) => {
    clearTimeout(timers.current.get(clientId));
    timers.current.delete(clientId);
    setPending((list) => list.filter((p) => p.clientId !== clientId));
  }, []);

  /** The page before the oldest message on screen. */
  const loadOlder = useCallback(async () => {
    const first = messages?.[0];
    if (!first || !hasMore || loadingOlder) return;
    setLoadingOlder(true);
    const g = gen.current;
    try {
      const page = await api(`${path}?before=${encodeURIComponent(first.createdAt)}`);
      if (g !== gen.current) return;
      merge(page.messages);
      setHasMore(!!page.hasMore);
    } catch (e) {
      if (g === gen.current) setError(e);
    } finally {
      if (g === gen.current) setLoadingOlder(false);
    }
  }, [messages, hasMore, loadingOlder, path, merge]);

  return {
    messages, pending, seenAt, info, hasMore, loadingOlder, error,
    /** connected: the live connection is up. live: and it has been let into this thread. */
    connected, live, peer, theyType,
    refresh, send, retry, discard, typing, loadOlder,
  };
}
