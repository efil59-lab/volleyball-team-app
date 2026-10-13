// קבוצת הדגמה לצילומי הפרומו (scripts/make-promo.mjs). כל השמות והנתונים כאן
// מומצאים — אין כאן שום דבר מקבוצה אמיתית. העמוד נטען רק משרת הפיתוח
// (/scripts/promo/demo.html?team=promo-demo&shot=...), ואינו חלק מהבנייה.
import { createRoot } from "react-dom/client";
import "@fontsource-variable/heebo";
import "../../src/styles/tokens.css";
import "../../src/styles/index.css";
import { HomeScreen } from "../../src/screens/home";
import { PlayerScreen } from "../../src/screens/player";
import { AdminPanel } from "../../src/screens/admin";

const pc = "#1a237e", sc = "#f5c842";
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

const names = ["נועה", "מיכל", "שירה", "יעל", "תמר", "רוני", "ליאת", "דנה", "אורית", "הילה", "גלית", "סיגל", "קרן"];
const players = names.map((name, i) => ({ id: i + 1, name }));
const me = players[0];
const playerProfiles = Object.fromEntries(players.map((p) => [p.id, { setupDone: true }]));
const settings = { teamName: "כדורשת הפרפרים", primaryColor: pc, secondaryColor: sc, defaultTrainingLocation: "אולם הספורט העירוני", hidePromoBanner: true, onboardingDone: true };
// הפרומו מציג את האפליקציה עצמה: בלי באנר לאפליקציה אחרת, ותמיד במצב יום
document.documentElement.dataset.theme = "light";
document.head.appendChild(Object.assign(document.createElement("style"), { textContent: ".kb{display:none!important}" }));

const events = [
  // האימון של אתמול — מחכה לארכוב (המסך שממנו לוחצים "ארכוב האירוע")
  { id: 100, type: "training", date: day(-1), time: "20:00", location: "אולם הספורט העירוני", open: true },
  { id: 101, type: "training", date: day(1), time: "20:00", location: "אולם הספורט העירוני", open: true },
  { id: 102, type: "game", opponent: "הנמרות", date: day(5), time: "19:30", location: "היכל הספורט", open: true },
  { id: 103, type: "training", date: day(8), time: "20:00", location: "אולם הספורט העירוני", open: true },
  { id: 104, type: "training", date: day(15), time: "20:00", location: "אולם הספורט העירוני", open: true },
];
// לאימון של מחר: 8 מגיעות, 2 לא, 3 טרם ענו. "אני" עוד לא עניתי — כדי שיראו את הכפתורים.
const attendance = {};
const mark = (evId, ids, status, notes = {}) => ids.forEach((id) => { attendance[`${evId}_${id}`] = { status, note: notes[id] || "", time: new Date().toISOString() }; });
mark(101, [2, 3, 4, 5, 6, 7, 8, 9], "coming", { 4: "מאחרת ב-10 דקות" });
mark(101, [10, 11], "notcoming", { 10: "בחו״ל" });
mark(100, [1, 2, 3, 5, 6, 8, 9, 12, 13], "coming");
mark(100, [4, 10], "notcoming");

// ארכיון — מזין את הסטטיסטיקה ואת לוח השנה
const MISSES = [0, 0, 1, 0, 2, 1, 0, 3, 1, 2, 0, 1, 3];
const past = [-34, -27, -20, -13, -6].map((n, i) => ({
  id: 50 + i, type: i === 2 ? "game" : "training", opponent: i === 2 ? "הלביאות" : "", date: day(n), time: "20:00",
  location: "אולם הספורט העירוני", verified: true, archivedAt: new Date().toISOString(),
  ...(i === 2 ? { outcome: "win", result: "2–1" } : {}),
  // כמה אירועים כל אחת החסירה (מתוך 5) — כדי שהדירוג ייראה כמו קבוצה אמיתית. אותה נוסחה ב-promo.html (גיליון האקסל).
  attendanceData: players.map((p) => ({ playerId: p.id, status: (i + p.id) % 5 < MISSES[p.id - 1] ? "notcoming" : "coming" })),
}));

const noop = () => {};
const upd = new Proxy({}, { get: () => async () => {} });
const common = {
  players, events, attendance, settings, notifications: [], playerProfiles, tournaments: {},
  upd, pc, sc, notify: noop,
};

const q = new URLSearchParams(location.search);
const shot = q.get("shot") || "home";
if (shot !== "home") { try { sessionStorage.setItem("openTab", shot === "calendar" ? "calendar" : "event"); } catch {} }
localStorage.setItem("rememberPlayer_" + me.id, "1");

createRoot(document.getElementById("root")).render(
  shot === "admin"
    ? <AdminPanel {...common} archive={past} games={[]} gallery={[]} applause={[]} polls={[]} personalNotifs={[]} chat={[]}
        askConfirm={noop} onBack={noop} onLogout={noop} teamMeta={{ status: "active", plan: "paid" }} />
    : shot === "home"
    ? <HomeScreen {...common} onSelectPlayer={noop} onAdmin={noop} onAbout={noop} onPurchase={noop} />
    : <PlayerScreen {...common} player={me} games={[]} gallery={[]} applause={[]} polls={[]} personalNotifs={[]}
        archive={past} chat={[]} askConfirm={noop} onBack={noop} onLogout={noop} addChatLocal={noop} />
);
