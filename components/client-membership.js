"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth";
import { Alert, Badge, Button, Field, Input, Modal, Section, Select, Textarea } from "@/components/ui";

const dayText = (d) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00`));

/**
 * The client's membership. A dietitian sees the plan name and dates only (enough to talk about renewing,
 * never the price). The admin can record a plan or a renewal, or cancel. Nothing is charged here.
 */
export default function ClientMembership({ memberId, membership, onChanged }) {
  const isAdmin = useAuth().staff?.role === "admin";
  const plans = useApi(isAdmin ? "/admin/plans" : null);
  const [modal, setModal] = useState(null); // "assign" | "cancel"
  const [planId, setPlanId] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const current = membership?.current;
  const next = membership?.next;
  const enc = encodeURIComponent(memberId);
  const run = async (call) => {
    setBusy(true);
    setError(null);
    try {
      await call();
      setModal(null);
      setNote("");
      setStartsOn("");
      onChanged?.();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const available = (plans.data?.plans ?? []).filter((p) => p.active);

  return (
    <Section
      id="membership"
      title="Membership"
      description="Which plan the client is on and until when. A pause for illness, injury or a doctor's advice adds its days to the end."
      action={isAdmin ? <div className="flex gap-2">{current ? <Button size="sm" variant="secondary" onClick={() => { setError(null); setModal("cancel"); }}>Cancel membership</Button> : null}<Button size="sm" onClick={() => { setError(null); setPlanId(available[0]?.id ?? ""); setModal("assign"); }}>{current ? "Record a renewal" : "Record a plan"}</Button></div> : null}
    >
      {!current && !next ? <p className="text-sm text-muted">No membership is recorded for this client.</p> : null}
      {current ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-lg font-semibold text-white">{current.planName}</p>
            <Badge tone={current.daysLeft <= 14 ? "warn" : "good"}>{current.daysLeft} day{current.daysLeft === 1 ? "" : "s"} left</Badge>
            {current.cancelRequested ? <Badge tone="bad">Asked to cancel</Badge> : null}
          </div>
          <p className="text-sm text-muted">Ends on {dayText(current.endsOn)}.</p>
          {current.cancelRequested ? <Alert tone="warn">The client asked to cancel. Talk to them first: find out why, and whether a pause or a lighter plan would help.</Alert> : null}
        </div>
      ) : null}
      {next ? <p className="mt-3 text-sm text-zinc-300">Next: {next.planName}, starting {dayText(next.startsOn)}.</p> : null}

      <Modal
        open={modal === "assign"}
        onClose={() => setModal(null)}
        title={current ? "Record a renewal" : "Record a plan"}
        footer={<><Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!planId} onClick={() => run(() => api(`/admin/members/${enc}/membership`, { method: "POST", body: { planId, startsOn: startsOn || undefined, note: note || undefined } }))}>Save</Button></>}
      >
        <div className="space-y-4">
          {available.length === 0 ? <Alert tone="info">There are no plans on sale yet. Add one under Memberships, Plans.</Alert> : null}
          <Field label="Plan">
            <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {available.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.durationDays} days)</option>)}
            </Select>
          </Field>
          <Field label="Starts on" hint={current ? "Leave empty to start the day after the current one ends" : "Leave empty to start today"}>
            <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </Field>
          <Field label="Note" hint="Optional, for your own records (for example how it was paid)"><Textarea value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
          {error ? <Alert>{error}</Alert> : null}
        </div>
      </Modal>

      <Modal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title="Cancel this membership?"
        footer={<><Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Keep it</Button><Button variant="danger" loading={busy} onClick={() => run(() => api(`/admin/members/${enc}/membership/cancel`, { method: "POST", body: { reason: note || undefined } }))}>Cancel membership</Button></>}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted">It ends today, along with any renewal already recorded. The client keeps their safety guidance and can still download their data.</p>
          <Field label="Reason" hint="Optional"><Textarea value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
          {error ? <Alert>{error}</Alert> : null}
        </div>
      </Modal>
    </Section>
  );
}
