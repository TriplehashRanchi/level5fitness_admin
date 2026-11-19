"use client";

import { useEffect, useRef } from "react";
import { ConsoleIcon } from "@/components/console-icon";

export const cx = (...parts) => parts.filter(Boolean).join(" ");

// ── Buttons ──────────────────────────────────────────────────────────────────────────────────

const BUTTON = {
  primary: "bg-brand text-ink hover:bg-brand-dark font-bold",
  secondary: "bg-card-2 text-white hover:bg-white/10 border border-line",
  ghost: "text-muted hover:text-white hover:bg-white/5",
  danger: "bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30 font-semibold",
};

export function Button({ variant = "primary", size = "md", loading = false, className, children, disabled, ...rest }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3.5 py-1.5 text-xs" : "px-5 py-2.5 text-sm",
        BUTTON[variant],
        className
      )}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ size = 20 }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function PageSpinner({ label = "Loading…" }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted" role="status">
      <Spinner size={28} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────────────────────

export function Card({ className, children, ...rest }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-card p-5 sm:p-6", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardTitle({ children, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold text-white">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const TONES = {
  neutral: "bg-white/8 text-zinc-300",
  brand: "bg-brand/15 text-brand",
  good: "bg-emerald-400/15 text-emerald-300",
  warn: "bg-amber-400/15 text-amber-300",
  bad: "bg-accent/15 text-accent",
  sky: "bg-sky/15 text-sky",
};

export function Badge({ tone = "neutral", children }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", TONES[tone])}>
      {children}
    </span>
  );
}

export function Alert({ tone = "bad", children, action }) {
  const styles = {
    bad: "border-accent/40 bg-accent/10",
    good: "border-brand/40 bg-brand/10",
    info: "border-line bg-card-2",
  };
  return (
    <div role="alert" className={cx("flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm leading-6 text-white", styles[tone])}>
      <span>{children}</span>
      {action}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 px-6 py-12 text-center">
      <p className="text-base font-bold text-white">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, tone, icon }) {
  const accent = tone === "brand" ? "text-brand bg-brand/12" : tone === "warn" ? "text-amber-300 bg-amber-400/12" : "text-zinc-300 bg-white/8";
  return (
    <div className="group rounded-2xl border border-line bg-gradient-to-b from-card to-panel p-5 transition-colors hover:border-white/15">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon ? <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", accent)}><ConsoleIcon name={icon} size={16} /></span> : null}
      </div>
      <p className={cx("mt-3 text-4xl font-semibold tracking-tight tabular-nums", tone === "brand" ? "text-brand" : tone === "warn" ? "text-amber-300" : "text-white")}>{value}</p>
      {hint ? <p className="mt-2 border-t border-line pt-3 text-xs leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({ value, tone = "brand", label }) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
      className="h-2 overflow-hidden rounded-full bg-card-2"
    >
      <div className={cx("h-full rounded-full", tone === "sky" ? "bg-sky" : "bg-brand")} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Avatar({ name, image, size = 40 }) {
  const initials =
    (name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "L5";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand font-black text-ink"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" width={size} height={size} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials
      )}
    </span>
  );
}

// ── Forms ────────────────────────────────────────────────────────────────────────────────────

const CONTROL =
  "w-full rounded-2xl border border-line bg-card-2 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-brand/60 disabled:opacity-50";

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-zinc-200">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const Input = ({ className, ...rest }) => <input className={cx(CONTROL, className)} {...rest} />;
export const Select = ({ className, children, ...rest }) => (
  <select className={cx(CONTROL, "pr-8", className)} {...rest}>
    {children}
  </select>
);
export const Textarea = ({ className, ...rest }) => <textarea className={cx(CONTROL, "min-h-20", className)} {...rest} />;

/** An on/off switch. `label` is read out; nothing is shown next to it. */
export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40", checked ? "bg-brand" : "bg-card-3")}
    >
      <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

// ── Dialogs ──────────────────────────────────────────────────────────────────────────────────

/** A real <dialog>: the browser keeps focus inside, closes it with Esc, and dims the page. */
export function Modal({ open, onClose, title, children, footer, wide = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // a click on the dimmed area
      }}
      className={cx(
        "m-auto w-[calc(100%-2rem)] rounded-3xl border border-line bg-card p-0 text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        wide ? "max-w-2xl" : "max-w-md"
      )}
    >
      {open ? (
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <h2 className="text-lg font-black text-white">{title}</h2>
          <div className="mt-4">{children}</div>
          {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, busy, onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-6 text-muted">{message}</p>
    </Modal>
  );
}

// ── Sections, placeholders and media (client detail page) ────────────────────────────────────

/** A titled, anchor-able section card: same radius, spacing and heading style everywhere. */
export function Section({ id, title, description, action, tone, children, className }) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cx(
        "scroll-mt-[calc(var(--bar,65px)+60px)] rounded-3xl border bg-card p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-7",
        tone === "brand" ? "border-brand/30" : "border-line",
        className
      )}
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold tracking-tight text-white">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{description}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** A shimmering placeholder block. Give it the size of what will replace it to avoid layout shift. */
export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cx("skeleton rounded-xl", className)} />;
}

/** Placeholder for a section body while it loads. */
export function SectionSkeleton({ rows = 3, label = "Loading…" }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** An error inside one section, with a way to try again. The rest of the page keeps working. */
export function SectionError({ children, onRetry, retrying }) {
  return (
    <Alert action={onRetry ? <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying}>Retry</Button> : null}>
      {children}
    </Alert>
  );
}

/** A soft empty state with a hint about what to do next. */
export function Empty({ title, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center">
      <p className="text-sm font-semibold text-white">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted">{children}</p> : null}
    </div>
  );
}

const CHIP_TONES = {
  neutral: "border-line bg-card-2 text-zinc-200",
  brand: "border-brand/30 bg-brand/10 text-brand",
  good: "border-good/30 bg-good/10 text-good",
  warn: "border-warn/30 bg-warn/10 text-warn",
  bad: "border-accent/30 bg-accent/10 text-accent",
};

export function Chip({ tone = "neutral", children }) {
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", CHIP_TONES[tone])}>{children}</span>;
}

/** A full-screen photo viewer on a native <dialog>: Esc closes, arrow keys move between photos. */
export function Lightbox({ photos, index, onClose, onIndex }) {
  const ref = useRef(null);
  const open = index != null && photos[index] != null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight" && index < photos.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, photos.length, onIndex]);

  const photo = open ? photos[index] : null;
  return (
    <dialog
      ref={ref}
      aria-label="Meal photo"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-1.5rem)] max-w-3xl rounded-3xl border border-line bg-card p-0 text-white backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      {photo ? (
        <figure className="flex max-h-[92vh] flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.caption || "Meal"} className="max-h-[72vh] w-auto max-w-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <figcaption className="flex items-center justify-between gap-3 p-4">
            <span className="min-w-0 text-sm">
              <span className="block truncate font-semibold text-white">{photo.caption}</span>
              {photo.note ? <span className="block truncate text-xs text-muted">{photo.note}</span> : null}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Button variant="secondary" size="sm" aria-label="Previous photo" disabled={index <= 0} onClick={() => onIndex(index - 1)}>‹</Button>
              <span className="text-xs tabular-nums text-muted">{index + 1} / {photos.length}</span>
              <Button variant="secondary" size="sm" aria-label="Next photo" disabled={index >= photos.length - 1} onClick={() => onIndex(index + 1)}>›</Button>
              <Button size="sm" onClick={onClose}>Close</Button>
            </span>
          </figcaption>
        </figure>
      ) : null}
    </dialog>
  );
}
