"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { adherencePercent, fmtKg, GOAL_LABEL } from "@/lib/body";
import { timeAgo } from "@/lib/dates";
import AdminOnly from "@/components/admin-only";
import { Chevron, ListTable, MeterCell, PersonCell, TwoLine } from "@/components/table";
import { Alert, Badge, Button, cx, PageHeader, PageSpinner } from "@/components/ui";

const FILTERS = [
  { id: "unassigned", label: "Unassigned" },
  { id: "assigned", label: "Assigned" },
  { id: "all", label: "All" },
];

/** The dietitian picker as a small pill: dashed and amber while nobody is assigned. */
function AssignSelect({ label, value, onChange, disabled, children }) {
  return (
    <span className="relative inline-block">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          "h-9 w-48 appearance-none truncate rounded-full border bg-transparent pl-3.5 pr-8 text-xs font-semibold transition-colors disabled:opacity-50",
          value ? "border-line text-white hover:border-white/25" : "border-dashed border-warn/50 text-warn hover:border-warn"
        )}
      >
        {children}
      </select>
      <svg className={cx("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2", value ? "text-muted" : "text-warn")} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </span>
  );
}

function Members({ initialQuery }) {
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery);
  // Coming from the top bar's search: look in everybody, not only the unassigned.
  const [filter, setFilter] = useState(initialQuery ? "all" : "unassigned");
  const [page, setPage] = useState(1);
  const [savingId, setSavingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [targetId, setTargetId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const params = new URLSearchParams({ filter, page: String(page) });
  if (search) params.set("q", search);
  const members = useApi(`/admin/members?${params}`);
  const dietitians = useApi("/admin/dietitians");
  const available = (dietitians.data?.dietitians ?? []).filter((d) => !d.disabled);

  const assign = async (member, dietitianId) => {
    setSavingId(member.id);
    setNotice(null);
    try {
      await api(`/admin/members/${encodeURIComponent(member.id)}/assignment`, { method: "PUT", body: { dietitianId: dietitianId || null } });
      const who = available.find((d) => d.id === dietitianId);
      setNotice({ tone: "good", text: dietitianId ? `${member.name || member.email} is now assigned to ${who?.name || who?.email}.` : `${member.name || member.email} has no dietitian now.` });
    } catch (e) {
      setNotice({ tone: "bad", text: messageOf(e) });
    } finally {
      setSavingId(null);
      members.reload();
      dietitians.reload();
    }
  };

  // While a new search or page loads, the rows already on screen stay there.
  const data = members.data ?? members.latest;
  const pageIds = data ? data.members.map((m) => m.id) : [];
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (allOnPage) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  const bulkAssign = async () => {
    if (!targetId || selected.size === 0) return;
    setBulkBusy(true);
    setToast(null);
    try {
      const res = await api("/admin/assignments/bulk", { method: "POST", body: { dietitianId: targetId, memberIds: [...selected] } });
      const who = available.find((d) => d.id === targetId);
      setToast({ tone: "good", text: `Assigned ${res.assigned} to ${who?.name || who?.email || "the dietitian"}${res.skipped ? `, skipped ${res.skipped}` : ""}.` });
      setSelected(new Set());
      setTargetId("");
    } catch (e) {
      setToast({ tone: "bad", text: messageOf(e) });
    } finally {
      setBulkBusy(false);
      members.reload();
      dietitians.reload();
    }
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  // The client page opens only for a member who shares their profile and has a dietitian.
  const hrefOf = (m) => (m.sharing && m.dietitianId && m.acceptedAt ? `/clients/${encodeURIComponent(m.id)}` : null);
  const columns = [
    {
      key: "select", className: "w-10",
      header: <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={toggleAll} disabled={pageIds.length === 0} className="h-4 w-4 accent-brand" />,
      cell: (m) => <input type="checkbox" aria-label={`Select ${m.name || m.email}`} checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} className="h-4 w-4 accent-brand" />,
    },
    { key: "member", header: "Member", cell: (m) => <PersonCell name={m.name} email={m.email} image={m.image} href={hrefOf(m)} /> },
    {
      key: "profile", header: "Profile", nowrap: true,
      cell: (m) => (!m.setupDone ? <Badge tone="warn">Not set up</Badge> : m.sharing ? <TwoLine main={GOAL_LABEL[m.goal]} note={`${fmtKg(m.weightKg)} → ${fmtKg(m.targetWeightKg)}`} /> : <Badge tone="neutral">Not sharing</Badge>),
    },
    { key: "week", header: "Last 7 days", nowrap: true, cell: (m) => <TwoLine main={`${m.workouts7} workout${m.workouts7 === 1 ? "" : "s"}`} note={`Seen ${timeAgo(m.lastSeenAt)}`} /> },
    {
      key: "plan", header: "Diet plan",
      cell: (m) => {
        const percent = adherencePercent(m.done7, m.planned7);
        return percent == null ? <span className="text-xs text-muted">No plan</span> : <MeterCell percent={percent} note={`${m.done7}/${m.planned7}`} tone={percent >= 70 ? "bg-good" : "bg-accent"} label="Diet plan followed" />;
      },
    },
    {
      key: "dietitian", header: "Dietitian",
      cell: (m) => (
        <AssignSelect label={`Dietitian for ${m.name || m.email}`} value={m.dietitianId ?? ""} disabled={savingId === m.id || !dietitians.data} onChange={(id) => assign(m, id)}>
          <option value="">{m.dietitianId ? "Remove dietitian" : "Assign dietitian"}</option>
          {available.map((d) => (
            <option key={d.id} value={d.id}>{d.name || d.email} ({d.clients})</option>
          ))}
          {/* keep showing a disabled dietitian who is still assigned */}
          {m.dietitianId && !available.some((d) => d.id === m.dietitianId) ? (
            <option value={m.dietitianId}>{m.dietitianName || m.dietitianEmail} (disabled)</option>
          ) : null}
        </AssignSelect>
      ),
    },
    {
      key: "open", header: "Open", hidden: true, align: "right",
      cell: (m) => (hrefOf(m) ? (
        <Link href={hrefOf(m)} aria-label={`Open ${m.name || m.email}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-brand/10 hover:text-brand"><Chevron /></Link>
      ) : null),
    },
  ];

  return (
    <>
      <PageHeader title="Members" subtitle="Everyone using the app. Give each member a dietitian; it takes effect at once." />

      {notice ? <div className="mb-4"><Alert tone={notice.tone === "good" ? "good" : "bad"}>{notice.text}</Alert></div> : null}
      {members.error ? <div className="mb-4"><Alert action={<Button variant="secondary" size="sm" onClick={members.reload}>Retry</Button>}>{messageOf(members.error)}</Alert></div> : null}
      {!data && !members.error ? <PageSpinner /> : null}

      {data ? (
        <ListTable
          label="Members"
          minWidth={980}
          rows={data.members}
          rowKey={(m) => m.id}
          columns={columns}
          selected={(m) => selected.has(m.id)}
          busy={members.refreshing}
          search={{ value: query, onChange: setQuery, placeholder: "Search by name or email", label: "Search members" }}
          filters={{ options: FILTERS, value: filter, onChange: (id) => { setFilter(id); setPage(1); } }}
          noun="member"
          count={data.total}
          pagination={{ page, pages, onPage: setPage }}
          empty={{
            title: "No members found",
            text: search ? `Nobody matches “${search}” in this view.` : filter === "unassigned" ? "Everyone has a dietitian." : "Try another filter.",
            action: search || filter !== "all" ? <Button variant="secondary" size="sm" onClick={() => { setQuery(""); setFilter("all"); setPage(1); }}>Show all members</Button> : null,
          }}
        />
      ) : null}

      {selected.size > 0 ? (
        <div className="sticky bottom-5 z-20 mx-auto mt-5 flex w-fit max-w-full flex-wrap items-center gap-3 rounded-2xl border border-brand/30 bg-card-2 px-4 py-3 shadow-2xl shadow-black/60">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold tabular-nums text-ink">{selected.size}</span>
            selected
          </span>
          <AssignSelect label="Dietitian to assign to" value={targetId} onChange={setTargetId} disabled={bulkBusy}>
            <option value="">Choose a dietitian</option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>{d.name || d.email} ({d.clients} client{d.clients === 1 ? "" : "s"})</option>
            ))}
          </AssignSelect>
          <Button size="sm" onClick={bulkAssign} loading={bulkBusy} disabled={!targetId || selected.size > 100}>Assign</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={bulkBusy}>Clear</Button>
          {selected.size > 100 ? <span className="text-xs text-amber-300">Up to 100 at a time.</span> : null}
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm" role="status">
          <Alert tone={toast.tone}>{toast.text}</Alert>
        </div>
      ) : null}
    </>
  );
}

export default function MembersPage() {
  // /members?q=… is where the top bar's search sends a member who has no client page yet.
  const q = (useSearchParams().get("q") ?? "").trim().slice(0, 60);
  return (
    <AdminOnly>
      <Members key={q} initialQuery={q} />
    </AdminOnly>
  );
}
