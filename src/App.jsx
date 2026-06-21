import { useState, useEffect, useRef } from "react";
import { db, storage, auth, functions } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot, getDocs, collection, query, orderBy, limit, deleteDoc, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from "firebase/auth";

// ── זהות קבוצה ────────────────────────────────────────────────────────────────
// בינלאומי = ברירת המחדל (שחקניות קיימות לא מושפעות). קבוצה אחרת מגיעה דרך ?team=XXXX.
const DEFAULT_TEAM = "bibleumi";
const BIBLEUMI_ADMIN_EMAILS = ["efil59@gmail.com", "miri.levi1962@gmail.com"]; // מנהלי קבוצת הבינלאומי
const SUPER_ADMIN_EMAIL = "efil59@gmail.com"; // בעל המוצר — גישה לסופר אדמין (רק הוא)
// פרטי יצירת קשר למסך "פתיחת קבוצה" (מנהלת חדשה ללא הזמנה). ⚠️ אפי — מלא כאן את מספר הוואטסאפ שלך:
const OWNER_CONTACT_EMAIL = "efil59@gmail.com";
const OWNER_CONTACT_WHATSAPP = ""; // לדוגמה: "972501234567" (קוד מדינה ללא +). ריק = לא יוצג כפתור וואטסאפ.

// האם הגיעה קבוצה מפורשת ב-URL (?team=). אם לא — מציגים דף נחיתה (לא מנחשים מ-localStorage ישן).
let TEAM_FROM_URL = false;
function resolveInitialTeam() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("team");
    if (fromUrl) { TEAM_FROM_URL = true; localStorage.setItem("currentTeamId", fromUrl); return fromUrl; }
  } catch {}
  // אין ?team= → ברירת מחדל זמנית (כדי שקוד תלוי-קבוצה לא יקרוס), אך נציג דף נחיתה.
  return DEFAULT_TEAM;
}
let CURRENT_TEAM = resolveInitialTeam();
function setCurrentTeam(id) {
  CURRENT_TEAM = id;
  TEAM_FROM_URL = true; // ברגע שנבחרה קבוצה (כניסת מנהל/בחירת בינלאומי) — לא דף נחיתה
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
  chat: "chat",
  whatsNewVersion: "whatsNewVersion",
  meta: "meta",
};

const DEFAULT_SETTINGS = {
  teamName: "קבוצת הכדורשת של הבנק הבינלאומי",
  primaryColor: "#1a237e",
  secondaryColor: "#f5c842",
  defaultTrainingLocation: "ביה\"ס מקיף עירוני ט' ת\"א",
  defaultGameLocation: "אולם ספורט עירוני",
  whatsappGroup: "https://chat.whatsapp.com/BQFmLoO8PU4A3kdXSkIJ6U?s=hd&p=i&mlu=3",
  captainPassword: "1234",
};

// "מה חדש" — מתעדכן עם כל גרסה. version עולה ב-1 בכל שחרור פיצ'רים.
const WHATS_NEW = {
  version: 16,
  versionName: "גרסה 16.0",
  date: "יוני 2026",
  features: [
    { icon: "ℹ️", title: "מסך 'אודות' חדש", text: "במסך הבית יש כעת כפתור 'אודות' עם מידע על האפליקציה ומדור שאלות ותשובות (שכחתי סיסמה, איך מסמנים הגעה, ועוד)." },
    { icon: "🔴", title: "התראת צ'אט", text: "כשיש הודעות חדשות בצ'אט שלא קראת — נקודה אדומה מהבהבת ליד לשונית הצ'אט. נכנסים, וההתראה נעלמת." },
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
  } catch (e) { console.error("🔴 Save error [" + key + "] team=" + CURRENT_TEAM + ":", e.code || e.message); }
}

// ── שלב 3+4: פיצול attendance ו-profiles/secrets למסמך-לשחקנית ────────────────
// העיקרון: ה-state בזיכרון נשאר מפה שטוחה זהה (כל הקוראים ממשיכים לעבוד);
// רק שכבת ה-load/save מתרגמת בין המפה השטוחה למסמכים-לשחקנית ב-Firestore.

// attendance: בזיכרון { "eventId_playerId": rec } ↔ Firestore teams/{t}/attendance/{playerId} = { eventId: rec }
function groupAttendanceByPlayer(flat) {
  const byP = {};
  for (const k in (flat || {})) {
    const i = k.lastIndexOf("_");
    if (i < 0) continue;
    const eventId = k.slice(0, i), playerId = k.slice(i + 1);
    (byP[playerId] = byP[playerId] || {})[eventId] = flat[k];
  }
  return byP;
}
async function loadAttendanceSplit() {
  try {
    const snap = await getDocs(collection(db, "teams", CURRENT_TEAM, "attendance"));
    const flat = {};
    snap.forEach(d => {
      const evs = d.data() || {};
      for (const eventId in evs) flat[`${eventId}_${d.id}`] = evs[eventId];
    });
    return flat;
  } catch (e) { console.error("loadAttendanceSplit:", e); return {}; }
}
async function saveAttendanceSplit(oldFlat, newFlat) {
  try {
    const oldB = groupAttendanceByPlayer(oldFlat), newB = groupAttendanceByPlayer(newFlat);
    const ids = new Set([...Object.keys(oldB), ...Object.keys(newB)]);
    const writes = [];
    ids.forEach(pid => {
      if (JSON.stringify(oldB[pid] || {}) !== JSON.stringify(newB[pid] || {}))
        writes.push(setDoc(doc(db, "teams", CURRENT_TEAM, "attendance", pid), newB[pid] || {}));
    });
    await Promise.all(writes);
  } catch (e) { console.error("saveAttendanceSplit:", e); }
}

// profiles: בזיכרון { playerId: {fields, password} } ↔ profiles/{id} (ללא סיסמה) + secrets/{id} = { password }
async function loadProfilesSplit() {
  try {
    const snap = await getDocs(collection(db, "teams", CURRENT_TEAM, "profiles"));
    const map = {};
    snap.forEach(d => { map[d.id] = d.data() || {}; }); // ללא סיסמאות — נקראות on-demand מ-secrets בכניסה
    return map;
  } catch (e) { console.error("loadProfilesSplit:", e); return {}; }
}
async function saveProfilesSplit(oldMap, newMap) {
  try {
    const ids = new Set([...Object.keys(oldMap || {}), ...Object.keys(newMap || {})]);
    const writes = [];
    ids.forEach(id => {
      const prev = (oldMap || {})[id], next = (newMap || {})[id];
      if (!next) return;
      const { password, ...pub } = next; // הפרדה: סיסמה ל-secrets, השאר ל-profiles הציבורי
      const prevPub = prev ? (() => { const { password: _p, ...rest } = prev; return rest; })() : null;
      if (JSON.stringify(prevPub) !== JSON.stringify(pub))
        writes.push(setDoc(doc(db, "teams", CURRENT_TEAM, "profiles", id), pub));
      if (password !== undefined && (!prev || prev.password !== password))
        writes.push(setDoc(doc(db, "teams", CURRENT_TEAM, "secrets", id), { password }));
    });
    await Promise.all(writes);
  } catch (e) { console.error("saveProfilesSplit:", e); }
}
// קריאת סיסמת שחקנית on-demand (לכניסה) — מאפשר להדק את secrets ל"עצמי בלבד" בשלב 5
async function loadPlayerSecret(playerId) {
  try {
    const snap = await getDoc(doc(db, "teams", CURRENT_TEAM, "secrets", String(playerId)));
    return snap.exists() ? (snap.data().password || "") : "";
  } catch (e) { console.error("loadPlayerSecret:", e); return ""; }
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
// ── הזמנות לפי מייל (גישה A): סופר-אדמין יוצר קבוצה + הזמנה; מנהלת נכנסת רק אם יש הזמנה ──
function inviteKey(email) { return String(email || "").trim().toLowerCase(); }
async function loadInvite(email) {
  const k = inviteKey(email);
  if (!k) return null;
  try {
    const snap = await getDoc(doc(db, "invites", k));
    return snap.exists() ? snap.data() : null; // { teamId, createdAt }
  } catch { return null; }
}
async function saveInvite(email, teamId) {
  const k = inviteKey(email);
  if (!k) return;
  try { await setDoc(doc(db, "invites", k), { teamId, email: k, createdAt: new Date().toISOString() }); }
  catch (e) { console.error("saveInvite:", e); }
}
// ── בקשות הצטרפות: מנהלת נכנסת עם Google → נרשמת בקשה ממתינה לאישור הסופר-אדמין ──
async function saveJoinRequest(email, name) {
  const k = inviteKey(email);
  if (!k) return;
  // כתיבה ישירה (ללא getDoc מקדים — קריאה ל-joinRequests מותרת לסופר-אדמין בלבד,
  // אז בדיקת-קיום ע"י המנהלת הייתה נחסמת ומונעת את הכתיבה). setDoc יוצר-או-דורס.
  try {
    await setDoc(doc(db, "joinRequests", k), { email: k, name: name || "", createdAt: new Date().toISOString() });
  } catch (e) { console.error("saveJoinRequest:", e.code || e.message); }
}
async function loadJoinRequests() {
  try {
    const snap = await getDocs(collection(db, "joinRequests"));
    return snap.docs.map(d => d.data()).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  } catch (e) { console.error("loadJoinRequests:", e); return []; }
}
async function deleteJoinRequest(email) {
  const k = inviteKey(email);
  try { await deleteDoc(doc(db, "joinRequests", k)); } catch (e) { console.error("deleteJoinRequest:", e); }
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
// מוסיף מנהל לקבוצה. שלושה מצבים:
//  1) אין meta כלל → קבוצה חדשה לגמרי: המתחבר הופך לבעלים.
//  2) יש meta אך ownerUid ריק (נוצר ע"י סופר-אדמין דרך הזמנה) → אימוץ: ממלאים ownerUid
//     ומוסיפים ל-adminUids, בלי לדרוס status/createdAt/plan הקיימים.
//  3) יש meta עם בעלים → מוסיפים uid ל-adminUids בלבד.
async function addTeamAdmin(teamId, uid, email, defaultStatus) {
  const existing = await loadTeamKey(teamId, KEYS.meta, null);
  if (!existing) {
    // (1) קבוצה חדשה לגמרי
    await saveTeamKey(teamId, KEYS.meta, {
      ownerUid: uid, ownerEmail: email, adminUids: [uid],
      status: defaultStatus || "active", plan: "free", createdAt: new Date().toISOString(),
    });
  } else {
    // (2)+(3) meta קיים — לא דורסים status/createdAt/plan. רק ממלאים בעלים וחברות.
    const next = { ...existing };
    if (!next.ownerUid) next.ownerUid = uid;              // אימוץ הזמנה (ownerUid היה null)
    if (!next.ownerEmail) next.ownerEmail = email;
    if (!(next.adminUids || []).includes(uid)) next.adminUids = [...(next.adminUids || []), uid];
    if (!next.status) next.status = defaultStatus || "active"; // מילוי-לאחור בלבד; לא דורס active קיים
    if (!next.plan) next.plan = "free";
    if (!next.createdAt) next.createdAt = new Date().toISOString();
    await saveTeamKey(teamId, KEYS.meta, next);
  }
}

// ── חברות (members) ואינדקס סופר-אדמין (Tier 2, שלב 2) ────────────────────────
// מסמך חברות קושר טוקן (uid)→קבוצה→שחקנית. זו הכריכה שמאפשרת אכיפה פר-שחקנית בכללים.
async function writeMember(teamId, uid, data) {
  if (!teamId || !uid) return;
  try { await setDoc(doc(db, "teams", teamId, "members", uid), data); }
  catch (e) { console.error("writeMember:", e); }
}
// כריכת שחקנית: הטוקן האנונימי של המכשיר ↔ playerId. נקרא בהקמה/כניסה.
async function bindPlayerMembership(teamId, uid, player) {
  if (!uid || !player) return;
  await writeMember(teamId, uid, { role: "player", playerId: player.id, name: player.name, joinedAt: new Date().toISOString() });
}

// ── דחיסת תמונה בצד-לקוח (canvas) — מקס' 1280px, JPEG 0.8 ────────────────────
// חיסכון ~10x ברוחב פס ובעלות Storage. אם הקריאה נכשלת — מחזיר את הקובץ המקורי.
function compressImage(file, maxDim = 1280, quality = 0.8) {
  return new Promise((resolve) => {
    if (!file || !file.type || !file.type.startsWith("image/")) { resolve(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) { resolve(file); return; } // כבר קטנה — לא נוגעים
      if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
      else { width = Math.round(width * maxDim / height); height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], (file.name || "photo").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── שלב 5′: אימות אמיתי לשחקנית (Firebase Email/Password עם אימייל פיקטיבי) ───
// האימייל הפיקטיבי נגזר מ-teamId+playerId, נסתר מהשחקנית. חווייתה: "שם + סיסמה" כרגיל.
function playerEmail(teamId, playerId) {
  const t = String(teamId).toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${t}-p${playerId}@players.bibleumi.app`;
}
// אימות מאוחד: יוצר חשבון בכניסה ראשונה, מתחבר אם כבר קיים. דטרמיניסטי (לא תלוי בהגנת enumeration).
async function emailAuth(email, pass) {
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    return { ok: true, created: true };
  } catch (e) {
    if (e.code === "auth/email-already-in-use") {
      try { await signInWithEmailAndPassword(auth, email, pass); return { ok: true, created: false }; }
      catch (e2) { return { ok: false, error: e2.code || e2.message }; }
    }
    if (e.code === "auth/weak-password") return { ok: false, error: "weak" };
    return { ok: false, error: e.code || e.message };
  }
}
// הבחנה בין מנהל (Google) לשחקנית (password) — שניהם לא-אנונימיים, אז ההבחנה לפי הספק.
function isGoogleUser(u) {
  return !!(u && !u.isAnonymous && (u.providerData || []).some(p => p.providerId === "google.com"));
}

// ── שלב 5′ חצי ב': קריאה ל-Cloud Functions לניהול חשבונות שחקניות ─────────────
const callResetFn = httpsCallable(functions, "adminResetPlayerPassword");
const callDeleteFn = httpsCallable(functions, "adminDeletePlayer");
const callDeleteTeamFn = httpsCallable(functions, "adminDeleteTeam");
async function adminResetPlayer(teamId, playerId) {
  const res = await callResetFn({ teamId, playerId });
  return res.data; // { ok, tempPassword }
}
async function adminDeletePlayerRemote(teamId, playerId) {
  const res = await callDeleteFn({ teamId, playerId });
  return res.data; // { ok }
}
async function adminDeleteTeamRemote(teamId) {
  const res = await callDeleteTeamFn({ teamId });
  return res.data; // { ok }
}
// אינדקס שטוח לכל הקבוצות — לסופר-אדמין (במקום לסרוק collection group). נכתב ביצירה/עדכון.
async function syncTeamIndex(teamId) {
  try {
    const meta = await loadTeamKey(teamId, KEYS.meta, {}) || {};
    const players = await loadTeamKey(teamId, KEYS.players, []) || [];
    const st = await loadTeamKey(teamId, KEYS.settings, {}) || {};
    await setDoc(doc(db, "teamIndex", teamId), {
      teamId,
      teamName: st.teamName || teamId,
      ownerEmail: meta.ownerEmail || "",
      status: meta.status || "active",
      plan: meta.plan || "free",
      createdAt: meta.createdAt || "",
      playerCount: Array.isArray(players) ? players.length : 0,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) { console.error("syncTeamIndex:", e); }
}
// סופר-אדמין: רשימת כל הקבוצות, ושינוי סטטוס (אישור/השהיה).
async function listAllTeams() {
  try {
    const snap = await getDocs(collection(db, "teamIndex"));
    return snap.docs.map(d => d.data()).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  } catch (e) { console.error("listAllTeams:", e); return []; }
}
async function setTeamStatus(teamId, status) {
  const meta = await loadTeamKey(teamId, KEYS.meta, {}) || {};
  await saveTeamKey(teamId, KEYS.meta, {
    ...meta, status,
    activatedAt: status === "active" ? new Date().toISOString() : (meta.activatedAt || null),
  });
  await syncTeamIndex(teamId);
}
// קבוצה חדשה לגמרי (גוגל לא מוכר) — מאתחלים ריקה כדי לא להציג שחקניות לדוגמה.
async function seedNewTeam(teamId) {
  const existing = await loadTeamKey(teamId, KEYS.players, null);
  if (existing === null) {
    await saveTeamKey(teamId, KEYS.players, []);
    await saveTeamKey(teamId, KEYS.events, []);   // ריק — לא לרשת את אירועי-הדוגמה של בינלאומי
    await saveTeamKey(teamId, KEYS.games, []);    // ריק — לא לרשת את משחקי-הדוגמה של בינלאומי
    await saveTeamKey(teamId, KEYS.settings, { ...DEFAULT_SETTINGS, teamName: "הקבוצה שלי" });
  }
}
// ── מזהה קבוצה קצר וקריא לשיתוף (vb-XXXX). בודק ייחודיות מול teamIndex. ──
async function generateTeamId() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // ללא O/0/I/l/1 מבלבלים
  for (let attempt = 0; attempt < 8; attempt++) {
    let code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const id = "vb-" + code;
    try {
      const snap = await getDoc(doc(db, "teamIndex", id));
      if (!snap.exists()) return id;
    } catch { return id; } // אם הבדיקה נכשלה — סיכוי ההתנגשות זניח ממילא
  }
  return "vb-" + Date.now().toString(36).slice(-5); // נפילה בטוחה (תמיד ייחודי)
}

// מזהה את הקבוצה של המנהל המחובר, ואם צריך — יוצר/מאמץ. מחזיר teamId.
// allowRequest: רק זרימת "רכישה" רשאית לרשום בקשת הצטרפות. "כניסת מנהל" (allowRequest=false)
// של משתמש לא-מוכר מחזירה __NOT_REGISTERED__ (מבוי-סתום מנומס) — לעולם לא שולחת בקשה.
async function resolveAdminTeam(user, allowRequest) {
  const uid = user.uid;
  const email = (user.email || "").toLowerCase();
  const known = BIBLEUMI_ADMIN_EMAILS.includes(email);
  let teamId;
  const mapping = await loadUserTeam(uid);
  if (mapping && mapping.teamId) {
    // לוודא שהקבוצה הממופה עדיין קיימת. אם נמחקה (mapping יתום) — מתעלמים וממשיכים להזמנה/חסימה.
    const mSnap = await getDoc(doc(db, "teams", mapping.teamId, "data", "meta"));
    if (mSnap.exists()) {
      teamId = mapping.teamId;
    } else {
      await deleteDoc(doc(db, "users", uid)).catch(() => {}); // ניקוי mapping יתום
    }
  }
  if (!teamId && known) {
    teamId = DEFAULT_TEAM;
    await saveUserTeam(uid, { teamId, email });
  } else if (!teamId) {
    // מנהלת לא-מוכרת: יוצרים קבוצה אך ורק אם סופר-אדמין הכין הזמנה למייל שלה.
    const invite = await loadInvite(email);
    if (invite && invite.teamId) {
      // לוודא שקבוצת ההזמנה קיימת (לא יתומה ממחיקה)
      const iSnap = await getDoc(doc(db, "teams", invite.teamId, "data", "meta"));
      if (iSnap.exists()) {
        teamId = invite.teamId; // הקבוצה כבר נוצרה (pending, ריקה) ע"י הסופר-אדמין
        await saveUserTeam(uid, { teamId, email });
      } else {
        await deleteDoc(doc(db, "invites", inviteKey(email))).catch(() => {}); // הזמנה יתומה
        if (!allowRequest) return "__NOT_REGISTERED__";
        await saveJoinRequest(email, user.displayName || "");
        return "__PENDING_REQUEST__";
      }
    } else {
      // משתמש לא-מוכר: רק זרימת רכישה (allowRequest) רושמת בקשה. כניסת-מנהל → מבוי-סתום.
      if (!allowRequest) return "__NOT_REGISTERED__";
      await saveJoinRequest(email, user.displayName || "");
      return "__PENDING_REQUEST__";
    }
  }
  // status התחלתי: בינלאומי/מוכרות = active, חדשה = pending. addTeamAdmin שומר status קיים.
  const initialStatus = (teamId === DEFAULT_TEAM || known) ? "active" : "pending";
  await addTeamAdmin(teamId, uid, email, initialStatus);
  // חברות מנהל + רישום/עדכון באינדקס הסופר-אדמין (רץ גם לקבוצות ממופות ותיקות)
  await writeMember(teamId, uid, { role: "admin", playerId: null, email, joinedAt: new Date().toISOString() });
  await syncTeamIndex(teamId);
  return teamId;
}

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────────
function Confirm({ msg, onOk, onCancel, icon, okLabel, tone }) {
  const notice = !onCancel; // אין ביטול = התראת-יידוע (כפתור אחד) במקום אישור פעולה
  const accent = tone === "warn" ? "#f59e0b" : (notice ? "#1a237e" : "#ef4444");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 20, padding: 28, maxWidth: 320, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{icon || (notice ? "🗓️" : "⚠️")}</div>
        <p style={{ fontSize: 15, color: "#1e293b", fontWeight: 600, marginBottom: 22, lineHeight: 1.6 }}>{msg}</p>
        <div style={{ display: "flex", gap: 10 }}>
          {!notice && <button onClick={onCancel} style={{ flex: 1, padding: 12, background: "#f1f5f9", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, color: "#64748b" }}>ביטול</button>}
          <button onClick={onOk} style={{ flex: 1, padding: 12, background: accent, border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, color: "white" }}>{okLabel || (notice ? "הבנתי" : "אישור")}</button>
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
  const [chat, setChat] = useState([]);
  const chatUnsubRef = useRef(null);
  const [confirm, setConfirm] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [googleLoginError, setGoogleLoginError] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [teamMeta, setTeamMeta] = useState(null); // meta של הקבוצה הנוכחית (status/בעלות) — לשער הכניסה

  // ── שלב מעבר לאבטחה: bootstrap של Auth מתבצע באפקט המאוחד למטה ────────────────
  // קודם פותרים redirect של Google, ורק אם אין משתמש כלל — מתחברים אנונימית.
  // איחוד הרצף מונע מצב שבו ההתחברות האנונימית "דורסת" את תוצאת ה-redirect.

  // טוען את כל נתוני הקבוצה הנוכחית (CURRENT_TEAM). ניתן לקריאה חוזרת אחרי החלפת קבוצה.
  async function loadTeamData() {
    // ערכי ברירת המחדל (רשימת שחקניות/אירועים/משחקים לדוגמה) שייכים אך ורק לבינלאומי.
    // לכל קבוצה אחרת — fallback ריק, אחרת נתוני-הדוגמה של בינלאומי "דולפים" לקבוצה חדשה/ריקה.
    const isBibleumi = CURRENT_TEAM === DEFAULT_TEAM;
    const fbPlayers = isBibleumi ? DEFAULT_PLAYERS : [];
    const fbEvents = isBibleumi ? DEFAULT_EVENTS : [];
    const fbGames = isBibleumi ? DEFAULT_GAMES : [];
    const [p, e, a, n, s, ar, g, gal, pp] = await Promise.all([
      load(KEYS.players, fbPlayers),
      load(KEYS.events, fbEvents),
      loadAttendanceSplit(),
      load(KEYS.notifications, []),
      load(KEYS.settings, DEFAULT_SETTINGS),
      load(KEYS.archive, []),
      load(KEYS.games, fbGames),
      load(KEYS.gallery, []),
      loadProfilesSplit(),
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
    // meta של הקבוצה (status/בעלות) — לשער הכניסה. חסר status ⇒ "active" (קבוצה ותיקה, לא נועלים)
    const m = await load(KEYS.meta, null);
    setTeamMeta(m);
    // צ'אט בזמן אמת — subcollection (כל הודעה = מסמך נפרד). אין דריסה, אין אובדן הודעות.
    // מוגבל ל-200 האחרונות; ממוין לפי ts. הפורמט זהה למערך הישן כך שה-UI לא משתנה.
    if (chatUnsubRef.current) chatUnsubRef.current();
    const chatQ = query(collection(db, "teams", CURRENT_TEAM, "chat"), orderBy("ts", "desc"), limit(200));
    chatUnsubRef.current = onSnapshot(chatQ,
      snap => {
        const msgs = snap.docs.map(d => ({ ...d.data(), _docId: d.id }));
        msgs.reverse(); // desc→asc: הישנה למעלה, החדשה למטה
        setChat(msgs);
      },
      err => console.error("chat onSnapshot:", err));
  }

  // משקיף בלבד על מצב ההזדהות (לא מתחבר — כך אין מרוץ עם ה-redirect). משמש לאבחון ולכפתור "המשך".
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthUser(u));
    return () => unsub();
  }, []);

  // ניקוי מנוי הצ'אט בעת יציאה
  useEffect(() => () => { if (chatUnsubRef.current) chatUnsubRef.current(); }, []);

  useEffect(() => {
    (async () => {
      const wasPending = sessionStorage.getItem("pendingGoogleLogin") === "1";
      sessionStorage.removeItem("pendingGoogleLogin");
      let adminUser = null;

      // 1) לפתור redirect של Google — אך ורק אם באמת חזרנו מ-redirect (wasPending).
      // באייפון/ספארי getRedirectResult עלול לתלות עד timeout ארוך (ITP); לקרוא לו בכל פתיחה
      // מאט את הטעינה לכל המשתמשות (גם שחקניות שלא ניסו להתחבר). מדלגים כשאין redirect ממתין.
      if (wasPending) {
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
      }

      // גיבוי: אם getRedirectResult ריק אבל סשן Google נשמר — נשתמש במשתמש המחובר.
      // חשוב: רק חשבון Google = מנהל. חשבון שחקנית (Email/Password) לא-אנונימי אך אינו מנהל.
      if (!adminUser && isGoogleUser(auth.currentUser)) {
        adminUser = auth.currentUser;
      }

      // 2) אם אין משתמש כלל — התחברות אנונימית (טוקן בסיס לשחקניות)
      if (!auth.currentUser) {
        try { await signInAnonymously(auth); } catch (e) { console.error("Anon auth error:", e); }
      }

      // 3) אם זוהה מנהל — לזהות/לאמץ קבוצה ולעבור לפאנל
      if (adminUser) {
        const wantPurchase = sessionStorage.getItem("purchaseFlow") === "1";
        sessionStorage.removeItem("purchaseFlow");
        const teamId = await resolveAdminTeam(adminUser, wantPurchase);
        if (teamId === "__PENDING_REQUEST__") { setScreen("pending-request"); return; }
        if (teamId === "__NOT_REGISTERED__") { setScreen("not-registered"); return; }
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

      // 3.5) כניסה לכתובת חשופה (בלי ?team=) ואין מנהל מזוהה → דף נחיתה (שער ראשי), לא ניחוש קבוצה.
      if (!TEAM_FROM_URL) {
        setScreen("landing");
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
  async function handleGoogleLogin(purchaseFlow) {
    setGoogleLoginError("");
    if (isIOS()) {
      try {
        sessionStorage.setItem("pendingGoogleLogin", "1");
        if (purchaseFlow) sessionStorage.setItem("purchaseFlow", "1"); else sessionStorage.removeItem("purchaseFlow");
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
      const teamId = await resolveAdminTeam(result.user, !!purchaseFlow);
      if (teamId === "__PENDING_REQUEST__") { setScreen("pending-request"); return { ok: true }; }
      if (teamId === "__NOT_REGISTERED__") { setScreen("not-registered"); return { ok: true }; }
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
          if (purchaseFlow) sessionStorage.setItem("purchaseFlow", "1"); else sessionStorage.removeItem("purchaseFlow");
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
  async function continueAsAdmin(purchaseFlow) {
    if (!isGoogleUser(auth.currentUser)) return { ok: false, error: "אין משתמש Google מחובר" };
    const teamId = await resolveAdminTeam(auth.currentUser, !!purchaseFlow);
    if (teamId === "__PENDING_REQUEST__") { setScreen("pending-request"); return { ok: true }; }
    if (teamId === "__NOT_REGISTERED__") { setScreen("not-registered"); return { ok: true }; }
    setCurrentTeam(teamId);
    await loadTeamData();
    setScreen("admin");
    return { ok: true };
  }

  // התנתקות שחקנית: יוצא מחשבון Firebase שלה, חוזר לטוקן אנונימי, וחוזר למסך הבית (בחירת שם).
  async function handlePlayerLogout() {
    try { await signOut(auth); } catch (e) { console.error("player signOut:", e); }
    try { await signInAnonymously(auth); } catch (e) { console.error("anon after player logout:", e); }
    setScreen("home");
  }

  // התנתקות מנהל: יוצא מ-Google, חוזר לטוקן אנונימי (כדי שהשחקניות ימשיכו לעבוד), חוזר לבינלאומי ולמסך הבית.
  async function handleAdminLogout() {
    try { await signOut(auth); } catch (e) { console.error("signOut:", e); }
    try { await signInAnonymously(auth); } catch (e) { console.error("anon after logout:", e); }
    setCurrentTeam(DEFAULT_TEAM);
    await loadTeamData();
    setScreen("home");
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
    attendance: async v => { setAttendance(v); await saveAttendanceSplit(attendance, v); },
    notifications: async v => { setNotifications(v); await save(KEYS.notifications, v); },
    settings: async v => { setSettings(v); await save(KEYS.settings, v); },
    archive: async v => { setArchive(v); await save(KEYS.archive, v); },
    games: async v => { setGames(v); await save(KEYS.games, v); },
    gallery: async v => { setGallery(v); await save(KEYS.gallery, v); },
    playerProfiles: async v => { setPlayerProfiles(v); await saveProfilesSplit(playerProfiles, v); },
    applause: async v => { setApplause(v); await save(KEYS.applause, v); },
    polls: async v => { setPolls(v); await save(KEYS.polls, v); },
    personalNotifs: async v => { setPersonalNotifs(v); await save(KEYS.personalNotifs, v); },
    installVersion: async v => { setSettings(s => ({ ...s, installVersion: v })); await save(KEYS.installVersion, v); },
  };

  function askConfirm(msg, onOk) { setConfirm({ msg, onOk }); }
  // התראת-יידוע מעוצבת (כפתור אחד). מחליפה את חלון ה-alert המכוער של הדפדפן.
  function notify(msg, opts) { setConfirm({ msg, notice: true, icon: opts?.icon, okLabel: opts?.okLabel, tone: opts?.tone }); }

  const pc = settings.primaryColor || "#1a237e";
  const sc = settings.secondaryColor || "#f5c842";
  const common = { players, events, attendance, notifications, settings, archive, games, gallery, playerProfiles, applause, polls, personalNotifs, chat, upd, pc, sc, askConfirm, notify, teamMeta };

  // ── שער כניסה (מסחור) ────────────────────────────────────────────────────────
  // קבוצה ללא status נחשבת "active" (ותיקה — לא נועלים). רק "pending" מפורש נועל לשחקניות.
  const teamStatus = teamMeta?.status || "active";
  const isTeamAdmin = !!(authUser && !authUser.isAnonymous && teamMeta && (teamMeta.adminUids || []).includes(authUser.uid));
  const lockedForPlayers = teamStatus === "pending" && !isTeamAdmin;

  if (screen === "splash" && !showInstall && !showWhatsNew) return <Splash pc={pc} sc={sc} />;
  if (screen === "superAdmin") return <SuperAdminScreen pc={pc} sc={sc} authUser={authUser} onGoogle={handleGoogleLogin} onBack={() => setScreen("home")} />;
  if (screen === "landing") return <LandingScreen pc={pc} sc={sc}
    onAdminLogin={() => setScreen("admin-login")}
    onPurchase={() => setScreen("purchase")}
    onEnterBibleumi={async () => { setCurrentTeam(DEFAULT_TEAM); await loadTeamData(); setScreen("home"); }} />;
  if (screen === "purchase") return <PurchaseScreen pc={pc} sc={sc} authUser={authUser}
    onGoogle={() => handleGoogleLogin(true)} onContinue={() => continueAsAdmin(true)}
    onBack={() => setScreen(TEAM_FROM_URL ? "home" : "landing")} />;
  if (screen === "not-registered") return <NotRegisteredScreen pc={pc} sc={sc} authUser={authUser}
    onPurchase={() => setScreen("purchase")} onLogout={handleAdminLogout}
    onBack={() => setScreen(TEAM_FROM_URL ? "home" : "landing")} />;
  if (screen === "pending-request") return <PendingRequestScreen pc={pc} sc={sc} authUser={authUser} onLogout={handleAdminLogout} onBack={() => setScreen("home")} />;
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

  // קבוצה pending: השחקניות רואות מסך נעילה. המנהלת (admin-login/admin/superAdmin) ממשיכה רגיל.
  if (lockedForPlayers && (screen === "home" || screen === "onboard" || screen === "player")) {
    return <LockedTeamScreen pc={pc} sc={sc} settings={settings} onAdmin={() => setScreen("admin-login")} />;
  }

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
      {confirm && <Confirm msg={confirm.msg} icon={confirm.icon} okLabel={confirm.okLabel} tone={confirm.tone}
        onOk={() => { if (confirm.onOk) confirm.onOk(); setConfirm(null); }}
        onCancel={confirm.notice ? undefined : () => setConfirm(null)} />}

      <div key={screen} className="screen-fade">
        {screen === "home" && <HomeScreen {...common} onSelectPlayer={p => {
          setCurrentPlayer(p);
          const remembered = localStorage.getItem("rememberPlayer_" + p.id) === "1";
          if (remembered && playerProfiles[p.id]?.setupDone) setScreen("player");
          else setScreen("onboard");
        }} onAdmin={() => setScreen("admin-login")} onHelp={() => setScreen("help")} onAbout={() => setScreen("about")} onSuperAdmin={enterSuperAdmin} onPurchase={() => setScreen("purchase")} />}
        {screen === "onboard" && <OnboardScreen {...common} player={currentPlayer} onDone={() => setScreen("player")} onBack={() => setScreen("home")} />}
        {screen === "player" && <PlayerScreen {...common} player={currentPlayer} onBack={() => setScreen("home")} onLogout={handlePlayerLogout} />}
        {screen === "admin-login" && <AdminLogin pc={pc} sc={sc} onGoogle={handleGoogleLogin} onContinue={continueAsAdmin} authUser={authUser} initialError={googleLoginError} onBack={() => { setGoogleLoginError(""); setScreen("home"); }} />}
        {screen === "admin" && <AdminPanel {...common} onBack={() => setScreen("home")} onLogout={handleAdminLogout} />}
        {screen === "help" && <HelpScreen pc={pc} sc={sc} settings={settings} onBack={() => setScreen("home")} />}
        {screen === "about" && <AboutScreen pc={pc} sc={sc} settings={settings} onBack={() => setScreen("home")} />}
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

// ── LOCKED TEAM (קבוצה pending — נעולה לשחקניות עד אישור) ─────────────────────
function LockedTeamScreen({ pc, sc, settings, onAdmin }) {
  const teamName = settings?.teamName || "הקבוצה";
  return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, sans-serif", minHeight: "100vh", background: pc, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 8 }}>🔒</div>
      <h2 style={{ color: "white", fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>{teamName}</h2>
      <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>הקבוצה עדיין לא פעילה</p>
      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.6, maxWidth: 320, margin: "0 0 24px" }}>
        מנהל/ת הקבוצה בתהליך הקמה. ברגע שהקבוצה תופעל — תוכלי להיכנס ולסמן הגעה. נסי שוב מאוחר יותר 🏐
      </p>
      <button onClick={onAdmin} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
        כניסת מנהל/ת
      </button>
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
// ── NO-INVITE (מנהלת חדשה ללא הזמנה — מסך "פתיחת קבוצה") ──────────────────────
function NoInviteScreen({ pc, sc, authUser, onLogout, onBack }) {
  const email = (authUser && authUser.email) || "";
  const waLink = OWNER_CONTACT_WHATSAPP
    ? `https://wa.me/${OWNER_CONTACT_WHATSAPP}?text=${encodeURIComponent(`היי, אני רוצה לפתוח קבוצת כדורשת באפליקציה. כתובת ה-Gmail שלי: ${email}`)}`
    : "";
  const mailLink = `mailto:${OWNER_CONTACT_EMAIL}?subject=${encodeURIComponent("בקשה לפתיחת קבוצה")}&body=${encodeURIComponent(`היי, אני רוצה לפתוח קבוצת כדורשת. כתובת ה-Gmail שלי: ${email}`)}`;
  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 20, padding: "30px 24px", width: "100%", maxWidth: 360, boxShadow: "0 12px 40px rgba(0,0,0,0.2)", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>🏐</div>
        <h2 style={{ fontSize: 21, fontWeight: 800, color: pc, margin: "10px 0 6px" }}>פתיחת קבוצה חדשה</h2>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: "0 0 14px" }}>
          כדי לפתוח קבוצה חדשה, יש ליצור קשר. לאחר האישור — תוכלי להיכנס ולהקים את הקבוצה שלך.
        </p>
        <div style={{ background: "#fef9c3", borderRadius: 10, padding: "9px 12px", margin: "0 0 18px", fontSize: 12.5, color: "#854d0e", lineHeight: 1.5 }}>
          💳 השירות כרוך בעלות חודשית. הפרטים יימסרו בפנייה.
        </div>
        <div style={{ background: "#f1f5f9", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: "#64748b", margin: "0 0 18px", lineHeight: 1.5 }}>
          חשוב: יש להיכנס עם <strong>אותה כתובת Gmail</strong> שתמסרי. הכתובת שלך כעת:<br />
          <strong style={{ color: pc, wordBreak: "break-all" }}>{email || "—"}</strong>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ background: "#25D366", color: "white", borderRadius: 12, padding: "13px", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>📱 פנייה בוואטסאפ</a>
          )}
          <a href={mailLink} style={{ background: pc, color: "white", borderRadius: 12, padding: "13px", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>✉️ פנייה במייל</a>
        </div>
        <button onClick={() => onLogout ? onLogout() : onBack()} style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", marginTop: 16, width: "100%" }}>← חזרה / התנתקות</button>
      </div>
    </div>
  );
}

// ── באנר שיווקי מתחלף (fade) — דף בית שחקנית + דף נחיתה ──────────────────────
function PurchaseBanner({ pc, sc, onClick }) {
  const [showB, setShowB] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setShowB(v => !v), 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <button onClick={onClick}
      style={{ width: "100%", border: `1px dashed ${pc}55`, background: `${pc}0a`, borderRadius: 14, padding: "12px 16px", cursor: "pointer", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 46 }}>
      <span style={{ position: "relative", display: "inline-block", height: 20, lineHeight: "20px" }}>
        <span style={{ opacity: showB ? 0 : 1, transition: "opacity 0.5s", color: pc, fontWeight: 700, fontSize: 14 }}>
          🏐 מעוניינת באפליקציה לקבוצה שלך?
        </span>
        <span style={{ position: "absolute", inset: 0, opacity: showB ? 1 : 0, transition: "opacity 0.5s", color: pc, fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>
          לחצי כאן לפרטים ←
        </span>
      </span>
    </button>
  );
}

// ── מסך רכישה (מנהלת חדשה שרוצה לפתוח קבוצה) — מסביר, ורק באישור מפורש שולח בקשה ──
function PurchaseScreen({ pc, sc, authUser, onGoogle, onContinue, onBack }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const alreadyGoogle = isGoogleUser(authUser);
  async function go(fn) {
    setBusy(true); setErr("");
    const res = await fn();
    if (res && !res.ok && res.error) setErr(res.error);
    setBusy(false);
  }
  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: `linear-gradient(160deg, ${pc}, ${pc}dd)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ textAlign: "center", fontSize: 46 }}>🏐</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: pc, textAlign: "center", margin: "8px 0 4px" }}>אפליקציה לקבוצה שלך</h2>
        <p style={{ fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 1.6, margin: "0 0 18px" }}>
          כל מה שצריך לניהול קבוצת כדורשת במקום אחד:
        </p>
        <div style={{ background: "#f8fafc", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          {[["✅", "וידוא הגעה לאימונים ומשחקים"], ["📊", "סטטיסטיקות ודירוג שחקניות"], ["💬", "צ'אט קבוצתי, סקרים ותזכורות"], ["🏆", "לוח משחקים וגלריית תמונות"]].map(([ic, tx]) => (
            <div key={tx} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#334155", padding: "4px 0" }}>
              <span style={{ fontSize: 17 }}>{ic}</span><span>{tx}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#fef9c3", borderRadius: 10, padding: "10px 14px", margin: "0 0 18px", fontSize: 13, color: "#854d0e", lineHeight: 1.5, textAlign: "center" }}>
          💳 השירות כרוך בעלות חודשית. הפרטים יימסרו לאחר אישור הבקשה.
        </div>
        <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", margin: "0 0 14px", lineHeight: 1.5 }}>
          כדי לבקש לפתוח קבוצה, התחברי עם חשבון Google שלך. <strong>הבקשה תישלח רק לאחר אישורך במסך הבא.</strong>
        </p>
        {err && <div style={{ background: "#fee2e2", color: "#b91c1c", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{err}</div>}
        {alreadyGoogle ? (
          <button disabled={busy} onClick={() => go(onContinue)} style={{ width: "100%", background: pc, color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 800, cursor: busy ? "default" : "pointer", marginBottom: 10 }}>
            {busy ? "רגע…" : `המשיכי כ-${authUser.email}`}
          </button>
        ) : (
          <button disabled={busy} onClick={() => go(onGoogle)} style={{ width: "100%", background: pc, color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 800, cursor: busy ? "default" : "pointer", marginBottom: 10 }}>
            {busy ? "רגע…" : "התחברי עם Google"}
          </button>
        )}
        <button onClick={onBack} style={{ width: "100%", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>חזרה</button>
      </div>
    </div>
  );
}

// ── מבוי-סתום מנומס: "כניסת מנהל" של חשבון לא-משויך. לא נשלחה בקשה. דרך קדימה לרכישה. ──
function NotRegisteredScreen({ pc, sc, authUser, onPurchase, onLogout, onBack }) {
  const email = (authUser && authUser.email) || "";
  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 20, padding: "30px 24px", width: "100%", maxWidth: 360, boxShadow: "0 12px 40px rgba(0,0,0,0.2)", textAlign: "center" }}>
        <div style={{ fontSize: 46 }}>🔍</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: pc, margin: "10px 0 6px" }}>החשבון אינו משויך לקבוצה</h2>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: "0 0 14px" }}>
          החשבון <strong style={{ color: pc, wordBreak: "break-all" }}>{email || "—"}</strong> אינו מנהל של קבוצה קיימת.
        </p>
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "12px 14px", margin: "0 0 18px", fontSize: 13, color: "#0c4a6e", lineHeight: 1.5 }}>
          מעוניינת לפתוח קבוצה משלך? אפשר לרכוש את האפליקציה ולהקים קבוצה.
        </div>
        <button onClick={onPurchase} style={{ width: "100%", background: pc, color: "white", border: "none", borderRadius: 12, padding: "13px", fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 10 }}>
          🏐 לפרטים על פתיחת קבוצה ←
        </button>
        <button onClick={() => onLogout ? onLogout() : onBack()} style={{ width: "100%", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>יציאה</button>
      </div>
    </div>
  );
}

// ── LANDING (שער ראשי — כניסה לכתובת חשופה בלי ?team=) ────────────────────────
function LandingScreen({ pc, sc, onAdminLogin, onPurchase, onEnterBibleumi }) {
  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: `linear-gradient(160deg, ${pc}, ${pc}dd)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 60 }}>🏐</div>
        <h1 style={{ color: "white", fontSize: 26, fontWeight: 800, margin: "10px 0 6px" }}>אפליקציית כדורשת</h1>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>
          ניהול קבוצה במקום אחד: וידוא הגעה, סטטיסטיקות, צ'אט קבוצתי, תזכורות ועוד.
        </p>
      </div>

      <div style={{ background: "white", borderRadius: 20, padding: "24px 22px", width: "100%", maxWidth: 360, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
        <button onClick={onAdminLogin} style={{ width: "100%", background: pc, color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 12 }}>
          🔑 כניסת מנהל/ת
        </button>

        <button onClick={onEnterBibleumi} style={{ width: "100%", background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
          כניסה לקבוצת הבינלאומי ←
        </button>

        <PurchaseBanner pc={pc} sc={sc} onClick={onPurchase} />

        <p style={{ fontSize: 11.5, color: "#94a3b8", textAlign: "center", margin: "16px 0 0", lineHeight: 1.5 }}>
          שחקנית בקבוצה אחרת? היכנסי דרך הקישור שקיבלת מהמנהלת שלך.
        </p>
      </div>
    </div>
  );
}

// ── PENDING REQUEST (מנהלת נכנסה — בקשתה נרשמה אוטומטית, ממתינה לאישור הסופר-אדמין) ──
function PendingRequestScreen({ pc, sc, authUser, onLogout, onBack }) {
  const email = (authUser && authUser.email) || "";
  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 20, padding: "30px 24px", width: "100%", maxWidth: 360, boxShadow: "0 12px 40px rgba(0,0,0,0.2)", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>⏳</div>
        <h2 style={{ fontSize: 21, fontWeight: 800, color: pc, margin: "10px 0 6px" }}>הבקשה שלך נשלחה!</h2>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: "0 0 14px" }}>
          קיבלנו את בקשתך לפתוח קבוצה. לאחר אישור — תוכלי להיכנס שוב ולהקים את הקבוצה שלך.
        </p>
        <div style={{ background: "#f1f5f9", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: "#64748b", margin: "0 0 14px", lineHeight: 1.5 }}>
          נרשמה בקשה עבור:<br />
          <strong style={{ color: pc, wordBreak: "break-all" }}>{email || "—"}</strong>
        </div>
        <div style={{ background: "#fef9c3", borderRadius: 10, padding: "9px 12px", margin: "0 0 18px", fontSize: 12.5, color: "#854d0e", lineHeight: 1.5 }}>
          💳 השירות כרוך בעלות חודשית. פרטים יימסרו עם האישור.
        </div>
        <button onClick={() => onLogout ? onLogout() : onBack()} style={{ background: pc, color: "white", border: "none", borderRadius: 12, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" }}>הבנתי, אצא כעת</button>
      </div>
    </div>
  );
}

function SuperAdminScreen({ pc, sc, authUser, onGoogle, onBack }) {
  const [gErr, setGErr] = useState("");
  const isOwner = authUser && (authUser.email || "").toLowerCase() === SUPER_ADMIN_EMAIL;
  const [teams, setTeams] = useState(null); // null = טוען
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [delErr, setDelErr] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState(null); // { teamId, email } | { error }
  const [inviteBusy, setInviteBusy] = useState(false);
  const [requests, setRequests] = useState(null); // בקשות הצטרפות ממתינות
  const [reqBusy, setReqBusy] = useState(null);

  // יוצר קבוצה ריקה + הזמנה למייל. משותף ל"כלי ידני" ול"אישור בקשה".
  async function createTeamForEmail(email) {
    const existing = await loadInvite(email);
    if (existing && existing.teamId) {
      const metaSnap = await getDoc(doc(db, "teams", existing.teamId, "data", "meta"));
      if (metaSnap.exists()) return { teamId: existing.teamId, reused: true };
      await deleteDoc(doc(db, "invites", inviteKey(email))).catch(() => {}); // הזמנה יתומה
    }
    const teamId = await generateTeamId();
    await seedNewTeam(teamId);
    await saveTeamKey(teamId, KEYS.meta, {
      ownerUid: null, ownerEmail: email, adminUids: [],
      status: "pending", plan: "free", createdAt: new Date().toISOString(),
    });
    await saveInvite(email, teamId);
    await syncTeamIndex(teamId);
    return { teamId, reused: false };
  }

  async function createTeamInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) { setInviteMsg({ error: "כתובת מייל לא תקינה" }); return; }
    setInviteBusy(true); setInviteMsg(null);
    try {
      const { teamId, reused } = await createTeamForEmail(email);
      await deleteJoinRequest(email);   // אם הייתה בקשה ממתינה לאותו מייל — מסירים
      setInviteMsg({ teamId, email, reused });
      setInviteEmail("");
      await refreshTeams();
      await refreshRequests();
    } catch (e) {
      setInviteMsg({ error: e.message || "יצירת ההזמנה נכשלה" });
    }
    setInviteBusy(false);
  }

  async function refreshRequests() {
    const list = await loadJoinRequests();
    setRequests(list);
  }
  async function approveRequest(email) {
    setReqBusy(email);
    try {
      await createTeamForEmail(email);
      await deleteJoinRequest(email);
      await refreshTeams();
      await refreshRequests();
    } catch (e) { setInviteMsg({ error: e.message || "אישור הבקשה נכשל" }); }
    setReqBusy(null);
  }
  async function rejectRequest(email) {
    setReqBusy(email);
    await deleteJoinRequest(email);
    await refreshRequests();
    setReqBusy(null);
  }

  async function refreshTeams() {
    setTeams(null);
    const list = await listAllTeams();
    setTeams(list);
  }
  useEffect(() => { if (isOwner) { refreshTeams(); refreshRequests(); } }, [isOwner]);

  async function act(teamId, status) {
    setBusyId(teamId);
    await setTeamStatus(teamId, status);
    await refreshTeams();
    setBusyId(null);
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.teamId); setDelErr("");
    try {
      await adminDeleteTeamRemote(deleteTarget.teamId);
      setDeleteTarget(null); setConfirmText("");
      await refreshTeams();
    } catch (e) {
      setDelErr(e.message || "המחיקה נכשלה");
    }
    setBusyId(null);
  }

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

        {/* בקשות הצטרפות ממתינות — מנהלות שנכנסו עם Google ומחכות לאישור */}
        {requests && requests.length > 0 && (
          <div style={{ background: "white", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "2px solid #f59e0b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 14 }}>בקשות הצטרפות ממתינות ({requests.length})</span>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>מנהלות שנכנסו עם Google וממתינות לאישור. אישור יוצר להן קבוצה ריקה — בכניסה הבאה הן יקבלו אשף הקמה.</p>
            {requests.map(r => (
              <div key={r.email} style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>{r.name || "מנהלת חדשה"}</div>
                <div style={{ fontSize: 12.5, color: "#64748b", wordBreak: "break-all", marginBottom: 8 }}>{r.email}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => approveRequest(r.email)} disabled={reqBusy === r.email}
                    style={{ flex: 1, background: reqBusy === r.email ? "#94a3b8" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "9px", cursor: reqBusy === r.email ? "default" : "pointer", fontWeight: 700, fontSize: 13 }}>
                    {reqBusy === r.email ? "מאשר…" : "✓ אשר וצור קבוצה"}
                  </button>
                  <button onClick={() => rejectRequest(r.email)} disabled={reqBusy === r.email}
                    style={{ background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    דחה
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* כלי: יצירת קבוצה + הזמנה למנהלת חדשה */}
        <div style={{ background: "white", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>➕</span>
            <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 14 }}>פתיחת קבוצה למנהלת חדשה</span>
          </div>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px", lineHeight: 1.5 }}>הקלידי את כתובת ה-Gmail של המנהלת. תיווצר קבוצה ריקה (ממתינה), והיא תוכל להיכנס איתה ולהקים אותה.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="gmail של המנהלת" type="email"
              style={{ ...S.input, flex: 1, margin: 0 }} />
            <button onClick={createTeamInvite} disabled={inviteBusy} style={{ background: inviteBusy ? "#94a3b8" : pc, color: "white", border: "none", borderRadius: 8, padding: "0 16px", cursor: inviteBusy ? "default" : "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
              {inviteBusy ? "יוצר…" : "צור הזמנה"}
            </button>
          </div>
          {inviteMsg && inviteMsg.error && <p style={{ color: "#ef4444", fontSize: 12.5, margin: "10px 0 0", fontWeight: 600 }}>⚠️ {inviteMsg.error}</p>}
          {inviteMsg && inviteMsg.teamId && (
            <div style={{ background: "#dcfce7", borderRadius: 10, padding: "10px 12px", marginTop: 10, fontSize: 12.5, color: "#166534", lineHeight: 1.6 }}>
              ✅ {inviteMsg.reused ? "כבר קיימת הזמנה" : "נוצרה קבוצה"} עבור <strong>{inviteMsg.email}</strong> (קוד: <strong>{inviteMsg.teamId}</strong>).<br />
              עכשיו המנהלת יכולה להיכנס עם אותו Gmail, והאשף ייפתח.
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 2px 0" }}>
          <span style={{ fontSize: 18 }}>👥</span>
          <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 15 }}>קבוצות במערכת</span>
          <button onClick={refreshTeams} style={{ marginRight: "auto", background: "transparent", border: "none", color: pc, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>↻ רענן</button>
        </div>

        {teams === null && <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 18 }}>טוען קבוצות…</div>}
        {teams && teams.length === 0 && <div style={{ background: "white", borderRadius: 14, padding: 18, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>אין עדיין קבוצות באינדקס. קבוצה תופיע כאן אחרי שמנהל/ת מתחבר/ת בפעם הראשונה.</div>}

        {teams && teams.map(t => {
          const pending = (t.status || "active") === "pending";
          return (
            <div key={t.teamId} style={{ background: "white", borderRadius: 14, padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 800, color: "#1e293b", fontSize: 14, overflowWrap: "anywhere" }}>{t.teamName || t.teamId}</div>
                <span style={{ marginRight: "auto", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: pending ? "#fef3c7" : "#dcfce7", color: pending ? "#92400e" : "#166534" }}>
                  {pending ? "⏳ ממתינה" : "✅ פעילה"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, overflowWrap: "anywhere" }}>{t.ownerEmail || "—"}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {t.playerCount || 0} שחקניות{t.createdAt ? ` · נוצרה ${formatShort(t.createdAt.split("T")[0])}` : ""} · <code style={{ fontSize: 10 }}>{t.teamId}</code>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {pending ? (
                  <button disabled={busyId === t.teamId} onClick={() => act(t.teamId, "active")}
                    style={{ flex: 1, padding: "9px", background: "#22c55e", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: busyId === t.teamId ? 0.6 : 1 }}>
                    {busyId === t.teamId ? "…" : "✅ אשר והפעל"}
                  </button>
                ) : (
                  <button disabled={busyId === t.teamId || t.teamId === DEFAULT_TEAM} onClick={() => act(t.teamId, "pending")}
                    style={{ flex: 1, padding: "9px", background: t.teamId === DEFAULT_TEAM ? "#e2e8f0" : "#fff", color: t.teamId === DEFAULT_TEAM ? "#94a3b8" : "#ef4444", border: `1px solid ${t.teamId === DEFAULT_TEAM ? "#e2e8f0" : "#fecaca"}`, borderRadius: 10, cursor: t.teamId === DEFAULT_TEAM ? "default" : "pointer", fontSize: 13, fontWeight: 700, opacity: busyId === t.teamId ? 0.6 : 1 }}>
                    {t.teamId === DEFAULT_TEAM ? "🔒 הבינלאומי (קבוע)" : (busyId === t.teamId ? "…" : "⏸️ השהה")}
                  </button>
                )}
                {t.teamId !== DEFAULT_TEAM && (
                  <button disabled={busyId === t.teamId} onClick={() => { setDeleteTarget(t); setConfirmText(""); setDelErr(""); }}
                    style={{ padding: "9px 12px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, cursor: busyId === t.teamId ? "default" : "pointer", fontSize: 13, fontWeight: 700, opacity: busyId === t.teamId ? 0.6 : 1 }}>🗑</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {deleteTarget && (() => {
        const expected = deleteTarget.teamName || deleteTarget.teamId;
        const match = confirmText.trim() === expected;
        const busy = busyId === deleteTarget.teamId;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}
            onClick={() => { if (!busy) { setDeleteTarget(null); setConfirmText(""); setDelErr(""); } }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 18, padding: 22, width: "100%", maxWidth: 380, boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize: 40, textAlign: "center" }}>⚠️</div>
              <h3 style={{ color: "#dc2626", fontSize: 18, fontWeight: 800, textAlign: "center", margin: "8px 0 6px" }}>מחיקת קבוצה לצמיתות</h3>
              <p style={{ fontSize: 13, color: "#475569", textAlign: "center", margin: "0 0 6px", lineHeight: 1.6 }}>
                פעולה זו תמחק <b>לצמיתות</b> את הקבוצה «{expected}», כולל כל השחקניות, החשבונות, הנוכחות, התמונות וכל הנתונים. <b>לא ניתן לשחזר.</b>
              </p>
              <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", margin: "10px 0 6px" }}>כדי לאשר, הקלידי את שם הקבוצה במדויק:</p>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textAlign: "center", background: "#f1f5f9", borderRadius: 8, padding: "6px", marginBottom: 8 }}>{expected}</div>
              <input value={confirmText} onChange={e => { setConfirmText(e.target.value); setDelErr(""); }} placeholder="הקלידי כאן את שם הקבוצה"
                style={{ ...S.input, textAlign: "center", border: `2px solid ${match ? "#22c55e" : "#e2e8f0"}` }} autoFocus />
              {delErr && <p style={{ color: "#dc2626", fontSize: 12, margin: "0 0 8px", fontWeight: 600, textAlign: "center" }}>⚠️ {delErr}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button disabled={busy} onClick={() => { setDeleteTarget(null); setConfirmText(""); setDelErr(""); }}
                  style={{ flex: 1, padding: 12, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>ביטול</button>
                <button disabled={!match || busy} onClick={doDelete}
                  style={{ flex: 1, padding: 12, background: (!match || busy) ? "#fca5a5" : "#dc2626", color: "white", border: "none", borderRadius: 12, cursor: (!match || busy) ? "default" : "pointer", fontSize: 14, fontWeight: 800 }}>
                  {busy ? "מוחק…" : "🗑 מחק לצמיתות"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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
function HomeScreen({ players, events, attendance, settings, notifications, playerProfiles, pc, sc, onSelectPlayer, onAdmin, onHelp, onAbout, onSuperAdmin, onPurchase }) {
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
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={onAbout} style={{ flexShrink: 0, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          <span style={{ color: sc, fontWeight: 800 }}>ℹ</span> אודות
        </button>
      </div>
    </div>
  );

  const adminLink = (
    <div style={{ padding: "8px 0 24px" }}>
      <div style={{ padding: "0 0 14px" }}><PurchaseBanner pc={pc} sc={sc} onClick={onPurchase} /></div>
      <div style={{ textAlign: "center" }}>
        <button onClick={onAdmin} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>🔐 כניסת מנהל</button>
      </div>
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
  const [showPass, setShowPass] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [remember, setRemember] = useState(true);
  const [photo, setPhoto] = useState(prof.photo || null);
  const [phone, setPhone] = useState(prof.phone || "");
  const [whatsapp, setWhatsapp] = useState(prof.whatsapp || "");
  const [email, setEmail] = useState(prof.email || "");
  const [birthday, setBirthday] = useState(prof.birthday || "");
  const photoRef = useRef();
  const [forceChange, setForceChange] = useState(false); // אחרי איפוס: חובה לבחור סיסמה חדשה
  const [newPass, setNewPass] = useState("");
  const [newPassErr, setNewPassErr] = useState("");

  // כניסה: אימות מול Firebase (חשבון אמיתי). אין יותר השוואת סיסמה בצד-לקוח.
  async function tryLogin() {
    if (!pass.trim()) { setLoginError(true); setTimeout(() => setLoginError(false), 1500); return; }
    const res = await emailAuth(playerEmail(CURRENT_TEAM, player.id), pass);
    if (res.ok) {
      if (remember) localStorage.setItem("rememberPlayer_" + player.id, "1");
      else localStorage.removeItem("rememberPlayer_" + player.id);
      await bindPlayerMembership(CURRENT_TEAM, auth.currentUser?.uid, player); // כריכת uid אמיתי ↔ playerId
      // נכנסה עם סיסמה זמנית אחרי איפוס → חובה לבחור סיסמה חדשה
      if ((playerProfiles[player.id] || {}).mustChangePassword) { setForceChange(true); return; }
      onDone();
    }
    else { setLoginError(true); setTimeout(() => setLoginError(false), 1500); }
  }

  // החלפת סיסמה מאולצת אחרי איפוס (השחקנית כבר מחוברת — updatePassword מותר).
  async function submitNewPass() {
    if (newPass.trim().length < 6) { setNewPassErr("הסיסמה חייבת להכיל לפחות 6 תווים"); return; }
    try {
      await updatePassword(auth.currentUser, newPass.trim());
    } catch (e) {
      setNewPassErr("שגיאה בעדכון הסיסמה — נסי להיכנס מחדש"); return;
    }
    const cur = playerProfiles[player.id] || {};
    await upd.playerProfiles({ ...playerProfiles, [player.id]: { ...cur, mustChangePassword: false, setupDone: true } });
    onDone();
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
    else if (pass.trim().length < 6) { setPassError("הסיסמה חייבת להכיל לפחות 6 תווים"); valid = false; }
    else setPassError("");
    if (!phone.trim()) { setPhoneError("יש להזין מספר טלפון"); valid = false; } else setPhoneError("");
    if (!valid) return;
    // יצירת חשבון Firebase אמיתי (או כניסה אם כבר קיים) — הסיסמה נשמרת ב-Firebase, לא בפרופיל.
    const res = await emailAuth(playerEmail(CURRENT_TEAM, player.id), pass.trim());
    if (!res.ok) {
      setPassError(res.error === "weak" ? "הסיסמה חלשה מדי (לפחות 6 תווים)" : "החשבון כבר קיים — נסי להיכנס עם הסיסמה הקיימת, או בקשי איפוס מהמנהלת");
      return;
    }
    // כריכת חברות עם ה-uid האמיתי לפני כתיבת הפרופיל (כדי שכללי שלב 5 יתירו את הכתיבה)
    await bindPlayerMembership(CURRENT_TEAM, auth.currentUser?.uid, player);
    const updated = {
      ...playerProfiles,
      [player.id]: { ...prof, photo, phone, whatsapp, email, birthday, setupDone: true }
    };
    await upd.playerProfiles(updated);
    onDone();
  }

  if (forceChange) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
        <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>🔑</div>
          <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: "8px 0 0" }}>בחירת סיסמה חדשה</h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: "6px 0 0" }}>הסיסמה שלך אופסה. בחרי סיסמה חדשה כדי להמשיך.</p>
        </div>
        <div style={{ padding: 28, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: 300 }}>
            <input type={showPass ? "text" : "password"} value={newPass} onChange={e => { setNewPass(e.target.value); setNewPassErr(""); }}
              placeholder="סיסמה חדשה (לפחות 6 תווים)" autoFocus onKeyDown={e => e.key === "Enter" && submitNewPass()}
              style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 0, paddingLeft: 44, border: `2px solid ${newPassErr ? "#ef4444" : "#e2e8f0"}` }} />
            <button type="button" onClick={() => setShowPass(v => !v)} aria-label="הצג/הסתר סיסמה"
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: 18, padding: 4, lineHeight: 1 }}>{showPass ? "🙈" : "👁️"}</button>
          </div>
          {newPassErr && <p style={{ color: "#ef4444", fontSize: 13, margin: "8px 0 0", fontWeight: 600 }}>⚠️ {newPassErr}</p>}
          <button onClick={submitNewPass} style={{ width: "100%", maxWidth: 300, marginTop: 18, padding: 14, background: pc, color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 16, fontWeight: 800 }}>שמרי והמשיכי ✓</button>
        </div>
      </div>
    );
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
          <div style={{ position: "relative", width: "100%", maxWidth: 260, marginBottom: 10 }}>
            <input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && tryLogin()}
              placeholder="סיסמה אישית" autoFocus
              style={{ ...S.input, width: "100%", maxWidth: "none", marginBottom: 0, boxSizing: "border-box", textAlign: "center", fontSize: 20, letterSpacing: 6, paddingLeft: 44, border: `2px solid ${loginError ? "#ef4444" : "#e2e8f0"}` }} />
            <button type="button" onClick={() => setShowPass(v => !v)} aria-label="הצג/הסתר סיסמה"
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: 18, padding: 4, lineHeight: 1 }}>{showPass ? "🙈" : "👁️"}</button>
          </div>
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
          <div style={{ position: "relative", marginBottom: 10 }}>
            <input type={showPass ? "text" : "password"} value={pass} onChange={e => { setPass(e.target.value); setPassError(""); }} placeholder="בחרי סיסמה לכניסות הבאות (לפחות 6 תווים)" style={{ ...S.input, marginBottom: 0, boxSizing: "border-box", paddingLeft: 44, border: `2px solid ${passError ? "#ef4444" : "#e2e8f0"}` }} />
            <button type="button" onClick={() => setShowPass(v => !v)} aria-label="הצג/הסתר סיסמה"
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: 18, padding: 4, lineHeight: 1 }}>{showPass ? "🙈" : "👁️"}</button>
          </div>
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
function PlayerScreen({ player, events, attendance, players, notifications, games, gallery, playerProfiles, settings, applause, polls, personalNotifs, archive, chat, upd, pc, sc, askConfirm, onBack, onLogout }) {
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
  const [galleryUploading, setGalleryUploading] = useState(false); // מצב טעינה לכפתור ההעלאה
  const [galleryMsg, setGalleryMsg] = useState(""); // הודעת שגיאה/הגבלה לשחקנית
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

  // הגבלה: 5 תמונות לשחקנית ליום (ספירה בצד-לקוח מתוך הגלריה הטעונה).
  const GALLERY_DAILY_LIMIT = 5;
  function uploadedTodayByPlayer() {
    const today = new Date().toDateString();
    return (gallery || []).filter(g =>
      g.playerId === player.id && g.date && new Date(g.date).toDateString() === today
    ).length;
  }

  async function uploadGallery(e) {
    const file = e.target.files[0];
    if (galleryRef.current) galleryRef.current.value = ""; // איפוס כדי לאפשר בחירה חוזרת של אותו קובץ
    if (!file) return;
    setGalleryMsg("");

    // 1) הגבלת 5/יום
    if (uploadedTodayByPlayer() >= GALLERY_DAILY_LIMIT) {
      setGalleryMsg(`הגעת ל-${GALLERY_DAILY_LIMIT} תמונות היום 🏐 אפשר להמשיך מחר`);
      return;
    }
    // 2) ולידציית סוג (הגנה ראשונית; כללי Storage אוכפים גם בצד-שרת)
    if (!file.type || !file.type.startsWith("image/")) {
      setGalleryMsg("אפשר להעלות רק קבצי תמונה");
      return;
    }

    setGalleryUploading(true);
    try {
      const compressed = await compressImage(file); // דחיסה לפני העלאה
      const safeName = (compressed.name || "photo").replace(/[^\w.\-]/g, "_");
      const path = `teams/${CURRENT_TEAM}/gallery/${Date.now()}_${safeName}`; // נתיב לפי קבוצה
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, compressed);
      const url = await getDownloadURL(storageRef);
      await upd.gallery([...gallery, {
        id: Date.now(), playerId: player.id, playerName: player.name,
        photo: url, storagePath: path, date: new Date().toISOString(),
        eventTitle: nextEvent ? `${nextEvent.type === "training" ? "אימון" : "משחק"} ${formatShort(nextEvent.date)}` : "כללי"
      }]);
    } catch (err) {
      console.error("שגיאה בהעלאת תמונה:", err);
      setGalleryMsg("ההעלאה נכשלה, נסי שוב");
    } finally {
      setGalleryUploading(false);
    }
  }

  async function deleteGalleryPhoto(item) {
    try { if (item.storagePath) await deleteObject(ref(storage, item.storagePath)); }
    catch (err) { console.error("שגיאה במחיקת קובץ מ-Storage:", err); }
    await upd.gallery(gallery.filter(g => g.id !== item.id));
    setSelectedPhoto(null);
  }

  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [calSelected, setCalSelected] = useState(null); // יום נבחר בלוח (yyyy-mm-dd)

  const [chatText, setChatText] = useState("");
  const chatEndRef = useRef(null);
  const [chatSeenTs, setChatSeenTs] = useState(() => Number(localStorage.getItem("chatLastSeen_" + player.id) || 0));
  const hasUnreadChat = (chat || []).some(m => m.playerId !== player.id && (m.ts || 0) > chatSeenTs);

  const tabs = [{ key: "event", label: "📅 אירוע" }, { key: "calendar", label: "🗓️ לוח" }, { key: "chat", label: "💬 צ'אט" }, { key: "games", label: "🏆 משחקים" }, { key: "polls", label: "🗳️ סקר" }, { key: "gallery", label: "📸 תמונות מהמשחק" }];

  async function sendChat() {
    const t = chatText.trim();
    if (!t) return;
    setChatText("");
    const id = `${player.id}_${Date.now()}`;
    const msg = { id, playerId: player.id, name: player.name, text: t, ts: Date.now() };
    try {
      // כל הודעה = מסמך נפרד (id כשם המסמך) — אין דריסה, אין אובדן בשליחה במקביל.
      await setDoc(doc(db, "teams", CURRENT_TEAM, "chat", id), msg);
    } catch (err) {
      console.error("שגיאה בשליחת הודעה:", err);
      setChatText(t); // החזרת הטקסט כדי שאפשר לנסות שוב
    }
  }
  async function deleteChatMsg(id) {
    try {
      const m = (chat || []).find(x => x.id === id);
      const docId = (m && m._docId) || id; // הודעות חדשות: _docId === id
      await deleteDoc(doc(db, "teams", CURRENT_TEAM, "chat", docId));
    } catch (err) {
      console.error("שגיאה במחיקת הודעה:", err);
    }
  }
  useEffect(() => {
    if (tab === "chat") {
      if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      const latest = (chat && chat.length) ? Math.max(...chat.map(m => m.ts || 0)) : 0;
      if (latest > chatSeenTs) { localStorage.setItem("chatLastSeen_" + player.id, String(latest)); setChatSeenTs(latest); }
    }
  }, [chat, tab]);

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
      <style>{`@keyframes chatDotPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(1.45); } }`}</style>
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
        <button onClick={() => { localStorage.removeItem("rememberPlayer_" + player.id); onLogout ? onLogout() : onBack(); }} style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>🔓 התנתקי</button>
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
            {t.key === "chat" && hasUnreadChat && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#ef4444", marginInlineStart: 5, verticalAlign: "middle", animation: "chatDotPulse 1s ease-in-out infinite" }} />}
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

        {/* ── CALENDAR TAB ── */}
        {tab === "calendar" && (() => {
          const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
          const dayHeaders = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
          const { y, m } = calMonth;
          const firstDay = new Date(y, m, 1).getDay(); // 0=ראשון
          const daysInMonth = new Date(y, m + 1, 0).getDate();
          const today = todayStr();
          const pad = n => String(n).padStart(2, "0");
          const dateStr = d => `${y}-${pad(m + 1)}-${pad(d)}`;

          // נתונים ליום: אירועים (לא מבוטלים / מבוטלים) + ימי הולדת
          const dayInfo = d => {
            const ds = dateStr(d);
            const evs = (events || []).filter(e => e.date === ds);
            const bdays = (players || []).filter(p => { const b = (playerProfiles[p.id] || {}).birthday; return b && monthDay(b) === `${pad(m + 1)}-${pad(d)}`; });
            return { ds, evs, bdays };
          };

          const cells = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);

          const prevMonth = () => { setCalSelected(null); setCalMonth(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }); };
          const nextMonth = () => { setCalSelected(null); setCalMonth(m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }); };

          const selInfo = calSelected ? (() => {
            const evs = (events || []).filter(e => e.date === calSelected);
            const bdays = (players || []).filter(p => { const b = (playerProfiles[p.id] || {}).birthday; return b && monthDay(b) === calSelected.slice(5); });
            return { evs, bdays };
          })() : null;

          return (
            <div>
              {/* כותרת + ניווט חודשים */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <button onClick={nextMonth} style={{ background: `${pc}12`, border: "none", borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 18, color: pc, fontWeight: 800 }}>▶</button>
                <div style={{ fontSize: 17, fontWeight: 800, color: pc }}>{monthNames[m]} {y}</div>
                <button onClick={prevMonth} style={{ background: `${pc}12`, border: "none", borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 18, color: pc, fontWeight: 800 }}>◀</button>
              </div>

              {/* כותרות ימים */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                {dayHeaders.map((h, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{h}</div>)}
              </div>

              {/* רשת הימים */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {cells.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const info = dayInfo(d);
                  const isToday = info.ds === today;
                  const isSel = info.ds === calSelected;
                  const hasTraining = info.evs.some(e => e.type === "training" && !e.cancelled);
                  const hasGame = info.evs.some(e => e.type === "game" && !e.cancelled);
                  const hasCancelled = info.evs.some(e => e.cancelled);
                  const hasBday = info.bdays.length > 0;
                  const marks = [];
                  if (hasTraining) marks.push("🏋️");
                  if (hasGame) marks.push("🏆");
                  if (hasBday) marks.push("🎂");
                  if (hasCancelled && marks.length === 0) marks.push("❌");
                  return (
                    <button key={i} onClick={() => setCalSelected(isSel ? null : info.ds)}
                      style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, border: isSel ? `2px solid ${pc}` : "1px solid #eef2f7", borderRadius: 10, background: isToday ? pc : (marks.length ? `${pc}0a` : "white"), cursor: "pointer", padding: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 600, color: isToday ? "white" : "#1e293b" }}>{d}</span>
                      {marks.length > 0 && <span style={{ fontSize: 9, lineHeight: 1 }}>{marks.join("")}</span>}
                    </button>
                  );
                })}
              </div>

              {/* פרטי יום נבחר */}
              {calSelected && selInfo && (
                <div style={{ marginTop: 14, background: "#f8fafc", borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: pc, marginBottom: 8 }}>{formatDate(calSelected)}</div>
                  {selInfo.evs.length === 0 && selInfo.bdays.length === 0 && <div style={{ fontSize: 13, color: "#94a3b8" }}>אין אירועים ביום זה.</div>}
                  {selInfo.evs.map(ev => (
                    <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "white", borderRadius: 10, padding: "10px 12px", marginBottom: 8, opacity: ev.cancelled ? 0.6 : 1 }}>
                      <span style={{ fontSize: 22 }}>{ev.type === "training" ? "🏋️" : "🏆"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", textDecoration: ev.cancelled ? "line-through" : "none" }}>{ev.type === "training" ? "אימון" : "משחק"} · {ev.time}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>📍 {ev.location}</div>
                      </div>
                      {ev.cancelled && <span style={{ background: "#fee2e2", color: "#ef4444", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>בוטל</span>}
                    </div>
                  ))}
                  {selInfo.bdays.map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                      <span style={{ fontSize: 22 }}>🎂</span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>יום ההולדת של {p.name}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* מקרא */}
              <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>🏋️ אימון</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>🏆 משחק</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>🎂 יום הולדת</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>❌ בוטל</span>
              </div>
            </div>
          );
        })()}

        {/* ── CHAT TAB ── */}
        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "62vh" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 2px", display: "flex", flexDirection: "column", gap: 8 }}>
              {(!chat || chat.length === 0) && <Empty icon="💬" text="אין הודעות עדיין — התחילי שיחה!" />}
              {(chat || []).map(m => {
                const mine = m.playerId === player.id;
                return (
                  <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                    {!mine && <div style={{ fontSize: 11, color: pc, fontWeight: 700, marginBottom: 2 }}>{m.name}</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: mine ? "row" : "row-reverse" }}>
                      <div style={{ background: mine ? pc : "white", color: mine ? "white" : "#1e293b", borderRadius: 14, padding: "8px 12px", fontSize: 14, lineHeight: 1.4, overflowWrap: "anywhere", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>{m.text}</div>
                      {mine && <button onClick={() => deleteChatMsg(m.id)} style={{ background: "transparent", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 13, padding: 2 }}>🗑</button>}
                    </div>
                    <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 2, textAlign: mine ? "left" : "right" }}>{new Date(m.ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid #eef2f7" }}>
              <input value={chatText} onChange={e => setChatText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendChat(); }} placeholder="הקלידי הודעה..." style={{ ...S.input, margin: 0, flex: 1 }} />
              <button onClick={sendChat} style={{ background: pc, color: "white", border: "none", borderRadius: 10, padding: "0 18px", cursor: "pointer", fontWeight: 800, fontSize: 14 }}>שלחי</button>
            </div>
          </div>
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
              <label style={{ background: galleryUploading ? "#94a3b8" : pc, color: "white", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: galleryUploading ? "default" : "pointer", opacity: galleryUploading ? 0.85 : 1 }}>
                {galleryUploading ? "מעלה..." : "+ העלי תמונה"}
                <input ref={galleryRef} type="file" accept="image/*" onChange={uploadGallery} disabled={galleryUploading} style={{ display: "none" }} />
              </label>
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px" }}>נא להעלות כאן רק תמונות מהמשחקים והאימונים של הקבוצה 🏐</p>
            <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 12px" }}>נותרו לך {Math.max(0, GALLERY_DAILY_LIMIT - uploadedTodayByPlayer())} תמונות להעלאה היום</p>
            {galleryMsg && <p style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, margin: "0 0 12px", textAlign: "center" }}>{galleryMsg}</p>}
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
  const isAdminGoogle = isGoogleUser(authUser); // רק חשבון Google = מנהל; חשבון שחקנית לא נחשב
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
        {isAdminGoogle ? (
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

// ── ADMIN ONBOARDING (אשף הקמת קבוצה למנהלת חדשה) ─────────────────────────────
function AdminOnboarding({ settings, players, upd, pc, sc, isPending, onFinish }) {
  const [step, setStep] = useState(1);
  const [teamName, setTeamName] = useState(settings?.teamName && settings.teamName !== "הקבוצה שלי" ? settings.teamName : "");
  const [newPlayer, setNewPlayer] = useState("");
  const [copied, setCopied] = useState(false);

  const inviteLink = `${window.location.origin}/?team=${CURRENT_TEAM}`;

  async function saveName() {
    const t = teamName.trim();
    if (!t) return;
    await upd.settings({ ...settings, teamName: t });
    setStep(2);
  }
  async function addPlayer() {
    const n = newPlayer.trim();
    if (!n) return;
    await upd.players([...players, { id: Date.now(), name: n, phone: "", email: "", address: "", whatsapp: "" }]);
    setNewPlayer("");
  }
  async function finish() { await completeWizard(); }
  async function skipWizard() {
    // יציאה מהאשף לפאנל הניהול בלי להשלים — שומר את מה שכבר הוקלד ומסמן שלא להציג שוב.
    await completeWizard();
  }
  // שומר onboardingDone+teamName מבלי לדרוס שדות אחרים (צבעים וכו') שאולי נשמרו במקביל.
  // קורא את ה-settings הטרי מהדיסק ומאחה עליו, במקום להסתמך על ה-prop שאולי התיישן.
  async function completeWizard() {
    let base = settings || {};
    try { const fresh = await load(KEYS.settings, null); if (fresh) base = fresh; } catch {}
    await upd.settings({ ...base, teamName: teamName.trim() || base.teamName, onboardingDone: true });
    onFinish();
  }
  function copyLink() {
    try { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  function shareWhatsapp() {
    const msg = `היי! הצטרפי לקבוצת ${teamName.trim() || "הכדורשת"} שלנו באפליקציה 🏐\nהיכנסי לקישור, בחרי את שמך וקבעי סיסמה:\n${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const btn = { background: pc, color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 16, fontWeight: 800, cursor: "pointer", width: "100%" };
  const btnGhost = { background: "transparent", color: "#94a3b8", border: "none", padding: "10px", fontSize: 13, cursor: "pointer", width: "100%" };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, display: "flex", flexDirection: "column" }}>
      {/* מד התקדמות */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ width: 60 }} />
          <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 700 }}>צעד {step} מתוך 3</span>
          <button onClick={skipWizard} style={{ width: 60, background: "transparent", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 12, cursor: "pointer", textAlign: "left" }}>דלגי ✕</button>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.25)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(step / 3) * 100}%`, background: sc, borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 22px" }}>
        <div style={{ background: "white", borderRadius: 20, padding: "28px 22px", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>

          {/* צעד 1 — שם הקבוצה */}
          {step === 1 && (
            <>
              <div style={{ fontSize: 44, textAlign: "center" }}>🏐</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: pc, textAlign: "center", margin: "8px 0 4px" }}>ברוכה הבאה!</h2>
              <p style={{ fontSize: 14, color: "#64748b", textAlign: "center", margin: "0 0 22px" }}>בואי נקים את הקבוצה שלך בכמה צעדים פשוטים. איך קוראים לקבוצה?</p>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveName()}
                placeholder="לדוגמה: קבוצת הכדורשת של הבינלאומי" autoFocus
                style={{ ...S.input, fontSize: 16, textAlign: "center", margin: "0 0 18px" }} />
              <button onClick={saveName} disabled={!teamName.trim()} style={{ ...btn, opacity: teamName.trim() ? 1 : 0.5 }}>המשך ←</button>
            </>
          )}

          {/* צעד 2 — הוספת שחקניות */}
          {step === 2 && (
            <>
              <div style={{ fontSize: 44, textAlign: "center" }}>👥</div>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: pc, textAlign: "center", margin: "8px 0 4px" }}>מי השחקניות?</h2>
              <p style={{ fontSize: 13.5, color: "#64748b", textAlign: "center", margin: "0 0 18px" }}>הוסיפי את שמות השחקניות (אפשר גם אחר כך).</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input value={newPlayer} onChange={e => setNewPlayer(e.target.value)} onKeyDown={e => e.key === "Enter" && addPlayer()}
                  placeholder="שם שחקנית" autoFocus style={{ ...S.input, flex: 1, margin: 0 }} />
                <button onClick={addPlayer} disabled={!newPlayer.trim()} style={{ background: pc, color: "white", border: "none", borderRadius: 10, padding: "0 18px", cursor: "pointer", fontWeight: 800, fontSize: 22, opacity: newPlayer.trim() ? 1 : 0.5 }}>+</button>
              </div>
              {players.length > 0 ? (
                <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 18 }}>
                  {players.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#f8fafc", borderRadius: 10, marginBottom: 6 }}>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: sc, color: pc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", flex: 1 }}>{p.name}</span>
                      <button onClick={() => upd.players(players.filter(x => x.id !== p.id))} style={{ background: "transparent", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 15 }}>🗑</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12.5, color: "#94a3b8", textAlign: "center", margin: "0 0 18px" }}>עדיין לא הוספת שחקניות</p>
              )}
              <button onClick={() => setStep(3)} style={btn}>{players.length > 0 ? `המשך עם ${players.length} שחקניות ←` : "המשך ←"}</button>
              {players.length === 0 && <button onClick={() => setStep(3)} style={btnGhost}>דלגי ואוסיף אחר כך</button>}
            </>
          )}

          {/* צעד 3 — סיום + שיתוף קישור */}
          {step === 3 && (
            <>
              <div style={{ fontSize: 48, textAlign: "center" }}>🎉</div>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: pc, textAlign: "center", margin: "8px 0 4px" }}>{teamName.trim() || "הקבוצה"} מוכנה!</h2>
              <p style={{ fontSize: 13.5, color: "#64748b", textAlign: "center", margin: "0 0 18px" }}>
                {players.length > 0 ? `${players.length} שחקניות נוספו. ` : ""}עכשיו שתפי את הקישור — כל שחקנית תיכנס, תבחר את שמה ותקבע סיסמה.
              </p>
              <div style={{ background: "#f1f5f9", borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: pc, fontWeight: 700, wordBreak: "break-all", textAlign: "center" }}>{inviteLink}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={copyLink} style={{ flex: 1, background: "#e2e8f0", color: "#1e293b", border: "none", borderRadius: 10, padding: "12px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>{copied ? "✓ הועתק" : "📋 העתקי קישור"}</button>
                <button onClick={shareWhatsapp} style={{ flex: 1, background: "#25D366", color: "white", border: "none", borderRadius: 10, padding: "12px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📱 וואטסאפ</button>
              </div>
              {isPending && (
                <div style={{ background: "#fef9c3", borderRadius: 10, padding: "10px 12px", margin: "6px 0 14px", fontSize: 12, color: "#854d0e", textAlign: "center", lineHeight: 1.5 }}>
                  ⏳ הקבוצה תיפתח לשחקניות זמן קצר לאחר אישור. בינתיים אפשר להגדיר הכל.
                </div>
              )}
              <button onClick={finish} style={btn}>סיום — לפאנל הניהול</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ADMIN PANEL ───────────────────────────────────────────────────────────────
function AdminPanel(props) {
  const [tab, setTab] = useState("attendance");
  const { pc, sc, onBack, onLogout, teamMeta, askConfirm, settings, players, upd } = props;
  const isPending = (teamMeta?.status || "active") === "pending";
  // אשף הקמה למנהלת חדשה: קבוצה שאינה הבינלאומי, טרם הושלם onboarding, ואין עדיין שחקניות.
  // אשף הקמה למנהלת חדשה: מותנה אך ורק בדגל onboardingDone (יציב — לא תלוי במספר שחקניות).
  // הבינלאומי מוחרגת (היא ותיקה ואין לה את הדגל). מנהלת שטרם השלימה רואה אשף; שהשלימה — לא.
  const [showWizard, setShowWizard] = useState(
    CURRENT_TEAM !== DEFAULT_TEAM && !settings?.onboardingDone
  );
  if (showWizard) {
    return <AdminOnboarding settings={settings} players={players} upd={upd} pc={pc} sc={sc} isPending={isPending} onFinish={() => setShowWizard(false)} />;
  }
  const tabs = [["attendance","📋 נוכחות"],["events","📅 אירועים"],["games","🏆 משחקים"],["players","👥 שחקניות"],["notifications","💬 הודעות"],["polls","🗳️ סקר"],["gallery","📸 תמונות מהמשחק"],["archive","📊 ארכיון"],["settings","⚙️ הגדרות"]];

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}bb)`, padding: "18px 16px 14px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        {onLogout && <button onClick={() => askConfirm ? askConfirm("להתנתק מחשבון המנהל?", onLogout) : onLogout()} style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>🔓 התנתק</button>}
        <div style={{ fontSize: 32 }}>🔐</div>
        <h2 style={{ color: "white", fontSize: 16, fontWeight: 700, margin: "4px 0 0" }}>פאנל מנהל</h2>
      </div>
      {isPending && (
        <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", borderBottom: "1px solid #fcd34d", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>⏳</span>
          <div style={{ fontSize: 12.5, color: "#92400e", fontWeight: 600, lineHeight: 1.45 }}>
            הקבוצה ממתינה לאישור — את/ה יכול/ה להקים הכול, אך <strong>השחקניות עדיין לא רואות אותה</strong>. לאחר ההפעלה — היא תיפתח לכולן.
          </div>
        </div>
      )}
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
function AdminAttendance({ players, events, attendance, playerProfiles, upd, pc, sc, askConfirm, settings, notify }) {
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
    if (sent === 0) notify("אין מספרי וואטסאפ לשחקניות שטרם ענו. הוסיפי אותם בלשונית שחקניות.");
  }

  // תזכורת קבוצתית: הודעה אחת עם שמות החוסרים, לשיתוף לקבוצת הוואטסאפ.
  // (קישור chat.whatsapp.com הוא קישור הצטרפות בלבד — לא ניתן לשלוח אליו טקסט מוכן,
  //  לכן: שיתוף נייטיב אם נתמך, אחרת העתקה ללוח + פתיחת הקבוצה.)
  async function shareGroupReminder() {
    const pending = getList("pending");
    if (pending.length === 0) return;
    const names = pending.map(p => p.name).join(", ");
    const kind = nextEvent.type === "training" ? "לאימון" : "למשחק";
    const text = `🏐 טרם סימנו הגעה ${kind} ב-${formatShort(nextEvent.date)}: ${names}.\nאנא סמנו באפליקציה 🙏`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch (e) { if (e && e.name === "AbortError") return; } // המשתמשת ביטלה — לא ליפול להעתקה
    try {
      await navigator.clipboard.writeText(text);
      const grp = (settings && settings.whatsappGroup) || "";
      notify("✅ רשימת החוסרים הועתקה. " + (grp ? "פותחת את קבוצת הוואטסאפ — הדביקי שם." : "הדביקי בקבוצת הוואטסאפ."));
      if (grp) window.open(grp, "_blank");
    } catch {
      notify("לא ניתן להעתיק אוטומטית. הרשימה:\n\n" + text);
    }
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
          💬 שלח וואטסאפ אישי לשחקניות שלא סימנו הגעה ({countAtt("pending")})
        </button>
      )}
      {countAtt("pending") > 0 && (
        <button onClick={shareGroupReminder}
          style={{ width: "100%", padding: "10px", background: "white", color: "#16a34a", border: "2px solid #25D366", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
          📢 תזכורת קבוצתית עם שמות החוסרות ({countAtt("pending")})
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
function AdminEvents({ events, settings, attendance, archive, notifications, players, playerProfiles, upd, pc, sc, askConfirm, notify }) {
  const [adding, setAdding] = useState(false);
  const [newEv, setNewEv] = useState({ type: "training", date: "", time: "16:30", location: settings.defaultTrainingLocation, note: "", open: true });
  const [calView, setCalView] = useState("list"); // "list" | "calendar"
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [calSelected, setCalSelected] = useState(null);

  async function addEvent() {
    if (!newEv.date) return;
    // חסימת תאריך עבר: אירוע נקבע מהיום והלאה בלבד (מגן גם מהקלדה ידנית).
    if (newEv.date < todayStr()) { notify("לא ניתן לקבוע אירוע בתאריך שעבר. בחרי תאריך מהיום והלאה."); return; }
    await upd.events([...events, { ...newEv, id: Date.now() }]);
    setAdding(false);
    setNewEv({ type: "training", date: "", time: "16:30", location: settings.defaultTrainingLocation, note: "", open: true });
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
    await upd.events(events.map(e => e.id === ev.id ? { ...e, cancelled: true } : e));
    // 2) הודעת ביטול בדף הבית (קדימות אדומה, תוקף עד סוף יום האירוע)
    const notif = { id: Date.now(), type: "cancel", text: txt, active: true, createdAt: new Date().toISOString(), expiresOn: ev.date, eventId: ev.id };
    await upd.notifications([...(notifications || []), notif]);
    // 3) שיתוף ידני לוואטסאפ
    setWaCopied(false);
    setWaShare(txt);
  }

  async function undoCancel(ev) {
    await upd.events(events.map(e => e.id === ev.id ? { ...e, cancelled: false } : e));
    await upd.notifications((notifications || []).filter(n => !(n.type === "cancel" && n.eventId === ev.id)));
  }

  async function shareCancelWA(txt) {
    try { await navigator.clipboard.writeText(txt); setWaCopied(true); } catch (e) { setWaCopied(false); }
    const link = settings && settings.whatsappGroup ? settings.whatsappGroup : "";
    if (link) setTimeout(() => window.open(link, "_blank"), 300);
    else notify("לא הוגדר קישור לקבוצת וואטסאפ. אפשר להוסיף בהגדרות.");
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

      {!adding && <>
      {/* מתג רשימה / לוח */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["list", "📋 רשימה"], ["calendar", "🗓️ לוח"]].map(([v, lbl]) => (
          <button key={v} onClick={() => { setCalView(v); setCalSelected(null); }}
            style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: calView === v ? `2px solid ${pc}` : "2px solid #e2e8f0", background: calView === v ? `${pc}12` : "white", color: calView === v ? pc : "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: calView === v ? 800 : 600 }}>{lbl}</button>
        ))}
      </div>

      {calView === "calendar" && (() => {
        const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
        const dayHeaders = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
        const { y, m } = calMonth;
        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const today = todayStr();
        const pad = n => String(n).padStart(2, "0");
        const dateStr = d => `${y}-${pad(m + 1)}-${pad(d)}`;
        const cells = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        const prevMonth = () => { setCalSelected(null); setCalMonth(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }); };
        const nextMonth = () => { setCalSelected(null); setCalMonth(m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }); };
        const dayEvents = ds => (events || []).filter(e => e.date === ds);
        const dayBdays = ds => (players || []).filter(p => { const b = (playerProfiles[p.id] || {}).birthday; return b && monthDay(b) === ds.slice(5); });
        const startAdd = ds => { setNewEv({ type: "training", date: ds, time: "16:30", location: settings.defaultTrainingLocation, note: "", open: true }); setAdding(true); window.scrollTo({ top: 0, behavior: "smooth" }); };

        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button onClick={nextMonth} style={{ background: `${pc}12`, border: "none", borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 18, color: pc, fontWeight: 800 }}>▶</button>
              <div style={{ fontSize: 17, fontWeight: 800, color: pc }}>{monthNames[m]} {y}</div>
              <button onClick={prevMonth} style={{ background: `${pc}12`, border: "none", borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 18, color: pc, fontWeight: 800 }}>◀</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
              {dayHeaders.map((h, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{h}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const ds = dateStr(d);
                const evs = dayEvents(ds);
                const isToday = ds === today;
                const isSel = ds === calSelected;
                const marks = [];
                if (evs.some(e => e.type === "training" && !e.cancelled)) marks.push("🏋️");
                if (evs.some(e => e.type === "game" && !e.cancelled)) marks.push("🏆");
                if (dayBdays(ds).length > 0) marks.push("🎂");
                if (evs.some(e => e.cancelled) && marks.length === 0) marks.push("❌");
                return (
                  <button key={i} onClick={() => setCalSelected(isSel ? null : ds)}
                    style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, border: isSel ? `2px solid ${pc}` : "1px solid #eef2f7", borderRadius: 10, background: isToday ? pc : (marks.length ? `${pc}0a` : "white"), cursor: "pointer", padding: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 600, color: isToday ? "white" : "#1e293b" }}>{d}</span>
                    {marks.length > 0 && <span style={{ fontSize: 9, lineHeight: 1 }}>{marks.join("")}</span>}
                  </button>
                );
              })}
            </div>

            {calSelected && (() => {
              const evs = dayEvents(calSelected);
              const bdays = dayBdays(calSelected);
              return (
                <div style={{ marginTop: 14, background: "#f8fafc", borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: pc, marginBottom: 10 }}>{formatDate(calSelected)}</div>
                  {evs.map(ev => (
                    <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "white", borderRadius: 10, padding: "10px 12px", marginBottom: 8, opacity: ev.cancelled ? 0.6 : 1 }}>
                      <span style={{ fontSize: 22 }}>{ev.type === "training" ? "🏋️" : "🏆"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", textDecoration: ev.cancelled ? "line-through" : "none" }}>{ev.type === "training" ? "אימון" : "משחק"} · {ev.time}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>📍 {ev.location}</div>
                      </div>
                      {ev.cancelled && <span style={{ background: "#fee2e2", color: "#ef4444", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>בוטל</span>}
                    </div>
                  ))}
                  {bdays.map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                      <span style={{ fontSize: 22 }}>🎂</span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>יום ההולדת של {p.name}</div>
                    </div>
                  ))}
                  <button onClick={() => startAdd(calSelected)} style={{ width: "100%", padding: 11, background: pc, color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 800, marginTop: 4 }}>➕ אירוע חדש ביום זה</button>
                </div>
              );
            })()}

            <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>🏋️ אימון</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>🏆 משחק</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>🎂 יום הולדת</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>❌ בוטל</span>
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 10 }}>טיפ: לחצי על יום כדי לראות פרטים או להוסיף אירוע.</p>
          </div>
        );
      })()}

      {calView === "list" && <>
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
      </>}
      </>}
    </div>
  );
}

// ── ADMIN GAMES ───────────────────────────────────────────────────────────────
function AdminGames({ games, upd, pc, sc, askConfirm, notify }) {
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
            <button onClick={async () => {
              if (!newG.date || !newG.opponent) return;
              // חסימת תאריך עבר: משחק נקבע מהיום והלאה בלבד (מגן גם מהקלדה ידנית שעוקפת את min).
              if (newG.date < todayStr()) { notify("לא ניתן לקבוע משחק בתאריך שעבר. בחרי תאריך מהיום והלאה."); return; }
              await upd.games([...games, { ...newG, id: Date.now() }]); setAdding(false); setNewG({ date: "", time: "18:00", opponent: "", location: "", result: null }); }}
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
function AdminPlayers({ players, playerProfiles, upd, pc, sc, askConfirm, notify }) {
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
    setResetMsg({ name: p.name, loading: true });
    try {
      const res = await adminResetPlayer(CURRENT_TEAM, p.id);
      if (res && res.ok) setResetMsg({ name: p.name, temp: res.tempPassword, whatsapp: (playerProfiles[p.id] || {}).whatsapp || "" });
      else setResetMsg({ name: p.name, error: "האיפוס נכשל" });
    } catch (e) {
      setResetMsg({ name: p.name, error: e.message || "שגיאה באיפוס" });
    }
  }

  async function deletePlayerFull(p) {
    try {
      await adminDeletePlayerRemote(CURRENT_TEAM, p.id);
    } catch (e) {
      notify("המחיקה נכשלה: " + (e.message || "שגיאה"));
      return;
    }
    // ה-Function מחקה הכל בשרת (חשבון + מסמכים + רשימה). מעדכנים גם את ה-state המקומי.
    upd.players(players.filter(x => x.id !== p.id));
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
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 14px", marginBottom: 12, fontSize: 13, color: "#9a3412", position: "relative" }}>
          <button onClick={() => setResetMsg(null)} style={{ position: "absolute", left: 8, top: 8, background: "transparent", border: "none", cursor: "pointer", fontSize: 16, color: "#9a3412" }}>✕</button>
          {resetMsg.loading ? (
            <span style={{ fontWeight: 600 }}>🔑 מאפס סיסמה ל{resetMsg.name}…</span>
          ) : resetMsg.error ? (
            <span style={{ fontWeight: 600, color: "#dc2626" }}>⚠️ {resetMsg.name}: {resetMsg.error}</span>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>🔑 סיסמה זמנית ל{resetMsg.name}:</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3, color: "#ea580c", background: "white", borderRadius: 8, padding: "8px 12px", textAlign: "center", margin: "6px 0", fontFamily: "monospace" }}>{resetMsg.temp}</div>
              <div style={{ fontSize: 12, marginBottom: 8 }}>העבירי לה אותה. בכניסה הבאה היא תתבקש לבחור סיסמה חדשה.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { try { navigator.clipboard.writeText(resetMsg.temp); } catch {} }}
                  style={{ flex: 1, background: "#fde68a", color: "#92400e", border: "none", borderRadius: 8, padding: "8px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>📋 העתק</button>
                {resetMsg.whatsapp && (
                  <button onClick={() => window.open(`https://wa.me/${resetMsg.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`היי ${resetMsg.name}, הסיסמה הזמנית שלך לאפליקציה: ${resetMsg.temp}\nבכניסה הבאה תתבקשי לבחור סיסמה חדשה.`)}`, "_blank")}
                    style={{ flex: 1, background: "#25D366", color: "white", border: "none", borderRadius: 8, padding: "8px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>📱 שלח בוואטסאפ</button>
                )}
              </div>
            </>
          )}
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
                <button onClick={() => askConfirm(`לאפס את הסיסמה של ${p.name}? תיווצר סיסמה זמנית שתעבירי לה, והיא תבחר סיסמה חדשה בכניסה הבאה.`, () => resetPassword(p))}
                  style={{ background: "#fff7ed", color: "#ea580c", border: "none", borderRadius: 7, padding: "6px 9px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🔑</button>
                <button onClick={() => expanded === p.id ? setExpanded(null) : startEdit(p)}
                  style={{ background: `${pc}15`, color: pc, border: "none", borderRadius: 7, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️</button>
                <button onClick={() => askConfirm(`למחוק לצמיתות את ${p.name}? הפעולה תמחק את חשבונה, הפרופיל וכל הנתונים שלה — לא ניתן לשחזר.`, () => deletePlayerFull(p))}
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
function AdminNotifications({ notifications, players, playerProfiles, events, settings, upd, pc, sc, askConfirm, notify }) {
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
    else notify("לא הוגדר קישור לקבוצת וואטסאפ. אפשר להוסיף בהגדרות.");
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
function ArchiveStats({ archive, players, playerProfiles, pc, sc, notify }) {
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
      notify("שגיאה בייצוא הקובץ. נסה שוב.");
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
function AdminSettings({ settings, upd, pc, sc, notify }) {
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
        <button onClick={() => { localStorage.removeItem("whatsNewSeenVer"); notify("מסך 'מה חדש' יוצג לך שוב בכניסה הבאה. לכל שחקנית הוא יוצג פעם אחת אוטומטית כשמשתחררת גרסה חדשה."); }}
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

// ── ABOUT SCREEN ──────────────────────────────────────────────────────────────
function AboutScreen({ pc, sc, settings, onBack }) {
  const faq = [
    { q: "איך מתקינים את האפליקציה על הנייד?", a: "אנדרואיד (Chrome): תפריט ⋮ ← 'הוסף למסך הבית'. אייפון (Safari): כפתור שיתוף ↑ ← 'הוסף למסך הבית'. כך האפליקציה תיפתח ישירות ומהר יותר." },
    { q: "איך נכנסים בפעם הראשונה?", a: "לחצי על שמך ברשימה במסך הבית, בחרי סיסמה אישית (לפחות 6 תווים) והוסיפי פרטי קשר. מהפעם הבאה — רק שם וסיסמה." },
    { q: "שכחתי את הסיסמה — מה עושים?", a: "פני למנהלת הקבוצה, והיא תאפס לך אותה ותעביר לך סיסמה זמנית. בכניסה הבאה תתבקשי לבחור סיסמה חדשה משלך." },
    { q: "איך מאשרים הגעה לאימון?", a: "לחצי על שמך, ואז על 'מגיעה' או 'לא מגיעה'. אפשר להוסיף הערה, ואפשר לשנות את התשובה בכל עת לפני האימון." },
    { q: "איך רואים מי מגיעה?", a: "במסך הבית לחצי על המספרים (מגיעות / לא מגיעות / טרם ענו) כדי לראות את שמות השחקניות בכל קטגוריה." },
    { q: "איך שולחים הודעה בצ'אט?", a: "בלשונית '💬 צ'אט' כותבים הודעה ושולחים — כולן רואות מיד. נקודה אדומה מהבהבת ליד הצ'אט מסמנת שיש הודעות חדשות שלא קראת." },
    { q: "איפה רואים את לוח המשחקים?", a: "בלשונית '🏆 משחקים' מופיע לוח המשחקים הקרובים. לאחר משחק מוצגת גם התוצאה (ניצחון/הפסד/תיקו)." },
    { q: "מה זה מחיאות כפיים?", a: "בלשונית האירוע אפשר לשלוח 'כל הכבוד' לחברות שהגיעו לאימון או למשחק האחרון — פעם ביום לכל אחת. בפרופיל שלך תראי כמה מחיאות כפיים קיבלת החודש!" },
    { q: "איך מצביעים בסקר?", a: "בלשונית '🗳️ סקר' אפשר להצביע על נושאים שהמנהלת פותחת (למשל איפה לחגוג סוף עונה). ניתן לשנות את הבחירה, והתוצאות מוצגות מיד." },
    { q: "איך מקבלים ברכת יום הולדת?", a: "הוסיפי תאריך לידה בפרופיל שלך, ותקבלי ברכה חמה מהקבוצה ביום ההולדת! 🎉" },
    { q: "איך מעלים תמונה?", a: "בלשונית '📸 תמונות מהמשחק' לחצי על '+ העלי תמונה'. כדי למחוק תמונה שהעלית — לחצי עליה ואז על 'מחקי תמונה'." },
    { q: "הנתונים שלי מאובטחים?", a: "כן. לכל שחקנית חשבון אישי ומאובטח, וכל אחת רואה ועורכת רק את הפרטים שלה. הסיסמאות מאוחסנות בצורה מוצפנת ואינן גלויות לאיש." },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "28px 20px 36px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        <div style={{ fontSize: 48 }}>🏐</div>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: "8px 0 4px" }}>אודות</h2>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: 0 }}>{settings.teamName}</p>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ ...S.card, marginBottom: 14, textAlign: "center", padding: "20px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: pc, marginBottom: 4 }}>{settings.teamName || "הקבוצה שלי"}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>אפליקציה לניהול קבוצת הכדורשת</div>
          <div style={{ display: "inline-block", background: `${pc}10`, borderRadius: 10, padding: "8px 16px" }}>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>פותח על ידי</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: pc }}>אפי לוי</div>
          </div>
          <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 12 }}>{WHATS_NEW.versionName || `גרסה ${WHATS_NEW.version}`}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 4px 10px" }}>
          <span style={{ fontSize: 20 }}>❓</span>
          <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 16 }}>שאלות ותשובות</span>
        </div>
        {faq.map((item, i) => (
          <div key={i} style={{ ...S.card, marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: pc, fontSize: 14, marginBottom: 5 }}>{item.q}</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-line" }}>{item.a}</div>
          </div>
        ))}

        <div style={{ background: `${sc}30`, borderRadius: 14, padding: 16, textAlign: "center", marginTop: 8 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>💙</div>
          <div style={{ fontSize: 13, color: pc, fontWeight: 600 }}>תודה שאתן חלק מהקבוצה!</div>
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
