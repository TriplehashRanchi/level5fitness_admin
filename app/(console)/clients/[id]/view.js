"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth";
import { ACTIVITY_LABEL, bmi, bmiBand, DIET_LABEL, SEX_LABEL } from "@/lib/body";
import { deriveStats, lastSevenDays, recentWeekStarts } from "@/lib/client-stats";
import { dayLabel, fmtTime, todayKey, weekOf } from "@/lib/dates";
import ClientChat from "@/components/client-chat";
import ClientDailyCheck from "@/components/client-daily-check";
import ClientDietPlan, { DayStrip } from "@/components/client-diet-plan";
import ClientHeader, { ClientHeaderSkeleton } from "@/components/client-header";
import ClientOverview from "@/components/client-overview";
import ClientTargets from "@/components/client-targets";
import ClientTrainingEditor from "@/components/client-training-editor";
import SectionNav from "@/components/section-nav";
import WeightChart from "@/components/weight-chart";
import { Chip, Empty, Section, SectionError, SectionSkeleton, Skeleton } from "@/components/ui";

const ok = (v) => typeof v === "number" && Number.isFinite(v);
/** "peanuts, dairy; shellfish" → ["peanuts", "dairy", "shellfish"] */
const splitList = (text) => String(text ?? "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

function Row({ label, children }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-white">{children}</dd>
    </div>
  );
}

const none = <span className="text-muted">None added</span>;

function HealthProfile({ profile: p }) {
  const allergies = splitList(p.allergies);
  const value = ok(p.weightKg) && ok(p.heightCm) ? bmi(p.weightKg, p.heightCm) : null;
  const band = value != null ? bmiBand(value) : null;
  return (
    <dl className="divide-y divide-line">
      <Row label="Allergies">
        {allergies.length ? <ul className="flex flex-wrap gap-2">{allergies.map((a) => <li key={a}><Chip tone="warn">{a}</Chip></li>)}</ul> : none}
      </Row>
      <Row label="Medical notes">{p.medicalNotes ? <p className="whitespace-pre-line leading-6">{p.medicalNotes}</p> : none}</Row>
      <Row label="Activity level">{ACTIVITY_LABEL[p.activityLevel] ?? <span className="text-muted">–</span>}</Row>
      <Row label="Food preference">{DIET_LABEL[p.dietType] ?? <span className="text-muted">–</span>}</Row>
      <Row label="Sex">{SEX_LABEL[p.sex] ?? <span className="text-muted">–</span>}</Row>
      <Row label="BMI">
        {value != null && Number.isFinite(value) ? <span className="tabular-nums">{value} <Chip tone={band.tone}>{band.label}</Chip></span> : <span className="text-muted">–</span>}
      </Row>
    </dl>
  );
}

function RecentWorkouts({ list, today }) {
  if (list.length === 0) return <Empty title="No workouts logged yet">Workouts the client records in the app are listed here.</Empty>;
  return (
    <ul className="divide-y divide-line">
      {list.map((d) => (
        <li key={d.day} className="py-3">
          <p className="text-sm font-semibold text-brand">{dayLabel(d.day, today)} <span className="font-normal tabular-nums text-muted">· {d.totalMinutes ?? 0} min · {d.totalCalories ?? 0} kcal</span></p>
          <ul className="mt-1 text-sm text-zinc-300">
            {(d.workouts ?? []).map((w) => (
              <li key={w.id}>{w.title} · <span className="tabular-nums">{w.durationMin} min{w.startedAt ? ` · ${fmtTime(w.startedAt)}` : ""}</span></li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export default function ClientPage() {
  const params = useParams();
  const isAdmin = useAuth().staff?.role === "admin";
  const id = decodeURIComponent(String(params.id));
  const enc = encodeURIComponent(id);
  const [today] = useState(todayKey);
  const [day, setDay] = useState(today);
  const week = weekOf(day);

  const detail = useApi(`/dietitian/clients/${enc}`);
  const plan = useApi(`/dietitian/clients/${enc}/plan?day=${day}&weekStart=${week[0]}`);
  const [startA, startB] = recentWeekStarts(today);
  const weekA = useApi(`/dietitian/clients/${enc}/week?weekStart=${startA}`);
  const weekB = useApi(startB ? `/dietitian/clients/${enc}/week?weekStart=${startB}` : null);

  const weeksLoading = weekA.loading || weekB.loading || (!weekA.data && !weekA.error) || (!!startB && !weekB.data && !weekB.error);
  const weeksError = weekA.error || weekB.error;
  const reloadWeeks = () => {
    weekA.reload();
    if (startB) weekB.reload();
  };
  const { days, targets } = lastSevenDays(today, [weekA.data, weekB.data]);
  const d = detail.data;
  const stats = deriveStats({ today, days, targets, adherence: d?.adherence, ready: !weeksLoading });

  if (detail.error) {
    return (
      <>
        <Link href={isAdmin ? "/members" : "/clients"} className="text-sm font-semibold text-brand hover:underline">← {isAdmin ? "Members" : "Clients"}</Link>
        <div className="mt-4">
          <SectionError onRetry={detail.reload}>{detail.error.status === 404 ? (isAdmin ? "This member has no client page yet. They need to finish their profile, agree to share it, and have a dietitian. You can assign a dietitian from Members." : "This client was not found, or is not assigned to you.") : messageOf(detail.error)}</SectionError>
        </div>
      </>
    );
  }

  const profile = d?.profile ?? {};
  const history = Array.isArray(d?.weightHistory) ? d.weightHistory : [];
  const workouts = Array.isArray(d?.recentWorkouts) ? d.recentWorkouts : [];
  const refreshAll = () => {
    plan.reload();
    detail.reload();
    reloadWeeks();
  };

  return (
    <div className="space-y-5 pb-16">
      <Link href="/clients" className="inline-block text-sm font-semibold text-brand hover:underline">← Clients</Link>

      {d ? <ClientHeader detail={d} stats={stats} ready={!weeksLoading} /> : <ClientHeaderSkeleton />}

      <SectionNav />

      <Section id="overview" title="Overview" description="The last 7 days, including today, against the targets.">
        {weeksError ? <div className="mb-4"><SectionError onRetry={reloadWeeks}>{messageOf(weeksError)}</SectionError></div> : null}
        <ClientOverview stats={stats} days={days} targets={targets} today={today} ready={!weeksLoading} />
        <h3 className="mb-2 mt-8 text-sm font-semibold text-zinc-200">Recent workouts</h3>
        {d ? <RecentWorkouts list={workouts} today={today} /> : <SectionSkeleton rows={2} label="Loading workouts…" />}
      </Section>

      <ClientChat memberId={id} name={d?.client?.name || d?.client?.email} />

      <ClientTargets memberId={id} onSaved={reloadWeeks} />

      <ClientDailyCheck memberId={id} refreshToken={0} />

      <Section
        id="diet-plan"
        title="Diet plan"
        description="Plan the meals the client should eat. Pick a day, then add items or copy the day before."
      >
        <div className="mb-5">
          <DayStrip day={day} setDay={setDay} week={week} today={today} summary={plan.data?.week ?? []} />
        </div>
        <ClientDietPlan id={id} day={day} today={today} plan={plan} onChanged={refreshAll} />
      </Section>

      <ClientTrainingEditor
        memberId={id}
        day={day}
        picker={<DayStrip day={day} setDay={setDay} week={week} today={today} />}
      />

      <Section id="progress" title="Progress" description="Weigh-ins from the app, measured against the client's start and target weight.">
        {!d ? <Skeleton className="h-64 w-full" /> : <WeightChart history={history} start={profile.startWeightKg} current={profile.weightKg} target={profile.targetWeightKg} />}
      </Section>

      <Section id="health" title="Health profile" description="Read-only details from the client's profile. Keep these in mind when planning meals and workouts.">
        {!d ? <SectionSkeleton rows={4} label="Loading the health profile…" /> : <HealthProfile profile={profile} />}
      </Section>
    </div>
  );
}
