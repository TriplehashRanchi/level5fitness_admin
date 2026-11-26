"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/lib/use-api";
import { Input } from "@/components/ui";

const UNIT = { katori: "katori (small bowl)", piece: "piece", cup: "cup", glass: "glass", plate: "plate", handful: "handful", ball: "ball", spoons2: "2 spoons", each: "each" };
const LANGS = ["ml", "ta", "kn", "te"];
const fold = (t) => String(t).toLowerCase().normalize("NFC");

/**
 * Search the South Indian food library (in English or Malayalam, Tamil, Kannada or Telugu) and fill in the
 * item: its name, a household portion, and the middle of its calorie range. The dietitian then edits it.
 */
export default function FoodHelper({ onPick, preferred }) {
  const { data } = useApi("/foods");
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const needle = fold(q.trim());
    if (!needle || !data) return [];
    return data.foods
      .filter((f) => [...Object.entries(f.names).filter(([k]) => k !== "alt").map(([, v]) => v), ...(f.names.alt ?? []), f.slug.replace(/_/g, " ")].some((n) => fold(n).includes(needle)))
      .slice(0, 6);
  }, [q, data]);

  return (
    <div className="rounded-2xl border border-line bg-card-2/60 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">From the food library</p>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: idli, ദോശ, சாம்பார்…" aria-label="Search the food library" />
      {results.length ? (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {results.map((f) => {
            const portion = f.portions[0];
            const mid = Math.round((portion.kcal[0] + portion.kcal[1]) / 2 / 5) * 5;
            const local = preferred && f.names[preferred] && preferred !== "en" ? f.names[preferred] : LANGS.map((l) => f.names[l]).find(Boolean);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => { onPick({ title: f.names.en, details: `1 ${UNIT[portion.unit]}${portion.unit === "each" ? "" : ""}`.replace("1 each", "1"), calories: String(mid) }); setQ(""); }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-white/5"
                >
                  <span className="min-w-0 flex-1"><span className="font-medium text-white">{f.names.en}</span>{local ? <span className="ml-2 text-muted">{local}</span> : null}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{portion.kcal[0]} to {portion.kcal[1]} kcal · {portion.unit === "each" ? "each" : UNIT[portion.unit]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {q.trim() && data && results.length === 0 ? <p className="mt-2 text-xs text-muted">Not in the library. Type it below.</p> : null}
      <p className="mt-2 text-xs text-muted">Calories fill in as the middle of a household-portion range. Change them if you know better.</p>
    </div>
  );
}
