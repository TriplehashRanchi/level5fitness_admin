"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { Avatar, cx } from "@/components/ui";

const LEVEL_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", all: "All levels" };

const ICONS = {
  search: "M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z",
  workout: "M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12",
  class: "M8 2v4M16 2v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
};

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/** The API's answer as groups of rows, each row knowing where it leads. */
function toGroups(data) {
  if (!data) return [];
  const groups = [
    {
      label: "Members",
      rows: data.members.map((m) => ({
        key: `m-${m.id}`,
        // A member has a client page only once they share their profile and have a dietitian.
        // Until then, show them in the Members list, where the admin can assign one.
        href: m.hasClientPage ? `/clients/${encodeURIComponent(m.id)}` : `/members?q=${encodeURIComponent(m.email || m.name || "")}`,
        title: m.name || m.email,
        detail: [
          m.name ? m.email : null,
          !m.setupDone ? "Profile not set up" : !m.sharing ? "Not sharing profile" : m.dietitianName ? `With ${m.dietitianName}` : "No dietitian",
        ].filter(Boolean).join(" · "),
        person: m,
      })),
    },
    {
      label: "Dietitians",
      rows: data.dietitians.map((d) => ({
        key: `d-${d.id}`,
        href: "/dietitians",
        title: d.name || d.email,
        detail: [d.name ? d.email : null, d.disabled ? "Disabled" : null].filter(Boolean).join(" · "),
        person: d,
      })),
    },
    {
      label: "Workouts",
      rows: data.workouts.map((w) => ({
        key: `w-${w.id}`,
        href: "/workouts",
        title: w.title,
        detail: [w.categoryName, LEVEL_LABEL[w.level], `${w.durationMin} min`, w.isActive ? null : "Hidden"].filter(Boolean).join(" · "),
        icon: "workout",
      })),
    },
    {
      label: "Classes",
      rows: data.classes.map((c) => ({
        key: `c-${c.id}`,
        href: "/classes",
        title: c.name,
        detail: [c.trainer, c.startTime, c.isActive ? null : "Hidden"].filter(Boolean).join(" · "),
        icon: "class",
      })),
    },
  ];
  return groups.filter((g) => g.rows.length);
}

/** The admin's search box in the top bar: members, dietitians, workouts and classes in one place. */
export default function GlobalSearch({ className }) {
  const router = useRouter();
  const listId = useId();
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const [text, setText] = useState("");
  const [term, setTerm] = useState(""); // what was last sent to the API
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Wait until typing pauses before asking the API.
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  // Ctrl/⌘ + K from anywhere, or "/" when not typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A click anywhere else closes the results.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const ready = term.length >= 2;
  const { data, error, reload } = useApi(ready ? `/admin/search?q=${encodeURIComponent(term)}` : null);
  const waiting = text.trim().length >= 2 && (text.trim() !== term || (!data && !error));
  const groups = ready && !waiting ? toGroups(data) : [];
  const rows = groups.flatMap((g) => g.rows);
  const current = Math.min(active, rows.length - 1);
  const show = open && text.trim().length > 0;

  const go = (row) => {
    setOpen(false);
    setText("");
    setTerm("");
    inputRef.current?.blur();
    router.push(row.href);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      if (show) e.preventDefault();
      setOpen(false);
      if (!show) inputRef.current?.blur();
      return;
    }
    if (!rows.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((current + (e.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
    } else if (e.key === "Enter" && show) {
      e.preventDefault();
      go(rows[current]);
    }
  };

  return (
    <div ref={boxRef} className={cx("relative", className)}>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" /></span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Search members, dietitians, workouts and classes"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={show && rows.length ? `${listId}-${rows[current].key}` : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={60}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search members, dietitians, workouts…"
          className="h-11 w-full rounded-full border border-line bg-card pl-11 pr-16 text-sm text-white placeholder:text-zinc-500 focus:border-brand/60 [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-card-2 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted sm:block">Ctrl K</kbd>
      </div>

      {show ? (
        <div id={listId} role="listbox" aria-label="Search results" className="absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-panel p-2 shadow-2xl shadow-black/60">
          {text.trim().length < 2 ? (
            <p className="px-3 py-3 text-sm text-muted">Type at least 2 letters.</p>
          ) : waiting ? (
            <p className="px-3 py-3 text-sm text-muted" role="status">Searching…</p>
          ) : error ? (
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <p className="text-sm text-white">{messageOf(error)}</p>
              <button type="button" onClick={reload} className="shrink-0 rounded-full bg-card-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-card-3">Try again</button>
            </div>
          ) : !rows.length ? (
            <p className="px-3 py-3 text-sm text-muted">Nothing matches “{term}”.</p>
          ) : (
            groups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label} className="mb-1 last:mb-0">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[2px] text-muted">{group.label}</p>
                {group.rows.map((row) => {
                  const selected = rows[current]?.key === row.key;
                  return (
                    <button
                      key={row.key}
                      id={`${listId}-${row.key}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      tabIndex={-1}
                      onMouseEnter={() => setActive(rows.indexOf(row))}
                      onClick={() => go(row)}
                      className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left", selected ? "bg-brand/10" : "hover:bg-white/5")}
                    >
                      {row.person ? (
                        <Avatar name={row.person.name || row.person.email} image={row.person.image} size={34} />
                      ) : (
                        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-card-2 text-muted"><Icon name={row.icon} size={16} /></span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={cx("block truncate text-sm font-semibold", selected ? "text-brand" : "text-white")}>{row.title}</span>
                        {row.detail ? <span className="block truncate text-xs text-muted">{row.detail}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
