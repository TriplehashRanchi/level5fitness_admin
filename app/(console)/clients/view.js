"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useNewChatMessages } from "@/lib/socket";
import { adherencePercent, fmtKg, GOAL_LABEL } from "@/lib/body";
import { Count, DataTable, EmptyRow, MeterCell, PersonCell, Pills, SearchBox, TBody, Td, Th, THead, Tr, TwoLine, useSort } from "@/components/table";
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
  const router = useRouter();

  // Search after a short pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, latest: last, error, reload } = useApi(`/dietitian/clients${search ? `?q=${encodeURIComponent(search)}` : ""}`);
  // Unread chat messages per client; brought up to date the moment a client writes.
  const unreadApi = useApi("/dietitian/chat/unread");
  useNewChatMessages(unreadApi.reload);
  const unread = useMemo(() => Object.fromEntries((unreadApi.data?.clients ?? unreadApi.latest?.clients ?? []).map((u) => [u.memberId, u.unread])), [unreadApi.data, unreadApi.latest]);
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
  const { sorted: visible, column } = useSort(shown, {
    name: (c) => c.name || c.email,
    status: (c) => ({ noplan: 0, behind: 1, good: 2 })[c._s.key],
    plan: (c) => c._s.percent,
    goal: (c) => GOAL_LABEL[c.goal],
    weight: (c) => c.weightKg,
    dietitian: (c) => c.dietitianName,
  }, "name");

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={isAdmin ? "Everyone assigned to a dietitian, and how their week is going." : "Clients the admin has assigned to you. Open a profile to add diet and exercise plans."}
      />

      {error ? <div className="mb-5"><Alert action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>{messageOf(error)}</Alert></div> : null}

      {list ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <DataTable
          label="Clients"
          minWidth={isAdmin ? 980 : 820}
          toolbar={
            <>
              <SearchBox value={query} onChange={setQuery} placeholder="Search by name or email" label="Search clients" />
              <Pills options={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))} value={filter} onChange={setFilter} label="Filter clients" />
            </>
          }
          footer={<Count n={visible.length} of={clients.length} noun="client" />}
        >
          <THead>
            <Th sort={column("name")}>Client</Th>
            <Th sort={column("status")}>Status</Th>
            <Th sort={column("plan")}>Plan, last 7 days</Th>
            <Th sort={column("goal")}>Goal</Th>
            <Th sort={column("weight")}>Weight</Th>
            {isAdmin ? <Th sort={column("dietitian")}>Dietitian</Th> : null}
            <Th label="Open" />
          </THead>
          <TBody>
            {visible.length === 0 ? (
              <EmptyRow
                colSpan={isAdmin ? 7 : 6}
                title={clients.length === 0 ? "No clients match" : "No clients in this view"}
                action={<Button variant="secondary" size="sm" onClick={() => { setQuery(""); setFilter("all"); }}>Show all clients</Button>}
              >
                {clients.length === 0 ? "Try another name or email." : null}
              </EmptyRow>
            ) : null}
            {visible.map((c) => {
              const href = `/clients/${encodeURIComponent(c.id)}`;
              return (
                <Tr key={c.id} onOpen={() => router.push(href)}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <PersonCell name={c.name} email={c.email} image={c.image} href={href} />
                      {unread[c.id] ? <Badge tone="good">{unread[c.id] > 99 ? "99+" : unread[c.id]} new {unread[c.id] === 1 ? "message" : "messages"}</Badge> : null}
                    </div>
                  </Td>
                  <Td><Badge tone={c._s.tone}>{c._s.label}</Badge></Td>
                  <Td><MeterCell percent={c._s.percent} note={c._s.percent == null ? null : `${c.done7}/${c.planned7}`} tone={c._s.bar} label="Plan completion" /></Td>
                  <Td nowrap>{GOAL_LABEL[c.goal] ?? <span className="text-muted">–</span>}</Td>
                  <Td nowrap><TwoLine main={fmtKg(c.weightKg)} note={`Target ${fmtKg(c.targetWeightKg)}`} /></Td>
                  {isAdmin ? <Td nowrap>{c.dietitianName || <span className="text-muted">–</span>}</Td> : null}
                  <Td align="right"><span className="text-muted" aria-hidden="true">→</span></Td>
                </Tr>
              );
            })}
          </TBody>
        </DataTable>
      ) : null}
    </>
  );
}
