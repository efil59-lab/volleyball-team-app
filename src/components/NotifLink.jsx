import { useState } from "react";

// ── קישור בתוך הודעה של המנהלת ───────────────────────────────────────────────
// אפי, 9.11.26: מירי מפרסמת הודעה עם קישור (למשל לוח משחקי הליגה). הכתובת
// עצמה לא מוצגת — רק הטקסט שלה — וההודעה נהיית לחיצה. קישור לתמונה נפתח
// בתוך האפליקציה במסך מלא; כל קישור אחר נפתח בלשונית חדשה.
const URL_RE = /(https?:\/\/[^\s]+)/i;

export function splitLink(text) {
  const s = String(text || "");
  const m = s.match(URL_RE);
  if (!m) return { text: s, url: null };
  const url = m[1].replace(/[),.;!?״"']+$/, "");
  const rest = s.replace(m[1], "").replace(/\s{2,}/g, " ").replace(/[\s:–—-]+$/, "").trim();
  return { text: rest, url };
}
const isImage = (url) => /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url);

export function openLink(url, setViewer) {
  if (isImage(url)) setViewer(url);
  else window.open(url, "_blank", "noopener");
}

export function LinkViewer({ url, onClose }) {
  if (!url) return null;
  return (
    <div onClick={onClose} role="dialog" aria-label="תצוגת תמונה"
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(8,10,30,0.94)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 12, overflowY: "auto" }}>
      <img src={url} alt="" style={{ maxWidth: "100%", maxHeight: "86vh", borderRadius: 12, objectFit: "contain", boxShadow: "0 18px 50px rgba(0,0,0,0.5)" }} />
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <a href={url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}
          style={{ background: "rgba(255,255,255,0.15)", color: "#fff", borderRadius: 999, padding: "8px 16px", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}>⬇️ פתיחה / שמירה</a>
        <button onClick={onClose}
          style={{ background: "#f5c842", color: "#10163f", border: "none", borderRadius: 999, padding: "8px 18px", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>סגירה</button>
      </div>
    </div>
  );
}

// טקסט הודעה + שבב "🔗 לצפייה" כשיש בה קישור (לרשימות הודעות, לא לסרגל המתחלף)
export function NotifText({ text, color = "#2563eb" }) {
  const [viewer, setViewer] = useState(null);
  const { text: t, url } = splitLink(text);
  if (!url) return <>{text}</>;
  return (
    <>
      {t}{t ? " " : ""}
      <button onClick={(e) => { e.stopPropagation(); openLink(url, setViewer); }}
        style={{ background: "transparent", border: "none", color, fontWeight: 800, cursor: "pointer", padding: 0, fontSize: "inherit", fontFamily: "inherit", textDecoration: "underline" }}>
        🔗 לצפייה
      </button>
      <LinkViewer url={viewer} onClose={() => setViewer(null)} />
    </>
  );
}
