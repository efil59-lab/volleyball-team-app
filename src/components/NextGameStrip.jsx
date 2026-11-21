import { useState } from "react";
import { todayStr, formatShort } from "../lib/utils";
import { OutcomeBadge } from "./shared";

// ── "המשחק הבא" — פס תזכורת מעל כרטיס האירוע ─────────────────────────────────
// אפי, 21.11.26: תזכורת בלבד, בלי סימון הגעה — ההגעה למשחק נסמנת כרגיל כשהוא
// הופך לאירוע הקרוב. מציג את המשחק העתידי הקרוב שאינו האירוע הנוכחי.
// לחיצה (או "לכל המשחקים") פותחת את כל המשחקים — רשימה חיה מהאפליקציה, לא
// תמונה קבועה, כי משחקים נוספים עוד ייקבעו; משחק שהתקיים מציג את התוצאה.
const LEAGUE_IMG = "/league.png";

// הודעת המנהלת שמקשרת ללוח הליגה מיותרת איפה שהפס מוצג — הוא כבר פותח את המשחקים
export const withoutLeagueLink = (notifs) => (notifs || []).filter(n => !String(n.text || "").includes(LEAGUE_IMG));

export function nextGameOf(events, current) {
  const t = todayStr();
  return (events || []).filter(e => e.type === "game" && e.open && !e.cancelled && e.date >= t && (!current || e.id !== current.id))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || "").localeCompare(String(b.time || "")))[0] || null;
}

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function GamesSheet({ events, archive, onClose }) {
  const t = todayStr();
  const seen = new Set();
  const games = [...(archive || []), ...(events || [])]
    .filter(e => e && e.type === "game" && e.date && !seen.has(String(e.id)) && seen.add(String(e.id)))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || "").localeCompare(String(b.time || "")));
  const nextId = (games.find(g => g.date >= t && !g.cancelled && !g.outcome) || {}).id;
  const thisYear = new Date().getFullYear();
  return (
    <div onClick={onClose} role="dialog" aria-label="כל המשחקים"
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(8,10,30,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "#f3f5fb", width: "100%", maxWidth: 520, maxHeight: "88vh", borderRadius: "20px 20px 0 0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "linear-gradient(160deg,#2a36a8 0%,#1a237e 55%,#10164f 100%)", color: "white", padding: "16px 18px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>🏆</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>כל המשחקים</div>
            <div style={{ fontSize: 12.5, opacity: 0.85 }}>{games.length} משחקים · מתעדכן אוטומטית</div>
          </div>
          <button onClick={onClose} aria-label="סגירה" style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: 10, padding: "6px 12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>סגירה</button>
        </div>
        <div style={{ overflowY: "auto", padding: "12px 14px calc(16px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 9 }}>
          {games.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 24, fontWeight: 600 }}>עוד לא נקבעו משחקים</div>}
          {games.map(g => {
            const d = new Date(g.date + "T12:00:00");
            const past = g.date < t || !!g.outcome;
            const isNext = g.id === nextId;
            return (
              <div key={g.id} style={{ display: "flex", alignItems: "stretch", background: "white", borderRadius: 14, overflow: "hidden", border: isNext ? "2px solid #f5c842" : "1px solid #dfe3f0", opacity: past && !g.outcome ? 0.6 : 1 }}>
                <div style={{ flex: "0 0 74px", background: past ? "#64748b" : "#1a237e", color: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
                  <b style={{ fontSize: 24, lineHeight: 1, fontWeight: 900 }}>{d.getDate()}</b>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: past ? "#e2e8f0" : "#f5c842", marginTop: 2 }}>{MONTHS[d.getMonth()]}{d.getFullYear() !== thisYear ? ` ${d.getFullYear()}` : ""}</span>
                  <span style={{ fontSize: 11, opacity: 0.85 }}>יום {DAYS[d.getDay()]}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: "9px 12px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 3 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#1a237e" }}>
                    {g.cancelled ? "❌ בוטל · " : ""}נגד {g.opponent || "—"}
                    {isNext && <span style={{ marginRight: 6, background: "#f5c842", color: "#10163f", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>הבא</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#475569" }}>🕒 {g.time}{g.location ? ` · 📍 ${g.location}` : ""}</div>
                  {g.outcome && <div><OutcomeBadge outcome={g.outcome} result={g.result} /></div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function NextGameStrip({ events, archive, current }) {
  const [open, setOpen] = useState(false);
  const g = nextGameOf(events, current);
  if (!g) return null;
  const days = Math.round((new Date(g.date + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 86400000);
  const when = days === 0 ? "היום" : days === 1 ? "מחר" : days < 14 ? `בעוד ${days} ימים` : `בעוד ${Math.round(days / 7)} שבועות`;
  return (
    <>
      <div onClick={() => setOpen(true)} role="button"
        style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg,#fff7d6,#fde68a)", border: "1px solid #fcd34d", borderRadius: 14, padding: "10px 13px", marginBottom: 12, cursor: "pointer" }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>🏆</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: "#78350f" }}>המשחק הבא: נגד {g.opponent || "—"}</div>
          <div style={{ fontSize: 12, color: "#92400e", fontWeight: 600 }}>{formatShort(g.date)} · {g.time}{g.location ? ` · ${g.location}` : ""}</div>
        </div>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <span style={{ background: "#78350f", color: "#fde68a", borderRadius: 20, padding: "3px 10px", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>{when}</span>
          <span style={{ color: "#78350f", fontSize: 11.5, fontWeight: 800, textDecoration: "underline", whiteSpace: "nowrap" }}>לכל המשחקים ←</span>
        </div>
      </div>
      {open && <GamesSheet events={events} archive={archive} onClose={() => setOpen(false)} />}
    </>
  );
}
