"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, messageOf } from "@/lib/api";
import { SLOT_LABEL, SLOTS } from "@/lib/body";
import { addDays, fullDate, todayKey } from "@/lib/dates";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth";
import { PLANS_CHANGED } from "@/components/group-plan";
import { Alert, Avatar, Button, cx, EmptyState, Field, Input, Modal, PageHeader, PageSpinner, Select, Switch, Textarea } from "@/components/ui";

/** The most work one request may do (clients × days × items). The API enforces the same number. */
const MAX_WORK = 1500;
const SPANS = [1, 3, 7, 14, 30];

/** Meals a dietitian writes again and again: one click fills the next empty row (they can still edit it). */
const IDEAS = [
  { slot: "breakfast", title: "Oats with fruit and nuts", calories: 320 },
  { slot: "breakfast", title: "Moong dal chilla with curd", calories: 280 },
  { slot: "lunch", title: "Dal, 2 roti and sabzi", calories: 550 },
  { slot: "lunch", title: "Chicken or paneer with rice and salad", calories: 620 },
  { slot: "snack", title: "Sprouts chaat", calories: 180 },
  { slot: "snack", title: "Fruit bowl and roasted chana", calories: 200 },
  { slot: "dinner", title: "Vegetable khichdi with curd", calories: 420 },
  { slot: "dinner", title: "Grilled paneer and sautéed vegetables", calories: 450 },
];

const MODES = [
  { id: "one", label: "One client" },
  { id: "some", label: "Some" },
  { id: "all", label: "Everyone" },
];

/** A titled block of the form with an optional switch to leave it out. */
function Block({ title, note, on, onToggle, children }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className={cx("flex items-start justify-between gap-4", on !== false && "mb-4")}>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-white">{title}</h2>
          {note ? <p className="mt-0.5 text-xs leading-5 text-muted">{note}</p> : null}
        </div>
        {onToggle ? <Switch checked={on} onChange={onToggle} label={`Include ${title}`} /> : null}
      </div>
      {on === false ? null : children}
    </section>
  );
}

function Plans({ initialClient }) {
  const { data, error, reload } = useApi("/dietitian/clients");
  const clients = useMemo(() => data?.clients ?? [], [data]);

  // ── Who ──
  const [mode, setMode] = useState("one");
  const [picked, setPicked] = useState(() => new Set(initialClient ? [initialClient] : []));
  const [query, setQuery] = useState("");
  const ids = mode === "all" ? clients.map((c) => c.id) : [...picked].filter((id) => clients.some((c) => c.id === id));
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? clients.filter((c) => `${c.name ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q)) : clients;
  }, [clients, query]);
  const chooseMode = (next) => {
    setMode(next);
    // Going to "one client" keeps just the first one that was ticked.
    if (next === "one") setPicked((s) => new Set([...s].slice(0, 1)));
  };
  const tick = (id) => setPicked((s) => {
    if (mode === "one") return new Set([id]);
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const allShown = shown.length > 0 && shown.every((c) => picked.has(c.id));
  const tickShown = () => setPicked((s) => { const n = new Set(s); for (const c of shown) { if (allShown) n.delete(c.id); else n.add(c.id); } return n; });

  // ── When ──
  const [start, setStart] = useState(todayKey);
  const [span, setSpan] = useState(1);
  const days = useMemo(() => (/^\d{4}-\d{2}-\d{2}$/.test(start) ? Array.from({ length: span }, (_, i) => addDays(start, i)) : []), [start, span]);

  // ── What ──
  const nextRow = useRef(5);
  const [mealsOn, setMealsOn] = useState(true);
  const [rows, setRows] = useState(() => ["breakfast", "lunch", "snack", "dinner"].map((slot, i) => ({ key: i + 1, slot, title: "", details: "", calories: "" })));
  const [workOn, setWorkOn] = useState(false);
  const [work, setWork] = useState({ title: "", durationMin: "45", kcal: "300", instructions: "" });
  const setRow = (key, patch) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = (patch = {}) => setRows((list) => [...list, { key: nextRow.current++, slot: "snack", title: "", details: "", calories: "", ...patch }]);
  const fillWith = (idea) => setRows((list) => {
    const at = list.findIndex((r) => !r.title.trim() && r.slot === idea.slot);
    const any = at >= 0 ? at : list.findIndex((r) => !r.title.trim());
    if (any >= 0) return list.map((r, i) => (i === any ? { ...r, slot: idea.slot, title: idea.title, calories: String(idea.calories) } : r));
    return [...list, { key: nextRow.current++, slot: idea.slot, title: idea.title, details: "", calories: String(idea.calories) }];
  });

  const meals = mealsOn ? rows.filter((r) => r.title.trim()) : [];
  const items = meals.length + (workOn ? 1 : 0);
  const work_ = ids.length * days.length * items;

  const problem = (() => {
    if (ids.length === 0) return mode === "one" ? "Choose a client." : "Choose who gets this.";
    if (days.length === 0) return "Choose a start date.";
    if (!items) return mealsOn || workOn ? "Write at least one meal, or fill in the workout." : "Turn on Meals or Workout.";
    for (const m of meals) {
      if (m.calories !== "" && (!Number.isInteger(Number(m.calories)) || Number(m.calories) > 3000)) return `“${m.title.trim()}”: calories must be a whole number up to 3000.`;
    }
    if (mealsOn && meals.length > 12) return "Up to 12 meals at a time.";
    if (workOn) {
      if (!work.title.trim()) return "Give the workout a title.";
      if (!work.instructions.trim()) return "Add the exercises, sets and reps.";
      const d = Number(work.durationMin);
      if (!Number.isInteger(d) || d < 1 || d > 600) return "Workout minutes must be 1 to 600.";
      const k = Number(work.kcal);
      if (!Number.isInteger(k) || k < 0 || k > 5000) return "Workout calories must be a whole number up to 5000.";
    }
    if (work_ > MAX_WORK) return `That is too much for one go (${work_} items). Use fewer clients, days or meals.`;
    return null;
  })();

  // ── Send ──
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [sendError, setSendError] = useState(null);
  const nameOf = (id) => { const c = clients.find((x) => x.id === id); return c?.name || c?.email || "Client"; };

  const send = async () => {
    setBusy(true);
    setSendError(null);
    try {
      const res = await api("/dietitian/plans/bulk", {
        method: "POST",
        body: {
          clientIds: ids,
          days,
          meals: meals.map((m) => ({ mealSlot: m.slot, title: m.title.trim(), details: m.details.trim() || undefined, calories: m.calories === "" ? undefined : Number(m.calories) })),
          workout: workOn ? { title: work.title.trim(), instructions: work.instructions.trim(), durationMin: Number(work.durationMin), kcal: Number(work.kcal) } : undefined,
        },
      });
      setResults(res.results);
      if (res.results.some((r) => r.ok)) window.dispatchEvent(new Event(PLANS_CHANGED));
    } catch (e) {
      setSendError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const closeReview = () => { if (busy) return; setReview(false); setResults(null); setSendError(null); };
  const failed = results?.filter((r) => !r.ok) ?? [];
  const skipped = results?.filter((r) => r.ok && r.skipped.length) ?? [];
  /** Back to the page with only the clients that failed ticked, to try again. */
  const retryFailed = () => { setMode("some"); setPicked(new Set(failed.map((r) => r.clientId))); closeReview(); };

  if (error && !data) return <Alert action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>{messageOf(error)}</Alert>;
  if (!data) return <PageSpinner label="Loading your clients…" />;
  if (clients.length === 0) {
    return (
      <>
        <PageHeader title="Plans" subtitle="Give diet and workout plans to your clients." />
        <EmptyState title="No clients yet">The admin assigns clients to you. Once they appear in Clients, you can plan their diet and workouts from here.</EmptyState>
      </>
    );
  }

  const range = days.length > 1 ? `${fullDate(days[0])} → ${fullDate(days[days.length - 1])}` : days[0] ? fullDate(days[0]) : "";
  const summary = `${ids.length} client${ids.length === 1 ? "" : "s"} · ${days.length} day${days.length === 1 ? "" : "s"}${meals.length ? ` · ${meals.length} meal${meals.length === 1 ? "" : "s"} a day` : ""}${workOn ? " · workout" : ""}`;

  return (
    <>
      <PageHeader title="Plans" subtitle="Write a diet or a workout once, then give it to one client, a few, or everyone, for as many days as you like." />

      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        {/* ── Who gets it ── */}
        <aside aria-label="Who gets it" className="xl:sticky xl:top-[calc(var(--bar)+1rem)] xl:self-start">
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="mb-3 text-[15px] font-semibold text-white">Who gets it</h2>
            <div className="flex gap-1 rounded-xl bg-card-2 p-1" role="tablist" aria-label="Who gets it">
              {MODES.map((m) => (
                <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => chooseMode(m.id)} className={cx("flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors", mode === m.id ? "bg-brand text-ink" : "text-muted hover:text-white")}>
                  {m.label}
                </button>
              ))}
            </div>

            {mode === "all" ? (
              <p className="mt-4 rounded-xl bg-brand/10 px-4 py-3 text-sm leading-6 text-zinc-200">All <strong className="text-white">{clients.length}</strong> of your clients get this.</p>
            ) : (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <label className="relative block flex-1">
                    <span className="sr-only">Search clients</span>
                    <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="w-full rounded-xl border border-line bg-card-2 py-2 pl-9 pr-3 text-sm text-white placeholder:text-muted focus:border-brand/60 focus:outline-none" />
                  </label>
                  {mode === "some" ? <button type="button" onClick={tickShown} className="shrink-0 text-xs font-semibold text-brand hover:underline">{allShown ? "Untick all" : "Tick all"}</button> : null}
                </div>
                <ul className="chat-scroll mt-3 max-h-[26rem] space-y-1 overflow-y-auto" role={mode === "one" ? "radiogroup" : undefined} aria-label="Clients">
                  {shown.map((c) => (
                    <li key={c.id}>
                      <label className={cx("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors", picked.has(c.id) ? "border-brand/40 bg-brand/10" : "border-line hover:bg-white/5")}>
                        <input type={mode === "one" ? "radio" : "checkbox"} name="client" checked={picked.has(c.id)} onChange={() => tick(c.id)} className="h-4 w-4 shrink-0 accent-brand" />
                        <Avatar name={c.name || c.email} image={c.image} size={30} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{c.name || c.email}</span>
                      </label>
                    </li>
                  ))}
                  {shown.length === 0 ? <li className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">Nobody matches.</li> : null}
                </ul>
              </>
            )}
            <p className="mt-3 text-xs leading-5 text-muted">
              {ids.length === 0 ? "Nobody chosen yet." : ids.length === 1 ? `Only ${nameOf(ids[0])} gets it.` : `${ids.length} clients get it.`}
              {" "}For one client&apos;s own plan, open them in <Link href="/clients" className="font-semibold text-brand hover:underline">Clients</Link>.
            </p>
          </section>
        </aside>

        {/* ── What and when ── */}
        <div className="min-w-0 space-y-4 pb-24">
          <Block title="When" note="The plan is added on each of these days.">
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
              <Field label="Starting on"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-zinc-200">For how many days</span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="For how many days">
                  {SPANS.map((n) => (
                    <button key={n} type="button" aria-pressed={span === n} onClick={() => setSpan(n)} className={cx("rounded-xl border px-4 py-2 text-sm font-semibold transition-colors", span === n ? "border-brand/50 bg-brand text-ink" : "border-line bg-card-2 text-zinc-200 hover:border-white/25")}>
                      {n === 1 ? "1 day" : `${n} days`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {range ? <p className="mt-3 text-xs text-muted">{range}</p> : null}
          </Block>

          <Block title="Meals" note="One row per meal. Rows you leave empty are skipped." on={mealsOn} onToggle={setMealsOn}>
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.key} className="rounded-xl border border-line bg-white/[0.02] p-3">
                  <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_6.5rem_auto]">
                    <Select aria-label="Meal" value={r.slot} onChange={(e) => setRow(r.key, { slot: e.target.value })}>
                      {SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
                    </Select>
                    <Input aria-label="What to eat" value={r.title} maxLength={100} onChange={(e) => setRow(r.key, { title: e.target.value })} placeholder="What to eat" />
                    <Input aria-label="Calories" inputMode="numeric" value={r.calories} onChange={(e) => setRow(r.key, { calories: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="kcal" />
                    <button type="button" onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))} aria-label="Remove this meal" className="flex h-10 w-10 items-center justify-center justify-self-end rounded-xl text-muted transition-colors hover:bg-accent/10 hover:text-accent">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                  <Input aria-label="Details" className="mt-2 !py-2 !text-xs" value={r.details} maxLength={300} onChange={(e) => setRow(r.key, { details: e.target.value })} placeholder="Details (optional): quantity, how to make it" />
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => addRow()} disabled={rows.length >= 12}>+ Add a meal</Button>
              <span className="text-xs text-muted">or fill the next empty row with:</span>
            </div>
            <ul className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="Meal ideas">
              {IDEAS.map((i) => (
                <li key={i.title} className="shrink-0">
                  <button type="button" onClick={() => fillWith(i)} className="rounded-full border border-line bg-card-2 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-brand/40 hover:text-brand">{i.title} · {i.calories}</button>
                </li>
              ))}
            </ul>
          </Block>

          <Block title="Workout" note="A client has one workout a day: this replaces any workout already planned on those days." on={workOn} onToggle={setWorkOn}>
            <div className="space-y-4">
              <Field label="Title"><Input value={work.title} maxLength={80} onChange={(e) => setWork((w) => ({ ...w, title: e.target.value }))} placeholder="e.g. Upper body" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Minutes"><Input inputMode="numeric" value={work.durationMin} onChange={(e) => setWork((w) => ({ ...w, durationMin: e.target.value.replace(/\D/g, "").slice(0, 3) }))} /></Field>
                <Field label="Calories"><Input inputMode="numeric" value={work.kcal} onChange={(e) => setWork((w) => ({ ...w, kcal: e.target.value.replace(/\D/g, "").slice(0, 4) }))} /></Field>
              </div>
              <Field label="Exercises, sets and reps"><Textarea rows={6} maxLength={4000} value={work.instructions} onChange={(e) => setWork((w) => ({ ...w, instructions: e.target.value }))} placeholder={"Warm-up: 5 minutes\nSquats: 3 × 12\nPush-ups: 3 × 10\nCool-down: 5 minutes"} /></Field>
            </div>
          </Block>
        </div>
      </div>

      {/* The bar that stays at the bottom: what will happen, and the button. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-8 lg:pl-[calc(248px+2.5rem)] lg:pr-10">
        <div className="pointer-events-auto mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-card px-5 py-3.5 shadow-2xl shadow-black/70">
          <p className={cx("min-w-0 text-sm", problem ? "text-muted" : "font-semibold text-white")} role="status">{problem ?? summary}</p>
          <Button onClick={() => setReview(true)} disabled={!!problem}>Review and add</Button>
        </div>
      </div>

      {/* Check before it is sent: who, when and what, in words. After sending: who got it and who did not. */}
      <Modal
        open={review}
        onClose={closeReview}
        title={results ? "Done" : "Add this to the plans?"}
        wide
        footer={
          results ? (
            <>
              {failed.length ? <Button variant="secondary" onClick={retryFailed}>Try the {failed.length} that failed again</Button> : null}
              <Button onClick={closeReview}>Close</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={closeReview} disabled={busy}>Back</Button>
              <Button onClick={send} loading={busy}>{busy ? "Adding…" : `Add for ${ids.length} client${ids.length === 1 ? "" : "s"}`}</Button>
            </>
          )
        }
      >
        {results ? (
          <div className="space-y-4">
            <Alert tone={failed.length ? "bad" : "good"}>
              {failed.length === 0 ? `Added for ${results.length === 1 ? nameOf(results[0].clientId) : `all ${results.length} clients`}. They are told in the app.` : `Added for ${results.length - failed.length} of ${results.length} clients.`}
            </Alert>
            {skipped.length ? <Alert tone="info">{skipped.length === 1 ? `${nameOf(skipped[0].clientId)} had ${skipped[0].skipped.length} day${skipped[0].skipped.length === 1 ? "" : "s"} that were already full, so the meals were not added there.` : `${skipped.length} clients had days that were already full, so the meals were not added on those days.`}</Alert> : null}
            <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-2xl border border-line">
              {results.map((r) => (
                <li key={r.clientId} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                  <span className="font-semibold text-white">{nameOf(r.clientId)}</span>
                  <span className={cx("text-right", r.ok ? "text-zinc-300" : "text-accent")}>
                    {r.ok ? [r.meals ? `${r.meals} meal${r.meals === 1 ? "" : "s"}` : null, r.workouts ? `${r.workouts} workout${r.workouts === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") : r.error ?? "Nothing was added (the days were full)."}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-5 text-sm">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Who</p>
              <ul className="flex flex-wrap gap-2">
                {ids.slice(0, 12).map((id) => <li key={id} className="rounded-full border border-line bg-card-2 px-3 py-1 text-xs font-medium text-white">{nameOf(id)}</li>)}
                {ids.length > 12 ? <li className="px-1 py-1 text-xs text-muted">and {ids.length - 12} more</li> : null}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">When</p>
              <p className="text-zinc-200">{range} <span className="text-muted">({days.length} day{days.length === 1 ? "" : "s"})</span></p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">What, each day</p>
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {meals.map((m) => <li key={m.key} className="flex items-center justify-between gap-4 px-4 py-2.5"><span className="min-w-0 truncate text-zinc-100"><span className="mr-2 text-xs text-muted">{SLOT_LABEL[m.slot]}</span>{m.title.trim()}</span>{m.calories ? <span className="shrink-0 text-xs tabular-nums text-muted">{m.calories} kcal</span> : null}</li>)}
                {workOn ? <li className="flex items-center justify-between gap-4 px-4 py-2.5"><span className="min-w-0 truncate text-zinc-100"><span className="mr-2 text-xs text-muted">Workout</span>{work.title.trim()}</span><span className="shrink-0 text-xs tabular-nums text-muted">{work.durationMin} min</span></li> : null}
              </ul>
            </div>
            {workOn ? <p className="rounded-xl bg-warn/10 px-4 py-3 text-xs leading-5 text-warn">Any workout already planned on these days for these clients will be replaced.</p> : null}
            {sendError ? <p className="font-semibold text-accent" role="alert">{sendError}</p> : null}
          </div>
        )}
      </Modal>
    </>
  );
}

export default function PlansPage() {
  const { staff } = useAuth();
  const initialClient = useSearchParams().get("client");
  if (staff?.role !== "dietitian") {
    return (
      <>
        <PageHeader title="Plans" subtitle="Diet and workout plans are written by a client's own dietitian." />
        <EmptyState title="This page is for dietitians" action={<Link href="/dashboard" className="text-sm font-semibold text-brand hover:underline">Back to the dashboard</Link>}>The admin assigns clients to dietitians; each dietitian plans for their own clients.</EmptyState>
      </>
    );
  }
  return <Plans initialClient={initialClient} />;
}
