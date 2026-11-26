"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { todayKey } from "@/lib/dates";
import { Alert, Badge, Button, Empty, Field, Input, Modal, Section, SectionSkeleton, Select, Switch } from "@/components/ui";

const KINDS = {
  waist_cm: { label: "Waist", unit: "cm" },
  bp: { label: "Blood pressure", unit: "mmHg" },
  glucose: { label: "Blood sugar", unit: "mg/dL" },
  hba1c: { label: "HbA1c", unit: "%" },
  ldl: { label: "LDL cholesterol", unit: "mg/dL" },
  hdl: { label: "HDL cholesterol", unit: "mg/dL" },
  triglycerides: { label: "Triglycerides", unit: "mg/dL" },
  total_cholesterol: { label: "Total cholesterol", unit: "mg/dL" },
};
const CONTEXT = { fasting: "fasting", after_meal: "after a meal", random: "any time" };
const ORIGIN = {
  self: { label: "Self-reported", tone: "neutral" },
  device: { label: "From the phone", tone: "neutral" },
  verified: { label: "Checked against a report", tone: "good" },
};
const dayText = (d) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00`));

/**
 * The client's waist and health readings, each marked with where it came from. A dietitian can mark a
 * self-reported reading as checked against the client's report, or type one in from a report (already
 * checked). Nothing is interpreted here: no "high" or "normal".
 */
export default function ClientReadings({ memberId }) {
  const enc = encodeURIComponent(memberId);
  const { data, error, reload } = useApi(`/dietitian/clients/${enc}/measurements`);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("hba1c");
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [context, setContext] = useState("");
  const [day, setDay] = useState(todayKey);
  const [checked, setChecked] = useState(true);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);

  const add = async () => {
    setBusy("add");
    setProblem(null);
    try {
      await api(`/dietitian/clients/${enc}/measurements`, {
        method: "POST",
        body: { today: todayKey(), kind, value: Number(value), value2: kind === "bp" ? Number(value2) : undefined, context: kind === "glucose" && context ? context : undefined, day, verified: checked },
      });
      setOpen(false);
      setValue("");
      setValue2("");
      reload();
    } catch (e) {
      setProblem(messageOf(e));
    } finally {
      setBusy(null);
    }
  };
  const verify = async (id) => {
    setBusy(id);
    try {
      await api(`/dietitian/clients/${enc}/measurements/${id}/verify`, { method: "POST" });
      reload();
    } catch (e) {
      setProblem(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  const list = data?.measurements ?? [];
  return (
    <Section
      id="readings"
      title="Readings"
      description="Waist and health readings, kept apart by where they came from. The app does not say whether a number is good or bad: that is for a clinician."
      action={<Button size="sm" variant="secondary" onClick={() => { setProblem(null); setOpen(true); }}>+ Add from a report</Button>}
    >
      {error ? <Alert>{messageOf(error)}</Alert> : null}
      {!data && !error ? <SectionSkeleton rows={3} label="Loading readings…" /> : null}
      {data?.clinicalWithheld ? <div className="mb-4"><Alert tone="info">This client took back their consent to share health details, so only their waist is shown.</Alert></div> : null}
      {problem && !open ? <div className="mb-4"><Alert>{problem}</Alert></div> : null}
      {data && list.length === 0 ? <Empty title="No readings yet">Waist readings the client logs, and any report you add, appear here.</Empty> : null}
      <ul className="divide-y divide-line">
        {list.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">{KINDS[m.kind]?.label ?? m.kind}{m.context ? ` · ${CONTEXT[m.context]}` : ""}</p>
              <p className="text-lg font-semibold tabular-nums text-white">{m.kind === "bp" ? `${m.value}/${m.value2}` : m.value} <span className="text-sm font-normal text-muted">{m.unit}</span></p>
              {m.note ? <p className="text-xs text-muted">{m.note}</p> : null}
            </div>
            <span className="text-sm text-zinc-300">{dayText(m.day)}</span>
            <Badge tone={ORIGIN[m.origin].tone}>{ORIGIN[m.origin].label}{m.edited ? " · edited" : ""}</Badge>
            {m.origin === "self" && m.kind !== "waist_cm" ? <Button size="sm" variant="secondary" loading={busy === m.id} onClick={() => verify(m.id)}>Mark as checked</Button> : null}
          </li>
        ))}
      </ul>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a reading from a report"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy === "add"}>Cancel</Button>
            <Button loading={busy === "add"} disabled={!value || (kind === "bp" && !value2)} onClick={add}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="What">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.unit})</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={kind === "bp" ? "Top number" : "Value"}><Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
            {kind === "bp" ? <Field label="Bottom number"><Input inputMode="decimal" value={value2} onChange={(e) => setValue2(e.target.value)} /></Field> : null}
          </div>
          {kind === "glucose" ? (
            <Field label="When was it taken?">
              <Select value={context} onChange={(e) => setContext(e.target.value)}>
                <option value="">Not stated</option>
                {Object.entries(CONTEXT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
          ) : null}
          <Field label="Date of the reading"><Input type="date" value={day} max={todayKey()} onChange={(e) => setDay(e.target.value)} /></Field>
          <Switch checked={checked} onChange={setChecked} label="I checked this against the client's report" />
          {problem ? <Alert>{problem}</Alert> : null}
        </div>
      </Modal>
    </Section>
  );
}
