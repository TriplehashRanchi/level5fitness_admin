"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { useChatInbox } from "@/lib/chat-inbox";
import { adherencePercent, GOAL_LABEL } from "@/lib/body";
import GroupPlanDialog from "@/components/group-plan";
import { Avatar, cx, Skeleton } from "@/components/ui";

/** Where a client stands this week, as one coloured dot: on track (70%+), behind, or no plan yet. */
function dotOf(c) {
  const percent = adherencePercent(c.done7, c.planned7);
  if (percent == null) return { color: "bg-white/25", label: "No plan yet", percent };
  if (percent >= 70) return { color: "bg-brand", label: "On track", percent };
  return { color: "bg-accent", label: "Falling behind", percent };
}

/**
 * A dietitian's own sidebar: every client assigned to them, in one list, so they can move from one
 * client to the next with a single click instead of going back to the Clients page. Shows who has written
 * (unread count), who is in the app right now, and how each client's week is going.
 */
export default function ClientsRail() {
  const pathname = usePathname();
  const { data, error } = useApi("/dietitian/clients");
  const { conversations } = useChatInbox();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const activeId = pathname.startsWith("/clients/") ? decodeURIComponent(pathname.split("/")[2] ?? "") : null;

  const byId = useMemo(() => Object.fromEntries((conversations ?? []).filter((c) => c.kind === "client").map((c) => [c.key, c])), [conversations]);
  const clients = useMemo(() => data?.clients ?? [], [data]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? clients.filter((c) => `${c.name ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q)) : clients;
  }, [clients, query]);

  return (
    <aside aria-label="Your clients" className="sticky top-[var(--bar)] hidden h-[calc(100dvh-var(--bar))] flex-col border-r border-line bg-ink xl:flex">
      <div className="shrink-0 px-4 pb-3 pt-5">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-[15px] font-semibold text-white">Your clients</h2>
          {data ? <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand">{clients.length}</span> : null}
        </div>
        {/* One meal or workout for this client, or for several at once: the dialog starts with the open client ticked. */}
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={!data || clients.length === 0}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Add diet or workout
        </button>
        <label className="relative mt-3 block">
          <span className="sr-only">Search your clients</span>
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="w-full rounded-full border border-line bg-card-2 py-2 pl-10 pr-4 text-sm text-white placeholder:text-muted focus:border-brand/60 focus:outline-none" />
        </label>
      </div>

      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {error && !data ? (
          <p className="px-3 py-6 text-center text-xs leading-5 text-muted">Your clients could not be loaded. Refresh the page to try again.</p>
        ) : !data ? (
          <div className="space-y-2 px-1" role="status" aria-label="Loading your clients…">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}</div>
        ) : shown.length === 0 ? (
          <p className="px-3 py-10 text-center text-xs leading-5 text-muted">{clients.length === 0 ? "No clients are assigned to you yet." : "Nobody matches."}</p>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((c) => {
              const active = c.id === activeId;
              const dot = dotOf(c);
              const chat = byId[c.id];
              return (
                <li key={c.id}>
                  <Link
                    href={`/clients/${encodeURIComponent(c.id)}`}
                    aria-current={active ? "page" : undefined}
                    className={cx("flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors", active ? "border-brand/40 bg-brand/15" : "border-transparent hover:bg-white/5")}
                  >
                    <span className="relative shrink-0">
                      <Avatar name={c.name || c.email} image={c.image} size={38} />
                      {chat?.online ? <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-ink bg-good" aria-hidden="true" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx("block truncate text-sm", active || chat?.unread ? "font-bold text-white" : "font-semibold text-zinc-100")}>{c.name || c.email}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", dot.color)} aria-hidden="true" />
                        <span className="truncate">{dot.percent == null ? "No plan yet" : `${dot.percent}% plan`}{c.goal ? ` · ${GOAL_LABEL[c.goal] ?? ""}` : ""}</span>
                      </span>
                    </span>
                    {chat?.unread ? (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold tabular-nums text-ink" aria-label={`${chat.unread} unread`}>{chat.unread > 99 ? "99+" : chat.unread}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {adding ? <GroupPlanDialog clients={clients} initial={activeId ? [activeId] : []} onClose={() => setAdding(false)} /> : null}

      <div className="flex shrink-0 flex-col gap-1.5 border-t border-line px-4 py-3">
        <Link href={activeId ? `/plans?client=${encodeURIComponent(activeId)}` : "/plans"} className="text-xs font-semibold text-brand hover:underline">Plans for many clients, many days →</Link>
        <Link href="/clients" className="text-xs font-semibold text-muted hover:text-white hover:underline">All clients, with filters →</Link>
      </div>
    </aside>
  );
}
