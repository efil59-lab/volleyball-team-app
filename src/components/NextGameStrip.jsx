import { useState, useMemo } from "react";
import { todayStr, formatShort } from "../lib/utils";
import { OutcomeBadge } from "./shared";
import { hallOf, wazeUrl } from "../lib/halls";

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

// חלון קטן של אולם: כתובת, הערת הגעה וניווט בוויז (אפי, 22.11.26)
function HallSheet({ h, onClose }) {
  return (
    <div onClick={onClose} role="dialog" aria-label={h.name} className="vb-sheet-ov"
      style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(8,10,30,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="vb-sheet"
        style={{ background: "white", width: "100%", maxWidth: 380, borderRadius: 18, padding: "18px 16px 12px", boxSizing: "border-box", textAlign: "center" }}>
        <div style={{ fontSize: 26 }}>📍</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: "#1a237e", marginTop: 2 }}>{h.name}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#334155", marginTop: 6 }}>{h.address}</div>
        {h.note && <div style={{ fontSize: 13, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>{h.note}</div>}
        <a href={wazeUrl(h)} target="_blank" rel="noopener noreferrer"
          style={{ display: "block", marginTop: 14, background: "#33ccff", color: "#0b2540", borderRadius: 12, padding: "12px", fontSize: 16, fontWeight: 900, textDecoration: "none" }}>🚗 נווט בוויז</a>
        <button onClick={onClose} style={{ display: "block", width: "100%", marginTop: 4, background: "transparent", border: "none", color: "#64748b", fontSize: 14, fontWeight: 600, padding: 10, cursor: "pointer", fontFamily: "inherit" }}>סגירה</button>
      </div>
    </div>
  );
}

export function GamesSheet({ events, archive, newIds, onClose, halls }) {
  const [hall, setHall] = useState(null);
  const t = todayStr();
  const seen = new Set();
  const games = [...(archive || []), ...(events || [])]
    .filter(e => e && e.type === "game" && e.date && !seen.has(String(e.id)) && seen.add(String(e.id)))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || "").localeCompare(String(b.time || "")));
  const nextId = (games.find(g => g.date >= t && !g.cancelled && !g.outcome) || {}).id;
  const thisYear = new Date().getFullYear();
  return (
    <div onClick={onClose} role="dialog" aria-label="כל המשחקים" className="vb-sheet-ov"
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(8,10,30,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="vb-sheet"
        style={{ background: "#f1f5f9", width: "100%", maxWidth: 520, maxHeight: "88vh", borderRadius: "20px 20px 0 0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
                    {g.cancelled ? "❌ בוטל · " : ""}מול {g.opponent || "—"}
                    {isNext && <span style={{ marginRight: 6, background: "#f5c842", color: "#10163f", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>הבא</span>}
                    {newIds && newIds.has(String(g.id)) && <span style={{ marginRight: 6, background: "#dc2626", color: "white", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>חדש</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#475569" }}>🕒 {g.time}{g.location ? ` · 📍 ${g.location}` : ""}</div>
                  {halls && (() => { const h = hallOf(g.location); return h && (
                    <button onClick={() => setHall(h)} className="vb-hall-link"
                      style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: "#1d4ed8", textDecoration: "underline", textAlign: "right" }}>
                      🗺️ {h.address}
                    </button>
                  ); })()}
                  {g.outcome && <div><OutcomeBadge outcome={g.outcome} result={g.result} /></div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {hall && <HallSheet h={hall} onClose={() => setHall(null)} />}
    </div>
  );
}

// ── תשומת לב (אפי, 21.11.26) ────────────────────────────────────────────────
// 1. הגביע מתנדנד בעדינות כל כמה שניות, תמיד.
// 2. עד הלחיצה הראשונה במכשיר: מסגרת זהב פועמת + ברק אור שחולף על הפס.
// 3. הקריאה חוזרת כשנוסף משחק חדש (תגית "חדש") עד שפותחים את הרשימה,
//    וה"מחר"/"היום" פועם ביום שלפני המשחק וביומו.
// "הפחתת תנועה" בטלפון = הכל סטטי. הזיכרון מקומי למכשיר (localStorage).
const SEEN_KEY = "vb_ngs_seen";
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "null"); } catch { return null; } };
const writeSeen = (v) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(v)); } catch { /* private mode */ } };

const NGS_CSS = `
.ngs{position:relative;overflow:hidden;isolation:isolate}
.ngs-cup{display:inline-block;transform-origin:50% 90%;animation:ngs-wiggle 4.5s ease-in-out infinite}
.ngs-spark{position:absolute;top:-4px;left:-6px;font-size:11px;opacity:0;animation:ngs-spark 4.5s ease-in-out infinite;pointer-events:none}
.ngs.call::before{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 2px #f5b81e,0 0 0 0 transparent;opacity:0;animation:ngs-glow 1.8s ease-in-out infinite;pointer-events:none;z-index:-1}
.ngs.call{animation:ngs-halo 1.8s ease-in-out infinite}
.ngs.call::after{content:"";position:absolute;top:0;bottom:0;width:38%;left:0;background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent);transform:translateX(-140%) skewX(-18deg);animation:ngs-sheen 3.4s ease-in-out infinite;pointer-events:none}
.ngs-soon{animation:ngs-pill 1.3s ease-in-out infinite}
@keyframes ngs-wiggle{0%,68%,100%{transform:rotate(0)}73%{transform:rotate(-15deg)}78%{transform:rotate(12deg)}83%{transform:rotate(-8deg)}88%{transform:rotate(4deg)}93%{transform:rotate(0)}}
@keyframes ngs-spark{0%,72%,100%{opacity:0;transform:scale(.4)}80%{opacity:1;transform:scale(1.15)}90%{opacity:0;transform:scale(.6)}}
@keyframes ngs-glow{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes ngs-halo{0%,100%{box-shadow:0 0 0 0 rgba(245,184,30,0)}50%{box-shadow:0 0 0 3px rgba(245,184,30,.45),0 0 16px rgba(245,184,30,.55)}}
@keyframes ngs-sheen{0%,55%{transform:translateX(-140%) skewX(-18deg)}100%{transform:translateX(320%) skewX(-18deg)}}
@keyframes ngs-pill{0%,100%{transform:scale(1)}50%{transform:scale(1.1);box-shadow:0 0 0 3px rgba(120,53,15,.18)}}
@media (prefers-reduced-motion:reduce){.ngs-cup,.ngs-spark,.ngs.call,.ngs.call::before,.ngs.call::after,.ngs-soon{animation:none}.ngs-spark{display:none}.ngs.call{box-shadow:0 0 0 2px #f5b81e}}
`;

// ── אישור הגעה מוקדם מהפס (אפי, 21.11.26) ───────────────────────────────────
// כשהמסך מעביר onRsvp, בצד ימין של הפס יש כפתור "אישור הגעה" (ואחרי תשובה —
// הסטטוס, ולחיצה משנה). התשובה נשמרת על המשחק עצמו, כמו בכרטיס הראשי, כך
// שכשהמשחק הופך לאירוע הקרוב היא כבר מסומנת שם, והמנהלת רואה אותה ברשימה.
function WhoList({ title, color, names }) {
  if (!names || !names.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color, marginBottom: 5 }}>{title} ({names.length})</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {names.map((n, i) => <span key={i} style={{ background: "#f1f5f9", borderRadius: 999, padding: "3px 10px", fontSize: 12.5, color: "#334155", fontWeight: 600 }}>{n}</span>)}
      </div>
    </div>
  );
}

function RsvpSheet({ g, status, who, onPick, onClose }) {
  const big = (c, on) => ({ flex: 1, padding: "14px 8px", borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", border: on ? `2px solid ${c}` : "1px solid #e2e8f0", background: on ? c : "white", color: on ? "white" : c });
  return (
    <div onClick={onClose} role="dialog" aria-label="אישור הגעה למשחק" className="vb-sheet-ov"
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(8,10,30,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="vb-sheet"
        style={{ background: "white", width: "100%", maxWidth: 480, borderRadius: "20px 20px 0 0", padding: "18px 16px calc(18px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", fontSize: 17, fontWeight: 900, color: "#1a237e" }}>🏆 משחק מול {g.opponent || "—"}</div>
        <div style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 3 }}>{formatShort(g.date)} · {g.time}{g.location ? ` · ${g.location}` : ""}</div>
        <div style={{ textAlign: "center", fontSize: 14.5, fontWeight: 800, color: "#334155", margin: "16px 0 10px" }}>{status ? "התשובה שלך — אפשר לשנות:" : "מגיעה למשחק?"}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onPick("coming")} style={big("#16a34a", status === "coming")}>✅ מגיעה</button>
          <button onClick={() => onPick("notcoming")} style={big("#dc2626", status === "notcoming")}>❌ לא מגיעה</button>
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 10 }}>התשובה תופיע גם בכרטיס המשחק כשיגיע תורו</div>
        {who && (who.coming.length + who.notcoming.length > 0) && (
          <div style={{ marginTop: 6, borderTop: "1px solid #eef2f7", paddingTop: 4, maxHeight: "34vh", overflowY: "auto" }}>
            <WhoList title="✅ מגיעות" color="#16a34a" names={who.coming} />
            <WhoList title="❌ לא מגיעות" color="#dc2626" names={who.notcoming} />
          </div>
        )}
        <button onClick={onClose} style={{ display: "block", width: "100%", marginTop: 8, background: "transparent", border: "none", color: "#64748b", fontSize: 14, fontWeight: 600, padding: 10, cursor: "pointer", fontFamily: "inherit" }}>סגירה</button>
      </div>
    </div>
  );
}

export default function NextGameStrip({ events, archive, current, statusOf, onRsvp, whoFor, halls = false }) {
  const [open, setOpen] = useState(false);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const [sheetNew, setSheetNew] = useState(null);
  const g = nextGameOf(events, current);
  // משחקים עתידיים שהמכשיר הזה עוד לא ראה ברשימה
  const newIds = useMemo(() => {
    if (!seen) return new Set();
    const known = new Set((seen.games || []).map(String));
    const t = todayStr();
    return new Set((events || []).filter(e => e && e.type === "game" && e.date >= t && !e.cancelled && !known.has(String(e.id))).map(e => String(e.id)));
  }, [events, seen]);
  if (!g) return null;
  const days = Math.round((new Date(g.date + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 86400000);
  const when = days === 0 ? "היום" : days === 1 ? "מחר" : days < 14 ? `בעוד ${days} ימים` : `בעוד ${Math.round(days / 7)} שבועות`;
  const calling = !seen || newIds.size > 0;
  // הפס נרגע ברגע שלחצו עליו — לאישור או לרשימה
  const markSeen = () => {
    const ids = [...(archive || []), ...(events || [])].filter(e => e && e.type === "game").map(e => String(e.id));
    const v = { opened: true, games: ids }; writeSeen(v); setSeen(v);
  };
  const openRsvp = () => { setRsvpOpen(true); markSeen(); };
  const openSheet = () => {
    setSheetNew(newIds);
    setOpen(true);
    const ids = [...(archive || []), ...(events || [])].filter(e => e && e.type === "game").map(e => String(e.id));
    // המשחקים החדשים של הפתיחה הזו נשארים מסומנים ברשימה (sheetNew); הפס נרגע מיד
    const v = { opened: true, games: ids }; writeSeen(v); setSeen(v);
  };
  return (
    <>
      <style>{NGS_CSS}</style>
      {/* לחיצה על הפס (ימין ומרכז) = אישור הגעה; "לכל המשחקים" משמאל = רשימת המשחקים (אפי, 21.11.26).
          בלי אישור הגעה (צופה) — כל הפס פותח את המשחקים. */}
      <div onClick={onRsvp ? openRsvp : openSheet} role="button" className={"ngs" + (calling ? " call" : "")}
        style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg,#fff7d6,#fde68a)", border: "1px solid #fcd34d", borderRadius: 14, padding: "10px 13px", marginBottom: 12, cursor: "pointer" }}>
        {onRsvp ? (() => {
          const st = statusOf ? statusOf(g) : null;
          const look = st === "coming" ? { bg: "#16a34a", fg: "white", bd: "#16a34a", ic: "✅", tx: "מגיעה" }
            : st === "notcoming" ? { bg: "#dc2626", fg: "white", bd: "#dc2626", ic: "❌", tx: "לא מגיעה" }
            : { bg: "#fffdf5", fg: "#78350f", bd: "#d97706", ic: "✋", tx: "אישור הגעה" }; // לא "white" — מצב לילה הופך white לכהה והטקסט החום נבלע
          return (
            <button onClick={(e) => { e.stopPropagation(); openRsvp(); }} aria-label="אישור הגעה למשחק"
              style={{ flex: "0 0 auto", width: 66, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "6px 4px", borderRadius: 12, border: `1.5px solid ${look.bd}`, background: look.bg, color: look.fg, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 6px rgba(120,53,15,0.15)" }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>{look.ic}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, lineHeight: 1.15, textAlign: "center" }}>{look.tx}</span>
            </button>
          );
        })() : (
          <span style={{ position: "relative", fontSize: 22, flexShrink: 0 }}>
            <span className="ngs-cup">🏆</span>
            <span className="ngs-spark">✨</span>
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: "#78350f" }}>
            {onRsvp && <span style={{ position: "relative", display: "inline-block", marginLeft: 4 }}><span className="ngs-cup">🏆</span><span className="ngs-spark">✨</span></span>}
            {current && current.type === "game" ? "המשחק הבא בתור" : "המשחק הבא"}: מול {g.opponent || "—"}
            {newIds.has(String(g.id)) && <span style={{ marginRight: 6, background: "#dc2626", color: "white", borderRadius: 999, padding: "1px 7px", fontSize: 10.5, fontWeight: 800, verticalAlign: "middle" }}>חדש</span>}
          </div>
          <div style={{ fontSize: 12, color: "#8a3c0c", fontWeight: 600 }}>{formatShort(g.date)} · {g.time}{g.location ? ` · ${g.location}` : ""}</div>
          {onRsvp && whoFor && (() => { const n = whoFor(g).coming.length; return (
            <div style={{ fontSize: 11.5, color: "#78350f", fontWeight: 700, marginTop: 1 }}>👥 {n === 0 ? "עדיין אין אישורי הגעה" : n === 1 ? "אחת כבר מגיעה" : `${n} כבר מגיעות`}</div>
          ); })()}
        </div>
        <div onClick={(e) => { e.stopPropagation(); openSheet(); }} role="button" aria-label="לכל המשחקים"
          style={{ flexShrink: 0, alignSelf: "stretch", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, margin: "-10px 0 -10px -13px", padding: "10px 8px 10px 13px" }}>
          <span className={days <= 1 ? "ngs-soon" : undefined} style={{ display: "inline-block", background: "#78350f", color: "#fde68a", borderRadius: 20, padding: "3px 10px", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>{when}</span>
          <span style={{ color: "#78350f", fontSize: 11.5, fontWeight: 800, textDecoration: "underline", whiteSpace: "nowrap" }}>לכל המשחקים ←</span>
        </div>
      </div>
      {open && <GamesSheet events={events} archive={archive} newIds={sheetNew} halls={halls} onClose={() => setOpen(false)} />}
      {rsvpOpen && onRsvp && <RsvpSheet g={g} status={statusOf ? statusOf(g) : null} who={whoFor ? whoFor(g) : null} onClose={() => setRsvpOpen(false)}
        onPick={async (s) => { setRsvpOpen(false); try { await onRsvp(g, s); } catch (e) { console.error("early rsvp:", e); } }} />}
    </>
  );
}
