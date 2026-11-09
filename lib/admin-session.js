// The admin's sign-in token (from POST /staff/login) is kept in this browser TAB only: it is gone when
// the tab is closed. Dietitians sign in with Google and never use this.
const KEY = "l5-admin-token";

export function getAdminToken() {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token) {
  try {
    window.sessionStorage.setItem(KEY, token);
  } catch {
    // storage blocked: the sign-in just will not survive a page reload
  }
}

export function clearAdminToken() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

/** Fired when the server says the admin's token is no longer valid (for example after 12 hours). */
export const ADMIN_SESSION_ENDED = "l5-admin-session-ended";
