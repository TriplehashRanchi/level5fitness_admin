"use client";

/**
 * The live connection to the API (Socket.IO, same address as the API).
 *
 * It only RECEIVES news (a new chat message, "seen", "typing", "online") and sends small signals back. Messages
 * are saved through the normal API, so nothing is lost if this connection drops: the chat asks the API
 * every few seconds until it is back.
 *
 * One connection is shared by everything on the page that needs it, and closed when nothing does.
 */
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { auth } from "@/lib/firebase";
import { API_URL } from "@/lib/config";
import { getAdminToken } from "@/lib/admin-session";

let socket = null;
let users = 0;
let retry = null;

/** The same token the API calls use: the admin's own, otherwise the Firebase sign-in. */
async function token() {
  const admin = getAdminToken();
  if (admin) return admin;
  return auth.currentUser ? auth.currentUser.getIdToken() : "";
}

function create() {
  const s = io(API_URL, {
    // Asked for again on every (re)connection, so an expired token is never reused.
    auth: (cb) => {
      token()
        .then((t) => cb({ token: t || "" }))
        .catch(() => cb({ token: "" }));
    },
    // Socket.IO waits longer after each failed try, with some randomness, up to this.
    reconnectionDelayMax: 15_000,
  });
  // The server refusing the sign-in is final for Socket.IO: it does not try again by itself.
  s.on("connect_error", () => {
    if (s.active || retry) return;
    retry = setTimeout(() => {
      retry = null;
      if (socket === s && users > 0) s.connect();
    }, 8000);
  });
  return s;
}

/** Use the shared connection. Every call must be matched by one `releaseSocket()`. */
export function acquireSocket() {
  users += 1;
  if (!socket) socket = create();
  return socket;
}

export function releaseSocket() {
  users = Math.max(0, users - 1);
  if (users > 0 || !socket) return;
  if (retry) clearTimeout(retry);
  retry = null;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

/**
 * Runs `onNew(nudge)` whenever someone writes to the signed-in person in any chat. The nudge says which
 * thread, who wrote and the first words: { threadId, kind, memberId, dietitianId, from, senderName, preview, at }.
 */
export function useNewChatMessages(onNew) {
  const latest = useRef(onNew);
  useEffect(() => {
    latest.current = onNew;
  });
  useEffect(() => {
    const s = acquireSocket();
    const handler = (p) => p && latest.current(p);
    s.on("chat:new", handler);
    return () => {
      s.off("chat:new", handler);
      releaseSocket();
    };
  }, []);
}

/** True while the live connection is up. */
export function useSocketConnected() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const s = acquireSocket();
    const up = () => setConnected(true);
    const down = () => setConnected(false);
    s.on("connect", up);
    s.on("disconnect", down);
    if (s.connected) up();
    return () => {
      s.off("connect", up);
      s.off("disconnect", down);
      releaseSocket();
    };
  }, []);
  return connected;
}
