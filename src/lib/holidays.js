// ── חגי ישראל לפי התאריך העברי ───────────────────────────────────────────────
//
// התאריך העברי מחושב על ידי הדפדפן עצמו (Intl עם לוח עברי), ולא מטבלה של
// תאריכים לועזיים. זה ההבדל בין טבלה שנכתבת פעם אחת ונשארת נכונה לנצח, לבין
// טבלה שמישהו צריך לעדכן בכל ספטמבר — ואם ישכח, ברכות יופיעו בתאריכים שגויים
// אצל כל הקבוצות. גם שנים מעוברות מטופלות: פורים יודע לזהות אדר ב׳.
//
// שלוש נימות, וזו ההחלטה החשובה כאן:
//   hag   — ברכה מלאה, צבע, איור.
//   moed  — יום זיכרון. בלי "שמח", בלי צבע, בלי חגיגיות.
//   tzom  — צום. "צום קל", לא "חג שמח".
// "חג שמח" ביום הזיכרון היא טעות שאין ממנה חזרה, ולכן ההפרדה יושבת במבנה
// הנתונים עצמו ולא בניסוח של מי שיוסיף חג בעתיד.

// התאריך העברי של יום לועזי. מחזיר { m: "Tishri", d: 1, leap: false }
function hebDate(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-hebrew", {
      year: "numeric", month: "long", day: "numeric",
    }).formatToParts(date);
    const get = (t) => (parts.find((p) => p.type === t) || {}).value || "";
    const m = get("month");
    return { m, d: Number(get("day")), leap: m === "Adar I" || m === "Adar II" };
  } catch {
    return null; // דפדפן בלי לוח עברי — פשוט לא מציגים ברכה
  }
}

// יום בשבוע 0=ראשון .. 6=שבת
const dow = (date) => date.getDay();

// ── ימי הזיכרון הלאומיים זזים ────────────────────────────────────────────────
// אלה החגים היחידים שאינם בתאריך עברי קבוע: החוק מזיז אותם כדי שלא ייפלו
// בשבת או צמוד לה. תאריך שגוי כאן גרוע במיוחד — באנר זיכרון ביום הלא נכון
// בולט הרבה יותר מברכה שמאחרת ביום.
function isYomHashoah(h, date) {
  if (h.m !== "Nisan") return false;
  const wd = dow(date);
  if (h.d === 27) return wd !== 5 && wd !== 0;       // לא בשישי ולא בראשון
  if (h.d === 26) return wd === 4;                    // הוקדם ליום חמישי
  if (h.d === 28) return wd === 1;                    // נדחה ליום שני
  return false;
}
function isYomHazikaron(h, date) {
  if (h.m !== "Iyar") return false;
  const wd = dow(date);
  if (h.d === 4) return wd !== 4 && wd !== 5 && wd !== 0; // לא חמישי/שישי/ראשון
  if (h.d === 2) return wd === 3;   // הוקדם ליום רביעי (כשה־5 באייר שבת)
  if (h.d === 3) return wd === 3;   // הוקדם ליום רביעי (כשה־5 באייר שישי)
  if (h.d === 5) return wd === 1;   // נדחה ליום שני (כשה־5 באייר ראשון)
  return false;
}
function isYomHaatzmaut(h, date) {
  if (h.m !== "Iyar") return false;
  const wd = dow(date);
  if (h.d === 5) return wd !== 5 && wd !== 6 && wd !== 1; // לא שישי/שבת/שני
  if (h.d === 3) return wd === 4;   // הוקדם ליום חמישי
  if (h.d === 4) return wd === 4;   // הוקדם ליום חמישי
  if (h.d === 6) return wd === 2;   // נדחה ליום שלישי
  return false;
}

// ── הטבלה ───────────────────────────────────────────────────────────────────
// הסדר קובע: הראשון שמתאים מנצח. ימי הזיכרון לפני יום העצמאות בכוונה.
const HOLIDAYS = [
  { key: "erev-rosh", kind: "hag", match: (h) => h.m === "Elul" && h.d === 29,
    title: "ערב ראש השנה — שנה טובה ומתוקה 🍯",
    sub: "שתהיה לכולנו שנה של בריאות, ניצחונות והמון כיף על המגרש",
    art: "apple", bg: ["#b45309", "#dc2626", "#f5c842"] },

  { key: "rosh", kind: "hag", match: (h) => h.m === "Tishri" && h.d <= 2,
    title: "שנה טובה ומתוקה 🍯",
    sub: "שתהיה לכולנו שנה של בריאות, ניצחונות והמון כיף על המגרש",
    art: "apple", bg: ["#b45309", "#dc2626", "#f5c842"] },

  { key: "erev-kip", kind: "tzom", match: (h) => h.m === "Tishri" && h.d === 9,
    title: "גמר חתימה טובה", sub: "צום קל למי שצמה",
    art: "quiet", bg: ["#0c4a6e", "#0369a1"] },

  { key: "kip", kind: "tzom", match: (h) => h.m === "Tishri" && h.d === 10,
    title: "גמר חתימה טובה", sub: "צום קל למי שצמה",
    art: "quiet", bg: ["#0c4a6e", "#0369a1"] },

  { key: "sukkot", kind: "hag", match: (h) => h.m === "Tishri" && h.d >= 14 && h.d <= 16,
    title: "חג סוכות שמח 🌿", sub: "חג שמח לכן ולמשפחות",
    art: "sukka", bg: ["#14532d", "#16a34a", "#65a30d"] },

  { key: "torah", kind: "hag", match: (h) => h.m === "Tishri" && h.d === 22,
    title: "חג שמחת תורה שמח 🌿", sub: "חג שמח לכן ולמשפחות",
    art: "sukka", bg: ["#14532d", "#16a34a", "#65a30d"] },

  // חנוכה נמשך שמונה ימים וחוצה מכסלו לטבת. כסלו הוא 29 או 30 יום, ולכן
  // הטווח כאן נדיב ביום אחד לכל היותר — מחיר סביר לעומת חישוב שמונה הימים.
  { key: "hanuka", kind: "hag",
    match: (h) => (h.m === "Kislev" && h.d >= 25) || (h.m === "Tevet" && h.d <= 2),
    title: "חג אורים שמח 🕎", sub: "שמונה ימים של אור, סופגניות — ואימונים",
    art: "candles", bg: ["#111f5c", "#1d4ed8", "#3b82f6"] },

  // פורים: אדר בשנה רגילה, אדר ב׳ בשנה מעוברת. Intl מחזיר את שם החודש הנכון,
  // ולכן די בהתאמה לשניהם — בשנה מעוברת "Adar" פשוט לא קיים.
  { key: "purim", kind: "hag",
    match: (h) => (h.m === "Adar" || h.m === "Adar II") && h.d === 14,
    title: "פורים שמח! 🎭", sub: "מחפשות תחפושת קבוצתית לאימון?",
    art: "mask", bg: ["#6d28d9", "#c026d3", "#f5c842"] },

  { key: "pesach", kind: "hag", match: (h) => h.m === "Nisan" && h.d >= 14 && h.d <= 16,
    title: "חג פסח כשר ושמח", sub: "חופש נעים — נתראה באימון הראשון אחרי החג",
    art: "matza", bg: ["#a16207", "#eab308", "#84cc16"] },

  { key: "pesach-end", kind: "hag", match: (h) => h.m === "Nisan" && h.d === 21,
    title: "חג פסח שמח", sub: "מוצאי החג — נתראה באימון",
    art: "matza", bg: ["#a16207", "#eab308", "#84cc16"] },

  { key: "shoah", kind: "moed", match: isYomHashoah,
    title: "יום הזיכרון לשואה ולגבורה", sub: "",
    art: "memorial", bg: ["#334155", "#475569"] },

  { key: "zikaron", kind: "moed", match: isYomHazikaron,
    title: "יום הזיכרון לחללי מערכות ישראל ולנפגעי פעולות האיבה", sub: "",
    art: "memorial", bg: ["#334155", "#475569"] },

  { key: "atzmaut", kind: "hag", match: isYomHaatzmaut,
    title: "יום העצמאות שמח 🇮🇱", sub: "חג שמח לכולן",
    art: "flag", bg: ["#0038b8", "#3b82f6", "#93c5fd"] },

  { key: "shavuot", kind: "hag", match: (h) => h.m === "Sivan" && h.d >= 5 && h.d <= 6,
    title: "חג שבועות שמח 🌾", sub: "חג שמח לכן ולמשפחות",
    art: "wheat", bg: ["#166534", "#65a30d", "#facc15"] },

];

// החג של היום, או null. date נמסר מבחוץ כדי שאפשר יהיה לבדוק כל תאריך.
function holidayFor(date = new Date()) {
  const h = hebDate(date);
  if (!h) return null;
  const found = HOLIDAYS.find((x) => {
    try { return x.match(h, date); } catch { return false; }
  });
  return found ? { ...found, heb: h } : null;
}

export { holidayFor, hebDate, HOLIDAYS };
