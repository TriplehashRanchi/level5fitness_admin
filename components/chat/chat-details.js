"use client";

import Link from "next/link";
import { useApi } from "@/lib/use-api";
import { adherencePercent, DIET_LABEL, fmtKg, GOAL_LABEL, goalRemaining } from "@/lib/body";
import { timeAgo } from "@/lib/dates";
import { OnlineDot } from "@/components/chat/chat-panel";
import { Avatar, Badge, Chip, cx, Skeleton } from "@/components/ui";

const ok = (v) => typeof v === "number" && Number.isFinite(v);
const splitList = (text) => String(text ?? "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

function Fact({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium text-white">{children}</dd>
    </div>
  );
}

function Shortcut({ href, children }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card-2/60 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:border-brand/40 hover:text-brand">
      {children}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}

const Heading = ({ children }) => <h3 className="mb-1 mt-6 text-[10px] font-semibold uppercase tracking-[2px] text-muted">{children}</h3>;

/** For a dietitian: what to keep in mind while writing to this client. */
function ClientFacts({ id }) {
  const { data, error } = useApi(`/dietitian/clients/${encodeURIComponent(id)}`);
  if (error) return <p className="mt-6 text-xs leading-5 text-muted">The profile could not be loaded just now. The chat still works.</p>;
  if (!data) return <div className="mt-6 space-y-3" role="status" aria-label="Loading the profile…"><Skeleton className="h-20 w-full" /><Skeleton className="h-28 w-full" /></div>;
  const p = data.profile ?? {};
  const percent = adherencePercent(data.adherence?.done, data.adherence?.planned);
  const allergies = splitList(p.allergies);
  const base = `/clients/${encodeURIComponent(id)}`;
  return (
    <>
      <Heading>Diet plan, last 7 days</Heading>
      <div className="rounded-2xl border border-line bg-card-2/60 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className={cx("text-2xl font-semibold tabular-nums", percent == null ? "text-muted" : percent >= 70 ? "text-brand" : "text-white")}>{percent == null ? "–" : `${percent}%`}</p>
          <p className="text-xs text-muted">{data.adherence?.planned ? `${data.adherence.done} of ${data.adherence.planned} items done` : "Nothing planned"}</p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={cx("h-full rounded-full", percent != null && percent >= 70 ? "bg-brand" : "bg-warn")} style={{ width: `${Math.min(100, percent ?? 0)}%` }} /></div>
      </div>

      <Heading>About</Heading>
      <dl className="divide-y divide-line">
        <Fact label="Goal">{GOAL_LABEL[p.goal] ?? "–"}</Fact>
        <Fact label="Weight">{ok(p.weightKg) ? fmtKg(p.weightKg) : "–"}{ok(p.targetWeightKg) ? <span className="font-normal text-muted"> → {fmtKg(p.targetWeightKg)}</span> : null}</Fact>
        {ok(p.weightKg) && ok(p.targetWeightKg) && p.goal ? <Fact label="To go">{goalRemaining(p.goal, p.weightKg, p.targetWeightKg)}</Fact> : null}
        <Fact label="Food">{DIET_LABEL[p.dietType] ?? "–"}</Fact>
        {ok(p.age) ? <Fact label="Age">{p.age}</Fact> : null}
      </dl>

      {allergies.length ? (
        <>
          <Heading>Allergies</Heading>
          <ul className="mt-2 flex flex-wrap gap-1.5">{allergies.map((a) => <li key={a}><Chip tone="warn">{a}</Chip></li>)}</ul>
        </>
      ) : null}
      {p.medicalNotes ? (
        <>
          <Heading>Medical notes</Heading>
          <p className="mt-2 whitespace-pre-line text-xs leading-5 text-zinc-300">{p.medicalNotes}</p>
        </>
      ) : null}

      <Heading>Go to</Heading>
      <div className="mt-2 space-y-2">
        <Shortcut href={`${base}#diet-plan`}>Diet plan</Shortcut>
        <Shortcut href={`${base}#exercise`}>Exercise plan</Shortcut>
        <Shortcut href={`${base}#daily-check`}>Daily check</Shortcut>
        <Shortcut href={base}>Full profile</Shortcut>
      </div>
    </>
  );
}

/** For the admin: the dietitian at a glance. */
function DietitianFacts({ id }) {
  const { data } = useApi("/admin/dietitians");
  const d = data?.dietitians?.find((x) => x.id === id);
  return (
    <>
      <Heading>About</Heading>
      {!data ? <Skeleton className="mt-2 h-24 w-full" /> : (
        <dl className="divide-y divide-line">
          <Fact label="Status">{d?.disabled ? <Badge tone="bad">Disabled</Badge> : <Badge tone="good">Active</Badge>}</Fact>
          <Fact label="Clients">{d?.clients ?? "–"}</Fact>
          <Fact label="Last in the app">{d?.lastSeenAt ? timeAgo(d.lastSeenAt) : "–"}</Fact>
        </dl>
      )}
      <Heading>Go to</Heading>
      <div className="mt-2 space-y-2">
        <Shortcut href="/dietitians">Manage dietitians</Shortcut>
        <Shortcut href="/members">Assign members</Shortcut>
        <Shortcut href="/clients">All clients</Shortcut>
      </div>
    </>
  );
}

/**
 * The column beside an open conversation: who you are talking to, what matters about them, and the
 * places you are most likely to go next. `c` is the conversation from the inbox.
 */
export default function ChatDetails({ c, isAdmin, onClose }) {
  return (
    <div className="chat-scroll h-full overflow-y-auto p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Details</h2>
        <button type="button" onClick={onClose} aria-label="Hide details" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-white">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div className="mt-4 flex flex-col items-center text-center">
        <span className="relative"><Avatar name={c.name} image={c.image} size={84} /><OnlineDot online={c.online} className="h-4 w-4 border-panel" /></span>
        <p className="mt-3 max-w-full truncate text-base font-semibold text-white">{c.name}</p>
        {c.kind === "staff" && !isAdmin ? <p className="text-xs text-muted">Gym management</p> : c.email && c.email !== c.name ? <p className="max-w-full truncate text-xs text-muted">{c.email}</p> : null}
        <div className="mt-2"><Badge tone={c.kind === "client" ? "brand" : "sky"}>{c.kind === "client" ? "Your client" : isAdmin ? "Dietitian" : "Admin"}</Badge></div>
      </div>
      {c.kind === "client" ? <ClientFacts id={c.id} /> : isAdmin ? <DietitianFacts id={c.id} /> : (
        <p className="mt-6 text-xs leading-5 text-muted">Write to the admin about your clients, your schedule or anything you need. They are told in the console.</p>
      )}
    </div>
  );
}
