import { useState } from "react";
import { sendFeedbackRemote } from "../lib/db";

// ── משוב ─────────────────────────────────────────────────────────────────────
// כרטיס באודות שפותח חלון קטן: דירוג בכוכבים (חובה), טקסט חופשי ושם (רשות).
// אותו מבנה כמו בגול־טיים. המשוב נשמר בשרת ונקרא רק בפאנל של בעל המוצר —
// הוא לא מתפרסם באפליקציה, והמנהלת של הקבוצה לא רואה אותו.
export default function FeedbackBox({ pc, sc, card }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done | error

  const close = () => {
    setOpen(false);
    setTimeout(() => { setState("idle"); setRating(0); setText(""); setName(""); }, 250);
  };
  const submit = async () => {
    if (!rating || state === "sending") return;
    setState("sending");
    try { await sendFeedbackRemote({ rating, text, name }); setState("done"); setTimeout(close, 2400); }
    catch { setState("error"); }
  };
  const field = { width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "10px 12px", border: "1px solid #e2e8f0", background: "white", color: "#1e293b", fontSize: 14, fontFamily: "inherit" };

  return (
    <>
      <div style={{ ...card, marginBottom: 14, textAlign: "center", padding: "16px 16px 18px" }}>
        <div style={{ fontSize: 22 }}>💬</div>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b", marginTop: 4 }}>מה דעתך על האפליקציה?</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, lineHeight: 1.6 }}>
          דקה אחת שלך, וכך הגרסה הבאה תהיה טובה יותר. המשוב מגיע לאפי בלבד ולא מתפרסם באפליקציה.
        </div>
        <button onClick={() => setOpen(true)}
          style={{ marginTop: 12, padding: "10px 22px", borderRadius: 999, border: "none", cursor: "pointer", background: pc, color: "white", fontWeight: 800, fontSize: 14, fontFamily: "inherit" }}>
          ⭐ שליחת משוב
        </button>
      </div>

      {open && (
        <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,15,45,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", color: "#1e293b", borderRadius: 18, padding: "18px 18px 20px", width: "100%", maxWidth: 420, boxShadow: "0 12px 40px rgba(10,15,45,0.35)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <button onClick={close} aria-label="סגירה" style={{ background: "transparent", border: "none", fontSize: 20, lineHeight: 1, cursor: "pointer", color: "#94a3b8", fontFamily: "inherit", padding: 0, width: 22 }}>✕</button>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#1e293b" }}>🏐 מה דעתך על האפליקציה?</div>
                <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>המשוב נשלח לאפי בלבד ולא מתפרסם.</div>
              </div>
              <span style={{ width: 22 }} />
            </div>

            {state === "done" ? (
              <div style={{ textAlign: "center", padding: "26px 0 10px" }}>
                <div style={{ fontSize: 34 }}>🙏</div>
                <div style={{ fontWeight: 800, marginTop: 8, color: "#1e293b" }}>תודה! המשוב נשלח.</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "16px 0 12px" }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRating(n)} aria-label={`${n} כוכבים`}
                      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, fontSize: 32, lineHeight: 1, color: n <= rating ? "#f59e0b" : "#cbd5e1" }}>
                      {n <= rating ? "★" : "☆"}
                    </button>
                  ))}
                </div>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1000}
                  placeholder="מה עובד טוב? מה מבלבל? מה היית מוסיפה?"
                  style={{ ...field, resize: "vertical" }} />
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
                  placeholder="השם שלך (לא חובה)" style={{ ...field, marginTop: 10 }} />
                {state === "error" && (
                  <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 700, marginTop: 10, textAlign: "center" }}>השליחה נכשלה. אפשר לנסות שוב.</div>
                )}
                <button onClick={submit} disabled={!rating || state === "sending"}
                  style={{ width: "100%", marginTop: 14, padding: "12px 0", borderRadius: 999, border: "none", background: rating ? pc : "#e2e8f0", color: rating ? "white" : "#94a3b8", fontWeight: 800, fontSize: 15, fontFamily: "inherit", cursor: rating && state !== "sending" ? "pointer" : "default" }}>
                  {state === "sending" ? "שולחת…" : rating ? "שליחה" : "בחרי דירוג כדי לשלוח"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
