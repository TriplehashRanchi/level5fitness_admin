"use client";

import { useMemo, useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { fmtDateTime, timeAgo } from "@/lib/dates";
import AdminOnly from "@/components/admin-only";
import { ListTable, MeterCell, PersonCell, RowButton } from "@/components/table";
import { Alert, Button, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, PageSpinner, Select, Switch } from "@/components/ui";

// About how many clients one dietitian looks after. The bar turns amber above this.
const CLIENT_LIMIT = 20;

function Dietitians() {
  const { data, error, reload } = useApi("/admin/dietitians");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: 'remove' | 'revoke', target }
  const [moveTo, setMoveTo] = useState("");
  const [moveError, setMoveError] = useState(null);
  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [show, setShow] = useState("all"); // all | active | disabled

  const activeCount = data ? data.dietitians.filter((d) => !d.disabled).length : 0;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.dietitians ?? []).filter(
      (d) => (show === "all" || (show === "disabled") === d.disabled) && (!q || `${d.name ?? ""} ${d.email}`.toLowerCase().includes(q))
    );
  }, [data, query, show]);
  const columns = [
    { key: "name", header: "Dietitian", sort: (d) => d.name || d.email, cell: (d) => <div className={d.disabled ? "opacity-55" : undefined}><PersonCell name={d.name} email={d.email} image={d.image} /></div> },
    {
      key: "clients", header: "Clients", sort: (d) => d.clients,
      cell: (d) => <MeterCell percent={(d.clients / CLIENT_LIMIT) * 100} text={`${d.clients} / ${CLIENT_LIMIT}`} tone={d.clients > CLIENT_LIMIT ? "bg-warn" : "bg-brand"} label={`${d.clients} clients, of about ${CLIENT_LIMIT}`} />,
    },
    { key: "seen", header: "Last seen", muted: true, nowrap: true, sort: (d) => (d.lastSeenAt ? -Date.parse(d.lastSeenAt) : null), cell: (d) => timeAgo(d.lastSeenAt) },
    {
      key: "status", header: "Can sign in", sort: (d) => (d.disabled ? 1 : 0),
      cell: (d) => (
        <div className="flex items-center gap-3">
          <Switch checked={!d.disabled} onChange={() => toggle(d)} disabled={busy} label={`${d.name || d.email} can sign in`} />
          <span className={d.disabled ? "text-xs font-semibold text-accent" : "text-xs text-muted"}>{d.disabled ? "Disabled" : "Active"}</span>
        </div>
      ),
    },
    {
      key: "remove", header: "Remove", hidden: true, align: "right",
      cell: (d) => (
        <RowButton label={`Remove ${d.name || d.email}`} tone="bad" onClick={() => openRemove(d)} disabled={busy}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
        </RowButton>
      ),
    },
  ];
  const inviteColumns = [
    { key: "email", header: "Email", cell: (i) => <span className="font-semibold text-white">{i.email}</span> },
    { key: "invited", header: "Invited", muted: true, nowrap: true, cell: (i) => fmtDateTime(i.invitedAt) },
    { key: "actions", header: "Actions", hidden: true, align: "right", cell: (i) => <Button variant="secondary" size="sm" onClick={() => setConfirm({ kind: "revoke", target: i })} disabled={busy}>Revoke</Button> },
  ];

  const act = async (fn, okText) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      if (okText) setNotice({ tone: "good", text: okText });
      reload();
    } catch (e) {
      setNotice({ tone: "bad", text: messageOf(e) });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const openRemove = (d) => {
    setMoveTo("");
    setMoveError(null);
    setConfirm({ kind: "remove", target: d });
  };

  const removeWithMove = async () => {
    const d = confirm.target;
    setBusy(true);
    setMoveError(null);
    try {
      const q = d.clients > 0 ? `?reassignTo=${encodeURIComponent(moveTo)}` : "";
      await api(`/admin/dietitians/${encodeURIComponent(d.id)}${q}`, { method: "DELETE" });
      setNotice({ tone: "good", text: d.clients > 0 ? `Dietitian removed. ${d.clients} client${d.clients === 1 ? "" : "s"} moved.` : "Dietitian removed." });
      setConfirm(null);
      reload();
    } catch (e) {
      if (e?.code === "HAS_CLIENTS") {
        // The count changed since this page loaded: refresh and ask again.
        setMoveError(`${messageOf(e)} Choose who should take them.`);
        reload();
        setConfirm((c) => (c && (c.target.clients ?? 0) === 0 ? { ...c, target: { ...c.target, clients: Math.max(1, c.target.clients ?? 0) } } : c));
      } else {
        setMoveError(messageOf(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const invite = async (e) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setInviteError(null);
    try {
      const res = await api("/admin/dietitians", { method: "POST", body: { email: address } });
      setInviting(false);
      setNotice({
        tone: "good",
        text:
          res.result === "promoted"
            ? `${res.email} is now a dietitian.`
            : `Invitation saved. ${res.email} becomes a dietitian the first time they sign in with that Google account.`,
      });
      reload();
    } catch (err) {
      setInviteError(messageOf(err)); // shown inside the dialog, which stays open
    } finally {
      setBusy(false);
    }
  };

  const openInvite = () => {
    setEmail("");
    setInviteError(null);
    setInviting(true);
  };

  const toggle = (d) =>
    act(() => api(`/admin/dietitians/${encodeURIComponent(d.id)}`, { method: "PATCH", body: { disabled: !d.disabled } }), d.disabled ? `${d.name || d.email} can sign in again.` : `${d.name || d.email} is disabled and cannot sign in.`);

  return (
    <>
      <PageHeader
        title="Dietitians"
        subtitle="Your team. A dietitian signs in with Google, after you invite their email address."
        actions={<Button onClick={openInvite}>+ Invite dietitian</Button>}
      />

      {notice ? <div className="mb-4"><Alert tone={notice.tone === "good" ? "good" : "bad"}>{notice.text}</Alert></div> : null}
      {error ? <div className="mb-4"><Alert action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>{messageOf(error)}</Alert></div> : null}
      {!data && !error ? <PageSpinner /> : null}

      {data ? (
        <>
          {data.dietitians.length === 0 ? (
            <EmptyState title="No dietitians yet" action={<Button onClick={openInvite}>+ Invite dietitian</Button>}>They appear here after their first sign-in.</EmptyState>
          ) : (
            <ListTable
              label="Dietitians"
              minWidth={680}
              rows={shown}
              rowKey={(d) => d.id}
              columns={columns}
              defaultSort="name"
              search={{ value: query, onChange: setQuery, placeholder: "Search by name or email", label: "Search dietitians" }}
              filters={{ options: [{ id: "all", label: "All", count: data.dietitians.length }, { id: "active", label: "Active", count: activeCount }, { id: "disabled", label: "Disabled", count: data.dietitians.length - activeCount }], value: show, onChange: setShow }}
              noun="dietitian"
              total={data.dietitians.length}
              empty={{ title: "No dietitians in this view", action: <Button variant="secondary" size="sm" onClick={() => { setQuery(""); setShow("all"); }}>Show all</Button> }}
            />
          )}

          {data.invites.length === 0 ? null : (
            <>
            <h2 className="mb-3 mt-8 text-base font-semibold text-white">Invited, not signed in yet</h2>
            <ListTable label="Pending invitations" minWidth={520} rows={data.invites} rowKey={(i) => i.email} columns={inviteColumns} noun="invitation" />
            </>
          )}
        </>
      ) : null}

      <Modal
        open={inviting}
        onClose={() => !busy && setInviting(false)}
        title="Invite a dietitian"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviting(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" form="invite-form" loading={busy}>Send invitation</Button>
          </>
        }
      >
        <form id="invite-form" onSubmit={invite} className="space-y-4">
          {inviteError ? <Alert>{inviteError}</Alert> : null}
          <Field label="Google email address" hint="They must sign in with exactly this Google account.">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dietitian@gmail.com" required autoFocus={inviting} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={confirm?.kind === "remove"}
        onClose={() => !busy && setConfirm(null)}
        title="Remove this dietitian?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={removeWithMove} loading={busy} disabled={confirm?.target?.clients > 0 && !moveTo}>Remove</Button>
          </>
        }
      >
        {confirm?.kind === "remove" ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-muted">
              {confirm.target.name || confirm.target.email} will lose access to the console and become a normal member. Diet plans they posted stay.
            </p>
            {confirm.target.clients > 0 ? (
              <Field label={`Move ${confirm.target.clients} client${confirm.target.clients === 1 ? "" : "s"} to:`}>
                <Select aria-label="Move clients to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} disabled={busy} required>
                  <option value="">Choose a dietitian</option>
                  {data?.dietitians
                    .filter((o) => o.id !== confirm.target.id && !o.disabled)
                    .map((o) => (
                      <option key={o.id} value={o.id}>{o.name || o.email} ({o.clients} client{o.clients === 1 ? "" : "s"})</option>
                    ))}
                </Select>
              </Field>
            ) : null}
            {moveError ? <Alert>{moveError}</Alert> : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirm?.kind === "revoke"}
        title="Revoke this invitation?"
        message={confirm ? `${confirm.target.email} will no longer be able to become a dietitian with this invitation.` : ""}
        confirmLabel="Revoke"
        busy={busy}
        onConfirm={() => act(() => api(`/admin/dietitian-invites/${encodeURIComponent(confirm.target.email)}`, { method: "DELETE" }), "Invitation revoked.")}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

export default function DietitiansPage() {
  return (
    <AdminOnly>
      <Dietitians />
    </AdminOnly>
  );
}
