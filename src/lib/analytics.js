import { GA_MEASUREMENT_ID } from "./constants";

// ── Google Analytics 4 — טעינה עצלה ומכבדת-פרטיות ────────────────────────────
// עקרונות: (1) בלי מזהה — לא נטען כלום, אין עוגיות. (2) לא אוספים מידע מזהה
// (בלי שמות/מיילים/מזהי-שחקניות) — רק ספירת מסכים ופעולות מצטברות.
// (3) anonymize_ip. הכל תואם למה שנכתב במדיניות הפרטיות.

let ready = false;

export function initAnalytics() {
  if (ready || !GA_MEASUREMENT_ID) return;
  if (typeof window === "undefined" || typeof document === "undefined") return;
  ready = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: false, // מסכים נשלחים ידנית (SPA — אין ניווטי-דף אמיתיים)
  });
}

// צפייה במסך. name = מזהה המסך הפנימי (home/player/admin/landing…)
export function trackScreen(name) {
  if (!ready || !window.gtag) return;
  window.gtag("event", "screen_view", { screen_name: String(name || "").slice(0, 40) });
}

// אירוע עסקי (בלי פרטים מזהים). למשל: trial_started, rsvp_marked, push_enabled
export function trackEvent(name, params) {
  if (!ready || !window.gtag) return;
  window.gtag("event", String(name || "").slice(0, 40), params || {});
}
