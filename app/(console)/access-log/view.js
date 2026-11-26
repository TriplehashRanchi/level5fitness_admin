"use client";

import { useState } from "react";
import Link from "next/link";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { fmtDateTime } from "@/lib/dates";
import AdminOnly from "@/components/admin-only";
import { ListTable } from "@/components/table";
import { Alert, Badge, Button, PageHeader, PageSpinner } from "@/components/ui";

// What a recorded request means, in words. Anything not listed is shown as it was recorded.
const WORDS = {
  "GET client": "Opened the client's page",
  "GET client/plan": "Viewed the diet plan",
  "POST client/plan": "Added to the diet plan",
  "POST client/plan/copy": "Copied a day of the diet plan",
  "GET client/targets": "Viewed the targets",
  "PUT client/targets": "Changed the targets",
  "GET client/training": "Viewed the exercise plan",
  "PUT client/training": "Changed the exercise plan",
  "DELETE client/training": "Removed an exercise plan",
  "GET client/day": "Viewed the day's log",
  "GET client/week": "Viewed the week's log",
  "GET client/chat": "Read the chat",
  "POST client/chat": "Wrote in the chat",
  "POST client/accept": "Accepted the client",
  "POST client/pause": "Paused the plan",
  "POST client/resume": "Restarted the plan",
  "POST client/screening/review": "Reviewed the health check",
  "POST bulk-plan": "Added a plan to several clients",
  "GET prize-claims": "Opened the prize claims (bank details)",
  "PATCH prize-claim": "Decided a prize claim",
  "PUT member/assignment": "Changed the dietitian",
};
const wordsFor = (action) => WORDS[action] ?? action;

function Log() {
  // The newest 50 come from useApi; "Load older" adds the next pages after them.
  const first = useApi("/admin/access-log?limit=50");
  const [older, setOlder] = useState([]);
  const [next, setNext] = useState(undefined); // undefined: use the first page's own "next"
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const entries = first.data ? [...first.data.entries, ...older] : null;
  const after = next === undefined ? first.data?.next ?? null : next;

  const loadOlder = async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const data = await api(`/admin/access-log?limit=50&before=${after}`);
      setOlder((old) => [...old, ...data.entries]);
      setNext(data.next);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoadingMore(false);
    }
  };
  const reload = () => {
    setOlder([]);
    setNext(undefined);
    first.reload();
  };

  const columns = [
    { key: "at", header: "When", nowrap: true, sort: (e) => Number(e.id), cell: (e) => fmtDateTime(e.at) },
    {
      key: "who", header: "Who", sort: (e) => e.actorName,
      cell: (e) => (
        <span>
          {e.actorName || e.actorId} <Badge tone={e.actorRole === "admin" ? "neutral" : "good"}>{e.actorRole === "admin" ? "Admin" : "Dietitian"}</Badge>
        </span>
      ),
    },
    { key: "what", header: "What", sort: (e) => wordsFor(e.action), cell: (e) => wordsFor(e.action) },
    {
      key: "member", header: "Member", sort: (e) => e.memberName,
      cell: (e) => (e.memberId ? <Link href={`/clients/${encodeURIComponent(e.memberId)}`} className="font-medium text-brand hover:underline">{e.memberName || e.memberId}</Link> : <span className="text-muted">Many members</span>),
    },
  ];

  return (
    <>
      <PageHeader title="Access log" subtitle="Every time staff looked at or changed a member's data. Looking at the same thing again within five minutes is recorded once." />
      {first.error || error ? <div className="mb-4"><Alert action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>{error ?? messageOf(first.error)}</Alert></div> : null}
      {!entries && !first.error ? <PageSpinner /> : null}
      {entries ? (
        <ListTable
          label="Access log"
          rows={entries}
          rowKey={(e) => e.id}
          columns={columns}
          defaultSort="-at"
          noun="entry"
          plural="entries"
          empty={{ title: "Nothing recorded yet", text: "Entries appear when staff open a client's page or change their plan." }}
          footer={
            after ? (
              <Button variant="secondary" size="sm" loading={loadingMore} onClick={loadOlder}>
                Load older
              </Button>
            ) : null
          }
        />
      ) : null}
    </>
  );
}

export default function AccessLogPage() {
  return (
    <AdminOnly>
      <Log />
    </AdminOnly>
  );
}
