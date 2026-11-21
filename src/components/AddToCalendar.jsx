import { useState } from "react";
import { calendarLinkRemote } from "../lib/db";

// ── "הוספה ליומן" לאירוע אחד ─────────────────────────────────────────────────
// אפשרות 2 של אפי (21.11.26), לצד המנוי: מוסיף רק את האירוע הזה. אנדרואיד —
// טופס "אירוע חדש" של יומן גוגל, מלא מראש. אייפון — קובץ האירוע מהשרת
// (calendarFeed&event=…), שנפתח ישר כ"הוסף אירוע". שינוי מאוחר יותר לא יגיע ליומן.
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const gDate = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

let linkCache = null;

export default function AddToCalendar({ ev, teamName, color = "rgba(255,255,255,0.92)" }) {
  const [busy, setBusy] = useState(false);
  if (!ev) return null;

  async function add() {
    if (busy) return;
    if (isIOS()) {
      setBusy(true);
      try {
        if (!linkCache) linkCache = await calendarLinkRemote();
        window.location.href = `${linkCache.https}&event=${encodeURIComponent(ev.id)}`;
      } catch (e) { console.error("calendarLink:", e); }
      setBusy(false);
      return;
    }
    const start = new Date(`${ev.date}T${ev.time || "00:00"}:00`);
    const end = new Date(start.getTime() + 2 * 3600 * 1000);
    const title = ev.type === "game" ? `🏆 משחק${ev.opponent ? " נגד " + ev.opponent : ""}` : "🏐 אימון כדורשת";
    const q = new URLSearchParams({
      action: "TEMPLATE", text: title, dates: `${gDate(start)}/${gDate(end)}`,
      location: ev.location || "", details: [ev.note, teamName].filter(Boolean).join("\n"), ctz: "Asia/Jerusalem",
    });
    window.open(`https://calendar.google.com/calendar/render?${q.toString()}`, "_blank", "noopener");
  }

  return (
    <button onClick={(e) => { e.stopPropagation(); add(); }} disabled={busy}
      style={{ background: "transparent", border: "none", color, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>
      {busy ? "…" : "📅 הוספה ליומן"}
    </button>
  );
}
