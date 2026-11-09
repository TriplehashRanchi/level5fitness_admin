"use client";

import { useEffect, useMemo, useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime, timeAgo } from "@/lib/dates";
import { browserAlertState, browserAlertSupport, disableBrowserAlerts, enableBrowserAlerts } from "@/lib/web-push";
import { ConsoleIcon } from "@/components/console-icon";
import { Alert, Avatar, Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";

const TITLE_MAX = 60;
const BODY_MAX = 240;

const AUDIENCES = {
  admin: [
    { value: "everyone", label: "Everyone", hint: "All members and active dietitians" },
    { value: "all_members", label: "All members", hint: "Everybody using the app" },
    { value: "all_dietitians", label: "All dietitians", hint: "Your active team" },
    { value: "user", label: "One person", hint: "A single member" },
  ],
  dietitian: [
    { value: "my_clients", label: "All my clients", hint: "Clients assigned to you who share their details" },
    { value: "user", label: "One client", hint: "A single client of yours" },
  ],
};

const SCREENS = [
  { value: "inbox", label: "Notifications inbox" },
  { value: "home", label: "Home" },
  { value: "diet", label: "Diet plan" },
  { value: "logs", label: "Workout logs" },
];

const TEMPLATES = {
  admin: [
    { label: "Class reminder", title: "Class starts soon", body: "Your class begins in 30 minutes. See you on the floor!", screen: "home" },
    { label: "Gym update", title: "A quick update from L5 Fitness", body: "We have some news for you. Open the app to read it.", screen: "inbox" },
    { label: "Motivation", title: "Small steps, big change", body: "Log today's workout and keep your streak going. You've got this.", screen: "home" },
  ],
  dietitian: [
    { label: "Plan updated", title: "Your plan is ready", body: "I've updated your diet plan. Open it and tick items off as you go.", screen: "diet" },
    { label: "Water reminder", title: "Time for water", body: "Have a glass of water now and log it in the app.", screen: "home" },
    { label: "Check-in", title: "How was your day?", body: "Tick off today's meals so I can see how it went and adjust your plan.", screen: "diet" },
  ],
};

const AUDIENCE_LABEL = { everyone: "Everyone", all_members: "All members", all_dietitians: "All dietitians", my_clients: "All my clients", user: "One person" };

/** What the phone's lock screen would show. */
function PhonePreview({ title, body }) {
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-[2.2rem] border border-white/12 bg-gradient-to-b from-zinc-800 to-zinc-950 p-3 shadow-2xl shadow-black/50">
      <div className="rounded-[1.7rem] bg-[#0f1411] px-3 pb-6 pt-4" style={{ minHeight: 250 }}>
        <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-white/15" />
        <p className="text-center text-4xl font-light tracking-tight text-white">9:41</p>
        <p className="mb-5 mt-1 text-center text-[11px] text-zinc-400">Lock screen preview</p>
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand text-[8px] font-black text-ink">L5</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-300">L5 Fitness</span>
            <span className="ml-auto text-[10px] text-zinc-400">now</span>
          </div>
          <p className="break-words text-[13px] font-semibold leading-4 text-white">{title.trim() || "Your title appears here"}</p>
          <p className="mt-1 line-clamp-3 break-words text-xs leading-4 text-zinc-300">{body.trim() || "Your message appears here. Keep it short and clear."}</p>
        </div>
      </div>
    </div>
  );
}

/** Pick one person. Admin searches all members; a dietitian picks from their own clients. */
function PersonPicker({ role, value, onChange }) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);
  const path = role === "admin" ? `/admin/members?q=${encodeURIComponent(query)}` : "/dietitian/clients";
  const { data, error, loading } = useApi(path);
  const list = useMemo(() => {
    const all = (role === "admin" ? data?.members : data?.clients) ?? [];
    const needle = text.trim().toLowerCase();
    const filtered = role === "admin" || !needle ? all : all.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(needle));
    return filtered.slice(0, 6);
  }, [data, role, text]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand/5 px-4 py-3">
        <Avatar name={value.name || value.email} image={value.image} size={34} />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{value.name || value.email}</p><p className="truncate text-xs text-muted">{value.email}</p></div>
        <Button variant="secondary" size="sm" onClick={() => onChange(null)}>Change</Button>
      </div>
    );
  }
  return (
    <div>
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={role === "admin" ? "Search a member by name or email" : "Search your clients"} aria-label="Find a person" />
      <div className="mt-2 space-y-1" aria-live="polite">
        {error ? <p className="px-1 text-xs text-accent">{messageOf(error)}</p> : loading && !list.length ? <p className="px-1 text-xs text-muted">Searching…</p> : list.length === 0 ? <p className="px-1 text-xs text-muted">Nobody found.</p> : list.map((p) => (
          <button key={p.id} type="button" onClick={() => onChange(p)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5">
            <Avatar name={p.name || p.email} image={p.image} size={30} />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{p.name || p.email}</span><span className="block truncate text-xs text-muted">{p.email}</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}


/** Alerts on this computer: a dietitian gets the admin's messages as a browser notification. */
function BrowserAlerts() {
  const [state, setState] = useState(null); // null until the browser has been asked
  const [support, setSupport] = useState("ok");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const kind = browserAlertSupport();
    (async () => {
      let next = "off";
      if (kind === "ok") {
        next = browserAlertState();
        // Already allowed in this browser (for example after signing in again): connect quietly.
        if (next === "off" && Notification.permission === "granted") {
          next = await enableBrowserAlerts({ timeoutMs: 10_000 }).then(() => "on").catch(() => "off");
        }
      }
      if (!cancelled) {
        setSupport(kind);
        setState(next);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await enableBrowserAlerts();
      setState("on");
    } catch (e) {
      setProblem(messageOf(e));
      setState(browserAlertState());
    } finally {
      setBusy(false);
    }
  };
  const turnOff = async () => {
    setBusy(true);
    await disableBrowserAlerts();
    setState("off");
    setBusy(false);
  };

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Alerts on this computer {state === "on" ? <Badge tone="good">On</Badge> : state === "blocked" ? <Badge tone="warn">Blocked</Badge> : null}</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {support === "unsupported" ? "This browser cannot show alerts. Try Chrome, Edge or Firefox."
                : support === "not-configured" ? "Browser alerts are not set up yet. Add the Firebase sender ID and web push key to this console's .env."
                : state === "blocked" ? "You blocked notifications for this site. Allow them from the lock icon in the address bar, then reload."
                : state === "on" ? "You will see a notification here whenever the admin sends you a message, even if this tab is closed."
                : "Get the admin's messages as a notification on this computer, even when this tab is closed."}
            </p>
            {problem ? <p className="mt-2 text-xs text-accent" role="alert">{problem}</p> : null}
          </div>
        </div>
        {support === "ok" && state !== "blocked" ? (
          state === null ? <Button variant="secondary" size="sm" disabled loading>Checking</Button>
            : state === "on" ? <Button variant="secondary" size="sm" onClick={turnOff} loading={busy}>Turn off</Button>
            : <Button size="sm" onClick={turnOn} loading={busy}>Turn on alerts</Button>
        ) : null}
      </div>
    </Card>
  );
}

/** What the admin sent to this dietitian. */
function Received() {
  const { data, error, reload } = useApi("/notifications");
  const [busy, setBusy] = useState(false);
  const list = data?.notifications ?? [];
  const markAll = async () => {
    setBusy(true);
    try {
      await api("/notifications/read", { method: "POST", body: {} });
      reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mb-6">
      <CardTitle action={data?.unread ? <Button variant="secondary" size="sm" onClick={markAll} loading={busy}>Mark all read</Button> : null}>
        From the admin {data?.unread ? <Badge tone="brand">{data.unread} new</Badge> : null}
      </CardTitle>
      {error ? <Alert>{messageOf(error)}</Alert> : !data ? <p className="py-4 text-sm text-muted">Loading…</p> : list.length === 0 ? (
        <p className="py-2 text-sm text-muted">Messages from the admin will appear here.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.slice(0, 8).map((n) => (
            <li key={n.id} className="py-3.5">
              <div className="flex items-center gap-2">
                {!n.read ? <span className="h-2 w-2 rounded-full bg-brand" aria-label="Unread" /> : null}
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{n.title}</p>
                <span className="text-[11px] text-zinc-500">{timeAgo(n.createdAt)}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Composer({ role, onSent }) {
  const audiences = AUDIENCES[role];
  const [audience, setAudience] = useState(audiences[0].value);
  const [person, setPerson] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [screen, setScreen] = useState("inbox");
  const [reach, setReach] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState(null);

  const target = audience === "user" ? person?.id : "all";
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    api(`/staff/notifications/reach?audience=${audience}${audience === "user" ? `&userId=${encodeURIComponent(person.id)}` : ""}`)
      .then((r) => !cancelled && setReach(r))
      .catch(() => !cancelled && setReach(null));
    return () => { cancelled = true; };
  }, [audience, person, target]);

  const ready = title.trim().length > 0 && body.trim().length > 0 && !!target;
  const broad = audience !== "user";
  const reachNow = target ? reach : null;

  const send = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await api("/staff/notifications", { method: "POST", body: { audience, userId: person?.id, title: title.trim(), body: body.trim(), screen } });
      const people = res.notification.recipientCount;
      setNotice({ tone: "good", text: `Sent to ${people} ${people === 1 ? "person" : "people"}. ${res.devices} phone${res.devices === 1 ? "" : "s"} will get the alert now; everyone else sees it in their app inbox.` });
      setTitle("");
      setBody("");
      onSent();
    } catch (e) {
      setNotice({ tone: "bad", text: messageOf(e) });
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <Card>
      <CardTitle>New notification</CardTitle>
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (!ready) return; broad ? setConfirm(true) : send(); }}>
          {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
          <Field label="Send to" hint={audiences.find((a) => a.value === audience)?.hint}>
            <Select value={audience} onChange={(e) => { setAudience(e.target.value); setPerson(null); setReach(null); }}>
              {audiences.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </Select>
          </Field>
          {audience === "user" ? <PersonPicker role={role} value={person} onChange={(p) => { setPerson(p); setReach(null); }} /> : null}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Quick start</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES[role].map((t) => (
                <button key={t.label} type="button" onClick={() => { setTitle(t.title); setBody(t.body); setScreen(t.screen); }} className="rounded-full border border-line bg-card-2 px-3.5 py-1.5 text-xs text-zinc-200 transition-colors hover:border-brand/50 hover:text-brand">{t.label}</button>
              ))}
            </div>
          </div>

          <Field label="Title" hint={`${title.length}/${TITLE_MAX}`}>
            <Input value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="A short headline" required />
          </Field>
          <Field label="Message" hint={`${body.length}/${BODY_MAX}. Phones show about two lines, so put the key point first.`}>
            <Textarea value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} placeholder="What should they know or do?" required />
          </Field>
          <Field label="When they tap it, open" hint="Where the app takes the person.">
            <Select value={screen} onChange={(e) => setScreen(e.target.value)}>{SCREENS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="text-xs leading-5 text-muted" aria-live="polite">
              {reachNow ? <><span className="font-semibold text-white">{reachNow.people}</span> {reachNow.people === 1 ? "person" : "people"} · <span className="font-semibold text-brand">{reachNow.withPhone}</span> with notifications on. Everyone also gets it in their app inbox.</> : target ? "Counting who this reaches…" : "Choose who to send to."}
            </p>
            <Button type="submit" disabled={!ready || busy || reachNow?.people === 0} loading={busy && !confirm}><ConsoleIcon name="arrow" size={16} />Send notification</Button>
          </div>
        </form>
        <div><p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted">Preview</p><PhonePreview title={title} body={body} /></div>
      </div>
      <ConfirmDialog open={confirm} title="Send to a large group?" message={`This sends “${title.trim()}” to ${reachNow?.people ?? "many"} people (${AUDIENCE_LABEL[audience]}). It cannot be unsent.`} confirmLabel="Send now" busy={busy} onConfirm={send} onCancel={() => setConfirm(false)} />
    </Card>
  );
}

function History({ request }) {
  const { data, error } = request;
  const list = data?.notifications ?? [];
  return (
    <Card className="mt-6">
      <CardTitle action={<span className="text-xs text-muted">Your last 30</span>}>Sent notifications</CardTitle>
      {error ? <Alert>{messageOf(error)}</Alert> : !data ? <p className="py-6 text-sm text-muted">Loading…</p> : list.length === 0 ? <EmptyState title="Nothing sent yet">Your notifications will be listed here, with how many people opened them.</EmptyState> : (
        <ul className="divide-y divide-line">
          {list.map((n) => (
            <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{n.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{n.body}</p>
                <p className="mt-2 text-[11px] text-zinc-500">{fmtDateTime(n.createdAt)} · {n.audience === "user" ? n.toName || "One person" : AUDIENCE_LABEL[n.audience]}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{n.recipientCount} {n.recipientCount === 1 ? "person" : "people"}</Badge>
                <Badge tone={n.pushSent ? "brand" : "neutral"}>{n.pushSent} alerted</Badge>
                <Badge tone={n.readCount ? "good" : "neutral"}>{n.readCount} read</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function NotificationsPage() {
  const { staff } = useAuth();
  const role = staff?.role === "admin" ? "admin" : "dietitian";
  const history = useApi("/staff/notifications");
  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={role === "admin" ? "Send announcements to your members and team. They arrive as a phone alert and wait in the app inbox." : "Send a nudge to your clients. They arrive as a phone alert and wait in the app inbox."}
      />
      {role === "dietitian" ? <><BrowserAlerts /><Received /></> : null}
      <Composer role={role} onSent={history.reload} />
      <History request={history} />
    </>
  );
}
