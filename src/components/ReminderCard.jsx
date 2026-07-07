import { useState } from "react";
import { S } from "../styles/S";
import { pushSupport, pushEnabledLocally, enablePush, disablePush } from "../lib/push";

// ── כרטיס "תזכורות" — הפעלה/ביטול של Web Push במכשיר הנוכחי ──────────────────
// role: "player" | "admin". לשחקנית: תזכורת לפני אימון/משחק אם טרם אישרה.
// למנהלת: גם סיכום הגעה בבוקר האירוע. מוצג רק כשהפיצ'ר מוגדר (VAPID קיים).
export default function ReminderCard({ role, playerId, pc, notify }) {
  const who = role === "admin" ? "admin" : `p${playerId}`;
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(() => pushEnabledLocally(who));
  const support = pushSupport();

  if (support === "no-vapid" || support === "unsupported") return null; // הפיצ'ר כבוי/לא נתמך — לא מציקים

  const label = role === "admin"
    ? "תזכורות למנהלת: סיכום הגעה בבוקר כל אימון/משחק, ישירות לטלפון."
    : "קבלי תזכורת לטלפון לפני כל אימון/משחק — גם כשהאפליקציה סגורה.";

  async function toggle() {
    setBusy(true);
    if (on) {
      await disablePush(role, playerId);
      setOn(false);
    } else {
      const res = await enablePush(role, playerId);
      if (res.ok) {
        setOn(true);
        notify && notify("התזכורות הופעלו במכשיר הזה 🔔", { icon: "🔔", okLabel: "מעולה" });
      } else if (res.reason === "denied") {
        notify && notify("ההתראות חסומות לאתר הזה בדפדפן. כדי להפעיל: הגדרות הדפדפן ← התראות ← אפשרי לאתר.", { icon: "🔕" });
      } else if (res.reason !== "dismissed") {
        notify && notify("הפעלת התזכורות נכשלה. נסי שוב מאוחר יותר.", { icon: "⚠️" });
      }
    }
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

  if (support === "denied" && !on) {
    return (
      <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ fontSize: 26, flexShrink: 0 }}>🔕</div>
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
          ההתראות חסומות לאתר הזה. כדי לקבל תזכורות: הגדרות הדפדפן ← התראות ← אפשרי לאתר.
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
      <button onClick={toggle} disabled={busy}
        style={{ flexShrink: 0, padding: "9px 16px", borderRadius: 10, border: "none", cursor: busy ? "default" : "pointer", fontSize: 13, fontWeight: 800,
          background: busy ? "#94a3b8" : on ? "#f1f5f9" : pc, color: on ? "#64748b" : "white" }}>
        {busy ? "רגע…" : on ? "בטלי" : "הפעילי 🔔"}
      </button>
    </div>
  );
}
