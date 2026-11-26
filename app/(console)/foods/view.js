"use client";

import { useMemo, useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import AdminOnly from "@/components/admin-only";
import { ListTable } from "@/components/table";
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, PageSpinner, Select, Switch, Textarea } from "@/components/ui";

const LANGS = [["en", "English"], ["ml", "Malayalam"], ["ta", "Tamil"], ["kn", "Kannada"], ["te", "Telugu"]];
const nice = (s) => s.replace(/_/g, " ");
const blankPortion = () => ({ id: "katori", unit: "katori", kcal: ["", ""], protein: ["", ""] });
const blank = () => ({ slug: "", category: "curry", region: "pan_south", diet: "veg", names: { en: "", ml: "", ta: "", kn: "", te: "", alt: "" }, portions: [blankPortion()], oilMatters: false, coconutMatters: false, notes: "", active: true });

const toForm = (f) => ({
  ...f,
  names: { en: "", ml: "", ta: "", kn: "", te: "", ...f.names, alt: (f.names.alt ?? []).join(", ") },
  portions: f.portions.map((p) => ({ ...p, kcal: [String(p.kcal[0]), String(p.kcal[1])], protein: [String(p.protein[0]), String(p.protein[1])] })),
  notes: f.notes ?? "",
});
const toBody = (f) => ({
  slug: f.slug, category: f.category, region: f.region, diet: f.diet,
  names: { ...Object.fromEntries(LANGS.map(([k]) => [k, f.names[k]])), alt: f.names.alt.split(",").map((a) => a.trim()).filter(Boolean) },
  portions: f.portions.map((p) => ({ id: p.id, unit: p.unit, kcal: p.kcal.map(Number), protein: p.protein.map(Number) })),
  oilMatters: f.oilMatters, coconutMatters: f.coconutMatters, notes: f.notes, active: f.active,
});

/**
 * The food library members pick from: dishes named in five languages, with calories and protein as a RANGE for
 * one household portion. The starter numbers are estimates from common tables, so a dietitian should review them.
 */
function Foods() {
  const { data, error, reload } = useApi("/admin/foods");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (patch) => setEditing((f) => ({ ...f, ...patch }));
  const setName = (k, v) => setEditing((f) => ({ ...f, names: { ...f.names, [k]: v } }));
  const setPortion = (i, patch) => setEditing((f) => ({ ...f, portions: f.portions.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.foods ?? []).filter((f) => !q || JSON.stringify(f.names).toLowerCase().includes(q) || f.slug.includes(q));
  }, [data, query]);

  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await api(editing.id ? `/admin/foods/${editing.id}` : "/admin/foods", { method: editing.id ? "PUT" : "POST", body: toBody(editing) });
      setEditing(null);
      reload();
    } catch (e) {
      setProblem(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: "name", header: "Food", sort: (f) => f.names.en, cell: (f) => <div><p className="font-medium text-white">{f.names.en}</p><p className="max-w-xs truncate text-xs text-muted">{["ml", "ta", "kn", "te"].map((l) => f.names[l]).filter(Boolean).join(" · ")}</p></div> },
    { key: "category", header: "Kind", nowrap: true, sort: (f) => f.category, cell: (f) => nice(f.category) },
    { key: "region", header: "Region", nowrap: true, sort: (f) => f.region, cell: (f) => nice(f.region) },
    { key: "range", header: "Per portion", nowrap: true, cell: (f) => `${f.portions[0].kcal[0]} to ${f.portions[0].kcal[1]} kcal` },
    { key: "style", header: "Oil / coconut", nowrap: true, cell: (f) => <span className="text-muted">{[f.oilMatters && "oil", f.coconutMatters && "coconut"].filter(Boolean).join(", ") || "–"}</span> },
    { key: "status", header: "Status", nowrap: true, cell: (f) => (f.active ? <Badge tone="good">Offered</Badge> : <Badge tone="neutral">Hidden</Badge>) },
  ];

  return (
    <>
      <PageHeader title="Food library" subtitle="The dishes members pick from when they log a meal, and that dietitians use in plans. Calories are ranges for a household portion, never one exact number." />
      <p className="mb-4 max-w-3xl text-sm leading-6 text-muted">The starting numbers are estimates from common Indian food tables and typical home recipes. Have a dietitian check them before launch, and correct any that do not match how your members cook.</p>
      {error ? <div className="mb-4"><Alert action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>{messageOf(error)}</Alert></div> : null}
      {!data && !error ? <PageSpinner /> : null}
      {data ? (
        <ListTable
          label="Foods" minWidth={900} rows={rows} rowKey={(f) => f.id} columns={columns} defaultSort="name" noun="food" total={data.foods.length}
          search={{ value: query, onChange: setQuery, placeholder: "Search in any language", label: "Search foods" }}
          onOpen={(f) => { setProblem(null); setEditing(toForm(f)); }}
          action={<Button onClick={() => { setProblem(null); setEditing(blank()); }}>+ New food</Button>}
          empty={{ title: "No foods yet", text: "Run the food seed (npm run seed:foods) in the API, or add one." }}
        />
      ) : null}

      <Modal open={!!editing} onClose={() => setEditing(null)} wide title={editing?.id ? "Edit food" : "New food"} footer={<><Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button><Button loading={busy} onClick={save}>Save food</Button></>}>
        {editing ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {LANGS.map(([k, label]) => <Field key={k} label={`Name in ${label}`} hint={k === "en" ? "Required" : "Optional, but members searching in their language need it"}><Input value={editing.names[k]} maxLength={80} onChange={(e) => setName(k, e.target.value)} /></Field>)}
            </div>
            <Field label="Other spellings" hint="Separated by commas, for example idly, idli"><Input value={editing.names.alt} onChange={(e) => setName("alt", e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Short name" hint="Small letters, numbers and _"><Input value={editing.slug} onChange={(e) => set({ slug: e.target.value })} /></Field>
              <Field label="Kind"><Select value={editing.category} onChange={(e) => set({ category: e.target.value })}>{data.categories.map((c) => <option key={c} value={c}>{nice(c)}</option>)}</Select></Field>
              <Field label="Region"><Select value={editing.region} onChange={(e) => set({ region: e.target.value })}>{data.regions.map((c) => <option key={c} value={c}>{nice(c)}</option>)}</Select></Field>
              <Field label="Diet"><Select value={editing.diet} onChange={(e) => set({ diet: e.target.value })}>{data.diets.map((c) => <option key={c} value={c}>{nice(c)}</option>)}</Select></Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <Switch checked={editing.oilMatters} onChange={(v) => set({ oilMatters: v })} label="How much oil changes the estimate" />
              <Switch checked={editing.coconutMatters} onChange={(v) => set({ coconutMatters: v })} label="How much coconut changes the estimate" />
              <Switch checked={editing.active} onChange={(v) => set({ active: v })} label="Offered to members" />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-200">Portions</h3>
              <p className="mb-3 text-xs text-muted">Each portion has a low and a high figure for one portion: calories, and protein in grams.</p>
              <div className="space-y-3">
                {editing.portions.map((p, i) => (
                  <div key={i} className="grid gap-3 rounded-2xl border border-line bg-card-2/60 p-4 sm:grid-cols-[1fr_1fr_repeat(4,80px)_auto] sm:items-end">
                    <Field label="Short name"><Input value={p.id} onChange={(e) => setPortion(i, { id: e.target.value })} /></Field>
                    <Field label="Size"><Select value={p.unit} onChange={(e) => setPortion(i, { unit: e.target.value })}>{data.units.map((u) => <option key={u} value={u}>{nice(u)}</option>)}</Select></Field>
                    <Field label="kcal low"><Input inputMode="numeric" value={p.kcal[0]} onChange={(e) => setPortion(i, { kcal: [e.target.value, p.kcal[1]] })} /></Field>
                    <Field label="kcal high"><Input inputMode="numeric" value={p.kcal[1]} onChange={(e) => setPortion(i, { kcal: [p.kcal[0], e.target.value] })} /></Field>
                    <Field label="protein low"><Input inputMode="decimal" value={p.protein[0]} onChange={(e) => setPortion(i, { protein: [e.target.value, p.protein[1]] })} /></Field>
                    <Field label="protein high"><Input inputMode="decimal" value={p.protein[1]} onChange={(e) => setPortion(i, { protein: [p.protein[0], e.target.value] })} /></Field>
                    <Button variant="secondary" size="sm" disabled={editing.portions.length <= 1} onClick={() => set({ portions: editing.portions.filter((_, j) => j !== i) })}>Remove</Button>
                  </div>
                ))}
              </div>
              <Button className="mt-3" variant="secondary" size="sm" disabled={editing.portions.length >= 6} onClick={() => set({ portions: [...editing.portions, { ...blankPortion(), id: `portion${editing.portions.length + 1}` }] })}>+ Add a portion</Button>
            </div>
            <Field label="Note" hint="Shown to nobody yet: for your own records, such as what a portion means"><Textarea value={editing.notes} maxLength={300} onChange={(e) => set({ notes: e.target.value })} /></Field>
            {problem ? <Alert>{problem}</Alert> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export default function FoodsPage() {
  return (
    <AdminOnly>
      <Foods />
    </AdminOnly>
  );
}
