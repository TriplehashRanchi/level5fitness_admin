"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ChatInboxProvider, useChatInbox } from "@/lib/chat-inbox";
import BrowserAlerts from "@/components/browser-alerts";
import ClientsRail from "@/components/clients-rail";
import GlobalSearch from "@/components/global-search";
import { Alert, Avatar, Badge, Button, cx, PageSpinner } from "@/components/ui";

// The menu, in the groups it is shown in.
const NAV = [
  { href: "/dashboard", label: "Dashboard", group: "Overview", roles: ["admin", "dietitian"], icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/messages", label: "Messages", group: "Overview", roles: ["admin", "dietitian"], unread: true, icon: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" },
  { href: "/clients", label: "Clients", group: "People", roles: ["admin", "dietitian"], icon: "M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0" },
  { href: "/plans", label: "Plans", group: "People", roles: ["dietitian"], icon: "M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3M9 2h6v4H9zM7 11l2 2 4-4M7 17h10" },
  { href: "/members", label: "Members", group: "People", roles: ["admin"], icon: "M17 20h5v-2a4 4 0 0 0-5-3.9M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" },
  { href: "/dietitians", label: "Dietitians", group: "People", roles: ["admin"], icon: "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" },
  { href: "/workouts", label: "Workouts", group: "Gym", roles: ["admin"], icon: "M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" },
  { href: "/classes", label: "Classes", group: "Gym", roles: ["admin"], icon: "M8 2v4M16 2v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" },
  { href: "/claims", label: "Prize claims", group: "Gym", roles: ["admin"], icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" },
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
        <div role="menu" aria-label="Account" className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-line bg-card-2 p-2 shadow-2xl shadow-black/60">
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

/** Small alerts in the corner when someone writes while you are on another page. A click opens the chat. */
function MessageToasts() {
  const { toasts, dismiss } = useChatInbox();
  const router = useRouter();

  // Each one leaves by itself after a while.
  useEffect(() => {
    if (!toasts.length) return;
    const id = setTimeout(() => dismiss(toasts[0].id), 7000);
    return () => clearTimeout(id);
  }, [toasts, dismiss]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="chat-pop pointer-events-auto flex items-start gap-3 rounded-2xl border border-brand/25 bg-card-2 p-3 shadow-2xl shadow-black/60">
          <button
            type="button"
            onClick={() => {
              dismiss(t.id);
              router.push(`/messages?with=${encodeURIComponent(t.key)}`);
            }}
            className="flex min-w-0 flex-1 items-start gap-3 text-left"
          >
            <Avatar name={t.name} image={t.image} size={38} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{t.name}</span>
              <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-zinc-300">{t.text}</span>
              <span className="mt-1 block text-[11px] font-semibold text-brand">Reply</span>
            </span>
          </button>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

function Shell({ staff, children }) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { total, connected } = useChatInbox();
  const [menuFor, setMenuFor] = useState(null); // the page the mobile menu was opened on
  const menuOpen = menuFor === pathname; // it closes by itself when you go to another page
  const items = NAV.filter((n) => n.roles.includes(staff.role));
  // Messages uses the whole area under the top bar, edge to edge, like a chat app.
  const bleed = pathname === "/messages";
  // A dietitian looking at one client also gets the list of all their clients beside it (wide screens).
  const rail = staff.role === "dietitian" && pathname.startsWith("/clients/");
  const groups = [...new Set(items.map((n) => n.group))];

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group}>
          <p className="mb-1.5 px-4 text-[10px] font-semibold uppercase tracking-[2px] text-muted/80">{group}</p>
          <ul className="flex flex-col gap-0.5">
            {items.filter((n) => n.group === group).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const count = item.unread ? total : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "relative flex h-11 items-center gap-3 rounded-xl border px-3.5 text-sm font-medium transition-colors",
                      active ? "border-brand/40 bg-brand/15 text-white" : "border-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span className={cx("flex shrink-0", active ? "text-brand" : "")}><Icon d={item.icon} /></span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {count ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold tabular-nums text-ink" aria-label={`${count} unread`}>
                        {count > 99 ? "99+" : count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  // --bar is the height of the top bar, for anything that sticks below it.
  return (
    <div className={cx("min-h-screen lg:grid lg:grid-cols-[248px_1fr]", "[--bar:121px] lg:[--bar:69px]")}>
      <a href="#console-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-brand focus:px-5 focus:py-3 focus:text-ink">Skip to content</a>
      {/* Desktop sidebar */}
      {/* Three fixed parts, so nothing is ever squeezed: the brand on top, the menu in the middle (it alone
          scrolls on a short window), and the footer at the bottom. */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-panel lg:flex">
        <div className="shrink-0 px-5 pb-6 pt-5">
          <Brand />
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4">{nav}</div>
        <div className="shrink-0 space-y-3 border-t border-line px-4 py-4">
          {/* For the admin: the next thing that grows the gym's team. Left out on a short window, where the menu needs the room. */}
          {staff.role === "admin" ? (
            <div className="rounded-2xl border border-brand/30 bg-gradient-to-br from-[#0f3d1f] via-[#0a2614] to-black p-4 [@media(max-height:820px)]:hidden">
              <p className="text-sm font-semibold text-white">Grow your team</p>
              <p className="mt-1 text-xs leading-5 text-zinc-300">Invite a dietitian and give them members to look after.</p>
              <Link href="/dietitians" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-ink hover:bg-brand-dark">Invite dietitian →</Link>
            </div>
          ) : null}
          {/* Said only when something is wrong: while the live connection is down. When it is up, nothing is shown. */}
          {connected ? null : (
            <p className="flex items-center gap-2 px-1 text-[11px] font-medium text-muted" role="status">
              <span className="h-2 w-2 shrink-0 rounded-full bg-warn" aria-hidden="true" />
              Reconnecting to live updates…
            </p>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        {/* Top bar: brand and menu on a phone, search and shortcuts on a desktop */}
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur sm:px-8 lg:px-10">
          <div className="lg:hidden"><Brand /></div>
          <GlobalSearch role={staff.role} className="order-last w-full lg:order-none lg:max-w-xl lg:flex-1" />
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/messages"
              aria-label={total ? `Messages, ${total} unread` : "Messages"}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-muted transition-colors hover:border-white/20 hover:text-white"
            >
              <Icon d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
              {total ? (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold tabular-nums text-ink ring-2 ring-ink" aria-hidden="true">
                  {total > 99 ? "99+" : total}
                </span>
              ) : null}
            </Link>
            <AccountMenu staff={staff} onSignOut={signOut} />
            <button
              type="button"
              onClick={() => setMenuFor(menuOpen ? null : pathname)}
              aria-expanded={menuOpen}
              aria-label="Menu"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-card-2 lg:hidden"
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

        <div className={rail ? "xl:grid xl:grid-cols-[300px_minmax(0,1fr)]" : undefined}>
          {rail ? <ClientsRail /> : null}
          <main id="console-main" className={cx("min-w-0", bleed ? "" : "px-4 py-6 sm:px-8 sm:py-8 lg:px-10")}>
            {bleed ? children : <div className={cx("mx-auto", ["/dashboard", "/plans"].includes(pathname) ? "max-w-[1560px]" : "max-w-6xl")}>{children}</div>}
          </main>
        </div>
      </div>
      <MessageToasts />
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

  if (status === "ready") {
    return (
      <ChatInboxProvider key={staff.id ?? staff.role} role={staff.role}>
        <Shell staff={staff}>{children}</Shell>
      </ChatInboxProvider>
    );
  }

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
