"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { WEEKDAYS, WEEK_ORDER } from "@/lib/dates";
import AdminOnly from "@/components/admin-only";
import { Alert, Badge, Button, Card, CardTitle, cx, EmptyState, Field, Input, Modal, PageHeader, PageSpinner, Select } from "@/components/ui";

const LEVEL_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", all: "All levels" };
const BLANK = { title: "", categorySlug: "", level: "beginner", durationMin: "30", kcalEstimate: "250", exerciseCount: "", focus: "", coach: "", icon: "dumbbell", isProgram: false, isActive: true };

const toForm = (w) => ({
  title: w.title, categorySlug: w.categorySlug, level: w.level, durationMin: String(w.durationMin), kcalEstimate: String(w.kcalEstimate),
  exerciseCount: w.exerciseCount == null ? "" : String(w.exerciseCount), focus: w.focus ?? "", coach: w.coach ?? "", icon: w.icon,
  isProgram: w.isProgram, isActive: w.isActive,
});

function WorkoutsTab({ catalog, reload, say }) {
  const { workouts, categories, levels, icons } = catalog;
  const [editing, setEditing] = useState(null); // null | 'new' | workout
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const open = (w) => {
    setForm(w === "new" ? { ...BLANK, categorySlug: categories[0]?.slug ?? "" } : toForm(w));
    setError(null);
    setEditing(w);
  };

  const body = () => ({
    title: form.title.trim(), categorySlug: form.categorySlug, level: form.level,
    durationMin: Number(form.durationMin), kcalEstimate: Number(form.kcalEstimate),
    exerciseCount: form.exerciseCount === "" ? null : Number(form.exerciseCount),
    focus: form.focus.trim() || null, coach: form.coach.trim() || null, icon: form.icon,
    isProgram: form.isProgram, isActive: form.isActive,
  });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (editing === "new") await api("/admin/workouts", { method: "POST", body: body() });
      else await api(`/admin/workouts/${editing.id}`, { method: "PUT", body: body() });
      say("good", editing === "new" ? "Workout added." : "Workout saved.");
      setEditing(null);
      reload();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (w) => {
    try {
      await api(`/admin/workouts/${w.id}`, { method: "PUT", body: { ...toForm(w), durationMin: w.durationMin, kcalEstimate: w.kcalEstimate, exerciseCount: w.exerciseCount, focus: w.focus, coach: w.coach, isActive: !w.isActive } });
      say("good", w.isActive ? `${w.title} is switched off. Members no longer see it.` : `${w.title} is back for members.`);
      reload();
    } catch (err) {
      say("bad", messageOf(err));
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => open("new")}>+ New workout</Button></div>
      {workouts.length === 0 ? (
        <EmptyState title="No workouts yet">Add the first workout for members to see.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Workout</th>
                <th className="px-5 py-3 font-semibold">Category</th>
                <th className="px-5 py-3 font-semibold">Level</th>
                <th className="px-5 py-3 font-semibold">Time</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {workouts.map((w) => (
                <tr key={w.id} className={cx(!w.isActive && "opacity-60")}>
                  <td className="px-5 py-3">
                    <p className="font-bold text-white">{w.title}</p>
                    <p className="text-xs text-muted">{[w.focus, w.coach].filter(Boolean).join(" · ") || "–"}</p>
                  </td>
                  <td className="px-5 py-3 text-zinc-300">{w.categoryName}</td>
                  <td className="px-5 py-3 text-zinc-300">{LEVEL_LABEL[w.level]}</td>
                  <td className="px-5 py-3 text-zinc-300">{w.durationMin} min<span className="block text-xs text-muted">{w.kcalEstimate} kcal</span></td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {w.isActive ? <Badge tone="good">Live</Badge> : <Badge tone="neutral">Off</Badge>}
                      {w.isProgram ? <Badge tone="brand">Program</Badge> : null}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => open(w)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => toggle(w)}>{w.isActive ? "Switch off" : "Switch on"}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New workout" : "Edit workout"}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" form="workout-form" loading={busy}>Save</Button>
          </>
        }
      >
        <form id="workout-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {error ? <div className="sm:col-span-2"><Alert>{error}</Alert></div> : null}
          <div className="sm:col-span-2">
            <Field label="Title"><Input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={80} required autoFocus /></Field>
          </div>
          <Field label="Category">
            <Select value={form.categorySlug} onChange={(e) => set("categorySlug", e.target.value)} required>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Level">
            <Select value={form.level} onChange={(e) => set("level", e.target.value)}>
              {levels.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            </Select>
          </Field>
          <Field label="Duration (minutes)"><Input type="number" min={1} max={600} value={form.durationMin} onChange={(e) => set("durationMin", e.target.value)} required /></Field>
          <Field label="Calories (whole workout)"><Input type="number" min={0} max={5000} value={form.kcalEstimate} onChange={(e) => set("kcalEstimate", e.target.value)} required /></Field>
          <Field label="Number of exercises (optional)"><Input type="number" min={1} max={100} value={form.exerciseCount} onChange={(e) => set("exerciseCount", e.target.value)} /></Field>
          <Field label="Icon">
            <Select value={form.icon} onChange={(e) => set("icon", e.target.value)}>
              {icons.map((i) => <option key={i} value={i}>{i}</option>)}
            </Select>
          </Field>
          <Field label="Focus (optional)" hint="e.g. Chest, Triceps"><Input value={form.focus} onChange={(e) => set("focus", e.target.value)} maxLength={80} /></Field>
          <Field label="Coach (optional)"><Input value={form.coach} onChange={(e) => set("coach", e.target.value)} maxLength={60} /></Field>
          <label className="flex items-center gap-3 text-sm text-zinc-200">
            <input type="checkbox" checked={form.isProgram} onChange={(e) => set("isProgram", e.target.checked)} className="h-4 w-4 accent-[#c6f432]" />
            Show under “Programs” on Home
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-200">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-[#c6f432]" />
            Visible to members
          </label>
        </form>
      </Modal>
    </>
  );
}

function PlanTab({ workouts, say }) {
  const plan = useApi("/admin/plan");
  const [saving, setSaving] = useState(null);
  const active = workouts.filter((w) => w.isActive);

  const choose = async (weekday, workoutId) => {
    setSaving(weekday);
    try {
      await api(`/admin/plan/${weekday}`, { method: "PUT", body: { workoutId } });
      say("good", `${WEEKDAYS[weekday]}’s workout updated.`);
    } catch (err) {
      say("bad", messageOf(err));
    } finally {
      setSaving(null);
      plan.reload();
    }
  };

  if (plan.error) return <Alert>{messageOf(plan.error)}</Alert>;
  if (!plan.data) return <PageSpinner />;
  const byDay = Object.fromEntries(plan.data.plan.map((p) => [p.weekday, p]));
  return (
    <Card>
      <CardTitle>Workout of the day</CardTitle>
      <p className="mb-5 text-sm text-muted">The big card on every member’s Home screen shows the workout chosen for that weekday.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {WEEK_ORDER.map((d) => (
          <Field key={d} label={WEEKDAYS[d]}>
            <Select value={byDay[d]?.workoutId ?? ""} disabled={saving === d} onChange={(e) => choose(d, e.target.value)}>
              {!byDay[d]?.workoutId ? <option value="">Choose a workout…</option> : null}
              {active.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
            </Select>
          </Field>
        ))}
      </div>
    </Card>
  );
}

function CategoriesTab({ catalog, reload, say }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const counts = {};
  for (const w of catalog.workouts) counts[w.categorySlug] = (counts[w.categorySlug] ?? 0) + 1;

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/admin/categories", { method: "POST", body: { name: name.trim() } });
      say("good", `Category “${name.trim()}” added.`);
      setName("");
      reload();
    } catch (err) {
      say("bad", messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle>Categories</CardTitle>
      <form onSubmit={add} className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1"><Field label="New category"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pilates" maxLength={40} /></Field></div>
        <Button type="submit" loading={busy} className="mb-[22px]">Add</Button>
      </form>
      <ul className="divide-y divide-line">
        {catalog.categories.map((c) => (
          <li key={c.slug} className="flex items-center justify-between py-3 text-sm">
            <span className="font-semibold text-white">{c.name}</span>
            <span className="text-muted">{counts[c.slug] ?? 0} workout{(counts[c.slug] ?? 0) === 1 ? "" : "s"}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const TABS = [
  { id: "workouts", label: "Workouts" },
  { id: "plan", label: "Weekly plan" },
  { id: "categories", label: "Categories" },
];

function Workouts() {
  const catalog = useApi("/admin/workouts");
  const [tab, setTab] = useState("workouts");
  const [notice, setNotice] = useState(null);
  const say = (tone, text) => setNotice({ tone, text });

  return (
    <>
      <PageHeader title="Workouts" subtitle="The workouts members can browse and start in the app." />
      <div className="mb-5 flex gap-1 self-start rounded-full bg-card p-1" role="tablist" aria-label="Sections" style={{ width: "fit-content" }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cx("rounded-full px-4 py-1.5 text-sm font-semibold transition", tab === t.id ? "bg-brand text-ink" : "text-muted hover:text-white")}>
            {t.label}
          </button>
        ))}
      </div>
      {notice ? <div className="mb-4"><Alert tone={notice.tone === "good" ? "good" : "bad"}>{notice.text}</Alert></div> : null}
      {catalog.error ? <Alert>{messageOf(catalog.error)}</Alert> : null}
      {!catalog.data && !catalog.error ? <PageSpinner /> : null}
      {catalog.data && tab === "workouts" ? <WorkoutsTab catalog={catalog.data} reload={catalog.reload} say={say} /> : null}
      {catalog.data && tab === "plan" ? <PlanTab workouts={catalog.data.workouts} say={say} /> : null}
      {catalog.data && tab === "categories" ? <CategoriesTab catalog={catalog.data} reload={catalog.reload} say={say} /> : null}
    </>
  );
}

export default function WorkoutsPage() {
  return (
    <AdminOnly>
      <Workouts />
    </AdminOnly>
  );
}
