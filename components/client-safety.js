"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { Alert, Button, Chip, Field, Modal, Section, Select, Textarea } from "@/components/ui";

const REASONS = [
  { value: "illness", label: "Illness" },
  { value: "injury", label: "Injury" },
  { value: "clinician", label: "Clinician's advice" },
  { value: "other", label: "Something else" },
];
const reasonLabel = (value) => REASONS.find((r) => r.value === value)?.label ?? value;
const PREGNANCY = { no: "No", pregnant: "Pregnant", breastfeeding: "Breastfeeding" };

const unknown = <span className="text-muted">Not answered</span>;
const yesNo = (v) => (v == null ? unknown : v ? <Chip tone="warn">Yes</Chip> : "No");

function Row({ label, children }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-white">{children}</dd>
    </div>
  );
}

/**
 * Clinical safety for one client: the health answers to review before prescribing exercise or calorie
 * targets, and pausing or restarting the plan. While paused the client's plan reminders are off; a
 * client who says they feel ready waits here for a check-in before the plan restarts.
 */
export default function ClientSafety({ memberId, profile: p, pause, withheld = false, onChanged }) {
  const enc = encodeURIComponent(memberId);
  const [modal, setModal] = useState(null); // "pause" | "resume"
  const [reason, setReason] = useState("illness");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (call, done) => {
    setBusy(true);
    setError(null);
    try {
      await call();
      done?.();
      setModal(null);
      setNote("");
      onChanged?.();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const reasons = p.reviewReasons ?? [];
  const ready = pause?.status === "restart_requested";

  return (
    <Section
      id="safety"
      title="Health and safety"
      description="What the client told us about medicines, pregnancy, injury and a doctor's advice. Look at it before you set exercise or calorie targets."
      tone={pause || reasons.length ? "brand" : undefined}
      action={
        pause ? (
          <Button size="sm" onClick={() => { setError(null); setModal("resume"); }}>Restart plan</Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => { setError(null); setModal("pause"); }}>Pause plan</Button>
        )
      }
    >
      <div className="space-y-4">
        {pause ? (
          <Alert tone={ready ? "good" : "warn"}>
            {ready ? "Ready to restart" : "Plan paused"} · {reasonLabel(pause.reason)}
            {pause.note ? <> · {pause.note}</> : null}.{" "}
            {ready ? "They say they feel ready. Check in with them, then restart the plan." : "Their reminders are off until you restart the plan."}
          </Alert>
        ) : null}

        {withheld ? (
          <Alert tone="info">This client took back their consent to share health details. Medical notes and health check answers are hidden. Ask them before you plan around their health.</Alert>
        ) : null}

        {reasons.length ? (
          <Alert
            tone="warn"
            action={<Button variant="secondary" size="sm" loading={busy} onClick={() => run(() => api(`/dietitian/clients/${enc}/screening/review`, { method: "POST" }))}>Mark as reviewed</Button>}
          >
            Review before you set exercise or calorie targets: {reasons.join(", ")}.
          </Alert>
        ) : null}
        {error && !modal ? <Alert>{error}</Alert> : null}

        <dl className="divide-y divide-line">
          <Row label="Regular medicines">{yesNo(p.takesMedication)}</Row>
          {p.sex === "female" ? (
            <Row label="Pregnant or breastfeeding">{p.pregnancyStatus ? (p.pregnancyStatus === "no" ? "No" : <Chip tone="warn">{PREGNANCY[p.pregnancyStatus]}</Chip>) : unknown}</Row>
          ) : null}
          <Row label="Injury or pain">{yesNo(p.hasInjury)}{p.hasInjury && p.injuryNotes ? <p className="mt-1 leading-6">{p.injuryNotes}</p> : null}</Row>
          <Row label="Doctor's restrictions">{yesNo(p.hasRestriction)}{p.hasRestriction && p.restrictionNotes ? <p className="mt-1 leading-6">{p.restrictionNotes}</p> : null}</Row>
          <Row label="Review">{p.screeningReviewedAt ? <Chip tone="good">Reviewed</Chip> : reasons.length ? <Chip tone="warn">Waiting for you</Chip> : <span className="text-muted">Nothing to review</span>}</Row>
        </dl>
      </div>

      <Modal
        open={modal === "pause"}
        onClose={() => setModal(null)}
        title="Pause this plan"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
            <Button loading={busy} onClick={() => run(() => api(`/dietitian/clients/${enc}/pause`, { method: "POST", body: { reason, note: note.trim() || undefined } }))}>Pause plan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted">Their plan reminders stop. They can say when they feel ready, and you restart the plan after checking in.</p>
          <Field label="Why">
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </Field>
          <Field label="Note" hint="Optional, up to 300 characters">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </Field>
          {error ? <Alert>{error}</Alert> : null}
        </div>
      </Modal>

      <Modal
        open={modal === "resume"}
        onClose={() => setModal(null)}
        title="Restart this plan?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
            <Button loading={busy} onClick={() => run(() => api(`/dietitian/clients/${enc}/resume`, { method: "POST" }))}>Restart plan</Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-muted">Only restart after you have checked how they are. Their reminders start again.</p>
        {error ? <div className="mt-4"><Alert>{error}</Alert></div> : null}
      </Modal>
    </Section>
  );
}
