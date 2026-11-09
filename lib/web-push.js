// Browser alerts for dietitians: ask the browser's permission, get this browser's Firebase Cloud
// Messaging token (with the project's Web Push certificate), and tell the API about it.
// Only call these from the browser (they use window, Notification and the service worker).

import { api } from "@/lib/api";
import { firebaseConfig, VAPID_KEY } from "@/lib/config";
import { firebaseApp } from "@/lib/firebase";

const STORE = "l5.browser-alerts.token";

const saved = () => {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
};
const remember = (token) => {
  try {
    if (token) localStorage.setItem(STORE, token);
    else localStorage.removeItem(STORE);
  } catch {
    // private window: nothing to remember
  }
};

/** "ok", "unsupported" (this browser cannot), or "not-configured" (the keys are missing in .env). */
export function browserAlertSupport() {
  if (typeof window === "undefined") return "unsupported";
  if (!VAPID_KEY || !firebaseConfig.messagingSenderId) return "not-configured";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ok";
}

/** "on", "off" or "blocked" (the person said no in the browser: only they can undo that). */
export function browserAlertState() {
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" && saved() ? "on" : "off";
}

const deviceName = () => {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : "";
  return `${browser}${os ? ` on ${os}` : ""}`;
};

/**
 * Turns alerts on for this browser. Shows the browser's permission question the first time, so call it
 * from a click. If permission was already given it works silently (used to re-connect after sign-in).
 */
export async function enableBrowserAlerts({ timeoutMs = 25_000 } = {}) {
  if (browserAlertSupport() !== "ok") throw new Error("This browser cannot show alerts.");
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Alerts are blocked in this browser. Allow notifications for this site in the address bar, then try again.");

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("This browser cannot show alerts.");
  // The browser asks Google's push service for this browser's address. On a blocked network (VPN, firewall,
  // some privacy extensions) that never answers, so do not wait for ever.
  const token = await Promise.race([
    getToken(getMessaging(firebaseApp), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Could not reach the browser's push service. Check your connection, turn off any VPN or ad blocker for this site, and try again.")), timeoutMs)),
  ]);
  if (!token) throw new Error("Could not set up alerts. Please try again.");

  await api("/me/push-token", { method: "POST", body: { token, platform: "web", deviceName: deviceName() } });
  remember(token);
  return token;
}

/** Turns alerts off for this browser. */
export async function disableBrowserAlerts() {
  const token = saved();
  if (token) await api("/me/push-token/remove", { method: "POST", body: { token } }).catch(() => {});
  remember(null);
  try {
    const { getMessaging, deleteToken, isSupported } = await import("firebase/messaging");
    if (await isSupported()) await deleteToken(getMessaging(firebaseApp));
  } catch {
    // already gone
  }
}

/** At sign-out: stop alerts for the person leaving (the next person on this computer is not alerted for them). */
export async function releaseBrowser() {
  const token = saved();
  if (!token) return;
  await api("/me/push-token/remove", { method: "POST", body: { token } }).catch(() => {});
  remember(null);
}
