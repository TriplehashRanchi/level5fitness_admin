"use client";

import { dayNumber, weekdayShort } from "@/lib/dates";
import { cx, Empty } from "@/components/ui";
import { KpiGrid } from "@/components/client-header";

const nf = new Intl.NumberFormat("en-GB");
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const TONE = {
  good: "bg-good/15 text-good",
  warn: "bg-warn/15 text-warn",
  bad: "bg-accent/15 text-accent",
  none: "bg-card-2 text-muted",
};

/** green = met, amber = partial, red = nothing; no target or a future day stays grey. */
function rate(value, goal) {
  if (goal == null) return "none";
  if (goal > 0 && value >= goal) return "good";
  return value > 0 ? "warn" : "bad";
}

function Cell({ tone, label, children }) {
  return (
    <td className="px-2 py-2 text-center">
      <span className={cx("inline-block min-w-16 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums", TONE[tone])}>
        {children}
        <span className="sr-only"> {label}: {tone === "good" ? "met" : tone === "warn" ? "partly" : tone === "bad" ? "missed" : "no target"}</span>
      </span>
    </td>
  );
}

/** The four 7-day tiles, then the same week day by day. */
export default function ClientOverview({ stats, days, targets, today, ready }) {
  const total = days.reduce((n, d) => n + num(d.workouts), 0);
  const t = targets || {};
  const anyData = days.some((d) => !d.missing);

  return (
    <div className="space-y-6">
      <KpiGrid kpis={stats.kpis} ready={ready} />
      {ready && !anyData ? (
        <Empty title="No daily data yet">Once the client logs steps, water, meals or workouts in the app, the last 7 days appear here.</Empty>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[620px] text-sm">
            <caption className="sr-only">Compliance for the last 7 days</caption>
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-2 py-2 text-left font-semibold">Day</th>
                <th scope="col" className="px-2 py-2 font-semibold">Steps</th>
                <th scope="col" className="px-2 py-2 font-semibold">Water</th>
                <th scope="col" className="px-2 py-2 font-semibold">Meals</th>
                <th scope="col" className="px-2 py-2 font-semibold">Diet plan</th>
                <th scope="col" className="px-2 py-2 font-semibold">Workouts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {days.map((d) => {
                if (!ready || d.missing) {
                  return (
                    <tr key={d.day}>
                      <th scope="row" className={cx("px-2 py-2 text-left font-semibold", d.day === today ? "text-brand" : "text-white")}>{weekdayShort(d.day)} {dayNumber(d.day)}</th>
                      {[0, 1, 2, 3, 4].map((i) => <td key={i} className="px-2 py-2 text-center text-xs text-muted">{ready ? "–" : <span className="skeleton inline-block h-6 w-16 rounded-lg align-middle" />}</td>)}
                    </tr>
                  );
                }
                return (
                  <tr key={d.day}>
                    <th scope="row" className={cx("px-2 py-2 text-left font-semibold", d.day === today ? "text-brand" : "text-white")}>{weekdayShort(d.day)} {dayNumber(d.day)}</th>
                    <Cell label="Steps" tone={rate(num(d.steps), t.steps)}>{nf.format(num(d.steps))}</Cell>
                    <Cell label="Water" tone={rate(num(d.waterMl), t.waterMl)}>{nf.format(num(d.waterMl))} ml</Cell>
                    <Cell label="Meals" tone={num(d.meals) > 0 ? "good" : "bad"}>{num(d.meals)}</Cell>
                    <Cell label="Diet plan" tone={num(d.dietPlanned) === 0 ? "none" : rate(num(d.dietDone), num(d.dietPlanned))}>{num(d.dietPlanned) === 0 ? "–" : `${num(d.dietDone)}/${num(d.dietPlanned)}`}</Cell>
                    <Cell label="Workouts" tone={num(d.workouts) > 0 ? "good" : "none"}>{num(d.workouts)}</Cell>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line">
                <td className="px-2 py-2 text-xs font-semibold text-muted" colSpan={5}>Workouts in 7 days{t.weeklyWorkouts != null ? ` (target ${t.weeklyWorkouts} per week)` : " (no target)"}</td>
                <Cell label="Workouts" tone={t.weeklyWorkouts == null ? "none" : rate(total, t.weeklyWorkouts)}>{ready ? total : "–"}</Cell>
              </tr>
            </tfoot>
          </table>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-good" />Met target</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-warn" />Partly</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-accent" />None or missed</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-white/20" />No target or nothing planned</span>
          </p>
        </div>
      )}
    </div>
  );
}
