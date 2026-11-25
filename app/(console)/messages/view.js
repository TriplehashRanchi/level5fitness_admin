"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { messageOf } from "@/lib/api";
import { ADMIN_KEY, chatPathOf, useChatInbox } from "@/lib/chat-inbox";
import { keyOf, timeAgo, todayKey, fmtTime } from "@/lib/dates";
import ChatDetails from "@/components/chat/chat-details";
import ChatPanel, { OnlineDot } from "@/components/chat/chat-panel";
import { Alert, Avatar, Button, cx, Skeleton } from "@/components/ui";

/** "14:05" for today, otherwise "3 days ago" or a date. */
const shortTime = (iso, today) => (keyOf(new Date(iso)) === today ? fmtTime(iso) : timeAgo(iso));

function ConversationRow({ c, active, today, onOpen }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        className={cx(
          "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
          active ? "bg-brand/10 ring-1 ring-inset ring-brand/20" : "hover:bg-white/5"
        )}
      >
        <span className="relative shrink-0">
          {c.key === ADMIN_KEY ? (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky/15 text-sky">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6" /></svg>
            </span>
          ) : (
            <Avatar name={c.name} image={c.image} size={44} />
          )}
          <OnlineDot online={c.online} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cx("truncate text-sm text-white", c.unread ? "font-bold" : "font-semibold")}>{c.name}</span>
            {c.lastAt ? <span className={cx("shrink-0 text-[11px] tabular-nums", c.unread ? "font-semibold text-brand" : "text-muted")}>{shortTime(c.lastAt, today)}</span> : null}
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span className={cx("truncate text-xs", c.unread ? "font-medium text-zinc-200" : "text-muted")}>
              {c.lastBody ? <>{c.lastMine ? <span className="text-muted">You: </span> : null}{c.lastBody}</> : c.disabled ? "Disabled" : c.kind === "client" ? "No messages yet" : c.email || "No messages yet"}
            </span>
            {c.unread ? (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold tabular-nums text-ink" aria-label={`${c.unread} unread`}>
                {c.unread > 99 ? "99+" : c.unread}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

function NothingOpen({ isAdmin, total }) {
  return (
    <div className="hidden h-full flex-col items-center justify-center px-8 text-center lg:flex">
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand/10 text-brand">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M8.5 11h7M8.5 14.5h4" /></svg>
      </span>
      <p className="mt-5 text-lg font-semibold text-white">{total ? `${total} unread ${total === 1 ? "message" : "messages"}` : "Your messages"}</p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
        {isAdmin
          ? "Pick a dietitian on the left to write to them. They see it in the console and get a notification on their phone."
          : "Pick a client on the left to chat. New messages arrive here at once, and you can see when they have been read."}
      </p>
    </div>
  );
}

export default function MessagesPage() {
  const { staff } = useAuth();
  const isAdmin = staff.role === "admin";
  const { conversations, error, total, reload } = useChatInbox();
  const router = useRouter();
  const pathname = usePathname();
  const selected = useSearchParams().get("with");
  const [query, setQuery] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  // "About this person" opens when their picture or name at the top of the chat is clicked.
  const [detailsFor, setDetailsFor] = useState(null);
  const details = !!selected && detailsFor === selected;
  const toggleDetails = () => setDetailsFor(details ? null : selected);
  const today = todayKey();

  const open = (key) => router.replace(key ? `${pathname}?with=${encodeURIComponent(key)}` : pathname, { scroll: false });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (conversations ?? []).filter(
      (c) => (!q || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)) && (!onlyUnread || c.unread > 0 || c.key === selected)
    );
  }, [conversations, query, onlyUnread, selected]);

  const current = conversations?.find((c) => c.key === selected) ?? null;
  const unknown = !!selected && conversations && !current;

  return (
    // The top bar is a couple of pixels taller than --bar on a phone (two rows and their border).
    <div className="relative flex h-[calc(100dvh-var(--bar)-3px)] min-h-[26rem] overflow-hidden lg:h-[calc(100dvh-var(--bar))]">
      {/* The list of conversations. On a phone it gives way to the open conversation. */}
      <aside className={cx("w-full shrink-0 flex-col border-line bg-ink lg:flex lg:w-[340px] lg:border-r 2xl:w-[380px]", selected ? "hidden" : "flex")} aria-label="Conversations">
        <div className="border-b border-line px-4 pb-3 pt-5">
          <div className="flex items-center justify-between gap-3 px-1">
            <h1 className="text-xl font-semibold tracking-tight text-white">Messages</h1>
            {total ? <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[11px] font-semibold text-brand">{total} unread</span> : null}
          </div>
          <label className="relative mt-3 block">
            <span className="sr-only">Search conversations</span>
            <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAdmin ? "Search dietitians" : "Search clients"}
              className="w-full rounded-full border border-line bg-card-2 py-2 pl-10 pr-4 text-sm text-white placeholder:text-muted focus:border-brand/60 focus:outline-none"
            />
          </label>
          <div className="mt-3 flex gap-1.5" role="group" aria-label="Filter conversations">
            {[[false, "All"], [true, "Unread"]].map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={onlyUnread === value}
                onClick={() => setOnlyUnread(value)}
                className={cx("rounded-full px-3.5 py-1 text-xs font-semibold transition-colors", onlyUnread === value ? "bg-brand text-ink" : "text-muted hover:bg-white/5 hover:text-white")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="chat-scroll min-h-0 flex-1 overflow-y-auto p-2">
          {error && !conversations ? (
            <div className="p-2"><Alert action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>{messageOf(error)}</Alert></div>
          ) : !conversations ? (
            <div className="space-y-2 p-2" role="status" aria-label="Loading conversations…">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            </div>
          ) : shown.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-white">
                {conversations.length === 0 ? (isAdmin ? "No dietitians yet" : "No clients yet") : onlyUnread && !query ? "You are all caught up" : "Nobody matches"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {conversations.length === 0
                  ? isAdmin ? "Invite a dietitian first; you can then write to them here." : "The admin assigns clients to you. They appear here as soon as they do."
                  : onlyUnread && !query ? "No unread messages." : "Try another name."}
              </p>
              {isAdmin && conversations.length === 0 ? <Link href="/dietitians" className="mt-4 inline-block text-xs font-semibold text-brand hover:underline">Go to Dietitians</Link> : null}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {shown.map((c) => <ConversationRow key={c.key} c={c} today={today} active={c.key === selected} onOpen={() => open(c.key)} />)}
            </ul>
          )}
        </div>
      </aside>

      <section className={cx("min-w-0 flex-1 flex-col lg:flex", selected ? "flex" : "hidden")} aria-label={current ? `Conversation with ${current.name}` : "Conversation"}>
        {current ? (
          <ChatPanel
            key={current.key}
            className="h-full"
            wide
            convKey={current.key}
            path={chatPathOf(staff.role, current.key)}
            role={staff.role}
            name={current.name}
            image={current.image}
            note={current.kind === "client" ? "Your client" : isAdmin ? current.email || "Dietitian" : "Gym management"}
            quickReplies={current.kind === "client"}
            blocked={current.disabled ? "This dietitian is disabled and cannot read messages. Enable them on the Dietitians page to write to them." : null}
            onBack={() => open(null)}
            onProfile={toggleDetails}
          />
        ) : unknown ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <p className="text-base font-semibold text-white">This conversation is not available</p>
            <p className="mt-1 max-w-sm text-sm text-muted">{isAdmin ? "That dietitian was not found." : "That client is not assigned to you (any more)."}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => open(null)}>All conversations</Button>
          </div>
        ) : (
          <NothingOpen isAdmin={isAdmin} total={total} />
        )}
      </section>

      {/* Who you are talking to: a third column where there is room, otherwise it slides over the chat. */}
      {current && details ? (
        <aside className="chat-pop absolute inset-y-0 right-0 z-10 w-full border-l border-line bg-card shadow-2xl shadow-black/60 sm:w-[340px] xl:static xl:w-[320px] xl:shadow-none" aria-label={`About ${current.name}`}>
          <ChatDetails key={current.key} c={current} isAdmin={isAdmin} onClose={toggleDetails} />
        </aside>
      ) : null}
    </div>
  );
}
