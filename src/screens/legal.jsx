import { PRIVACY_TEXT, TERMS_TEXT, LEGAL_UPDATED } from "../legal/legalTexts";

// ── מסך משפטי (מדיניות פרטיות / תנאי שימוש) ──────────────────────────────────
// מרנדר את הפורמט הקל של legalTexts: "## " כותרת, "- " תבליט, פסקאות, **הדגשה**.
function Bold({ text }) {
  const parts = String(text).split("**");
  return <>{parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : p))}</>;
}

function LegalScreen({ kind, pc, sc, onBack }) {
  const isPrivacy = kind === "privacy";
  const raw = isPrivacy ? PRIVACY_TEXT : TERMS_TEXT;
  const title = isPrivacy ? "מדיניות פרטיות" : "תנאי שימוש";
  const lines = raw.split("\n").map(l => l.trim());

  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: "#f1f5f9" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "26px 20px 30px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזרה</button>
        <div style={{ fontSize: 40 }}>{isPrivacy ? "🔒" : "📜"}</div>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: "8px 0 2px" }}>{title}</h2>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: 0 }}>עדכון אחרון: {LEGAL_UPDATED}</p>
      </div>
      <div style={{ padding: "18px 16px 40px", maxWidth: 640, margin: "0 auto" }}>
        <div style={{ background: "white", borderRadius: 16, padding: "20px 18px", border: "1px solid #e2e8f0" }}>
          {lines.map((line, i) => {
            if (!line) return null;
            if (line.startsWith("## ")) {
              return <h3 key={i} style={{ fontSize: 15, fontWeight: 800, color: pc, margin: "18px 0 6px" }}>{line.slice(3)}</h3>;
            }
            if (line.startsWith("- ")) {
              return (
                <div key={i} style={{ display: "flex", gap: 8, margin: "0 0 6px", paddingRight: 4 }}>
                  <span style={{ color: pc, flexShrink: 0 }}>•</span>
                  <span style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.7 }}><Bold text={line.slice(2)} /></span>
                </div>
              );
            }
            return <p key={i} style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.7, margin: "0 0 8px" }}><Bold text={line} /></p>;
          })}
        </div>
        <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", margin: "14px 0 0", lineHeight: 1.5 }}>
          לשאלות: efil59@gmail.com
        </p>
      </div>
    </div>
  );
}

export { LegalScreen };
