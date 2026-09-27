// ── טורנירים (הספורטיאדה) ──────────────────────────────────────────────────
//
// המבנה — הקבוצות, המשחקים, האולמות — מוגדר כאן בקוד, כי הוא מגיע פעם בשנה
// מלוח רשמי ולא משתנה. מה שמשתנה בזמן הטורניר — התוצאות ומצב הפרסום — יושב
// ב-Firestore תחת data/tournaments, בצורה { [id]: { published, results } }.
//
// טורניר חדש בשנה הבאה = אובייקט חדש ב-TOURNAMENTS. הישן נשאר, וכך נשמרת
// ההיסטוריה של כל שנה.
//
// published=false הוא מצב טיוטה: רק חשבון בדיקה (player.ghost) ופאנל המנהל
// רואים את הטורניר. כך אפשר לבדוק הכל על האפליקציה האמיתית לפני שהבנות רואות.

const US = "הבינלאומי 2";
const POLICE = "משטרת ישראל ת״א";
const CLALIT = "כללית חיפה";
const SHAMIR = "שמיר (אסף הרופא)";

// דרג 5, בית א — מלוח המשחקים הרשמי של הספורטיאדה 2026
const SPORTIADA_2026 = {
  id: "sportiada-2026",
  name: "הספורטיאדה",
  short: "ספורטיאדה",   // אחרי אות יחס: "ימים לספורטיאדה", לא "להספורטיאדה"
  city: "אילת",
  year: 2026,
  division: "דרג 5",
  group: "בית א",
  start: "2026-10-14",
  end: "2026-10-16",
  showFrom: "2026-09-27",   // הספירה לאחור מופיעה מהיום
  showUntil: "2026-11-15",  // חודש אחרי — כדי שאפשר יהיה לחזור לתוצאות
  us: US,
  teams: [US, POLICE, CLALIT, SHAMIR],
  points: { win: 2, loss: 1 },
  games: [
    { id: "g1", date: "2026-10-14", time: "14:00", hall: "בגין 1", a: US, b: CLALIT, stage: "group" },
    { id: "g2", date: "2026-10-15", time: "09:00", hall: "בגין 3", a: US, b: SHAMIR, stage: "group" },
    { id: "g3", date: "2026-10-15", time: "16:00", hall: "בגין 3", a: POLICE, b: US, stage: "group" },
    // משחקי הבית שלא שיחקנו בהם — נחוצים לחישוב הטבלה
    { id: "o1", date: "2026-10-14", time: "13:00", hall: "בגין 1", a: POLICE, b: SHAMIR, stage: "group" },
    { id: "o2", date: "2026-10-15", time: "08:00", hall: "בגין 3", a: POLICE, b: CLALIT, stage: "group" },
    { id: "o3", date: "2026-10-15", time: "17:00", hall: "בגין 3", a: CLALIT, b: SHAMIR, stage: "group" },
    // שישי — היריבה והאולם נקבעים לפי המקום שלנו בבית
    { id: "sf", date: "2026-10-16", time: "08:00", a: US, stage: "semi" },
    { id: "fn", date: "2026-10-16", time: "11:00", a: US, stage: "final" },
  ],
  // לאן ממשיכים לפי המקום בבית. מקומות 3–4 מסיימים ביום חמישי.
  ko: {
    1: { bracket: "עליון", semiHall: "מצפה ים", semiOpp: "מקום 1 בבית ג", finalHall: "בגין 2" },
    2: { bracket: "תחתון", semiHall: "רבין 1", semiOpp: "מקום 2 בבית ג", finalHall: "בגין 1" },
  },
};

const TOURNAMENTS = [SPORTIADA_2026];

// ── תאריכים (מקומיים, לא UTC — בערב toISOString קופץ ליום הבא) ────────────
function isoLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysBetween(fromIso, toIso) {
  const a = new Date(fromIso + "T00:00:00"), b = new Date(toIso + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

// הטורניר שבחלון התצוגה שלו נמצאים היום, או null
function activeTournament(now = new Date()) {
  const t = isoLocal(now);
  return TOURNAMENTS.find((x) => t >= x.showFrom && t <= x.showUntil) || null;
}

// "before" | "during" | "after"
function tournamentPhase(t, now = new Date()) {
  const d = isoLocal(now);
  if (d < t.start) return "before";
  if (d <= t.end) return "during";
  return "after";
}
const daysToStart = (t, now = new Date()) => Math.max(0, daysBetween(isoLocal(now), t.start));

// מי רואה: אחרי פרסום — כולן. בטיוטה — רק חשבון בדיקה.
function canSeeTournament(state, player) {
  return !!(state && state.published) || !!(player && player.ghost);
}

// ── תוצאות וטבלה ────────────────────────────────────────────────────────────
// תוצאה = ניקוד סופי בלבד: { a, b } לפי סדר הקבוצות בהגדרת המשחק.
function resultOf(results, game) {
  const r = results && results[game.id];
  if (!r || r.a === "" || r.b === "" || r.a == null || r.b == null) return null;
  const a = Number(r.a), b = Number(r.b);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  return { a, b, winner: a > b ? game.a : game.b, opp: r.opp || "" };
}

function standings(t, results) {
  const rows = Object.fromEntries(t.teams.map((name) => [name, {
    name, played: 0, won: 0, lost: 0, scored: 0, conceded: 0, points: 0,
  }]));
  const h2h = {};
  for (const g of t.games) {
    if (g.stage !== "group") continue;
    const r = resultOf(results, g);
    if (!r) continue;
    const A = rows[g.a], B = rows[g.b];
    if (!A || !B) continue;
    A.played++; B.played++;
    A.scored += r.a; A.conceded += r.b; B.scored += r.b; B.conceded += r.a;
    const [W, L] = r.winner === g.a ? [A, B] : [B, A];
    W.won++; L.lost++;
    W.points += t.points.win; L.points += t.points.loss;
    h2h[`${W.name}>${L.name}`] = true;
  }
  // נקודות, ואז מפגש ישיר בין שתי קבוצות בשוויון, ואז הפרש, ואז זכות
  return Object.values(rows).sort((x, y) =>
    y.points - x.points
    || (h2h[`${x.name}>${y.name}`] ? -1 : h2h[`${y.name}>${x.name}`] ? 1 : 0)
    || (y.scored - y.conceded) - (x.scored - x.conceded)
    || y.scored - x.scored
    || x.name.localeCompare(y.name, "he"));
}

const groupDone = (t, results) =>
  t.games.filter((g) => g.stage === "group").every((g) => resultOf(results, g));

function ourPlace(t, results) {
  const rows = standings(t, results);
  if (!rows.some((r) => r.played > 0)) return null;
  return rows.findIndex((r) => r.name === t.us) + 1;
}

// תיאור משחק לתצוגה — כולל חצי הגמר והגמר, שהיריבה והאולם שלהם תלויים במקום
function describeGame(t, results, g) {
  if (g.stage === "group") {
    const opp = g.a === t.us ? g.b : g.a;
    return { title: `מול ${opp}`, sub: "שלב הבתים", hall: g.hall, opp };
  }
  const r = results && results[g.id];
  const label = g.stage === "semi" ? "חצי גמר" : "גמר";
  // שני מצבים שבהם אין מה לדווח: out — לא עלינו לשלב הזה, locked — עוד לא
  // ידוע אם נעלה. בשניהם המשחק אינו "שלנו", והמנהלת לא מתבקשת להזין בו.
  if (groupDone(t, results)) {
    const p = ourPlace(t, results);
    const k = t.ko[p];
    if (!k) return { title: label, sub: "מקומות 3–4 מסיימים ביום חמישי", hall: "—", out: true };
    if (g.stage === "final") {
      const sfr = ourScore(t, results, t.games.find((x) => x.stage === "semi"));
      if (sfr && !sfr.won) return { title: `גמר ${k.bracket}`, sub: "הפסדנו בחצי הגמר", hall: "—", out: true };
      if (!sfr) return { title: `גמר ${k.bracket}`, sub: "אם ננצח בחצי הגמר", hall: k.finalHall, locked: true };
    }
    const opp = (r && r.opp) || (g.stage === "semi" ? k.semiOpp : "המנצחת מחצי הגמר השני");
    return {
      title: `${label} ${k.bracket}`,
      sub: `מול ${opp}`,
      hall: g.stage === "semi" ? k.semiHall : k.finalHall,
      opp,
    };
  }
  const ours = t.games.filter((x) => x.stage === "group" && (x.a === t.us || x.b === t.us));
  const waiting = t.games.find((x) => x.stage === "group" && !resultOf(results, x));
  if (ours.every((x) => resultOf(results, x)) && waiting)
    return { title: label, sub: `ייקבע אחרי ${waiting.a}–${waiting.b} · ${waiting.time}`, hall: "לפי המקום", locked: true };
  return {
    title: label,
    sub: g.stage === "semi" ? "אם נעלה: מקום 1 → מצפה ים · מקום 2 → רבין 1" : "אם נעלה: עליון בבגין 2 · תחתון בבגין 1",
    hall: "לפי המקום",
    locked: true,
  };
}

// הניקוד מנקודת המבט שלנו: { us, them, won } או null
function ourScore(t, results, g) {
  const r = resultOf(results, g);
  if (!r) return null;
  const weAreA = g.a === t.us;
  return { us: weAreA ? r.a : r.b, them: weAreA ? r.b : r.a, won: r.winner === t.us };
}

const ourGames = (t) => t.games.filter((g) => g.a === t.us || g.b === t.us);

// המשחק הבא שלנו שעוד אין לו תוצאה — מדלג על שלב שלא עלינו אליו
function nextOurGame(t, results) {
  return ourGames(t).find((g) => !resultOf(results, g) && !describeGame(t, results, g).out) || null;
}

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
function dayLabel(iso) {
  const d = new Date(iso + "T12:00:00");
  return `יום ${DAY_NAMES[d.getDay()]} · ${d.getDate()}.${d.getMonth() + 1}`;
}

export {
  TOURNAMENTS, activeTournament, tournamentPhase, daysToStart, canSeeTournament,
  resultOf, standings, groupDone, ourPlace, describeGame, ourScore, ourGames, nextOurGame,
  dayLabel, isoLocal,
};
