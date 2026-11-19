"use client";

import { DIET_LABEL, fmtKg, GOAL_LABEL, goalRemaining, SEX_LABEL } from "@/lib/body";
import { timeAgo } from "@/lib/dates";
import { Avatar, Badge, cx, Skeleton } from "@/components/ui";

// One word for how things are going, and its colour. Colour is used on small things only
// (a dot, a word, a bar), so one weak number does not turn the whole page red.
export const STATUS = {
  good: { label: "On track", word: "On track", text: "text-good", dot: "bg-good", bar: "bg-good" },
  warn: { label: "Slipping", word: "Low", text: "text-warn", dot: "bg-warn", bar: "bg-warn" },
  bad: { label: "Needs attention", word: "Very low", text: "text-accent", dot: "bg-accent", bar: "bg-accent" },
  none: { label: "Not enough data", word: "", text: "text-muted", dot: "bg-white/30", bar: "bg-white/30" },
};

/** The four last-7-days tiles: the number, how it compares, and a bar towards the target. */
export function KpiGrid({ kpis, ready }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.map((k) => {
        const waiting = !ready && k.value == null;
        const s = STATUS[waiting ? "none" : k.tone];
        const percent = k.progress == null ? null : Math.max(0, Math.min(100, Math.round(k.progress)));
        return (
          <li key={k.key} className="rounded-2xl border border-line bg-card-2/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-muted">{k.label}</p>
              {s.word ? (
                <span className={cx("flex shrink-0 items-center gap-1.5 text-[11px] font-semibold", s.text)}>
                  <span aria-hidden="true" className={cx("h-1.5 w-1.5 rounded-full", s.dot)} />
                  {s.word}
                </span>
              ) : null}
            </div>
            {waiting ? (
              <Skeleton className="mt-3 h-8 w-20" />
            ) : (
              <p className={cx("mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl", k.value == null ? "text-muted" : "text-white")}>{k.display}</p>
            )}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" role={percent == null ? undefined : "progressbar"} aria-label={k.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
              {percent != null ? <div className={cx("h-full rounded-full", s.bar)} style={{ width: `${percent}%` }} /> : null}
            </div>
            <p className="mt-2 truncate text-xs text-muted">{k.sub}</p>
          </li>
        );
      })}
    </ul>
  );
}

function Fact({ label, note, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-white tabular-nums">{children}</dd>
      {note ? <dd className="mt-0.5 truncate text-xs text-muted">{note}</dd> : null}
    </div>
  );
}

export function ClientHeaderSkeleton() {
  return (
    <div role="status" aria-label="Loading client" className="rounded-3xl border border-line bg-card p-5 sm:p-7">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-60 max-w-full" /></div>
      </div>
      <Skeleton className="mt-6 h-12 w-full" />
      <span className="sr-only">Loading client…</span>
    </div>
  );
}

/** Who this is: name, how they are doing in one line, and the few facts needed while planning. */
export default function ClientHeader({ detail, stats, ready }) {
  const client = detail.client ?? {};
  const p = detail.profile ?? {};
  const name = client.name || client.email || "Client";
  const dietitian = client.dietitianName || client.dietitian?.name || null;
  const status = STATUS[stats.status];
  const hasWeight = typeof p.weightKg === "number" && typeof p.targetWeightKg === "number";
  const height = typeof p.heightCm === "number" ? `${parseFloat(p.heightCm.toFixed(1))} cm` : "–";
  const about = [p.age != null ? `${p.age} yrs` : null, SEX_LABEL[p.sex], height !== "–" ? height : null].filter(Boolean).join(" · ");

  return (
    <header className="rounded-3xl border border-line bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={name} image={client.image} size={64} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">{name}</h1>
            {client.email ? <p className="truncate text-sm text-muted">{client.email}</p> : null}
          </div>
        </div>
        <div className="sm:text-right" role="status">
          <p className={cx("inline-flex items-center gap-2 rounded-full bg-white/5 px-3.5 py-1.5 text-sm font-semibold", status.text)}>
            <span aria-hidden="true" className={cx("h-2 w-2 rounded-full", status.dot)} />
            {ready ? status.label : "Checking…"}
          </p>
          {ready && stats.reasons.length ? <p className="mt-2 max-w-xs text-xs leading-5 text-muted">{stats.reasons.join(" · ")}</p> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {p.goal && GOAL_LABEL[p.goal] ? <Badge tone="brand">Goal: {GOAL_LABEL[p.goal]}</Badge> : null}
        {p.dietType && DIET_LABEL[p.dietType] ? <Badge tone="neutral">{DIET_LABEL[p.dietType]}</Badge> : null}
        {p.shareWithDietitian === false ? <Badge tone="warn">Profile sharing paused</Badge> : null}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 lg:grid-cols-4">
        <Fact label="Weight" note={hasWeight && p.goal ? `Target ${fmtKg(p.targetWeightKg)} · ${goalRemaining(p.goal, p.weightKg, p.targetWeightKg)}` : null}>{typeof p.weightKg === "number" ? fmtKg(p.weightKg) : "–"}</Fact>
        <Fact label="About">{about || "–"}</Fact>
        <Fact label="Dietitian">{dietitian || "–"}</Fact>
        <Fact label="Profile updated">{p.updatedAt ? timeAgo(p.updatedAt) : "–"}</Fact>
      </dl>
    </header>
  );
}
