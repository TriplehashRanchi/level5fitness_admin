/* Shows L5 Fitness alerts in the browser, even when the console is closed. Served from the site root. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // not JSON: show a plain alert below
  }
  // Firebase delivers our message under "data".
  const d = payload.data || payload.notification || payload;
  event.waitUntil(
    self.registration.showNotification(d.title || "L5 Fitness", {
      body: d.body || "",
      icon: "/favicon.ico",
      tag: d.notificationId || undefined,
      data: { url: "/notifications" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/notifications", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
