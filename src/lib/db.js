import { db, functions } from "../firebase";
import { doc, getDoc, setDoc, getDocs, collection, deleteDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { DEFAULT_TEAM, BIBLEUMI_ADMIN_EMAILS, KEYS, DEFAULT_SETTINGS } from "./constants";

// האם הגיעה קבוצה מפורשת ב-URL (?team=). אם לא — מציגים דף נחיתה (לא מנחשים מ-localStorage ישן).
let TEAM_FROM_URL = false;
function resolveInitialTeam() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("team");
    if (fromUrl) {
      TEAM_FROM_URL = true;
      localStorage.setItem("currentTeamId", fromUrl);
      // נשמר ל-PWA: הסקריפט ב-index.html משחזר את ?team= מכאן כשפותחים מהאייקון (start_url חשוף).
      localStorage.setItem("pwaTeam", fromUrl);
      return fromUrl;
    }
  } catch {}
  // אין ?team= → ברירת מחדל זמנית (כדי שקוד תלוי-קבוצה לא יקרוס), אך נציג דף נחיתה.
  return DEFAULT_TEAM;
}
let CURRENT_TEAM = resolveInitialTeam();
function setCurrentTeam(id) {
  CURRENT_TEAM = id;
  TEAM_FROM_URL = true; // ברגע שנבחרה קבוצה (כניסת מנהל/בחירת בינלאומי) — לא דף נחיתה
  try { localStorage.setItem("currentTeamId", id); localStorage.setItem("pwaTeam", id); } catch {}
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
// ── שלב 3: תיקון נכונות — סקרים/מחיאות/התראות מ-מסמך-יחיד ל-subcollection ─────
// הבאג הישן: כל השלושה נשמרו כמסמך יחיד (מערך/מפה) עם read-modify-write. שתי
// שחקניות שכותבות במקביל דורסות זו את זו (last-write-wins) — בדיוק כמו שהיה בצ'אט.
// המבנה החדש: מסמך-פר-פריט. כל כתיבה נוגעת רק במסמך/שדה שלה, בלי דריסה.
// הקריאה נעשית ב-App דרך onSnapshot (זמן-אמת), כמו הצ'אט והנוכחות.

// polls: teams/{t}/polls/{pollId} — כל סקר מסמך נפרד; ההצבעה = עדכון שדה בודד.
// updateDoc על נתיב-שדה votes.{playerId} משנה רק את הקול הזה — קולות מקבילים לא מתנגשים.
async function pollVote(pollId, playerId, optionIdx) {
  try { await updateDoc(doc(db, "teams", CURRENT_TEAM, "polls", String(pollId)), { ["votes." + playerId]: optionIdx }); }
  catch (e) { console.error("pollVote:", e); throw e; }
}
async function pollUpsert(poll) { // יצירה/עדכון סקר (מנהלת)
  try { await setDoc(doc(db, "teams", CURRENT_TEAM, "polls", String(poll.id)), poll); }
  catch (e) { console.error("pollUpsert:", e); throw e; }
}
async function pollSetActive(pollId, active) {
  try { await updateDoc(doc(db, "teams", CURRENT_TEAM, "polls", String(pollId)), { active }); }
  catch (e) { console.error("pollSetActive:", e); throw e; }
}
async function pollDelete(pollId) {
  try { await deleteDoc(doc(db, "teams", CURRENT_TEAM, "polls", String(pollId))); }
  catch (e) { console.error("pollDelete:", e); throw e; }
}

// applause: teams/{t}/applause/{id} — מסמך לכל מחיאה (append). setDoc על id ייחודי לא דורס כלום.
async function applauseAdd(entry) {
  try { await setDoc(doc(db, "teams", CURRENT_TEAM, "applause", String(entry.id)), entry); }
  catch (e) { console.error("applauseAdd:", e); throw e; }
}

// personalNotifs: teams/{t}/personalNotifs/{playerId} = { items: [...] }.
// הוספה חוצת-שחקניות (מחיאה/ברכה לנמענת) = arrayUnion — הוספה אטומית בלי לדרוס פריטים אחרים.
async function personalNotifAdd(playerId, notif) {
  try { await setDoc(doc(db, "teams", CURRENT_TEAM, "personalNotifs", String(playerId)), { items: arrayUnion(notif) }, { merge: true }); }
  catch (e) { console.error("personalNotifAdd:", e); throw e; }
}
// סימון כנקרא — הבעלים בלבד כותב את המסמך שלו (התנגשות עצמית נדירה, סיכון נמוך).
async function personalNotifSetItems(playerId, items) {
  try { await setDoc(doc(db, "teams", CURRENT_TEAM, "personalNotifs", String(playerId)), { items }, { merge: true }); }
  catch (e) { console.error("personalNotifSetItems:", e); throw e; }
}

export {
  CURRENT_TEAM, TEAM_FROM_URL, setCurrentTeam, load, save,
  groupAttendanceByPlayer, loadAttendanceSplit, saveAttendanceSplit,
  loadProfilesSplit, saveProfilesSplit, loadPlayerSecret,
  loadUserTeam, saveUserTeam, inviteKey, loadInvite, saveInvite,
  saveJoinRequest, loadJoinRequests, deleteJoinRequest,
  loadTeamKey, saveTeamKey, addTeamAdmin, writeMember, bindPlayerMembership,
  adminResetPlayer, adminDeletePlayerRemote, adminDeleteTeamRemote,
  syncTeamIndex, listAllTeams, setTeamStatus, seedNewTeam, generateTeamId, resolveAdminTeam,
  pollVote, pollUpsert, pollSetActive, pollDelete, applauseAdd, personalNotifAdd, personalNotifSetItems,
};
