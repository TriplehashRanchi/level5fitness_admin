"use client";

import { useMemo, useState } from "react";
import { api, messageOf } from "@/lib/api";
import { SLOT_LABEL, SLOTS } from "@/lib/body";
import { todayKey } from "@/lib/dates";
import { Alert, Avatar, Button, cx, Drawer, Field, Input, Select, Textarea } from "@/components/ui";

/** Tells the open client page that a plan was changed from here, so it shows the new item. */
export const PLANS_CHANGED = "l5-plans-changed";

const TABS = [
  { id: "meal", label: "Meal" },
  { id: "workout", label: "Workout" },
];

/** A numbered heading for one part of the panel. */
function Step({ n, children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2.5 text-sm font-semibold text-white">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-ink">{n}</span>
        {children}
      </h3>
      {action}
    </div>
  );
}

/**
 * Add one meal or one workout to a client's plan, or to several clients at once.
 * It opens with the client you are looking at already ticked: leave it like that to add it for that one
 * client only, or tick more clients to give them the same thing in one go. Each client is saved on its
 * own, so one client's problem (a full day, say) never stops the others; the result lists who got it.
 *
 *   clients  everyone assigned to this dietitian: [{ id, name, email, image }]
 *   initial  ids to tick when it opens
 */
export default function GroupPlanDialog({ clients, initial = [], onClose }) {
  const [tab, setTab] = useState("meal");
  const [picked, setPicked] = useState(() => new Set(initial));
  const [query, setQuery] = useState("");
  const [day, setDay] = useState(todayKey);
  const [meal, setMeal] = useState({ mealSlot: "breakfast", title: "", details: "", calories: "" });
  const [work, setWork] = useState({ title: "", durationMin: "45", kcal: "300", instructions: "" });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [problem, setProblem] = useState(null);
  /** After sending: one line per client, or null before. */
  const [results, setResults] = useState(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? clients.filter((c) => `${c.name ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q)) : clients;
  }, [clients, query]);
  const allShownPicked = shown.length > 0 && shown.every((c) => picked.has(c.id));
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleShown = () => setPicked((s) => { const n = new Set(s); for (const c of shown) { if (allShownPicked) n.delete(c.id); else n.add(c.id); } return n; });
  const nameOf = (id) => { const c = clients.find((x) => x.id === id); return c?.name || c?.email || "Client"; };

  /** The request for one client, or a sentence saying what is missing. */
  const requestFor = (id) => {
    const enc = encodeURIComponent(id);
    if (tab === "meal") {
      const calories = meal.calories.trim() === "" ? undefined : Number(meal.calories);
      return { path: `/dietitian/clients/${enc}/plan`, method: "POST", body: { day, mealSlot: meal.mealSlot, title: meal.title.trim(), details: meal.details.trim() || undefined, calories } };
    }
    return { path: `/dietitian/clients/${enc}/training`, method: "PUT", body: { day, title: work.title.trim(), instructions: work.instructions.trim(), durationMin: Number(work.durationMin), kcal: Number(work.kcal) } };
  };

  const check = () => {
    if (picked.size === 0) return "Tick at least one client.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "Choose a date.";
    if (tab === "meal") {
      if (!meal.title.trim()) return "Write what the meal is.";
      if (meal.calories.trim() !== "" && (!Number.isInteger(Number(meal.calories)) || Number(meal.calories) > 3000)) return "Calories must be a whole number up to 3000.";
    } else {
      if (!work.title.trim()) return "Give the workout a title.";
      if (!work.instructions.trim()) return "Add the exercises, sets and reps.";
      const d = Number(work.durationMin);
      if (!Number.isInteger(d) || d < 1 || d > 600) return "Duration must be 1 to 600 minutes.";
      const k = Number(work.kcal);
      if (!Number.isInteger(k) || k < 0 || k > 5000) return "Calories must be a whole number up to 5000.";
    }
    return null;
  };

  const send = async () => {
    const wrong = check();
    setProblem(wrong);
    if (wrong) return;
    setBusy(true);
    setProgress(0);
    const out = [];
    let done = 0;
    for (const id of picked) {
      const r = requestFor(id);
      try {
        await api(r.path, { method: r.method, body: r.body });
        out.push({ id, ok: true });
      } catch (e) {
        out.push({ id, ok: false, text: messageOf(e) });
      }
      setProgress(++done);
    }
    setBusy(false);
    setResults(out);
    if (out.some((r) => r.ok)) window.dispatchEvent(new Event(PLANS_CHANGED));
  };

  const failed = results?.filter((r) => !r.ok) ?? [];
  const worked = results ? results.length - failed.length : 0;
  /** Back to the form with only the clients that did not get it, to try again. */
  const retryFailed = () => { setPicked(new Set(failed.map((r) => r.id))); setResults(null); };

  const footer = results ? (
    <>
      {failed.length ? <Button variant="secondary" className="flex-1" onClick={retryFailed}>Try the {failed.length} that failed again</Button> : null}
      <Button className="flex-1" onClick={onClose}>Done</Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button className="flex-1" onClick={send} loading={busy}>
        {busy ? `Adding… ${progress}/${picked.size}` : picked.size > 1 ? `Add for ${picked.size} clients` : picked.size === 1 ? "Add for 1 client" : "Add"}
      </Button>
    </>
  );

  return (
    <Drawer open onClose={() => !busy && onClose()} title="Add to plan" subtitle="For one client, or for several at once." footer={footer}>
      {results ? (
        <div className="space-y-4">
          <Alert tone={failed.length ? "bad" : "good"}>
            {failed.length === 0
              ? `Added for ${worked === 1 ? nameOf(results[0].id) : `${worked} clients`}. They are told in the app.`
              : `Added for ${worked} of ${results.length} clients. ${failed.length} did not get it.`}
          </Alert>
          {failed.length ? (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {failed.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                  <span className="font-semibold text-white">{nameOf(r.id)}</span>
                  <span className="text-right text-accent">{r.text}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="space-y-8">
          {/* 1 · who gets it */}
          <section aria-label="Who gets it">
            <Step n={1} action={<button type="button" onClick={toggleShown} className="text-xs font-semibold text-brand hover:underline">{allShownPicked ? "Untick all" : "Tick all"}</button>}>Who gets it</Step>
            {clients.length > 6 ? (
              <label className="relative mb-2 block">
                <span className="sr-only">Search clients</span>
                <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients" className="w-full rounded-xl border border-line bg-card-2 py-2 pl-9 pr-3 text-sm text-white placeholder:text-muted focus:border-brand/60 focus:outline-none" />
              </label>
            ) : null}
            <ul className="chat-scroll max-h-56 space-y-1 overflow-y-auto">
              {shown.map((c) => (
                <li key={c.id}>
                  <label className={cx("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors", picked.has(c.id) ? "border-brand/40 bg-brand/10" : "border-line hover:bg-white/5")}>
                    <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 shrink-0 accent-brand" />
                    <Avatar name={c.name || c.email} image={c.image} size={30} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{c.name || c.email}</span>
                  </label>
                </li>
              ))}
              {shown.length === 0 ? <li className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">{clients.length === 0 ? "No clients are assigned to you yet." : "Nobody matches."}</li> : null}
            </ul>
            <p className="mt-2 text-xs leading-5 text-muted">{picked.size === 0 ? "Tick at least one client." : picked.size === 1 ? "Only this client gets it. Tick more to give them the same." : `${picked.size} clients selected.`}</p>
          </section>

          {/* 2 · what they get */}
          <section aria-label="What they get">
            <Step n={2}>What to add</Step>
            <div className="mb-4 flex gap-1 rounded-xl bg-card-2 p-1" role="tablist" aria-label="What to add">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setProblem(null); }} className={cx("flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors", tab === t.id ? "bg-brand text-ink" : "text-muted hover:text-white")}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <Field label="Date"><Input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
              {tab === "meal" ? (
                <>
                  <Field label="Meal">
                    <Select value={meal.mealSlot} onChange={(e) => setMeal((m) => ({ ...m, mealSlot: e.target.value }))}>
                      {SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
                    </Select>
                  </Field>
                  <Field label="What to eat"><Input value={meal.title} maxLength={100} onChange={(e) => setMeal((m) => ({ ...m, title: e.target.value }))} placeholder="e.g. Oats with banana and nuts" /></Field>
                  <Field label="Details (optional)"><Textarea rows={2} maxLength={300} value={meal.details} onChange={(e) => setMeal((m) => ({ ...m, details: e.target.value }))} placeholder="Quantity, how to make it" /></Field>
                  <Field label="Calories (optional)"><Input inputMode="numeric" value={meal.calories} onChange={(e) => setMeal((m) => ({ ...m, calories: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="e.g. 320" /></Field>
                </>
              ) : (
                <>
                  <Field label="Workout title"><Input value={work.title} maxLength={80} onChange={(e) => setWork((w) => ({ ...w, title: e.target.value }))} placeholder="e.g. Upper body" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Minutes"><Input inputMode="numeric" value={work.durationMin} onChange={(e) => setWork((w) => ({ ...w, durationMin: e.target.value.replace(/\D/g, "").slice(0, 3) }))} /></Field>
                    <Field label="Calories"><Input inputMode="numeric" value={work.kcal} onChange={(e) => setWork((w) => ({ ...w, kcal: e.target.value.replace(/\D/g, "").slice(0, 4) }))} /></Field>
                  </div>
                  <Field label="Exercises, sets and reps" hint="A client's workout for the day is replaced by this one.">
                    <Textarea rows={5} maxLength={4000} value={work.instructions} onChange={(e) => setWork((w) => ({ ...w, instructions: e.target.value }))} placeholder={"Warm-up: 5 minutes\nSquats: 3 × 12\nPush-ups: 3 × 10"} />
                  </Field>
                </>
              )}
            </div>
            {problem ? <p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent" role="alert">{problem}</p> : null}
          </section>
        </div>
      )}
    </Drawer>
  );
}
