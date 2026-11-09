import { auth } from "@/lib/firebase";
import { API_URL } from "@/lib/config";
import { ADMIN_SESSION_ENDED, clearAdminToken, getAdminToken } from "@/lib/admin-session";

/** The server answered with an error. `message` is written to be shown to people. */
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * One place for every call to the API, as the signed-in person.
 * Firebase renews the sign-in token by itself shortly before it expires.
 */
export async function api(path, { method = "GET", body } = {}) {
  // The admin's own token if there is one, otherwise the Firebase sign-in (dietitians).
  const adminToken = getAdminToken();
  let token = adminToken;
  try {
    if (!token) token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  } catch {
    throw new ApiError("Your sign-in could not be refreshed. Check your connection and try again.", 0, "NETWORK");
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection and try again.", 0, "NETWORK");
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // not JSON
  }
  if (!res.ok) {
    if (res.status === 401 && adminToken) {
      // The admin's 12 hours are over (or the secret changed): sign in again.
      clearAdminToken();
      window.dispatchEvent(new Event(ADMIN_SESSION_ENDED));
    }
    throw new ApiError(data?.error?.message || "Something went wrong. Please try again.", res.status, data?.error?.code);
  }
  return data;
}

/** A message that is safe to show for any failure. */
export const messageOf = (error) =>
  error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
