"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { Alert, Button, Section } from "@/components/ui";

const REPORTS = [30, 60, 90];

/**
 * The day 30, 60 and 90 progress summaries as PDFs, to read with the client or send to them. A summary
 * asked for before the day is reached covers the days so far. The link works for five minutes.
 */
export default function ClientReports({ memberId }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const open = async (days) => {
    setBusy(days);
    setError(null);
    try {
      const { url } = await api(`/dietitian/clients/${encodeURIComponent(memberId)}/summaries/${days}/link`, { method: "POST" });
      window.open(`${API_URL}${url}`, "_blank", "noopener");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section id="reports" title="Progress reports" description="Day 30, 60 and 90 summaries as PDFs. Self-reported, phone-counted and report-checked numbers are kept apart.">
      <div className="flex flex-wrap gap-3">
        {REPORTS.map((days) => <Button key={days} variant="secondary" loading={busy === days} onClick={() => open(days)}>Day {days} summary (PDF)</Button>)}
      </div>
      <p className="mt-3 text-xs text-muted">Asking early gives a summary of the days so far.</p>
      {error ? <div className="mt-4"><Alert>{error}</Alert></div> : null}
    </Section>
  );
}
