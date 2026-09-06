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
// ── מצב האירוע ביחס לשעה עכשיו ──────────────────────────────────────────────
// לאירוע אין שעת סיום במערכת, ולכן מניחים משך קבוע.
// אחרי שהאירוע התחיל "אישור הגעה" כבר אינו תחזית אלא דיווח, והדיווח שייך
// למנהלת שנמצאת באולם — ולכן הכפתורים נסגרים ולא רק משנים צבע. שחקנית
// שלוחצת "מגיעה" בשעה 18:00 מזיזה בדיוק את המספרים שמארכבים באותו ערב.
const EVENT_MINUTES = 120;

function hhmmToMin(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

// "before" (טרם התחיל) | "live" (מתקיים כעת) | "done" (הסתיים)
function eventPhase(ev, now = new Date()) {
  if (!ev || !ev.date) return "before";
  const td = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (ev.date > td) return "before";
  if (ev.date < td) return "done";
  // אירוע היום בלי שעה — לא יודעים מתי התחיל, אז לא מקפיאים כלום.
  // בלי זה ברירת המחדל 00:00 הייתה מסמנת אותו "הסתיים" כבר בבוקר.
  if (!ev.time) return "before";
  const start = hhmmToMin(ev.time);
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur < start) return "before";
  return cur < start + EVENT_MINUTES ? "live" : "done";
}

// התווית על הכרטיס + המשפט שמחליף את כפתורי האישור.
// אין תוספת "לא ניתן לשנות תשובה": אין כפתור, אז זה ברור מאליו.
function eventStateLabel(ev, phase) {
  const noun = ev && ev.type === "game" ? "המשחק" : "האימון";
  if (phase === "live") return { pill: "▶️ מתקיים כעת", line: `${noun} מתקיים כעת`, icon: "▶️" };
  if (phase === "done") return { pill: "✓ הסתיים", line: `${noun} הסתיים`, icon: "🏐" };
  return { pill: `⏳ ${countdownLabel(ev && ev.date)}`, line: "", icon: "" };
}

// זיהוי iOS/iPadOS — שם signInWithPopup לא אמין (ITP מאבד את תוצאת ה-popup)
function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1; // iPadOS 13+ מתחזה ל-Mac
  return iOSDevice || iPadOS;
}
// Samsung Internet — דפדפן ברירת המחדל במכשירי גלקסי. הוא מייצר WebAPK משרת
// המנטה של סמסונג, וה-APK שיוצא משם מכוון ל-SDK ישן; אנדרואיד 14+ חוסם התקנה
// כזו, ו-Play Protect מציג "אפליקציה לא בטוחה נחסמה · תוכננה לגרסה ישנה יותר
// של Android" (דווח משחקנית 5.9.2026). ההתקנה מכרום עובדת — שם המנטה של גוגל.
// שים לב: סמסונג כן יורה beforeinstallprompt, כלומר כפתור ההתקנה "בלחיצה אחת"
// מוצג ואז נכשל. לכן הבדיקה הזו חייבת לגבור עליו.
function isSamsungInternet() {
  if (typeof navigator === "undefined") return false;
  return /SamsungBrowser/i.test(navigator.userAgent || "");
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
export { eventPhase, eventStateLabel, EVENT_MINUTES, isSamsungInternet, deviceLabel, DEFAULT_INVITE, buildInvite, formatDate, formatShort, getNextEvent, daysUntil, countdownLabel, isIOS, todayStr, monthDay, isBirthdayToday, isBirthdayTomorrow, ageFromBirthday, currentYM, applauseThisMonth, alreadyApplaudedToday };
