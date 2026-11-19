"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import BrowserAlerts from "@/components/browser-alerts";
import GlobalSearch from "@/components/global-search";
import { Alert, Avatar, Badge, Button, cx, PageSpinner } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "dietitian"], icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/clients", label: "Clients", roles: ["admin", "dietitian"], icon: "M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0" },
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

/** Who is signed in, at the right of the top bar. Opens a small menu with the way out. */
function AccountMenu({ staff, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isAdmin = staff.role === "admin";
  const name = staff.name || staff.email;

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${name}`}
        className={cx(
          "flex items-center gap-2.5 rounded-full border p-1 transition-colors lg:pr-3",
          open ? "border-brand/40 bg-brand/10" : "border-line bg-card hover:border-white/20"
        )}
      >
        <span className="flex shrink-0 rounded-full ring-2 ring-brand/40"><Avatar name={name} image={staff.image} size={32} /></span>
        <span className="hidden min-w-0 text-left lg:block">
          <span className="block max-w-36 truncate text-sm font-semibold leading-tight text-white">{name}</span>
          <span className={cx("block text-[11px] font-semibold leading-tight", isAdmin ? "text-brand" : "text-sky")}>{isAdmin ? "Admin" : "Dietitian"}</span>
        </span>
        <span className={cx("hidden text-muted transition-transform lg:block", open && "rotate-180")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </button>

      {open ? (
        <div role="menu" aria-label="Account" className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-line bg-panel p-2 shadow-2xl shadow-black/60">
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar name={name} image={staff.image} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{name}</p>
              {staff.name && staff.email ? <p className="truncate text-xs text-muted">{staff.email}</p> : null}
              <div className="mt-1"><Badge tone={isAdmin ? "brand" : "sky"}>{isAdmin ? "Admin" : "Dietitian"}</Badge></div>
            </div>
          </div>
          {isAdmin ? null : (
            <>
              <div className="my-1 border-t border-line" />
              <BrowserAlerts />
            </>
          )}
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-accent hover:bg-accent/10"
          >
            <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
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

  // --bar is the height of the top bar, for anything that sticks below it.
  return (
    <div className={cx("min-h-screen lg:grid lg:grid-cols-[248px_1fr]", "[--bar:121px] lg:[--bar:69px]")}>
      <a href="#console-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-brand focus:px-5 focus:py-3 focus:text-ink">Skip to content</a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-panel p-5 lg:flex">
        <Brand />
        <p className="-mb-3 px-4 text-[10px] font-semibold uppercase tracking-[2px] text-muted">Your workspace</p>
        {nav}
      </aside>

      <div className="min-w-0">
        {/* Top bar: brand and menu on a phone, search and shortcuts on a desktop */}
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur sm:px-8 lg:bg-ink/85 lg:px-10">
          <div className="lg:hidden"><Brand /></div>
          <GlobalSearch role={staff.role} className="order-last w-full lg:order-none lg:max-w-xl lg:flex-1" />
          <div className="ml-auto flex items-center gap-2">
            <AccountMenu staff={staff} onSignOut={signOut} />
            <button
              type="button"
              onClick={() => setMenuFor(menuOpen ? null : pathname)}
              aria-expanded={menuOpen}
              aria-label="Menu"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card-2 lg:hidden"
            >
              <Icon d={menuOpen ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
            </button>
          </div>
          {menuOpen ? (
            <div className="absolute inset-x-0 top-full z-20 flex max-h-[calc(100vh-130px)] flex-col gap-5 overflow-y-auto border-b border-line bg-panel p-5 lg:hidden">
              {nav}
            </div>
          ) : null}
        </header>

        <main id="console-main" className="min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
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
