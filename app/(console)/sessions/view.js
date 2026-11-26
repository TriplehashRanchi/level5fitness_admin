"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth";
import { ListTable } from "@/components/table";
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, PageSpinner, Select, Textarea } from "@/components/ui";

const when = (iso) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const VIEWS = [{ id: "calls", label: "Call times" }, { id: "live", label: "Live sessions" }];
const STATUS = {
  open: { label: "Open", tone: "neutral" },
  booked: { label: "Booked", tone: "good" },
  cancelled: { label: "Cancelled", tone: "bad" },
  done: { label: "Done", tone: "neutral" },
};

/** One-to-one calls: a dietitian offers times, their own clients book them. */
function Calls() {
  const isAdmin = useAuth().staff?.role === "admin";
  const { data, error, reload } = useApi("/dietitian/calls");
  const [open, setOpen] = useState(false);
  const [times, setTimes] = useState([]);
  const [next, setNext] = useState("");
  const [duration, setDuration] = useState("20");
  const [kind, setKind] = useState("call");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);

  const run = async (key, call) => {
    setBusy(key);
    setProblem(null);
    try {
      await call();
      reload();
    } catch (e) {
      setProblem(messageOf(e));
    } finally {
      setBusy(null);
    }
  };
  const offer = () =>
    run("offer", async () => {
      await api("/dietitian/calls", { method: "POST", body: { times: times.map((t) => new Date(t).toISOString()), durationMin: Number(duration), kind, joinNote: note || undefined } });
      setOpen(false);
      setTimes([]);
    });

  const columns = [
    { key: "when", header: "When", nowrap: true, sort: (s) => s.startsAt, cell: (s) => <div><p className="font-medium text-white">{when(s.startsAt)}</p><p className="text-xs text-muted">{s.kind === "video" ? "Video" : "Phone"} · {s.durationMin} min</p></div> },
    ...(isAdmin ? [{ key: "dietitian", header: "Dietitian", nowrap: true, sort: (s) => s.dietitianName, cell: (s) => s.dietitianName }] : []),
    { key: "who", header: "Booked by", sort: (s) => s.memberName ?? "", cell: (s) => (s.memberName ? <div><p>{s.memberName}</p>{s.recordingAllowed ? <p className="text-xs text-muted">Allows recording</p> : <p className="text-xs text-muted">Do not record</p>}</div> : <span className="text-muted">–</span>) },
    { key: "status", header: "Status", nowrap: true, cell: (s) => <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge> },
    {
      key: "actions", header: "Actions", hidden: true, align: "right",
      cell: (s) => (
        <div className="flex justify-end gap-2">
          {s.status === "booked" ? <Button size="sm" variant="secondary" loading={busy === `d${s.id}`} onClick={() => run(`d${s.id}`, () => api(`/dietitian/calls/${s.id}/done`, { method: "POST" }))}>Mark done</Button> : null}
          {(s.status === "open" || s.status === "booked") && !isAdmin ? <Button size="sm" variant="secondary" loading={busy === `x${s.id}`} onClick={() => run(`x${s.id}`, () => api(`/dietitian/calls/${s.id}`, { method: "DELETE" }))}>{s.status === "booked" ? "Cancel call" : "Remove"}</Button> : null}
        </div>
      ),
    },
  ];
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm leading-6 text-muted">Offer times for a one-to-one call. Only your own clients can book them, at least two hours ahead. They get a reminder an hour before, and you are told when they book or give a time back. The note (a number to expect a call from, or a meeting link) is shown only to the person who booked.</p>
      {error ? <div className="mb-4"><Alert>{messageOf(error)}</Alert></div> : null}
      {problem && !open ? <div className="mb-4"><Alert>{problem}</Alert></div> : null}
      {!data && !error ? <PageSpinner /> : null}
      {data ? (
        <ListTable
          label="Call times" minWidth={760} rows={data.slots} rowKey={(s) => s.id} columns={columns} defaultSort="when" noun="time"
          action={isAdmin ? null : <Button onClick={() => { setProblem(null); setOpen(true); }}>+ Offer times</Button>}
          empty={{ title: "No call times yet", text: isAdmin ? "Dietitians offer their own times." : "Offer a few times so your clients can book a call." }}
        />
      ) : null}
      <Modal
        open={open} onClose={() => setOpen(false)} title="Offer call times"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy === "offer"}>Cancel</Button><Button loading={busy === "offer"} disabled={times.length === 0} onClick={offer}>Offer {times.length || ""} time{times.length === 1 ? "" : "s"}</Button></>}
      >
        <div className="space-y-4">
          <Field label="Add a time" hint="Your own clock. Add as many as you like, up to 30.">
            <div className="flex gap-2">
              <Input type="datetime-local" value={next} onChange={(e) => setNext(e.target.value)} />
              <Button variant="secondary" disabled={!next} onClick={() => { setTimes((t) => (t.includes(next) ? t : [...t, next].sort())); setNext(""); }}>Add</Button>
            </div>
          </Field>
          {times.length ? <ul className="flex flex-wrap gap-2">{times.map((t) => <li key={t}><button type="button" onClick={() => setTimes((x) => x.filter((y) => y !== t))} className="rounded-full border border-line bg-card-2 px-3 py-1 text-xs text-zinc-200 hover:bg-white/10" aria-label={`Remove ${when(t)}`}>{when(t)} ✕</button></li>)}</ul> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="How long"><Select value={duration} onChange={(e) => setDuration(e.target.value)}>{[15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} minutes</option>)}</Select></Field>
            <Field label="Kind"><Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="call">Phone call</option><option value="video">Video call</option></Select></Field>
          </div>
          <Field label="How they join" hint="The number you will call from, or a meeting link. Only the person who books sees it."><Textarea value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
          {problem ? <Alert>{problem}</Alert> : null}
        </div>
      </Modal>
    </>
  );
}

function Live() {
  const isAdmin = useAuth().staff?.role === "admin";
  const { data, error, reload } = useApi("/dietitian/live");
  const groups = useApi(isAdmin ? "/admin/cohorts" : null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "", startsAt: "", durationMin: "45", joinUrl: "", capacity: "", cohortId: "" });
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  const create = async () => {
    setBusy("create");
    setProblem(null);
    try {
      await api("/dietitian/live", { method: "POST", body: { title: f.title, description: f.description || undefined, startsAt: new Date(f.startsAt).toISOString(), durationMin: Number(f.durationMin), joinUrl: f.joinUrl || undefined, capacity: f.capacity ? Number(f.capacity) : undefined, cohortId: f.cohortId || undefined } });
      setOpen(false);
      setF({ title: "", description: "", startsAt: "", durationMin: "45", joinUrl: "", capacity: "", cohortId: "" });
      reload();
    } catch (e) {
      setProblem(messageOf(e));
    } finally {
      setBusy(null);
    }
  };
  const cancel = async (s) => {
    setBusy(s.id);
    setProblem(null);
    try {
      await api(`/dietitian/live/${s.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setProblem(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  const columns = [
    { key: "title", header: "Session", sort: (s) => s.title, cell: (s) => <div><p className="font-medium text-white">{s.title}</p><p className="text-xs text-muted">{s.cohortName ? `For ${s.cohortName}` : "Open to everyone"}{s.hostName ? ` · ${s.hostName}` : ""}</p></div> },
    { key: "when", header: "When", nowrap: true, sort: (s) => s.startsAt, cell: (s) => `${when(s.startsAt)} · ${s.durationMin} min` },
    { key: "going", header: "Going", nowrap: true, sort: (s) => s.going, cell: (s) => `${s.going}${s.capacity ? ` of ${s.capacity}` : ""}` },
    { key: "status", header: "Status", nowrap: true, cell: (s) => (s.status === "cancelled" ? <Badge tone="bad">Cancelled</Badge> : <Badge tone="good">Planned</Badge>) },
    { key: "act", header: "Cancel", hidden: true, align: "right", cell: (s) => (s.status === "scheduled" ? <Button size="sm" variant="secondary" loading={busy === s.id} onClick={() => cancel(s)}>Cancel session</Button> : null) },
  ];
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm leading-6 text-muted">A group session (a live workout, a cooking class, a Q&amp;A) with a link to join. Members save a place, and only they see the link. Everyone with a place is reminded an hour before, and told if it is cancelled.</p>
      {error ? <div className="mb-4"><Alert>{messageOf(error)}</Alert></div> : null}
      {problem && !open ? <div className="mb-4"><Alert>{problem}</Alert></div> : null}
      {!data && !error ? <PageSpinner /> : null}
      {data ? (
        <ListTable label="Live sessions" minWidth={760} rows={data.sessions} rowKey={(s) => s.id} columns={columns} defaultSort="when" noun="session" action={<Button onClick={() => { setProblem(null); setOpen(true); }}>+ New session</Button>} empty={{ title: "No live sessions yet", text: "Plan one and members can save a place." }} />
      ) : null}
      <Modal
        open={open} onClose={() => setOpen(false)} wide title="New live session"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy === "create"}>Cancel</Button><Button loading={busy === "create"} disabled={!f.title || !f.startsAt} onClick={create}>Create</Button></>}
      >
        <div className="space-y-4">
          <Field label="Title"><Input value={f.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" hint="Your own clock"><Input type="datetime-local" value={f.startsAt} onChange={(e) => set({ startsAt: e.target.value })} /></Field>
            <Field label="How long"><Select value={f.durationMin} onChange={(e) => set({ durationMin: e.target.value })}>{[30, 45, 60, 90].map((n) => <option key={n} value={n}>{n} minutes</option>)}</Select></Field>
            <Field label="Places" hint="Leave empty for no limit"><Input inputMode="numeric" value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} /></Field>
            {isAdmin ? <Field label="Who can come"><Select value={f.cohortId} onChange={(e) => set({ cohortId: e.target.value })}><option value="">Everyone</option>{(groups.data?.cohorts ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} only</option>)}</Select></Field> : null}
          </div>
          <Field label="Join link" hint="Must start with https://"><Input value={f.joinUrl} maxLength={300} onChange={(e) => set({ joinUrl: e.target.value })} /></Field>
          <Field label="About it"><Textarea value={f.description} maxLength={400} onChange={(e) => set({ description: e.target.value })} /></Field>
          {problem ? <Alert>{problem}</Alert> : null}
        </div>
      </Modal>
    </>
  );
}

export default function SessionsPage() {
  const [view, setView] = useState("calls");
  return (
    <>
      <PageHeader title="Calls and sessions" subtitle="One-to-one calls with your clients, and live group sessions." />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Views">
        {VIEWS.map((v) => <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${view === v.id ? "border-brand bg-brand/15 text-brand" : "border-line text-zinc-300 hover:bg-white/5"}`}>{v.label}</button>)}
      </div>
      {view === "calls" ? <Calls /> : <Live />}
    </>
  );
}
