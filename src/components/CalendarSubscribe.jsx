import { useState } from "react";
import { calendarLinkRemote } from "../lib/db";

// ── "לוח הקבוצה ביומן שלי" ───────────────────────────────────────────
// מנוי ליומן של הטלפון (פיד ICS מהשרת, ראה calendarFeed ב-functions): לחיצה אחת
// ואישור, ומאז כל אימון ומשחק — גם עתידיים — מופיעים ביומן ומתעדכנים לבד.
// אייפון: webcal:// נפתח ישר באפליקציית היומן. אנדרואיד: יומן Google של הקבוצה
// (link.google, קישור ?cid=) — אפליקציית יומן Google מצרפת אותו בלחיצה, ומשם הוא
// מגיע גם ליומן סמסונג. מנוי URL באנדרואיד לא עבד מהטלפון (נבדק 21.11.26).
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function CalendarSubscribe({ pc }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const ios = isIOS();

  async function start() {
    setOpen(true); setErr("");
    if (link) return;
    try { setLink(await calendarLinkRemote()); }
    catch (e) { console.error("calendarLink:", e); setErr("לא הצלחתי להכין את הקישור. נסי שוב בעוד רגע."); }
  }
  const googleUrl = link ? (link.google || `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(link.webcal)}`) : "#";
  const btn = { display: "block", width: "100%", boxSizing: "border-box", textAlign: "center", textDecoration: "none", border: "none", borderRadius: 12, padding: "13px 12px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };
  const step = { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: "#334155", lineHeight: 1.55, marginTop: 8 };
  const num = { flex: "0 0 22px", height: 22, borderRadius: "50%", background: pc, color: "white", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <>
      <button onClick={start} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "13px 14px", cursor: "pointer", textAlign: "right", fontFamily: "inherit", marginBottom: 14, boxShadow: "0 2px 8px rgba(26,35,126,0.06)" }}>
        <span style={{ fontSize: 26 }}>📅</span>
        <span style={{ flex: 1 }}>
          <b style={{ display: "block", fontSize: 14.5, color: "#1e293b" }}>לוח הקבוצה ביומן שלי</b>
          <span style={{ fontSize: 12, color: "#64748b" }}>פעם אחת — ומאז כל אימון ומשחק מופיעים ביומן של הטלפון</span>
        </span>
        <span style={{ color: pc, fontSize: 18 }}>←</span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} className="vb-sheet-ov" style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(10,15,45,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} className="vb-sheet" style={{ background: "white", borderRadius: "20px 20px 0 0", padding: "20px 18px calc(20px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 480, boxSizing: "border-box" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#1e293b", textAlign: "center" }}>📅 לוח הקבוצה ביומן שלך</div>
            <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 4, lineHeight: 1.5 }}>
              כל האימונים והמשחקים, גם אלה שייקבעו בהמשך, יופיעו ביומן — וביטול או שינוי שעה יתעדכנו אוטומטית.
            </div>

            {err && <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 700, textAlign: "center", marginTop: 14 }}>{err}</div>}
            {!err && !link && <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 16 }}>מכין את הקישור…</div>}

            {link && ios && (
              <div style={{ marginTop: 14 }}>
                <a href={link.webcal} style={{ ...btn, background: pc, color: "white" }}>🍎 הוספה ליומן של האייפון</a>
                <div style={step}><span style={num}>1</span><span>לחצי על הכפתור.</span></div>
                <div style={step}><span style={num}>2</span><span>בחלון שנפתח לחצי <b>"הירשם"</b> ואז <b>"הוסף"</b>. זהו.</span></div>
              </div>
            )}
            {link && !ios && (
              <div style={{ marginTop: 14 }}>
                <a href={googleUrl} target="_blank" rel="noopener" style={{ ...btn, background: pc, color: "white" }}>📆 הוספה ליומן גוגל</a>
                <div style={step}><span style={num}>1</span><span>לחצי על הכפתור. ייפתח יומן Google.</span></div>
                <div style={step}><span style={num}>2</span><span>אם הוא שואל לאיזה חשבון לצרף — בחרי את החשבון הרגיל שלך. זהו, האימונים והמשחקים כבר ביומן.</span></div>
                <div style={{ ...step, background: "#f8fafc", borderRadius: 10, padding: "8px 10px", fontSize: 12.5, color: "#475569" }}>
                  <span>📱 <b>עם יומן סמסונג?</b> שם האימונים והמשחקים מופיעים לפעמים רק אחרי זמן מה. אם עברו כמה שעות ועדיין אין: ביומן Google ← ☰ ← הגדרות ← היומן של הקבוצה ← כבי והדליקי את <b>"סנכרון"</b>.</span>
                </div>
              </div>
            )}
            {link && (
              <button onClick={async () => { try { await navigator.clipboard.writeText(link.https); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }}
                style={{ ...btn, background: "#f1f5f9", color: "#334155", marginTop: 14, fontSize: 13.5, fontWeight: 700 }}>
                {copied ? "✓ הקישור הועתק" : "📋 העתקת הקישור (ליומן אחר)"}
              </button>
            )}
            <button onClick={() => setOpen(false)} style={{ ...btn, background: "transparent", color: "#64748b", marginTop: 6, fontSize: 14, fontWeight: 600 }}>סגירה</button>
          </div>
        </div>
      )}
    </>
  );
}
