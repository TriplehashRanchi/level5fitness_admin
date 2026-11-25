"use client";

import { useMemo, useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { WEEKDAYS, WEEK_ORDER } from "@/lib/dates";
import AdminOnly from "@/components/admin-only";
import { ListTable, TwoLine } from "@/components/table";
import { Alert, Badge, Button, cx, EmptyState, Field, Input, Modal, PageHeader, PageSpinner, Select } from "@/components/ui";

const BLANK = { name: "", trainer: "", icon: "bolt", weekdays: [1, 2, 3, 4, 5], startTime: "06:30", durationMin: "45", capacity: "20", isActive: true };

const toForm = (c) => ({
  name: c.name, trainer: c.trainer, icon: c.icon, weekdays: c.weekdays, startTime: c.startTime,
  durationMin: String(c.durationMin), capacity: String(c.capacity), isActive: c.isActive,
});

/** "Mon–Fri", "Every day", or a list. */
function daysText(days) {
  if (days.length === 7) return "Every day";
  const order = WEEK_ORDER.filter((d) => days.includes(d));
  const joined = order.map((d) => WEEKDAYS[d].slice(0, 3));
  const isRun = order.length > 2 && order.every((d, i) => i === 0 || WEEK_ORDER.indexOf(d) === WEEK_ORDER.indexOf(order[i - 1]) + 1);
  return isRun ? `${joined[0]}–${joined[joined.length - 1]}` : joined.join(", ");
}

function Classes() {
  const { data, error, reload } = useApi("/admin/classes");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState("all"); // all | live | off

  const liveCount = data ? data.classes.filter((c) => c.isActive).length : 0;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.classes ?? []).filter(
      (c) => (show === "all" || (show === "live") === c.isActive) && (!q || `${c.name} ${c.trainer ?? ""}`.toLowerCase().includes(q))
    );
  }, [data, query, show]);
  const columns = [
    { key: "name", header: "Class", sort: (c) => c.name, cell: (c) => <TwoLine main={c.name} note={c.trainer} /> },
    { key: "days", header: "Days", nowrap: true, sort: (c) => c.weekdays.length, cell: (c) => daysText(c.weekdays) },
    { key: "time", header: "Time", nowrap: true, sort: (c) => c.startTime, cell: (c) => <TwoLine main={c.startTime} note={`${c.durationMin} min`} /> },
    { key: "places", header: "Places", align: "right", sort: (c) => c.capacity, cell: (c) => <span className="tabular-nums">{c.capacity}</span> },
    { key: "status", header: "Status", sort: (c) => (c.isActive ? 0 : 1), cell: (c) => (c.isActive ? <Badge tone="good">Live</Badge> : <Badge tone="neutral">Off</Badge>) },
    {
      key: "actions", header: "Actions", hidden: true, align: "right",
      cell: (c) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => open(c)}>Edit</Button>
          <Button variant="ghost" size="sm" className="w-24" onClick={() => toggle(c)}>{c.isActive ? "Switch off" : "Switch on"}</Button>
        </div>
      ),
    },
  ];

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const open = (c) => {
    setForm(c === "new" ? BLANK : toForm(c));
    setFormError(null);
    setEditing(c);
  };
  const toggleDay = (d) => set("weekdays", form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d]);

  const body = () => ({
    name: form.name.trim(), trainer: form.trainer.trim(), icon: form.icon, weekdays: form.weekdays,
    startTime: form.startTime, durationMin: Number(form.durationMin), capacity: Number(form.capacity), isActive: form.isActive,
  });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      if (editing === "new") await api("/admin/classes", { method: "POST", body: body() });
      else await api(`/admin/classes/${editing.id}`, { method: "PUT", body: body() });
      setNotice({ tone: "good", text: editing === "new" ? "Class added to the timetable." : "Class saved." });
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c) => {
    try {
      await api(`/admin/classes/${c.id}`, { method: "PUT", body: { ...toForm(c), durationMin: c.durationMin, capacity: c.capacity, isActive: !c.isActive } });
      setNotice({ tone: "good", text: c.isActive ? `${c.name} is switched off. It no longer appears for members.` : `${c.name} is back on the timetable.` });
      reload();
    } catch (err) {
      setNotice({ tone: "bad", text: messageOf(err) });
    }
  };

  return (
    <>
      <PageHeader title="Classes" subtitle="The weekly timetable. Times are the gym’s local time. Members book a place for each date." />
      {notice ? <div className="mb-4"><Alert tone={notice.tone === "good" ? "good" : "bad"}>{notice.text}</Alert></div> : null}
      {error ? <Alert>{messageOf(error)}</Alert> : null}
      {!data && !error ? <PageSpinner /> : null}
      {data && data.classes.length === 0 ? <EmptyState title="No classes yet" action={<Button onClick={() => open("new")}>+ New class</Button>}>Add the first class to the timetable.</EmptyState> : null}
      {data && data.classes.length > 0 ? (
        <ListTable
          label="Classes"
          minWidth={820}
          rows={shown}
          rowKey={(c) => c.id}
          columns={columns}
          defaultSort="time"
          dim={(c) => !c.isActive}
          search={{ value: query, onChange: setQuery, placeholder: "Search by class or trainer", label: "Search classes" }}
          filters={{ options: [{ id: "all", label: "All", count: data.classes.length }, { id: "live", label: "Live", count: liveCount }, { id: "off", label: "Off", count: data.classes.length - liveCount }], value: show, onChange: setShow }}
          action={<Button onClick={() => open("new")}>+ New class</Button>}
          noun="class"
          plural="classes"
          total={data.classes.length}
          empty={{ title: "No classes in this view", action: <Button variant="secondary" size="sm" onClick={() => { setQuery(""); setShow("all"); }}>Show all classes</Button> }}
        />
      ) : null}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New class" : "Edit class"}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" form="class-form" loading={busy}>Save</Button>
          </>
        }
      >
        <form id="class-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {formError ? <div className="sm:col-span-2"><Alert>{formError}</Alert></div> : null}
          <Field label="Class name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={60} required autoFocus /></Field>
          <Field label="Trainer"><Input value={form.trainer} onChange={(e) => set("trainer", e.target.value)} maxLength={60} required /></Field>
          <Field label="Start time"><Input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} required /></Field>
          <Field label="Duration (minutes)"><Input type="number" min={5} max={300} value={form.durationMin} onChange={(e) => set("durationMin", e.target.value)} required /></Field>
          <Field label="Places"><Input type="number" min={1} max={500} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} required /></Field>
          <Field label="Icon">
            <Select value={form.icon} onChange={(e) => set("icon", e.target.value)}>
              {data?.icons.map((i) => <option key={i} value={i}>{i}</option>)}
            </Select>
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold text-zinc-200">Runs on</legend>
            <div className="flex flex-wrap gap-2">
              {WEEK_ORDER.map((d) => (
                <button key={d} type="button" aria-pressed={form.weekdays.includes(d)} onClick={() => toggleDay(d)}
                  className={cx("rounded-full px-4 py-1.5 text-sm font-semibold transition", form.weekdays.includes(d) ? "bg-brand text-ink" : "bg-card-2 text-muted hover:text-white")}>
                  {WEEKDAYS[d].slice(0, 3)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-3 text-sm text-zinc-200 sm:col-span-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-[#3ddc68]" />
            Visible to members
          </label>
        </form>
      </Modal>
    </>
  );
}

export default function ClassesPage() {
  return (
    <AdminOnly>
      <Classes />
    </AdminOnly>
  );
}
