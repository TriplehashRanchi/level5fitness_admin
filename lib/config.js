// NEXT_PUBLIC_* values are written into the page at build time, so each one has to be
// referenced by its full name like this (Next.js does not look them up dynamically).
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

/** The public key of the "Web Push certificate" (Firebase console > Cloud Messaging). Needed for browser alerts. */
export const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

/** A plain email + password form on the login page, for developers and automated tests only. */
export const DEV_EMAIL_LOGIN = process.env.NEXT_PUBLIC_DEV_EMAIL_LOGIN === "1";
