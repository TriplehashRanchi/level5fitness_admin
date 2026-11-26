"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useChatInbox } from "@/lib/chat-inbox";
import { timeAgo } from "@/lib/dates";
import { adherencePercent, fmtKg, GOAL_LABEL } from "@/lib/body";
import { Alert, Avatar, Button, cx, PageHeader, Skeleton } from "@/components/ui";

// The dashboard: black page, near-black panels, green for what is alive. Every number on it comes from
// the gym's own records; where there is no data for something, the panel says so instead of inventing it.

const BRAND = "#3ddc68";
const today = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const ICONS = {
  members: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m14-14a4 4 0 0 1 0 8m6 6v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  joined: "M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m8.5-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6m3-3h-6",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
  calendar: "M8 2v4m8-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10.3 20a2 2 0 0 0 3.4 0",
  plan: "M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3M9 2h6v4H9zM7 11l2 2 4-4M7 17h10",
  workout: "M6 7v10M18 7v10M3 10v4m18-4v4M6 12h12",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  alert: "M12 7v6m0 3.5v.5",
};

function Icon({ name, size = 18, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={ICONS[name] ?? ICONS.arrow} />
    </svg>
  );
}

/** The tinted square an icon sits in. */
function Tile({ icon, tone = "brand", size = 40 }) {
  const tones = { brand: "bg-brand/12 text-brand", warn: "bg-warn/12 text-warn", bad: "bg-accent/12 text-accent", quiet: "bg-white/6 text-zinc-300" };
  return (
    <span className={cx("flex shrink-0 items-center justify-center rounded-xl", tones[tone])} style={{ width: size, height: size }}>
      <Icon name={icon} size={Math.round(size * 0.46)} />
    </span>
  );
}

function Panel({ className, children, ...rest }) {
  return <section className={cx("min-w-0 rounded-2xl border border-line bg-card p-5", className)} {...rest}>{children}</section>;
}

function PanelTitle({ icon, children, action, id }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold text-white">
        {icon ? <Icon name={icon} size={18} className="shrink-0 text-zinc-300" /> : null}
        <span className="truncate">{children}</span>
      </h2>
      {action}
    </div>
  );
}

const ViewAll = ({ href, children = "View all" }) => (
  <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand hover:underline">{children} <Icon name="arrow" size={13} /></Link>
);

/** A small line that shows which way a figure has been going. Drawn only when there is a real series that moved. */
function Spark({ values }) {
  if (!values || values.length < 2 || values.every((v) => v === values[0])) return null;
  const w = 96;
  const h = 40;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - min) / (max - min || 1)) * (h - 10)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BRAND} stopOpacity="0.35" />
          <stop offset="1" stopColor={BRAND} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="url(#sparkFill)" />
      <path d={line} fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "+12%" against the 7 days before, worked out from two real counts. */
function trendOf(now, before) {
  if (before == null) return null;
  if (!before) return now ? { text: `+${now}`, dir: "up" } : { text: "No change", dir: "flat" };
  const pct = Math.round(((now - before) / before) * 100);
  // The arrow already says down, so the number is shown without a minus.
  return { text: pct > 0 ? `+${pct}%` : `${Math.abs(pct)}%`, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

/** A whole number that counts up to its value when it appears (and from the old value when it changes). */
function CountUp({ value }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const ms = reduce ? 0 : 800;
    const begin = from.current;
    let frame;
    const tick = (now) => {
      const k = ms ? Math.min(1, (now - start) / ms) : 1;
      const v = Math.round(begin + (value - begin) * (1 - Math.pow(1 - k, 3)));
      from.current = v;
      setShown(v);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown}</>;
}

function Stat({ icon, label, value, trend, note, spark, tone }) {
  return (
    <Panel className="flex flex-col justify-between gap-4">
      <div className="flex items-center gap-3">
        <Tile icon={icon} tone={tone === "warn" ? "warn" : "brand"} />
        <p className="min-w-0 truncate text-sm font-medium text-zinc-200">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={cx("text-3xl font-semibold tracking-tight tabular-nums", tone === "warn" ? "text-warn" : "text-white")}>{typeof value === "number" ? <CountUp value={value} /> : value}</p>
          <p className="mt-1.5 truncate text-xs text-muted">
            {trend ? (
              <span className={cx("mr-1.5 font-semibold", trend.dir === "up" ? "text-brand" : trend.dir === "down" ? "text-accent" : "text-zinc-300")}>
                {trend.dir === "up" ? "↑ " : trend.dir === "down" ? "↓ " : ""}{trend.text}
              </span>
            ) : null}
            {note}
          </p>
        </div>
        <Spark values={spark} />
      </div>
    </Panel>
  );
}

/** A small ring with a figure in the middle. `ratio` 0 to 1; null draws an empty ring. */
function Ring({ ratio, label }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const part = Math.max(0, Math.min(1, ratio ?? 0));
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
      <svg width="44" height="44" viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="4" />
        {part > 0 ? <circle cx="22" cy="22" r={r} fill="none" stroke={BRAND} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${c * part} ${c}`} /> : null}
      </svg>
      <span className="text-[10px] font-bold tabular-nums text-white">{label}</span>
    </span>
  );
}

const ROW = "flex items-center gap-3 rounded-xl bg-white/[0.03] px-3.5 py-3";

function TodayRow({ icon, title, detail, ring }) {
  return (
    <li className={ROW}>
      <Tile icon={icon} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{title}</span>
        <span className="block truncate text-xs text-muted">{detail}</span>
      </span>
      {ring}
    </li>
  );
}

/** Members over the last 30 days: a green bar per day for how many there were, light grey at its foot for who joined that day. */
function GrowthChart({ days }) {
  const W = 640;
  const H = 300;
  const left = 38;
  const right = 18; // room for the last date, which is centred under the last bar
  const bottom = 30;
  const top = 10;
  const max = Math.max(1, ...days.map((d) => d.total));
  // Four even steps up to a round number a little above the tallest bar.
  const unit = max > 40 ? 10 : max > 8 ? 5 : 1;
  const step = Math.max(1, Math.ceil(max / 4 / unit) * unit);
  const ceil = step * 4;
  const plotH = H - bottom - top;
  const slot = (W - left - right) / days.length;
  const barW = Math.min(14, slot * 0.62);
  const y = (v) => top + plotH - (v / ceil) * plotH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Members went from ${days[0]?.total ?? 0} to ${days[days.length - 1]?.total ?? 0} in the last 30 days`}>
      <defs>
        <linearGradient id="growthBar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BRAND} />
          <stop offset="1" stopColor="#1c7a3a" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line x1={left} x2={W - right} y1={y(step * i)} y2={y(step * i)} stroke="rgba(255,255,255,0.06)" />
          <text x={left - 10} y={y(step * i) + 4.5} textAnchor="end" fontSize="13" fill="#8fa396">{step * i}</text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = left + slot * i + (slot - barW) / 2;
        const h = (d.total / ceil) * plotH;
        const joined = (d.joined / ceil) * plotH;
        return (
          <g key={d.day}>
            {h > 0 ? <rect className="rise" style={{ animationDelay: `${i * 16}ms` }} x={x} y={y(d.total)} width={barW} height={h} rx="2.5" fill="url(#growthBar)" /> : <rect x={x} y={y(0) - 2} width={barW} height="2" rx="1" fill="rgba(255,255,255,0.12)" />}
            {joined > 0 ? <rect className="rise" style={{ animationDelay: `${i * 16 + 300}ms` }} x={x} y={y(d.joined)} width={barW} height={joined} rx="2.5" fill="#cfd6d1" /> : null}
            {(days.length - 1 - i) % 5 === 0 ? <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="13" fill="#8fa396">{dayMonth.format(new Date(`${d.day}T00:00:00Z`))}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

// ── Dates as plain "YYYY-MM-DD" text, so a day never shifts because of a time zone ──
const addDay = (key, n) => new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10) + n)).toISOString().slice(0, 10);
const mondayFirst = (key) => (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;
const monthName = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

/**
 * The last 12 weeks as a grid like a contribution calendar: one column a week, one row a weekday, and the
 * greener a day, the more workouts members logged that day. A glance shows which days the gym comes alive.
 */
function ActivityHeat({ rows, todayKey }) {
  const counts = Object.fromEntries(rows.map((r) => [r.day, r.n]));
  const first = addDay(todayKey, -83);
  const start = addDay(first, -mondayFirst(first));
  const weeks = Math.ceil((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000 / 7 + 1 / 7);
  const max = Math.max(1, ...Object.values(counts));
  const total = rows.reduce((sum, r) => sum + r.n, 0);
  const CW = 40;
  const CH = 20;
  const GAP = 5;
  const left = 34;
  const top = 18;
  const W = left + weeks * (CW + GAP);
  const H = top + 7 * (CH + GAP);
  const fill = (n) => (n === 0 ? "rgba(255,255,255,0.06)" : `rgba(61,220,104,${[0, 0.28, 0.5, 0.75, 1][Math.min(4, Math.ceil((n / max) * 4))]})`);
  const cells = [];
  const labels = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const monday = addDay(start, w * 7);
    const month = +monday.slice(5, 7);
    if (month !== lastMonth && (w > 0 || +monday.slice(8, 10) <= 20)) labels.push({ w, text: monthName.format(new Date(`${monday}T00:00:00Z`)) });
    lastMonth = month;
    for (let d = 0; d < 7; d++) {
      const key = addDay(start, w * 7 + d);
      if (key > todayKey || key < first) continue;
      const n = counts[key] ?? 0;
      cells.push({ key, n, x: left + w * (CW + GAP), y: top + d * (CH + GAP), w });
    }
  }
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${total} workouts logged in the last 12 weeks`}>
        {["Mon", "Wed", "Fri"].map((l, i) => <text key={l} x={0} y={top + i * 2 * (CH + GAP) + CH - 5} fontSize="12" fill="#8fa396">{l}</text>)}
        {labels.map((l) => <text key={l.w} x={left + l.w * (CW + GAP)} y={11} fontSize="12" fill="#8fa396">{l.text}</text>)}
        {cells.map((c) => (
          <rect key={c.key} className="pop-in" style={{ animationDelay: `${c.w * 35}ms` }} x={c.x} y={c.y} width={CW} height={CH} rx="5" fill={fill(c.n)}>
            <title>{`${c.n} workout${c.n === 1 ? "" : "s"} · ${dayMonth.format(new Date(`${c.key}T00:00:00Z`))}`}</title>
          </rect>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>{total ? `${total} workout${total === 1 ? "" : "s"} logged in 12 weeks` : "No workouts logged yet"}</span>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          Less {[0, 1, 2, 3, 4].map((l) => <span key={l} className="h-3 w-5 rounded-[4px]" style={{ background: l === 0 ? "rgba(255,255,255,0.06)" : `rgba(61,220,104,${[0, 0.28, 0.5, 0.75, 1][l]})` }} />)} More
        </span>
      </div>
    </div>
  );
}

const GOAL_COLORS = { lose: "#3ddc68", maintain: "#1c8f3f", gain: "#e6efe9" };
const GOAL_NAMES = { lose: "Lose weight", maintain: "Stay at weight", gain: "Gain weight" };

/** What members want to do, as one ring in three shades: who is losing, keeping or gaining weight. */
function GoalDonut({ goals }) {
  const total = goals.reduce((sum, g) => sum + g.n, 0);
  const order = ["lose", "maintain", "gain"].map((k) => ({ key: k, n: goals.find((g) => g.goal === k)?.n ?? 0 }));
  let used = 0;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="relative h-36 w-36 shrink-0" role="img" aria-label={order.map((g) => `${GOAL_NAMES[g.key]}: ${g.n}`).join(", ")}>
        <svg viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" />
          {order.map((g) => {
            if (!g.n) return null;
            const part = (g.n / total) * 100;
            const at = used;
            used += part;
            return <circle key={g.key} className="draw" cx="50" cy="50" r="38" fill="none" stroke={GOAL_COLORS[g.key]} strokeWidth="12" strokeLinecap="butt" pathLength="100" strokeDasharray={`${Math.max(0, part - 1.2)} ${100 - Math.max(0, part - 1.2)}`} strokeDashoffset={-at} />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums text-white"><CountUp value={total} /></span>
          <span className="text-[11px] text-muted">members</span>
        </div>
      </div>
      <ul className="min-w-36 flex-1 space-y-3">
        {order.map((g) => (
          <li key={g.key} className="flex items-center gap-3 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GOAL_COLORS[g.key] }} aria-hidden="true" />
            <span className="flex-1 text-zinc-200">{GOAL_NAMES[g.key]}</span>
            <span className="font-semibold tabular-nums text-white">{g.n}</span>
            <span className="w-10 text-right text-xs tabular-nums text-muted">{total ? Math.round((g.n / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The week's three busiest members on a podium: first in the middle, tallest. */
function Podium({ members }) {
  const slots = [
    { rank: 2, m: members[1], h: 64, size: 46 },
    { rank: 1, m: members[0], h: 92, size: 56 },
    { rank: 3, m: members[2], h: 46, size: 46 },
  ];
  return (
    <div className="grid grid-cols-3 items-end gap-3 pt-1">
      {slots.map(({ rank, m, h, size }) => (
        <div key={rank} className="flex min-w-0 flex-col items-center text-center">
          {m ? (
            <>
              <span className={cx("rounded-full p-[3px]", rank === 1 ? "bg-brand" : "bg-white/20")}><Avatar name={m.name || m.email} image={m.image} size={size} /></span>
              <p className="mt-2 w-full truncate text-xs font-semibold text-white">{(m.name || m.email).split(" ")[0]}</p>
              <p className="text-[11px] text-muted">{m.workouts} workout{m.workouts === 1 ? "" : "s"}</p>
            </>
          ) : (
            <>
              <span className="flex items-center justify-center rounded-full border border-dashed border-white/15" style={{ width: size + 6, height: size + 6 }} />
              <p className="mt-2 text-xs text-muted">–</p>
              <p className="text-[11px] text-transparent">.</p>
            </>
          )}
          <div className={cx("rise mt-3 flex w-full items-start justify-center rounded-t-xl pt-2 text-lg font-bold", rank === 1 ? "bg-gradient-to-b from-brand to-[#1c7a3a] text-ink" : "bg-gradient-to-b from-white/20 to-white/5 text-white")} style={{ height: h, animationDelay: `${(rank - 1) * 120}ms` }}>
            {rank}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One bar per dietitian: how many clients they carry, so an overloaded one stands out. */
function DietitianLoad({ rows }) {
  const scale = Math.max(10, ...rows.map((r) => r.clients));
  return (
    <ul className="space-y-3.5">
      {rows.map((d, i) => (
        <li key={d.id} className={d.disabled ? "opacity-50" : undefined}>
          <div className="mb-1.5 flex items-center gap-2.5">
            <Avatar name={d.name || d.email} image={d.image} size={26} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{d.name || d.email}</span>
            <span className="text-xs tabular-nums text-zinc-200">{d.disabled ? "Disabled" : `${d.clients} client${d.clients === 1 ? "" : "s"}`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="grow-x h-full rounded-full bg-gradient-to-r from-[#1c7a3a] to-brand" style={{ width: `${Math.max(d.clients ? 4 : 0, (d.clients / scale) * 100)}%`, animationDelay: `${i * 90}ms` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Loading() {
  return (
    <div role="status" aria-label="Loading dashboard" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-32 w-full rounded-2xl" />)}</div>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]"><Skeleton className="h-72 w-full rounded-2xl" /><Skeleton className="h-72 w-full rounded-2xl" /></div>
      <span className="sr-only">Loading dashboard records…</span>
    </div>
  );
}

function Failure({ error, reload }) {
  return (
    <Panel className="max-w-xl">
      <h2 className="text-lg font-semibold text-white">We couldn’t load the overview</h2>
      <p className="mb-5 mt-2 text-sm text-muted">The figures are unavailable until we can reach your records.</p>
      <Alert action={<Button variant="secondary" size="sm" onClick={reload}>Try again</Button>}>{messageOf(error)}</Alert>
    </Panel>
  );
}

/** One thing to deal with: a coloured mark, two lines of text, an arrow. */
function TaskRow({ href, tone, icon, title, detail }) {
  return (
    <li>
      <Link href={href} className={cx(ROW, "group transition-colors hover:bg-white/[0.06]")}>
        <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink", tone === "bad" ? "bg-accent" : tone === "warn" ? "bg-warn" : "bg-brand")}>
          <Icon name={icon} size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{title}</span>
          <span className="block truncate text-xs text-muted">{detail}</span>
        </span>
        <Icon name="arrow" size={15} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
      </Link>
    </li>
  );
}

function QuickAction({ href, icon, label, primary }) {
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-xl border px-2 text-center text-xs font-semibold transition-colors",
        primary ? "border-brand/50 bg-brand/15 text-white hover:bg-brand/25" : "border-line bg-white/[0.03] text-zinc-200 hover:border-brand/40 hover:text-white"
      )}
    >
      <Icon name={icon} size={20} className={primary ? "text-brand" : "text-zinc-300"} />
      {label}
    </Link>
  );
}

/** The green block: the 90-day habit challenge and the group missions, the things that keep members coming back. */
function ChallengeCard() {
  return (
    <section className="relative flex min-h-[220px] min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-[#0f3d1f] via-[#0a2614] to-black p-6">
      <svg className="pointer-events-none absolute -right-10 -top-10 text-brand" width="240" height="240" viewBox="0 0 240 240" fill="none" stroke="currentColor" aria-hidden="true">
        {[40, 70, 100, 130].map((r) => <circle key={r} cx="150" cy="90" r={r} strokeWidth="14" opacity={0.16 - r / 1200} />)}
      </svg>
      <div className="relative">
        <h2 className="text-xl font-semibold leading-tight text-white">Member<br />engagement</h2>
        <p className="mt-2 max-w-[15rem] text-sm leading-6 text-zinc-300">The 90-day habit challenge and group missions keep members coming back.</p>
      </div>
      <Link href="/community" className="relative mt-5 inline-flex w-fit items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-brand-dark">
        Community <Icon name="arrow" size={15} />
      </Link>
    </section>
  );
}

function PersonRow({ href, name, image, line, online, right }) {
  const body = (
    <>
      <span className="relative shrink-0"><Avatar name={name} image={image} size={36} />{online ? <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-good" aria-hidden="true" /> : null}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{name}</span>
        <span className="block truncate text-xs text-muted">{line}</span>
      </span>
      {right}
    </>
  );
  return <li>{href ? <Link href={href} className={cx(ROW, "transition-colors hover:bg-white/[0.06]")}>{body}</Link> : <div className={ROW}>{body}</div>}</li>;
}

const Nothing = ({ children }) => <p className="rounded-xl bg-white/[0.03] px-4 py-6 text-center text-xs leading-5 text-muted">{children}</p>;

const DateChip = () => (
  <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-medium text-zinc-200">
    <Icon name="calendar" size={16} className="text-muted" />
    {today.format(new Date())}
  </span>
);

function AdminDashboard() {
  const request = useApi("/admin/overview");
  const { conversations, total: unread } = useChatInbox();
  const { data, error } = request;
  const o = data?.overview;
  const growth = data?.growth ?? [];
  const classes = data?.todayClasses ?? [];
  const recent = data?.recentMembers ?? [];
  const percent = o ? adherencePercent(o.done7, o.planned7) : null;
  const waiting = (conversations ?? []).filter((c) => c.unread > 0);
  // "Today" as the gym's own calendar day (the server's), so the heat map and the chart agree.
  const todayKey = growth[growth.length - 1]?.day;

  const tasks = o ? [
    o.unassignedClients ? { href: "/members", tone: "bad", icon: "alert", title: `${o.unassignedClients} member${o.unassignedClients === 1 ? "" : "s"} without a dietitian`, detail: "They share their profile and are waiting" } : null,
    data.openCases ? { href: "/cases", tone: data.escalatedCases ? "bad" : "warn", icon: "alert", title: `${data.openCases} case${data.openCases === 1 ? "" : "s"} need a person${data.escalatedCases ? ` (${data.escalatedCases} escalated)` : ""}`, detail: "Clients who went quiet or fell behind" } : null,
    o.pendingInvites ? { href: "/dietitians", tone: "warn", icon: "alert", title: `${o.pendingInvites} invitation${o.pendingInvites === 1 ? "" : "s"} not accepted yet`, detail: "Invited dietitians who have not signed in" } : null,
    unread ? { href: "/messages", tone: "good", icon: "chat", title: `${unread} unread message${unread === 1 ? "" : "s"}`, detail: waiting.map((c) => c.name).slice(0, 3).join(", ") || "From your dietitians" } : null,
  ].filter(Boolean) : [];

  const shortcuts = (
    <>
      <Link href="/members" className="inline-flex items-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-sm font-bold text-ink transition-colors hover:bg-brand-dark"><Icon name="joined" size={16} />Assign member</Link>
      {[["/dietitians", "shield", "Invite dietitian"], ["/workouts", "workout", "Add workout"], ["/classes", "calendar", "Schedule class"]].map(([href, icon, label]) => (
        <Link key={href} href={href} className="hidden items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-brand/40 hover:text-white md:inline-flex"><Icon name={icon} size={16} className="text-muted" />{label}</Link>
      ))}
    </>
  );

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Overview of your gym, members and programs · ${today.format(new Date())}`} actions={shortcuts} />
      {error ? <Failure error={error} reload={request.reload} /> : !o ? <Loading /> : (
        <div className="space-y-4 pb-10">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon="members" label="Total members" value={o.members} note={`${o.newMembers7} joined in 7 days`} spark={growth.map((d) => d.total)} />
            <Stat icon="pulse" label="Active members" value={o.activeMembers7} trend={trendOf(o.activeMembers7, data.compare?.activeMembersPrev7)} note="vs the week before" />
            <Stat icon="joined" label="New this week" value={o.newMembers7} trend={trendOf(o.newMembers7, data.compare?.newMembersPrev7)} note="vs the week before" spark={growth.slice(-14).map((d) => d.joined)} />
            <Stat icon="shield" label="Awaiting a dietitian" value={o.unassignedClients} note={`${o.dietitians} active dietitian${o.dietitians === 1 ? "" : "s"}`} tone={o.unassignedClients ? "warn" : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.5fr_1fr_0.85fr]">
            <Panel aria-labelledby="growth-title" className="lg:col-span-2 xl:col-span-1">
              <PanelTitle
                id="growth-title"
                icon="members"
                action={<span className="hidden shrink-0 items-center gap-4 text-xs text-muted sm:flex"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" />Members</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zinc-300" />Joined that day</span></span>}
              >
                Membership trend
              </PanelTitle>
              {growth.length ? <GrowthChart days={growth} /> : <Nothing>No members yet.</Nothing>}
            </Panel>

            <Panel aria-labelledby="goals-title" className="flex flex-col">
              <PanelTitle id="goals-title" icon="plan">Member goals</PanelTitle>
              <div className="flex flex-1 items-center">
                {data.goals?.length ? <GoalDonut goals={data.goals} /> : <Nothing>Goals appear once members finish setting up their profile.</Nothing>}
              </div>
            </Panel>

            <ChallengeCard />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.5fr_1fr_0.85fr]">
            <Panel aria-labelledby="heat-title" className="lg:col-span-2 xl:col-span-1">
              <PanelTitle id="heat-title" icon="pulse">Workout activity · 12 weeks</PanelTitle>
              {todayKey ? <ActivityHeat rows={data.heat ?? []} todayKey={todayKey} /> : <Nothing>No data yet.</Nothing>}
            </Panel>

            <Panel aria-labelledby="top-title">
              <PanelTitle id="top-title" icon="trophy" action={<span className="text-xs text-muted">this week</span>}>Top performers</PanelTitle>
              {data.topMembers?.length ? <Podium members={data.topMembers} /> : <Nothing>No workouts logged this week yet. The three members who train most show up here.</Nothing>}
            </Panel>

            <Panel aria-labelledby="today-title">
              <PanelTitle id="today-title" icon="calendar" action={<span className="shrink-0 text-xs text-muted">{today.format(new Date())}</span>}>Today at the gym</PanelTitle>
              <ul className="space-y-2.5">
                <TodayRow icon="check" title="Diet plans followed" detail={o.planned7 ? `${o.done7} of ${o.planned7} items · 7 days` : "Nothing planned this week"} ring={<Ring ratio={percent == null ? null : percent / 100} label={percent == null ? "–" : `${percent}%`} />} />
                <TodayRow icon="plan" title="Classes" detail={classes.length ? `${classes.length} scheduled today` : "None scheduled today"} ring={<Ring ratio={classes.length ? 1 : null} label={classes.length} />} />
                <TodayRow icon="shield" title="Dietitians" detail={o.pendingInvites ? `${o.pendingInvites} more invited` : "Active on the team"} ring={<Ring ratio={o.dietitians ? o.dietitians / (o.dietitians + o.pendingInvites) : null} label={o.dietitians} />} />
              </ul>
            </Panel>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Panel aria-labelledby="classes-title">
              <PanelTitle id="classes-title" icon="calendar" action={<ViewAll href="/classes" />}>Today’s classes</PanelTitle>
              {classes.length === 0 ? <Nothing>No classes on the timetable for today.</Nothing> : (
                <ul className="space-y-2.5">
                  {classes.slice(0, 4).map((c, i) => (
                    <li key={c.id} className={cx(ROW, i === 0 && "border-l-2 border-brand")}>
                      <Tile icon="workout" size={34} tone={i === 0 ? "brand" : "quiet"} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">{c.name}</span>
                        <span className="block truncate text-xs text-muted">{c.startTime} · {c.durationMin} min</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-200">{c.booked}/{c.capacity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel aria-labelledby="load-title">
              <PanelTitle id="load-title" icon="shield" action={<ViewAll href="/dietitians">Manage</ViewAll>}>Dietitian workload</PanelTitle>
              {data.dietitianLoad?.length ? <DietitianLoad rows={data.dietitianLoad} /> : <Nothing>No dietitians yet. Invite the first one from Dietitians.</Nothing>}
            </Panel>

            <Panel aria-labelledby="tasks-title">
              <PanelTitle id="tasks-title" icon="bell">
                <span className="flex items-center gap-2">Alerts &amp; tasks{tasks.length ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{tasks.length}</span> : null}</span>
              </PanelTitle>
              {tasks.length === 0 ? <Nothing>Nothing is waiting for you. Assignments, invitations and messages are all up to date.</Nothing> : <ul className="space-y-2.5">{tasks.map((t) => <TaskRow key={t.title} {...t} />)}</ul>}
            </Panel>

            <Panel aria-labelledby="recent-title">
              <PanelTitle id="recent-title" icon="members" action={<ViewAll href="/members" />}>Recent members</PanelTitle>
              {recent.length === 0 ? <Nothing>Nobody has joined yet.</Nothing> : (
                <ul className="space-y-2.5">
                  {recent.map((m) => <PersonRow key={m.id} name={m.name || m.email} image={m.image} line={`Joined ${timeAgo(m.joinedAt)}${m.dietitianName ? ` · ${m.dietitianName}` : m.setupDone ? " · no dietitian" : " · not set up"}`} />)}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function DietitianDashboard() {
  const request = useApi("/dietitian/clients");
  const { conversations, total: unread } = useChatInbox();
  const { data, error } = request;
  const clients = data?.clients ?? [];
  const planned = clients.reduce((sum, client) => sum + client.planned7, 0);
  const done = clients.reduce((sum, client) => sum + client.done7, 0);
  const needPlan = clients.filter((client) => client.planned7 === 0);
  const percent = adherencePercent(done, planned);
  const chats = (conversations ?? []).filter((c) => c.unread > 0 || c.lastAt).sort((a, b) => b.unread - a.unread || (a.lastAt < b.lastAt ? 1 : -1));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your clients and the plans they need" actions={<DateChip />} />
      {error ? <Failure error={error} reload={request.reload} /> : !data ? <Loading /> : (
        <div className="space-y-4 pb-10">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon="members" label="Your clients" value={clients.length} note="assigned to you" />
            <Stat icon="check" label="Plan followed" value={percent == null ? "–" : `${percent}%`} note={planned ? `${done} of ${planned} items · 7 days` : "nothing planned this week"} />
            <Stat icon="plan" label="Without a plan" value={needPlan.length} note="no items in the last 7 days" tone={needPlan.length ? "warn" : undefined} />
            <Stat icon="chat" label="Unread messages" value={unread} note={unread ? "waiting for an answer" : "all answered"} tone={unread ? "warn" : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.2fr_1fr_0.8fr]">
            <Panel aria-labelledby="focus-title">
              <PanelTitle id="focus-title" icon="bell" action={<ViewAll href="/clients" />}>Where to focus next</PanelTitle>
              {clients.length === 0 ? <Nothing>The admin assigns clients to you. Once they appear in Clients, add their diet and exercise plans.</Nothing> : needPlan.length === 0 ? <Nothing>Every client has plan items this week. Open Clients to review progress.</Nothing> : (
                <ul className="space-y-2.5">
                  {needPlan.slice(0, 5).map((c) => <PersonRow key={c.id} href={`/clients/${encodeURIComponent(c.id)}`} name={c.name || c.email} image={c.image} line={`No plan this week · ${GOAL_LABEL[c.goal] ?? "No goal"} · ${fmtKg(c.weightKg)} → ${fmtKg(c.targetWeightKg)}`} right={<Icon name="arrow" size={15} className="shrink-0 text-muted" />} />)}
                </ul>
              )}
            </Panel>

            <Panel aria-labelledby="chats-title">
              <PanelTitle id="chats-title" icon="chat" action={<ViewAll href="/messages" />}>Messages</PanelTitle>
              {chats.length === 0 ? <Nothing>No conversations yet. Say hello to a client from Messages.</Nothing> : (
                <ul className="space-y-2.5">
                  {chats.slice(0, 5).map((c) => <PersonRow key={c.key} href={`/messages?with=${encodeURIComponent(c.key)}`} name={c.name} image={c.image} online={c.online} line={`${c.lastMine ? "You: " : ""}${c.lastBody || "No messages yet"}`} right={c.unread ? <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-ink">{c.unread}</span> : null} />)}
                </ul>
              )}
            </Panel>

            <Panel aria-labelledby="dactions-title" className="lg:col-span-2 xl:col-span-1">
              <PanelTitle id="dactions-title" icon="bolt">Quick actions</PanelTitle>
              <div className="grid grid-cols-2 gap-2">
                <QuickAction href="/clients" icon="members" label="Clients" primary />
                <QuickAction href="/messages" icon="chat" label="Messages" />
              </div>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  const { staff } = useAuth();
  return staff?.role === "admin" ? <AdminDashboard /> : <DietitianDashboard />;
}
