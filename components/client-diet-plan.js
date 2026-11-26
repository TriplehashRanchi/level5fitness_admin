"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { SLOT_LABEL, SLOTS } from "@/lib/body";
import { addDays, dayLabel, dayNumber, fmtTime, fullDate, weekdayShort } from "@/lib/dates";
import FoodHelper from "@/components/food-helper";
import { Alert, Badge, Button, ConfirmDialog, cx, Empty, Field, Input, Modal, SectionError, SectionSkeleton, Select, Textarea } from "@/components/ui";

/** Week strip used by both the diet plan and the exercise plan to pick the day. */
export function DayStrip({ day, setDay, week, today, summary = [] }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" aria-label="Previous week" onClick={() => setDay(addDays(day, -7))}>‹</Button>
      <div className="grid flex-1 grid-cols-7 gap-1 sm:gap-1.5">
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
              aria-label={`${fullDate(d)}${summary.length ? (planned ? `, ${info.done} of ${info.total} done` : ", nothing planned") : ""}`}
              className={cx("rounded-2xl py-2 text-center transition-colors", selected ? "bg-brand text-ink" : "bg-card-2 text-white hover:bg-white/10")}
            >
              <span className={cx("block text-[11px] font-semibold", selected ? "text-ink" : "text-muted")}>{weekdayShort(d)}</span>
              <span className={cx("block text-base font-bold tabular-nums", !selected && d === today && "text-brand")}>{dayNumber(d)}</span>
              <span className="block h-3 text-[10px] leading-3" aria-hidden="true">{summary.length ? (complete ? "✓" : planned ? "•" : "") : ""}</span>
            </button>
          );
        })}
      </div>
      <Button variant="ghost" size="sm" aria-label="Next week" onClick={() => setDay(addDays(day, 7))}>›</Button>
    </div>
  );
}

const EMPTY_FORM = { mealSlot: "breakfast", title: "", details: "", calories: "" };

/** The diet plan editor for one day: list by meal, add, remove, copy the previous day. */
export default function ClientDietPlan({ id, day, today, plan, onChanged, language }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [notice, setNotice] = useState(null);
  const items = plan.data?.items ?? [];
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setAdding(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
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
      setNotice({ tone: "good", text: "Added to the plan. The client sees it in the app." });
      onChanged();
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api(`/dietitian/plan-items/${toDelete.id}`, { method: "DELETE" });
      setToDelete(null);
      setNotice({ tone: "good", text: "Item removed." });
      onChanged();
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
      const n = res?.copied ?? 0;
      setNotice({ tone: "good", text: `Copied ${n} item${n === 1 ? "" : "s"} from ${dayLabel(from, today).toLowerCase()}.` });
      onChanged();
    } catch (err) {
      setNotice({ tone: "bad", text: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-200">{fullDate(day)}{day === today ? <span className="ml-2"><Badge tone="brand">Today</Badge></span> : null}</h3>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={copyPrevious} loading={busy && !adding && !toDelete} disabled={busy}>Copy previous day</Button>
          <Button size="sm" onClick={openAdd} disabled={busy}>+ Add item</Button>
        </div>
      </div>

      {notice ? <div className="mb-4" aria-live="polite"><Alert tone={notice.tone === "good" ? "good" : "bad"}>{notice.text}</Alert></div> : null}
      {plan.error ? <SectionError onRetry={plan.reload}>{messageOf(plan.error)}</SectionError> : null}
      {!plan.data && !plan.error ? <SectionSkeleton rows={3} label="Loading the diet plan…" /> : null}
      {plan.data && items.length === 0 ? (
        <Empty title="Nothing planned for this day yet">Use “+ Add item” to add a meal, or “Copy previous day” to reuse yesterday’s plan.</Empty>
      ) : null}

      <div className="space-y-5">
        {SLOTS.map((slot) => {
          const slotItems = items.filter((i) => i.mealSlot === slot);
          if (!slotItems.length) return null;
          return (
            <div key={slot}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[2px] text-muted">{SLOT_LABEL[slot]}</p>
              <ul className="space-y-2">
                {slotItems.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-card-2 p-4 sm:flex-nowrap">
                    <span
                      className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black", item.done ? "bg-brand text-ink" : "border-2 border-white/25")}
                      role="img"
                      aria-label={item.done ? "Completed by the member" : "Not completed yet"}
                      title={item.done ? "Completed by the member" : "Not completed yet"}
                    >
                      {item.done ? "✓" : ""}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">{item.title}</p>
                      {item.details ? <p className="text-sm text-muted">{item.details}</p> : null}
                      {item.done && item.completedAt ? <p className="text-xs text-brand">Done at {fmtTime(item.completedAt)}</p> : null}
                    </div>
                    {item.calories != null ? <Badge tone="brand">{item.calories} kcal</Badge> : null}
                    <Button variant="ghost" size="sm" onClick={() => setToDelete(item)} disabled={busy} aria-label={`Remove ${item.title}`}>Remove</Button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

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
          <FoodHelper preferred={language} onPick={(p) => setForm((f) => ({ ...f, ...p }))} />
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
