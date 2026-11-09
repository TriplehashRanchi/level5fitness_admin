"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { adherencePercent, fmtKg, GOAL_LABEL } from "@/lib/body";
import { ConsoleIcon } from "@/components/console-icon";
import { Alert, Avatar, Badge, Button, Card, CardTitle, EmptyState, StatCard } from "@/components/ui";

function DashboardHeader({ request, role }) {
  const { staff } = useAuth();
  const name = staff?.name?.trim().split(/\s+/)[0];
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
      <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand" />L5 FITNESS <span className="text-zinc-600">/</span> {role} workspace</span>
      <span aria-live="polite">{request.refreshing ? "Loading latest records…" : request.loadedAt ? `Loaded at ${new Date(request.loadedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · your local time` : "Data unavailable"}</span>
    </div>
    <section className="relative mb-8 overflow-hidden rounded-3xl border border-white/10">
      <Image src={role === "Admin" ? "/images/gym-1.jpg" : "/images/gym-3.jpg"} alt="" fill priority sizes="(min-width: 1024px) 75vw, 100vw" className={role === "Admin" ? "object-cover object-[50%_15%]" : "object-cover object-[50%_36%]"} />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-ink/0" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/60 to-transparent" />
      <div className="relative flex flex-wrap items-end justify-between gap-6 px-6 py-12 sm:px-10 sm:py-24">
        <div className="max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[3px] text-brand">{role} workspace</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.08]">{name ? <>Welcome back, <span className="text-brand">{name}.</span></> : "Your gym, at a glance."}</h1>
          <p className="mt-4 text-sm leading-7 text-zinc-300">{role === "Admin" ? "The people, plans and priorities behind a stronger gym." : "A clear view of your clients and the plans they need."}</p>
        </div>
        <Button variant="secondary" onClick={request.reload} disabled={request.refreshing}><ConsoleIcon name="refresh" size={16} className={request.refreshing ? "animate-spin" : ""} />{request.refreshing ? "Refreshing" : "Refresh data"}</Button>
      </div>
    </section>
  </>;
}

function LoadingOverview() {
  return <div role="status" aria-label="Loading dashboard" className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((key) => <div key={key} className="h-36 rounded-2xl border border-line bg-card"><div className="m-5 h-2 w-20 rounded bg-card-2" /><div className="mx-5 h-8 w-16 rounded bg-card-2" /></div>)}</div>
    <div className="h-72 rounded-2xl border border-line bg-card" /><span className="sr-only">Loading dashboard records…</span>
  </div>;
}

function Failure({ error, reload }) {
  return <Card><div className="mb-5"><ConsoleIcon name="refresh" size={26} className="text-muted" /></div><h2 className="text-lg font-semibold text-white">We couldn’t load the overview</h2><p className="mb-5 mt-2 text-sm text-muted">The figures are unavailable until we can reach your records.</p><Alert action={<Button variant="secondary" size="sm" onClick={reload}>Try again</Button>}>{messageOf(error)}</Alert></Card>;
}

function Completion({ done, planned }) {
  const percentage = adherencePercent(done, planned);
  const bounded = Math.min(100, Math.max(0, percentage ?? 0));
  const circumference = 2 * Math.PI * 57;
  return <Card className="h-full">
    <CardTitle action={<span className="text-xs text-muted">Last 7 calendar days</span>}>Diet plan completion</CardTitle>
    <div className="flex flex-wrap items-center gap-6 py-4">
      <div className="relative flex h-36 w-36 shrink-0 items-center justify-center" role="img" aria-label={percentage == null ? "No planned items to measure" : `${percentage}% of plan items completed`}>
        <svg width="144" height="144" viewBox="0 0 144 144" fill="none" className="absolute inset-0 -rotate-90" aria-hidden="true"><circle cx="72" cy="72" r="57" stroke="#272d29" strokeWidth="10" /><circle cx="72" cy="72" r="57" stroke="#c6f432" strokeWidth="10" strokeLinecap={bounded > 0 ? "round" : "butt"} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - bounded / 100)} /></svg>
        <div className="text-center"><p className="text-3xl font-semibold tracking-tight text-white">{percentage == null ? "–" : `${percentage}%`}</p><span className="text-[10px] text-muted">{percentage == null ? "No plans yet" : "completed"}</span></div>
      </div>
      <div className="min-w-40 flex-1">
        <p className="text-base font-semibold text-white">{planned > 0 ? "Small actions. Real consistency." : "A fresh start for your plans."}</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{planned > 0 ? `${done} of ${planned} scheduled plan items were marked complete by members.` : "Completion will appear once diet plan items have been scheduled. No percentage is calculated without a plan."}</p>
        <Link href="/clients" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-brand hover:underline">Review client plans <ConsoleIcon name="arrow" size={15} /></Link>
      </div>
    </div>
    <p className="mt-2 border-t border-line pt-4 text-[11px] leading-5 text-muted">Measures completion of scheduled items, including today. Based on member check-ins, not a measure of health outcomes.</p>
  </Card>;
}

function ActionLink({ href, title, detail, icon }) {
  return <Link href={href} className="group flex items-center gap-3 rounded-xl px-3 py-3.5 transition-colors hover:bg-white/5">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/8 text-brand"><ConsoleIcon name={icon} size={18} /></span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-white">{title}</span><span className="mt-1 block text-xs text-muted">{detail}</span></span>
    <ConsoleIcon name="arrow" size={16} className="text-muted group-hover:text-brand" />
  </Link>;
}

function AdminDashboard() {
  const request = useApi("/admin/overview");
  const { data, error } = request;
  const o = data?.overview;
  return <>
    <DashboardHeader request={request} role="Admin" />
    {error ? <Failure error={error} reload={request.reload} /> : !o ? <LoadingOverview /> : <>
      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total members" value={o.members} hint={`${o.newMembers7} joined in the last 7 days`} />
        <StatCard label="Workout participants" value={o.activeMembers7} hint={`${o.workouts7} workouts logged · last 7 days`} tone="brand" />
        <StatCard label="Active dietitians" value={o.dietitians} hint="Enabled staff accounts" />
        <StatCard label="Awaiting assignment" value={o.unassignedClients} hint="Shared profiles without a dietitian" tone={o.unassignedClients ? "warn" : undefined} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Completion done={o.done7} planned={o.planned7} />
        <Card>
          <CardTitle action={<Badge tone={o.unassignedClients || o.pendingInvites ? "warn" : "good"}>{o.unassignedClients || o.pendingInvites ? "Needs attention" : "Up to date"}</Badge>}>Your next steps</CardTitle>
          <p className="mb-4 text-xs leading-5 text-muted">A short list to keep your team connected.</p>
          <ActionLink href="/members" icon="members" title={o.unassignedClients ? `${o.unassignedClients} awaiting a dietitian` : "Member assignments are covered"} detail={o.unassignedClients ? "Connect shared member profiles with your team" : "Review members and their assignments"} />
          <div className="mx-3 border-t border-line" />
          <ActionLink href="/dietitians" icon="shield" title={o.pendingInvites ? `${o.pendingInvites} pending staff invitation${o.pendingInvites === 1 ? "" : "s"}` : "Manage your team"} detail={o.pendingInvites ? "Review invitations and staff access" : "Invite dietitians and review access"} />
        </Card>
      </div>
      <section className="mt-8" aria-labelledby="operations-title">
        <h2 id="operations-title" className="text-base font-semibold text-white">Keep things moving</h2><p className="mb-4 mt-1 text-xs text-muted">Your everyday tools, one step away.</p>
        <div className="grid gap-4 md:grid-cols-3">{[{ href: "/members", title: "Member directory", detail: "Profiles, sharing and assignments", icon: "members" }, { href: "/workouts", title: "Workout catalog", detail: "Exercises and training programs", icon: "workout" }, { href: "/classes", title: "Class timetable", detail: "Sessions, trainers and availability", icon: "calendar" }].map((item) => <div key={item.href} className="rounded-2xl border border-line bg-card p-2"><ActionLink {...item} /></div>)}</div>
      </section>
      <p className="mt-6 text-[11px] leading-5 text-muted">Source: L5 Fitness records. Weekly diet totals cover today and the preceding six calendar days in the server’s reporting timezone. New-member totals cover the past seven days.</p>
    </>}
  </>;
}

function DietitianDashboard() {
  const request = useApi("/dietitian/clients");
  const { data, error } = request;
  const clients = data?.clients ?? [];
  const planned = clients.reduce((sum, client) => sum + client.planned7, 0);
  const done = clients.reduce((sum, client) => sum + client.done7, 0);
  const needPlan = clients.filter((client) => client.planned7 === 0);
  return <>
    <DashboardHeader request={request} role="Dietitian" />
    {error ? <Failure error={error} reload={request.reload} /> : !data ? <LoadingOverview /> : <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Your clients" value={clients.length} hint="Assigned members sharing their details" />
        <StatCard label="Planned items" value={planned} hint="Today and the preceding six days" tone="brand" />
        <StatCard label="Without a recent plan" value={needPlan.length} hint="No items scheduled in the last 7 days" tone={needPlan.length ? "warn" : undefined} />
      </div>
      <div className="mt-6"><Completion done={done} planned={planned} /></div>
      <Card className="mt-6">
        <CardTitle action={<Link href="/clients" className="inline-flex items-center gap-2 text-xs font-semibold text-brand hover:underline">All clients <ConsoleIcon name="arrow" size={15} /></Link>}>Where to focus next</CardTitle>
        {clients.length === 0 ? <EmptyState title="Your client workspace starts here">The admin assigns members to you. Their profiles appear after they complete their fitness details and choose to share.</EmptyState> : needPlan.length === 0 ? <div className="flex items-start gap-3 rounded-2xl bg-brand/5 p-5"><ConsoleIcon name="check" className="shrink-0 text-brand" /><div><p className="text-sm font-semibold text-white">Every client has recent plan items.</p><p className="mt-1 text-xs leading-5 text-muted">Open your client list to review progress and plan the days ahead.</p></div></div> : <>
          <p className="mb-3 text-xs leading-5 text-muted">These clients have no plan items scheduled in the last seven calendar days.</p>
          <ul className="divide-y divide-line">{needPlan.slice(0, 8).map((client) => <li key={client.id}><Link href={`/clients/${encodeURIComponent(client.id)}`} className="flex flex-wrap items-center gap-3 rounded-xl px-2 py-4 transition-colors hover:bg-white/5"><Avatar name={client.name || client.email} image={client.image} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{client.name || client.email}</p><p className="mt-1 text-xs text-muted">{GOAL_LABEL[client.goal]} · {fmtKg(client.weightKg)} → {fmtKg(client.targetWeightKg)}</p></div><Badge tone="warn">No recent plan</Badge><ConsoleIcon name="arrow" size={16} className="text-muted" /></Link></li>)}</ul>
          {needPlan.length > 8 ? <Link href="/clients" className="mt-4 inline-block text-xs text-brand hover:underline">View all {needPlan.length} clients without recent plans</Link> : null}
        </>}
      </Card>
    </>}
  </>;
}

export default function DashboardPage() {
  const { staff } = useAuth();
  return staff?.role === "admin" ? <AdminDashboard /> : <DietitianDashboard />;
}
