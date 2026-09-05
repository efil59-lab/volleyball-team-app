import { app, db, auth } from "../firebase";
import { doc, setDoc, deleteDoc, getDoc, arrayUnion } from "firebase/firestore";
import { CURRENT_TEAM } from "./db";
import { VAPID_PUBLIC_KEY } from "./constants";
import { isIOS } from "./utils";

// ── תזכורות אמיתיות (Web Push דרך FCM) — צד לקוח ─────────────────────────────
// הטוקן נשמר ב-teams/{t}/pushTokens/{token} = { roles[], playerId, ua, updatedAt }.
// הפונקציות המתוזמנות בענן קוראות את הטוקנים ושולחות דרך admin.messaging().
// firebase/messaging נטען דינמית — לא מכביד על ה-bundle למי שלא הפעילה תזכורות.
//
// ⚠️ roles הוא מערך, לא מחרוזת. טוקן ה-FCM הוא פר-מכשיר-ודפדפן ולא פר-תפקיד,
// והמסמך מוחזק לפיו — כך שמנהלת שנכנסת גם כשחקנית מאותו טלפון (בדיקות, או
// מנהלת ששחקנית בעצמה) דרסה בעבר את התפקיד הקודם ב-setDoc, ואיבדה בשקט את
// ההתראות של התפקיד השני. `role` היחיד נשמר לתאימות לאחור עם טוקנים ישנים.

function isStandalone() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch { return false; }
}

// מצב התמיכה במכשיר הנוכחי. מוחזר אחד מ:
// "ok" | "no-vapid" (הפיצ'ר כבוי) | "ios-install" (אייפון בדפדפן — צריך להתקין קודם)
// | "denied" (המשתמשת חסמה) | "unsupported" (דפדפן ישן)
export function pushSupport() {
  if (!VAPID_PUBLIC_KEY) return "no-vapid";
  if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
    // באייפון בתוך דפדפן אין PushManager בכלל — ההסבר הנכון הוא "התקיני קודם"
    return isIOS() && !isStandalone() ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

export function pushEnabledLocally(who) {
  try { return localStorage.getItem(`pushOn_${CURRENT_TEAM}_${who}`) === "1"; } catch { return false; }
}

async function messagingMod() {
  const m = await import("firebase/messaging");
  if (!(await m.isSupported())) throw new Error("unsupported");
  return m;
}

// הפעלת תזכורות: בקשת הרשאה → טוקן FCM → שמירה ב-Firestore.
// who: "p{playerId}" לשחקנית | "admin" למנהלת. מחזיר { ok } או { ok:false, reason }.
export async function enablePush(role, playerId) {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: perm === "denied" ? "denied" : "dismissed" };
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const m = await messagingMod();
    const token = await m.getToken(m.getMessaging(app), {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) return { ok: false, reason: "no-token" };
    // merge + arrayUnion: הפעלה בתפקיד אחד לא מוחקת את השני על אותו מכשיר.
    // playerId נכתב רק כשמפעילה שחקנית — אחרת הפעלה כמנהלת הייתה מאפסת אותו,
    // והתזכורת "טרם אישרת" לא הייתה מוצאת למי לשלוח.
    const payload = {
      roles: arrayUnion(role),
      role, // תאימות לאחור בלבד; השרת קורא roles כשהוא קיים
      uid: (auth.currentUser && auth.currentUser.uid) || null,
      ua: (navigator.userAgent || "").slice(0, 200),
      updatedAt: new Date().toISOString(),
    };
    if (role === "player") payload.playerId = playerId ?? null;
    await setDoc(doc(db, "teams", CURRENT_TEAM, "pushTokens", token), payload, { merge: true });
    const who = role === "admin" ? "admin" : `p${playerId}`;
    try { localStorage.setItem(`pushOn_${CURRENT_TEAM}_${who}`, "1"); } catch {}
    return { ok: true };
  } catch (e) {
    console.error("enablePush:", e);
    return { ok: false, reason: e.message || "error" };
  }
}

// ביטול תזכורות במכשיר הזה: מחיקת הטוקן מ-FCM ומ-Firestore.
export async function disablePush(role, playerId) {
  try {
    const m = await messagingMod();
    const messaging = m.getMessaging(app);
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const token = await m.getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: reg }).catch(() => null);
    if (token) {
      // מבטלים תפקיד אחד בלבד. מחיקת טוקן ה-FCM עצמו משביתה את המכשיר לגמרי,
      // ולכן היא קורית רק כשלא נשאר אף תפקיד — אחרת ביטול התזכורות כשחקנית
      // היה משתיק גם את התראות הניהול על אותו טלפון.
      const ref = doc(db, "teams", CURRENT_TEAM, "pushTokens", token);
      const snap = await getDoc(ref).catch(() => null);
      const cur = snap && snap.exists() ? snap.data() : null;
      const left = (cur ? (cur.roles || (cur.role ? [cur.role] : [])) : []).filter(r => r !== role);
      if (left.length) {
        const patch = { roles: left, role: left[0], updatedAt: new Date().toISOString() };
        if (role === "player") patch.playerId = null;
        await setDoc(ref, patch, { merge: true }).catch(() => {});
      } else {
        await deleteDoc(ref).catch(() => {});
        await m.deleteToken(messaging).catch(() => {});
      }
    }
  } catch (e) { console.error("disablePush:", e); }
  const who = role === "admin" ? "admin" : `p${playerId}`;
  try { localStorage.removeItem(`pushOn_${CURRENT_TEAM}_${who}`); } catch {}
  return { ok: true };
}
