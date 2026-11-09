import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "@/lib/config";

// One Firebase app for the whole console. Importing this file in the browser is safe;
// it never runs during the server's prerender because only client components use it.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firebaseApp = app;
