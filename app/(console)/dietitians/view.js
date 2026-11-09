"use client";

import { useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { fmtDateTime, timeAgo } from "@/lib/dates";
import AdminOnly from "@/components/admin-only";
import { Alert, Avatar, Badge, Button, Card, CardTitle, ConfirmDialog, EmptyState, Field, Input, PageHeader, PageSpinner } from "@/components/ui";

function Dietitians() {
  const { data, error, reload } = useApi("/admin/dietitians");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: 'remove' | 'revoke', target }

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

  const invite = (e) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    act(async () => {
      const res = await api("/admin/dietitians", { method: "POST", body: { email: address } });
      setEmail("");
      setNotice({
        tone: "good",
        text:
          res.result === "promoted"
            ? `${res.email} is now a dietitian.`
            : `Invitation saved. ${res.email} becomes a dietitian the first time they sign in with that Google account.`,
      });
    });
  };

  const toggle = (d) =>
    act(() => api(`/admin/dietitians/${encodeURIComponent(d.id)}`, { method: "PATCH", body: { disabled: !d.disabled } }), d.disabled ? `${d.name || d.email} can sign in again.` : `${d.name || d.email} is disabled and cannot sign in.`);

  return (
    <>
      <PageHeader title="Dietitians" subtitle="Dietitians sign in with Google, but only after you invite their email address." />

      <Card>
        <CardTitle>Invite a dietitian</CardTitle>
        <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Field label="Google email address" hint="They must sign in with exactly this Google account.">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dietitian@gmail.com" required />
            </Field>
          </div>
          <Button type="submit" loading={busy} className="mb-[22px]">Send invitation</Button>
        </form>
      </Card>

      {notice ? <div className="mt-4"><Alert tone={notice.tone === "good" ? "good" : "bad"}>{notice.text}</Alert></div> : null}
      {error ? <div className="mt-4"><Alert>{messageOf(error)}</Alert></div> : null}
      {!data && !error ? <PageSpinner /> : null}

      {data ? (
        <>
          <Card className="mt-6">
            <CardTitle>Dietitians</CardTitle>
            {data.dietitians.length === 0 ? (
              <EmptyState title="No dietitians yet">Invite one above. They appear here after their first sign-in.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="py-3 pr-4 font-semibold">Dietitian</th>
                      <th className="py-3 pr-4 font-semibold">Status</th>
                      <th className="py-3 pr-4 font-semibold">Clients</th>
                      <th className="py-3 pr-4 font-semibold">Last seen</th>
                      <th className="py-3 font-semibold"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.dietitians.map((d) => (
                      <tr key={d.id}>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={d.name || d.email} image={d.image} />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-white">{d.name || d.email}</p>
                              <p className="truncate text-xs text-muted">{d.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">{d.disabled ? <Badge tone="bad">Disabled</Badge> : <Badge tone="good">Active</Badge>}</td>
                        <td className="py-3 pr-4 text-zinc-300">{d.clients}</td>
                        <td className="py-3 pr-4 text-muted">{timeAgo(d.lastSeenAt)}</td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={() => toggle(d)} disabled={busy}>{d.disabled ? "Enable" : "Disable"}</Button>
                            <Button variant="danger" size="sm" onClick={() => setConfirm({ kind: "remove", target: d })} disabled={busy}>Remove</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="mt-6">
            <CardTitle>Pending invitations</CardTitle>
            {data.invites.length === 0 ? (
              <p className="text-sm text-muted">No invitations waiting.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.invites.map((i) => (
                  <li key={i.email} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-bold text-white">{i.email}</p>
                      <p className="text-xs text-muted">Invited {fmtDateTime(i.invitedAt)} · waiting for their first Google sign-in</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setConfirm({ kind: "revoke", target: i })} disabled={busy}>Revoke</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "remove" ? "Remove this dietitian?" : "Revoke this invitation?"}
        message={
          confirm?.kind === "remove"
            ? `${confirm.target.name || confirm.target.email} will lose access to the console. Their ${confirm.target.clients} client${confirm.target.clients === 1 ? "" : "s"} will become unassigned. Diet plans they posted stay.`
            : confirm ? `${confirm.target.email} will no longer be able to become a dietitian with this invitation.` : ""
        }
        confirmLabel={confirm?.kind === "remove" ? "Remove" : "Revoke"}
        busy={busy}
        onConfirm={() =>
          confirm.kind === "remove"
            ? act(() => api(`/admin/dietitians/${encodeURIComponent(confirm.target.id)}`, { method: "DELETE" }), "Dietitian removed.")
            : act(() => api(`/admin/dietitian-invites/${encodeURIComponent(confirm.target.email)}`, { method: "DELETE" }), "Invitation revoked.")
        }
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
