"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { Alert, Button, Field, Input, Section, SectionError, Skeleton } from "@/components/ui";

export const TARGET_FIELDS = [
  { key: "waterMl", label: "Water (ml per day)", min: 500, max: 10000, placeholder: "e.g. 3000" },
  { key: "steps", label: "Steps per day", min: 1000, max: 100000, placeholder: "e.g. 10000" },
  { key: "calories", label: "Calories per day", min: 800, max: 6000, placeholder: "e.g. 2200" },
  { key: "proteinG", label: "Protein (g per day)", min: 0, max: 500, placeholder: "e.g. 140" },
  { key: "weeklyWorkouts", label: "Workouts per week", min: 1, max: 7, placeholder: "e.g. 4" },
];

function TargetsForm({ memberId, targets, onSaved }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(TARGET_FIELDS.map((f) => [f.key, targets?.[f.key] == null ? "" : String(targets[f.key])]))
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const saved = (key) => (targets?.[key] == null ? "" : String(targets[key]));
  const dirty = TARGET_FIELDS.some((f) => values[f.key] !== saved(f.key));

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    const body = {};
    for (const f of TARGET_FIELDS) {
      const raw = values[f.key].trim();
      if (raw === "") {
        body[f.key] = null;
        continue;
      }
      const n = Number(raw);
      if (!Number.isInteger(n) || n < f.min || n > f.max) {
        return setFeedback({ tone: "bad", text: `${f.label}: enter a whole number from ${f.min} to ${f.max}, or leave it empty.` });
      }
      body[f.key] = n;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await api(`/dietitian/clients/${encodeURIComponent(memberId)}/targets`, { method: "PUT", body });
      setFeedback({ tone: "good", text: "Targets saved. The client will see them in the app." });
      onSaved?.();
    } catch (err) {
      setFeedback({ tone: "bad", text: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TARGET_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={`${f.min} to ${f.max}`}>
            <Input
              inputMode="numeric"
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
            />
          </Field>
        ))}
      </div>
      <div aria-live="polite">{feedback ? <Alert tone={feedback.tone === "good" ? "good" : "bad"}>{feedback.text}</Alert> : null}</div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy}>Save targets</Button>
        {dirty ? <span className="text-xs text-warn">Unsaved changes</span> : null}
      </div>
    </form>
  );
}

export default function ClientTargets({ memberId, onSaved }) {
  const { data, error, reload } = useApi(`/dietitian/clients/${encodeURIComponent(memberId)}/targets`);
  return (
    <Section
      id="targets"
      tone="brand"
      title="Daily targets"
      description="What the client must follow every day. These show in their app, and the daily check and overview measure progress against them."
    >
      {error ? <SectionError onRetry={reload}>{messageOf(error)}</SectionError> : null}
      {!data && !error ? (
        <div role="status" aria-label="Loading targets" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TARGET_FIELDS.map((f) => <Skeleton key={f.key} className="h-[78px]" />)}
        </div>
      ) : null}
      {data ? (
        <TargetsForm
          memberId={memberId}
          targets={data.targets}
          onSaved={() => {
            onSaved?.();
            reload();
          }}
        />
      ) : null}
    </Section>
  );
}
