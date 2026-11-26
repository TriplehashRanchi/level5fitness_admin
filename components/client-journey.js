"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { timeAgo } from "@/lib/dates";
import { SEVERITY, STAGE_ORDER, STAGES, STATUS } from "@/lib/cases";
import CaseDrawer from "@/components/case-drawer";
import { Alert, Badge, Button, Field, Modal, Section, Select, Textarea } from "@/components/ui";

/**
 * Where the client is in their journey (new, active, at risk, paused, back again…), why, and their cases.
 * The system works out the stage; a coach can say "no, this is where they really are" with a reason, and
 * that holds for a while (7, 14 or 30 days) before the system's answer is used again.
 */
export default function ClientJourney({ memberId, lifecycle, onChanged }) {
  const enc = encodeURIComponent(memberId);
  const cases = useApi(`/dietitian/clients/${enc}/cases`);
  const [modal, setModal] = useState(false);
  const [stage, setStage] = useState("active");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("14");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

  const s = lifecycle ? STAGES[lifecycle.state] : null;
  const run = async (call) => {
    setBusy(true);
    setError(null);
    try {
      await call();
      setModal(false);
      setReason("");
      onChanged?.();
      cases.reload();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      id="journey"
      title="Journey"
      description="Where this client is, worked out from what they log. You can correct it if you know better."
      action={lifecycle ? <Button size="sm" variant="secondary" onClick={() => { setStage(lifecycle.state); setError(null); setModal(true); }}>Change stage</Button> : null}
    >
      {!lifecycle ? (
        <p className="text-sm text-muted">The stage appears after the system has looked at this client (it checks every 30 minutes).</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={s.tone}>{s.label}</Badge>
            <p className="text-sm text-zinc-300">{s.hint}</p>
          </div>
          {lifecycle.override ? (
            <Alert tone="info" action={<Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => api(`/dietitian/clients/${enc}/lifecycle`, { method: "DELETE" }))}>Use the system&apos;s answer</Button>}>
              Set by {lifecycle.override.by} until {lifecycle.override.until}: &ldquo;{lifecycle.override.reason}&rdquo;. The system says {STAGES[lifecycle.auto]?.label ?? lifecycle.auto}.
            </Alert>
          ) : null}
        </div>
      )}

      <h3 className="mb-2 mt-7 text-sm font-semibold text-zinc-200">Cases</h3>
      {cases.error ? <Alert>{messageOf(cases.error)}</Alert> : null}
      {cases.data && cases.data.cases.length === 0 ? <p className="text-sm text-muted">No cases for this client.</p> : null}
      <ul className="divide-y divide-line">
        {(cases.data?.cases ?? []).map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => setOpenId(c.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-3 text-left hover:bg-white/[0.03]">
              <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
              <span className="text-sm font-medium text-white">{c.label}</span>
              <Badge tone={SEVERITY[c.severity].tone}>{SEVERITY[c.severity].label}</Badge>
              <span className="ml-auto text-xs text-muted">{c.status === "resolved" ? `Resolved ${timeAgo(c.resolvedAt)}` : `Opened ${timeAgo(c.openedAt)}`}</span>
            </button>
          </li>
        ))}
      </ul>
      <CaseDrawer caseId={openId} onClose={() => setOpenId(null)} onChanged={cases.reload} />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Change this client's stage"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)} disabled={busy}>Cancel</Button>
            <Button loading={busy} disabled={reason.trim().length < 5} onClick={() => run(() => api(`/dietitian/clients/${enc}/lifecycle`, { method: "PUT", body: { state: stage, reason, days: Number(days) } }))}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted">The system looks at what they log. If you know something it cannot see, say where they really are and why. Your answer is kept with your reason.</p>
          <Field label="Stage">
            <Select value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGE_ORDER.map((k) => <option key={k} value={k}>{STAGES[k].label}</option>)}
            </Select>
          </Field>
          <Field label="Why?" hint="At least a few words. The next person to look will see this.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </Field>
          <Field label="For how long?">
            <Select value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </Select>
          </Field>
          {error ? <Alert>{error}</Alert> : null}
        </div>
      </Modal>
    </Section>
  );
}
