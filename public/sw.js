/* Service Worker דחיפה-בלבד (שלב 4 — תזכורות אמיתיות).
   בכוונה אין כאן fetch handler ואין cache — ה-SW הקודם בוטל בדיוק בגלל סיכון
   של קוד ישן תקוע ב-cache. SW שמטפל רק ב-push לא נוגע ברשת בכלל:
   כל טעינת דף ממשיכה להגיע ישירות מהשרת (תמיד קוד עדכני). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// קבלת דחיפה מ-FCM והצגת התראה. הפורמט: payload.notification מהודעות webpush.
self.addEventListener("push", (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { /* payload לא-JSON — מציגים ברירת מחדל */ }
  const n = p.notification || p.data || {};
  const title = n.title || "🏐 כדורשת";
  e.waitUntil(self.registration.showNotification(title, {
    body: n.body || "",
    icon: n.icon || "/logo192.png",
    badge: "/logo192.png",
    dir: "rtl",
    lang: "he",
    tag: n.tag || undefined,        // tag זהה = החלפת התראה קיימת (בלי הצטברות)
    data: { url: (p.fcmOptions && p.fcmOptions.link) || (p.data && p.data.url) || "/" },
  }));
});

// לחיצה על התראה: מתמקדים בחלון קיים של האפליקציה אם יש, אחרת פותחים חדש.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { if ("navigate" in c) c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
