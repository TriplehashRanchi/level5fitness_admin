"use client";

import { useState } from "react";
import Link from "next/link";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import AdminOnly from "@/components/admin-only";
import { ListTable, PersonCell } from "@/components/table";
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, PageSpinner, Select, Switch, Textarea } from "@/components/ui";

const dayText = (d) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00`));
const VIEWS = [
  { id: "renewals", label: "Renewals" },
  { id: "all", label: "All memberships" },
  { id: "plans", label: "Plans" },
];
const money = (n) => (n == null ? "–" : `₹${n.toLocaleString("en-IN")}`);
const left = (n) => (n < 0 ? `Ended ${-n} day${n === -1 ? "" : "s"} ago` : n === 0 ? "Ends today" : `${n} day${n === 1 ? "" : "s"} left`);

/** Memberships ending soon, with only what a sales person may see (no health data), and whether an offer is appropriate. */
function Renewals() {
  const [within, setWithin] = useState("30");
  const { data, error, reload } = useApi(`/admin/renewals?within=${within}`);
  const columns = [
    { key: "member", header: "Member", sort: (r) => r.name, cell: (r) => <PersonCell name={r.name} email={r.email} href={`/clients/${encodeURIComponent(r.memberId)}`} /> },
    { key: "plan", header: "Plan", sort: (r) => r.planName, cell: (r) => r.planName },
    { key: "ends", header: "Ends", nowrap: true, sort: (r) => r.endsOn, cell: (r) => <div><p>{dayText(r.endsOn)}</p><p className="text-xs text-muted">{left(r.daysLeft)}</p></div> },
    { key: "state", header: "Status", nowrap: true, cell: (r) => (r.renewed ? <Badge tone="good">Renewed</Badge> : r.cancelRequestedAt ? <Badge tone="bad">Asked to cancel</Badge> : <Badge tone="neutral">Not renewed</Badge>) },
    { key: "progress", header: "Plan, last 4 weeks", nowrap: true, sort: (r) => r.planPercent ?? -1, cell: (r) => (r.planPercent == null ? <span className="text-muted">Not enough data</span> : `${r.planPercent}% of meals`) },
    { key: "dietitian", header: "Dietitian", nowrap: true, sort: (r) => r.dietitianName, cell: (r) => r.dietitianName || <span className="text-muted">–</span> },
    {
      key: "offer", header: "An offer is", sort: (r) => (r.offer.eligible ? 0 : 1),
      cell: (r) => (
        <div>
          <Badge tone={r.offer.eligible ? "good" : "neutral"}>{r.offer.eligible ? "Fine to make" : "Not now"}</Badge>
          <p className="mt-1 max-w-56 text-xs text-muted">{r.offer.why}</p>
        </div>
      ),
    },
  ];
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm leading-6 text-muted">
        Offers only go to people who have agreed to hear about them, are getting value from the plan, and are not unwell. Health details are never shown here. A talk about renewing starts with the member&apos;s progress, from their dietitian.
      </p>
      {error ? <div className="mb-4"><Alert action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>{messageOf(error)}</Alert></div> : null}
      {!data && !error ? <PageSpinner /> : null}
      {data ? (
        <ListTable
          label="Renewals"
          minWidth={1000}
          rows={data.renewals}
          rowKey={(r) => r.membershipId}
          columns={columns}
          defaultSort="ends"
          noun="membership"
          toolbar={
            <Select value={within} onChange={(e) => setWithin(e.target.value)} aria-label="Ending within" className="w-auto">
              <option value="14">Ending in 14 days</option>
              <option value="30">Ending in 30 days</option>
              <option value="60">Ending in 60 days</option>
              <option value="90">Ending in 90 days</option>
            </Select>
          }
          empty={{ title: "No memberships ending soon", text: "Record a member's plan on their client page to see it here." }}
        />
      ) : null}
    </>
  );
}

function AllMemberships() {
  const { data, error, reload } = useApi("/admin/memberships");
  const columns = [
    { key: "member", header: "Member", sort: (r) => r.name, cell: (r) => <PersonCell name={r.name} email={r.email} href={`/clients/${encodeURIComponent(r.memberId)}`} /> },
    { key: "plan", header: "Plan", sort: (r) => r.planName, cell: (r) => r.planName },
    { key: "period", header: "Period", nowrap: true, sort: (r) => r.endsOn, cell: (r) => `${dayText(r.startsOn)} to ${dayText(r.endsOn)}` },
    {
      key: "status", header: "Status", nowrap: true,
      cell: (r) => (r.status === "cancelled" ? <Badge tone="bad">Cancelled</Badge> : r.daysLeft < 0 ? <Badge tone="neutral">Ended</Badge> : r.upcoming ? <Badge tone="neutral">Starts soon</Badge> : <Badge tone="good">{left(r.daysLeft)}</Badge>),
    },
    { key: "paused", header: "Added for pauses", nowrap: true, sort: (r) => r.pausedDays, cell: (r) => (r.pausedDays ? `${r.pausedDays} days` : "–") },
    { key: "cancel", header: "Cancel request", cell: (r) => (r.cancelRequestedAt && r.status === "active" ? <Badge tone="warn">Asked to cancel</Badge> : <span className="text-muted">–</span>) },
  ];
  return (
    <>
      {error ? <div className="mb-4"><Alert action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>{messageOf(error)}</Alert></div> : null}
      {!data && !error ? <PageSpinner /> : null}
      {data ? <ListTable label="Memberships" minWidth={900} rows={data.memberships} rowKey={(r) => r.id} columns={columns} defaultSort="period" noun="member" empty={{ title: "No memberships recorded yet", text: "Open a client and record their plan." }} /> : null}
    </>
  );
}

const BLANK = { name: "", description: "", durationDays: "90", priceInr: "", inclusions: "", refundTerms: "", pauseTerms: "", active: true };

/** The gym's own plans. Prices are for showing only: nothing here charges anyone. */
function Plans() {
  const { data, error, reload } = useApi("/admin/plans");
  const [editing, setEditing] = useState(null); // { id?, ...fields }
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const open = (plan) => {
    setProblem(null);
    setEditing(plan ? { ...BLANK, ...plan, durationDays: String(plan.durationDays), priceInr: plan.priceInr == null ? "" : String(plan.priceInr), description: plan.description ?? "", inclusions: plan.inclusions ?? "", refundTerms: plan.refundTerms ?? "", pauseTerms: plan.pauseTerms ?? "" } : { ...BLANK });
  };
  const save = async () => {
    setBusy(true);
    setProblem(null);
    const body = { name: editing.name, description: editing.description, durationDays: Number(editing.durationDays), priceInr: editing.priceInr === "" ? null : Number(editing.priceInr), inclusions: editing.inclusions, refundTerms: editing.refundTerms, pauseTerms: editing.pauseTerms, active: editing.active };
    try {
      await api(editing.id ? `/admin/plans/${editing.id}` : "/admin/plans", { method: editing.id ? "PUT" : "POST", body });
      setEditing(null);
      reload();
    } catch (e) {
      setProblem(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const set = (patch) => setEditing((p) => ({ ...p, ...patch }));

  const columns = [
    { key: "name", header: "Plan", sort: (p) => p.name, cell: (p) => <div><p className="font-medium text-white">{p.name}</p>{p.description ? <p className="max-w-xs truncate text-xs text-muted">{p.description}</p> : null}</div> },
    { key: "days", header: "Length", nowrap: true, sort: (p) => p.durationDays, cell: (p) => `${p.durationDays} days` },
    { key: "price", header: "Price (shown only)", nowrap: true, sort: (p) => p.priceInr ?? -1, cell: (p) => money(p.priceInr) },
    { key: "active", header: "Status", nowrap: true, cell: (p) => (p.active ? <Badge tone="good">On sale</Badge> : <Badge tone="neutral">Retired</Badge>) },
  ];
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm leading-6 text-muted">Write each plan with what it includes and its refund and pause terms. Members see these in their app. Prices are only for showing: the app does not take payments yet. Retiring a plan keeps it on the memberships that already use it.</p>
      {error ? <div className="mb-4"><Alert>{messageOf(error)}</Alert></div> : null}
      {!data && !error ? <PageSpinner /> : null}
      {data ? (
        <ListTable
          label="Plans"
          minWidth={620}
          rows={data.plans}
          rowKey={(p) => p.id}
          columns={columns}
          defaultSort="name"
          onOpen={open}
          noun="plan"
          action={<Button onClick={() => open(null)}>+ New plan</Button>}
          empty={{ title: "No plans yet", text: "Add the plans your gym sells, then record them on members.", action: <Button onClick={() => open(null)}>+ New plan</Button> }}
        />
      ) : null}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit plan" : "New plan"}
        wide
        footer={<><Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button><Button loading={busy} onClick={save}>Save plan</Button></>}
      >
        {editing ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3"><Field label="Name"><Input value={editing.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} /></Field></div>
              <Field label="Length in days"><Input inputMode="numeric" value={editing.durationDays} onChange={(e) => set({ durationDays: e.target.value })} /></Field>
              <Field label="Price in rupees" hint="Shown only, optional"><Input inputMode="numeric" value={editing.priceInr} onChange={(e) => set({ priceInr: e.target.value })} /></Field>
            </div>
            <Field label="One line about it"><Input value={editing.description} maxLength={300} onChange={(e) => set({ description: e.target.value })} /></Field>
            <Field label="What it includes" hint="Plain words the member will read"><Textarea value={editing.inclusions} maxLength={600} onChange={(e) => set({ inclusions: e.target.value })} /></Field>
            <Field label="Refund terms"><Textarea value={editing.refundTerms} maxLength={400} onChange={(e) => set({ refundTerms: e.target.value })} /></Field>
            <Field label="If the member is unwell or injured" hint="Health pauses add their days to the end, automatically"><Textarea value={editing.pauseTerms} maxLength={400} onChange={(e) => set({ pauseTerms: e.target.value })} /></Field>
            <Switch checked={editing.active} onChange={(v) => set({ active: v })} label="On sale (new memberships can use it)" />
            {problem ? <Alert>{problem}</Alert> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function Memberships() {
  const [view, setView] = useState("renewals");
  return (
    <>
      <PageHeader title="Memberships" subtitle="Who is on which plan, until when, and who is coming up for renewal." />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Memberships views">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${view === v.id ? "border-brand bg-brand/15 text-brand" : "border-line text-zinc-300 hover:bg-white/5"}`}>{v.label}</button>
        ))}
      </div>
      {view === "renewals" ? <Renewals /> : view === "all" ? <AllMemberships /> : <Plans />}
      <p className="mt-6 text-xs text-muted">To record a plan for a member, open them in <Link href="/clients" className="text-brand hover:underline">Clients</Link> and use their Membership section.</p>
    </>
  );
}

export default function MembershipsPage() {
  return (
    <AdminOnly>
      <Memberships />
    </AdminOnly>
  );
}
