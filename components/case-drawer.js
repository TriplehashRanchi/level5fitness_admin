"use client";

import { useState } from "react";
import Link from "next/link";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime } from "@/lib/dates";
import { CHANNEL_LABEL, CHANNELS, OUTCOME_LABEL, OUTCOMES, SEVERITY, STATUS } from "@/lib/cases";
import { Alert, Badge, Button, Drawer, Field, Input, Select, Skeleton, Textarea } from "@/components/ui";

const EVENT_WORDS = {
  opened: "Opened",
  assigned: "Handed over",
  contacted: "Got in touch",
  waiting: "Waiting for a reply",
  note: "Note",
  escalated: "Escalated",
  resolved: "Resolved",
  auto_resolved: "Closed by itself",
};

/** What a person can do next, in the order they usually do it. */
const ACTIONS = [
  { value: "contacted", label: "I got in touch" },
  { value: "waiting", label: "Waiting for their reply" },
  { value: "note", label: "Add a note" },
  { value: "escalate", label: "Ask the admin to step in" },
  { value: "resolve", label: "Resolve this case" },
];

function Timeline({ events }) {
  return (
    <ol className="space-y-4 border-l border-line pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span aria-hidden="true" className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-brand" />
          <p className="text-sm font-semibold text-white">
            {EVENT_WORDS[e.kind] ?? e.kind}
            {e.channel ? <span className="font-normal text-muted"> · {CHANNEL_LABEL[e.channel]}</span> : null}
            {e.outcome ? <span className="font-normal text-muted"> · {OUTCOME_LABEL[e.outcome] ?? e.outcome}</span> : null}
          </p>
          {e.body ? <p className="mt-0.5 whitespace-pre-line text-sm leading-6 text-zinc-300">{e.body}</p> : null}
          <p className="mt-0.5 text-xs text-muted">
            {e.actorName || (e.actorId ? "Staff" : "Rules engine")} · {fmtDateTime(e.at)}
            {e.followUpOn ? ` · look again on ${e.followUpOn}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** One case: why it opened, what to do, what has happened, and the form to record what you did. */
export default function CaseDrawer({ caseId, onClose, onChanged }) {
  const isAdmin = useAuth().staff?.role === "admin";
  const detail = useApi(caseId ? `/dietitian/cases/${caseId}` : null);
  const dietitians = useApi(isAdmin && caseId ? "/admin/dietitians" : null);
  const d = detail.data;
  const c = d?.case;

  const [action, setAction] = useState("contacted");
  const [channel, setChannel] = useState("chat");
  const [body, setBody] = useState("");
  const [followUpOn, setFollowUpOn] = useState("");
  const [outcome, setOutcome] = useState("back_on_track");
  const [ownerId, setOwnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const actions = isAdmin ? [...ACTIONS, { value: "assign", label: "Hand to another dietitian" }] : ACTIONS;
  const needsBody = action === "contacted" || action === "note" || action === "escalate";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = { action };
    if (action === "contacted") Object.assign(payload, { channel, body, followUpOn: followUpOn || undefined });
    if (action === "waiting") Object.assign(payload, { body, followUpOn });
    if (action === "note" || action === "escalate") payload.body = body;
    if (action === "resolve") Object.assign(payload, { outcome, body });
    if (action === "assign") payload.ownerId = ownerId;
    try {
      await api(`/dietitian/cases/${caseId}/actions`, { method: "POST", body: payload });
      setBody("");
      setFollowUpOn("");
      detail.reload();
      onChanged?.();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const closed = c?.status === "resolved";
  return (
    <Drawer open={!!caseId} onClose={onClose} title={c ? c.label : "Case"} subtitle={c ? c.memberName || c.memberEmail : undefined}>
      {detail.error ? <Alert>{messageOf(detail.error)}</Alert> : null}
      {!d && !detail.error ? <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-40 w-full" /></div> : null}
      {d && c ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
            <Badge tone={SEVERITY[c.severity].tone}>{SEVERITY[c.severity].label} priority</Badge>
            {c.clinical ? <Badge tone="warn">Health</Badge> : null}
            <Link href={`/clients/${encodeURIComponent(c.memberId)}`} className="ml-auto text-sm font-semibold text-brand hover:underline">Open client →</Link>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted">Opened</dt><dd className="text-white">{fmtDateTime(c.openedAt)}</dd></div>
            <div><dt className="text-xs text-muted">Contact due by</dt><dd className={!c.firstContactAt && new Date(c.dueAt) < new Date() && !closed ? "font-semibold text-accent" : "text-white"}>{fmtDateTime(c.dueAt)}</dd></div>
            <div><dt className="text-xs text-muted">Owner</dt><dd className="text-white">{c.ownerName || <span className="text-muted">Nobody yet</span>}</dd></div>
            <div><dt className="text-xs text-muted">Look again on</dt><dd className="text-white">{c.followUpOn || <span className="text-muted">Not set</span>}</dd></div>
          </dl>

          {c.detail ? <p className="rounded-2xl border border-line bg-card-2 px-4 py-3 text-sm leading-6 text-zinc-200">{c.detail}</p> : null}
          {d.playbook ? (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-white">What to do</h3>
              <p className="text-sm leading-6 text-zinc-300">{d.playbook}</p>
            </div>
          ) : null}

          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">History</h3>
            <Timeline events={d.events} />
          </div>

          {closed ? (
            <Alert tone="good">This case is resolved{c.outcome ? `: ${OUTCOME_LABEL[c.outcome] ?? c.outcome}` : ""}.</Alert>
          ) : (
            <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-card-2/60 p-4">
              <Field label="What did you do?">
                <Select value={action} onChange={(e) => { setAction(e.target.value); setError(null); }}>
                  {actions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </Select>
              </Field>
              {action === "contacted" ? (
                <Field label="How?">
                  <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                    {CHANNELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
              ) : null}
              {needsBody || action === "waiting" || action === "resolve" ? (
                <Field label={action === "contacted" ? "What did they say?" : action === "escalate" ? "Why do you need the admin?" : action === "resolve" ? "Note (optional)" : "Note"}>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} required={needsBody} />
                </Field>
              ) : null}
              {action === "contacted" || action === "waiting" ? (
                <Field label="Look again on" hint={action === "waiting" ? "Required" : "Optional: the date you agreed to check in again"}>
                  <Input type="date" value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} required={action === "waiting"} />
                </Field>
              ) : null}
              {action === "resolve" ? (
                <Field label="How did it end?">
                  <Select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                    {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
              ) : null}
              {action === "assign" ? (
                <Field label="Hand to">
                  <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required>
                    <option value="">Choose a dietitian</option>
                    {(dietitians.data?.dietitians ?? []).filter((x) => !x.disabled).map((x) => <option key={x.id} value={x.id}>{x.name || x.email}</option>)}
                  </Select>
                </Field>
              ) : null}
              {action === "resolve" && d.automatic ? <Alert tone="info">{d.automatic}</Alert> : null}
              {error ? <Alert>{error}</Alert> : null}
              <Button type="submit" loading={busy} className="w-full">Save</Button>
            </form>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
