"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, messageOf } from "@/lib/api";
import { dayLabel, fmtTime, keyOf, todayKey } from "@/lib/dates";
import { acquireSocket, releaseSocket } from "@/lib/socket";
import { Button, cx, Section, SectionError, SectionSkeleton } from "@/components/ui";

const MAX_LENGTH = 2000;
/** How often the open chat asks the API for new messages: rarely while live, often while not. */
const POLL_LIVE_MS = 30_000;
const POLL_OFFLINE_MS = 4000;

const byTime = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);

/**
 * The dietitian's chat with one client, as a section of the client page.
 * New messages, "seen" and "typing" arrive at once over the live connection; if that is down, it asks
 * the API every few seconds instead. Nothing is loaded (and nothing is marked as read) until the
 * section has actually been scrolled into view.
 */
export default function ClientChat({ memberId, name }) {
  const enc = encodeURIComponent(memberId);
  const [messages, setMessages] = useState(null);
  const [seenAt, setSeenAt] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState("");
  const [live, setLive] = useState(false);
  const [theyType, setTheyType] = useState(false);
  /** The section has been on screen at least once. */
  const [opened, setOpened] = useState(false);

  const rootRef = useRef(null);
  const listRef = useRef(null);
  const inView = useRef(false);
  const newest = useRef(undefined);
  const busy = useRef(false);
  const tempId = useRef(0);
  const emit = useRef(() => {});
  const typingSent = useRef(0);
  const typingStop = useRef(null);
  const stick = useRef(true);

  /** "In front of the dietitian right now": on screen, in a visible tab. */
  const watching = () => inView.current && document.visibilityState === "visible";

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      inView.current = entry.isIntersecting;
      if (entry.isIntersecting) setOpened(true);
    }, { threshold: 0.25 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const after = newest.current;
      const page = await api(`/dietitian/clients/${enc}/chat${after ? `?after=${encodeURIComponent(after)}` : ""}`);
      setMessages((prev) => {
        const pending = (prev ?? []).filter((m) => m.state);
        const kept = after ? (prev ?? []).filter((m) => !m.state) : [];
        const ids = new Set(kept.map((m) => m.id));
        return [...[...kept, ...page.messages.filter((m) => !ids.has(m.id))].sort(byTime), ...pending];
      });
      // Only what a check brought back moves the mark, never a message just sent from here.
      const last = page.messages[page.messages.length - 1];
      if (last && (!newest.current || last.createdAt > newest.current)) newest.current = last.createdAt;
      setSeenAt(page.seenAt);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      busy.current = false;
    }
  }, [enc]);

  // Load once the section is first seen, then keep asking (slowly while the live connection is up).
  useEffect(() => {
    if (!opened) return;
    refresh();
    const id = setInterval(() => watching() && refresh(), live ? POLL_LIVE_MS : POLL_OFFLINE_MS);
    return () => clearInterval(id);
  }, [opened, live, refresh]);

  // The live connection.
  useEffect(() => {
    if (!opened) return;
    const socket = acquireSocket();
    let typingClear = null;
    emit.current = (event, payload) => socket.connected && socket.emit(event, payload);

    const onConnect = () => {
      refresh();
      socket.emit("chat:join", memberId, (res) => setLive(!!res?.ok));
    };
    const onDisconnect = () => {
      setLive(false);
      setTheyType(false);
    };
    const onMessage = (p) => {
      if (p?.memberId !== memberId) return;
      const { fromMember, ...rest } = p.message;
      const mine = !fromMember;
      setMessages((prev) => {
        const list = prev ?? [];
        if (list.some((m) => m.id === rest.id)) return list;
        // My own message coming back: the answer to my send puts it in place.
        if (mine && list.some((m) => m.state === "sending" && m.body === rest.body)) return list;
        return [...[...list.filter((m) => !m.state), { ...rest, mine }].sort(byTime), ...list.filter((m) => m.state)];
      });
      if (!mine) {
        setTheyType(false);
        if (watching()) socket.emit("chat:read", { memberId });
      }
    };
    const onRead = (p) => p?.memberId === memberId && p.by === "member" && setSeenAt(p.at);
    const onTyping = (p) => {
      if (p?.memberId !== memberId || p.from !== "member") return;
      setTheyType(!!p.typing);
      if (typingClear) clearTimeout(typingClear);
      if (p.typing) typingClear = setTimeout(() => setTheyType(false), 6000);
    };
    // Coming back to the tab: what arrived meanwhile has now been seen.
    const onVisible = () => watching() && refresh();

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("chat:message", onMessage);
    socket.on("chat:read", onRead);
    socket.on("chat:typing", onTyping);
    document.addEventListener("visibilitychange", onVisible);
    if (socket.connected) onConnect();
    return () => {
      if (typingClear) clearTimeout(typingClear);
      if (typingStop.current) clearTimeout(typingStop.current);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("chat:message", onMessage);
      socket.off("chat:read", onRead);
      socket.off("chat:typing", onTyping);
      document.removeEventListener("visibilitychange", onVisible);
      if (socket.connected) socket.emit("chat:leave", memberId);
      emit.current = () => {};
      releaseSocket();
    };
  }, [opened, memberId, refresh]);

  // Stay at the newest message, unless the dietitian has scrolled up to read older ones.
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, theyType]);

  const deliver = async (id, body) => {
    try {
      const { message } = await api(`/dietitian/clients/${enc}/chat`, { method: "POST", body: { body } });
      setMessages((prev) => {
        const rest = (prev ?? []).filter((m) => m.id !== id && m.id !== message.id);
        return [...[...rest.filter((m) => !m.state), message].sort(byTime), ...rest.filter((m) => m.state)];
      });
    } catch (e) {
      setMessages((prev) => (prev ?? []).map((m) => (m.id === id ? { ...m, state: "failed" } : m)));
      setError(e);
    }
  };

  /** Tells the client "writing…": at most every 2.5 s, and "stopped" after a pause. */
  const typing = (value) => {
    setText(value);
    if (typingStop.current) clearTimeout(typingStop.current);
    if (!value.trim()) {
      if (typingSent.current) emit.current("chat:typing", { memberId, typing: false });
      typingSent.current = 0;
      return;
    }
    if (Date.now() - typingSent.current > 2500) {
      typingSent.current = Date.now();
      emit.current("chat:typing", { memberId, typing: true });
    }
    typingStop.current = setTimeout(() => {
      typingSent.current = 0;
      emit.current("chat:typing", { memberId, typing: false });
    }, 3500);
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    const id = `local-${++tempId.current}`;
    typing("");
    setError(null);
    stick.current = true;
    setMessages((prev) => [...(prev ?? []), { id, body, mine: true, createdAt: new Date().toISOString(), readAt: null, state: "sending" }]);
    deliver(id, body);
  };

  const retry = (m) => {
    setError(null);
    setMessages((prev) => (prev ?? []).map((x) => (x.id === m.id ? { ...x, state: "sending" } : x)));
    deliver(m.id, m.body);
  };

  const today = todayKey();
  const lastMineId = useMemo(() => [...(messages ?? [])].reverse().find((m) => m.mine && !m.state)?.id, [messages]);
  const who = name || "the client";

  return (
    <div ref={rootRef}>
      <Section
        id="chat"
        title="Chat"
        description={`Messages with ${who}. They see them in the app and get a notification.`}
        action={
          <span className={cx("inline-flex items-center gap-2 text-xs font-semibold", live ? "text-brand" : "text-muted")} role="status">
            <span className={cx("h-2 w-2 rounded-full", live ? "bg-brand" : "bg-white/30")} aria-hidden="true" />
            {live ? "Live" : opened ? "Connecting…" : ""}
          </span>
        }
      >
        {messages === null ? (
          error ? <SectionError onRetry={refresh}>{messageOf(error)}</SectionError> : <SectionSkeleton rows={3} label="Loading the chat…" />
        ) : (
          <>
            <div
              ref={listRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
              className="h-[26rem] overflow-y-auto rounded-2xl border border-line bg-black/30 px-4 py-3"
              role="log"
              aria-label={`Chat with ${who}`}
              aria-live="polite"
              tabIndex={0}
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="text-sm font-semibold text-white">No messages yet</p>
                  <p className="mt-1 text-sm text-muted">Say hello to {who}.</p>
                </div>
              ) : null}
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const next = messages[i + 1];
                const day = keyOf(new Date(m.createdAt));
                const startsDay = !prev || keyOf(new Date(prev.createdAt)) !== day;
                const endsRun = !next || next.mine !== m.mine || keyOf(new Date(next.createdAt)) !== day;
                const seen = m.id === lastMineId && !!seenAt && seenAt >= m.createdAt;
                return (
                  <div key={m.id}>
                    {startsDay ? <p className="my-3 text-center text-[11px] font-bold uppercase tracking-widest text-muted">{dayLabel(day, today)}</p> : null}
                    <div className={cx("flex flex-col", m.mine ? "items-end" : "items-start", endsRun ? "mb-2.5" : "mb-1")}>
                      <p
                        className={cx(
                          "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-6",
                          m.mine ? "bg-brand text-ink" : "bg-white/10 text-white",
                          m.mine && endsRun ? "rounded-br-md" : "",
                          !m.mine && endsRun ? "rounded-bl-md" : "",
                          m.state === "sending" ? "opacity-60" : ""
                        )}
                      >
                        <span className="sr-only">{m.mine ? "You: " : `${who}: `}</span>
                        {m.body}
                      </p>
                      {m.state === "failed" ? (
                        <button type="button" onClick={() => retry(m)} className="mt-1 text-xs font-semibold text-accent hover:underline">
                          Not sent. Try again
                        </button>
                      ) : endsRun ? (
                        <p className="mx-1 mt-1 text-[11px] text-muted">
                          {m.state === "sending" ? "Sending…" : `${fmtTime(m.createdAt)}${seen ? " · Seen" : ""}`}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {theyType ? <p className="mt-1 text-xs font-semibold text-brand">{who} is typing…</p> : null}
            </div>

            {error ? <p className="mt-2 text-xs font-semibold text-accent" role="alert">{messageOf(error)}</p> : null}

            <form
              className="mt-3 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label htmlFor="chat-message" className="sr-only">Message</label>
              <textarea
                id="chat-message"
                value={text}
                onChange={(e) => typing(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends; Shift+Enter makes a new line. Not while an input method is composing.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                maxLength={MAX_LENGTH}
                rows={1}
                placeholder="Write a message"
                className="max-h-36 min-h-11 flex-1 resize-y rounded-xl border border-line bg-card-2 px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-brand focus:outline-none"
              />
              <Button type="submit" disabled={!text.trim()}>Send</Button>
            </form>
            <p className="mt-1.5 text-xs text-muted">Enter sends. Shift+Enter starts a new line.</p>
          </>
        )}
      </Section>
    </div>
  );
}
