"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { addDays, todayKey, weekOf } from "@/lib/dates";
import { fmtKg } from "@/lib/body";
import { Alert, Badge, Button, Field, Input, Section, Select, SectionSkeleton, Textarea } from "@/components/ui";

const METRICS = [
  { value: "diet", label: "Follow the meal plan", hint: "Days with 80% of planned meals ticked" },
  { value: "water", label: "Reach the water target", hint: "Counted from water logged" },
  { value: "steps", label: "Reach the step target", hint: "Counted from the phone's steps" },
  { value: "workout", label: "Train", hint: "Days with a workout logged" },
  { value: "meal_log", label: "Log a meal", hint: "Days with a meal logged" },
  { value: "weigh_in", label: "Weigh in", hint: "Days with a weigh-in" },
  { value: "checkin", label: "Do the daily check-in", hint: "Days with a check-in" },
  { value: "custom", label: "Something else (the client ticks it)", hint: "Ticked off by hand in the app" },
];
const METRIC_LABEL = Object.fromEntries(METRICS.map((m) => [m.value, m.label]));
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const short = (key) => dayMonth.format(new Date(`${key}T00:00:00`));
const num = (n, unit) => (n == null ? "Not enough data" : `${n}${unit ? ` ${unit}` : ""}`);
const signed = (n, unit) => (n == null ? "Not enough data" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} ${unit}`);

function Fact({ label, children }) {
  return (
    <div className="rounded-2xl border border-line bg-card-2/60 p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-white">{children}</p>
    </div>
  );
}

/** The actions agreed for one week: add, change or remove them, and see how many were done. */
function ActionsEditor({ memberId, card, today, onSaved }) {
  const [draft, setDraft] = useState(() => card.actions.map((a) => ({ id: a.id, metric: a.metric, title: a.title, targetCount: a.targetCount, done: a.done })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const editable = card.weekStart >= weekOf(today)[0];

  const change = (index, patch) => setDraft((d) => d.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/dietitian/clients/${encodeURIComponent(memberId)}/weekly/actions`, {
        method: "PUT",
        body: { today, weekStart: card.weekStart, actions: draft.map(({ id, metric, title, targetCount }) => (id ? { id, title, targetCount } : { metric, title, targetCount })) },
      });
      onSaved();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {draft.length === 0 ? <p className="text-sm text-muted">No actions agreed for this week.</p> : null}
      {draft.map((a, i) => (
        <div key={a.id ?? i} className="grid gap-3 rounded-2xl border border-line bg-card-2/60 p-4 sm:grid-cols-[1fr_1fr_110px_auto] sm:items-end">
          <Field label="What">
            <Select value={a.metric} disabled={!!a.id || !editable} onChange={(e) => change(i, { metric: e.target.value, title: a.title || METRIC_LABEL[e.target.value] })}>
              {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="What the client sees">
            <Input value={a.title} disabled={!editable} maxLength={100} onChange={(e) => change(i, { title: e.target.value })} />
          </Field>
          <Field label="Times a week">
            <Select value={a.targetCount} disabled={!editable} onChange={(e) => change(i, { targetCount: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
          <div className="flex items-center gap-2 pb-1">
            {a.id ? <Badge tone={a.done >= a.targetCount ? "good" : "neutral"}>{a.done} done</Badge> : null}
            {editable ? <Button variant="secondary" size="sm" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>Remove</Button> : null}
          </div>
        </div>
      ))}
      {error ? <Alert>{error}</Alert> : null}
      {editable ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={draft.length >= 10} onClick={() => setDraft((d) => [...d, { metric: "water", title: METRIC_LABEL.water, targetCount: 5 }])}>+ Add an action</Button>
          <Button size="sm" loading={busy} onClick={save}>Save actions</Button>
        </div>
      ) : (
        <p className="text-xs text-muted">This week is over, so its actions can no longer be changed. You can still write the review.</p>
      )}
    </div>
  );
}

function ReviewForm({ memberId, card, today, onSaved }) {
  const [barriers, setBarriers] = useState(card.review?.barriers ?? "");
  const [feedback, setFeedback] = useState(card.review?.coachFeedback ?? "");
  const [busy, setBusy] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const started = card.weekStart <= weekOf(today)[0];

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFeedbackMsg(null);
    try {
      await api(`/dietitian/clients/${encodeURIComponent(memberId)}/weekly/review`, { method: "PUT", body: { today, weekStart: card.weekStart, barriers, coachFeedback: feedback } });
      setFeedbackMsg({ tone: "good", text: "Saved. The client sees this on their week." });
      onSaved();
    } catch (err) {
      setFeedbackMsg({ tone: "bad", text: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="What got in the way?" hint="Barriers you and the client found this week">
        <Textarea value={barriers} onChange={(e) => setBarriers(e.target.value)} maxLength={600} disabled={!started} />
      </Field>
      <Field label="Feedback for the client" hint="Shown on their week in the app">
        <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={1000} disabled={!started} />
      </Field>
      {feedbackMsg ? <Alert tone={feedbackMsg.tone}>{feedbackMsg.text}</Alert> : null}
      <Button type="submit" size="sm" loading={busy} disabled={!started}>Save review</Button>
    </form>
  );
}

/**
 * One client's week: what was agreed, how it went, and the coach's review. Shows the same result card the
 * client sees. Anything without data is "not enough data", never a zero.
 */
export default function ClientWeekly({ memberId }) {
  const [today] = useState(todayKey);
  const [weekStart, setWeekStart] = useState(() => weekOf(todayKey())[0]);
  const { data, error, reload } = useApi(`/dietitian/clients/${encodeURIComponent(memberId)}/weekly?today=${today}&weekStart=${weekStart}`);
  const card = data?.card;
  const thisWeek = weekOf(today)[0];
  const w = card?.weight;

  return (
    <Section
      id="weekly"
      title="Weekly plan and review"
      description="Agree a few actions for the week, see how it went, and leave feedback. Weeks run Monday to Sunday."
      action={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" aria-label="Earlier week" onClick={() => setWeekStart((s) => addDays(s, -7))}>←</Button>
          <span className="min-w-36 text-center text-sm font-semibold text-white">{short(weekStart)} to {short(addDays(weekStart, 6))}{weekStart === thisWeek ? " (this week)" : ""}</span>
          <Button size="sm" variant="secondary" aria-label="Later week" disabled={weekStart >= addDays(thisWeek, 14)} onClick={() => setWeekStart((s) => addDays(s, 7))}>→</Button>
        </div>
      }
    >
      {error ? <Alert action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>{messageOf(error)}</Alert> : null}
      {!card && !error ? <SectionSkeleton rows={3} label="Loading the week…" /> : null}
      {card ? (
        <div className="space-y-8" key={card.weekStart}>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Fact label="Agreed actions done">{card.agreed.total ? `${card.agreed.completed} of ${card.agreed.total}` : "None agreed"}</Fact>
            <Fact label="Weight (week average)">{w.current == null ? "No weigh-ins" : fmtKg(w.current)}</Fact>
            <Fact label="Change since the start">{signed(w.changeFromBaseline, "kg")}</Fact>
            <Fact label="Waist">{card.waist.current == null ? "No reading" : `${card.waist.current} cm`}</Fact>
          </ul>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-zinc-200">Agreed actions</h3>
            <ActionsEditor key={`${card.weekStart}-${card.actions.map((a) => a.id).join()}`} memberId={memberId} card={card} today={today} onSaved={reload} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Meals ticked">{card.plan.planned ? `${card.plan.done} of ${card.plan.planned}` : "No meal plan"}</Fact>
            <Fact label="Days trained">{card.activity.workoutDays}</Fact>
            <Fact label="Steps a day">{num(card.activity.avgSteps)}</Fact>
            <Fact label="Check-ins">{card.wellbeing.checkins ? `${card.wellbeing.checkins} · sleep ${num(card.wellbeing.sleepHours, "h")}` : "None"}</Fact>
          </div>
          {card.wellbeing.checkins ? (
            <p className="-mt-4 text-xs text-muted">Energy {num(card.wellbeing.energy)} · hunger {num(card.wellbeing.hunger)} · stress {num(card.wellbeing.stress)} (1 to 5, from the client&apos;s own check-ins)</p>
          ) : null}

          <div>
            <h3 className="mb-3 text-sm font-semibold text-zinc-200">Your review of this week</h3>
            <ReviewForm key={`r-${card.weekStart}-${card.review?.reviewedAt ?? "new"}`} memberId={memberId} card={card} today={today} onSaved={reload} />
          </div>
        </div>
      ) : null}
    </Section>
  );
}
