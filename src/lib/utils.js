function formatDate(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function formatShort(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}
function getNextEvent(events) {
  const today = new Date().toISOString().split("T")[0];
  return events.filter(e => e.date >= today && e.open && !e.cancelled).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}
// מספר הימים עד תאריך yyyy-mm-dd (0 = היום, 1 = מחר)
function daysUntil(d) {
  if (!d) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const target = new Date(d + "T00:00:00");
  return Math.round((target - t) / 86400000);
}
// תווית ספירה לאחור בעברית: "היום!" / "מחר" / "מחרתיים" / "עוד N ימים"
function countdownLabel(d) {
  const n = daysUntil(d);
  if (n === null) return "";
  if (n <= 0) return "היום!";
  if (n === 1) return "מחר";
  if (n === 2) return "מחרתיים";
  return `עוד ${n} ימים`;
}
// זיהוי iOS/iPadOS — שם signInWithPopup לא אמין (ITP מאבד את תוצאת ה-popup)
function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1; // iPadOS 13+ מתחזה ל-Mac
  return iOSDevice || iPadOS;
}
function todayStr() {
  // תאריך מקומי (לא UTC) — אחרת בשעות הערב toISOString קופץ ליום הבא וחוסם בחירת היום הנוכחי.
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
// returns "MM-DD" for a yyyy-mm-dd birthday string
function monthDay(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : "";
}
function isBirthdayToday(birthday) {
  if (!birthday) return false;
  const t = new Date();
  const td = `${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  return monthDay(birthday) === td;
}
function isBirthdayTomorrow(birthday) {
  if (!birthday) return false;
  const t = new Date(); t.setDate(t.getDate() + 1);
  const td = `${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  return monthDay(birthday) === td;
}
function ageFromBirthday(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday + "T12:00:00");
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}
// current year-month, e.g. "2026-06"
function currentYM() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}
// count applause received this month for a player
function applauseThisMonth(applause, playerId) {
  const ym = currentYM();
  return (applause || []).filter(a => a.toId === playerId && a.date.startsWith(ym)).length;
}
// has `fromId` already applauded `toId` today?
function alreadyApplaudedToday(applause, fromId, toId) {
  const today = todayStr();
  return (applause || []).some(a => a.fromId === fromId && a.toId === toId && a.date === today);
}
export { formatDate, formatShort, getNextEvent, daysUntil, countdownLabel, isIOS, todayStr, monthDay, isBirthdayToday, isBirthdayTomorrow, ageFromBirthday, currentYM, applauseThisMonth, alreadyApplaudedToday };
