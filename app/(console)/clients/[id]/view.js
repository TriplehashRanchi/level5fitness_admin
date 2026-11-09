"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import {
  ACTIVITY_LABEL, adherencePercent, bmi, bmiBand, DIET_LABEL, fmtKg, goalProgress, goalRemaining,
  GOAL_LABEL, SEX_LABEL, SLOT_LABEL, SLOTS,
} from "@/lib/body";
import { addDays, dayLabel, dayNumber, fmtTime, fullDate, todayKey, weekdayShort, weekOf } from "@/lib/dates";
import WeightChart from "@/components/weight-chart";
import {
  Alert, Avatar, Badge, Button, Card, CardTitle, ConfirmDialog, cx, Field, Input, Modal, PageHeader, PageSpinner, ProgressBar, Select, Textarea,
} from "@/components/ui";

function Fact({ label, children }) {
  return (
    <div className="rounded-2xl bg-card-2 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-white">{children}</p>
    </div>
  );
}

export default function ClientPage() {
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const [today] = useState(todayKey);
  const [day, setDay] = useState(today);
  const week = weekOf(day);

  const detail = useApi(`/dietitian/clients/${encodeURIComponent(id)}`);
  const plan = useApi(`/dietitian/clients/${encodeURIComponent(id)}/plan?day=${day}&weekStart=${week[0]}`);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ mealSlot: "breakfast", title: "", details: "", calories: "" });
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [notice, setNotice] = useState(null);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const openAdd = () => {
    setForm({ mealSlot: "breakfast", title: "", details: "", calories: "" });
    setFormError(null);
    setAdding(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return setFormError("Give the item a title, for example “Oats with fruit”.");
    const calories = form.calories.trim() === "" ? undefined : Number(form.calories);
    if (calories !== undefined && (!Number.isInteger(calories) || calories < 0 || calories > 3000))
      return setFormError("Calories must be a whole number from 0 to 3000.");
    setBusy(true);
    setFormError(null);
    try {
      await api(`/dietitian/clients/${encodeURIComponent(id)}/plan`, {
        method: "POST",
        body: { day, mealSlot: form.mealSlot, title, details: form.details.trim() || undefined, calories },
      });
      setAdding(false);
      setNotice({ tone: "good", text: "Added to the plan." });
      plan.reload();
      detail.reload();
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/dietitian/plan-items/${toDelete.id}`, { method: "DELETE" });
      setToDelete(null);
      setNotice({ tone: "good", text: "Item removed." });
      plan.reload();
      detail.reload();
    } catch (err) {
      setToDelete(null);
      setNotice({ tone: "bad", text: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  const copyPrevious = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const from = addDays(day, -1);
      const res = await api(`/dietitian/clients/${encodeURIComponent(id)}/plan/copy`, { method: "POST", body: { from, to: day } });
      setNotice({ tone: "good", text: `Copied ${res.copied} item${res.copied === 1 ? "" : "s"} from ${dayLabel(from, today).toLowerCase()}.` });
      plan.reload();
      detail.reload();
    } catch (err) {
      setNotice({ tone: "bad", text: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  if (detail.error) {
    return (
      <>
        <Link href="/clients" className="text-sm font-semibold text-brand hover:underline">← Clients</Link>
        <div className="mt-4"><Alert>{detail.error.status === 404 ? "This client was not found, or is not assigned to you." : messageOf(detail.error)}</Alert></div>
      </>
    );
  }
  if (!detail.data) return <PageSpinner />;

  const { client, profile: p, weightHistory, adherence, recentWorkouts } = detail.data;
  const name = client.name || client.email || "Client";
  const progress = goalProgress(p.goal, p.startWeightKg, p.weightKg, p.targetWeightKg);
  const band = bmiBand(bmi(p.weightKg, p.heightCm));
  const items = plan.data?.items ?? [];
  const summary = plan.data?.week ?? [];
  const adherencePct = adherencePercent(adherence.done, adherence.planned);

  return (
    <>
      <Link href="/clients" className="text-sm font-semibold text-brand hover:underline">← Clients</Link>
      <div className="mt-3">
        <PageHeader
          title={name}
          subtitle={client.email}
          actions={<Badge tone="brand">{GOAL_LABEL[p.goal]}</Badge>}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <Avatar name={name} image={client.image} size={56} />
            <div>
              <p className="text-sm text-muted">{p.age} years · {SEX_LABEL[p.sex]} · {parseFloat(p.heightCm.toFixed(1))} cm</p>
              <p className="text-sm font-bold text-brand">{goalRemaining(p.goal, p.weightKg, p.targetWeightKg)}</p>
            </div>
          </div>
          <div className="mt-5 flex items-end justify-between">
            <div><p className="text-xs text-muted">Start</p><p className="text-lg font-black text-white">{fmtKg(p.startWeightKg)}</p></div>
            <div className="text-center"><p className="text-xs text-muted">Now</p><p className="text-3xl font-black text-brand">{fmtKg(p.weightKg)}</p></div>
            <div className="text-right"><p className="text-xs text-muted">Target</p><p className="text-lg font-black text-white">{fmtKg(p.targetWeightKg)}</p></div>
          </div>
          <div className="mt-3"><ProgressBar value={progress * 100} label="Progress to goal" /></div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Fact label="BMI">{bmi(p.weightKg, p.heightCm)} <span className="font-normal text-muted">· {band.label}</span></Fact>
            <Fact label="Food">{DIET_LABEL[p.dietType]}</Fact>
            <Fact label="Activity">{ACTIVITY_LABEL[p.activityLevel]}</Fact>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Fact label="Allergies">{p.allergies || <span className="font-normal text-muted">None added</span>}</Fact>
            <Fact label="Medical notes">{p.medicalNotes || <span className="font-normal text-muted">None added</span>}</Fact>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Plan, last 7 days</CardTitle>
            {adherencePct == null ? (
              <p className="text-sm text-muted">No plan posted yet.</p>
            ) : (
              <>
                <p className="text-3xl font-black text-white">{adherencePct}%</p>
                <p className="mb-3 text-xs text-muted">{adherence.done} of {adherence.planned} items done</p>
                <ProgressBar value={adherencePct} label="Plan completion" />
              </>
            )}
          </Card>
          <Card>
            <CardTitle>Weight</CardTitle>
            <WeightChart history={weightHistory} />
          </Card>
        </div>
      </div>

      {/* Plan editor */}
      <Card className="mt-4">
        <CardTitle
          action={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={copyPrevious} disabled={busy}>Copy previous day</Button>
              <Button size="sm" onClick={openAdd}>+ Add item</Button>
            </div>
          }
        >
          Diet plan
        </CardTitle>

        <div className="mb-5 flex items-center gap-2">
          <Button variant="ghost" size="sm" aria-label="Previous week" onClick={() => setDay(addDays(day, -7))}>‹</Button>
          <div className="grid flex-1 grid-cols-7 gap-1.5">
            {week.map((d) => {
              const info = summary.find((s) => s.day === d);
              const planned = info && info.total > 0;
              const complete = planned && info.done === info.total;
              const selected = d === day;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  aria-pressed={selected}
                  aria-label={`${fullDate(d)}${planned ? `, ${info.done} of ${info.total} done` : ", nothing planned"}`}
                  className={cx("rounded-2xl py-2 text-center transition", selected ? "bg-brand text-ink" : "bg-card-2 text-white hover:bg-white/10")}
                >
                  <span className={cx("block text-[11px] font-semibold", selected ? "text-ink" : "text-muted")}>{weekdayShort(d)}</span>
                  <span className={cx("block text-base font-black", !selected && d === today && "text-brand")}>{dayNumber(d)}</span>
                  <span className="block h-3 text-[10px] leading-3">{complete ? "✓" : planned ? "•" : ""}</span>
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" aria-label="Next week" onClick={() => setDay(addDays(day, 7))}>›</Button>
        </div>

        {notice ? <div className="mb-4"><Alert tone={notice.tone === "good" ? "good" : "bad"}>{notice.text}</Alert></div> : null}
        {plan.error ? <Alert>{messageOf(plan.error)}</Alert> : null}

        <h3 className="mb-3 text-sm font-bold text-zinc-300">{fullDate(day)}</h3>
        {!plan.data && !plan.error ? <PageSpinner /> : null}
        {plan.data && items.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-muted">Nothing planned for this day yet.</p> : null}
        <div className="space-y-5">
          {SLOTS.map((slot) => {
            const slotItems = items.filter((i) => i.mealSlot === slot);
            if (!slotItems.length) return null;
            return (
              <div key={slot}>
                <p className="mb-2 text-xs font-bold uppercase tracking-[2px] text-muted">{SLOT_LABEL[slot]}</p>
                <ul className="space-y-2">
                  {slotItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-4 rounded-2xl bg-card-2 p-4">
                      <span
                        className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black", item.done ? "bg-brand text-ink" : "border-2 border-white/25")}
                        title={item.done ? "Completed by the member" : "Not completed yet"}
                        role="img"
                        aria-label={item.done ? "Completed by the member" : "Not completed yet"}
                      >
                        {item.done ? "✓" : ""}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white">{item.title}</p>
                        {item.details ? <p className="text-sm text-muted">{item.details}</p> : null}
                        {item.done && item.completedAt ? <p className="text-xs text-brand">Done at {fmtTime(item.completedAt)}</p> : null}
                      </div>
                      {item.calories != null ? <Badge tone="brand">{item.calories} kcal</Badge> : null}
                      <Button variant="ghost" size="sm" onClick={() => setToDelete(item)} aria-label={`Remove ${item.title}`}>Remove</Button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent workouts */}
      <Card className="mt-4">
        <CardTitle>Recent workouts</CardTitle>
        {recentWorkouts.length === 0 ? (
          <p className="text-sm text-muted">No workouts logged yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recentWorkouts.map((d) => (
              <li key={d.day} className="py-3">
                <p className="text-sm font-bold text-brand">{dayLabel(d.day, today)} <span className="font-normal text-muted">· {d.totalMinutes} min · {d.totalCalories} kcal</span></p>
                <ul className="mt-1 text-sm text-zinc-300">
                  {d.workouts.map((w) => (
                    <li key={w.id}>{w.title} · {w.durationMin} min · {fmtTime(w.startedAt)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={`Add to ${dayLabel(day, today).toLowerCase()}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" form="add-item" loading={busy}>Add to plan</Button>
          </>
        }
      >
        <form id="add-item" onSubmit={save} className="space-y-4">
          {formError ? <Alert>{formError}</Alert> : null}
          <Field label="Meal">
            <Select value={form.mealSlot} onChange={(e) => set("mealSlot", e.target.value)}>
              {SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
            </Select>
          </Field>
          <Field label="What to eat">
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={100} placeholder="e.g. Oats with fruit" autoFocus />
          </Field>
          <Field label="Details (optional)" hint="Quantity, how to cook, notes">
            <Textarea value={form.details} onChange={(e) => set("details", e.target.value)} maxLength={300} />
          </Field>
          <Field label="Calories (optional)">
            <Input inputMode="numeric" value={form.calories} onChange={(e) => set("calories", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="e.g. 320" />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Remove this item?"
        message={toDelete ? `“${toDelete.title}” will be removed from the plan. If the member already ticked it, that tick is removed too.` : ""}
        confirmLabel="Remove"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
