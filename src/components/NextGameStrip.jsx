import { useState } from "react";
import { todayStr, formatShort } from "../lib/utils";
import { LinkViewer } from "./NotifLink";

// ── "המשחק הבא" — פס תזכורת מעל כרטיס האירוע ─────────────────────────────────
// אפי, 21.11.26: תזכורת בלבד, בלי סימון הגעה — ההגעה למשחק נסמנת כרגיל כשהוא
// הופך לאירוע הקרוב. מציג את המשחק העתידי הקרוב שאינו האירוע הנוכחי.
// לחיצה (או "לכל המשחקים") פותחת את לוח משחקי הליגה — במקום ההודעה שמירי פרסמה.
const LEAGUE_IMG = "/league.png";

export function nextGameOf(events, current) {
  const t = todayStr();
  return (events || []).filter(e => e.type === "game" && e.open && !e.cancelled && e.date >= t && (!current || e.id !== current.id))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || "").localeCompare(String(b.time || "")))[0] || null;
}

export default function NextGameStrip({ events, current }) {
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
      <LinkViewer url={open ? LEAGUE_IMG : null} onClose={() => setOpen(false)} />
    </>
  );
}
