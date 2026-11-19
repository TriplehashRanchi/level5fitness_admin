"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";

export const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "targets", label: "Targets" },
  { id: "daily-check", label: "Daily check" },
  { id: "diet-plan", label: "Diet plan" },
  { id: "exercise", label: "Exercise" },
  { id: "progress", label: "Progress" },
  { id: "health", label: "Health" },
];

/** Sticky pill bar that scrolls to a section and highlights the one being read. */
export default function SectionNav() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const listRef = useRef(null);
  const locked = useRef(false);

  useEffect(() => {
    const visible = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id));
        if (locked.current) return;
        const first = SECTIONS.find((s) => visible.has(s.id));
        if (first) setActive(first.id);
      },
      // Below the top bar and this bar, whatever height the top bar has on this screen.
      { rootMargin: `-${(parseInt(getComputedStyle(listRef.current ?? document.body).getPropertyValue("--bar"), 10) || 65) + 60}px 0px -55% 0px`, threshold: 0 }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  // Keep the active pill in view inside the scrollable bar (without moving the page).
  useEffect(() => {
    const list = listRef.current;
    const pill = list?.querySelector(`[data-id="${active}"]`);
    if (!list || !pill) return;
    list.scrollTo({ left: pill.offsetLeft - list.clientWidth / 2 + pill.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  const go = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    locked.current = true;
    window.setTimeout(() => {
      locked.current = false;
    }, 800);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <nav aria-label="Client sections" className="sticky top-[var(--bar)] z-20 -mx-4 border-b border-line bg-ink/90 px-4 backdrop-blur sm:-mx-8 sm:px-8 lg:mx-0 lg:rounded-2xl lg:border lg:px-2">
      <ul ref={listRef} className="no-scrollbar flex gap-1.5 overflow-x-auto py-2">
        {SECTIONS.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              data-id={s.id}
              aria-current={active === s.id ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                go(s.id);
              }}
              className={cx(
                "block rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active === s.id ? "bg-brand text-ink" : "text-muted hover:bg-white/5 hover:text-white"
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
