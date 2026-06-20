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
