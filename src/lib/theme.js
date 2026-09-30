// ── מצב לילה ────────────────────────────────────────────────────────────────
// שלוש בחירות: "auto" (ברירת המחדל) | "light" | "dark". באוטומטי — לילה לפי
// השעון בלבד, 19:00 עד 07:00 שעון ישראל, כמו בגול־טיים. הגדרת הכהות של
// הטלפון לא נחשבת בכוונה: טלפון שכהה כל היום היה מחשיך את האפליקציה בצהריים
// (הלקח מגול־טיים, 23.9.26).
//
// המצב בפועל נכתב ל-<html data-theme="light|dark">, ושכבת הצבעים של הלילה
// (styles/dark.css) נשענת רק עליו — אף מסך לא צריך לדעת על מצב הלילה.
import { useEffect, useState } from "react";

const KEY = "vbTheme";
const EVT = "vb-theme";

// hourCycle h23: עם hour12:false חלק מהמנועים מחזירים 24 בחצות
const FMT_HOUR = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hourCycle: "h23" });

export function isNightNow(now = new Date()) {
  try {
    const h = Number(FMT_HOUR.format(now));
    return h >= 19 || h < 7;
  } catch { return false; }
}

export function getThemePref() {
  try { return localStorage.getItem(KEY) || "auto"; } catch { return "auto"; }
}

export function setThemePref(p) {
  try { localStorage.setItem(KEY, p); } catch {}
  window.dispatchEvent(new Event(EVT));
}

export function resolveMode(pref, now = new Date()) {
  return pref === "auto" ? (isNightNow(now) ? "dark" : "light") : pref;
}

// הבחירה + מעבר לבחירה הבאה (אוטומטי → יום → לילה → אוטומטי)
export function useThemePref() {
  const [pref, setPref] = useState(getThemePref);
  useEffect(() => {
    const on = () => setPref(getThemePref());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); };
  }, []);
  const cycle = () => setThemePref(pref === "auto" ? "light" : pref === "light" ? "dark" : "auto");
  return [pref, cycle];
}

// מופעל פעם אחת ב-App: כותב את המצב ל-<html> ומתקדם לבד ב-19:00 וב-07:00
// בלי לפתוח מחדש את האפליקציה (בדיקה כל דקה + בחזרה לחלון).
export function useApplyTheme() {
  const [pref] = useThemePref();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    const vis = () => { if (document.visibilityState === "visible") setTick((t) => t + 1); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, []);
  useEffect(() => {
    const mode = resolveMode(pref);
    const root = document.documentElement;
    if (root.dataset.theme !== mode) root.dataset.theme = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      if (!meta.dataset.day) meta.dataset.day = meta.getAttribute("content") || "";
      meta.setAttribute("content", mode === "dark" ? "#0c1022" : meta.dataset.day);
    }
  }, [pref, tick]);
}

export const THEME_LABEL = {
  auto: "אוטומטי — לילה מ-19:00 עד 07:00",
  light: "מצב יום",
  dark: "מצב לילה",
};
export const THEME_ICON = { auto: "🌓", light: "☀️", dark: "🌙" };
