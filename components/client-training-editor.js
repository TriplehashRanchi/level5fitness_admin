"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { fullDate } from "@/lib/dates";
import { Alert, Badge, Button, ConfirmDialog, Field, Input, Section, SectionError, SectionSkeleton, Textarea } from "@/components/ui";

/** Keyed by member/day below so unsaved edits never leak into another date. */
function TrainingBody({ memberId, day }) {
  const path = `/dietitian/clients/${encodeURIComponent(memberId)}/training`;
  const request = useApi(`${path}?day=${day}`);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const current = draft ?? request.data?.plan ?? { title: "", durationMin: 45, kcal: 0, instructions: "" };
  const set = (key, value) => setDraft({ ...current, [key]: value });
  const hasPlan = !!request.data?.plan;

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await api(path, { method: "PUT", body: {
        day, title: String(current.title ?? "").trim(), instructions: String(current.instructions ?? "").trim(),
        durationMin: Number(current.durationMin), kcal: Number(current.kcal),
      } });
      setDraft(null);
      setNotice({ tone: "good", text: "Exercise plan saved. It is now on this member’s home screen in the app." });
      request.reload();
    } catch (err) { setNotice({ tone: "bad", text: messageOf(err) }); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`${path}?day=${day}`, { method: "DELETE" });
      setDraft(null);
      setConfirm(false);
      setNotice({ tone: "good", text: "Exercise plan removed for this day." });
      request.reload();
    } catch (err) {
      setConfirm(false);
      setNotice({ tone: "bad", text: messageOf(err) });
    }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-200">{fullDate(day)}</h3>
        {request.data ? <Badge tone={hasPlan ? "good" : "neutral"}>{hasPlan ? "Plan saved" : "No plan yet"}</Badge> : null}
      </div>
      <div aria-live="polite">{notice ? <div className="mb-4"><Alert tone={notice.tone === "good" ? "good" : "bad"}>{notice.text}</Alert></div> : null}</div>
      {request.error ? <SectionError onRetry={request.reload}>{messageOf(request.error)}</SectionError> : null}
      {!request.data && !request.error ? <SectionSkeleton rows={4} label="Loading the exercise plan…" /> : null}
      {request.data ? (
        <form onSubmit={save} className="space-y-4">
          <Field label="Workout title"><Input required maxLength={80} value={current.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Full body strength" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration (minutes)"><Input type="number" inputMode="numeric" required min={1} max={600} step={1} value={current.durationMin ?? ""} onChange={(e) => set("durationMin", e.target.value)} /></Field>
            <Field label="Estimated calories"><Input type="number" inputMode="numeric" required min={0} max={5000} step={1} value={current.kcal ?? ""} onChange={(e) => set("kcal", e.target.value)} /></Field>
          </div>
          <Field label="Exercises, sets, reps & instructions" hint="Include rest intervals and any modifications.">
            <Textarea required rows={7} maxLength={4000} value={current.instructions ?? ""} onChange={(e) => set("instructions", e.target.value)} placeholder={"Warm-up: 5 minutes\nSquats: 3 × 12, rest 60 seconds\nPush-ups: 3 × 10\nCool-down: 5 minutes"} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={busy} disabled={request.refreshing}>Save exercise plan</Button>
            {hasPlan ? <Button type="button" variant="secondary" disabled={busy || request.refreshing} onClick={() => setConfirm(true)}>Remove plan</Button> : null}
            {draft ? <span className="text-xs text-warn">Unsaved changes</span> : null}
          </div>
        </form>
      ) : null}
      <ConfirmDialog open={confirm} title="Remove exercise plan?" message={`This member will no longer see the exercise plan for ${fullDate(day)}. Completed workout logs stay.`} confirmLabel="Remove" busy={busy} onConfirm={remove} onCancel={() => setConfirm(false)} />
    </>
  );
}

export default function ClientTrainingEditor({ memberId, day, picker }) {
  return (
    <Section
      id="exercise"
      title="Exercise plan"
      description="The workout this client does on the chosen day. Saving puts it on their home screen in the app."
    >
      <div className="mb-5">{picker}</div>
      <TrainingBody key={`${memberId}:${day}`} memberId={memberId} day={day} />
    </Section>
  );
}
