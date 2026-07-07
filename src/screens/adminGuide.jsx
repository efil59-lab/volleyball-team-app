import { useState } from "react";
import { GUIDE_SECTIONS, GUIDE_FAQ, GUIDE_INTRO, GUIDE_UPDATED } from "../content/adminGuide";

// ── המדריך למנהלת — שכבת-על מסך-מלא, נפתחת מלשונית ההגדרות ────────────────────
// התוכן מגיע מ-content/adminGuide.js (מקור אמת משותף עם ה-PDF).
export default function AdminGuide({ pc, sc, onClose }) {
  const [openFaq, setOpenFaq] = useState(null);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#f1f5f9", zIndex: 960, overflowY: "auto", direction: "rtl" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "24px 20px 26px", textAlign: "center", position: "sticky", top: 0, zIndex: 2 }}>
        <button onClick={onClose} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✕ סגירה</button>
        <div style={{ fontSize: 38 }}>📖</div>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: "6px 0 2px" }}>המדריך למנהלת</h2>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: 0 }}>עדכון: {GUIDE_UPDATED}</p>
      </div>

      <div style={{ padding: "16px 16px 60px", maxWidth: 640, margin: "0 auto" }}>
        <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.7, background: "white", borderRadius: 14, padding: "14px 16px", border: "1px solid #e2e8f0" }}>{GUIDE_INTRO}</p>

        {GUIDE_SECTIONS.map((sec) => (
          <div key={sec.title} style={{ background: "white", borderRadius: 14, padding: "16px 16px 8px", border: "1px solid #e2e8f0", marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 24 }}>{sec.icon}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: pc }}>{sec.title}</span>
            </div>
            {sec.items.map((it) => (
              <div key={it.t} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{it.t}</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65, marginTop: 2 }}>{it.d}</div>
              </div>
            ))}
          </div>
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 2px 10px" }}>
          <span style={{ fontSize: 24 }}>❓</span>
          <span style={{ fontSize: 17, fontWeight: 900, color: "#1e293b" }}>שאלות נפוצות</span>
        </div>
        {GUIDE_FAQ.map((f, i) => (
          <div key={i} style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 8, overflow: "hidden" }}>
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "13px 14px", textAlign: "right" }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: openFaq === i ? pc : "#1e293b" }}>{f.q}</span>
              <span style={{ fontSize: 12, color: "#94a3b8", transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
            </button>
            {openFaq === i && (
              <div style={{ padding: "0 14px 13px", fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{f.a}</div>
            )}
          </div>
        ))}

        <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", margin: "20px 0 0", lineHeight: 1.6 }}>
          נשארה שאלה? כתבו לנו: efil59@gmail.com 🏐
        </p>
      </div>
    </div>
  );
}
