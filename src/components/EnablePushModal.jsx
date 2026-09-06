import ReminderCard from "./ReminderCard";
import { pushSupport } from "../lib/push";
import { isIOS } from "../lib/utils";

// ── חלון הנעה להפעלת התראות ──────────────────────────────────────────────────
// שחקנית בלי התראות לא מקבלת תזכורת לפני אימון, לא הודעת ביטול ולא עדכון
// נוכחות. הכרטיס בלשונית "נוכחות" קיים מזמן, אבל קל לגלול מעליו — ובפועל
// חמש מתוך שלוש-עשרה לא הפעילו. לכן חלון, ולא כרטיס.
//
// הגוף הוא ReminderCard עצמו ולא שכפול שלו: שם כבר יושבים כל המצבים
// (אייפון שאינו מותקן, הרשאה חסומה במצב מותקן מול דפדפן, מסך-ההכנה לפני
// שאלת הדפדפן) — כולם כוונו אחרי דיווחים אמיתיים מהשטח. שכפול היה מתיישן.
// כאן מתווספת רק שורת פתיחה שמותאמת למכשיר, ודרך לסגור.
export default function EnablePushModal({ playerId, pc, notify, onClose }) {
  const support = pushSupport();
  const ios = isIOS();

  // שלוש פתיחות שונות. באייפון שלא מותקן זה באמת שני צעדים — אין טעם להבטיח
  // "לחיצה אחת" למי שצריכה קודם להתקין.
  const lead = support === "ios-install"
    ? "באייפון ההתראות עובדות רק מהאפליקציה שמותקנת במסך הבית. שני צעדים קצרים:"
    : ios
      ? "עוד לחיצה אחת, ותדעי על כל שינוי גם כשהאפליקציה סגורה."
      : "לחיצה אחת ואישור בשאלה שתקפוץ — ותדעי על כל שינוי גם כשהאפליקציה סגורה.";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#f8fafc", borderRadius: 22, padding: "22px 18px 16px", width: "100%", maxWidth: 360, maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 46 }}>🔔</div>
          <h3 style={{ fontSize: 19, fontWeight: 900, color: pc, margin: "6px 0 8px" }}>את מפספסת עדכונים</h3>
          <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.65, margin: "0 0 4px" }}>
            בלי התראות לא תדעי על <b>ביטול אימון</b>, שינוי שעה או תזכורת לאשר הגעה.
          </p>
          <p style={{ fontSize: 13.5, color: "#1e293b", fontWeight: 700, lineHeight: 1.6, margin: 0 }}>{lead}</p>
        </div>

        <ReminderCard role="player" playerId={playerId} pc={pc} notify={notify} onEnabled={onClose} />

        <button onClick={onClose}
          style={{ width: "100%", marginTop: 6, padding: "11px", background: "transparent", color: "#94a3b8", border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>
          אולי אחר כך
        </button>
      </div>
    </div>
  );
}
