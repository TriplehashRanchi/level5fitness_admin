"use client";

import { useEffect, useRef, useState } from "react";
import { messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { addDays, dayLabel, fmtTime, fullDate, todayKey } from "@/lib/dates";
import { SLOT_LABEL } from "@/lib/body";
import { Badge, Button, cx, Empty, Input, Lightbox, Section, SectionError, Skeleton } from "@/components/ui";

const nf = new Intl.NumberFormat("en-GB");
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function Meter({ label, value, goal, unit }) {
  const has = typeof goal === "number" && goal > 0;
  const pct = has ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  const tone = !has ? "bg-white/20" : value >= goal ? "bg-good" : value > 0 ? "bg-warn" : "bg-accent";
  return (
    <div className="rounded-2xl border border-line bg-card-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs tabular-nums text-muted">{has ? `${nf.format(value)} / ${nf.format(goal)} ${unit}` : `${nf.format(value)} ${unit} · no target`}</p>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-3 h-2 overflow-hidden rounded-full bg-black/30">
        <div className={cx("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      {has ? <p className="mt-1.5 text-xs tabular-nums text-muted">{pct}%</p> : null}
    </div>
  );
}

function Label({ children }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-[2px] text-muted">{children}</p>;
}

function DaySkeleton() {
  return (
    <div role="status" aria-label="Loading the day" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-[92px]" /><Skeleton className="h-[92px]" /></div>
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      <span className="sr-only">Loading the day…</span>
    </div>
  );
}

function Day({ id, day, today, refreshToken }) {
  const { data, error, reload } = useApi(`/dietitian/clients/${encodeURIComponent(id)}/day?day=${day}`);
  const [viewing, setViewing] = useState(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    reload();
  }, [refreshToken, reload]);

  if (error) return <SectionError onRetry={reload}>{messageOf(error)}</SectionError>;
  if (!data) return <DaySkeleton />;

  const steps = data.steps ?? {};
  const water = data.water ?? {};
  const meals = Array.isArray(data.meals) ? data.meals : [];
  const diet = data.diet ?? { done: 0, total: 0, items: [] };
  const dietItems = Array.isArray(diet.items) ? diet.items : [];
  const workouts = Array.isArray(data.workouts) ? data.workouts : [];
  const photos = meals
    .filter((m) => m.photoUrl)
    .map((m) => ({ id: m.id, url: m.photoUrl, caption: `${SLOT_LABEL[m.mealType] || m.mealType || "Meal"}${m.eatenAt ? ` · ${fmtTime(m.eatenAt)}` : ""}`, note: m.note }));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Meter label="Steps" value={num(steps.value)} goal={steps.goal} unit="steps" />
        <Meter label="Water" value={num(water.totalMl)} goal={water.goalMl} unit="ml" />
      </div>

      <div>
        <Label>Meals logged</Label>
        {meals.length === 0 ? (
          <Empty title="No meals logged">Meal photos and notes the client adds in the app show up here.</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {meals.map((m) => {
              const at = photos.findIndex((p) => p.id === m.id);
              const title = `${SLOT_LABEL[m.mealType] || m.mealType || "Meal"}${m.eatenAt ? ` · ${fmtTime(m.eatenAt)}` : ""}`;
              return (
                <li key={m.id} className="overflow-hidden rounded-2xl border border-line bg-card-2">
                  {m.photoUrl ? (
                    <button type="button" onClick={() => setViewing(at)} aria-label={`View photo: ${title}`} className="group block aspect-square w-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" referrerPolicy="no-referrer" />
                    </button>
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-black/20 text-xs text-muted">No photo</div>
                  )}
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-white">{title}</p>
                    {m.note ? <p className="mt-0.5 line-clamp-2 text-xs text-zinc-300">{m.note}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <Label>Diet plan ticks</Label>
          {num(diet.total) === 0 ? (
            <Empty title="Nothing planned">Add items in the Diet plan section below.</Empty>
          ) : (
            <div className="rounded-2xl border border-line bg-card-2 p-4">
              <p className="text-sm font-semibold text-white tabular-nums">
                <span className={num(diet.done) >= diet.total ? "text-good" : num(diet.done) > 0 ? "text-warn" : "text-accent"}>{num(diet.done)}</span> of {diet.total} done
              </p>
              <ul className="mt-2 space-y-1.5">
                {dietItems.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-xs text-zinc-300">
                    <span aria-hidden="true" className={cx("flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black", i.done ? "bg-brand text-ink" : "border border-white/25")}>{i.done ? "✓" : ""}</span>
                    <span className="sr-only">{i.done ? "Done:" : "Not done:"}</span>
                    <span className="truncate">{SLOT_LABEL[i.mealSlot] ? `${SLOT_LABEL[i.mealSlot]}: ` : ""}{i.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <Label>Workouts</Label>
          {workouts.length === 0 ? (
            <Empty title="No workouts logged" />
          ) : (
            <ul className="space-y-2">
              {workouts.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card-2 p-3 text-sm">
                  <span className="truncate font-semibold text-white">{w.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{w.durationMin} min{w.calories != null ? ` · ${w.calories} kcal` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted">Meal photos use a link that expires after 10 minutes. {day === today ? "Refresh" : "Change the day or refresh"} to open them again.</p>
      <Lightbox photos={photos} index={viewing} onClose={() => setViewing(null)} onIndex={setViewing} />
    </div>
  );
}

export default function ClientDailyCheck({ memberId, refreshToken = 0 }) {
  const [today] = useState(todayKey);
  const [day, setDay] = useState(today);
  const [manual, setManual] = useState(0);

  return (
    <Section
      id="daily-check"
      title="Daily check"
      description="What the client actually did on a day: steps, water, meals with photos, diet ticks and workouts."
      action={
        <>
          <Button variant="secondary" size="sm" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>‹</Button>
          <Input
            type="date"
            aria-label="Day to check"
            className="!w-auto !rounded-xl !py-1.5"
            value={day}
            max={today}
            onChange={(e) => e.target.value && e.target.value <= today && setDay(e.target.value)}
          />
          <Button variant="secondary" size="sm" aria-label="Next day" disabled={day >= today} onClick={() => setDay(addDays(day, 1))}>›</Button>
          {day !== today ? <Button variant="ghost" size="sm" onClick={() => setDay(today)}>Today</Button> : null}
          <Button variant="ghost" size="sm" onClick={() => setManual((n) => n + 1)}>Refresh</Button>
        </>
      }
    >
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-200">{fullDate(day)} {day === today ? <Badge tone="brand">{dayLabel(day, today)}</Badge> : null}</h3>
      <Day key={day} id={memberId} day={day} today={today} refreshToken={refreshToken + manual} />
    </Section>
  );
}
