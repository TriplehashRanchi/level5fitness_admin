"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { messageOf } from "@/lib/api";
import { useChatInbox } from "@/lib/chat-inbox";
import { dayLabel, fmtTime, keyOf, timeAgo, todayKey } from "@/lib/dates";
import { useChat } from "@/lib/use-chat";
import { Avatar, Button, cx, Skeleton } from "@/components/ui";

const MAX_LENGTH = 2000;

/** Things a dietitian says often. A click puts the text in the box; it is sent only when they press Send. */
const QUICK_REPLIES = [
  "Great work today, keep it up!",
  "How are you feeling today?",
  "Please log your meals with a photo so I can check them.",
  "Remember to drink enough water today.",
  "I have updated your plan. Have a look and tell me if anything is unclear.",
  "Did you manage your workout today?",
];

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** The text of a message, with web addresses made into links. */
function Body({ text, mine }) {
  const parts = text.split(URL_RE);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className={cx("underline underline-offset-2 break-all", mine ? "text-ink" : "text-brand")}>
        {part}
      </a>
    ) : (
      part
    )
  );
}

function Ticks({ seen }) {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={seen ? "text-brand" : "text-muted"}>
      <path d="M1 5.5l3 3L10 2" />
      {seen ? <path d="M7 8.5L13.5 2" /> : null}
    </svg>
  );
}

/** A green dot on the corner of a picture: this person is in the app right now. */
export function OnlineDot({ online, className }) {
  if (!online) return null;
  return <span className={cx("absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-good", className)} aria-hidden="true" />;
}

function TypingBubble({ name, image }) {
  return (
    <div className="mb-2 flex items-end gap-2" role="status" aria-label={`${name} is typing`}>
      <span className="w-7 shrink-0"><Avatar name={name} image={image} size={28} /></span>
      <span className="chat-pop flex items-center gap-1 rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-3">
        <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
      </span>
    </div>
  );
}

/**
 * One conversation: who it is with (and whether they are online), the messages, and a box to write in.
 * Used by the Messages page and on a client's page.
 *
 *   convKey   the conversation's key in the inbox (see lib/chat-inbox.js)
 *   path      where its messages are read and sent
 *   role      the role the signed-in person speaks with: "dietitian" or "admin"
 *   active    false until the panel is really on screen; nothing loads or is marked read before
 *   wide      the panel may be very wide: keep the messages in a centred column
 *   onProfile when given, the picture and name at the top are a button (the Messages page opens the details with it)
 */
export default function ChatPanel({ convKey, path, role, name, image, note, active = true, header = true, action, quickReplies = false, blocked, onBack, onProfile, className, wide = false }) {
  // On a very wide screen the conversation stays a comfortable reading width, in the middle.
  const column = wide ? "mx-auto w-full max-w-4xl" : "";
  const inbox = useChatInbox();
  const { markRead, noteSent, setOpen } = inbox;
  const onRead = useCallback(() => markRead(convKey), [markRead, convKey]);
  const chat = useChat({ path, role, active, onRead });
  const { messages, pending, seenAt, error, connected, live, peer, theyType, hasMore, loadingOlder } = chat;

  // What was being written here is still there after going to another page and back.
  // (Give the panel a `key` per conversation, so each one starts with its own draft.)
  const [text, setText] = useState(() => {
    try {
      return sessionStorage.getItem(`l5-draft:${path}`) ?? "";
    } catch {
      return ""; // storage switched off: no drafts
    }
  });
  const [showQuick, setShowQuick] = useState(false);
  const [below, setBelow] = useState(0);
  const [lost, setLost] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const stick = useRef(true);
  const anchor = useRef(null);
  const count = useRef(0);
  const who = name || "them";
  const draftKey = `l5-draft:${path}`;

  // The inbox must know which conversation is in front of the person, so it does not count or announce it.
  useEffect(() => {
    if (!active) return;
    setOpen(convKey);
    return () => setOpen(null);
  }, [active, convKey, setOpen]);

  const write = (value) => {
    setText(value);
    chat.typing(!!value.trim());
    try {
      if (value) sessionStorage.setItem(draftKey, value);
      else sessionStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  };

  // The box grows with what is written, up to a few lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  // "Connection lost" is said only after a few seconds without it, never during a normal start.
  useEffect(() => {
    if (connected || !active) return;
    const id = setTimeout(() => setLost(true), 4000);
    return () => {
      clearTimeout(id);
      setLost(false);
    };
  }, [connected, active]);

  const rows = useMemo(() => [...(messages ?? []), ...pending.map((p) => ({ ...p, id: p.clientId, mine: true }))], [messages, pending]);

  // Stay at the newest message, unless the person has scrolled up to read older ones. When an older
  // page is added on top, what was being read stays exactly where it was.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (anchor.current != null) {
      el.scrollTop += el.scrollHeight - anchor.current;
      anchor.current = null;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    } else if (rows.length > count.current && !rows[rows.length - 1]?.mine) {
      const added = rows.length - count.current;
      setBelow((n) => n + added);
    }
    count.current = rows.length;
  }, [rows, theyType]);

  const toBottom = () => {
    const el = listRef.current;
    if (!el) return;
    stick.current = true;
    setBelow(0);
    el.scrollTo({ top: el.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const older = () => {
    const el = listRef.current;
    if (!el || !hasMore || loadingOlder) return;
    anchor.current = el.scrollHeight;
    chat.loadOlder();
  };

  const onScroll = (e) => {
    const el = e.currentTarget;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (stick.current && below) setBelow(0);
    if (el.scrollTop < 60) older();
  };

  const submit = () => {
    const body = text.trim();
    if (!body || blocked) return;
    if (!chat.send(body)) return;
    stick.current = true;
    setBelow(0);
    write("");
    setShowQuick(false);
    noteSent(convKey, body);
    inputRef.current?.focus();
  };

  const today = todayKey();
  const status = theyType ? "typing…" : peer?.online ? "Online" : peer?.lastSeenAt ? `Last seen ${timeAgo(peer.lastSeenAt)}` : note;
  const left = MAX_LENGTH - text.length;

  return (
    <div className={cx("flex min-h-0 flex-col", className)}>
      {header ? (
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          {onBack ? (
            <button type="button" onClick={onBack} aria-label="Back to all conversations" className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-white lg:hidden">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
          ) : null}
          {/* Who this is, and whether they are here. Nothing else: a lost connection is said in the line below. */}
          {(() => {
            const person = (
              <>
                <span className="relative shrink-0"><Avatar name={name} image={image} size={42} /><OnlineDot online={peer?.online} /></span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[15px] font-semibold text-white">{name}</span>
                  <span className={cx("block truncate text-xs", theyType || peer?.online ? "font-semibold text-brand" : "text-muted")} aria-live="polite">{status}</span>
                </span>
              </>
            );
            return onProfile ? (
              <button type="button" onClick={onProfile} title={`About ${name}`} className="-my-1 -ml-1.5 flex min-w-0 max-w-full items-center gap-3 rounded-2xl py-1 pl-1.5 pr-4 transition-colors hover:bg-white/5">
                {person}
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-3">{person}</div>
            );
          })()}
          {onProfile ? <span className="flex-1" /> : null}
          {action}
        </div>
      ) : null}

      {lost ? (
        <p className="border-b border-warn/20 bg-warn/10 px-5 py-2 text-xs font-medium text-warn" role="status">
          Connection lost. Still trying; anything you write is sent as soon as it is back.
        </p>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {messages === null ? (
          <div className="flex h-full flex-col justify-end gap-3 p-5">
            {error ? (
              <div className="m-auto max-w-sm text-center">
                <p className="text-sm font-semibold text-white">{messageOf(error)}</p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={chat.refresh}>Try again</Button>
              </div>
            ) : (
              <div role="status" aria-label="Loading the chat…" className="space-y-3">
                <Skeleton className="h-10 w-2/5 rounded-2xl" />
                <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
                <Skeleton className="h-14 w-3/5 rounded-2xl" />
                <Skeleton className="ml-auto h-10 w-1/3 rounded-2xl" />
              </div>
            )}
          </div>
        ) : (
          <div ref={listRef} onScroll={onScroll} className="chat-scroll h-full overflow-y-auto px-4 py-4 sm:px-5" role="log" aria-label={`Chat with ${who}`} aria-live="polite" tabIndex={0}>
            <div className={cx("flex min-h-full flex-col", column)}>
            {rows.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <Avatar name={name} image={image} size={72} />
                <p className="mt-4 text-base font-semibold text-white">Start the conversation</p>
                <p className="mt-1 max-w-xs text-sm leading-6 text-muted">Say hello to {who}. They get a notification and can answer from {role === "admin" ? "the console or the app" : "the app"}.</p>
              </div>
            ) : null}
            {hasMore ? (
              <div className="mb-3 flex justify-center">
                <Button variant="ghost" size="sm" onClick={older} loading={loadingOlder}>{loadingOlder ? "Loading…" : "Show earlier messages"}</Button>
              </div>
            ) : rows.length > 0 ? (
              <p className="mb-3 mt-auto text-center text-[11px] text-muted">This is the start of your conversation with {who}.</p>
            ) : null}
            {rows.map((m, i) => {
              const prev = rows[i - 1];
              const next = rows[i + 1];
              const day = keyOf(new Date(m.createdAt));
              const startsDay = !prev || keyOf(new Date(prev.createdAt)) !== day;
              const startsRun = startsDay || prev.mine !== m.mine;
              const endsRun = !next || next.mine !== m.mine || keyOf(new Date(next.createdAt)) !== day || !!m.state !== !!next.state;
              const seen = m.mine && !m.state && !!seenAt && seenAt >= m.createdAt;
              return (
                <div key={m.id}>
                  {startsDay ? (
                    <p className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
                      <span className="h-px flex-1 bg-line" />{dayLabel(day, today)}<span className="h-px flex-1 bg-line" />
                    </p>
                  ) : null}
                  <div className={cx("flex items-end gap-2", endsRun ? "mb-3" : "mb-0.5")}>
                    {/* Their picture beside the last message of each run; the same room is kept on the others so the bubbles line up. */}
                    {!m.mine ? <span className={cx("w-7 shrink-0", endsRun ? "mb-5" : "")} aria-hidden="true">{endsRun ? <Avatar name={name} image={image} size={28} /> : null}</span> : null}
                    <div className={cx("flex min-w-0 flex-1 flex-col", m.mine ? "items-end" : "items-start")}>
                      <p
                        className={cx(
                          "max-w-[min(78%,34rem)] whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-6",
                          m.mine ? "bg-brand text-ink" : "bg-white/10 text-white",
                          m.mine
                            ? cx("rounded-l-2xl", startsRun ? "rounded-tr-2xl" : "rounded-tr-md", endsRun ? "rounded-br-2xl" : "rounded-br-md")
                            : cx("rounded-r-2xl", startsRun ? "rounded-tl-2xl" : "rounded-tl-md", endsRun ? "rounded-bl-2xl" : "rounded-bl-md"),
                          m.state === "failed" ? "opacity-70 ring-1 ring-accent" : m.state ? "opacity-60" : "",
                          i >= rows.length - 2 ? "chat-pop" : ""
                        )}
                      >
                        <span className="sr-only">{m.mine ? "You: " : `${who}: `}</span>
                        <Body text={m.body} mine={m.mine} />
                      </p>
                      {m.state === "failed" ? (
                        <p className="mt-1 flex items-center gap-2 text-xs text-accent" role="alert">
                          <span className="font-semibold">Not sent{m.reason?.status >= 400 && m.reason.status < 500 && m.reason.status !== 429 ? `: ${messageOf(m.reason)}` : "."}</span>
                          <button type="button" onClick={() => chat.retry(m.clientId)} className="font-semibold underline underline-offset-2 hover:text-white">Try again</button>
                          <button type="button" onClick={() => chat.discard(m.clientId)} className="text-muted underline underline-offset-2 hover:text-white">Delete</button>
                        </p>
                      ) : endsRun ? (
                        <p className="mx-1 mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                          {m.state === "waiting" ? "Waiting for the connection…" : m.state === "sending" ? "Sending…" : (
                            <>
                              <time dateTime={m.createdAt}>{fmtTime(m.createdAt)}</time>
                              {m.mine ? <><Ticks seen={seen} /><span className={seen ? "text-brand" : ""}>{seen ? "Seen" : "Sent"}</span></> : null}
                            </>
                          )}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            {theyType ? <TypingBubble name={who} image={image} /> : null}
            </div>
          </div>
        )}

        {below > 0 ? (
          <button type="button" onClick={toBottom} className="chat-pop absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-brand px-4 py-2 text-xs font-bold text-ink shadow-lg shadow-black/50">
            {below} new {below === 1 ? "message" : "messages"}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        ) : null}
      </div>

      {messages !== null ? (
        <div className="border-t border-line px-3 py-3 sm:px-4">
          <div className={column}>
          {error ? <p className="mb-2 px-1 text-xs font-semibold text-accent" role="alert">{messageOf(error)}</p> : null}
          {blocked ? (
            <p className="rounded-xl bg-card-2 px-4 py-3 text-center text-sm text-muted">{blocked}</p>
          ) : (
            <>
              {showQuick ? (
                <ul className="no-scrollbar mb-2.5 flex gap-2 overflow-x-auto" aria-label="Quick replies">
                  {QUICK_REPLIES.map((q) => (
                    <li key={q} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          write(text.trim() ? `${text.trimEnd()} ${q}` : q);
                          inputRef.current?.focus();
                        }}
                        className="rounded-full border border-line bg-card-2 px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-brand/40 hover:text-brand"
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                {quickReplies ? (
                  <button
                    type="button"
                    onClick={() => setShowQuick((v) => !v)}
                    aria-pressed={showQuick}
                    aria-label="Quick replies"
                    title="Quick replies"
                    className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors", showQuick ? "border-brand/40 bg-brand/10 text-brand" : "border-line bg-card-2 text-muted hover:text-white")}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>
                  </button>
                ) : null}
                <label htmlFor={`chat-box-${convKey}`} className="sr-only">Message to {who}</label>
                <textarea
                  id={`chat-box-${convKey}`}
                  ref={inputRef}
                  value={text}
                  onChange={(e) => write(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter sends; Shift+Enter makes a new line. Not while an input method is composing.
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  maxLength={MAX_LENGTH}
                  rows={1}
                  placeholder={`Message ${who}`}
                  className="min-h-11 flex-1 resize-none rounded-3xl border border-line bg-card-2 px-4 py-2.5 text-sm leading-6 text-white placeholder:text-muted focus:border-brand/60 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!text.trim()}
                  aria-label="Send"
                  className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors", text.trim() ? "bg-brand text-ink hover:bg-brand-dark" : "bg-card-2 text-muted")}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                </button>
              </form>
              <p className="mt-1.5 flex justify-between gap-3 px-1 text-[11px] text-muted">
                <span className="hidden sm:inline">Enter sends · Shift+Enter starts a new line</span>
                {left <= 200 ? <span className={cx("ml-auto tabular-nums", left <= 20 ? "font-semibold text-accent" : "")}>{left} characters left</span> : null}
              </p>
            </>
          )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
