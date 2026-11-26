"use client";

import { messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import AdminOnly from "@/components/admin-only";
import { STAGES, STAGE_ORDER } from "@/lib/cases";
import { Alert, Badge, Button, cx, PageHeader, PageSpinner } from "@/components/ui";

/** One pilot measure: the number, the target it is held to, and how many people it comes from. */
function Measure({ m }) {
  const none = m.value == null;
  const met = !none && m.target != null && m.value >= m.target;
  return (
    <li className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-white">{m.label}</p>
        {m.target != null ? <Badge tone={none ? "neutral" : met ? "good" : "warn"}>{none ? `Goal ${m.target}%` : met ? "On target" : `Goal ${m.target}%`}</Badge> : <Badge tone="neutral">No goal yet</Badge>}
      </div>
      <p className={cx("mt-3 text-4xl font-semibold tracking-tight tabular-nums", none ? "text-muted" : met ? "text-brand" : "text-white")}>{none ? "–" : `${m.value}%`}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={m.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={none ? undefined : m.value}>
        {!none ? <div className={cx("h-full rounded-full", met ? "bg-brand" : "bg-amber-300")} style={{ width: `${m.value}%` }} /> : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">{m.detail}</p>
      <p className="mt-1 text-xs text-muted">{m.of ? `From ${m.of} ${m.unit}` : `Nobody to measure yet (${m.unit})`}</p>
    </li>
  );
}

function Metrics() {
  const { data, error, reload } = useApi("/admin/metrics");
  const stages = data?.stages ?? {};
  const total = Object.values(stages).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader title="Metrics" subtitle="How the programme is doing against the pilot's goals. Engagement and results are kept apart, so nobody is rewarded for losing weight unsafely." />
      {error ? <div className="mb-5"><Alert action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>{messageOf(error)}</Alert></div> : null}
      {!data && !error ? <PageSpinner /> : null}
      {data ? (
        <div className="space-y-8">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.measures.map((m) => <Measure key={m.key} m={m} />)}
          </ul>

          <section aria-labelledby="stages-title" className="rounded-2xl border border-line bg-card p-5">
            <h2 id="stages-title" className="text-sm font-semibold text-white">Where members are in their journey</h2>
            {total === 0 ? (
              <p className="mt-3 text-sm text-muted">Appears after the system has looked at your clients (it checks every 30 minutes).</p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {STAGE_ORDER.map((k) => (
                  <li key={k} className="flex items-center justify-between rounded-xl bg-card-2/60 px-4 py-3">
                    <Badge tone={STAGES[k].tone}>{STAGES[k].label}</Badge>
                    <span className="text-xl font-semibold tabular-nums text-white">{stages[k] ?? 0}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted">Cancellations in the last 90 days: <span className="font-semibold text-zinc-200">{data.cancellations90}</span> · Open cases: {data.cases.open} · Overdue: {data.cases.overdue} · Escalated: {data.cases.escalated}</p>
          </section>
          <p className="text-xs leading-5 text-muted">Money measures (paid conversion, revenue, cost per member) will appear when payments are added. Targets are the proposals from the product blueprint and can be changed once the pilot has a baseline.</p>
        </div>
      ) : null}
    </>
  );
}

export default function MetricsPage() {
  return (
    <AdminOnly>
      <Metrics />
    </AdminOnly>
  );
}
