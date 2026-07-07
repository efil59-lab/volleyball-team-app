/**
 * Cloud Functions — ניהול חשבונות שחקניות (איפוס סיסמה, מחיקה).
 * כל פעולה מאמתת שהקוראת היא מנהלת מורשית של הקבוצה (לפי meta.adminUids),
 * או בעל המוצר (super-admin). שימוש ב-Admin SDK — פעולות שאסור לבצע מצד-לקוח.
 */

const { onCall, HttpsError } = require("firebase-functions/https");
const { setGlobalOptions } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

const db = admin.firestore();
const SUPER_ADMIN_EMAIL = "efil59@gmail.com";

// חייב להיות זהה ל-playerEmail באפליקציה (App.jsx).
function playerEmail(teamId, playerId) {
  const t = String(teamId).toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${t}-p${playerId}@players.bibleumi.app`;
}

// סיסמה זמנית אקראית (8 תווים, ללא תווים מבלבלים כמו O/0/I/l).
function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// אימות: הקוראת היא בעל המוצר, או uid שלה ב-adminUids של הקבוצה.
async function assertAdmin(auth, teamId) {
  if (!auth) throw new HttpsError("unauthenticated", "נדרשת התחברות");
  const email = ((auth.token && auth.token.email) || "").toLowerCase();
  if (email === SUPER_ADMIN_EMAIL) return;
  const metaSnap = await db.doc(`teams/${teamId}/data/meta`).get();
  const meta = metaSnap.exists ? (metaSnap.data().value || {}) : {};
  const admins = meta.adminUids || [];
  if (!admins.includes(auth.uid)) {
    throw new HttpsError("permission-denied", "אין הרשאת ניהול לקבוצה זו");
  }
}

// ── איפוס סיסמה: מגדיר סיסמה זמנית, מסמן שחובה להחליפה, ומחזיר אותה למנהלת ──
exports.adminResetPlayerPassword = onCall(async (request) => {
  const { teamId, playerId } = request.data || {};
  if (!teamId || playerId === undefined || playerId === null) {
    throw new HttpsError("invalid-argument", "חסר teamId או playerId");
  }
  await assertAdmin(request.auth, teamId);

  const email = playerEmail(teamId, playerId);
  const tempPassword = randomPassword();

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: tempPassword });
  } catch (e) {
    if (e.code === "auth/user-not-found") {
      await admin.auth().createUser({ email, password: tempPassword });
    } else {
      throw new HttpsError("internal", "שגיאה בעדכון החשבון: " + e.message);
    }
  }

  // השחקנית נשארת "setupDone" (רואה מסך כניסה), אך תיאלץ להחליף סיסמה אחרי הכניסה.
  await db.doc(`teams/${teamId}/profiles/${playerId}`)
    .set({ mustChangePassword: true }, { merge: true });

  return { ok: true, tempPassword };
});

// ── מחיקת שחקנית נקייה: חשבון Firebase + פרופיל/סוד/נוכחות + חברות + רשימה ──
exports.adminDeletePlayer = onCall(async (request) => {
  const { teamId, playerId } = request.data || {};
  if (!teamId || playerId === undefined || playerId === null) {
    throw new HttpsError("invalid-argument", "חסר teamId או playerId");
  }
  await assertAdmin(request.auth, teamId);

  const email = playerEmail(teamId, playerId);
  const pid = String(playerId);
  const pidNum = Number(playerId);

  // 1) מחיקת חשבון Firebase (אם קיים)
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().deleteUser(user.uid);
  } catch (e) {
    if (e.code !== "auth/user-not-found") {
      throw new HttpsError("internal", "שגיאה במחיקת החשבון: " + e.message);
    }
  }

  // 2) מחיקת מסמכי השחקנית
  await Promise.all([
    db.doc(`teams/${teamId}/profiles/${pid}`).delete().catch(() => {}),
    db.doc(`teams/${teamId}/secrets/${pid}`).delete().catch(() => {}),
    db.doc(`teams/${teamId}/attendance/${pid}`).delete().catch(() => {}),
  ]);

  // 3) מחיקת מסמכי חברות שמצביעים ל-playerId הזה
  const memSnap = await db.collection(`teams/${teamId}/members`)
    .where("playerId", "==", pidNum).get();
  await Promise.all(memSnap.docs.map((d) => d.ref.delete().catch(() => {})));

  // 4) הסרה מרשימת השחקניות (data/players, עטוף ב-value)
  const playersRef = db.doc(`teams/${teamId}/data/players`);
  const playersSnap = await playersRef.get();
  if (playersSnap.exists) {
    const list = (playersSnap.data().value || []).filter((p) => Number(p.id) !== pidNum);
    await playersRef.set({ value: list });
  }

  return { ok: true };
});

// ── מחיקת קבוצה מלאה — סופר-אדמין בלבד, הבינלאומי מוגנת ─────────────────────
exports.adminDeleteTeam = onCall(async (request) => {
  const { teamId } = request.data || {};
  if (!teamId) throw new HttpsError("invalid-argument", "חסר teamId");

  // סופר-אדמין בלבד (לא כל מנהל)
  const email = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();
  if (email !== SUPER_ADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "מחיקת קבוצה מותרת לבעל המוצר בלבד");
  }
  // הגנה על הקבוצה הראשית
  if (teamId === "bibleumi") {
    throw new HttpsError("failed-precondition", "לא ניתן למחוק את קבוצת הבינלאומי הראשית");
  }

  // 1) מחיקת חשבונות Firebase של כל השחקניות
  let deletedAccounts = 0;
  try {
    const playersSnap = await db.doc(`teams/${teamId}/data/players`).get();
    const players = playersSnap.exists ? (playersSnap.data().value || []) : [];
    for (const p of players) {
      try {
        const u = await admin.auth().getUserByEmail(playerEmail(teamId, p.id));
        await admin.auth().deleteUser(u.uid);
        deletedAccounts++;
      } catch (e) { /* user-not-found — שחקנית שלא נכנסה מעולם */ }
    }
  } catch (e) { /* אין מסמך players */ }

  // 2) מחיקת כל מסמכי הקבוצה כולל תת-האוספים (data/members/attendance/profiles/secrets)
  await admin.firestore().recursiveDelete(db.doc(`teams/${teamId}`));

  // 3) מחיקת רשומת האינדקס
  await db.doc(`teamIndex/${teamId}`).delete().catch(() => {});

  // 4) מחיקת מסמכי users הממופים לקבוצה
  const usersSnap = await db.collection("users").where("teamId", "==", teamId).get();
  await Promise.all(usersSnap.docs.map((d) => d.ref.delete().catch(() => {})));

  // 5) מחיקת הזמנות (invites) הממופות לקבוצה — אחרת מייל שאושר ונמחק "ייכנס" שוב לקבוצת-רפאים
  const invitesSnap = await db.collection("invites").where("teamId", "==", teamId).get();
  await Promise.all(invitesSnap.docs.map((d) => d.ref.delete().catch(() => {})));

  return { ok: true, deletedAccounts };
});
// ═══════════════════════════════════════════════════════════════════════════════
// שלב 4 — תזכורות אמיתיות (Web Push) + מייל תקציר שגיאות
// ═══════════════════════════════════════════════════════════════════════════════

const { onSchedule } = require("firebase-functions/scheduler");

const TZ = "Asia/Jerusalem";

// תאריך YYYY-MM-DD בשעון ישראל, עם היסט ימים אופציונלי
function ilDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

async function getTeamValue(teamId, key, fallback) {
  const snap = await db.doc(`teams/${teamId}/data/${key}`).get();
  return snap.exists ? (snap.data().value ?? fallback) : fallback;
}

// כל טוקני הדחיפה של קבוצה: [{token, role, playerId, ref}]
async function getTeamPushTokens(teamId) {
  const snap = await db.collection(`teams/${teamId}/pushTokens`).get();
  return snap.docs.map((d) => ({ ...d.data(), token: d.id, ref: d.ref }));
}

// שליחת push לרשימת טוקנים + ניקוי טוקנים מתים (מכשיר שהוחלף/הרשאה שבוטלה).
async function sendPush(tokenDocs, { title, body, url, tag }) {
  if (!tokenDocs.length) return { sent: 0 };
  const messages = tokenDocs.map((t) => ({
    token: t.token,
    webpush: {
      notification: { title, body, icon: "/logo192.png", badge: "/logo192.png", dir: "rtl", lang: "he", tag: tag || undefined },
      fcmOptions: url ? { link: url } : undefined,
      headers: { TTL: "86400", Urgency: "high" },
    },
  }));
  const res = await admin.messaging().sendEach(messages);
  let sent = 0;
  await Promise.all(res.responses.map(async (r, i) => {
    if (r.success) { sent++; return; }
    const code = r.error && r.error.code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-argument") {
      await tokenDocs[i].ref.delete().catch(() => {}); // טוקן מת — מנקים
    }
  }));
  return { sent };
}

// אירועים פתוחים (לא מבוטלים) של קבוצה בתאריך נתון
async function eventsOn(teamId, dateStr) {
  const events = await getTeamValue(teamId, "events", []);
  return (Array.isArray(events) ? events : []).filter((e) => e.date === dateStr && e.open !== false && !e.cancelled);
}

// שחקניות שטרם ענו לאירוע (אין להן status ב-attendance/{pid}[eventId])
async function nonResponders(teamId, eventId) {
  const players = await getTeamValue(teamId, "players", []);
  const att = await db.collection(`teams/${teamId}/attendance`).get();
  const answered = new Set();
  att.forEach((d) => {
    const rec = (d.data() || {})[String(eventId)];
    if (rec && rec.status) answered.add(String(d.id));
  });
  return { players, missing: players.filter((p) => !answered.has(String(p.id))), answeredCount: answered.size };
}

function evLabel(ev) {
  return ev.type === "training" ? "אימון" : (ev.opponent ? `משחק נגד ${ev.opponent}` : "משחק");
}

// רשימת הקבוצות הפעילות (מתוך teamIndex)
async function activeTeams() {
  const snap = await db.collection("teamIndex").get();
  return snap.docs.map((d) => d.data()).filter((t) => (t.status || "active") === "active").map((t) => t.teamId);
}

// גרעין התזכורות לקבוצה אחת. when: "evening" (אירועי מחר) | "morning" (אירועי היום).
async function remindTeam(teamId, when) {
  const dateStr = when === "evening" ? ilDate(1) : ilDate(0);
  const dayWord = when === "evening" ? "מחר" : "היום";
  const events = await eventsOn(teamId, dateStr);
  if (!events.length) return 0;
  const tokens = await getTeamPushTokens(teamId);
  if (!tokens.length) return 0;
  const url = "/?team=" + teamId;
  let total = 0;
  for (const ev of events) {
    const { players, missing, answeredCount } = await nonResponders(teamId, ev.id);
    // תזכורת לשחקניות שטרם ענו — לכל אחת לפי הטוקנים שלה
    const missingIds = new Set(missing.map((p) => String(p.id)));
    const playerTokens = tokens.filter((t) => t.role === "player" && missingIds.has(String(t.playerId)));
    const r1 = await sendPush(playerTokens, {
      title: "🏐 " + dayWord + " " + evLabel(ev) + " ב-" + ev.time,
      body: "טרם אישרת הגעה — לחצי לאישור מהיר ✅",
      url, tag: "reminder_" + teamId + "_" + ev.id + "_" + when,
    });
    total += r1.sent;
    // בבוקר האירוע — גם סיכום למנהלת
    if (when === "morning") {
      const adminTokens = tokens.filter((t) => t.role === "admin");
      const r2 = await sendPush(adminTokens, {
        title: "📋 " + evLabel(ev) + " " + dayWord + " ב-" + ev.time,
        body: answeredCount + " ענו · " + missing.length + " טרם ענו (מתוך " + players.length + ")",
        url, tag: "summary_" + teamId + "_" + ev.id,
      });
      total += r2.sent;
    }
  }
  return total;
}

// השעה הנוכחית בישראל (0-23)
function ilHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date()));
}

// רץ כל שעה ובודק לכל קבוצה אם זו שעת התזכורת שלה (לפי ההגדרות שלה).
// ברירות מחדל: ערב-לפני 19:00 · בוקר-האירוע 10:00 · פעיל. המנהלת שולטת בטאב ההגדרות.
exports.eventRemindersHourly = onSchedule({ schedule: "0 * * * *", timeZone: TZ }, async () => {
  const hour = ilHour();
  const teams = await activeTeams();
  let total = 0;
  for (const teamId of teams) {
    try {
      const st = (await getTeamValue(teamId, "settings", {})) || {};
      if (st.remindersEnabled === false) continue; // המנהלת כיבתה — מדלגים
      const eveningHour = Number.isFinite(Number(st.reminderEveningHour)) ? Number(st.reminderEveningHour) : 19;
      const morningHour = Number.isFinite(Number(st.reminderMorningHour)) ? Number(st.reminderMorningHour) : 10;
      if (hour === eveningHour) total += await remindTeam(teamId, "evening");
      if (hour === morningHour) total += await remindTeam(teamId, "morning");
    } catch (e) { console.error("remindersHourly team=" + teamId + ":", e); }
  }
  console.log("remindersHourly hour=" + hour + " sent=" + total);
});

// ── התראת דחיפה מיידית לכל הקבוצה (מנהלת בלבד) — משמשת לביטול אימון/משחק ──
exports.notifyTeamPush = onCall(async (request) => {
  const { teamId, title, body, url } = request.data || {};
  if (!teamId || !title) throw new HttpsError("invalid-argument", "חסר teamId או title");
  await assertAdmin(request.auth, teamId);
  const tokens = await getTeamPushTokens(teamId);
  const { sent } = await sendPush(tokens, {
    title: String(title).slice(0, 100),
    body: String(body || "").slice(0, 300),
    url: url || `/?team=${teamId}`,
    tag: `notify_${teamId}_${Date.now()}`,
  });
  return { ok: true, sent };
});

// ── מייל תקציר שגיאות לבעל המוצר — כל שעה, רק אם יש שגיאות חדשות ──
// דורש RESEND_API_KEY ב-functions/.env (לא ב-git). בלעדיו — יוצא בשקט.
exports.errorDigest = onSchedule({ schedule: "0 * * * *", timeZone: TZ }, async () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log("errorDigest: RESEND_API_KEY not set - skipping"); return; }
  // סמן התקדמות: קוראים רק שגיאות חדשות מאז הריצה הקודמת
  const cursorRef = db.doc("system/errorDigest");
  const cursorSnap = await cursorRef.get();
  const lastTs = cursorSnap.exists ? (cursorSnap.data().lastTs || 0) : 0;
  const snap = await db.collection("errorLogs").where("ts", ">", lastTs).orderBy("ts", "desc").limit(200).get();
  if (snap.empty) return;
  const rows = snap.docs.map((d) => d.data());
  // קיבוץ לפי הודעה — באג אחד שקרה 50 פעם = שורה אחת עם מונה
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.source}|${r.message}`;
    const g = groups.get(k) || { ...r, count: 0, teams: new Set() };
    g.count++; g.teams.add(r.teamId || "?");
    groups.set(k, g);
  }
  const srcLabel = { boundary: "קריסת מסך", promise: "א-סינכרונית", window: "כללית", probe: "בדיקה" };
  const items = [...groups.values()].sort((a, b) => b.count - a.count).map((g) =>
    `<li style="margin-bottom:10px"><b style="color:#b91c1c">${escapeHtml(g.message)}</b><br/>` +
    `<span style="color:#64748b;font-size:13px">${srcLabel[g.source] || g.source} · ${g.count} פעמים · קבוצות: ${[...g.teams].join(", ")}</span></li>`
  ).join("");
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif">` +
    `<h2>🏐 ${rows.length} שגיאות חדשות באפליקציית הכדורשת</h2><ul>${items}</ul>` +
    `<p style="color:#94a3b8;font-size:12px">פירוט מלא: לחיצה ארוכה על הלוגו ← סופר-אדמין ← שגיאות באפליקציה</p></div>`;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: "Volleyball App <onboarding@resend.dev>",
      to: [SUPER_ADMIN_EMAIL],
      subject: `🔴 ${rows.length} שגיאות חדשות — אפליקציית כדורשת`,
      html,
    }),
  });
  if (!resp.ok) { console.error("errorDigest resend failed:", resp.status, await resp.text()); return; }
  await cursorRef.set({ lastTs: rows[0].ts, updatedAt: new Date().toISOString() });
  console.log(`errorDigest: emailed ${rows.length} errors (${groups.size} groups)`);
});

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
