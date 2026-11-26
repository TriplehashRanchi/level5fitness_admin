"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import AdminOnly from "@/components/admin-only";
import { ListTable } from "@/components/table";
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, PageSpinner, Select, Switch, Textarea } from "@/components/ui";

const REGION = { kerala: "Kerala", gulf: "Gulf", tamil_nadu: "Tamil Nadu", karnataka: "Karnataka", andhra_telangana: "Andhra Pradesh and Telangana", general: "Everyone" };
const day = (d) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00`));
const todayKey = () => new Date().toISOString().slice(0, 10);
const VIEWS = [{ id: "groups", label: "Groups" }, { id: "missions", label: "Fitathon missions" }];

/** The people in a group, under the names they chose. A name that is not fit to show can be removed. */
function People({ cohort, onChanged }) {
  const { data, error, reload } = useApi(`/admin/cohorts/${cohort.id}/people`);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);
  const remove = async (p) => {
    setBusy(p.memberId);
    setProblem(null);
    try {
      await api(`/admin/cohorts/${cohort.id}/people/${encodeURIComponent(p.memberId)}`, { method: "DELETE" });
      reload();
      onChanged();
    } catch (e) {
      setProblem(messageOf(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-zinc-200">People in this group</h3>
      {error ? <Alert>{messageOf(error)}</Alert> : null}
      {problem ? <Alert>{problem}</Alert> : null}
      {data && data.people.length === 0 ? <p className="text-sm text-muted">Nobody has joined yet.</p> : null}
      <ul className="divide-y divide-line">
        {(data?.people ?? []).map((p) => (
          <li key={p.memberId} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="font-medium text-white">{p.displayName}</span>
            <span className="min-w-0 flex-1 truncate text-muted">{p.name}</span>
            <Button size="sm" variant="secondary" loading={busy === p.memberId} onClick={() => remove(p)}>Remove</Button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Members see only the name they chose. Their real name is shown here so you can tell who to remove.</p>
    </div>
  );
}

function Groups() {
  const { data, error, reload } = useApi("/admin/cohorts");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (patch) => setEditing((c) => ({ ...c, ...patch }));
  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await api(editing.id ? `/admin/cohorts/${editing.id}` : "/admin/cohorts", { method: editing.id ? "PUT" : "POST", body: { name: editing.name, region: editing.region, description: editing.description, active: editing.active } });
      setEditing(null);
      reload();
    } catch (e) {
      setProblem(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const columns = [
    { key: "name", header: "Group", sort: (c) => c.name, cell: (c) => <div><p className="font-medium text-white">{c.name}</p>{c.description ? <p className="max-w-xs truncate text-xs text-muted">{c.description}</p> : null}</div> },
    { key: "region", header: "Region", nowrap: true, sort: (c) => REGION[c.region], cell: (c) => REGION[c.region] },
    { key: "members", header: "People", nowrap: true, sort: (c) => c.members, cell: (c) => c.members },
    { key: "active", header: "Status", nowrap: true, cell: (c) => (c.active ? <Badge tone="good">Open</Badge> : <Badge tone="neutral">Closed</Badge>) },
  ];
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm leading-6 text-muted">Members choose to join one group near them, and are shown to it only by a name they pick, with a count of what they did. No weight, health details or photos are ever shown.</p>
      {error ? <div className="mb-4"><Alert>{messageOf(error)}</Alert></div> : null}
      {!data && !error ? <PageSpinner /> : null}
      {data ? (
        <ListTable
          label="Groups" minWidth={620} rows={data.cohorts} rowKey={(c) => c.id} columns={columns} defaultSort="name" noun="group"
          onOpen={(c) => { setProblem(null); setEditing({ ...c, description: c.description ?? "" }); }}
          action={<Button onClick={() => { setProblem(null); setEditing({ name: "", region: "kerala", description: "", active: true }); }}>+ New group</Button>}
          empty={{ title: "No groups yet", text: "Make one group for each region you serve, for example Kerala or the Gulf." }}
        />
      ) : null}
      <Modal open={!!editing} onClose={() => setEditing(null)} wide title={editing?.id ? "Edit group" : "New group"} footer={<><Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>Close</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {editing ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><Input value={editing.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} /></Field>
              <Field label="Region"><Select value={editing.region} onChange={(e) => set({ region: e.target.value })}>{Object.entries(REGION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            </div>
            <Field label="About this group"><Textarea value={editing.description} maxLength={300} onChange={(e) => set({ description: e.target.value })} /></Field>
            <Switch checked={editing.active} onChange={(v) => set({ active: v })} label="Open for new members" />
            {problem ? <Alert>{problem}</Alert> : null}
            {editing.id ? <People cohort={editing} onChanged={reload} /> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function Missions() {
  const { data, error, reload } = useApi("/admin/missions");
  const groups = useApi("/admin/cohorts");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (patch) => setEditing((m) => ({ ...m, ...patch }));
  const blank = () => ({ title: "", description: "", metric: "steps", goal: "50000", startsOn: todayKey(), endsOn: todayKey(), cohortId: "", active: true });
  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await api(editing.id ? `/admin/missions/${editing.id}` : "/admin/missions", {
        method: editing.id ? "PUT" : "POST",
        body: { title: editing.title, description: editing.description, metric: editing.metric, goal: Number(editing.goal), startsOn: editing.startsOn, endsOn: editing.endsOn, cohortId: editing.cohortId || null, active: editing.active },
      });
      setEditing(null);
      reload();
    } catch (e) {
      setProblem(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const columns = [
    { key: "title", header: "Mission", sort: (m) => m.title, cell: (m) => <div><p className="font-medium text-white">{m.title}</p><p className="text-xs text-muted">{m.metricLabel}: {m.goal.toLocaleString("en-IN")} {m.unit}</p></div> },
    { key: "group", header: "For", nowrap: true, sort: (m) => m.cohortName ?? "", cell: (m) => m.cohortName ?? "Every group" },
    { key: "dates", header: "Dates", nowrap: true, sort: (m) => m.endsOn, cell: (m) => `${day(m.startsOn)} to ${day(m.endsOn)}` },
    { key: "joined", header: "Joined", nowrap: true, sort: (m) => m.joined, cell: (m) => m.joined },
    { key: "state", header: "Status", nowrap: true, cell: (m) => (!m.active ? <Badge tone="neutral">Off</Badge> : m.ended ? <Badge tone="neutral">Finished</Badge> : m.upcoming ? <Badge tone="warn">Starts soon</Badge> : <Badge tone="good">Running</Badge>) },
  ];
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm leading-6 text-muted">A mission counts what people do (steps, days trained, days of water, meals logged, check-ins), never weight. Members join one on their own, and anyone whose plan is paused for health is simply not ranked.</p>
      {error ? <div className="mb-4"><Alert>{messageOf(error)}</Alert></div> : null}
      {!data && !error ? <PageSpinner /> : null}
      {data ? (
        <ListTable
          label="Missions" minWidth={820} rows={data.missions} rowKey={(m) => m.id} columns={columns} defaultSort="dates" noun="mission"
          onOpen={(m) => { setProblem(null); setEditing({ ...m, goal: String(m.goal), description: m.description ?? "", cohortId: m.cohortId ?? "" }); }}
          action={<Button onClick={() => { setProblem(null); setEditing(blank()); }}>+ New mission</Button>}
          empty={{ title: "No missions yet", text: "Start a Fitathon mission, for example 50,000 steps in a week." }}
        />
      ) : null}
      <Modal open={!!editing} onClose={() => setEditing(null)} wide title={editing?.id ? "Edit mission" : "New mission"} footer={<><Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {editing ? (
          <div className="space-y-4">
            <Field label="Title"><Input value={editing.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What it counts">
                <Select value={editing.metric} onChange={(e) => set({ metric: e.target.value })}>
                  {Object.entries(data?.metrics ?? {}).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Goal for each person" hint="In the units of what it counts"><Input inputMode="numeric" value={editing.goal} onChange={(e) => set({ goal: e.target.value })} /></Field>
              <Field label="Starts"><Input type="date" value={editing.startsOn} onChange={(e) => set({ startsOn: e.target.value })} /></Field>
              <Field label="Ends"><Input type="date" value={editing.endsOn} onChange={(e) => set({ endsOn: e.target.value })} /></Field>
            </div>
            <Field label="For which group">
              <Select value={editing.cohortId} onChange={(e) => set({ cohortId: e.target.value })}>
                <option value="">Every group</option>
                {(groups.data?.cohorts ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="A few words about it"><Textarea value={editing.description} maxLength={300} onChange={(e) => set({ description: e.target.value })} /></Field>
            <Switch checked={editing.active} onChange={(v) => set({ active: v })} label="Shown to members" />
            {problem ? <Alert>{problem}</Alert> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function Community() {
  const [view, setView] = useState("groups");
  return (
    <>
      <PageHeader title="Community" subtitle="Regional groups and Fitathon missions. Everything here is opt-in for members." />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Community views">
        {VIEWS.map((v) => <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${view === v.id ? "border-brand bg-brand/15 text-brand" : "border-line text-zinc-300 hover:bg-white/5"}`}>{v.label}</button>)}
      </div>
      {view === "groups" ? <Groups /> : <Missions />}
    </>
  );
}

export default function CommunityPage() {
  return (
    <AdminOnly>
      <Community />
    </AdminOnly>
  );
}
