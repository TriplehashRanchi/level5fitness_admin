"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useNewChatMessages, useSocketConnected } from "@/lib/socket";

/**
 * Every conversation of the signed-in person, kept up to date for the whole console: the Messages
 * page, the unread number in the menu, the badges on the Clients table and the small alert that
 * appears when someone writes while you are on another page.
 *
 *   a dietitian has: the admin, and each of their clients
 *   the admin has:   each dietitian
 *
 * A conversation: { key, kind: "client" | "staff", id, name, email, image, lastBody, lastAt, lastMine,
 * unread, online, disabled }. `key` is what goes in the address: /messages?with=<key>.
 */
const InboxContext = createContext(null);

export const ADMIN_KEY = "admin";

/** Where a conversation's messages are read and sent. */
export function chatPathOf(role, key) {
  if (!key) return null;
  if (role === "admin") return `/admin/chats/${encodeURIComponent(key)}`;
  return key === ADMIN_KEY ? "/dietitian/admin-chat" : `/dietitian/clients/${encodeURIComponent(key)}/chat`;
}

function normalise(role, data) {
  if (role === "admin") {
    return (data.dietitians ?? []).map((d) => ({
      key: d.dietitianId, kind: "staff", id: d.dietitianId, name: d.name || d.email, email: d.email, image: d.image,
      lastBody: d.lastBody, lastAt: d.lastAt, lastMine: d.lastFrom === "admin", unread: d.unread, online: !!d.online, disabled: !!d.disabled,
    }));
  }
  const a = data.admin;
  return [
    ...(a ? [{ key: ADMIN_KEY, kind: "staff", id: ADMIN_KEY, name: "Admin", email: "Gym management", image: null, lastBody: a.lastBody, lastAt: a.lastAt, lastMine: a.lastFrom === "dietitian", unread: a.unread, online: !!a.online, disabled: false }] : []),
    ...(data.clients ?? []).map((c) => ({
      key: c.memberId, kind: "client", id: c.memberId, name: c.name || c.email, email: c.email, image: c.image,
      lastBody: c.lastBody, lastAt: c.lastAt, lastMine: c.lastFrom === "dietitian", unread: c.unread, online: !!c.online, disabled: false,
    })),
  ];
}

/** Which conversation a "someone wrote to you" nudge belongs to. */
function keyOfNudge(role, n) {
  if (role === "admin") return n.kind === "staff" ? n.dietitianId : null;
  return n.kind === "client" ? n.memberId : ADMIN_KEY;
}

export function ChatInboxProvider({ role, children }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  /** The conversation that is open in front of the person right now (set by the chat panel). */
  const openKey = useRef(null);
  const connected = useSocketConnected();
  const listRef = useRef(null);
  useEffect(() => {
    listRef.current = list;
  });

  const reload = useCallback(async () => {
    try {
      const data = await api(role === "admin" ? "/admin/chats" : "/dietitian/chats");
      setList(normalise(role, data));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [role]);

  // Load, then again every minute while the tab is visible, when coming back to it, and whenever the
  // live connection comes (back) up.
  useEffect(() => {
    queueMicrotask(reload);
    const id = setInterval(() => document.visibilityState === "visible" && reload(), connected ? 60_000 : 15_000);
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, connected]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  useNewChatMessages((n) => {
    const key = keyOfNudge(role, n);
    if (!key) return;
    const inFront = openKey.current === key && document.visibilityState === "visible";
    const known = listRef.current?.some((c) => c.key === key);
    setList((prev) =>
      prev?.map((c) => (c.key === key ? { ...c, lastBody: n.preview, lastAt: n.at, lastMine: false, unread: inFront ? 0 : c.unread + 1 } : c)) ?? prev
    );
    // Someone not in the list yet (a client assigned a moment ago): fetch the list again.
    if (!known) reload();
    if (inFront) return;
    const name = listRef.current?.find((c) => c.key === key)?.name || n.senderName || "New message";
    setToasts((t) => [...t.filter((x) => x.key !== key).slice(-2), { id: n.messageId || `${key}-${n.at}`, key, name, image: listRef.current?.find((c) => c.key === key)?.image ?? null, text: n.preview }]);
  });

  /** The chat panel says: this conversation has been read. */
  const markRead = useCallback((key) => {
    setList((prev) => (prev?.some((c) => c.key === key && c.unread) ? prev.map((c) => (c.key === key ? { ...c, unread: 0 } : c)) : prev));
    setToasts((t) => (t.some((x) => x.key === key) ? t.filter((x) => x.key !== key) : t));
  }, []);

  /** The chat panel says: I just sent this (so the list shows it without asking the API). */
  const noteSent = useCallback((key, body) => {
    setList((prev) => prev?.map((c) => (c.key === key ? { ...c, lastBody: body, lastAt: new Date().toISOString(), lastMine: true } : c)) ?? prev);
  }, []);

  const setOpen = useCallback((key) => {
    openKey.current = key;
  }, []);

  const total = useMemo(() => (list ?? []).reduce((sum, c) => sum + c.unread, 0), [list]);

  // The unread number in the browser tab, so it is seen from another tab.
  useEffect(() => {
    const strip = (t) => t.replace(/^\(\d+\+?\)\s/, "");
    const apply = () => {
      const base = strip(document.title);
      const next = total > 0 ? `(${total > 99 ? "99+" : total}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    // Going to another page sets a new title: put the number back in front of it.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      document.title = strip(document.title);
    };
  }, [total]);

  const value = useMemo(
    () => ({ role, conversations: list, error, total, connected, toasts, reload, markRead, noteSent, setOpen, dismiss }),
    [role, list, error, total, connected, toasts, reload, markRead, noteSent, setOpen, dismiss]
  );
  return <InboxContext value={value}>{children}</InboxContext>;
}

export function useChatInbox() {
  const ctx = use(InboxContext);
  if (!ctx) throw new Error("useChatInbox must be used inside <ChatInboxProvider>");
  return ctx;
}
