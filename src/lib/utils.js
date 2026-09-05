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
// סוג המכשיר מתוך userAgent, בקצרה — למנהלת שרוצה לדעת למי להסביר "לחצי שיתוף"
// ולמי "תפריט שלוש נקודות". מוצג ליד השם ברשימת השחקניות, ולכן קצר בכוונה.
// מחזיר מחרוזת ריקה כשלא ידוע — עדיף כלום מאשר "לא ידוע" שתופס מקום ולא אומר כלום.
function deviceLabel(ua) {
  const s = String(ua || "");
  if (!s) return "";
  if (/iPad/i.test(s)) return "🍎 אייפד";
  if (/iPhone|iPod/i.test(s)) return "🍎 אייפון";
  if (/Android/i.test(s)) return "🤖 אנדרואיד";
  if (/Windows|Macintosh|Linux|CrOS/i.test(s)) return "💻 מחשב";
  return "";
}

// ── הודעת ההזמנה לוואטסאפ ────────────────────────────────────────────────────
// הנוסח הקודם היה "הצטרפי לקבוצת {שם} שלנו" — ושמות הקבוצות כבר פותחים ב"קבוצת",
// אז יצא "הצטרפי לקבוצת קבוצת הכדורשת של הבנק הבינלאומי" (דווח מהשטח 5.9.26).
// כאן שם הקבוצה הוא נושא המשפט ולא נגרר אחרי מילת יחס, ולכן הוא עובד גם לשם
// שאינו פותח ב"קבוצת" ("מכבי חיפה עוברת לאפליקציה"). וגם: היא כבר בקבוצה —
// מה שהיא מצטרפת אליו הוא האפליקציה.
const DEFAULT_INVITE = `היי! 🏐 {קבוצה} עוברת לאפליקציה.
אישור הגעה בלחיצה, לוח האימונים, ותזכורת לפני כל אימון.
כניסה ראשונה לוקחת דקה: בחרי את שמך וקבעי סיסמה.
{קישור}`;

// המנהלת יכולה לערוך את הנוסח. הקישור מצורף גם אם מחקה את {קישור} מהתבנית —
// הזמנה בלי קישור היא הודעה חסרת תועלת, וזו טעות קלה מדי לעשות.
function buildInvite(template, teamName, link) {
  const t = String(template || "").trim() || DEFAULT_INVITE;
  const name = String(teamName || "").trim() || "קבוצת הכדורשת";
  let msg = t.split("{קבוצה}").join(name);
  if (msg.includes("{קישור}")) msg = msg.split("{קישור}").join(link);
  else msg = msg.replace(/\s+$/, "") + "\n" + link;
  return msg;
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
export { deviceLabel, DEFAULT_INVITE, buildInvite, formatDate, formatShort, getNextEvent, daysUntil, countdownLabel, isIOS, todayStr, monthDay, isBirthdayToday, isBirthdayTomorrow, ageFromBirthday, currentYM, applauseThisMonth, alreadyApplaudedToday };
