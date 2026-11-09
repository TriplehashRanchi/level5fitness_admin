"use client";

import Image from "next/image";
import Link from "next/link";
import { ConsoleIcon } from "@/components/console-icon";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { DEV_EMAIL_LOGIN } from "@/lib/config";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { status, staff, signInWithGoogle, signInWithEmail, signInAsAdmin, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    if (status === "ready") router.replace("/dashboard");
  }, [status, router]);

  const run = async (action) => {
    setBusy(true);
    setMessage(null);
    const problem = await action();
    if (problem) setMessage(problem);
    setBusy(false);
  };

  const working = status === "loading" || status === "ready";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        <Image src="/images/gym-1.jpg" alt="" fill priority sizes="(min-width: 1024px) 55vw, 0px" className="object-cover object-[50%_18%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-transparent to-ink" />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Link href="/" className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-xs text-zinc-200 backdrop-blur hover:text-brand"><ConsoleIcon name="arrow" size={15} className="rotate-180" />Back to L5 Fitness</Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[3px] text-brand">Your team workspace</p>
            <h2 className="mt-5 text-5xl font-medium leading-[1.1] tracking-[-2px] text-white xl:text-6xl">A stronger gym.<br /><span className="text-brand">Starts with you.</span></h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-zinc-300">The people, plans and everyday details. Everything you need to help your members move forward.</p>
            <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-3">
              {[{ icon: "members", label: "Members and team, connected" }, { icon: "plan", label: "Personal plans, clear progress" }, { icon: "shield", label: "Access by staff role" }].map((item) => <div key={item.label} className="rounded-2xl border border-white/12 bg-black/35 p-4 backdrop-blur-md"><ConsoleIcon name={item.icon} size={18} className="text-brand" /><p className="mt-3 text-xs leading-5 text-zinc-200">{item.label}</p></div>)}
            </div>
          </div>
        </div>
      </aside>
      <div className="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-brand text-lg font-black text-ink">L5</span>
          <span className="text-lg font-black tracking-[4px] text-white">FITNESS</span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-card/90 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Welcome to your workspace</h1>
          <p className="mt-3 text-sm leading-6 text-muted">Sign in with your invited staff account to continue.</p>

          <div className="mt-7 space-y-4">
            {status === "denied" ? (
              <>
                <Alert>
                  {staff?.disabled
                    ? "Your dietitian account has been disabled."
                    : `${staff?.email} has not been invited to the console.`}{" "}
                  Ask the admin to invite you.
                </Alert>
                <Button variant="secondary" className="w-full" onClick={signOut}>
                  Use a different account
                </Button>
              </>
            ) : working ? (
              <div className="flex items-center justify-center gap-3 py-6 text-sm text-muted" role="status">
                <Spinner /> Signing you in…
              </div>
            ) : (
              <>
                {message ? <Alert>{message}</Alert> : null}
                <button
                  type="button"
                  onClick={() => run(signInWithGoogle)}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-60"
                >
                  {busy ? <Spinner size={18} /> : <GoogleMark />}
                  Continue with Google
                </button>

                <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
                  <span className="h-px flex-1 bg-line" />
                  Admin
                  <span className="h-px flex-1 bg-line" />
                </div>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => signInAsAdmin(adminEmail, adminPassword));
                  }}
                >
                  <Field label="Admin email">
                    <Input type="email" autoComplete="username" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
                  </Field>
                  <Field label="Admin password">
                    <Input type="password" autoComplete="current-password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
                  </Field>
                  <Button type="submit" variant="secondary" className="w-full" loading={busy}>
                    Sign in as admin
                  </Button>
                </form>

                {DEV_EMAIL_LOGIN ? (
                  <form
                    className="space-y-3 border-t border-line pt-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(() => signInWithEmail(email, password));
                    }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Developer sign-in (not for production)</p>
                    <Field label="Email">
                      <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </Field>
                    <Field label="Password">
                      <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </Field>
                    <Button type="submit" variant="secondary" className="w-full" loading={busy}>
                      Sign in
                    </Button>
                  </form>
                ) : null}
              </>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-xs leading-5 text-muted">Dietitians sign in with Google after the admin invites them.</p>
        <Link href="/" className="mx-auto mt-4 flex w-fit items-center gap-2 py-2 text-xs text-muted hover:text-brand"><ConsoleIcon name="arrow" size={14} className="rotate-180" />Back to home</Link>
      </div>
      </div>
    </main>
  );
}
