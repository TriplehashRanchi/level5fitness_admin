import { fmtKg } from "@/lib/body";
import { Empty } from "@/components/ui";

const ok = (v) => typeof v === "number" && Number.isFinite(v);

function Fig({ label, value, tone }) {
  return (
    <div className="rounded-2xl border border-line bg-card-2 px-4 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`mt-1 text-xl font-semibold tabular-nums ${tone === "brand" ? "text-brand" : "text-white"}`}>{ok(value) ? fmtKg(value) : "–"}</dd>
    </div>
  );
}

/** Weigh-ins as a line (oldest left) with a dashed target line, and start / current / target figures. `history` is newest first. */
export default function WeightChart({ history, start, current, target }) {
  const points = (Array.isArray(history) ? history : []).filter((p) => p && ok(p.weightKg) && typeof p.day === "string").slice(0, 20).reverse();
  const W = 600, H = 200, padX = 16, padTop = 20, padBottom = 28;

  let chart = <Empty title="Needs at least two weigh-ins to show a trend">When the client logs their weight in the app, the trend appears here.</Empty>;
  if (points.length >= 2) {
    const values = points.map((p) => p.weightKg);
    if (ok(target)) values.push(target);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const span = Math.max(high - low, 1);
    const x = (i) => padX + (i * (W - padX * 2)) / (points.length - 1);
    const y = (v) => padTop + (1 - (v - low) / span) * (H - padTop - padBottom);
    const line = points.map((p, i) => `${x(i)},${y(p.weightKg)}`).join(" ");
    const last = points[points.length - 1];
    const first = points[0];
    const change = Math.round((last.weightKg - first.weightKg) * 10) / 10;
    chart = (
      <figure>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Weight went from ${fmtKg(first.weightKg)} to ${fmtKg(last.weightKg)}`}>
          {ok(target) ? (
            <g>
              <line x1={padX} x2={W - padX} y1={y(target)} y2={y(target)} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="5 5" />
              <text x={W - padX} y={y(target) - 6} fill="#38bdf8" fontSize="12" textAnchor="end">Target {parseFloat(target.toFixed(1))}</text>
            </g>
          ) : null}
          <polyline points={line} fill="none" stroke="#3ddc68" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle key={p.id ?? p.day} cx={x(i)} cy={y(p.weightKg)} r={i === points.length - 1 ? 5 : 3} fill={i === points.length - 1 ? "#3ddc68" : "#151b17"} stroke="#3ddc68" strokeWidth="2" />
          ))}
          <text x={x(0)} y={H - 8} fill="#a1aaa0" fontSize="12" textAnchor="start">{first.day.slice(5).replace("-", "/")}</text>
          <text x={x(points.length - 1)} y={H - 8} fill="#a1aaa0" fontSize="12" textAnchor="end">{last.day.slice(5).replace("-", "/")}</text>
          <text x={x(points.length - 1)} y={y(last.weightKg) + (y(last.weightKg) < padTop + 14 ? 20 : -10)} fill="#3ddc68" fontSize="13" fontWeight="700" textAnchor="end">{parseFloat(last.weightKg.toFixed(1))}</text>
        </svg>
        <figcaption className="mt-1 text-xs text-muted tabular-nums">
          {change === 0 ? "No change" : `${change > 0 ? "+" : ""}${change} kg`} since {first.day}
        </figcaption>
      </figure>
    );
  }

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-3 gap-3">
        <Fig label="Start" value={start} />
        <Fig label="Current" value={current} tone="brand" />
        <Fig label="Target" value={target} />
      </dl>
      {chart}
    </div>
  );
}
