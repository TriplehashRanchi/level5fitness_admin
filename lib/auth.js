"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api, ApiError, messageOf } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { ADMIN_SESSION_ENDED, clearAdminToken, getAdminToken, setAdminToken } from "@/lib/admin-session";

/**
 * loading    – working out who is signed in
 * signedOut  – nobody is
 * ready      – signed in AND allowed (the admin, or a dietitian who is not disabled)
 * denied     – signed in, but not allowed into the console
 * error      – could not ask the server (offline): offer a retry
 */
const AuthContext = createContext(null);

async function loadStaff() {
  const { staff } = await api("/staff/me");
  return staff;
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", staff: null, error: null });

  const apply = useCallback(async (user, isCurrent) => {
    if (!user) {
      setState({ status: "signedOut", staff: null, error: null });
      return;
    }
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const staff = await loadStaff();
      if (isCurrent()) setState({ status: staff.allowed ? "ready" : "denied", staff, error: null });
    } catch (e) {
      if (!isCurrent()) return;
      // The server does not accept this sign-in at all: start again.
      if (e instanceof ApiError && e.status === 401) {
        await firebaseSignOut(auth).catch(() => {});
        return;
      }
      setState({ status: "error", staff: null, error: messageOf(e) });
    }
  }, []);

  useEffect(() => {
    let run = 0;
    return onAuthStateChanged(auth, (user) => {
      // The admin is signed in with the API's own token, not with Firebase: do not undo that.
      if (!user && getAdminToken()) return;
      const mine = ++run;
      apply(user, () => mine === run);
    });
  }, [apply]);

  // An admin who was already signed in when this page opened (a reload keeps the token for the tab).
  useEffect(() => {
    if (!getAdminToken()) return;
    let cancelled = false;
    loadStaff()
      .then((staff) => !cancelled && setState({ status: staff.allowed ? "ready" : "denied", staff, error: null }))
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) clearAdminToken();
        setState(
          e instanceof ApiError && e.status === 401
            ? { status: "signedOut", staff: null, error: null }
            : { status: "error", staff: null, error: messageOf(e) }
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The server ended the admin's session (12 hours are up).
  useEffect(() => {
    const onEnded = () => setState({ status: "signedOut", staff: null, error: null });
    window.addEventListener(ADMIN_SESSION_ENDED, onEnded);
    return () => window.removeEventListener(ADMIN_SESSION_ENDED, onEnded);
  }, []);

  const retry = useCallback(() => apply(auth.currentUser, () => true), [apply]);

  /** The admin's sign-in: email and password that the API checks against its .env. Returns a message, or null. */
  const signInAsAdmin = useCallback(async (email, password) => {
    let res;
    try {
      res = await fetch(`${API_URL}/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      return "Cannot reach the server. Check your connection and try again.";
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.token) return data?.error?.message || "Something went wrong. Please try again.";
    setAdminToken(data.token);
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const staff = await loadStaff();
      setState({ status: staff.allowed ? "ready" : "denied", staff, error: null });
      return null;
    } catch (e) {
      clearAdminToken();
      setState({ status: "signedOut", staff: null, error: null });
      return messageOf(e);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
      return null;
    } catch (e) {
      const code = e?.code || "";
      // Closing the window is a change of mind, not an error.
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
      if (code === "auth/popup-blocked") return "Your browser blocked the Google window. Allow pop-ups for this site and try again.";
      if (code === "auth/network-request-failed") return "Cannot reach Google. Check your connection and try again.";
      if (code === "auth/unauthorized-domain") return "This website address is not allowed for sign-in yet. Ask the admin to add it in Firebase.";
      return "Google sign-in did not work. Please try again.";
    }
  }, []);

  // Used only when the developer email form is switched on (see lib/config.js).
  const signInWithEmail = useCallback(async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return null;
    } catch {
      return "Incorrect email or password.";
    }
  }, []);

  const signOut = useCallback(async () => {
    // Stop browser alerts for this person first: afterwards the API no longer knows who is asking.
    await import("@/lib/web-push").then((m) => m.releaseBrowser()).catch(() => {});
    clearAdminToken();
    setState({ status: "signedOut", staff: null, error: null });
    await firebaseSignOut(auth).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ ...state, retry, signInWithGoogle, signInWithEmail, signInAsAdmin, signOut }),
    [state, retry, signInWithGoogle, signInWithEmail, signInAsAdmin, signOut]
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
