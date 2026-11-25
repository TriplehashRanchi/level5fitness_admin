"use client";

import { useState } from "react";
import Link from "next/link";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { fmtDateTime, fullDate } from "@/lib/dates";
import AdminOnly from "@/components/admin-only";
import { Chevron, ListTable, PersonCell, TwoLine } from "@/components/table";
import { Alert, Badge, Button, cx, Lightbox, Modal, PageHeader, PageSpinner, StatCard, Textarea } from "@/components/ui";

const STATUS = {
  pending: { label: "Waiting for you", tone: "warn" },
  approved: { label: "Approved, not paid yet", tone: "good" },
  paid: { label: "Paid", tone: "good" },
  rejected: { label: "Rejected", tone: "bad" },
};
const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
  { id: "rejected", label: "Rejected" },
];
const PHOTOS = [
  { key: "bodyBefore", label: "Body, before" },
  { key: "bodyAfter", label: "Body, now" },
  { key: "scaleBefore", label: "Scale, before" },
  { key: "scaleAfter", label: "Scale, now" },
];
/** What the admin is about to do, and the words for it. */
const ACTIONS = {
  approved: { title: "Approve this claim?", confirm: "Approve", note: "A word for the member (optional)", help: "The member is told it is approved. Pay them next, then mark it as paid." },
  paid: { title: "Mark as paid?", confirm: "Mark as paid", note: "Payment reference (optional)", help: "Do this after the money has actually been sent. The member is told the prize is paid. This cannot be undone." },
  rejected: { title: "Reject this claim?", confirm: "Reject", note: "Why? The member sees this and can send the claim again.", help: "Say exactly what is wrong (for example: the scale photo is not readable)." },
};

const kg = (n) => `${parseFloat(Number(n).toFixed(1))} kg`;

function Detail({ label, children, mono }) {
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[130px_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className={cx("min-w-0 break-words text-sm text-white", mono ? "font-mono tracking-wide" : "")}>{children}</dd>
    </div>
  );
}

function CopyButton({ value, label }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // clipboard blocked: the value is on screen and can be selected by hand
        }
      }}
      className="ml-2 rounded-md px-1.5 py-0.5 text-xs font-semibold text-brand hover:bg-white/5"
      aria-label={`Copy ${label}`}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** Everything about one claim, shown in the dialog that opens from its row. */
function ClaimDetail({ claim, onPhoto }) {
  const status = STATUS[claim.status];
  const lost = claim.startWeightKg - claim.finalWeightKg;
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="truncate">{claim.memberEmail}{claim.dietitianName ? ` · Dietitian: ${claim.dietitianName}` : ""}</span>
        <Link href={`/clients/${encodeURIComponent(claim.memberId)}`} className="font-semibold text-brand hover:underline">Open profile</Link>
      </p>

      {/* what the app's own numbers say */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Lost", kg(lost)],
          ["Start weight", kg(claim.startWeightKg)],
          ["Lowest logged", kg(claim.finalWeightKg)],
          ["Reached on", fullDate(claim.reachedOn)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-card-2 px-4 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-white">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Challenge ran {fullDate(claim.startedOn)} to {fullDate(claim.endsOn)}. Weights are what the member typed in the app: check them against the scale photos.
      </p>

      {/* the proof */}
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PHOTOS.map((p, i) => (
          <li key={p.key}>
            <button type="button" onClick={() => onPhoto(claim, i)} className="group block w-full overflow-hidden rounded-2xl border border-line bg-black/40 text-left" aria-label={`Open photo: ${p.label}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={claim.photos[p.key]} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover transition-opacity group-hover:opacity-80" />
              <span className="block px-3 py-2 text-xs font-semibold text-zinc-200">{p.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* who and where to pay */}
      <dl className="mt-5 divide-y divide-line border-t border-line">
        <Detail label="Name">{claim.fullName}</Detail>
        <Detail label="Phone">{claim.phone}<CopyButton value={claim.phone} label="phone" /></Detail>
        <Detail label="Address">{claim.address}</Detail>
        {claim.payoutMethod === "upi" ? (
          <Detail label="Pay by UPI" mono>{claim.upiId}<CopyButton value={claim.upiId} label="UPI ID" /></Detail>
        ) : (
          <>
            <Detail label="Account name">{claim.accountName}</Detail>
            <Detail label="Account number" mono>{claim.accountNumber}<CopyButton value={claim.accountNumber} label="account number" /></Detail>
            <Detail label="IFSC" mono>{claim.ifsc}<CopyButton value={claim.ifsc} label="IFSC" /></Detail>
            {claim.bankName ? <Detail label="Bank">{claim.bankName}</Detail> : null}
          </>
        )}
        <Detail label="Sent">{fmtDateTime(claim.createdAt)}{claim.decidedAt ? ` · Last change ${fmtDateTime(claim.decidedAt)}` : ""}</Detail>
        {claim.adminNote ? <Detail label="Your note">{claim.adminNote}</Detail> : null}
      </dl>

    </div>
  );
}

function Claims() {
  const [filter, setFilter] = useState("all");
  const { data, latest, error, reload } = useApi(`/admin/claims${filter === "all" ? "" : `?status=${filter}`}`);
  const list = data ?? latest;
  const [acting, setActing] = useState(null); // { claim, status }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actError, setActError] = useState(null);
  const [viewer, setViewer] = useState(null); // { photos, index }
  /** The claim being looked at, by id: after a change the fresh one from the list is shown. */
  const [reviewId, setReviewId] = useState(null);
  const reviewing = list?.claims.find((c) => c.id === reviewId) ?? null;

  const counts = list?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const open = (claim, status) => {
    setActing({ claim, status });
    setNote("");
    setActError(null);
  };
  const confirm = async () => {
    if (!acting) return;
    setBusy(true);
    setActError(null);
    try {
      await api(`/admin/claims/${acting.claim.id}`, { method: "PATCH", body: { status: acting.status, note: note.trim() || undefined } });
      setActing(null);
      reload();
    } catch (e) {
      setActError(e);
    } finally {
      setBusy(false);
    }
  };
  const action = acting ? ACTIONS[acting.status] : null;

  const columns = [
    { key: "member", header: "Member", sort: (c) => c.memberName || c.memberEmail, cell: (c) => <PersonCell name={c.memberName} email={c.memberEmail} image={c.memberImage} /> },
    { key: "lost", header: "Lost", nowrap: true, sort: (c) => c.startWeightKg - c.finalWeightKg, cell: (c) => <TwoLine main={kg(c.startWeightKg - c.finalWeightKg)} note={`${kg(c.startWeightKg)} → ${kg(c.finalWeightKg)}`} /> },
    { key: "reached", header: "Reached on", nowrap: true, sort: (c) => c.reachedOn, cell: (c) => fullDate(c.reachedOn) },
    { key: "pay", header: "Pay by", nowrap: true, sort: (c) => c.payoutMethod, cell: (c) => <TwoLine main={c.payoutMethod === "upi" ? "UPI" : "Bank transfer"} note={c.payoutMethod === "upi" ? c.upiId : c.bankName || c.accountName} /> },
    { key: "sent", header: "Sent", nowrap: true, muted: true, sort: (c) => c.createdAt, cell: (c) => fmtDateTime(c.createdAt) },
    { key: "status", header: "Status", sort: (c) => ({ pending: 0, approved: 1, paid: 2, rejected: 3 })[c.status], cell: (c) => <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge> },
    { key: "open", header: "Review", hidden: true, align: "right", cell: () => <span className="inline-flex text-muted"><Chevron /></span> },
  ];

  return (
    <>
      <PageHeader title="Prize claims" subtitle={`Members who finished the 90-day challenge and asked for the ${list?.prize ?? "prize"}. Check the photos, then approve and pay.`} />

      {error ? <div className="mb-5"><Alert action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>{messageOf(error)}</Alert></div> : null}

      {list ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Joined the challenge" value={list.totals.joined} />
          <StatCard label="Reached the goal" value={list.totals.completed} tone="brand" hint="By the weights logged in the app" />
          <StatCard label="Waiting for you" value={counts.pending ?? 0} tone={counts.pending ? "warn" : undefined} />
          <StatCard label="Paid" value={counts.paid ?? 0} />
        </div>
      ) : null}

      {!list && !error ? <PageSpinner /> : null}

      {list ? (
        <ListTable
          label="Prize claims"
          minWidth={900}
          rows={list.claims}
          rowKey={(c) => c.id}
          columns={columns}
          onOpen={(c) => setReviewId(c.id)}
          filters={{ options: FILTERS.map((f) => ({ ...f, count: f.id === "all" ? total : counts[f.id] ?? 0 })), value: filter, onChange: setFilter, label: "Filter claims" }}
          noun="claim"
          empty={{
            title: filter === "all" ? "No claims yet" : "No claims in this view",
            text: filter === "all" ? "When a member loses 10 kg inside their 90 days and fills in the claim form in the app, it shows up here." : "Try another filter.",
            action: filter === "all" ? null : <Button variant="secondary" size="sm" onClick={() => setFilter("all")}>Show all claims</Button>,
          }}
        />
      ) : null}

      {/* One claim, opened from its row: the proof, where to pay, and the decision. */}
      <Modal
        open={!!reviewing}
        onClose={() => setReviewId(null)}
        title={reviewing ? `Claim from ${reviewing.fullName}` : ""}
        wide
        footer={
          reviewing ? (
            <>
              <Button variant="secondary" onClick={() => setReviewId(null)}>Close</Button>
              {reviewing.status === "pending" || reviewing.status === "approved" ? <Button variant="danger" onClick={() => open(reviewing, "rejected")}>Reject</Button> : null}
              {reviewing.status === "pending" ? <Button onClick={() => open(reviewing, "approved")}>Approve</Button> : null}
              {reviewing.status === "approved" ? <Button onClick={() => open(reviewing, "paid")}>Mark as paid</Button> : null}
            </>
          ) : null
        }
      >
        {reviewing ? <ClaimDetail claim={reviewing} onPhoto={(claim, index) => setViewer({ photos: PHOTOS.map((p) => ({ url: claim.photos[p.key], caption: p.label, note: claim.fullName })), index })} /> : null}
      </Modal>

      <Modal
        open={!!acting}
        onClose={() => !busy && setActing(null)}
        title={action?.title ?? ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setActing(null)} disabled={busy}>Cancel</Button>
            <Button variant={acting?.status === "rejected" ? "danger" : "primary"} onClick={confirm} loading={busy}>{action?.confirm}</Button>
          </>
        }
      >
        {acting ? (
          <>
            <p className="text-sm leading-6 text-zinc-300">{acting.claim.fullName} · {kg(acting.claim.startWeightKg - acting.claim.finalWeightKg)} lost</p>
            <p className="mt-2 text-sm leading-6 text-muted">{action.help}</p>
            <label htmlFor="claim-note" className="mt-4 block text-xs font-medium text-muted">{action.note}</label>
            <Textarea id="claim-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="mt-1.5" />
            {actError ? <p className="mt-3 text-sm font-semibold text-accent" role="alert">{messageOf(actError)}</p> : null}
          </>
        ) : null}
      </Modal>

      <Lightbox photos={viewer?.photos ?? []} index={viewer?.index ?? null} onClose={() => setViewer(null)} onIndex={(index) => setViewer((v) => (v ? { ...v, index } : v))} />
    </>
  );
}

export default function ClaimsPage() {
  return (
    <AdminOnly>
      <Claims />
    </AdminOnly>
  );
}
