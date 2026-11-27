"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useChatInbox } from "@/lib/chat-inbox";
import { adherencePercent, fmtKg, GOAL_LABEL } from "@/lib/body";
import GroupPlanDialog from "@/components/group-plan";
import { STAGES } from "@/lib/cases";
import { Chevron, ListTable, MeterCell, PersonCell, TwoLine } from "@/components/table";
import { Alert, Badge, Button, EmptyState, PageHeader, PageSpinner, StatCard } from "@/components/ui";

/** Where a client stands this week: no plan, on track (70%+), or behind. */
function statusOf(c) {
  const percent = adherencePercent(c.done7, c.planned7);
  if (percent == null) return { key: "noplan", percent, label: "No plan", tone: "warn", bar: "bg-white/20" };
  if (percent >= 70) return { key: "good", percent, label: "On track", tone: "good", bar: "bg-good" };
  return { key: "behind", percent, label: "Falling behind", tone: "bad", bar: "bg-accent" };
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "good", label: "On track" },
  { id: "behind", label: "Falling behind" },
  { id: "noplan", label: "No plan" },
];

export default function ClientsPage() {
  const { staff } = useAuth();
  const isAdmin = staff.role === "admin";
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  // Search after a short pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, latest: last, error, reload } = useApi(`/dietitian/clients${search ? `?q=${encodeURIComponent(search)}` : ""}`);
  // Unread chat messages per client; brought up to date the moment a client writes.
  const { conversations } = useChatInbox();
  const unread = useMemo(() => Object.fromEntries((conversations ?? []).filter((c) => c.kind === "client" && c.unread).map((c) => [c.key, c.unread])), [conversations]);
  // While a new search loads, the rows already on screen stay there.
  const list = data ?? last;

  const clients = useMemo(() => (list?.clients ?? []).map((c) => ({ ...c, _s: statusOf(c) })), [list]);
  const counts = useMemo(() => {
    const n = { all: clients.length, good: 0, behind: 0, noplan: 0 };
    for (const c of clients) n[c._s.key] += 1;
    return n;
  }, [clients]);
  const shown = useMemo(() => clients.filter((c) => filter === "all" || c._s.key === filter), [clients, filter]);
  // Click a heading to sort. Status goes from "needs attention" to "fine".
  const hrefOf = (c) => `/clients/${encodeURIComponent(c.id)}`;
  const columns = [
    {
      key: "name", header: "Client", sort: (c) => c.name || c.email,
      cell: (c) => (
        <div className="flex items-center gap-3">
          <PersonCell name={c.name} email={c.email} image={c.image} href={hrefOf(c)} />
          {unread[c.id] ? (
            <Link href={`/messages?with=${encodeURIComponent(c.id)}`} className="shrink-0 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold text-ink hover:bg-brand-dark">
              {unread[c.id] > 99 ? "99+" : unread[c.id]} new {unread[c.id] === 1 ? "message" : "messages"}
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      key: "status", header: "Status", sort: (c) => ({ noplan: 0, behind: 1, good: 2 })[c._s.key],
      cell: (c) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={c._s.tone}>{c._s.label}</Badge>
          {c.pauseStatus ? <Badge tone="warn">{c.pauseStatus === "restart_requested" ? "Ready to restart" : "Paused"}</Badge> : null}
          {c.needsReview ? <Badge tone="warn">Review health</Badge> : null}
        </div>
      ),
    },
    {
      key: "stage", header: "Stage", nowrap: true, sort: (c) => c.lifecycle ?? "",
      cell: (c) => (c.lifecycle && STAGES[c.lifecycle] ? (
        <div className="flex items-center gap-1.5">
          <Badge tone={STAGES[c.lifecycle].tone}>{STAGES[c.lifecycle].label}</Badge>
          {c.openCases ? <Badge tone="warn">{c.openCases} {c.openCases === 1 ? "case" : "cases"}</Badge> : null}
        </div>
      ) : <span className="text-muted">–</span>),
    },
    { key: "plan", header: "Plan, last 7 days", sort: (c) => c._s.percent, cell: (c) => <MeterCell percent={c._s.percent} note={c._s.percent == null ? null : `${c.done7}/${c.planned7}`} tone={c._s.bar} label="Plan completion" /> },
    { key: "goal", header: "Goal", nowrap: true, sort: (c) => GOAL_LABEL[c.goal], cell: (c) => GOAL_LABEL[c.goal] ?? <span className="text-muted">–</span> },
    { key: "weight", header: "Weight", nowrap: true, sort: (c) => c.weightKg, cell: (c) => <TwoLine main={fmtKg(c.weightKg)} note={`Target ${fmtKg(c.targetWeightKg)}`} /> },
    ...(isAdmin ? [{ key: "dietitian", header: "Dietitian", nowrap: true, sort: (c) => c.dietitianName, cell: (c) => c.dietitianName || <span className="text-muted">–</span> }] : []),
    { key: "open", header: "Open", hidden: true, align: "right", cell: () => <span className="inline-flex text-muted"><Chevron /></span> },
  ];

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={isAdmin ? "Everyone assigned to a dietitian, and how their week is going." : "Clients the admin has assigned to you. Open a profile to add diet and exercise plans, or add one meal or workout for several clients at once."}
        actions={isAdmin ? null : <Button onClick={() => setAdding(true)} disabled={!list || list.clients.length === 0}>+ Add diet or workout</Button>}
      />
      {adding && list ? <GroupPlanDialog clients={list.clients} onClose={() => setAdding(false)} /> : null}

      {error ? <div className="mb-5"><Alert action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>{messageOf(error)}</Alert></div> : null}

      {list ? (
        <div className="mb-6 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
          <StatCard label="Total clients" value={counts.all} />
          <StatCard label="On track" value={counts.good} tone="brand" hint="70%+ of plan done" />
          <StatCard label="Falling behind" value={counts.behind} hint="Under 70% of plan done" />
          <StatCard label="No plan" value={counts.noplan} tone={counts.noplan ? "warn" : undefined} hint="Nothing scheduled in 7 days" />
        </div>
      ) : null}

      {!data && !last && !error ? <PageSpinner /> : null}
      {list && clients.length === 0 && !search ? (
        <EmptyState title="No clients yet">
          {isAdmin ? "Members appear here after you assign them to a dietitian." : "The admin will assign clients to you."}
        </EmptyState>
      ) : null}
      {list && (clients.length > 0 || search) ? (
        <ListTable
          label="Clients"
          minWidth={isAdmin ? 1100 : 940}
          rows={shown}
          rowKey={(c) => c.id}
          columns={columns}
          defaultSort="name"
          onOpen={(c) => router.push(hrefOf(c))}
          search={{ value: query, onChange: setQuery, placeholder: "Search by name or email", label: "Search clients" }}
          filters={{ options: FILTERS.map((f) => ({ ...f, count: counts[f.id] })), value: filter, onChange: setFilter, label: "Filter clients" }}
          noun="client"
          total={clients.length}
          empty={{
            title: clients.length === 0 ? "No clients match" : "No clients in this view",
            text: clients.length === 0 ? "Try another name or email." : null,
            action: <Button variant="secondary" size="sm" onClick={() => { setQuery(""); setFilter("all"); }}>Show all clients</Button>,
          }}
        />
      ) : null}
    </>
  );
}
