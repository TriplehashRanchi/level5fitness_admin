"use client";

import { useEffect, useRef } from "react";

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

export function StatCard({ label, value, hint, tone }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cx("mt-4 text-4xl font-semibold tracking-tight tabular-nums", tone === "brand" ? "text-brand" : tone === "warn" ? "text-amber-300" : "text-white")}>{value}</p>
      {hint ? <p className="mt-3 text-xs leading-5 text-muted">{hint}</p> : null}
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
