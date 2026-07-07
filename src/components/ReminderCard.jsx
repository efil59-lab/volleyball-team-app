import { useState } from "react";
import { S } from "../styles/S";
import { pushSupport, pushEnabledLocally, enablePush, disablePush } from "../lib/push";

// ── כרטיס "תזכורות" — הפעלה/ביטול של Web Push במכשיר הנוכחי ──────────────────
// role: "player" | "admin". לשחקנית: תזכורת לפני אימון/משחק אם טרם אישרה.
// למנהלת: גם סיכום הגעה בבוקר האירוע. מוצג רק כשהפיצ'ר מוגדר (VAPID קיים).
// הזרימה: לחיצה על "הפעילי" ← מסך-הכנה ("הטלפון ישאל — לחצי אפשר") ← השאלה של
// הדפדפן. ההכנה קריטית: בלי הסבר, חלק מהמשתמשות דוחות את השאלה ונחסמות.
export default function ReminderCard({ role, playerId, pc, notify }) {
  const who = role === "admin" ? "admin" : `p${playerId}`;
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(() => pushEnabledLocally(who));
  const [explain, setExplain] = useState(false); // מסך-ההכנה לפני שאלת הדפדפן
  const [, setRecheck] = useState(0);            // "בדקי שוב" אחרי שחרור חסימה
  const support = pushSupport();

  if (support === "no-vapid" || support === "unsupported") return null; // הפיצ'ר כבוי/לא נתמך — לא מציקים

  const label = role === "admin"
    ? "תזכורות למנהלת: סיכום הגעה בבוקר כל אימון/משחק, ישירות לטלפון."
    : "קבלי תזכורת לטלפון לפני כל אימון/משחק — גם כשהאפליקציה סגורה.";

  async function reallyEnable() {
    setExplain(false);
    setBusy(true);
    const res = await enablePush(role, playerId);
    if (res.ok) {
      setOn(true);
      notify && notify("התזכורות הופעלו במכשיר הזה 🔔", { icon: "🔔", okLabel: "מעולה" });
    } else if (res.reason === "denied") {
      setRecheck(x => x + 1); // יציג את כרטיס ה"חסום" עם ההוראות
    } else if (res.reason !== "dismissed") {
      notify && notify("הפעלת התזכורות נכשלה. נסי שוב מאוחר יותר.", { icon: "⚠️" });
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    await disablePush(role, playerId);
    setOn(false);
    setBusy(false);
  }

  if (support === "ios-install") {
    return (
      <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ fontSize: 26, flexShrink: 0 }}>🔔</div>
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
          <b>רוצה תזכורות לטלפון?</b> באייפון זה עובד רק מהאפליקציה המותקנת:
          כפתור שיתוף ↑ ← "הוסף למסך הבית", ואז הפעילי תזכורות מכאן.
        </div>
      </div>
    );
  }

  // חסום: הסבר פשוט, צעד-צעד, עם "בדקי שוב" למי שתיקנה את ההגדרה
  if (support === "denied" && !on) {
    return (
      <div style={{ ...S.card }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ fontSize: 26, flexShrink: 0 }}>🔕</div>
          <div style={{ fontSize: 13.5, color: "#1e293b", fontWeight: 700, lineHeight: 1.5 }}>
            ההתראות חסומות במכשיר הזה — ככה פותחים אותן:
          </div>
        </div>
        <ol style={{ fontSize: 13, color: "#475569", lineHeight: 1.8, margin: "0 0 12px", paddingRight: 22 }}>
          <li>לחצי על סמל <b>🔒 המנעול</b> (או ⓘ) ליד הכתובת למעלה</li>
          <li>בחרי <b>הרשאות ← התראות ← אפשרי</b></li>
          <li>חזרי לכאן ולחצי "בדקי שוב"</li>
        </ol>
        <p style={{ fontSize: 11.5, color: "#94a3b8", margin: "0 0 10px", lineHeight: 1.5 }}>
          לא רואה מנעול? תפריט הדפדפן (⋮ או ⋯) ← הגדרות ← הרשאות אתרים ← התראות ← אפשרי לאתר הזה.
        </p>
        <button onClick={() => setRecheck(x => x + 1)}
          style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 800, background: pc, color: "white" }}>
          ✓ פתחתי — בדקי שוב
        </button>
      </div>
    );
  }

  // מסך-ההכנה: מסביר מה עומד לקרות לפני שהדפדפן שואל
  if (explain) {
    return (
      <div style={{ ...S.card, border: `2px solid ${pc}`, background: `${pc}06` }}>
        <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🔔</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 6 }}>עוד רגע הטלפון ישאל אותך</div>
          <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, margin: "0 0 14px" }}>
            תופיע שאלה אם לאפשר התראות —<br />
            <b style={{ color: pc }}>חשוב ללחוץ "אפשר" (Allow) 👍</b><br />
            בלי זה התזכורות לא יגיעו.
          </p>
          <button onClick={reallyEnable} disabled={busy}
            style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: busy ? "default" : "pointer", fontSize: 15, fontWeight: 800, background: busy ? "#94a3b8" : pc, color: "white", marginBottom: 8 }}>
            {busy ? "רגע…" : "הבנתי, שאלי אותי ←"}
          </button>
          <button onClick={() => setExplain(false)} style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", padding: 6 }}>
            אולי אחר כך
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ fontSize: 26, flexShrink: 0 }}>{on ? "🔔" : "🔕"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{on ? "תזכורות פעילות במכשיר הזה" : "תזכורות לטלפון"}</div>
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginTop: 2 }}>{label}</div>
      </div>
      <button onClick={() => (on ? turnOff() : setExplain(true))} disabled={busy}
        style={{ flexShrink: 0, padding: "9px 16px", borderRadius: 10, border: "none", cursor: busy ? "default" : "pointer", fontSize: 13, fontWeight: 800,
          background: busy ? "#94a3b8" : on ? "#f1f5f9" : pc, color: on ? "#64748b" : "white" }}>
        {busy ? "רגע…" : on ? "בטלי" : "הפעילי 🔔"}
      </button>
    </div>
  );
}
