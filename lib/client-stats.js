import { addDays, weekOf } from "@/lib/dates";

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const hasTarget = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;

/** The two Monday-based week starts that together cover the last 7 days (the second can be null). */
export function recentWeekStarts(today) {
  const a = weekOf(addDays(today, -6))[0];
  const b = weekOf(today)[0];
  return [a, b === a ? null : b];
}

/** Merge the /week answers into the last 7 days, oldest first. Missing weeks leave gaps, never crashes. */
export function lastSevenDays(today, weeks) {
  const byDay = new Map();
  let targets = null;
  for (const w of weeks) {
    if (!w) continue;
    if (w.targets) targets = w.targets;
    for (const d of w.days ?? []) byDay.set(d.day, d);
  }
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((day) => byDay.get(day) ?? { day, missing: true });
  return { days, targets: targets ?? {} };
}

const logged = (d) => !d.missing && (num(d.steps) > 0 || num(d.waterMl) > 0 || num(d.meals) > 0 || num(d.workouts) > 0 || num(d.dietDone) > 0);

/** Colour for "how close to target": green at 80%+, amber at 50%+, red below; null without a target. */
export function toneFor(value, goal) {
  if (!hasTarget(goal) || value == null) return "none";
  const r = value / goal;
  return r >= 0.8 ? "good" : r >= 0.5 ? "warn" : "bad";
}

/**
 * Everything the header and overview show, derived from the existing API answers.
 * `ready` is false until the weekly data has arrived, so tiles show a placeholder instead of zeros.
 */
export function deriveStats({ today, days, targets, adherence, ready }) {
  const pct = adherence && adherence.planned ? Math.round((num(adherence.done) / adherence.planned) * 100) : null;
  const counted = days.filter((d) => !d.missing);
  const avg = (key) => (ready && counted.length ? Math.round(counted.reduce((n, d) => n + num(d[key]), 0) / 7) : null);
  const steps = avg("steps");
  const water = avg("waterMl");
  const workouts = ready && counted.length ? counted.reduce((n, d) => n + num(d.workouts), 0) : null;

  const adherenceTone = pct == null ? "none" : pct >= 75 ? "good" : pct >= 50 ? "warn" : "bad";
  const kpis = [
    { key: "adherence", label: "Diet plan followed", value: pct, display: pct == null ? "–" : `${pct}%`, sub: adherence?.planned ? `${num(adherence.done)} of ${adherence.planned} items done` : "No diet plan yet", tone: adherenceTone, progress: pct },
    { key: "steps", label: "Steps per day", value: steps, display: steps == null ? "–" : steps.toLocaleString("en-GB"), sub: hasTarget(targets.steps) ? `Target ${targets.steps.toLocaleString("en-GB")}` : "No target set", tone: toneFor(steps, targets.steps), progress: hasTarget(targets.steps) && steps != null ? (steps / targets.steps) * 100 : null },
    { key: "water", label: "Water per day", value: water, display: water == null ? "–" : `${water.toLocaleString("en-GB")} ml`, sub: hasTarget(targets.waterMl) ? `Target ${targets.waterMl.toLocaleString("en-GB")} ml` : "No target set", tone: toneFor(water, targets.waterMl), progress: hasTarget(targets.waterMl) && water != null ? (water / targets.waterMl) * 100 : null },
    { key: "workouts", label: "Workouts, last 7 days", value: workouts, display: workouts == null ? "–" : String(workouts), sub: hasTarget(targets.weeklyWorkouts) ? `Target ${targets.weeklyWorkouts} a week` : "No target set", tone: toneFor(workouts, targets.weeklyWorkouts), progress: hasTarget(targets.weeklyWorkouts) && workouts != null ? (workouts / targets.weeklyWorkouts) * 100 : null },
  ];

  // Needs-attention reasons, most urgent first.
  const reasons = [];
  let quiet = null;
  if (ready && counted.length) {
    const last = [...days].reverse().find(logged);
    quiet = last ? days.length - 1 - days.indexOf(last) : null;
    if (!last) reasons.push("No logs in the last 7 days");
    else if (quiet >= 2) reasons.push(`No logs for ${quiet} days`);
  }
  if (pct != null && pct < 50) reasons.push(`Only ${pct}% of the diet plan followed`);
  if (ready && hasTarget(targets.steps) && steps != null && steps / targets.steps < 0.5) reasons.push("Steps are under half of the target");

  const status = !ready && pct == null ? "none" : reasons.length ? "bad" : kpis.some((k) => k.tone === "warn" || k.tone === "bad") ? "warn" : kpis.some((k) => k.tone === "good") ? "good" : "none";
  return { kpis, reasons, status, quiet };
}
