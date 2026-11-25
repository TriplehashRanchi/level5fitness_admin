"use client";

import { useMemo, useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { WEEKDAYS, WEEK_ORDER } from "@/lib/dates";
import AdminOnly from "@/components/admin-only";
import { ListTable, TwoLine } from "@/components/table";
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
  const [query, setQuery] = useState("");
  const [show, setShow] = useState("all"); // all | live | off
  const [category, setCategory] = useState("");

  const liveCount = workouts.filter((w) => w.isActive).length;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workouts.filter(
      (w) =>
        (show === "all" || (show === "live") === w.isActive) &&
        (!category || w.categorySlug === category) &&
        (!q || [w.title, w.focus, w.coach, w.categoryName].filter(Boolean).join(" ").toLowerCase().includes(q))
    );
  }, [workouts, query, show, category]);
  const columns = [
    { key: "title", header: "Workout", sort: (w) => w.title, cell: (w) => <TwoLine main={w.title} note={[w.focus, w.coach].filter(Boolean).join(" · ") || null} /> },
    { key: "category", header: "Category", nowrap: true, sort: (w) => w.categoryName, cell: (w) => w.categoryName },
    { key: "level", header: "Level", nowrap: true, sort: (w) => ({ beginner: 0, intermediate: 1, advanced: 2, all: 3 })[w.level], cell: (w) => LEVEL_LABEL[w.level] },
    { key: "time", header: "Time", nowrap: true, sort: (w) => w.durationMin, cell: (w) => <TwoLine main={`${w.durationMin} min`} note={`${w.kcalEstimate} kcal`} /> },
    {
      key: "status", header: "Status", sort: (w) => (w.isActive ? 0 : 1),
      cell: (w) => (
        <div className="flex flex-wrap gap-1">
          {w.isActive ? <Badge tone="good">Live</Badge> : <Badge tone="neutral">Off</Badge>}
          {w.isProgram ? <Badge tone="brand">Program</Badge> : null}
        </div>
      ),
    },
    {
      key: "actions", header: "Actions", hidden: true, align: "right",
      cell: (w) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => open(w)}>Edit</Button>
          <Button variant="ghost" size="sm" className="w-24" onClick={() => toggle(w)}>{w.isActive ? "Switch off" : "Switch on"}</Button>
        </div>
      ),
    },
  ];

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
      {workouts.length === 0 ? (
        <EmptyState title="No workouts yet" action={<Button onClick={() => open("new")}>+ New workout</Button>}>Add the first workout for members to see.</EmptyState>
      ) : (
        <ListTable
          label="Workouts"
          minWidth={860}
          rows={shown}
          rowKey={(w) => w.id}
          columns={columns}
          defaultSort="status"
          dim={(w) => !w.isActive}
          search={{ value: query, onChange: setQuery, placeholder: "Search workouts" }}
          filters={{ options: [{ id: "all", label: "All", count: workouts.length }, { id: "live", label: "Live", count: liveCount }, { id: "off", label: "Off", count: workouts.length - liveCount }], value: show, onChange: setShow }}
          toolbar={
            <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="!w-auto !rounded-xl !py-2">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </Select>
          }
          action={<Button onClick={() => open("new")}>+ New workout</Button>}
          noun="workout"
          total={workouts.length}
          empty={{ title: "No workouts in this view", action: <Button variant="secondary" size="sm" onClick={() => { setQuery(""); setShow("all"); setCategory(""); }}>Show all workouts</Button> }}
        />
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
            <input type="checkbox" checked={form.isProgram} onChange={(e) => set("isProgram", e.target.checked)} className="h-4 w-4 accent-[#3ddc68]" />
            Show under “Programs” on Home
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-200">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-[#3ddc68]" />
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
      <ListTable
        label="Categories"
        minWidth={320}
        rows={catalog.categories}
        rowKey={(c) => c.slug}
        columns={[
          { key: "name", header: "Category", sort: (c) => c.name, cell: (c) => <span className="font-semibold text-white">{c.name}</span> },
          { key: "workouts", header: "Workouts", align: "right", sort: (c) => counts[c.slug] ?? 0, cell: (c) => <span className="tabular-nums">{counts[c.slug] ?? 0}</span> },
        ]}
        noun="category"
        plural="categories"
        empty={{ title: "No categories yet", text: "Add the first one above." }}
      />
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
