import { todayStr, formatShort } from "../lib/utils";

// ── "המשחק הבא" — פס תזכורת מעל כרטיס האירוע ─────────────────────────────────
// אפי, 21.11.26: תזכורת בלבד, בלי סימון הגעה — ההגעה למשחק נסמנת כרגיל כשהוא
// הופך לאירוע הקרוב. מציג את המשחק העתידי הקרוב שאינו האירוע הנוכחי.
export function nextGameOf(events, current) {
  const t = todayStr();
  return (events || []).filter(e => e.type === "game" && e.open && !e.cancelled && e.date >= t && (!current || e.id !== current.id))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || "").localeCompare(String(b.time || "")))[0] || null;
}

export default function NextGameStrip({ events, current }) {
  const g = nextGameOf(events, current);
  if (!g) return null;
  const days = Math.round((new Date(g.date + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 86400000);
  const when = days === 0 ? "היום" : days === 1 ? "מחר" : days < 14 ? `בעוד ${days} ימים` : `בעוד ${Math.round(days / 7)} שבועות`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg,#fff7d6,#fde68a)", border: "1px solid #fcd34d", borderRadius: 14, padding: "10px 13px", marginBottom: 12 }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>🏆</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: "#78350f" }}>המשחק הבא: נגד {g.opponent || "—"}</div>
        <div style={{ fontSize: 12, color: "#92400e", fontWeight: 600 }}>{formatShort(g.date)} · {g.time}{g.location ? ` · ${g.location}` : ""}</div>
      </div>
      <span style={{ flexShrink: 0, background: "#78350f", color: "#fde68a", borderRadius: 20, padding: "3px 10px", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>{when}</span>
    </div>
  );
}
