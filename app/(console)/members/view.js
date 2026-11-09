"use client";

import { useEffect, useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { adherencePercent, fmtKg, GOAL_LABEL } from "@/lib/body";
import { timeAgo } from "@/lib/dates";
import AdminOnly from "@/components/admin-only";
import { Alert, Avatar, Badge, Button, cx, EmptyState, Input, PageHeader, PageSpinner, Select } from "@/components/ui";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unassigned", label: "No dietitian" },
  { id: "assigned", label: "Assigned" },
];

function Members() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [savingId, setSavingId] = useState(null);
  const [notice, setNotice] = useState(null);

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

  const data = members.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Members" subtitle="Everyone using the app. Assign each member to the dietitian who looks after them." />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-64 max-w-md flex-1">
          <Input type="search" placeholder="Search by name or email" aria-label="Search members" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-1 rounded-full bg-card p-1" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => { setFilter(f.id); setPage(1); }}
              className={cx("rounded-full px-4 py-1.5 text-sm font-semibold transition", filter === f.id ? "bg-brand text-ink" : "text-muted hover:text-white")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {notice ? <div className="mb-4"><Alert tone={notice.tone === "good" ? "good" : "bad"}>{notice.text}</Alert></div> : null}
      {members.error ? <Alert>{messageOf(members.error)}</Alert> : null}
      {!data && !members.error ? <PageSpinner /> : null}
      {data && data.members.length === 0 ? <EmptyState title="No members found">Try another search or filter.</EmptyState> : null}

      {data && data.members.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-3xl border border-line bg-card">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Goal</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">This week</th>
                  <th className="px-5 py-3 font-semibold">Dietitian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.members.map((m) => {
                  const percent = adherencePercent(m.done7, m.planned7);
                  return (
                    <tr key={m.id}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.name || m.email} image={m.image} />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-white">{m.name || m.email}</p>
                            <p className="truncate text-xs text-muted">{m.email} · seen {timeAgo(m.lastSeenAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-zinc-300">
                        {m.setupDone ? (
                          <>
                            <span className="block font-semibold">{GOAL_LABEL[m.goal]}</span>
                            <span className="text-xs text-muted">{fmtKg(m.weightKg)} → {fmtKg(m.targetWeightKg)}</span>
                          </>
                        ) : (
                          <span className="text-muted">–</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {!m.setupDone ? <Badge tone="warn">Setup not done</Badge> : m.sharing ? <Badge tone="good">Sharing</Badge> : <Badge tone="neutral">Not sharing</Badge>}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-300">
                        {m.workouts7} workout{m.workouts7 === 1 ? "" : "s"}
                        <br />
                        <span className="text-muted">{percent == null ? "no diet plan" : `diet ${percent}%`}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Select
                            aria-label={`Dietitian for ${m.name || m.email}`}
                            value={m.dietitianId ?? ""}
                            disabled={savingId === m.id || !dietitians.data}
                            onChange={(e) => assign(m, e.target.value)}
                            className="min-w-44"
                          >
                            <option value="">No dietitian</option>
                            {available.map((d) => (
                              <option key={d.id} value={d.id}>{d.name || d.email}</option>
                            ))}
                            {/* keep showing a disabled dietitian who is still assigned */}
                            {m.dietitianId && !available.some((d) => d.id === m.dietitianId) ? (
                              <option value={m.dietitianId}>{m.dietitianName || m.dietitianEmail} (disabled)</option>
                            ) : null}
                          </Select>
                        </div>
                        {m.dietitianId === null && m.setupDone && m.sharing ? <p className="mt-1 text-[11px] text-amber-300">Waiting for a dietitian</p> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>{data.total} member{data.total === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span>Page {page} of {pages}</span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

export default function MembersPage() {
  return (
    <AdminOnly>
      <Members />
    </AdminOnly>
  );
}
