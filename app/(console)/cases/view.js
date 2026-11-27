"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime, timeAgo } from "@/lib/dates";
import { SEVERITY, STATUS } from "@/lib/cases";
import CaseDrawer from "@/components/case-drawer";
import { ListTable, PersonCell } from "@/components/table";
import { Alert, Badge, Button, PageHeader, PageSpinner, StatCard } from "@/components/ui";

const FILTERS = [
  { id: "active", label: "Needs a person" },
  { id: "resolved", label: "Resolved" },
];

export default function CasesPage() {
  const isAdmin = useAuth().staff?.role === "admin";
  const [state, setState] = useState("active");
  const [openId, setOpenId] = useState(null);
  const [running, setRunning] = useState(false);
  const list = useApi(`/dietitian/cases?state=${state}`);
  const data = list.data ?? list.latest;
  const stats = data?.stats;

  const runNow = async () => {
    setRunning(true);
    try {
      await api("/admin/rules/run", { method: "POST" });
      list.reload();
    } finally {
      setRunning(false);
    }
  };

  const columns = [
    { key: "severity", header: "Priority", nowrap: true, sort: (c) => ["urgent", "high", "normal", "low"].indexOf(c.severity), cell: (c) => <Badge tone={SEVERITY[c.severity].tone}>{SEVERITY[c.severity].label}</Badge> },
    { key: "client", header: "Client", sort: (c) => c.memberName, cell: (c) => <PersonCell name={c.memberName} email={c.memberEmail} image={c.memberImage} /> },
    {
      key: "why", header: "Why", sort: (c) => c.label,
      cell: (c) => (
        <div>
          <p className="font-medium text-white">{c.label}</p>
          {c.detail ? <p className="mt-0.5 max-w-xs truncate text-xs text-muted">{c.detail}</p> : null}
        </div>
      ),
    },
    { key: "status", header: "Status", nowrap: true, sort: (c) => c.status, cell: (c) => <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge> },
    ...(isAdmin ? [{ key: "owner", header: "Owner", nowrap: true, sort: (c) => c.ownerName, cell: (c) => c.ownerName || <span className="text-muted">Nobody yet</span> }] : []),
    {
      key: "due", header: state === "resolved" ? "Resolved" : "Contact due", nowrap: true, sort: (c) => new Date(state === "resolved" ? c.resolvedAt : c.dueAt).getTime(),
      cell: (c) => {
        if (state === "resolved") return c.resolvedAt ? timeAgo(c.resolvedAt) : "–";
        const late = !c.firstContactAt && new Date(c.dueAt) < new Date();
        return <span className={late ? "font-semibold text-accent" : ""}>{c.firstContactAt ? "Done" : late ? "Overdue" : fmtDateTime(c.dueAt)}</span>;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Cases"
        subtitle={isAdmin ? "Clients who need a person to get in touch, and why. The system opens a case when someone goes quiet or falls behind, and closes it when they are back." : "Your clients who need you to get in touch, and why. Open a case to see what to do and to record what you did."}
        actions={isAdmin ? <Button variant="secondary" loading={running} onClick={runNow}>Check everyone now</Button> : null}
      />
      {list.error ? <div className="mb-5"><Alert action={<Button variant="secondary" size="sm" onClick={list.reload}>Retry</Button>}>{messageOf(list.error)}</Alert></div> : null}

      {stats ? (
        <div className="mb-6 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
          <StatCard label="Open cases" value={stats.open} tone={stats.open ? "warn" : undefined} />
          <StatCard label="Overdue" value={stats.overdue} tone={stats.overdue ? "warn" : undefined} hint="Nobody has been in touch yet" />
          <StatCard label="Escalated" value={stats.escalated} hint="Waiting for the admin" />
          <StatCard label="Contacted in time" value={stats.slaPercent == null ? "–" : `${stats.slaPercent}%`} tone={stats.slaPercent != null && stats.slaPercent >= 90 ? "brand" : undefined} hint={stats.slaCases ? `Within 1 business day, last 30 days. Goal 90%.` : "Needs a few cases first"} />
        </div>
      ) : null}

      {!data && !list.error ? <PageSpinner /> : null}
      {data ? (
        <ListTable
          label="Cases"
          minWidth={900}
          rows={data.cases}
          rowKey={(c) => c.id}
          columns={columns}
          defaultSort="severity"
          onOpen={(c) => setOpenId(c.id)}
          filters={{ options: FILTERS, value: state, onChange: setState, label: "Show cases" }}
          busy={list.refreshing}
          noun="case"
          empty={{ title: state === "active" ? "Nobody needs you right now" : "Nothing resolved yet", text: state === "active" ? "When a client goes quiet or falls behind, a case appears here." : "Cases you finish are kept here." }}
        />
      ) : null}
      <CaseDrawer caseId={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
    </>
  );
}
