import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

const googleProvider = new GoogleAuthProvider();

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
export { googleProvider, playerEmail, emailAuth, isGoogleUser };
