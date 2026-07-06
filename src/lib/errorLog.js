import { db, auth } from "../firebase";
import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc } from "firebase/firestore";
import { CURRENT_TEAM } from "./db";

// ── ניטור שגיאות ביתי (במקום Sentry) ─────────────────────────────────────────
// כותב שגיאות ל-collection גלובלי errorLogs; רק הסופר-אדמין קורא (כלל Firestore).
// שומרים על העלות נמוכה: דדופ בתוך הסשן + תקרת כתיבות + סינון "רעש" צפוי.

const sessionSeen = new Set();
let sessionCount = 0;
const MAX_PER_SESSION = 20;

// שגיאות צפויות שלא שווה לתעד: הרשאות (anon לפני התחברות), אזהרות דפדפן, ביטול popup וכו'.
function isNoise(msg) {
  return /permission-denied|insufficient permissions|ResizeObserver|dynamically imported|Load failed|popup-blocked|popup-closed|cancelled-popup|Failed to fetch/i.test(String(msg || ""));
}

// לוג שגיאה אחת. לעולם לא זורק (לוכד-שגיאות שמפיל את האפליקציה = גרוע מהבעיה המקורית).
export async function logError(source, message, stack) {
  try {
    const msg = String(message || "").slice(0, 500);
    if (!msg || isNoise(msg)) return;
    const key = source + "|" + msg;
    if (sessionSeen.has(key)) return;          // אותה שגיאה בסשן — פעם אחת מספיקה
    if (sessionCount >= MAX_PER_SESSION) return; // תקרה — לא מפוצצים כתיבות
    sessionSeen.add(key);
    sessionCount++;
    await addDoc(collection(db, "errorLogs"), {
      source,                                   // "boundary" | "promise" | "window"
      message: msg,
      stack: String(stack || "").slice(0, 2500),
      teamId: CURRENT_TEAM,
      url: typeof location !== "undefined" ? location.pathname + location.search : "",
      userAgent: (typeof navigator !== "undefined" ? navigator.userAgent : "").slice(0, 300),
      uid: (auth.currentUser && auth.currentUser.uid) || null,
      anon: auth.currentUser ? !!auth.currentUser.isAnonymous : null,
      createdAt: new Date().toISOString(),
      ts: Date.now(),
    });
  } catch { /* בולעים — הלוגר לא יפיל את האפליקציה */ }
}

// סופר-אדמין: קריאת השגיאות האחרונות.
export async function loadErrorLogs(max = 100) {
  try {
    const snap = await getDocs(query(collection(db, "errorLogs"), orderBy("ts", "desc"), limit(max)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error("loadErrorLogs:", e); return []; }
}

// סופר-אדמין: ניקוי (מוחק עד 300 בכל קריאה).
export async function clearErrorLogs() {
  try {
    const snap = await getDocs(query(collection(db, "errorLogs"), orderBy("ts", "desc"), limit(300)));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "errorLogs", d.id))));
  } catch (e) { console.error("clearErrorLogs:", e); }
}
