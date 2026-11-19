"use client";

import { useEffect, useState } from "react";
import { messageOf } from "@/lib/api";
import { browserAlertState, browserAlertSupport, disableBrowserAlerts, enableBrowserAlerts } from "@/lib/web-push";
import { cx } from "@/components/ui";

/**
 * A row in the account menu: alerts on this computer, on or off. A dietitian is told by the API when
 * the admin assigns them a client; this is how that reaches the browser.
 */
export default function BrowserAlerts() {
  const [state, setState] = useState(null); // null until the browser has been asked
  const [support, setSupport] = useState("ok");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const kind = browserAlertSupport();
    (async () => {
      let next = "off";
      if (kind === "ok") {
        next = browserAlertState();
        // Already allowed in this browser (for example after signing in again): connect quietly.
        if (next === "off" && Notification.permission === "granted") {
          next = await enableBrowserAlerts({ timeoutMs: 10_000 }).then(() => "on").catch(() => "off");
        }
      }
      if (!cancelled) {
        setSupport(kind);
        setState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async () => {
    setBusy(true);
    setProblem(null);
    try {
      if (state === "on") {
        await disableBrowserAlerts();
        setState("off");
      } else {
        await enableBrowserAlerts();
        setState("on");
      }
    } catch (e) {
      setProblem(messageOf(e));
      setState(browserAlertState());
    } finally {
      setBusy(false);
    }
  };

  const on = state === "on";
  const usable = support === "ok" && state !== "blocked" && state !== null;
  const note =
    support === "unsupported" ? "This browser cannot show alerts."
      : support === "not-configured" ? "Not set up yet."
      : state === "blocked" ? "Blocked in this browser. Allow notifications for this site, then reload."
      : "Know at once when you get a new client.";

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Alerts on this computer</p>
          <p className="mt-0.5 text-xs leading-4 text-muted">{note}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Alerts on this computer"
          disabled={!usable || busy}
          onClick={toggle}
          className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40", on ? "bg-brand" : "bg-card-3")}
        >
          <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
        </button>
      </div>
      {problem ? <p className="mt-2 text-xs text-accent" role="alert">{problem}</p> : null}
    </div>
  );
}
