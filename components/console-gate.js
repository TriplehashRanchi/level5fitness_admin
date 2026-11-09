"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Alert, Avatar, Badge, Button, cx, PageSpinner } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "dietitian"], icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/clients", label: "Clients", roles: ["admin", "dietitian"], icon: "M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0" },
  { href: "/notifications", label: "Notifications", roles: ["admin", "dietitian"], icon: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" },
  { href: "/members", label: "Members", roles: ["admin"], icon: "M17 20h5v-2a4 4 0 0 0-5-3.9M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" },
  { href: "/dietitians", label: "Dietitians", roles: ["admin"], icon: "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" },
  { href: "/workouts", label: "Workouts", roles: ["admin"], icon: "M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" },
  { href: "/classes", label: "Classes", roles: ["admin"], icon: "M8 2v4M16 2v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" },
];

function Icon({ d }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Brand() {
  return (
    <Link href="/" aria-label="L5 Fitness home" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-[13px] font-black text-ink">L5</span>
      <span className="text-[13px] font-semibold tracking-[2px] text-white">FITNESS</span>
    </Link>
  );
}

function Shell({ staff, children }) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [menuFor, setMenuFor] = useState(null); // the page the mobile menu was opened on
  const menuOpen = menuFor === pathname; // it closes by itself when you go to another page
  const items = NAV.filter((n) => n.roles.includes(staff.role));

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
              active ? "bg-brand/10 text-brand ring-1 ring-inset ring-brand/15" : "text-muted hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon d={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="mt-auto border-t border-line pt-4">
      <div className="flex items-center gap-3">
        <Avatar name={staff.name || staff.email} image={staff.image} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{staff.name || staff.email}</p>
          <div className="mt-0.5"><Badge tone={staff.role === "admin" ? "brand" : "sky"}>{staff.role === "admin" ? "Admin" : "Dietitian"}</Badge></div>
        </div>
      </div>
      <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#console-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-brand focus:px-5 focus:py-3 focus:text-ink">Skip to content</a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-panel p-5 lg:flex">
        <Brand />
        <p className="-mb-3 px-4 text-[10px] font-semibold uppercase tracking-[2px] text-muted">Your workspace</p>
        {nav}
        {account}
      </aside>

      {/* Phone / tablet top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-panel/95 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setMenuFor(menuOpen ? null : pathname)}
          aria-expanded={menuOpen}
          aria-label="Menu"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card-2"
        >
          <Icon d={menuOpen ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
        </button>
      </header>
      {menuOpen ? (
        <div className="fixed inset-x-0 top-[57px] z-20 flex max-h-[calc(100vh-57px)] flex-col gap-5 overflow-y-auto border-b border-line bg-panel p-5 lg:hidden">
          {nav}
          {account}
        </div>
      ) : null}

      <main id="console-main" className="min-w-0 px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

/** Everything inside the console passes through here: signed in, and allowed. */
export default function ConsoleGate({ children }) {
  const { status, staff, error, retry, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signedOut") router.replace("/login");
  }, [status, router]);

  if (status === "ready") return <Shell staff={staff}>{children}</Shell>;

  if (status === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-line bg-card p-8 text-center">
          <h1 className="text-xl font-black text-white">No access</h1>
          <p className="mt-2 text-sm text-muted">
            {staff?.disabled
              ? "Your dietitian account has been disabled."
              : `${staff?.email || "This account"} has not been invited to the console.`}{" "}
            Ask the admin to invite you, then sign in again with that Google account.
          </p>
          <Button className="mt-6" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <Alert action={<Button size="sm" variant="secondary" onClick={retry}>Try again</Button>}>{error}</Alert>
      </div>
    );
  }

  return <PageSpinner label={status === "signedOut" ? "Redirecting to sign in…" : "Checking your access…"} />;
}
