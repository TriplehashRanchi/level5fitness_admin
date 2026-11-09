import { fmtKg } from "@/lib/body";

/** A small line chart of weigh-ins, oldest on the left. `history` is newest first. */
export default function WeightChart({ history }) {
  const points = history.slice(0, 20).reverse();
  if (points.length < 2) {
    return <p className="text-sm text-muted">Needs at least two weigh-ins to show a trend.</p>;
  }
  const W = 400, H = 150, padX = 14, padTop = 18, padBottom = 26;
  const values = points.map((p) => p.weightKg);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(high - low, 1);
  const x = (i) => padX + (i * (W - padX * 2)) / (points.length - 1);
  const y = (v) => padTop + (1 - (v - low) / span) * (H - padTop - padBottom);
  const line = points.map((p, i) => `${x(i)},${y(p.weightKg)}`).join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const change = Math.round((last.weightKg - first.weightKg) * 10) / 10;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Weight went from ${fmtKg(first.weightKg)} to ${fmtKg(last.weightKg)}`}>
        <polyline points={line} fill="none" stroke="#c6f432" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.weightKg)} r={i === points.length - 1 ? 5 : 3} fill={i === points.length - 1 ? "#c6f432" : "#17171b"} stroke="#c6f432" strokeWidth="2" />
        ))}
        <text x={x(0)} y={H - 6} fill="#8b8b94" fontSize="11" textAnchor="start">{first.day.slice(5).replace("-", "/")}</text>
        <text x={x(points.length - 1)} y={H - 6} fill="#8b8b94" fontSize="11" textAnchor="end">{last.day.slice(5).replace("-", "/")}</text>
        <text x={x(points.length - 1)} y={y(last.weightKg) - 10} fill="#c6f432" fontSize="12" fontWeight="700" textAnchor="end">{parseFloat(last.weightKg.toFixed(1))}</text>
      </svg>
      <figcaption className="mt-1 text-xs text-muted">
        {change === 0 ? "No change" : `${change > 0 ? "+" : ""}${change} kg`} since {first.day}
      </figcaption>
    </figure>
  );
}
