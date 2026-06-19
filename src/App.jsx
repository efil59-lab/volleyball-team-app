import { useState, useEffect, useRef } from "react";
import { db, storage, auth } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";

// ── זהות קבוצה ────────────────────────────────────────────────────────────────
// בינלאומי = ברירת המחדל (שחקניות קיימות לא מושפעות). קבוצה אחרת מגיעה דרך ?team=XXXX.
const DEFAULT_TEAM = "bibleumi";
const BIBLEUMI_ADMIN_EMAILS = ["efil59@gmail.com", "miri.levi1962@gmail.com"]; // מנהלי קבוצת הבינלאומי
const SUPER_ADMIN_EMAIL = "efil59@gmail.com"; // בעל המוצר — גישה לסופר אדמין (רק הוא)

function resolveInitialTeam() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("team");
    if (fromUrl) { localStorage.setItem("currentTeamId", fromUrl); return fromUrl; }
    const stored = localStorage.getItem("currentTeamId");
    if (stored) return stored;
  } catch {}
  return DEFAULT_TEAM;
}
let CURRENT_TEAM = resolveInitialTeam();
function setCurrentTeam(id) {
  CURRENT_TEAM = id;
  try { localStorage.setItem("currentTeamId", id); } catch {}
}

const googleProvider = new GoogleAuthProvider();

const KEYS = {
  players: "players",
  events: "events",
  attendance: "attendance",
  notifications: "notifications",
  settings: "settings",
  archive: "archive",
  games: "games",
  gallery: "gallery",
  playerProfiles: "profiles",
  installVersion: "installVersion",
  applause: "applause",
  polls: "polls",
  personalNotifs: "personalNotifs",
  whatsNewVersion: "whatsNewVersion",
  meta: "meta",
};

const DEFAULT_SETTINGS = {
  teamName: "קבוצת הכדורשת של הבנק הבינלאומי",
  primaryColor: "#1a237e",
  secondaryColor: "#f5c842",
  defaultTrainingLocation: "אולם ספורט הבנק הבינלאומי",
  defaultGameLocation: "אולם ספורט עירוני",
  whatsappGroup: "https://chat.whatsapp.com/BQFmLoO8PU4A3kdXSkIJ6U?s=hd&p=i&mlu=3",
  captainPassword: "1234",
};

// "מה חדש" — מתעדכן עם כל גרסה. version עולה ב-1 בכל שחרור פיצ'רים.
const WHATS_NEW = {
  version: 12,
  versionName: "גרסה 12.0",
  date: "יוני 2026",
  features: [
    { icon: "❌", title: "הודעת ביטול בולטת", text: "כשאימון או משחק מבוטל, ההודעה תופיע באדום בראש המסך וקודמת לכל ההודעות האחרות — שלא תפספסי. היא נעלמת אוטומטית בסוף יום האירוע." },
  ],
};

const DEFAULT_PLAYERS = [
  { id: 1, name: "מירי", phone: "", email: "", address: "", whatsapp: "" },
  { id: 2, name: "ויקי", phone: "", email: "", address: "", whatsapp: "" },
  { id: 3, name: "איילה", phone: "", email: "", address: "", whatsapp: "" },
  { id: 4, name: "דנה", phone: "", email: "", address: "", whatsapp: "" },
  { id: 5, name: "מיכל", phone: "", email: "", address: "", whatsapp: "" },
  { id: 6, name: "נטלי", phone: "", email: "", address: "", whatsapp: "" },
  { id: 7, name: "נטע", phone: "", email: "", address: "", whatsapp: "" },
  { id: 8, name: "סיגי", phone: "", email: "", address: "", whatsapp: "" },
  { id: 9, name: "רונית", phone: "", email: "", address: "", whatsapp: "" },
  { id: 10, name: "ציפי", phone: "", email: "", address: "", whatsapp: "" },
  { id: 11, name: "שרונה", phone: "", email: "", address: "", whatsapp: "" },
  { id: 12, name: "קרן", phone: "", email: "", address: "", whatsapp: "" },
  { id: 13, name: "עדית", phone: "", email: "", address: "", whatsapp: "" },
];

const DEFAULT_EVENTS = [
  { id: 1, type: "training", date: "2026-05-13", time: "19:00", location: "אולם ספורט הבנק הבינלאומי", note: "", open: true },
];

const DEFAULT_GAMES = [
  { id: 1, date: "2026-05-20", time: "18:00", opponent: "מכבי תל אביב", location: "אולם עירוני", result: null },
  { id: 2, date: "2026-06-03", time: "19:00", opponent: "הפועל ירושלים", location: "אולם ספורט הבנק הבינלאומי", result: null },
];

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
  return events.filter(e => e.date >= today && e.open).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
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
  return new Date().toISOString().split("T")[0];
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
async function load(key, fallback) {
  try {
    const ref = doc(db, "teams", CURRENT_TEAM, "data", key);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data().value : fallback;
  } catch { return fallback; }
}
async function save(key, val) {
  try {
    const ref = doc(db, "teams", CURRENT_TEAM, "data", key);
    await setDoc(ref, { value: val });
  } catch (e) { console.error("Save error:", e); }
}

// ── עזרי הזדהות ובעלות (לא תלויים ב-CURRENT_TEAM — נתיב מפורש) ────────────────
// מיפוי משתמש→קבוצה, מחוץ למרחב הקבוצה.
async function loadUserTeam(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null; // { teamId, email }
  } catch { return null; }
}
async function saveUserTeam(uid, data) {
  try { await setDoc(doc(db, "users", uid), data); } catch (e) { console.error("saveUserTeam:", e); }
}
async function loadTeamKey(teamId, key, fallback) {
  try {
    const snap = await getDoc(doc(db, "teams", teamId, "data", key));
    return snap.exists() ? snap.data().value : fallback;
  } catch { return fallback; }
}
async function saveTeamKey(teamId, key, val) {
  try { await setDoc(doc(db, "teams", teamId, "data", key), { value: val }); } catch (e) { console.error("saveTeamKey:", e); }
}
// מוסיף מנהל לקבוצה. אם אין עדיין בעלים — המתחבר הופך לבעלים (אימוץ).
// אם כבר יש בעלים — מוסיף את ה-uid ל-adminUids (מנהל נוסף לאותה קבוצה).
async function addTeamAdmin(teamId, uid, email) {
  const existing = await loadTeamKey(teamId, KEYS.meta, null);
  if (!existing || !existing.ownerUid) {
    await saveTeamKey(teamId, KEYS.meta, { ownerUid: uid, ownerEmail: email, adminUids: [uid] });
  } else if (!(existing.adminUids || []).includes(uid)) {
    await saveTeamKey(teamId, KEYS.meta, { ...existing, adminUids: [...(existing.adminUids || []), uid] });
  }
}
// קבוצה חדשה לגמרי (גוגל לא מוכר) — מאתחלים ריקה כדי לא להציג שחקניות לדוגמה.
async function seedNewTeam(teamId) {
  const existing = await loadTeamKey(teamId, KEYS.players, null);
  if (existing === null) {
    await saveTeamKey(teamId, KEYS.players, []);
    await saveTeamKey(teamId, KEYS.settings, { ...DEFAULT_SETTINGS, teamName: "הקבוצה שלי" });
  }
}
// מזהה את הקבוצה של המנהל המחובר, ואם צריך — יוצר/מאמץ. מחזיר teamId.
async function resolveAdminTeam(user) {
  const uid = user.uid;
  const email = (user.email || "").toLowerCase();
  const mapping = await loadUserTeam(uid);
  if (mapping && mapping.teamId) return mapping.teamId;
  if (BIBLEUMI_ADMIN_EMAILS.includes(email)) {
    await saveUserTeam(uid, { teamId: DEFAULT_TEAM, email });
    await addTeamAdmin(DEFAULT_TEAM, uid, email);
    return DEFAULT_TEAM;
  }
  const teamId = "team_" + uid;
  await saveUserTeam(uid, { teamId, email });
  await addTeamAdmin(teamId, uid, email);
  await seedNewTeam(teamId);
  return teamId;
}

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────────
function Confirm({ msg, onOk, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 20, padding: 28, maxWidth: 300, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontSize: 15, color: "#1e293b", fontWeight: 600, marginBottom: 22, lineHeight: 1.5 }}>{msg}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 12, background: "#f1f5f9", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, color: "#64748b" }}>ביטול</button>
          <button onClick={onOk} style={{ flex: 1, padding: 12, background: "#ef4444", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, color: "white" }}>אישור</button>
        </div>
      </div>
    </div>
  );
}

// ── ATTENDANCE MODAL ──────────────────────────────────────────────────────────
function AttModal({ title, list, players, attendance, eventId, onClose, pc, sc }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxHeight: "65vh", overflowY: "auto", boxSizing: "border-box" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: pc, marginBottom: 14 }}>{title} ({list.length})</div>
        {list.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>אף אחת עדיין</p>}
        {list.map(p => {
          const prof = players.find(x => x.id === p.id) || p;
          const rec = attendance[`${eventId}_${p.id}`];
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              {prof.photo ? <img src={prof.photo} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 38, height: 38, borderRadius: "50%", background: pc, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{p.name[0]}</div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                {rec?.note && <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>"{rec.note}"</div>}
              </div>
            </div>
          );
        })}
        <button onClick={onClose} style={{ width: "100%", marginTop: 16, padding: 12, background: "#f1f5f9", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, color: "#64748b" }}>סגור</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("splash");
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [archive, setArchive] = useState([]);
  const [games, setGames] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [playerProfiles, setPlayerProfiles] = useState({});
  const [applause, setApplause] = useState([]);
  const [polls, setPolls] = useState([]);
  const [personalNotifs, setPersonalNotifs] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [googleLoginError, setGoogleLoginError] = useState("");
  const [authUser, setAuthUser] = useState(null);

  // ── שלב מעבר לאבטחה: bootstrap של Auth מתבצע באפקט המאוחד למטה ────────────────
  // קודם פותרים redirect של Google, ורק אם אין משתמש כלל — מתחברים אנונימית.
  // איחוד הרצף מונע מצב שבו ההתחברות האנונימית "דורסת" את תוצאת ה-redirect.

  // טוען את כל נתוני הקבוצה הנוכחית (CURRENT_TEAM). ניתן לקריאה חוזרת אחרי החלפת קבוצה.
  async function loadTeamData() {
    const [p, e, a, n, s, ar, g, gal, pp] = await Promise.all([
      load(KEYS.players, DEFAULT_PLAYERS),
      load(KEYS.events, DEFAULT_EVENTS),
      load(KEYS.attendance, {}),
      load(KEYS.notifications, []),
      load(KEYS.settings, DEFAULT_SETTINGS),
      load(KEYS.archive, []),
      load(KEYS.games, DEFAULT_GAMES),
      load(KEYS.gallery, []),
      load(KEYS.playerProfiles, {}),
    ]);
    setPlayers(p); setEvents(e); setAttendance(a); setNotifications(n);
    setSettings({ ...DEFAULT_SETTINGS, ...s });
    setArchive(ar); setGames(g); setGallery(gal); setPlayerProfiles(pp);
    const [ap, pl, pn] = await Promise.all([
      load(KEYS.applause, []),
      load(KEYS.polls, []),
      load(KEYS.personalNotifs, {}),
    ]);
    setApplause(ap); setPolls(pl); setPersonalNotifs(pn);
  }

  // משקיף בלבד על מצב ההזדהות (לא מתחבר — כך אין מרוץ עם ה-redirect). משמש לאבחון ולכפתור "המשך".
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      const wasPending = sessionStorage.getItem("pendingGoogleLogin") === "1";
      sessionStorage.removeItem("pendingGoogleLogin");
      let adminUser = null;

      // 1) קודם כל — לפתור redirect של Google אם יש (לפני כל פעולת auth אחרת!)
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) adminUser = result.user;
      } catch (e) {
        console.error("Redirect login error:", e);
        setGoogleLoginError(e.code || e.message || "שגיאה לא ידועה");
        await loadTeamData();
        setScreen("admin-login");
        return;
      }

      // גיבוי: אם getRedirectResult ריק אבל הסשן נשמר — נשתמש במשתמש המחובר.
      if (!adminUser && auth.currentUser && !auth.currentUser.isAnonymous) {
        adminUser = auth.currentUser;
      }

      // 2) אם אין משתמש כלל — התחברות אנונימית (טוקן בסיס לשחקניות)
      if (!auth.currentUser) {
        try { await signInAnonymously(auth); } catch (e) { console.error("Anon auth error:", e); }
      }

      // 3) אם זוהה מנהל — לזהות/לאמץ קבוצה ולעבור לפאנל
      if (adminUser) {
        const teamId = await resolveAdminTeam(adminUser);
        setCurrentTeam(teamId);
        await loadTeamData();
        setScreen("admin");
        return;
      }

      // אם ניסה להתחבר ולא הצליח — נחזיר אותו למסך הכניסה (לראות סטטוס ולנסות "המשך")
      if (wasPending) {
        await loadTeamData();
        setScreen("admin-login");
        return;
      }

      // 4) זרימה רגילה
      await loadTeamData();
      const installVer = await load(KEYS.installVersion, 1);
      const seenVer = parseInt(localStorage.getItem("installSeenVer") || "0");
      const seenWhatsNew = parseInt(localStorage.getItem("whatsNewSeenVer") || "0");
      setTimeout(() => {
        if (seenVer < installVer) setShowInstall(true);
        else if (seenWhatsNew < WHATS_NEW.version) setShowWhatsNew(true);
        else setScreen(s => s === "splash" ? "home" : s);
      }, 2500);
    })();
  }, []);

  // התחברות מנהל עם Google.
  // אנדרואיד/מחשב: popup (אמין, לא תלוי אחסון בין-דומייני), עם נפילה ל-redirect אם נחסם.
  // אייפון/iPadOS: redirect ישיר — שם ה-popup לא אמין (ITP מאבד את התוצאה בדרך חזרה).
  async function handleGoogleLogin() {
    setGoogleLoginError("");
    if (isIOS()) {
      try {
        sessionStorage.setItem("pendingGoogleLogin", "1");
        await signInWithRedirect(auth, googleProvider);
        return { ok: true };
      } catch (e) {
        console.error("iOS Google redirect error:", e);
        sessionStorage.removeItem("pendingGoogleLogin");
        return { ok: false, error: e.code || e.message };
      }
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const teamId = await resolveAdminTeam(result.user);
      setCurrentTeam(teamId);
      await loadTeamData();
      setScreen("admin");
      return { ok: true };
    } catch (e) {
      console.error("Google popup error:", e);
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
        return { ok: false, error: "" }; // המשתמש סגר — לא שגיאה אמיתית
      }
      // popup נחסם או לא נתמך → ננסה redirect
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
        try {
          sessionStorage.setItem("pendingGoogleLogin", "1");
          await signInWithRedirect(auth, googleProvider);
          return { ok: true };
        } catch (e2) {
          console.error("Google redirect error:", e2);
          return { ok: false, error: e2.code || e2.message };
        }
      }
      return { ok: false, error: e.code || e.message };
    }
  }

  // מסלול חלופי: אם כבר מחובר עם Google (הסשן נשמר) — להיכנס בלי redirect נוסף.
  async function continueAsAdmin() {
    if (!auth.currentUser || auth.currentUser.isAnonymous) return { ok: false, error: "אין משתמש Google מחובר" };
    const teamId = await resolveAdminTeam(auth.currentUser);
    setCurrentTeam(teamId);
    await loadTeamData();
    setScreen("admin");
    return { ok: true };
  }

  // כניסה לסופר אדמין (לחיצה ארוכה על הלוגו). רק בעל המוצר. אם מחובר כבר — נכנס; אחרת Google.
  async function enterSuperAdmin() {
    const cur = (auth.currentUser?.email || "").toLowerCase();
    if (cur === SUPER_ADMIN_EMAIL) { setScreen("superAdmin"); return; }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if ((result.user.email || "").toLowerCase() === SUPER_ADMIN_EMAIL) setScreen("superAdmin");
      else setScreen("superAdmin"); // נכנס למסך — שם יוצג "אין הרשאה" אם לא הבעלים
    } catch (e) { console.error("super admin login:", e); }
  }


  const upd = {
    players: async v => { setPlayers(v); await save(KEYS.players, v); },
    events: async v => { setEvents(v); await save(KEYS.events, v); },
    attendance: async v => { setAttendance(v); await save(KEYS.attendance, v); },
    notifications: async v => { setNotifications(v); await save(KEYS.notifications, v); },
    settings: async v => { setSettings(v); await save(KEYS.settings, v); },
    archive: async v => { setArchive(v); await save(KEYS.archive, v); },
    games: async v => { setGames(v); await save(KEYS.games, v); },
    gallery: async v => { setGallery(v); await save(KEYS.gallery, v); },
    playerProfiles: async v => { setPlayerProfiles(v); await save(KEYS.playerProfiles, v); },
    applause: async v => { setApplause(v); await save(KEYS.applause, v); },
    polls: async v => { setPolls(v); await save(KEYS.polls, v); },
    personalNotifs: async v => { setPersonalNotifs(v); await save(KEYS.personalNotifs, v); },
    installVersion: async v => { setSettings(s => ({ ...s, installVersion: v })); await save(KEYS.installVersion, v); },
  };

  function askConfirm(msg, onOk) { setConfirm({ msg, onOk }); }

  const pc = settings.primaryColor || "#1a237e";
  const sc = settings.secondaryColor || "#f5c842";
  const common = { players, events, attendance, notifications, settings, archive, games, gallery, playerProfiles, applause, polls, personalNotifs, upd, pc, sc, askConfirm };

  if (screen === "splash" && !showInstall && !showWhatsNew) return <Splash pc={pc} sc={sc} />;
  if (screen === "superAdmin") return <SuperAdminScreen pc={pc} sc={sc} authUser={authUser} onGoogle={handleGoogleLogin} onBack={() => setScreen("home")} />;
  if (showInstall) return <InstallScreen pc={pc} sc={sc} installVersion={settings.installVersion||1} onDone={(ver) => {
    localStorage.setItem("installSeenVer", String(ver));
    setShowInstall(false);
    const seenWhatsNew = parseInt(localStorage.getItem("whatsNewSeenVer") || "0");
    if (seenWhatsNew < WHATS_NEW.version) setShowWhatsNew(true); else setScreen("home");
  }} />;
  if (showWhatsNew) return <WhatsNewScreen pc={pc} sc={sc} onDone={() => {
    localStorage.setItem("whatsNewSeenVer", String(WHATS_NEW.version));
    setShowWhatsNew(false); setScreen("home");
  }} />;

  return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, sans-serif", minHeight: "100vh", background: "#f1f5f9" }}>
      <style>{`
        @keyframes screenFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .screen-fade { animation: screenFade 0.28s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .screen-fade { animation: none !important; }
          .collapse-grid { transition: none !important; }
        }
      `}</style>
      {confirm && <Confirm msg={confirm.msg} onOk={() => { confirm.onOk(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}

      <div key={screen} className="screen-fade">
        {screen === "home" && <HomeScreen {...common} onSelectPlayer={p => {
          setCurrentPlayer(p);
          const remembered = localStorage.getItem("rememberPlayer_" + p.id) === "1";
          if (remembered && playerProfiles[p.id]?.setupDone) setScreen("player");
          else setScreen("onboard");
        }} onAdmin={() => setScreen("admin-login")} onHelp={() => setScreen("help")} onSuperAdmin={enterSuperAdmin} />}
        {screen === "onboard" && <OnboardScreen {...common} player={currentPlayer} onDone={() => setScreen("player")} onBack={() => setScreen("home")} />}
        {screen === "player" && <PlayerScreen {...common} player={currentPlayer} onBack={() => setScreen("home")} />}
        {screen === "admin-login" && <AdminLogin pc={pc} sc={sc} onGoogle={handleGoogleLogin} onContinue={continueAsAdmin} authUser={authUser} initialError={googleLoginError} onBack={() => { setGoogleLoginError(""); setScreen("home"); }} />}
        {screen === "admin" && <AdminPanel {...common} onBack={() => setScreen("home")} />}
        {screen === "help" && <HelpScreen pc={pc} sc={sc} settings={settings} onBack={() => setScreen("home")} />}
      </div>
    </div>
  );
}

// ── INSTALL SCREEN ───────────────────────────────────────────────────────────
function InstallScreen({ pc, sc, onDone, installVersion }) {
  return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, sans-serif", minHeight: "100vh", background: pc, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28 }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>📲</div>
      <h2 style={{ color: "white", fontSize: 22, fontWeight: 800, margin: "0 0 10px", textAlign: "center" }}>התקיני את האפליקציה!</h2>
      <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, textAlign: "center", lineHeight: 1.7, margin: "0 0 32px" }}>
        כדי לפתוח את האפליקציה מהר יותר ישירות מהמסך הבית:
      </p>
      <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 16, padding: "18px 22px", width: "100%", maxWidth: 320, marginBottom: 28 }}>
        <div style={{ color: "white", fontSize: 14, lineHeight: 2 }}>
          <div>📱 <strong>אנדרואיד (Chrome):</strong></div>
          <div style={{ paddingRight: 22, color: "rgba(255,255,255,0.85)" }}>תפריט ⋮ ← הוסף למסך הבית</div>
          <div style={{ marginTop: 10 }}>🍎 <strong>אייפון (Safari):</strong></div>
          <div style={{ paddingRight: 22, color: "rgba(255,255,255,0.85)" }}>כפתור שיתוף ↑ ← הוסף למסך הבית</div>
        </div>
      </div>
      <button onClick={() => onDone(installVersion)} style={{ background: sc, color: pc, border: "none", borderRadius: 14, padding: "14px 40px", fontSize: 16, fontWeight: 800, cursor: "pointer", marginBottom: 14, width: "100%", maxWidth: 320 }}>
        הבנתי! נמשיך 🏐
      </button>
      <button onClick={() => onDone(installVersion)} style={{ background: "transparent", color: "rgba(255,255,255,0.7)", border: "none", fontSize: 13, cursor: "pointer", padding: 8 }}>
        דלג
      </button>
    </div>
  );
}

// ── WHAT'S NEW SCREEN ─────────────────────────────────────────────────────────
function WhatsNewScreen({ pc, sc, onDone }) {
  return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, sans-serif", minHeight: "100vh", background: `linear-gradient(170deg, ${pc}, ${pc}dd)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 24, padding: "30px 24px", maxWidth: 360, width: "100%", boxShadow: "0 24px 70px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 56 }}>✨</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: pc, margin: "6px 0 2px" }}>מה חדש?</h2>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${sc}40`, borderRadius: 20, padding: "4px 14px", marginTop: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: pc }}>{WHATS_NEW.versionName}</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>• {WHATS_NEW.date}</span>
          </div>
        </div>

        {WHATS_NEW.features.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 0", borderBottom: i < WHATS_NEW.features.length - 1 ? "1px solid #f1f5f9" : "none" }}>
            <div style={{ fontSize: 30, flexShrink: 0 }}>{f.icon}</div>
            <div>
              <div style={{ fontWeight: 800, color: "#1e293b", fontSize: 15, marginBottom: 2 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{f.text}</div>
            </div>
          </div>
        ))}

        <button onClick={onDone} style={{ width: "100%", marginTop: 22, padding: 15, background: pc, color: "white", border: "none", borderRadius: 14, cursor: "pointer", fontSize: 16, fontWeight: 800 }}>
          מגניב! בואו נתחיל 🏐
        </button>
      </div>
    </div>
  );
}

// ── SPLASH ────────────────────────────────────────────────────────────────────
function Splash({ pc, sc }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: pc }}>
      <div style={{ fontSize: 80, animation: "bounce 0.6s ease", userSelect: "none" }}>🏐</div>
      <div style={{ width: 60, height: 4, background: sc, borderRadius: 2, marginTop: 28 }} />
    </div>
  );
}

// ── SUPER ADMIN ──────────────────────────────────────────────────────────────
// כניסה דרך לחיצה ארוכה על הלוגו במסך הבית. הרשאה: רק בעל המוצר (Google), לעתיד הרב-קבוצתי.
function SuperAdminScreen({ pc, sc, authUser, onGoogle, onBack }) {
  const [gErr, setGErr] = useState("");
  const isOwner = authUser && (authUser.email || "").toLowerCase() === SUPER_ADMIN_EMAIL;

  async function login() {
    setGErr("");
    const res = await onGoogle();
    if (!res.ok && res.error) setGErr("ההתחברות נכשלה: " + res.error);
  }

  if (!isOwner) {
    return (
      <div style={{ direction: "rtl", minHeight: "100vh", background: pc, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ fontSize: 60, marginBottom: 12 }}>👑</div>
        <h2 style={{ color: "white", fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>סופר אדמין</h2>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, margin: "0 0 24px", textAlign: "center" }}>אזור זה מיועד לבעל המוצר בלבד.</p>
        <div style={{ background: "white", borderRadius: 16, padding: 22, width: "100%", maxWidth: 340 }}>
          <button onClick={login} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "13px 16px", background: "white", color: "#3c4043", border: "1px solid #dadce0", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 600, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
            <span style={{ fontSize: 18 }}>🔵</span> התחבר עם Google
          </button>
          {gErr && <p style={{ color: "#ef4444", fontSize: 12, margin: "10px 0 0", textAlign: "center", wordBreak: "break-word" }}>{gErr}</p>}
          {authUser && !authUser.isAnonymous && <p style={{ color: "#94a3b8", fontSize: 12, margin: "10px 0 0", textAlign: "center" }}>מחובר כ-{authUser.email} — אין הרשאת סופר אדמין.</p>}
          <button onClick={onBack} style={{ width: "100%", padding: "10px", background: "transparent", color: "#64748b", border: "none", cursor: "pointer", fontSize: 13, marginTop: 8 }}>ביטול</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, sans-serif", minHeight: "100vh", background: "#f1f5f9" }}>
      <div style={{ background: pc, padding: "18px 16px 14px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← יציאה</button>
        <div style={{ fontSize: 32 }}>👑</div>
        <h2 style={{ color: "white", fontSize: 16, fontWeight: 700, margin: "4px 0 0" }}>סופר אדמין</h2>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "12px 16px", color: "#64748b", fontSize: 12 }}>מחובר כבעל המוצר: {authUser.email}</div>
        <a href="https://github.com/efil59-lab/volleyball-team-app/blob/main/ROADMAP.md" target="_blank" rel="noopener noreferrer"
          style={{ background: "white", borderRadius: 14, padding: "16px 18px", textDecoration: "none", color: pc, fontWeight: 700, fontSize: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🗺️</span> מפת הדרכים (ROADMAP)
        </a>
        <div style={{ background: "white", borderRadius: 14, padding: "16px 18px", color: "#94a3b8", fontWeight: 600, fontSize: 13, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>👥</span> תצוגת שימוש לכל הקבוצות
          <span style={{ marginRight: "auto", fontSize: 11, background: "#fef3c7", color: "#92400e", padding: "3px 8px", borderRadius: 8 }}>בקרוב</span>
        </div>
      </div>
    </div>
  );
}


// ── NOTIFICATIONS TICKER ──────────────────────────────────────────────────────
function NotifTicker({ notifs, pc, sc }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  // קדימות לביטול: אם יש הודעת ביטול פעילה — מציגים רק אותה/ן, בלי שאר ההודעות
  const cancels = notifs.filter(x => x.type === "cancel");
  const list = cancels.length > 0 ? cancels : notifs;

  useEffect(() => {
    setIdx(0);
    if (list.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % list.length);
        setVisible(true);
      }, 400);
    }, 3500);
    return () => clearInterval(timer);
  }, [list.length]);

  if (list.length === 0) return null;
  const n = list[idx] || list[0];
  const isCancel = n.type === "cancel";
  const isCoach = n.type === "coach";
  const bgColor = isCancel ? "#ef4444" : pc;
  const borderColor = isCancel ? "#ff6b6b" : sc;
  const displayText = isCoach ? `הודעה מהמאמן/ת: ${n.text}` : n.text;

  return (
    <div style={{ marginBottom: 12, overflow: "hidden" }}>
      <div style={{
        background: bgColor,
        borderRadius: 12,
        padding: "10px 14px",
        boxSizing: "border-box",
        maxWidth: "100%",
        boxShadow: `0 4px 16px rgba(0,0,0,0.15), inset -5px 0 0 0 ${borderColor}`,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        opacity: visible ? 1 : 0,
        transition: "all 0.4s ease",
        textAlign: "center",
      }}>
        <div style={{ height: list.length > 1 ? 58 : "auto", display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", overflowX: "hidden" }}>
          <div style={{ color: "white", fontWeight: isCancel ? 800 : 700, fontSize: 13, lineHeight: 1.4, overflowWrap: "break-word", wordBreak: "break-word", width: "100%" }}>{displayText}</div>
        </div>
        {list.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 10 }}>
            {list.map((_, i) => (
              <div key={i} style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 3, background: i === idx ? (isCancel ? "white" : sc) : "rgba(255,255,255,0.4)", transition: "all 0.3s" }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
function HomeScreen({ players, events, attendance, settings, notifications, playerProfiles, pc, sc, onSelectPlayer, onAdmin, onHelp, onSuperAdmin }) {
  const lpRef = useRef();
  const gridRef = useRef();
  const [forceRoster, setForceRoster] = useState(false);
  const activeNotifs = notifications.filter(n => n.active && !(n.type === "cancel" && n.expiresOn && n.expiresOn < todayStr()));
  const nextEvent = getNextEvent(events || []);
  // שחקנית שהמכשיר "זוכר" — אם קיימת, מציגים דשבורד אישי (מצב א'); אחרת רשימת בחירה (מצב ב')
  const me = !forceRoster ? players.find(p => localStorage.getItem("rememberPlayer_" + p.id) === "1" && (playerProfiles[p.id] || {}).setupDone) : null;

  // כותרת דקה משותפת לשני המצבים (כולל לחיצה ארוכה על הלוגו → סופר-אדמין)
  const header = (
    <div style={{ background: pc, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderRadius: "0 0 20px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1 }}>
        <span
          onPointerDown={() => { lpRef.current = setTimeout(() => { onSuperAdmin && onSuperAdmin(); }, 1000); }}
          onPointerUp={() => clearTimeout(lpRef.current)}
          onPointerLeave={() => clearTimeout(lpRef.current)}
          onContextMenu={(e) => e.preventDefault()}
          style={{ fontSize: 28, userSelect: "none", WebkitUserSelect: "none", flexShrink: 0 }}>🏐</span>
        <span style={{ color: "white", fontSize: 15, fontWeight: 800, lineHeight: 1.25, minWidth: 0, overflowWrap: "break-word" }}>{settings.teamName}</span>
      </div>
      <button onClick={onHelp} style={{ flexShrink: 0, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
        <span style={{ color: sc, fontWeight: 800 }}>?</span> עזרה
      </button>
    </div>
  );

  const adminLink = (
    <div style={{ textAlign: "center", padding: "8px 0 24px" }}>
      <button onClick={onAdmin} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>🔐 כניסת מנהל</button>
    </div>
  );

  // ── מצב א': דשבורד אישי (מכשיר זכור) ──
  if (me) {
    const myStatus = nextEvent ? (attendance[`${nextEvent.id}_${me.id}`] || {}).status : null;
    const bdayOthers = players.filter(p => p.id !== me.id && isBirthdayToday((playerProfiles[p.id] || {}).birthday));
    const rsvp = myStatus === "coming" ? { bg: "#16a34a", c: "white", t: "✓ אישרת הגעה — להחלפה הקישי" }
      : myStatus === "notcoming" ? { bg: "#ef4444", c: "white", t: "✗ סימנת שלא תגיעי — להחלפה הקישי" }
      : { bg: sc, c: pc, t: "טרם אישרת הגעה — אשרי עכשיו ←" };
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", overflowX: "hidden" }}>
        {header}

        <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", minWidth: 0, overflowWrap: "break-word" }}>שלום {me.name} 👋</span>
          <button onClick={() => setForceRoster(true)} style={{ flexShrink: 0, background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>לא את? החליפי</button>
        </div>

        {activeNotifs.length > 0 && <div style={{ padding: "10px 16px 0" }}><NotifTicker notifs={activeNotifs} pc={pc} sc={sc} /></div>}

        <div style={{ padding: "12px 16px 0" }}>
          {nextEvent ? (
            <button onClick={() => onSelectPlayer(me)} style={{ width: "100%", textAlign: "right", background: pc, border: "none", borderRadius: 18, padding: 16, cursor: "pointer", boxShadow: `0 6px 20px ${pc}40` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ background: "rgba(255,255,255,0.16)", color: "white", borderRadius: 20, padding: "4px 11px", fontSize: 12, fontWeight: 700 }}>{nextEvent.type === "training" ? "🏋️ אימון" : "🏆 משחק"}</span>
                <span style={{ background: sc, color: pc, borderRadius: 20, padding: "5px 12px", fontSize: 13, fontWeight: 800 }}>⏳ {countdownLabel(nextEvent.date)}</span>
              </div>
              <div style={{ color: "white", fontSize: 18, fontWeight: 800, marginBottom: 4, lineHeight: 1.3 }}>{formatDate(nextEvent.date)} · {nextEvent.time}</div>
              <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, marginBottom: 12 }}>📍 {nextEvent.location}</div>
              <div style={{ background: rsvp.bg, color: rsvp.c, borderRadius: 10, padding: 10, textAlign: "center", fontSize: 14, fontWeight: 800 }}>{rsvp.t}</div>
            </button>
          ) : (
            <div style={{ background: "white", borderRadius: 16, padding: 22, textAlign: "center", color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>😴 אין אירועים קרובים כרגע</div>
          )}
        </div>

        {bdayOthers.length > 0 && (
          <div style={{ padding: "12px 16px 0" }}>
            <button onClick={() => onSelectPlayer(me)} style={{ width: "100%", textAlign: "right", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🎂</span>
              <span style={{ fontSize: 13, color: "#92400e", fontWeight: 700 }}>היום יום ההולדת של {bdayOthers.map(p => p.name).join(", ")} — שלחי ברכה!</span>
            </button>
          </div>
        )}

        <div style={{ padding: "12px 16px 0" }}>
          <button onClick={() => onSelectPlayer(me)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "white", border: `2px solid ${pc}20`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", textAlign: "right", boxShadow: "0 3px 12px rgba(26,35,126,0.10)" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: sc, color: pc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>👤</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: pc }}>המסך האישי שלי</div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>תמונות מהמשחק · סטטיסטיקה · סקרים ועוד</div>
            </div>
            <div style={{ fontSize: 22, color: pc, flexShrink: 0 }}>←</div>
          </button>
        </div>

        {adminLink}
      </div>
    );
  }

  // ── מצב ב': רשימת בחירה (כניסה ראשונה / החלפת שחקנית) ──
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", overflowX: "hidden" }}>
      {header}

      <div style={{ padding: "12px 16px 0", textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>בחרי את שמך כדי להיכנס</span>
      </div>

      {activeNotifs.length > 0 && <div style={{ padding: "10px 16px 0" }}><NotifTicker notifs={activeNotifs} pc={pc} sc={sc} /></div>}

      {nextEvent && (
        <div style={{ padding: "10px 16px 0" }}>
          <button onClick={() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: pc, border: "none", borderRadius: 16, padding: "12px 16px", cursor: "pointer", textAlign: "right", boxShadow: `0 4px 14px ${pc}33` }}>
            <div style={{ fontSize: 26 }}>{nextEvent.type === "training" ? "🏋️" : "🏆"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "white", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {nextEvent.type === "training" ? "אימון" : "משחק"} · {formatShort(nextEvent.date)} · {nextEvent.time}
              </div>
              <div style={{ color: sc, fontSize: 12, fontWeight: 700, marginTop: 2 }}>בחרי את שמך לאישור הגעה ←</div>
            </div>
            <div style={{ background: sc, color: pc, borderRadius: 20, padding: "5px 12px", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{countdownLabel(nextEvent.date)}</div>
          </button>
        </div>
      )}

      <div style={{ padding: "12px 16px 0" }}>
        <div ref={gridRef} style={{ background: "white", borderRadius: 18, padding: 16, boxShadow: "0 4px 18px rgba(26,35,126,0.10)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {players.map(p => {
              const prof = playerProfiles[p.id] || {};
              return (
                <button key={p.id} onClick={() => onSelectPlayer(p)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "13px 6px", background: `${pc}0d`, border: `2px solid ${pc}25`, borderRadius: 14, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${pc}20`; e.currentTarget.style.borderColor = pc; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${pc}0d`; e.currentTarget.style.borderColor = `${pc}25`; }}>
                  {prof.photo
                    ? <img src={prof.photo} style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", border: `2px solid ${sc}` }} />
                    : <div style={{ width: 50, height: 50, borderRadius: "50%", background: `linear-gradient(135deg, ${pc}, ${pc}99)`, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, border: `2px solid ${sc}` }}>{p.name[0]}</div>
                  }
                  <span style={{ fontSize: 12, fontWeight: 700, color: pc, textAlign: "center", overflowWrap: "anywhere", maxWidth: "100%" }}>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {adminLink}
    </div>
  );
}

// ── ONBOARD SCREEN ────────────────────────────────────────────────────────────
function OnboardScreen({ player, playerProfiles, upd, pc, sc, onDone, onBack }) {
  const prof = playerProfiles[player.id] || {};
  const isReturning = !!prof.setupDone;
  const [pass, setPass] = useState("");
  const [passError, setPassError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [remember, setRemember] = useState(true);
  const [photo, setPhoto] = useState(prof.photo || null);
  const [phone, setPhone] = useState(prof.phone || "");
  const [whatsapp, setWhatsapp] = useState(prof.whatsapp || "");
  const [email, setEmail] = useState(prof.email || "");
  const [birthday, setBirthday] = useState(prof.birthday || "");
  const photoRef = useRef();

  const PLAYER_PASS = prof.password || "";

  function tryLogin() {
    if (!pass.trim()) { setLoginError(true); setTimeout(() => setLoginError(false), 1500); return; }
    if (pass === PLAYER_PASS) {
      if (remember) localStorage.setItem("rememberPlayer_" + player.id, "1");
      else localStorage.removeItem("rememberPlayer_" + player.id);
      onDone();
    }
    else { setLoginError(true); setTimeout(() => setLoginError(false), 1500); }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  }

  function handlePhoneChange(val) {
    setPhone(val);
    // Auto-fill whatsapp: convert Israeli format to international
    const digits = val.replace(/\D/g, "");
    const wa = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
    setWhatsapp(wa);
  }

  async function completeSetup() {
    let valid = true;
    if (!pass.trim()) { setPassError("יש להזין סיסמה"); valid = false; }
    else if (pass.trim().length < 4) { setPassError("הסיסמה חייבת להכיל לפחות 4 תווים"); valid = false; }
    else if (pass.trim() === "1234") { setPassError("הסיסמה 1234 שמורה למערכת — בחרי סיסמה אחרת"); valid = false; }
    else setPassError("");
    if (!phone.trim()) { setPhoneError("יש להזין מספר טלפון"); valid = false; } else setPhoneError("");
    if (!valid) return;
    const updated = {
      ...playerProfiles,
      [player.id]: { ...prof, photo, phone, whatsapp, email, birthday, setupDone: true, password: pass.trim() }
    };
    await upd.playerProfiles(updated);
    onDone();
  }

  if (isReturning) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
        <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "36px 20px 44px", textAlign: "center", position: "relative" }}>
          <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
          {prof.photo
            ? <img src={prof.photo} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: `3px solid ${sc}`, marginBottom: 10 }} />
            : <div style={{ width: 72, height: 72, borderRadius: "50%", background: sc, color: pc, fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", border: "3px solid white" }}>{player.name[0]}</div>
          }
          <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: 0 }}>שלום, {player.name}! 👋</h2>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, margin: "4px 0 0" }}>נשמח לראות אותך</p>
        </div>
        <div style={{ padding: 28, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16, textAlign: "center" }}>הכנסי את הסיסמה שלך להמשך</p>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && tryLogin()}
            placeholder="סיסמה אישית" autoFocus
            style={{ ...S.input, maxWidth: 260, textAlign: "center", fontSize: 20, letterSpacing: 6, border: `2px solid ${loginError ? "#ef4444" : "#e2e8f0"}` }} />
          {loginError && <p style={{ color: "#ef4444", margin: "0 0 12px", fontSize: 13 }}>{!pass.trim() ? "יש להזין סיסמה ❌" : "סיסמה שגויה ❌"}</p>}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b", cursor: "pointer", marginTop: 10, maxWidth: 280 }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: 18, height: 18, accentColor: pc, cursor: "pointer", flexShrink: 0 }} />
            זכרי אותי במכשיר הזה (כניסה מהירה בפעם הבאה)
          </label>
          <button onClick={tryLogin} style={{ padding: "13px 48px", background: pc, color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 700, marginTop: 14 }}>כניסה ✓</button>
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 20, textAlign: "center" }}>שכחת סיסמה? פני למנהל הקבוצה</p>
        </div>
      </div>
    );
  }

  // First time setup
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "28px 20px 36px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        <div style={{ fontSize: 48 }}>👋</div>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: "8px 0 4px" }}>שלום, {player.name}!</h2>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: 0 }}>כניסה ראשונה — בואי נגדיר את הפרופיל שלך</p>
      </div>

      <div style={{ padding: "20px 20px 32px" }}>
        {/* Photo */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            {photo
              ? <img src={photo} style={{ width: 90, height: 90, borderRadius: "50%", objectFit: "cover", border: `3px solid ${sc}` }} />
              : <div style={{ width: 90, height: 90, borderRadius: "50%", background: `linear-gradient(135deg, ${pc}, ${pc}99)`, color: sc, fontSize: 34, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: `3px solid ${sc}`, margin: "0 auto" }}>{player.name[0]}</div>
            }
            <button onClick={() => photoRef.current.click()}
              style={{ position: "absolute", bottom: 0, left: 0, background: sc, border: "2px solid white", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>📷</button>
            <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
          </div>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>לחצי להוספת תמונה</p>
        </div>

        <div style={S.card}>
          <Label>סיסמה אישית <span style={{ color: "#ef4444" }}>*</span></Label>
          <input type="password" value={pass} onChange={e => { setPass(e.target.value); setPassError(""); }} placeholder="בחרי סיסמה לכניסות הבאות" style={{ ...S.input, border: `2px solid ${passError ? "#ef4444" : "#e2e8f0"}` }} />
          {passError && <p style={{ color: "#ef4444", fontSize: 12, margin: "-6px 0 8px", fontWeight: 600 }}>⚠️ {passError}</p>}

          <Label>טלפון <span style={{ color: "#ef4444" }}>*</span></Label>
          <input type="tel" value={phone} onChange={e => { handlePhoneChange(e.target.value); setPhoneError(""); }} placeholder="050-0000000" style={{ ...S.input, border: `2px solid ${phoneError ? "#ef4444" : "#e2e8f0"}` }} />
          {phoneError && <p style={{ color: "#ef4444", fontSize: 12, margin: "-6px 0 8px", fontWeight: 600 }}>⚠️ {phoneError}</p>}

          <Label>וואטסאפ <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 400 }}>(ממולא אוטומטית)</span></Label>
          <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="972501234567" style={S.input} />

          <Label>מייל <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 400 }}>(אופציונלי)</span></Label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" style={S.input} />

          <Label>🎂 תאריך לידה <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 400 }}>(אופציונלי)</span></Label>
          <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} style={S.input} />
        </div>

        <button onClick={completeSetup}
          style={{ width: "100%", padding: 14, background: pc, color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 700, marginTop: 4 }}>
          ✅ סיום הגדרה — כניסה
        </button>
      </div>
    </div>
  );
}

// ── PLAYER SCREEN ─────────────────────────────────────────────────────────────
function PlayerScreen({ player, events, attendance, players, notifications, games, gallery, playerProfiles, settings, applause, polls, personalNotifs, archive, upd, pc, sc, askConfirm, onBack }) {
  const [tab, setTab] = useState("event");
  const [attModal, setAttModal] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [showNoteFor, setShowNoteFor] = useState(null);
  const [editProfile, setEditProfile] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editBirthday, setEditBirthday] = useState("");
  const [entryPopups, setEntryPopups] = useState([]); // birthday + applause greetings shown once on entry
  const galleryRef = useRef();
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const photoRef = useRef();

  const prof = playerProfiles[player.id] || {};
  const nextEvent = getNextEvent(events);
  const myKey = nextEvent ? `${nextEvent.id}_${player.id}` : null;
  const myRecord = myKey ? attendance[myKey] : null;
  const activeNotifs = notifications.filter(n => n.active && !(n.type === "cancel" && n.expiresOn && n.expiresOn < todayStr()));

  // ── Build entry popups (birthday greeting + unseen applause) — runs once on mount ──
  useEffect(() => {
    const popups = [];
    // Birthday greeting for self (once per day)
    if (isBirthdayToday(prof.birthday)) {
      const seenKey = `bdaySeen_${player.id}_${todayStr()}`;
      if (!localStorage.getItem(seenKey)) {
        popups.push({ kind: "birthday", id: "bday" });
        localStorage.setItem(seenKey, "1");
      }
    }
    // Other players' birthdays today → offer to send a greeting (once per viewer per celebrant per day)
    players.forEach(other => {
      if (other.id === player.id) return;
      const oprof = playerProfiles[other.id] || {};
      if (isBirthdayToday(oprof.birthday)) {
        const seenKey = `othersBdaySeen_${player.id}_${other.id}_${todayStr()}`;
        if (!localStorage.getItem(seenKey)) {
          popups.push({ kind: "otherBirthday", id: "obday_" + other.id, celebrantId: other.id, celebrantName: other.name });
          localStorage.setItem(seenKey, "1");
        }
      }
    });
    // Unseen personal notifications: applause (one each) + birthday greetings (aggregated)
    const myNotifs = (personalNotifs[player.id] || []).filter(n => !n.seen && (n.type === "applause" || n.type === "birthday"));
    myNotifs.filter(n => n.type === "applause").forEach(n => popups.push({ kind: "applause", id: n.id, fromName: n.fromName }));
    const bdayGreets = myNotifs.filter(n => n.type === "birthday");
    if (bdayGreets.length > 0) {
      const names = [...new Set(bdayGreets.map(n => n.fromName))];
      const namesStr = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " ו" + names[names.length - 1];
      popups.push({ kind: "birthdayReceived", id: "bdayrecv", fromNames: namesStr, multi: names.length > 1 });
    }
    if (popups.length > 0) {
      setEntryPopups(popups);
      // Mark applause + birthday notifs as seen
      if (myNotifs.length > 0) {
        const updated = {
          ...personalNotifs,
          [player.id]: (personalNotifs[player.id] || []).map(n => (n.type === "applause" || n.type === "birthday") ? { ...n, seen: true } : n),
        };
        upd.personalNotifs(updated);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissTopPopup() {
    setEntryPopups(p => p.slice(1));
  }

  // שליחת ברכת יום הולדת לחוגגת (התראה אישית, פעם אחת לכל צופה לכל חוגגת ביום)
  async function sendBirthdayGreeting(celebrantId, celebrantName) {
    const key = `bdayGreetSent_${player.id}_${celebrantId}_${todayStr()}`;
    if (!localStorage.getItem(key)) {
      const notif = { id: `bday_${player.id}_${Date.now()}`, type: "birthday", fromName: player.name, seen: false, date: todayStr() };
      const updated = { ...personalNotifs, [celebrantId]: [...(personalNotifs[celebrantId] || []), notif] };
      await upd.personalNotifs(updated);
      localStorage.setItem(key, "1");
    }
    dismissTopPopup();
  }

  function countAtt(status) {
    if (!nextEvent) return 0;
    if (status === "pending") return players.filter(p => !attendance[`${nextEvent.id}_${p.id}`]?.status).length;
    return players.filter(p => attendance[`${nextEvent.id}_${p.id}`]?.status === status).length;
  }
  function getList(status) {
    if (!nextEvent) return [];
    if (status === "pending") return players.filter(p => !attendance[`${nextEvent.id}_${p.id}`]?.status);
    return players.filter(p => attendance[`${nextEvent.id}_${p.id}`]?.status === status);
  }

  async function handleRSVP(status) {
    const key = `${nextEvent.id}_${player.id}`;
    await upd.attendance({ ...attendance, [key]: { status, note: "", time: new Date().toISOString() } });
    // Show inline note option
    setShowNoteFor(status);
  }

  async function saveNote() {
    const key = `${nextEvent.id}_${player.id}`;
    const cur = attendance[key] || {};
    await upd.attendance({ ...attendance, [key]: { ...cur, note: noteInput } });
    setShowNoteFor(null); setNoteInput("");
  }

  async function sendApplause(toPlayer) {
    if (toPlayer.id === player.id) return;
    if (alreadyApplaudedToday(applause, player.id, toPlayer.id)) return;
    // Record applause
    const newApplause = [...applause, {
      id: Date.now(), fromId: player.id, fromName: player.name,
      toId: toPlayer.id, toName: toPlayer.name, date: todayStr(),
    }];
    await upd.applause(newApplause);
    // Add personal notification for the recipient
    const recipNotifs = personalNotifs[toPlayer.id] || [];
    await upd.personalNotifs({
      ...personalNotifs,
      [toPlayer.id]: [...recipNotifs, {
        id: Date.now() + 1, type: "applause", fromName: player.name,
        seen: false, createdAt: new Date().toISOString(),
      }],
    });
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const updated = { ...playerProfiles, [player.id]: { ...prof, photo: ev.target.result } };
      await upd.playerProfiles(updated);
    };
    reader.readAsDataURL(file);
  }

  async function uploadGallery(e) {
    const file = e.target.files[0]; if (!file) return;
    try {
      const path = `gallery/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await upd.gallery([...gallery, {
        id: Date.now(), playerId: player.id, playerName: player.name,
        photo: url, storagePath: path, date: new Date().toISOString(),
        eventTitle: nextEvent ? `${nextEvent.type === "training" ? "אימון" : "משחק"} ${formatShort(nextEvent.date)}` : "כללי"
      }]);
    } catch (err) {
      console.error("שגיאה בהעלאת תמונה:", err);
    }
  }

  async function deleteGalleryPhoto(item) {
    try { if (item.storagePath) await deleteObject(ref(storage, item.storagePath)); }
    catch (err) { console.error("שגיאה במחיקת קובץ מ-Storage:", err); }
    await upd.gallery(gallery.filter(g => g.id !== item.id));
    setSelectedPhoto(null);
  }

  const tabs = [{ key: "event", label: "📅 אירוע" }, { key: "games", label: "🏆 משחקים" }, { key: "polls", label: "🗳️ סקר" }, { key: "gallery", label: "📸 תמונות מהמשחק" }];

  // Attendees of the most recent event (last archived event, else current event's "coming" list)
  const lastArchived = [...(archive || [])].sort((a, b) => b.date.localeCompare(a.date))[0];
  let lastEventAttendees = [];
  let lastEventLabel = "";
  if (lastArchived) {
    const ids = (lastArchived.attendanceData || []).filter(a => a.status === "coming").map(a => a.playerId);
    lastEventAttendees = players.filter(p => ids.includes(p.id));
    lastEventLabel = `${lastArchived.type === "training" ? "אימון" : "משחק"} ${formatShort(lastArchived.date)}`;
  } else if (nextEvent) {
    lastEventAttendees = players.filter(p => attendance[`${nextEvent.id}_${p.id}`]?.status === "coming");
    lastEventLabel = `${nextEvent.type === "training" ? "אימון" : "משחק"} ${formatShort(nextEvent.date)}`;
  }
  const myApplauseCount = applauseThisMonth(applause, player.id);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Entry popups: self birthday, others' birthday (send greeting), applause, received greetings */}
      {entryPopups.length > 0 && (() => {
        const top = entryPopups[0];
        const icon = top.kind === "applause" ? "👏" : top.kind === "otherBirthday" ? "🎂" : top.kind === "birthdayReceived" ? "🎉" : "🎂";
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={dismissTopPopup}>
            <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 22, padding: "32px 26px", maxWidth: 320, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", animation: "bounce 0.5s ease" }}>
              <div style={{ fontSize: 64, marginBottom: 10 }}>{icon}</div>
              {top.kind === "birthday" ? (
                <>
                  <div style={{ fontSize: 22, fontWeight: 900, color: pc, marginBottom: 8 }}>יום הולדת שמח, {player.name}! 🎉</div>
                  <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, margin: "0 0 6px" }}>כל הקבוצה מאחלת לך יום מדהים ומלא שמחה!</p>
                  <p style={{ fontSize: 14, color: pc, fontWeight: 700, margin: 0 }}>🏐 שתמשיכי לכבוש את המגרש! 🏐</p>
                </>
              ) : top.kind === "applause" ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 900, color: pc, marginBottom: 8 }}>{top.fromName} שלחה לך כל הכבוד!</div>
                  <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: 0 }}>על ההגעה לאימון/משחק. כל הכבוד! 💪</p>
                </>
              ) : top.kind === "otherBirthday" ? (
                <>
                  <div style={{ fontSize: 22, fontWeight: 900, color: pc, marginBottom: 8 }}>היום יום ההולדת של {top.celebrantName}!</div>
                  <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: 0 }}>רוצה לשלוח לה ברכה חמה? היא תקבל אותה ישר אצלה 🎉</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 20, fontWeight: 900, color: pc, marginBottom: 8 }}>קיבלת ברכה ליום ההולדת!</div>
                  <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, margin: 0 }}><b style={{ color: pc }}>{top.fromNames}</b> {top.multi ? "בירכו" : "בירכה"} אותך ליום הולדת שמח 🎂</p>
                </>
              )}
              {top.kind === "otherBirthday" ? (
                <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => sendBirthdayGreeting(top.celebrantId, top.celebrantName)} style={{ width: "100%", padding: 13, background: sc, color: pc, border: "none", borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: 15 }}>🎂 שלחי ברכה</button>
                  <button onClick={dismissTopPopup} style={{ width: "100%", padding: 10, background: "transparent", color: "#94a3b8", border: "none", cursor: "pointer", fontSize: 14 }}>אולי אחר כך</button>
                </div>
              ) : (
                <button onClick={dismissTopPopup} style={{ marginTop: 22, width: "100%", padding: 13, background: pc, color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: 15 }}>
                  {entryPopups.length > 1 ? "תודה! הבא ←" : "תודה! 🥰"}
                </button>
              )}
            </div>
          </div>
        );
      })()}
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}bb)`, padding: "20px 16px 28px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        <button onClick={() => { localStorage.removeItem("rememberPlayer_" + player.id); onBack(); }} style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>🔓 התנתקי</button>
        <div style={{ position: "relative", display: "inline-block", marginBottom: 8 }}>
          {prof.photo
            ? <img src={prof.photo} style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", border: `3px solid ${sc}` }} />
            : <div style={{ width: 68, height: 68, borderRadius: "50%", background: sc, color: pc, fontSize: 26, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid white", margin: "0 auto" }}>{player.name[0]}</div>
          }
          <button onClick={() => photoRef.current.click()} style={{ position: "absolute", bottom: 0, left: -2, background: sc, border: "2px solid white", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>📷</button>
          <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
        </div>
        <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>שלום, {player.name}! 👋</h2>
        {myApplauseCount > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.18)", borderRadius: 20, padding: "4px 12px", marginTop: 8 }}>
            <span style={{ fontSize: 14 }}>👏</span>
            <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>{myApplauseCount} מחיאות כפיים החודש</span>
          </div>
        )}
        <div>
          <button onClick={() => { setEditPhone(prof.phone||""); setEditEmail(prof.email||""); setEditWhatsapp(prof.whatsapp||""); setEditBirthday(prof.birthday||""); setEditProfile(true); }}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, marginTop: 8 }}>
            ✏️ עריכת פרופיל
          </button>
        </div>
      </div>

      {/* Edit profile modal */}
      {editProfile && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxHeight: "80vh", overflowY: "auto", boxSizing: "border-box" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: pc, marginBottom: 16, marginTop: 0 }}>✏️ עריכת פרופיל</h3>
            <Label>טלפון</Label>
            <input type="tel" value={editPhone} onChange={e => { setEditPhone(e.target.value); setEditWhatsapp("972" + e.target.value.replace(/\D/g,"").replace(/^0/,"")); }}
              placeholder="050-0000000" style={S.input} />
            <Label>וואטסאפ</Label>
            <input type="tel" value={editWhatsapp} onChange={e => setEditWhatsapp(e.target.value)}
              placeholder="972501234567" style={S.input} />
            <Label>מייל</Label>
            <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
              placeholder="example@email.com" style={S.input} />
            <Label>🎂 תאריך לידה</Label>
            <input type="date" value={editBirthday} onChange={e => setEditBirthday(e.target.value)} style={S.input} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => {
                const updated = { ...playerProfiles, [player.id]: { ...prof, phone: editPhone, whatsapp: editWhatsapp, email: editEmail, birthday: editBirthday } };
                await upd.playerProfiles(updated);
                setEditProfile(false);
              }} style={{ flex: 1, padding: 12, background: pc, color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>שמור</button>
              <button onClick={() => setEditProfile(false)} style={{ flex: 1, padding: 12, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, cursor: "pointer" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", background: "white", borderBottom: "2px solid #e2e8f0", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={(e) => { setTab(t.key); e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }}
            style={{ flex: 1, padding: "12px 4px", border: "none", background: "transparent", color: tab === t.key ? pc : "#64748b", cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 700 : 500, borderBottom: tab === t.key ? `3px solid ${sc}` : "3px solid transparent", whiteSpace: "nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {/* ── EVENT TAB ── */}
        {tab === "event" && (
          <>
            {!nextEvent ? <Empty icon="😴" text="אין אירועים קרובים" /> : (
              <>
                <div style={{ background: pc, borderRadius: 18, padding: "18px 18px 16px", marginBottom: 14, boxShadow: `0 6px 20px ${pc}40` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ background: "rgba(255,255,255,0.16)", color: "white", borderRadius: 20, padding: "5px 12px", fontSize: 13, fontWeight: 700 }}>{nextEvent.type === "training" ? "🏋️ אימון" : "🏆 משחק"}</div>
                    <div style={{ background: sc, color: pc, borderRadius: 20, padding: "6px 14px", fontSize: 14, fontWeight: 800 }}>⏳ {countdownLabel(nextEvent.date)}</div>
                  </div>
                  <div style={{ color: "white", fontSize: 21, fontWeight: 800, marginBottom: 8, lineHeight: 1.3 }}>{formatDate(nextEvent.date)}</div>
                  <div style={{ display: "flex", gap: 16, color: "rgba(255,255,255,0.92)", fontSize: 15, flexWrap: "wrap" }}>
                    <span>⏰ {nextEvent.time}</span>
                    <span>📍 {nextEvent.location}</span>
                  </div>
                  {nextEvent.note && <div style={{ color: sc, fontSize: 14, fontWeight: 600, marginTop: 10 }}>📝 {nextEvent.note}</div>}
                </div>

                {/* Clickable counters */}
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  {[["coming", "מגיעות", "#22c55e"], ["notcoming", "לא מגיעות", "#ef4444"], ["pending", "טרם ענו", "#94a3b8"]].map(([s, label, color]) => (
                    <button key={s} onClick={() => setAttModal(s)}
                      style={{ flex: 1, background: "white", border: `2px solid ${color}30`, borderRadius: 12, padding: "10px 4px", cursor: "pointer", textAlign: "center" }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color }}>{countAtt(s)}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{label}</div>
                    </button>
                  ))}
                </div>

                {/* Who's coming - collapsible */}
                {getList("coming").length > 0 && (
                  <Collapsible title="✅ מגיעות" count={getList("coming").length} accent="#16a34a" defaultOpen>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {getList("coming").map(p => <span key={p.id} style={{ background: "#22c55e", color: "white", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{p.name}</span>)}
                    </div>
                  </Collapsible>
                )}

                {/* RSVP */}
                {myRecord?.status ? (
                  <div style={{ ...S.card, textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 6 }}>{myRecord.status === "coming" ? "✅" : "❌"}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>סימנת: <strong>{myRecord.status === "coming" ? "מגיעה" : "לא מגיעה"}</strong></div>
                    {myRecord.note && <div style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic", margin: "6px 0" }}>"{myRecord.note}"</div>}

                    {/* Inline note add without popup */}
                    {showNoteFor && (
                      <div style={{ marginTop: 12, textAlign: "right" }}>
                        <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
                          placeholder='הוסיפי הערה... (למשל: "מאחרת")'
                          style={{ ...S.input, marginBottom: 6 }} autoFocus />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={saveNote} style={{ flex: 1, padding: 10, background: pc, color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>שמור הערה</button>
                          <button onClick={() => setShowNoteFor(null)} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer" }}>דלג</button>
                        </div>
                      </div>
                    )}

                    {!showNoteFor && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
                        <button onClick={() => setShowNoteFor("note")} style={{ padding: "7px 16px", background: `${pc}15`, color: pc, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✏️ הוסף הערה</button>
                        <button onClick={() => upd.attendance({ ...attendance, [myKey]: { ...myRecord, status: null } })}
                          style={{ padding: "7px 16px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>שינוי תשובה</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ ...S.card, textAlign: "center" }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>האם את מגיעה?</p>
                    <div style={{ display: "flex", gap: 10, marginBottom: showNoteFor ? 12 : 0 }}>
                      <button onClick={() => handleRSVP("coming")}
                        style={{ flex: 1, padding: "16px", background: "#22c55e", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 16, fontWeight: 800 }}>✅ מגיעה</button>
                      <button onClick={() => handleRSVP("notcoming")}
                        style={{ flex: 1, padding: "16px", background: "#ef4444", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 16, fontWeight: 800 }}>❌ לא מגיעה</button>
                    </div>
                    {showNoteFor && (
                      <div style={{ textAlign: "right" }}>
                        <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
                          placeholder='הוסיפי הערה (אופציונלי)...'
                          style={{ ...S.input, marginBottom: 6 }} autoFocus />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={saveNote} style={{ flex: 1, padding: 10, background: pc, color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>שמור</button>
                          <button onClick={() => setShowNoteFor(null)} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer" }}>דלג</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 👏 Applause — collapsible */}
                {lastEventAttendees.filter(p => p.id !== player.id).length > 0 && (
                  <Collapsible title="👏 כל הכבוד לחברות" count={lastEventAttendees.filter(p => p.id !== player.id).length} accent={pc}>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>שלחי מחיאות כפיים למי שהגיעה ל{lastEventLabel} (פעם ביום לכל אחת)</div>
                    {lastEventAttendees.filter(p => p.id !== player.id).map(p => {
                      const prof2 = playerProfiles[p.id] || {};
                      const done = alreadyApplaudedToday(applause, player.id, p.id);
                      const cnt = applauseThisMonth(applause, p.id);
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                          {prof2.photo ? <img src={prof2.photo} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                            : <div style={{ width: 36, height: 36, borderRadius: "50%", background: pc, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{p.name[0]}</div>}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                            {cnt > 0 && <div style={{ fontSize: 11, color: "#94a3b8" }}>👏 {cnt} החודש</div>}
                          </div>
                          <button onClick={() => sendApplause(p)} disabled={done}
                            style={{ padding: "7px 14px", borderRadius: 20, border: "none", cursor: done ? "default" : "pointer", fontSize: 13, fontWeight: 700,
                              background: done ? "#f0fdf4" : sc, color: done ? "#16a34a" : pc, opacity: done ? 1 : 1 }}>
                            {done ? "✓ נשלח היום" : "👏 כל הכבוד"}
                          </button>
                        </div>
                      );
                    })}
                  </Collapsible>
                )}
              </>
            )}

            {/* 📊 Personal stats — based on archived (verified) events only */}
                {(() => {
                  const arch = archive || [];
                  const calc = type => {
                    const evs = arch.filter(a => a.type === type);
                    const came = evs.filter(a => (a.attendanceData || []).some(d => d.playerId === player.id && d.status === "coming")).length;
                    return { total: evs.length, came };
                  };
                  const tr = calc("training"), gm = calc("game");
                  const totT = tr.total + gm.total, totC = tr.came + gm.came;
                  const col = p => p >= 75 ? "#16a34a" : p >= 50 ? "#f59e0b" : "#ef4444";
                  const pct = (c, t) => t ? Math.round(c / t * 100) : 0;
                  const bar = (icon, label, c, t, big) => {
                    const p = pct(c, t);
                    return (
                      <div style={{ marginBottom: big ? 0 : 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: big ? 14 : 13, marginBottom: 5 }}>
                          <span style={{ color: big ? "#1e293b" : "#475569", fontWeight: big ? 800 : 500 }}>{icon} {label}</span>
                          <span style={{ fontWeight: 800, color: col(p) }}>{c} / {t} · {p}%</span>
                        </div>
                        <div style={{ height: big ? 10 : 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${p}%`, height: "100%", background: big ? pc : col(p), borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  };
                  return (
                    <Collapsible title="📊 הסטטיסטיקה שלי" count={totT} accent={pc}>
                      {totT === 0
                        ? <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "8px 0" }}>עדיין אין נתונים — הסטטיסטיקה תופיע אחרי שהמנהלת תארכב אירועים.</div>
                        : <>
                            {bar("🏋️", "אימונים", tr.came, tr.total, false)}
                            {bar("🏆", "משחקים", gm.came, gm.total, false)}
                            <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 12 }}>{bar("✅", 'סה"כ נוכחות', totC, totT, true)}</div>
                          </>}
                    </Collapsible>
                  );
                })()}
          </>
        )}

        {/* ── GAMES TAB ── */}
        {tab === "games" && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: pc, marginBottom: 12 }}>🏆 לוח משחקים</h3>
            {games.length === 0 && <Empty icon="🏐" text="אין משחקים מתוכננים" />}
            {[...games].sort((a, b) => a.date.localeCompare(b.date)).map(g => (
              <div key={g.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{formatDate(g.date)} • {g.time}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>נגד: {g.opponent}</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>📍 {g.location}</div>
                </div>
                {g.outcome
                  ? <div style={{ textAlign: "center" }}><OutcomeBadge outcome={g.outcome} result={g.result} size="lg" /></div>
                  : g.result
                  ? <div style={{ background: `${pc}15`, borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>תוצאה</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: pc }}>{g.result}</div>
                    </div>
                  : <div style={{ background: `${sc}50`, borderRadius: 10, padding: "8px 12px" }}>
                      <div style={{ fontSize: 12, color: pc, fontWeight: 700 }}>עתידי</div>
                    </div>
                }
              </div>
            ))}
          </div>
        )}

        {/* ── POLLS TAB ── */}
        {tab === "polls" && (
          <PlayerPolls polls={polls} player={player} upd={upd} pc={pc} sc={sc} />
        )}

        {/* ── GALLERY TAB ── */}
        {tab === "gallery" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: pc, margin: 0 }}>📸 תמונות מהמשחק</h3>
              <label style={{ background: pc, color: "white", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                + העלי תמונה
                <input ref={galleryRef} type="file" accept="image/*" onChange={uploadGallery} style={{ display: "none" }} />
              </label>
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 12px" }}>נא להעלות כאן רק תמונות מהמשחקים והאימונים של הקבוצה 🏐</p>
            {gallery.length === 0 && <Empty icon="📸" text="אין תמונות עדיין - היי הראשונה!" />}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {[...gallery].reverse().map(item => (
                <div key={item.id} onClick={() => setSelectedPhoto(item)} style={{ borderRadius: 12, overflow: "hidden", position: "relative", cursor: "pointer" }}>
                  <img src={item.photo} style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.65))", padding: "16px 8px 6px" }}>
                    <div style={{ color: "white", fontSize: 11, fontWeight: 600 }}>{item.playerName}</div>
                    <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 10 }}>{item.eventTitle || new Date(item.date).toLocaleDateString("he-IL")}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Lightbox */}
            {selectedPhoto && (
              <div onClick={() => setSelectedPhoto(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
                <img src={selectedPhoto.photo} style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12, objectFit: "contain" }} />
                <div style={{ color: "white", fontSize: 13, fontWeight: 600, marginTop: 12 }}>{selectedPhoto.playerName}</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 4 }}>{selectedPhoto.eventTitle || new Date(selectedPhoto.date).toLocaleDateString("he-IL")}</div>
                {selectedPhoto.playerId === player.id && (
                  <button onClick={(e) => { e.stopPropagation(); askConfirm("למחוק את התמונה?", () => deleteGalleryPhoto(selectedPhoto)); }}
                    style={{ marginTop: 16, background: "#ef4444", color: "white", border: "none", borderRadius: 10, padding: "9px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    🗑️ מחקי תמונה
                  </button>
                )}
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 16 }}>לחץ לסגירה</div>
              </div>
            )}
          </div>
        )}

        {/* ── UPDATES TAB ── */}
        {tab === "updates" && (
          <div>
            {activeNotifs.length === 0 && <Empty icon="📭" text="אין עדכונים כרגע" />}
            {[...activeNotifs].reverse().map(n => (
              <div key={n.id} style={{ ...S.card, borderRight: `4px solid ${n.type === "cancel" ? "#ef4444" : n.type === "coach" ? sc : pc}`, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>
                  {n.type === "cancel" ? "❌ ביטול" : n.type === "coach" ? "📢 המאמן" : "💬 עדכון"} • {new Date(n.createdAt).toLocaleDateString("he-IL")}
                </div>
                <div style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.6 }}>{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {attModal && nextEvent && (
        <AttModal
          title={attModal === "coming" ? "✅ מגיעות" : attModal === "notcoming" ? "❌ לא מגיעות" : "⏳ טרם ענו"}
          list={getList(attModal)} players={players.map(p => ({ ...p, ...(playerProfiles[p.id] || {}) }))}
          attendance={attendance} eventId={nextEvent.id}
          onClose={() => setAttModal(null)} pc={pc} sc={sc} />
      )}
    </div>
  );
}

// ── PLAYER POLLS ──────────────────────────────────────────────────────────────
function PlayerPolls({ polls, player, upd, pc, sc }) {
  const activePolls = [...(polls || [])].filter(p => p.active !== false).reverse();

  async function vote(pollId, optionIdx) {
    const updated = polls.map(poll => {
      if (poll.id !== pollId) return poll;
      const votes = { ...(poll.votes || {}) };
      votes[player.id] = optionIdx; // one vote per player; re-voting replaces
      return { ...poll, votes };
    });
    await upd.polls(updated);
  }

  if (activePolls.length === 0) return <Empty icon="🗳️" text="אין סקרים פעילים כרגע" />;

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: pc, marginBottom: 12 }}>🗳️ סקר</h3>
      {activePolls.map(poll => {
        const votes = poll.votes || {};
        const myVote = votes[player.id];
        const hasVoted = myVote !== undefined;
        const total = Object.keys(votes).length;
        const counts = poll.options.map((_, i) => Object.values(votes).filter(v => v === i).length);
        return (
          <div key={poll.id} style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 4 }}>{poll.question}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>{total} {total === 1 ? "הצביעה" : "הצביעו"} • {hasVoted ? "הצבעת ✓ (ניתן לשנות)" : "בחרי תשובה"}</div>
            {poll.options.map((opt, i) => {
              const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
              const isMine = myVote === i;
              return (
                <button key={i} onClick={() => vote(poll.id, i)}
                  style={{ position: "relative", width: "100%", textAlign: "right", border: `2px solid ${isMine ? pc : "#e2e8f0"}`, borderRadius: 10, padding: "11px 14px", marginBottom: 8, cursor: "pointer", background: "white", overflow: "hidden" }}>
                  {hasVoted && <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: `${pct}%`, background: isMine ? `${pc}22` : "#f1f5f9", transition: "width 0.4s ease", zIndex: 0 }} />}
                  <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: isMine ? 800 : 600, color: isMine ? pc : "#1e293b" }}>{isMine ? "● " : ""}{opt}</span>
                    {hasVoted && <span style={{ fontSize: 13, fontWeight: 800, color: pc }}>{pct}% ({counts[i]})</span>}
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── ADMIN LOGIN ───────────────────────────────────────────────────────────────
function AdminLogin({ pc, sc, onGoogle, onContinue, authUser, onBack, initialError }) {
  const [gLoading, setGLoading] = useState(false); const [gError, setGError] = useState(initialError || "");
  const isGoogleUser = authUser && !authUser.isAnonymous;
  async function googleLogin() {
    setGError(""); setGLoading(true);
    const res = await onGoogle();
    if (!res.ok) { setGLoading(false); setGError(res.error ? "ההתחברות נכשלה: " + res.error : ""); }
  }
  async function continueAdmin() {
    setGError(""); setGLoading(true);
    const res = await onContinue();
    if (!res.ok) { setGLoading(false); setGError(res.error || "שגיאה"); }
  }
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "40px 20px 50px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        <div style={{ fontSize: 52 }}>🔐</div>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 700, margin: "10px 0 0" }}>כניסת מנהל</h2>
      </div>
      <div style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {isGoogleUser ? (
          <>
            <p style={{ color: "#16a34a", fontSize: 14, margin: "0 0 14px", fontWeight: 600 }}>✓ מחובר כ-{authUser.email}</p>
            <button onClick={continueAdmin} disabled={gLoading}
              style={{ width: "100%", maxWidth: 300, padding: "14px 16px", background: pc, color: "white", border: "none", borderRadius: 12, cursor: gLoading ? "default" : "pointer", fontSize: 15, fontWeight: 700 }}>
              {gLoading ? "טוען..." : "המשך לניהול →"}
            </button>
          </>
        ) : (
          <>
            <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 18px", textAlign: "center" }}>התחברי עם חשבון Google כדי לנהל את הקבוצה</p>
            <button onClick={googleLogin} disabled={gLoading}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", maxWidth: 300, padding: "14px 16px", background: "white", color: "#3c4043", border: "1px solid #dadce0", borderRadius: 12, cursor: gLoading ? "default" : "pointer", fontSize: 15, fontWeight: 600, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
              <span style={{ fontSize: 18 }}>🔵</span>
              {gLoading ? "מתחבר..." : "התחבר עם Google"}
            </button>
          </>
        )}
        {gError && <p style={{ color: "#ef4444", margin: "12px 0 0", fontSize: 13, textAlign: "center", maxWidth: 300, wordBreak: "break-word" }}>{gError}</p>}
      </div>
    </div>
  );
}

// ── ADMIN GALLERY (מחיקה גורפת למנהל) ─────────────────────────────────────────
function AdminGallery({ gallery, upd, pc, sc, askConfirm }) {
  const [selected, setSelected] = useState(null);
  async function deletePhoto(item) {
    try { if (item.storagePath) await deleteObject(ref(storage, item.storagePath)); }
    catch (err) { console.error("שגיאה במחיקת קובץ מ-Storage:", err); }
    await upd.gallery(gallery.filter(g => g.id !== item.id));
    setSelected(null);
  }
  if (!gallery || gallery.length === 0) return <Empty icon="📸" text="אין תמונות מהמשחק" />;
  return (
    <div>
      <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>כמנהל ניתן למחוק כל תמונה.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {[...gallery].reverse().map(item => (
          <div key={item.id} style={{ borderRadius: 12, overflow: "hidden", position: "relative" }}>
            <img src={item.photo} onClick={() => setSelected(item)} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", cursor: "pointer" }} />
            <button onClick={() => askConfirm(`למחוק את התמונה של ${item.playerName}?`, () => deletePhoto(item))}
              style={{ position: "absolute", top: 6, left: 6, background: "rgba(239,68,68,0.92)", color: "white", border: "none", borderRadius: 8, width: 30, height: 30, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              🗑️
            </button>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.65))", padding: "16px 8px 6px" }}>
              <div style={{ color: "white", fontSize: 11, fontWeight: 600 }}>{item.playerName}</div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 10 }}>{item.eventTitle || new Date(item.date).toLocaleDateString("he-IL")}</div>
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={selected.photo} style={{ maxWidth: "100%", maxHeight: "75vh", borderRadius: 12, objectFit: "contain" }} />
          <div style={{ color: "white", fontSize: 13, fontWeight: 600, marginTop: 12 }}>{selected.playerName}</div>
          <button onClick={(e) => { e.stopPropagation(); askConfirm(`למחוק את התמונה של ${selected.playerName}?`, () => deletePhoto(selected)); }}
            style={{ marginTop: 16, background: "#ef4444", color: "white", border: "none", borderRadius: 10, padding: "9px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            🗑️ מחק תמונה
          </button>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 16 }}>לחץ לסגירה</div>
        </div>
      )}
    </div>
  );
}

// ── ADMIN PANEL ───────────────────────────────────────────────────────────────
function AdminPanel(props) {
  const [tab, setTab] = useState("attendance");
  const { pc, sc, onBack } = props;
  const tabs = [["attendance","📋 נוכחות"],["events","📅 אירועים"],["games","🏆 משחקים"],["players","👥 שחקניות"],["notifications","💬 הודעות"],["polls","🗳️ סקר"],["gallery","📸 תמונות מהמשחק"],["archive","📊 ארכיון"],["settings","⚙️ הגדרות"]];

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}bb)`, padding: "18px 16px 14px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        <div style={{ fontSize: 32 }}>🔐</div>
        <h2 style={{ color: "white", fontSize: 16, fontWeight: 700, margin: "4px 0 0" }}>פאנל מנהל</h2>
      </div>
      <div style={{ display: "flex", overflowX: "auto", background: "white", borderBottom: "2px solid #e2e8f0" }}>
        {tabs.map(([key, label]) => (
          <button key={key} onClick={(e) => { setTab(key); e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }}
            style={{ padding: "10px 11px", border: "none", background: "transparent", color: tab === key ? pc : "#64748b", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap", fontWeight: tab === key ? 700 : 500, borderBottom: tab === key ? `3px solid ${sc}` : "3px solid transparent" }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ padding: 16 }}>
        {tab === "attendance" && <AdminAttendance {...props} />}
        {tab === "events" && <AdminEvents {...props} />}
        {tab === "games" && <AdminGames {...props} />}
        {tab === "players" && <AdminPlayers {...props} />}
        {tab === "notifications" && <AdminNotifications {...props} players={props.players} playerProfiles={props.playerProfiles} />}
        {tab === "polls" && <AdminPolls {...props} />}
        {tab === "gallery" && <AdminGallery {...props} />}
        {tab === "archive" && <ArchiveStats {...props} />}
        {tab === "settings" && <AdminSettings {...props} />}
      </div>
    </div>
  );
}

// ── ADMIN ATTENDANCE ──────────────────────────────────────────────────────────
function AdminAttendance({ players, events, attendance, playerProfiles, upd, pc, sc, askConfirm }) {
  const [attModal, setAttModal] = useState(null);
  const nextEvent = getNextEvent(events);

  // Birthday reminders for admin
  const birthdaysToday = players.filter(p => isBirthdayToday((playerProfiles[p.id] || {}).birthday));
  const birthdaysTomorrow = players.filter(p => isBirthdayTomorrow((playerProfiles[p.id] || {}).birthday));

  const BirthdayBanners = () => (
    <>
      {birthdaysTomorrow.length > 0 && (
        <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "1px solid #fcd34d", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>🎂</span>
          <div>
            <div style={{ fontWeight: 800, color: "#92400e", fontSize: 14 }}>תזכורת: יום הולדת מחר!</div>
            <div style={{ fontSize: 13, color: "#a16207", fontWeight: 600 }}>{birthdaysTomorrow.map(p => p.name).join(", ")} — אל תשכחי לברך 🎉</div>
          </div>
        </div>
      )}
      {birthdaysToday.length > 0 && (
        <div style={{ background: "linear-gradient(135deg, #fce7f3, #fbcfe8)", border: "1px solid #f9a8d4", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 800, color: "#9d174d", fontSize: 14 }}>יום הולדת היום!</div>
            <div style={{ fontSize: 13, color: "#be185d", fontWeight: 600 }}>{birthdaysToday.map(p => p.name).join(", ")} חוגגת היום 🥳</div>
          </div>
        </div>
      )}
    </>
  );

  if (!nextEvent) return (
    <div>
      <BirthdayBanners />
      <Empty icon="📅" text="אין אירוע פתוח כרגע" />
    </div>
  );

  const countAtt = s => s === "pending"
    ? players.filter(p => !attendance[`${nextEvent.id}_${p.id}`]?.status).length
    : players.filter(p => attendance[`${nextEvent.id}_${p.id}`]?.status === s).length;
  const getList = s => s === "pending"
    ? players.filter(p => !attendance[`${nextEvent.id}_${p.id}`]?.status)
    : players.filter(p => attendance[`${nextEvent.id}_${p.id}`]?.status === s);

  function sendWAReminder() {
    const pending = getList("pending");
    // Exact wording requested by captain
    const msg = encodeURIComponent("היי, ראיתי שלא סימנת הגעה לאימון/משחק למחר. את מתכוונת להגיע?");
    let sent = 0;
    pending.forEach(p => {
      const prof = playerProfiles[p.id] || {};
      const wa = (prof.whatsapp || "").replace(/\D/g, "");
      if (wa) { window.open(`https://wa.me/${wa}?text=${msg}`, "_blank"); sent++; }
    });
    if (sent === 0) alert("אין מספרי וואטסאפ לשחקניות שטרם ענו. הוסיפי אותם בלשונית שחקניות.");
  }

  return (
    <div>
      <BirthdayBanners />
      <div style={S.card}>
        <div style={{ fontWeight: 700, color: pc, fontSize: 13 }}>{nextEvent.type === "training" ? "🏋️ אימון" : "🏆 משחק"}</div>
        <div style={{ fontWeight: 800, fontSize: 15, margin: "3px 0" }}>{formatDate(nextEvent.date)} • {nextEvent.time}</div>
        <div style={{ color: "#64748b", fontSize: 13 }}>📍 {nextEvent.location}</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        {[["coming","מגיעות","#22c55e"],["notcoming","לא מגיעות","#ef4444"],["pending","טרם ענו","#f5a623"]].map(([s,label,color]) => (
          <button key={s} onClick={() => setAttModal(s)}
            style={{ flex: 1, background: "white", border: `2px solid ${color}30`, borderRadius: 12, padding: "10px 4px", cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{countAtt(s)}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{label}</div>
          </button>
        ))}
      </div>

      {countAtt("pending") > 0 && (
        <button onClick={sendWAReminder}
          style={{ width: "100%", padding: "10px", background: "#25D366", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
          💬 שלח וואטסאפ לשחקניות שלא סימנו הגעה ({countAtt("pending")})
        </button>
      )}
      {countAtt("pending") > 0 && (
        <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 14, fontStyle: "italic" }}>
          הטקסט: "היי, ראיתי שלא סימנת הגעה לאימון/משחק למחר. את מתכוונת להגיע?"
        </div>
      )}

      {/* Read-only list */}
      {players.map(p => {
        const prof = playerProfiles[p.id] || {};
        const rec = attendance[`${nextEvent.id}_${p.id}`];
        const status = rec?.status;
        return (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "white", borderRadius: 10, padding: "10px 12px", marginBottom: 8, border: "1px solid #e2e8f0" }}>
            {prof.photo ? <img src={prof.photo} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
              : <div style={{ width: 36, height: 36, borderRadius: "50%", background: pc, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{p.name[0]}</div>}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              {rec?.note && <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic" }}>"{rec.note}"</div>}
            </div>
            <div style={{ fontSize: 18 }}>
              {status === "coming" ? "✅" : status === "notcoming" ? "❌" : <span style={{ color: "#94a3b8", fontSize: 13 }}>טרם ענתה</span>}
            </div>
          </div>
        );
      })}

      {attModal && (
        <AttModal
          title={attModal === "coming" ? "✅ מגיעות" : attModal === "notcoming" ? "❌ לא מגיעות" : "⏳ טרם ענו"}
          list={getList(attModal)} players={players.map(p => ({ ...p, ...(playerProfiles[p.id] || {}) }))}
          attendance={attendance} eventId={nextEvent.id}
          onClose={() => setAttModal(null)} pc={pc} sc={sc} />
      )}
    </div>
  );
}

// ── ADMIN EVENTS ──────────────────────────────────────────────────────────────
function AdminEvents({ events, settings, attendance, archive, notifications, upd, pc, sc, askConfirm }) {
  const [adding, setAdding] = useState(false);
  const [newEv, setNewEv] = useState({ type: "training", date: "", time: "19:00", location: settings.defaultTrainingLocation, note: "", open: true });

  async function addEvent() {
    if (!newEv.date) return;
    await upd.events([...events, { ...newEv, id: Date.now() }]);
    setAdding(false);
    setNewEv({ type: "training", date: "", time: "19:00", location: settings.defaultTrainingLocation, note: "", open: true });
  }

  const [archiveDialog, setArchiveDialog] = useState(null); // האירוע שממתין לאישור ארכוב
  const [verified, setVerified] = useState(false);

  async function lockToArchive(ev) {
    const attData = Object.entries(attendance).filter(([k]) => k.startsWith(`${ev.id}_`)).map(([k, v]) => ({ playerId: parseInt(k.split("_")[1]), ...v }));
    await upd.archive([...archive, { ...ev, archivedAt: new Date().toISOString(), verified: true, verifiedBy: auth.currentUser?.email || "מנהל/ת", attendanceData: attData }]);
    await upd.events(events.filter(e => e.id !== ev.id));
  }

  function openArchiveDialog(ev) { setVerified(false); setArchiveDialog(ev); }
  async function confirmArchiveDialog() {
    const ev = archiveDialog;
    setArchiveDialog(null);
    if (ev) await lockToArchive(ev);
  }

  // ── ביטול אימון/משחק ──
  const [cancelDialog, setCancelDialog] = useState(null); // האירוע שממתין לאישור ביטול
  const [cancelNote, setCancelNote] = useState("");
  const [waShare, setWaShare] = useState(null); // טקסט הביטול לשיתוף בוואטסאפ
  const [waCopied, setWaCopied] = useState(false);

  const cancelText = (ev, note) => `❌ בוטל: ${ev.type === "training" ? "אימון" : "משחק"} · ${formatDate(ev.date)} · ${ev.time}${note && note.trim() ? `\n${note.trim()}` : ""}`;

  function openCancelDialog(ev) { setCancelNote(""); setCancelDialog(ev); }

  async function confirmCancel() {
    const ev = cancelDialog;
    setCancelDialog(null);
    if (!ev) return;
    const txt = cancelText(ev, cancelNote);
    // 1) סימון האירוע כבוטל (יורד מהבאנר בדף הבית כי open:false)
    await upd.events(events.map(e => e.id === ev.id ? { ...e, cancelled: true, open: false } : e));
    // 2) הודעת ביטול בדף הבית (קדימות אדומה, תוקף עד סוף יום האירוע)
    const notif = { id: Date.now(), type: "cancel", text: txt, active: true, createdAt: new Date().toISOString(), expiresOn: ev.date, eventId: ev.id };
    await upd.notifications([...(notifications || []), notif]);
    // 3) שיתוף ידני לוואטסאפ
    setWaCopied(false);
    setWaShare(txt);
  }

  async function undoCancel(ev) {
    await upd.events(events.map(e => e.id === ev.id ? { ...e, cancelled: false, open: true } : e));
    await upd.notifications((notifications || []).filter(n => !(n.type === "cancel" && n.eventId === ev.id)));
  }

  async function shareCancelWA(txt) {
    try { await navigator.clipboard.writeText(txt); setWaCopied(true); } catch (e) { setWaCopied(false); }
    const link = settings && settings.whatsappGroup ? settings.whatsappGroup : "";
    if (link) setTimeout(() => window.open(link, "_blank"), 300);
    else alert("לא הוגדר קישור לקבוצת וואטסאפ. אפשר להוסיף בהגדרות.");
  }

  // אירועים שתאריכם עבר (מהיום שאחרי האירוע) וטרם אורכבו
  const pastEvents = [...events].filter(e => e.date < todayStr()).sort((a, b) => a.date.localeCompare(b.date));

  // ארכוב כל האירועים שעברו בלחיצה אחת — כתיבה אחת לכל מערך (ללא מצבי מרוץ)
  async function archiveAllPast() {
    const today = todayStr();
    const past = events.filter(e => e.date < today);
    if (past.length === 0) return;
    const by = auth.currentUser?.email || "מנהל/ת";
    const newEntries = past.map(ev => {
      const attData = Object.entries(attendance).filter(([k]) => k.startsWith(`${ev.id}_`)).map(([k, v]) => ({ playerId: parseInt(k.split("_")[1]), ...v }));
      return { ...ev, archivedAt: new Date().toISOString(), verified: true, verifiedBy: by, attendanceData: attData };
    });
    await upd.archive([...archive, ...newEntries]);
    await upd.events(events.filter(e => e.date >= today));
  }

  return (
    <div>
      {archiveDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 18, maxWidth: 340, width: "100%", boxSizing: "border-box", boxShadow: "0 8px 30px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", marginBottom: 4 }}>ארכוב אירוע</div>
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 16 }}>{archiveDialog.type === "training" ? "🏋️ אימון" : "🏆 משחק"} · {formatDate(archiveDialog.date)} · {archiveDialog.time}</div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 12, cursor: "pointer", marginBottom: 8 }}>
              <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} style={{ width: 20, height: 20, accentColor: "#16a34a", cursor: "pointer", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: "#92400e", fontWeight: 600, lineHeight: 1.4 }}>אימתתי את נתוני ההגעה של השחקניות לאירוע זה</span>
            </label>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 16 }}>חובה לסמן — הנתונים נכנסים לסטטיסטיקה האישית של השחקניות.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button disabled={!verified} onClick={confirmArchiveDialog}
                style={{ flex: 1, padding: 12, background: verified ? pc : "#cbd5e1", color: "white", border: "none", borderRadius: 10, cursor: verified ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 800 }}>🔒 ארכב</button>
              <button onClick={() => setArchiveDialog(null)}
                style={{ flex: 1, padding: 12, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14 }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* דיאלוג אישור ביטול אימון/משחק */}
      {cancelDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 24, maxWidth: 340, width: "100%", boxSizing: "border-box", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>⚠️</div>
            <p style={{ fontSize: 17, fontWeight: 800, color: "#1e293b", margin: "0 0 6px" }}>לבטל את ה{cancelDialog.type === "training" ? "אימון" : "משחק"}?</p>
            <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>{formatDate(cancelDialog.date)} · {cancelDialog.time}</p>
            <textarea value={cancelNote} onChange={e => setCancelNote(e.target.value)} rows={2} placeholder="סיבה / הערה (אופציונלי) — למשל: בגלל גשם"
              style={{ ...S.input, resize: "none", textAlign: "right", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setCancelDialog(null)} style={{ flex: 1, padding: 12, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>חזרה</button>
              <button onClick={confirmCancel} style={{ flex: 1.3, padding: 12, background: "#ef4444", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 800 }}>❌ כן, בטלי</button>
            </div>
          </div>
        </div>
      )}

      {/* שיתוף ידני לוואטסאפ אחרי ביטול */}
      {waShare && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 24, maxWidth: 340, width: "100%", boxSizing: "border-box", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📲</div>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", margin: "0 0 6px" }}>שליחת הביטול לקבוצת הוואטסאפ</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px" }}>הטקסט יועתק ותיפתח הקבוצה. הדביקי (הקשה ארוכה ← הדבק) ושלחי.</p>
            <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "8px 12px", margin: "0 0 14px", fontSize: 13, color: "#1e293b", fontWeight: 600, whiteSpace: "pre-wrap", textAlign: "right" }}>{waShare}</div>
            {waCopied && <p style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, margin: "0 0 12px" }}>✓ הטקסט הועתק</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setWaShare(null)} style={{ flex: 1, padding: 12, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>סגור</button>
              <button onClick={() => shareCancelWA(waShare)} style={{ flex: 1.4, padding: 12, background: "#25D366", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 800 }}>📋 העתק ופתח קבוצה</button>
            </div>
          </div>
        </div>
      )}

      {pastEvents.length > 0 && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#92400e", marginBottom: 4 }}>⚠️ {pastEvents.length === 1 ? "אירוע שעבר וטרם אורכב" : `${pastEvents.length} אירועים שעברו וטרם אורכבו`}</div>
          <div style={{ fontSize: 12, color: "#b45309", marginBottom: 10 }}>נוכחות נכנסת לסטטיסטיקה רק אחרי ארכוב. אפשר לארכב כל אחד בנפרד, או הכל בלחיצה אחת:</div>
          <button onClick={() => askConfirm(`לארכב ${pastEvents.length} אירועים שעברו? הנוכחות שלהם תיכנס לסטטיסטיקה.`, archiveAllPast)}
            style={{ background: "#f59e0b", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>🔒 ארכב הכל ({pastEvents.length})</button>
        </div>
      )}
      <button onClick={() => setAdding(!adding)} style={{ background: pc, color: "white", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontWeight: 700, marginBottom: 14, fontSize: 13 }}>+ אירוע חדש</button>
      {adding && (
        <div style={{ ...S.card, marginBottom: 14 }}>
          <Label>סוג אירוע</Label>
          <select value={newEv.type} onChange={e => { const t = e.target.value; setNewEv({ ...newEv, type: t, location: t === "training" ? settings.defaultTrainingLocation : settings.defaultGameLocation }); }} style={S.select}>
            <option value="training">🏋️ אימון</option>
            <option value="game">🏆 משחק</option>
          </select>
          <Label>תאריך</Label>
          <input type="date" value={newEv.date} min={todayStr()} onChange={e => setNewEv({ ...newEv, date: e.target.value })} style={S.input} />
          <Label>שעה</Label>
          <input type="time" value={newEv.time} onChange={e => setNewEv({ ...newEv, time: e.target.value })} style={S.input} />
          <Label>מיקום</Label>
          <input value={newEv.location} onChange={e => setNewEv({ ...newEv, location: e.target.value })} placeholder="מיקום" style={S.input} />
          <Label>הערה (אופציונלי)</Label>
          <input value={newEv.note} onChange={e => setNewEv({ ...newEv, note: e.target.value })} placeholder="הערה (אופציונלי)" style={S.input} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addEvent} style={{ flex: 1, padding: 10, background: pc, color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>הוסף</button>
            <button onClick={() => setAdding(false)} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer" }}>ביטול</button>
          </div>
        </div>
      )}
      {events.length === 0 && <Empty icon="📅" text="אין אירועים פתוחים" />}
      {events.length > 0 && (
        <div style={{ display: "flex", padding: "0 4px", marginBottom: 6 }}>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>סוג • תאריך • שעה • מיקום</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", width: 80, textAlign: "center" }}>פעולות</div>
        </div>
      )}
      {[...events].sort((a, b) => a.date.localeCompare(b.date)).map(ev => {
        const isPast = ev.date < todayStr();
        return (
        <div key={ev.id} style={{ ...S.card, marginBottom: 10, ...(isPast ? { borderColor: "#fdba74", background: "#fffbeb" } : {}) }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: pc, fontSize: 13 }}>{ev.type === "training" ? "🏋️ אימון" : "🏆 משחק"}</div>
              {isPast && <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309", marginTop: 2 }}>⚠️ עבר — ממתין לארכוב</div>}
              <div style={{ fontWeight: 700, fontSize: 14 }}>{formatDate(ev.date)} • {ev.time}</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>📍 {ev.location}</div>
              {ev.note && <div style={{ color: sc, fontSize: 12, fontWeight: 600 }}>📝 {ev.note}</div>}
              {ev.cancelled && <div style={{ display: "inline-block", background: "#fee2e2", color: "#ef4444", borderRadius: 8, padding: "2px 10px", fontSize: 12, fontWeight: 800, marginTop: 4 }}>❌ בוטל</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              {ev.cancelled
                ? <button onClick={() => undoCancel(ev)}
                    style={{ background: "#dcfce7", color: "#166534", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>↩️ ביטול הביטול</button>
                : <button onClick={() => openCancelDialog(ev)}
                    style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>❌ ביטול</button>}
              <button onClick={() => openArchiveDialog(ev)}
                style={{ background: "#fef3c7", color: "#92400e", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🔒 ארכיון</button>
              <button onClick={() => askConfirm("למחוק אירוע זה?", () => upd.events(events.filter(e => e.id !== ev.id)))}
                style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11 }}>🗑 מחק</button>
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}

// ── ADMIN GAMES ───────────────────────────────────────────────────────────────
function AdminGames({ games, upd, pc, sc, askConfirm }) {
  const [adding, setAdding] = useState(false);
  const [newG, setNewG] = useState({ date: "", time: "18:00", opponent: "", location: "", result: null });
  const [editResult, setEditResult] = useState({});
  const [editOutcome, setEditOutcome] = useState({});
  const [savedId, setSavedId] = useState(null);

  return (
    <div>
      <button onClick={() => setAdding(!adding)} style={{ background: pc, color: "white", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontWeight: 700, marginBottom: 14, fontSize: 13 }}>+ משחק חדש</button>
      {adding && (
        <div style={{ ...S.card, marginBottom: 14 }}>
          <Label>תאריך</Label>
          <input type="date" value={newG.date} min={todayStr()} onChange={e => setNewG({ ...newG, date: e.target.value })} style={S.input} />
          <Label>שעה</Label>
          <input type="time" value={newG.time} onChange={e => setNewG({ ...newG, time: e.target.value })} style={S.input} />
          <Label>שם היריב</Label>
          <input value={newG.opponent} onChange={e => setNewG({ ...newG, opponent: e.target.value })} placeholder="שם הקבוצה היריבה" style={S.input} />
          <Label>מיקום</Label>
          <input value={newG.location} onChange={e => setNewG({ ...newG, location: e.target.value })} placeholder="מיקום" style={S.input} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={async () => { if (!newG.date || !newG.opponent) return; await upd.games([...games, { ...newG, id: Date.now() }]); setAdding(false); setNewG({ date: "", time: "18:00", opponent: "", location: "", result: null }); }}
              style={{ flex: 1, padding: 10, background: pc, color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>הוסף</button>
            <button onClick={() => setAdding(false)} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer" }}>ביטול</button>
          </div>
        </div>
      )}
      {games.length > 0 && (
        <div style={{ display: "flex", padding: "0 4px", marginBottom: 6 }}>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>תאריך • שעה • יריב • מיקום</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>תוצאה</div>
        </div>
      )}
      {[...games].sort((a, b) => a.date.localeCompare(b.date)).map(g => (
        <div key={g.id} style={{ ...S.card, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{formatDate(g.date)} • {g.time}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>נגד: {g.opponent}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>📍 {g.location}</div>
              {g.outcome
                ? <div style={{ marginTop: 4 }}><OutcomeBadge outcome={g.outcome} result={g.result} /></div>
                : g.result && <div style={{ color: pc, fontWeight: 700, marginTop: 3 }}>✅ תוצאה: {g.result}</div>}
            </div>
            <button onClick={() => askConfirm("למחוק משחק זה?", () => upd.games(games.filter(x => x.id !== g.id)))}
              style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, height: "fit-content" }}>🗑</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {[["win", "🟢 ניצחנו", "#16a34a"], ["loss", "🔴 הפסדנו", "#ef4444"], ["draw", "⚪ תיקו", "#64748b"]].map(([val, lbl, c]) => {
              const sel = (editOutcome[g.id] ?? g.outcome) === val;
              return <button key={val} onClick={() => setEditOutcome({ ...editOutcome, [g.id]: val })}
                style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: sel ? `2px solid ${c}` : "2px solid #e2e8f0", background: sel ? `${c}15` : "white", color: sel ? c : "#94a3b8", cursor: "pointer", fontSize: 12, fontWeight: sel ? 800 : 600 }}>{lbl}</button>;
            })}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={editResult[g.id] ?? (g.result || "")} onChange={e => setEditResult({ ...editResult, [g.id]: e.target.value })}
              placeholder="תוצאה (3-1)" style={{ ...S.input, margin: 0, flex: 1 }} />
            <button onClick={async () => { await upd.games(games.map(x => x.id === g.id ? { ...x, result: editResult[g.id] ?? x.result, outcome: editOutcome[g.id] ?? x.outcome } : x)); setEditResult(e => { const n = { ...e }; delete n[g.id]; return n; }); setEditOutcome(e => { const n = { ...e }; delete n[g.id]; return n; }); setSavedId(g.id); setTimeout(() => setSavedId(s => s === g.id ? null : s), 2000); }}
              style={{ background: pc, color: "white", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", fontWeight: 700 }}>שמור</button>
          </div>
          {savedId === g.id && <div style={{ color: "#16a34a", fontSize: 13, fontWeight: 700, marginTop: 8, textAlign: "center" }}>✓ נשמר</div>}
        </div>
      ))}
    </div>
  );
}

// ── ADMIN PLAYERS ─────────────────────────────────────────────────────────────
function AdminPlayers({ players, playerProfiles, upd, pc, sc, askConfirm }) {
  const [newName, setNewName] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [editData, setEditData] = useState({});
  const [resetMsg, setResetMsg] = useState(null);
  const fileRefs = useRef({});

  async function handlePhoto(id, e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const updated = { ...playerProfiles, [id]: { ...(playerProfiles[id] || {}), photo: ev.target.result } };
      await upd.playerProfiles(updated);
    };
    reader.readAsDataURL(file);
  }

  async function resetPassword(p) {
    const prof = playerProfiles[p.id] || {};
    // Reset to default "1234" and force re-setup of personal password on next login
    const updated = { ...playerProfiles, [p.id]: { ...prof, password: "", setupDone: false } };
    await upd.playerProfiles(updated);
    setResetMsg(p.name);
    setTimeout(() => setResetMsg(null), 4000);
  }

  function startEdit(p) {
    const prof = playerProfiles[p.id] || {};
    setExpanded(p.id);
    setEditData({ phone: prof.phone||p.phone||"", email: prof.email||p.email||"", address: prof.address||p.address||"", whatsapp: prof.whatsapp||p.whatsapp||"" });
  }

  async function saveEdit(id) {
    const updated = { ...playerProfiles, [id]: { ...(playerProfiles[id]||{}), ...editData } };
    await upd.playerProfiles(updated);
    setExpanded(null);
  }

  return (
    <div>
      {resetMsg && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#ea580c", fontWeight: 600 }}>
          🔑 הסיסמה של {resetMsg} אופסה. בכניסה הבאה היא תגדיר סיסמה חדשה (אפשר להיכנס זמנית עם 1234).
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="שם שחקנית חדשה"
          onKeyDown={e => e.key === "Enter" && newName.trim() && (upd.players([...players, { id: Date.now(), name: newName.trim(), phone:"", email:"", address:"", whatsapp:"" }]), setNewName(""))}
          style={{ ...S.input, flex: 1, margin: 0 }} />
        <button onClick={() => { if (newName.trim()) { upd.players([...players, { id: Date.now(), name: newName.trim(), phone:"", email:"", address:"", whatsapp:"" }]); setNewName(""); } }}
          style={{ background: pc, color: "white", border: "none", borderRadius: 8, padding: "0 16px", cursor: "pointer", fontWeight: 700, fontSize: 18 }}>+</button>
      </div>
      {players.map(p => {
        const prof = playerProfiles[p.id] || {};
        return (
          <div key={p.id} style={{ ...S.card, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", cursor: "pointer", flexShrink: 0 }} onClick={() => fileRefs.current[p.id]?.click()}>
                {prof.photo ? <img src={prof.photo} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: `2px solid ${sc}` }} />
                  : <div style={{ width: 44, height: 44, borderRadius: "50%", background: pc, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, border: `2px solid ${sc}` }}>{p.name[0]}</div>}
                <div style={{ position: "absolute", bottom: -1, left: -1, background: sc, borderRadius: "50%", width: 17, height: 17, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>📷</div>
                <input ref={el => fileRefs.current[p.id] = el} type="file" accept="image/*" onChange={e => handlePhoto(p.id, e)} style={{ display: "none" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#1e293b" }}>{p.name}</div>
                <div style={{ display: "flex", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
                  {prof.whatsapp && <button onClick={() => window.open(`https://wa.me/${prof.whatsapp.replace(/\D/g,"")}`, "_blank")} style={{ fontSize: 11, background: "#25D366", color: "white", borderRadius: 6, padding: "2px 7px", border: "none", cursor: "pointer", fontWeight: 600 }}>💬 WA</button>}
                  {prof.email && <button onClick={() => window.open(`mailto:${prof.email}`, "_blank")} style={{ fontSize: 11, background: `${pc}20`, color: pc, borderRadius: 6, padding: "2px 7px", border: "none", cursor: "pointer", fontWeight: 600 }}>✉️ מייל</button>}
                  {prof.phone && <button onClick={() => window.open(`tel:${prof.phone}`, "_blank")} style={{ fontSize: 11, background: "#f1f5f9", color: "#374151", borderRadius: 6, padding: "2px 7px", border: "none", cursor: "pointer", fontWeight: 600 }}>📞 {prof.phone}</button>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <button onClick={() => askConfirm(`לאפס את הסיסמה של ${p.name}? היא תתבקש להגדיר סיסמה חדשה בכניסה הבאה (סיסמה זמנית: 1234).`, () => resetPassword(p))}
                  style={{ background: "#fff7ed", color: "#ea580c", border: "none", borderRadius: 7, padding: "6px 9px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🔑</button>
                <button onClick={() => expanded === p.id ? setExpanded(null) : startEdit(p)}
                  style={{ background: `${pc}15`, color: pc, border: "none", borderRadius: 7, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️</button>
                <button onClick={() => askConfirm(`למחוק את ${p.name}?`, () => upd.players(players.filter(x => x.id !== p.id)))}
                  style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 7, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>🗑</button>
              </div>
            </div>
            {expanded === p.id && (
              <div style={{ marginTop: 12, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                <Label>📞 טלפון</Label>
                <input value={editData.phone||""} onChange={e => {
                  const val = e.target.value;
                  const digits = val.replace(/\D/g, "");
                  const wa = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
                  setEditData({ ...editData, phone: val, whatsapp: wa });
                }} style={{ ...S.input, marginBottom: 8 }} />
                <Label>💬 וואטסאפ (קוד מדינה) - ממולא אוטומטית</Label>
                <input value={editData.whatsapp||""} onChange={e => setEditData({...editData, whatsapp: e.target.value})} style={{ ...S.input, marginBottom: 8 }} />
                <Label>✉️ מייל</Label>
                <input value={editData.email||""} onChange={e => setEditData({...editData, email: e.target.value})} style={{ ...S.input, marginBottom: 8 }} />
                <Label>🏠 כתובת</Label>
                <input value={editData.address||""} onChange={e => setEditData({...editData, address: e.target.value})} style={{ ...S.input, marginBottom: 8 }} />
                {prof.birthday && (
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>🎂 יום הולדת: {formatShort(prof.birthday)}{ageFromBirthday(prof.birthday) != null ? ` (גיל ${ageFromBirthday(prof.birthday)})` : ""}</div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => saveEdit(p.id)} style={{ flex: 1, padding: 10, background: pc, color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>שמור</button>
                  <button onClick={() => setExpanded(null)} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer" }}>ביטול</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ADMIN NOTIFICATIONS ───────────────────────────────────────────────────────
function AdminNotifications({ notifications, players, playerProfiles, events, settings, upd, pc, sc, askConfirm }) {
  const [type, setType] = useState("general");
  const [text, setText] = useState("");
  const [showWAConfirm, setShowWAConfirm] = useState(null);
  const [copied, setCopied] = useState(false);

  async function addNotif() {
    if (!text.trim()) return;
    const notif = { id: Date.now(), type, text: text.trim(), active: true, createdAt: new Date().toISOString() };
    // ביטול: שומר את תאריך האירוע הקרוב כדי שההודעה תיעלם בסוף יום האירוע
    if (type === "cancel") {
      const ev = getNextEvent(events || []);
      notif.expiresOn = ev ? ev.date : todayStr();
    }
    await upd.notifications([...notifications, notif]);
    setText("");
    // ביטול → דיאלוג שיתוף לקבוצת הוואטסאפ
    if (type === "cancel") { setCopied(false); setShowWAConfirm(notif.text); }
  }

  async function shareCancelWA(msgText) {
    const fullMsg = `❌ הודעת ביטול 🏐\n${msgText}`;
    try { await navigator.clipboard.writeText(fullMsg); setCopied(true); } catch (e) { setCopied(false); }
    const link = (settings && settings.whatsappGroup) ? settings.whatsappGroup : "";
    if (link) setTimeout(() => window.open(link, "_blank"), 300);
    else alert("לא הוגדר קישור לקבוצת וואטסאפ. אפשר להוסיף בהגדרות.");
  }

  async function toggleNotif(id) {
    await upd.notifications(notifications.map(n => n.id === id ? { ...n, active: !n.active } : n));
  }

  async function editNotif(id, newText) {
    await upd.notifications(notifications.map(n => n.id === id ? { ...n, text: newText } : n));
  }

  const typeLabel = { coach: "📢 הודעת מאמן", cancel: "❌ ביטול", general: "💬 עדכון כללי" };
  const typeColor = { coach: sc, cancel: "#ef4444", general: pc };

  return (
    <div>
      {/* WhatsApp share after cancel notification — copy text + open group, manual send */}
      {showWAConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 24, maxWidth: 320, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📲</div>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 6 }}>שליחת הודעת הביטול לקבוצה</p>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>הטקסט יועתק ותיפתח קבוצת הוואטסאפ. הדביקי (הקשה ארוכה ← הדבק) ושלחי.</p>
            <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "8px 12px", margin: "8px 0 16px", fontSize: 13, color: "#1e293b", fontWeight: 600 }}>❌ הודעת ביטול 🏐<br />{showWAConfirm}</div>
            {copied && <p style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, margin: "0 0 12px" }}>✓ הטקסט הועתק</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowWAConfirm(null)} style={{ flex: 1, padding: 12, background: "#f1f5f9", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, color: "#64748b" }}>סגור</button>
              <button onClick={() => shareCancelWA(showWAConfirm)} style={{ flex: 1.4, padding: 12, background: "#25D366", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 800, color: "white" }}>📋 העתק ופתח קבוצה</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.card}>
        <Label>סוג הודעה</Label>
        <select value={type} onChange={e => setType(e.target.value)} style={S.select}>
          <option value="general">💬 עדכון כללי</option>
          <option value="coach">📢 הודעת מאמן</option>
        </select>
        <Label>תוכן ההודעה</Label>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="כתבי את ההודעה כאן..."
          style={{ ...S.input, resize: "none" }} />
        <button onClick={addNotif} style={{ width: "100%", padding: 12, background: pc, color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>
          📤 פרסם הודעה
        </button>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: pc, marginBottom: 10 }}>הודעות פעילות</h3>
      {notifications.length === 0 && <Empty icon="📭" text="אין הודעות עדיין" />}
      {[...notifications].reverse().map(n => (
        <NotifCard key={n.id} notif={n} typeLabel={typeLabel} typeColor={typeColor} onToggle={() => toggleNotif(n.id)}
          onEdit={newText => editNotif(n.id, newText)}
          onDelete={() => askConfirm("למחוק הודעה זו?", () => upd.notifications(notifications.filter(x => x.id !== n.id)))}
          pc={pc} sc={sc} />
      ))}
    </div>
  );
}

function NotifCard({ notif, typeLabel, typeColor, onToggle, onEdit, onDelete, pc }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(notif.text);
  const color = typeColor[notif.type] || pc;

  return (
    <div style={{ ...S.card, marginBottom: 10, borderRight: `4px solid ${color}`, opacity: notif.active ? 1 : 0.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color }}>{typeLabel[notif.type]}</div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(notif.createdAt).toLocaleDateString("he-IL")}</div>
      </div>
      {editing ? (
        <div>
          <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2} style={{ ...S.input, resize: "none", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 6, marginBottom: 0 }}>
            <button onClick={() => { onEdit(editText); setEditing(false); }} style={{ flex: 1, padding: 8, background: pc, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>שמור</button>
            <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 8, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12 }}>ביטול</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.5, marginBottom: 10 }}>{notif.text}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onToggle} style={{ padding: "5px 10px", background: notif.active ? "#fef3c7" : "#f0fdf4", color: notif.active ? "#92400e" : "#16a34a", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
              {notif.active ? "🔇 השהה" : "🔔 הפעל"}
            </button>
            <button onClick={() => setEditing(true)} style={{ padding: "5px 10px", background: `${pc}15`, color: pc, border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✏️ ערוך</button>
            <button onClick={onDelete} style={{ padding: "5px 10px", background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11 }}>🗑 מחק</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── ADMIN POLLS ───────────────────────────────────────────────────────────────
function AdminPolls({ polls, players, playerProfiles, upd, pc, sc, askConfirm }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  function setOpt(i, val) {
    setOptions(opts => opts.map((o, idx) => idx === i ? val : o));
  }
  function addOpt() { if (options.length < 4) setOptions([...options, ""]); }
  function removeOpt(i) { if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i)); }

  async function createPoll() {
    const clean = options.map(o => o.trim()).filter(Boolean);
    if (!question.trim() || clean.length < 2) return;
    const poll = { id: Date.now(), question: question.trim(), options: clean, votes: {}, active: true, createdAt: new Date().toISOString() };
    await upd.polls([...(polls || []), poll]);
    setQuestion(""); setOptions(["", ""]);
  }

  async function toggleActive(id) {
    await upd.polls(polls.map(p => p.id === id ? { ...p, active: p.active === false ? true : false } : p));
  }

  const sorted = [...(polls || [])].reverse();

  return (
    <div>
      {/* Create poll */}
      <div style={S.card}>
        <Label>שאלת הסקר</Label>
        <input value={question} onChange={e => setQuestion(e.target.value)} placeholder='למשל: "איפה נחגוג סוף עונה?"' style={S.input} />
        <Label>אפשרויות (2-4)</Label>
        {options.map((opt, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input value={opt} onChange={e => setOpt(i, e.target.value)} placeholder={`אפשרות ${i + 1}`} style={{ ...S.input, margin: 0, flex: 1 }} />
            {options.length > 2 && (
              <button onClick={() => removeOpt(i)} style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 8, padding: "0 12px", cursor: "pointer", fontSize: 16 }}>×</button>
            )}
          </div>
        ))}
        {options.length < 4 && (
          <button onClick={addOpt} style={{ background: `${pc}12`, color: pc, border: `1px dashed ${pc}55`, borderRadius: 8, padding: "8px", cursor: "pointer", fontSize: 13, fontWeight: 600, width: "100%", marginBottom: 10 }}>+ הוסף אפשרות</button>
        )}
        <button onClick={createPoll} style={{ width: "100%", padding: 12, background: pc, color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>
          🗳️ צור סקר
        </button>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: pc, marginBottom: 10 }}>סקרים קיימים</h3>
      {sorted.length === 0 && <Empty icon="🗳️" text="עדיין לא יצרת סקרים" />}
      {sorted.map(poll => {
        const votes = poll.votes || {};
        const total = Object.keys(votes).length;
        const counts = poll.options.map((_, i) => Object.values(votes).filter(v => v === i).length);
        const maxCount = Math.max(0, ...counts);
        return (
          <div key={poll.id} style={{ ...S.card, marginBottom: 10, opacity: poll.active === false ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b" }}>{poll.question}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>{total} הצביעו</div>
            </div>
            {poll.options.map((opt, i) => {
              const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
              const isWinner = total > 0 && counts[i] === maxCount;
              return (
                <div key={i} style={{ position: "relative", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", marginBottom: 6, overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: `${pct}%`, background: isWinner ? `${sc}55` : "#f1f5f9", zIndex: 0 }} />
                  <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: isWinner ? 800 : 600, color: "#1e293b" }}>{isWinner && total > 0 ? "🏆 " : ""}{opt}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pc }}>{pct}% ({counts[i]})</span>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={() => toggleActive(poll.id)} style={{ padding: "5px 10px", background: poll.active === false ? "#f0fdf4" : "#fef3c7", color: poll.active === false ? "#16a34a" : "#92400e", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                {poll.active === false ? "🔔 הפעל" : "🔇 סגור סקר"}
              </button>
              <button onClick={() => askConfirm("למחוק סקר זה?", () => upd.polls(polls.filter(p => p.id !== poll.id)))} style={{ padding: "5px 10px", background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11 }}>🗑 מחק</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ARCHIVE & STATS ───────────────────────────────────────────────────────────
function ArchiveStats({ archive, players, playerProfiles, pc, sc }) {
  const [view, setView] = useState("stats"); // "stats" | "table"
  const [exporting, setExporting] = useState(false);
  const total = archive.length;
  const stats = players.map(p => {
    const attended = archive.filter(ev => ev.attendanceData?.find(a => a.playerId === p.id && a.status === "coming")).length;
    return { ...p, ...(playerProfiles[p.id]||{}), attended, pct: total > 0 ? Math.round((attended / total) * 100) : 0 };
  }).sort((a, b) => b.pct - a.pct);
  const avg = stats.length ? Math.round(stats.reduce((s, p) => s + p.pct, 0) / stats.length) : 0;

  // Column totals - how many came per event
  const colTotals = archive.map(ev =>
    ev.attendanceData?.filter(a => a.status === "coming").length || 0
  );

  // ייצוא לאקסל — שני גיליונות (נוכחות + סיכום) מעוצבים, RTL, עם נוסחאות אמיתיות. ExcelJS נטען רק בלחיצה.
  async function exportToExcel() {
    if (archive.length === 0) return;
    setExporting(true);
    try {
      const mod = await import("exceljs");
      const ExcelJS = mod.default || mod;
      const evs = [...archive].sort((a, b) => a.date.localeCompare(b.date));
      const N = evs.length, P = players.length;
      const dm = d => { const x = new Date(d + "T12:00:00"); return x.getDate() + "/" + (x.getMonth() + 1); };
      const cameSet = evs.map(e => new Set((e.attendanceData || []).filter(a => a.status === "coming").map(a => a.playerId)));
      const colLetter = n => { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

      const TH = { style: "thin", color: { argb: "FFBFBFBF" } };
      const BORDER = { top: TH, left: TH, right: TH, bottom: TH };
      const pfill = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
      const HEAD = { font: { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } }, fill: pfill("FF2F5496"), alignment: { horizontal: "center", vertical: "center" }, border: BORDER };
      const TYPE = { font: { name: "Arial", size: 9, bold: true, color: { argb: "FF1F4E78" } }, fill: pfill("FFDDEBF7"), alignment: { horizontal: "center", vertical: "center" }, border: BORDER };
      const NAME = { font: { name: "Arial", size: 11, bold: true }, fill: pfill("FFF2F2F2"), alignment: { horizontal: "right", vertical: "center" }, border: BORDER };
      const CHECK = { font: { name: "Arial", size: 11, bold: true, color: { argb: "FF006100" } }, fill: pfill("FFC6EFCE"), alignment: { horizontal: "center", vertical: "center" }, border: BORDER };
      const EMPTY = { font: { name: "Arial", size: 11 }, alignment: { horizontal: "center", vertical: "center" }, border: BORDER };
      const TOTAL = { font: { name: "Arial", size: 11, bold: true }, fill: pfill("FFE2EFDA"), alignment: { horizontal: "center", vertical: "center" }, border: BORDER };
      const apply = (cell, st) => Object.assign(cell, st);

      const wb = new ExcelJS.Workbook();

      // גיליון 1 — נוכחות
      const ws = wb.addWorksheet("נוכחות", { views: [{ rightToLeft: true, state: "frozen", xSplit: 1, ySplit: 2 }] });
      const totalCol = N + 2, pctCol = N + 3;
      const r1 = ws.getRow(1); r1.height = 18;
      apply(r1.getCell(1), HEAD); r1.getCell(1).value = "סוג";
      evs.forEach((e, i) => { const c = r1.getCell(2 + i); c.value = e.type === "training" ? "אימון" : "משחק"; apply(c, TYPE); });
      const r2 = ws.getRow(2); r2.height = 19.5;
      apply(r2.getCell(1), HEAD); r2.getCell(1).value = "שחקנית \\ תאריך";
      evs.forEach((e, i) => { const c = r2.getCell(2 + i); c.value = dm(e.date); apply(c, HEAD); });
      apply(r2.getCell(totalCol), HEAD); r2.getCell(totalCol).value = 'סה"כ';
      apply(r2.getCell(pctCol), HEAD); r2.getCell(pctCol).value = "אחוז";
      players.forEach((p, pi) => {
        const rr = 3 + pi, row = ws.getRow(rr);
        apply(row.getCell(1), NAME); row.getCell(1).value = p.name;
        evs.forEach((e, i) => { const c = row.getCell(2 + i); if (cameSet[i].has(p.id)) { c.value = "✓"; apply(c, CHECK); } else apply(c, EMPTY); });
        const tc = row.getCell(totalCol); tc.value = { formula: `COUNTIF(${colLetter(1)}${rr}:${colLetter(N)}${rr},"✓")` }; apply(tc, TOTAL);
        const pc2 = row.getCell(pctCol); pc2.value = { formula: `${colLetter(totalCol - 1)}${rr}/${N}` }; apply(pc2, TOTAL); pc2.numFmt = "0%";
      });
      const trr = 3 + P, trow = ws.getRow(trr);
      apply(trow.getCell(1), HEAD); trow.getCell(1).value = 'סה"כ נוכחות';
      for (let i = 0; i < N; i++) { const c = trow.getCell(2 + i), cl = colLetter(1 + i); c.value = { formula: `COUNTIF(${cl}3:${cl}${2 + P},"✓")` }; apply(c, TOTAL); }
      const gc = trow.getCell(totalCol); gc.value = { formula: `SUM(${colLetter(totalCol - 1)}3:${colLetter(totalCol - 1)}${2 + P})` }; apply(gc, TOTAL);
      ws.getColumn(1).width = 16;
      for (let i = 0; i < N; i++) ws.getColumn(2 + i).width = 6.6;
      ws.getColumn(totalCol).width = 7; ws.getColumn(pctCol).width = 7;

      // גיליון 2 — סיכום
      const ws2 = wb.addWorksheet("סיכום", { views: [{ rightToLeft: true }] });
      const summary = players.map(p => { let t = 0, g = 0; evs.forEach((e, i) => { if (cameSet[i].has(p.id)) { e.type === "training" ? t++ : g++; } }); return { name: p.name, total: t + g, training: t, game: g }; }).sort((a, b) => b.total - a.total);
      const trainCount = evs.filter(e => e.type === "training").length, gameCount = N - trainCount;
      const h = ws2.getRow(1);
      ["שחקנית", 'סה"כ מפגשים', "אחוז כללי", "מתוכם אימונים", "מתוכם משחקים"].forEach((t, i) => { const c = h.getCell(1 + i); c.value = t; apply(c, HEAD); });
      summary.forEach((s, i) => {
        const rr = 2 + i, row = ws2.getRow(rr);
        apply(row.getCell(1), NAME); row.getCell(1).value = s.name;
        const b = row.getCell(2); b.value = s.total; apply(b, TOTAL);
        const c = row.getCell(3); c.value = { formula: `B${rr}/${N}` }; apply(c, TOTAL); c.numFmt = "0%";
        const d = row.getCell(4); d.value = s.training; apply(d, TOTAL);
        const e = row.getCell(5); e.value = s.game; apply(e, TOTAL);
      });
      const fc = ws2.getRow(2 + summary.length + 1).getCell(1);
      fc.value = `סה"כ מפגשים: ${N}  |  אימונים: ${trainCount}  |  משחקים: ${gameCount}`;
      fc.font = { name: "Arial", size: 11, bold: true };
      ws2.getColumn(1).width = 14; ws2.getColumn(2).width = 12; ws2.getColumn(3).width = 12; ws2.getColumn(4).width = 16; ws2.getColumn(5).width = 16;

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `נוכחות_שחקניות_${todayStr()}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Excel export error:", e);
      alert("שגיאה בייצוא הקובץ. נסה שוב.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, ...S.card, textAlign: "center", margin: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: pc }}>{total}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>אירועים</div>
        </div>
        <div style={{ flex: 1, ...S.card, textAlign: "center", margin: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#22c55e" }}>{avg}%</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>הגעה ממוצעת</div>
        </div>
      </div>

      {/* Export to Excel */}
      <button onClick={exportToExcel} disabled={exporting || archive.length === 0}
        style={{ width: "100%", padding: "11px", marginBottom: 12, background: archive.length === 0 ? "#cbd5e1" : "#16a34a", color: "white", border: "none", borderRadius: 10, cursor: (exporting || archive.length === 0) ? "default" : "pointer", fontWeight: 700, fontSize: 13 }}>
        {exporting ? "מייצא..." : "📥 ייצוא לאקסל"}
      </button>

      {/* View toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setView("stats")}
          style={{ flex: 1, padding: "9px", background: view === "stats" ? pc : "white", color: view === "stats" ? "white" : pc, border: `2px solid ${pc}`, borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          📊 דירוג שחקניות
        </button>
        <button onClick={() => setView("table")}
          style={{ flex: 1, padding: "9px", background: view === "table" ? pc : "white", color: view === "table" ? "white" : pc, border: `2px solid ${pc}`, borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          📅 טבלת נוכחות
        </button>
      </div>


      {/* Stats view */}
      {view === "stats" && (
        <div>
          {stats.map((p, i) => (
            <div key={p.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: i < 3 ? sc : "#f1f5f9", color: i < 3 ? pc : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{i + 1}</div>
              {p.photo ? <img src={p.photo} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 36, height: 36, borderRadius: "50%", background: pc, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{p.name[0]}</div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <div style={{ flex: 1, height: 7, background: "#e2e8f0", borderRadius: 4 }}>
                    <div style={{ width: `${p.pct}%`, height: "100%", background: p.pct >= 80 ? "#22c55e" : p.pct >= 50 ? sc : "#ef4444", borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: pc, minWidth: 38 }}>{p.pct}%</span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.attended} מתוך {total} אירועים</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table view */}
      {view === "table" && (
        archive.length === 0
          ? <Empty icon="📁" text="אין אירועים בארכיון עדיין" />
          : (
            <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 16px rgba(26,35,126,0.12)", border: `2px solid ${pc}20` }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, direction: "rtl" }}>
                  <thead>
                    {/* Header row - dates */}
                    <tr>
                      <th style={{ padding: "10px 12px", background: pc, color: "white", textAlign: "right", whiteSpace: "nowrap", position: "sticky", right: 0, zIndex: 2, fontSize: 13, fontWeight: 800, minWidth: 80 }}>
                        שחקנית
                      </th>
                      {archive.map(ev => (
                        <th key={ev.id} style={{ padding: "8px 6px", background: pc, color: sc, textAlign: "center", whiteSpace: "nowrap", minWidth: 52, fontWeight: 700 }}>
                          <div style={{ fontSize: 14 }}>{ev.type === "training" ? "🏋️" : "🏆"}</div>
                          <div style={{ fontSize: 10, color: "white", marginTop: 2 }}>{formatShort(ev.date)}</div>
                        </th>
                      ))}
                      <th style={{ padding: "8px 10px", background: pc, color: sc, textAlign: "center", whiteSpace: "nowrap", fontWeight: 800, fontSize: 13 }}>
                        סה״כ
                      </th>
                      <th style={{ padding: "8px 10px", background: pc, color: sc, textAlign: "center", whiteSpace: "nowrap", fontWeight: 800, fontSize: 13 }}>
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Player rows - sorted by attendance */}
                    {stats.map((p, ri) => (
                      <tr key={p.id} style={{ background: ri % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ padding: "9px 12px", fontWeight: 700, whiteSpace: "nowrap", position: "sticky", right: 0, background: ri % 2 === 0 ? "white" : "#f8fafc", borderLeft: `2px solid ${pc}20`, fontSize: 13, color: "#1e293b" }}>
                          {p.name}
                        </td>
                        {archive.map(ev => {
                          const rec = ev.attendanceData?.find(a => a.playerId === p.id);
                          const came = rec?.status === "coming";
                          const notCame = rec?.status === "notcoming";
                          return (
                            <td key={ev.id} style={{ textAlign: "center", padding: "7px 4px", background: came ? "#f0fdf4" : notCame ? "#fef2f2" : "transparent" }}>
                              <span style={{ fontSize: 15 }}>{came ? "✅" : notCame ? "❌" : <span style={{ color: "#cbd5e1", fontSize: 16 }}>—</span>}</span>
                            </td>
                          );
                        })}
                        {/* Row totals */}
                        <td style={{ textAlign: "center", fontWeight: 800, color: pc, background: `${pc}08`, padding: "7px 8px", fontSize: 13 }}>
                          {p.attended}
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 800, padding: "7px 8px", fontSize: 13, color: p.pct >= 80 ? "#22c55e" : p.pct >= 50 ? "#f59e0b" : "#ef4444", background: p.pct >= 80 ? "#f0fdf4" : p.pct >= 50 ? "#fffbeb" : "#fef2f2" }}>
                          {p.pct}%
                        </td>
                      </tr>
                    ))}
                    {/* Column totals row */}
                    <tr style={{ background: `${pc}10`, borderTop: `2px solid ${pc}30` }}>
                      <td style={{ padding: "9px 12px", fontWeight: 800, position: "sticky", right: 0, background: `${pc}10`, color: pc, fontSize: 12, borderLeft: `2px solid ${pc}20` }}>
                        סה״כ מגיעות
                      </td>
                      {colTotals.map((n, i) => (
                        <td key={i} style={{ textAlign: "center", fontWeight: 800, color: pc, padding: "7px 4px", fontSize: 13 }}>
                          {n}
                        </td>
                      ))}
                      <td style={{ textAlign: "center", fontWeight: 800, color: pc, background: `${pc}15`, padding: "7px 8px", fontSize: 13 }}>
                        {stats.reduce((s, p) => s + p.attended, 0)}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 800, color: "#22c55e", background: "#f0fdf4", padding: "7px 8px", fontSize: 13 }}>
                        {avg}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
      )}
    </div>
  );
}

// ── ADMIN SETTINGS ────────────────────────────────────────────────────────────
function AdminSettings({ settings, upd, pc, sc }) {
  const [s, setS] = useState({ ...settings });

  // Sync if settings change from outside
  useEffect(() => { setS({ ...settings }); }, [settings.primaryColor, settings.secondaryColor]);

  async function handleChange(field, value) {
    const updated = { ...s, [field]: value };
    setS(updated);
    await upd.settings(updated);
  }
  return (
    <div>
      <div style={S.card}>
        <Label>שם הקבוצה</Label>
        <input value={s.teamName} onChange={e => handleChange("teamName", e.target.value)} style={S.input} />
        <Label>טקסט כפתור ברוכות הבאות (הכפתור הצהוב)</Label>
        <input value={s.welcomeText || "ברוכות הבאות לקבוצת הכדורשת שלנו!"} onChange={e => handleChange("welcomeText", e.target.value)} placeholder="ברוכות הבאות לקבוצת הכדורשת שלנו!" style={S.input} />
        <Label>מיקום ברירת מחדל — אימון</Label>
        <input value={s.defaultTrainingLocation} onChange={e => handleChange("defaultTrainingLocation", e.target.value)} style={S.input} />
        <Label>מיקום ברירת מחדל — משחק</Label>
        <input value={s.defaultGameLocation} onChange={e => handleChange("defaultGameLocation", e.target.value)} style={S.input} />
        <Label>קישור קבוצת וואטסאפ (לשליחת הודעות ביטול)</Label>
        <input value={s.whatsappGroup || ""} onChange={e => handleChange("whatsappGroup", e.target.value)} placeholder="https://chat.whatsapp.com/..." style={S.input} />
        <p style={{ fontSize: 11, color: "#94a3b8", margin: "-4px 0 10px" }}>כשתשלחי הודעת "ביטול", הטקסט יועתק ותיפתח הקבוצה — הדביקי ושלחי.</p>
        <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <Label>צבע ראשי</Label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="color" value={s.primaryColor} onChange={e => handleChange("primaryColor", e.target.value)} style={{ width: 42, height: 36, border: "none", borderRadius: 8, cursor: "pointer", padding: 2 }} />
              <input value={s.primaryColor} onChange={e => handleChange("primaryColor", e.target.value)} style={{ ...S.input, margin: 0, flex: 1, fontSize: 12 }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <Label>צבע משני</Label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="color" value={s.secondaryColor} onChange={e => handleChange("secondaryColor", e.target.value)} style={{ width: 42, height: 36, border: "none", borderRadius: 8, cursor: "pointer", padding: 2 }} />
              <input value={s.secondaryColor} onChange={e => handleChange("secondaryColor", e.target.value)} style={{ ...S.input, margin: 0, flex: 1, fontSize: 12 }} />
            </div>
          </div>
        </div>

        {/* Color presets */}
        <Label>צבעים מהירים</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { label: "🔵 ברירת מחדל", primary: "#1a237e", secondary: "#f5c842" },
            { label: "🟢 ירוק", primary: "#1b5e20", secondary: "#ffeb3b" },
            { label: "🔴 אדום", primary: "#b71c1c", secondary: "#ffd54f" },
            { label: "🟣 סגול", primary: "#4a148c", secondary: "#f5c842" },
            { label: "⚫ שחור", primary: "#212121", secondary: "#f5c842" },
          ].map(preset => (
            <button key={preset.label} onClick={() => { handleChange("primaryColor", preset.primary); handleChange("secondaryColor", preset.secondary); setS(prev => ({ ...prev, primaryColor: preset.primary, secondaryColor: preset.secondary })); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, border: `2px solid ${s.primaryColor === preset.primary ? preset.primary : "#e2e8f0"}`, background: s.primaryColor === preset.primary ? `${preset.primary}15` : "white", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              <div style={{ display: "flex", gap: 3 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: preset.primary }} />
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: preset.secondary }} />
              </div>
              {preset.label}
            </button>
          ))}
        </div>
        <Label>סיסמת מנהל</Label>
        <input type="password" value={s.captainPassword} onChange={e => handleChange("captainPassword", e.target.value)} style={S.input} />
        <Label>מסך פתיחה להתקנה</Label>
        <button onClick={async () => {
          const newVer = (s.installVersion || 1) + 1;
          await handleChange("installVersion", newVer);
          await save(KEYS.installVersion, newVer);
        }} style={{ width: "100%", padding: "11px", background: "#1a237e", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
          📲 הצג מסך התקנה לכולם מחדש
        </button>
        <button onClick={() => { localStorage.removeItem("whatsNewSeenVer"); alert("מסך 'מה חדש' יוצג לך שוב בכניסה הבאה. לכל שחקנית הוא יוצג פעם אחת אוטומטית כשמשתחררת גרסה חדשה."); }}
          style={{ width: "100%", padding: "11px", background: "#7c3aed", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
          ✨ הצג שוב את מסך "מה חדש"
        </button>
        <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#16a34a", fontWeight: 600 }}>✅ הגדרות נשמרות אוטומטית</div>
      </div>
    </div>
  );
}

// ── HELP SCREEN ───────────────────────────────────────────────────────────────
function HelpScreen({ pc, sc, settings, onBack }) {
  const sections = [
    { icon: "📲", title: "התקנה על הנייד — מומלץ!", text: "אנדרואיד (Chrome): תפריט ⋮ ← 'הוסף למסך הבית'\nאייפון (Safari): כפתור שיתוף ↑ ← 'הוסף למסך הבית'\nכך האפליקציה תיפתח ישירות ומהר יותר!", featured: true },
    { icon: "👋", title: "כניסה ראשונה", text: "בכניסה הראשונה לחצי על שמך ברשימה. תתבקשי לבחור סיסמה אישית ולהוסיף תמונת פרופיל ופרטי קשר. מהפעם הבאה — רק סיסמה." },
    { icon: "✅", title: "אישור הגעה לאימון", text: "לחצי על שמך במסך הבית, ואז על הכפתור 'מגיעה' או 'לא מגיעה'. ניתן גם להוסיף הערה קצרה. ניתן לשנות תשובה בכל עת לפני האימון." },
    { icon: "👀", title: "מי מגיעה?", text: "לחצי על המספרים (מגיעות / לא מגיעות / טרם ענו) כדי לראות את שמות השחקניות בכל קטגוריה." },
    { icon: "📸", title: "תמונות מהמשחק", text: "בלשונית 'תמונות מהמשחק' ניתן להעלות תמונות מהאימון או המשחק — לחצי על '+ העלי תמונה'. כדי למחוק תמונה שהעלית: לחצי עליה ואז על 'מחקי תמונה'." },
    { icon: "🏆", title: "לוח משחקים", text: "בלשונית 'משחקים' תמצאי את לוח המשחקים העתידיים. לאחר המשחק יוצג גם התוצאה." },
    { icon: "👏", title: "מחיאות כפיים", text: "בלשונית 'אירוע' תוכלי לשלוח 'כל הכבוד' לחברות שהגיעו לאימון או המשחק האחרון — פעם ביום לכל אחת. בפרופיל שלך תראי כמה מחיאות כפיים קיבלת החודש!" },
    { icon: "🗳️", title: "סקר", text: "בלשונית 'סקר' תוכלי להצביע על נושאים שהמנהל פותח (למשל איפה לחגוג סוף עונה). ניתן לשנות את הבחירה, והתוצאות מוצגות מיד." },
    { icon: "🎂", title: "יום הולדת", text: "הוסיפי תאריך לידה בפרופיל, ותקבלי ברכה חמה מהקבוצה ביום ההולדת שלך! 🎉" },
    { icon: "🔑", title: "שכחת סיסמה?", text: "אין בעיה — פני למנהל/ת הקבוצה ויאפסו לך אותה. בכניסה הבאה תתבקשי לבחור סיסמה חדשה." },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "28px 20px 36px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        <div style={{ fontSize: 48 }}>❓</div>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: "8px 0 4px" }}>מדריך שימוש</h2>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: 0 }}>{settings.teamName}</p>
      </div>
      <div style={{ padding: 16 }}>
        {sections.map((sec, i) => (
          <div key={i} style={{ ...S.card, marginBottom: 10, display: "flex", gap: 12, alignItems: "flex-start", ...(sec.featured ? { border: "1px solid #e2e8f0", background: `${pc}08` } : {}) }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{sec.icon}</div>
            <div>
              <div style={{ fontWeight: 700, color: pc, fontSize: sec.featured ? 15 : 14, marginBottom: 4 }}>{sec.title}</div>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-line" }}>{sec.text}</div>
            </div>
          </div>
        ))}
        <div style={{ background: `${sc}30`, borderRadius: 14, padding: 16, textAlign: "center", marginTop: 8 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🏐</div>
          <div style={{ fontSize: 13, color: pc, fontWeight: 600 }}>שאלות? פני למנהל הקבוצה</div>
        </div>
      </div>
    </div>
  );
}

// ── SHARED ────────────────────────────────────────────────────────────────────
// תג תוצאה צבעוני — ניצחון/הפסד/תיקו + ציון אופציונלי
function OutcomeBadge({ outcome, result, size }) {
  const map = { win: { lbl: "ניצחון", c: "#16a34a", bg: "#dcfce7" }, loss: { lbl: "הפסד", c: "#ef4444", bg: "#fee2e2" }, draw: { lbl: "תיקו", c: "#64748b", bg: "#f1f5f9" } };
  const o = map[outcome];
  if (!o) return null;
  return <span style={{ display: "inline-block", background: o.bg, color: o.c, borderRadius: 8, padding: size === "lg" ? "6px 14px" : "3px 10px", fontSize: size === "lg" ? 15 : 13, fontWeight: 800, whiteSpace: "nowrap" }}>{o.lbl}{result ? ` ${result}` : ""}</span>;
}

function Empty({ icon, text }) {
  return <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}><div style={{ fontSize: 48 }}>{icon}</div><p style={{ marginTop: 8 }}>{text}</p></div>;
}
function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>{children}</div>;
}
// כרטיס מתקפל לשימוש חוזר — כותרת לחיצה + מונה אופציונלי + חץ מסתובב
function Collapsible({ title, count, defaultOpen = false, accent = "#1e293b", children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", cursor: "pointer", padding: 14, textAlign: "right" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: accent }}>{title}{typeof count === "number" ? ` (${count})` : ""}</span>
        <span style={{ fontSize: 12, color: "#94a3b8", display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }}>▾</span>
      </button>
      <div className="collapse-grid" style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows 0.28s ease" }}>
        <div style={{ overflow: "hidden" }}>
          <div style={{ padding: "0 14px 14px" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

const S = {
  card: { background: "white", borderRadius: 14, padding: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 12 },
  input: { width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 14, boxSizing: "border-box", direction: "rtl", outline: "none", marginBottom: 10, fontFamily: "inherit" },
  select: { width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 14, boxSizing: "border-box", marginBottom: 10, direction: "rtl" },
};
