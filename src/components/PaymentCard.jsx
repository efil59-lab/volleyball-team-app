import { useState } from "react";
import { PAYMENT, OWNER_CONTACT_EMAIL, OWNER_CONTACT_WHATSAPP } from "../lib/constants";
import { CURRENT_TEAM } from "../lib/db";

// ── כרטיס תשלום (ביט) — מוצג למנהלת בבאנר הניסיון ובמסך "הניסיון הסתיים" ──────
// אם PAYMENT.bitPhone ריק — מוצגים כפתורי יצירת-קשר במקום הוראות ביט.
export default function PaymentCard({ pc, sc, expired, daysLeft, onClose }) {
  const [copied, setCopied] = useState(null);
  const copy = (txt, tag) => { try { navigator.clipboard.writeText(txt); setCopied(tag); setTimeout(() => setCopied(null), 1800); } catch {} };
  const waLink = OWNER_CONTACT_WHATSAPP
    ? `https://wa.me/${OWNER_CONTACT_WHATSAPP}?text=${encodeURIComponent(`היי! אני רוצה להמשיך עם האפליקציה 🏐 קוד הקבוצה שלי: ${CURRENT_TEAM}`)}`
    : "";
  const mailLink = `mailto:${OWNER_CONTACT_EMAIL}?subject=${encodeURIComponent("המשך שימוש באפליקציית הכדורשת")}&body=${encodeURIComponent(`קוד הקבוצה שלי: ${CURRENT_TEAM}`)}`;

  return (
    <div style={{ background: "white", borderRadius: 20, padding: "26px 22px", width: "100%", maxWidth: 380, boxShadow: "0 12px 40px rgba(0,0,0,0.25)", textAlign: "center" }}>
      <div style={{ fontSize: 44 }}>{expired ? "⏰" : "🏐"}</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: pc, margin: "8px 0 6px" }}>
        {expired ? "תקופת הניסיון הסתיימה" : `נותרו ${daysLeft} ימי ניסיון`}
      </h2>
      <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: "0 0 14px" }}>
        {expired
          ? "השחקניות לא יכולות להיכנס עד חידוש המנוי. ההפעלה מחדש — מיד לאחר התשלום."
          : "כדי שהקבוצה תמשיך לעבוד גם אחרי הניסיון — אפשר לשלם כבר עכשיו."}
      </p>

      <div style={{ background: `${pc}0a`, border: `2px solid ${pc}30`, borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: pc }}>{PAYMENT.priceText}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>כל הפיצ'רים · כל השחקניות · ללא הגבלה</div>
      </div>

      {PAYMENT.bitPhone ? (
        <div style={{ background: "#f8fafc", borderRadius: 14, padding: "14px 16px", marginBottom: 14, textAlign: "right" }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>💜 תשלום בביט:</div>
          <ol style={{ fontSize: 13, color: "#475569", lineHeight: 1.9, margin: 0, paddingRight: 20 }}>
            <li>פתחי את אפליקציית <b>bit</b> ושלחי למספר{" "}
              <button onClick={() => copy(PAYMENT.bitPhone, "phone")} style={{ background: `${pc}12`, color: pc, border: "none", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
                {copied === "phone" ? "✓ הועתק" : PAYMENT.bitPhone}
              </button>
            </li>
            <li>בהערת התשלום כתבי את קוד הקבוצה:{" "}
              <button onClick={() => copy(CURRENT_TEAM, "code")} style={{ background: `${pc}12`, color: pc, border: "none", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
                {copied === "code" ? "✓ הועתק" : CURRENT_TEAM}
              </button>
            </li>
            <li>זהו! נפעיל את הקבוצה תוך זמן קצר ✅</li>
          </ol>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {waLink && <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ background: "#25D366", color: "white", borderRadius: 12, padding: "12px", textDecoration: "none", fontSize: 14, fontWeight: 800 }}>📱 לתיאום תשלום בוואטסאפ</a>}
          <a href={mailLink} style={{ background: pc, color: "white", borderRadius: 12, padding: "12px", textDecoration: "none", fontSize: 14, fontWeight: 800 }}>✉️ לתיאום תשלום במייל</a>
          <p style={{ fontSize: 11.5, color: "#94a3b8", margin: 0 }}>ציני בהודעה את קוד הקבוצה: <b>{CURRENT_TEAM}</b></p>
        </div>
      )}

      {onClose && (
        <button onClick={onClose} style={{ width: "100%", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {expired ? "המשיכי לפאנל בינתיים" : "סגרי"}
        </button>
      )}
    </div>
  );
}
