"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, Button, cx } from "@/components/ui";

// One table for every list in the console: the same frame, header, row height, hover, sorting,
// search box, filter pills and page buttons, so each page works the same way.

/**
 * The frame: an optional toolbar on top (search, filters, a button), the table in the middle
 * (it scrolls sideways on a narrow screen), and an optional footer (count, page buttons).
 */
export function DataTable({ label, minWidth = 720, toolbar, footer, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      {toolbar ? <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">{toolbar}</div> : null}
      <div className="overflow-x-auto">
        <table aria-label={label} className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
      {footer ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-xs text-muted">{footer}</div> : null}
    </div>
  );
}

export function THead({ children }) {
  return (
    <thead className="border-b border-line text-xs text-muted">
      <tr>{children}</tr>
    </thead>
  );
}

/**
 * A column heading. Pass `sort` (from useSort().column("key")) to make it sort when clicked.
 * `label` names a column that shows no text (for example the buttons at the end of a row).
 */
export function Th({ children, align = "left", sort, label, className }) {
  const side = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  if (!sort) {
    return (
      <th scope="col" className={cx("whitespace-nowrap px-5 py-3.5 font-medium", side, className)}>
        {label ? <span className="sr-only">{label}</span> : children}
      </th>
    );
  }
  return (
    <th scope="col" aria-sort={sort.active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cx("whitespace-nowrap px-5 py-3.5 font-medium", side, className)}>
      <button
        type="button"
        onClick={sort.toggle}
        title={`Sort by ${typeof children === "string" ? children.toLowerCase() : "this column"}`}
        className={cx("inline-flex items-center gap-1.5 font-medium transition-colors hover:text-white", sort.active && "text-white", align === "right" && "flex-row-reverse")}
      >
        {children}
        <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
          <path d="M5 0l4 4.5H1z" opacity={sort.active && sort.dir === "asc" ? 1 : 0.3} />
          <path d="M5 12L1 7.5h8z" opacity={sort.active && sort.dir === "desc" ? 1 : 0.3} />
        </svg>
      </button>
    </th>
  );
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

/** A row. With `onOpen` the whole row is clickable (clicks on links, buttons and fields inside still do their own thing). */
export function Tr({ selected, dim, onOpen, children }) {
  return (
    <tr
      onClick={onOpen ? (e) => { if (!e.target.closest("a, button, select, input, label")) onOpen(); } : undefined}
      className={cx("transition-colors", selected ? "bg-brand/[0.07]" : "hover:bg-white/[0.04]", onOpen && "cursor-pointer", dim && "opacity-55 hover:opacity-100")}
    >
      {children}
    </tr>
  );
}

export function Td({ align = "left", muted, nowrap, className, children }) {
  return (
    <td className={cx("px-5 py-4 align-middle", align === "right" ? "text-right" : align === "center" ? "text-center" : "", muted ? "text-muted" : "text-zinc-200", nowrap && "whitespace-nowrap", className)}>
      {children}
    </td>
  );
}

/** One row that spans the table: "nothing matches", with a way back. */
export function EmptyRow({ colSpan, title, children, action }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-14 text-center">
        <p className="text-sm font-semibold text-white">{title}</p>
        {children ? <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted">{children}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </td>
    </tr>
  );
}

/** Photo, name and a second line. With `href` the name is a link. */
export function PersonCell({ name, email, image, sub, href }) {
  const title = name || email;
  return (
    <div className="flex items-center gap-3">
      <Avatar name={title} image={image} size={36} />
      <div className="min-w-0">
        {href ? (
          <Link href={href} className="block max-w-64 truncate font-semibold text-white hover:text-brand hover:underline">{title}</Link>
        ) : (
          <p className="max-w-64 truncate font-semibold text-white">{title}</p>
        )}
        <p className="max-w-64 truncate text-xs text-muted">{sub ?? email}</p>
      </div>
    </div>
  );
}

/** Two lines of text in one cell: the main value and a smaller note under it. */
export function TwoLine({ main, note }) {
  return (
    <>
      <span className="block font-medium text-white">{main}</span>
      {note ? <span className="block text-xs text-muted">{note}</span> : null}
    </>
  );
}

/**
 * A slim bar with a number next to it. `percent` null means there is nothing to measure.
 * `text` replaces the "64%" (for example "12 / 20").
 */
export function MeterCell({ percent, text, note, tone = "bg-brand", label }) {
  const width = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div className="flex min-w-36 items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}>
        <div className={cx("h-full rounded-full", tone)} style={{ width: `${width}%` }} />
      </div>
      <span className="w-20 shrink-0 whitespace-nowrap text-xs tabular-nums">
        <span className="font-semibold text-white">{text ?? (percent == null ? "–" : `${percent}%`)}</span>
        {note ? <span className="ml-1.5 text-muted">{note}</span> : null}
      </span>
    </div>
  );
}

// ── Toolbar pieces ───────────────────────────────────────────────────────────────────────────

export function SearchBox({ value, onChange, placeholder = "Search", label, className }) {
  return (
    <div className={cx("relative w-full sm:w-72", className)}>
      <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" />
      </svg>
      <input
        type="search"
        aria-label={label ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-line bg-card-2 pl-10 pr-9 text-sm text-white placeholder:text-zinc-500 focus:border-brand/60 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      ) : null}
    </div>
  );
}

/** Filter pills. Each option: { id, label, count? }. */
export function Pills({ options, value, onChange, label = "Filter" }) {
  return (
    <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-card-2 p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx("shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", value === o.id ? "bg-brand text-ink" : "text-muted hover:text-white")}
        >
          {o.label}
          {o.count != null ? <span className="ml-1.5 tabular-nums opacity-70">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** "12 members", or "3 of 12 members" when a search or filter hides some. */
export function Count({ n, of, noun, plural = `${noun}s` }) {
  const total = of ?? n;
  const word = total === 1 ? noun : plural;
  return <span>{of != null && of !== n ? `${n} of ${of} ${word}` : `${n} ${word}`}</span>;
}

export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
      <span className="tabular-nums">Page {page} of {pages}</span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
    </div>
  );
}

// ── Sorting ──────────────────────────────────────────────────────────────────────────────────

/**
 * Sorts rows in the browser. `columns` maps a key to a function that reads the value to sort by.
 * Returns the sorted rows and `column(key)`, which is what a <Th sort> needs. Empty values go last.
 */
export function useSort(rows, columns, initialKey, initialDir = "asc") {
  const [state, setState] = useState({ key: initialKey, dir: initialDir });
  const sorted = useMemo(() => {
    const read = columns[state.key];
    if (!read) return rows;
    const sign = state.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = read(a);
      const y = read(b);
      if (x == null || x === "") return y == null || y === "" ? 0 : 1;
      if (y == null || y === "") return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
      return String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true }) * sign;
    });
    // `columns` is written inline by callers; the readers themselves do not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, state]);
  const column = (key) => ({
    active: state.key === key,
    dir: state.dir,
    toggle: () => setState((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" })),
  });
  return { sorted, column };
}

// ── The table every list page uses ───────────────────────────────────────────────────────────

/**
 * One table for every list in the console. A page describes its data; this draws it the same way
 * everywhere: toolbar (search, filter pills, anything extra, a button on the right), headings that
 * sort, rows, "nothing here" with a way back, and a footer with the count and page buttons.
 *
 *   rows      what to show (already searched / filtered by the page)
 *   rowKey    (row) => a stable id
 *   columns   [{ key, header, cell: (row) => node, sort?: (row) => value, align?, nowrap?, muted?, className? }]
 *             `header` is the heading (text, or a node such as a checkbox); with `hidden: true` it is
 *             only read out (for a column of buttons). A column with `sort` sorts when its heading is clicked.
 *   defaultSort  the key of the column to sort by at first ("-key" for descending)
 *   search    { value, onChange, placeholder, label }
 *   filters   { options: [{ id, label, count? }], value, onChange, label }
 *   toolbar   anything else for the toolbar (a select, a note); `action` sits at its right end
 *   noun      "member": the footer says "12 members", or "3 of 12 members" when `total` is larger.
 *             `count` replaces the number of rows (when the server pages the list).
 *   pagination { page, pages, onPage }
 *   empty     { title, text, action } for when no row is shown
 *   onOpen    (row) => …  makes the whole row clickable.  selected / dim: (row) => boolean
 */
export function ListTable({
  label, minWidth, rows, rowKey, columns, defaultSort,
  search, filters, toolbar, action,
  noun, plural, total, count, pagination, footer,
  empty, onOpen, selected, dim, busy = false,
}) {
  const readers = useMemo(() => Object.fromEntries(columns.filter((c) => c.sort).map((c) => [c.key, c.sort])), [columns]);
  const descending = typeof defaultSort === "string" && defaultSort.startsWith("-");
  const { sorted, column } = useSort(rows, readers, descending ? defaultSort.slice(1) : defaultSort, descending ? "desc" : "asc");
  const hasToolbar = search || filters || toolbar || action || busy;

  return (
    <DataTable
      label={label}
      minWidth={minWidth}
      toolbar={
        hasToolbar ? (
          <>
            {search ? <SearchBox value={search.value} onChange={search.onChange} placeholder={search.placeholder} label={search.label} /> : null}
            {filters ? <Pills options={filters.options} value={filters.value} onChange={filters.onChange} label={filters.label} /> : null}
            {toolbar}
            {busy ? <span className="text-xs text-muted" role="status">Loading…</span> : null}
            {action ? <div className="ml-auto flex items-center gap-2">{action}</div> : null}
          </>
        ) : null
      }
      footer={
        noun || pagination || footer ? (
          <>
            {noun ? <Count n={count ?? sorted.length} of={total} noun={noun} plural={plural} /> : <span />}
            {footer}
            {pagination ? <Pagination {...pagination} /> : null}
          </>
        ) : null
      }
    >
      <THead>
        {columns.map((c) => (
          <Th key={c.key} align={c.align} className={c.className} sort={c.sort ? column(c.key) : undefined} label={c.hidden ? c.header : undefined}>
            {c.hidden ? null : c.header}
          </Th>
        ))}
      </THead>
      <TBody>
        {sorted.length === 0 ? (
          <EmptyRow colSpan={columns.length} title={empty?.title ?? "Nothing to show"} action={empty?.action}>{empty?.text}</EmptyRow>
        ) : null}
        {sorted.map((row) => (
          <Tr key={rowKey(row)} onOpen={onOpen ? () => onOpen(row) : undefined} selected={selected?.(row)} dim={dim?.(row)}>
            {columns.map((c) => (
              <Td key={c.key} align={c.align} nowrap={c.nowrap} muted={c.muted}>{c.cell(row)}</Td>
            ))}
          </Tr>
        ))}
      </TBody>
    </DataTable>
  );
}

/** A round icon button for the end of a row (open, remove). `tone="bad"` turns red on hover. */
export function RowButton({ label, onClick, disabled, tone, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cx("inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors disabled:opacity-40", tone === "bad" ? "hover:bg-accent/10 hover:text-accent" : "hover:bg-brand/10 hover:text-brand")}
    >
      {children}
    </button>
  );
}

/** The small arrow at the end of a row that opens something. */
export const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
);
