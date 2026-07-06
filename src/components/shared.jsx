import { useState, useEffect } from "react";
import { S } from "../styles/S";
import { formatDate, formatShort, todayStr, monthDay } from "../lib/utils";

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────────
function Confirm({ msg, onOk, onCancel, icon, okLabel, tone }) {
  const notice = !onCancel; // אין ביטול = התראת-יידוע (כפתור אחד) במקום אישור פעולה
  const accent = tone === "warn" ? "#f59e0b" : (notice ? "#1a237e" : "#ef4444");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 20, padding: 28, maxWidth: 320, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{icon || (notice ? "🗓️" : "⚠️")}</div>
        <p style={{ fontSize: 15, color: "#1e293b", fontWeight: 600, marginBottom: 22, lineHeight: 1.6 }}>{msg}</p>
        <div style={{ display: "flex", gap: 10 }}>
          {!notice && <button onClick={onCancel} style={{ flex: 1, padding: 12, background: "#f1f5f9", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, color: "#64748b" }}>ביטול</button>}
          <button onClick={onOk} style={{ flex: 1, padding: 12, background: accent, border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, color: "white" }}>{okLabel || (notice ? "הבנתי" : "אישור")}</button>
        </div>
      </div>
    </div>
  );
}

// ── ATTENDANCE MODAL ──────────────────────────────────────────────────────────
function AttModal({ title, list, players, attendance, eventId, onClose, pc, sc }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxHeight: "65vh", overflowY: "auto", boxSizing: "border-box" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: pc, marginBottom: 14 }}>{title} ({list.length})</div>
        {list.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>אף אחת עדיין</p>}
        {list.map(p => {
          const prof = players.find(x => x.id === p.id) || p;
          const rec = attendance[`${eventId}_${p.id}`];
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              {prof.photo ? <img src={prof.photo} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 38, height: 38, borderRadius: "50%", background: pc, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{p.name[0]}</div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                {rec?.note && <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>"{rec.note}"</div>}
              </div>
            </div>
          );
        })}
        <button onClick={onClose} style={{ width: "100%", marginTop: 16, padding: 12, background: "#f1f5f9", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, color: "#64748b" }}>סגור</button>
      </div>
    </div>
  );
}

// ── באנר שיווקי מתחלף (fade) — דף בית שחקנית + דף נחיתה ──────────────────────
function PurchaseBanner({ pc, sc, onClick }) {
  const [showB, setShowB] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setShowB(v => !v), 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <button onClick={onClick}
      style={{ width: "100%", border: `1px dashed ${pc}55`, background: `${pc}0a`, borderRadius: 14, padding: "12px 16px", cursor: "pointer", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 46 }}>
      <span style={{ position: "relative", display: "inline-block", height: 20, lineHeight: "20px" }}>
        <span style={{ opacity: showB ? 0 : 1, transition: "opacity 0.5s", color: pc, fontWeight: 700, fontSize: 14 }}>
          🏐 מעוניינת באפליקציה לקבוצה שלך?
        </span>
        <span style={{ position: "absolute", inset: 0, opacity: showB ? 1 : 0, transition: "opacity 0.5s", color: pc, fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>
          לחצי כאן לפרטים ←
        </span>
      </span>
    </button>
  );
}

// ── NOTIFICATIONS TICKER ──────────────────────────────────────────────────────
function NotifTicker({ notifs, pc, sc }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  // קדימות לביטול: אם יש הודעת ביטול פעילה — מציגים רק אותה/ן, בלי שאר ההודעות
  const cancels = notifs.filter(x => x.type === "cancel");
  const list = cancels.length > 0 ? cancels : notifs;

  useEffect(() => {
    setIdx(0);
    if (list.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % list.length);
        setVisible(true);
      }, 400);
    }, 3500);
    return () => clearInterval(timer);
  }, [list.length]);

  if (list.length === 0) return null;
  const n = list[idx] || list[0];
  const isCancel = n.type === "cancel";
  const isCoach = n.type === "coach";
  const bgColor = isCancel ? "#ef4444" : pc;
  const borderColor = isCancel ? "#ff6b6b" : sc;
  const displayText = isCoach ? `הודעה מהמאמן/ת: ${n.text}` : n.text;

  return (
    <div style={{ marginBottom: 12, overflow: "hidden" }}>
      <div style={{
        background: bgColor,
        borderRadius: 12,
        padding: "10px 14px",
        boxSizing: "border-box",
        maxWidth: "100%",
        boxShadow: `0 4px 16px rgba(0,0,0,0.15), inset -5px 0 0 0 ${borderColor}`,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        opacity: visible ? 1 : 0,
        transition: "all 0.4s ease",
        textAlign: "center",
      }}>
        <div style={{ height: list.length > 1 ? 58 : "auto", display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", overflowX: "hidden" }}>
          <div style={{ color: "white", fontWeight: isCancel ? 800 : 700, fontSize: 13, lineHeight: 1.4, overflowWrap: "break-word", wordBreak: "break-word", width: "100%" }}>{displayText}</div>
        </div>
        {list.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 10 }}>
            {list.map((_, i) => (
              <div key={i} style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 3, background: i === idx ? (isCancel ? "white" : sc) : "rgba(255,255,255,0.4)", transition: "all 0.3s" }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// תג תוצאה צבעוני — ניצחון/הפסד/תיקו + ציון אופציונלי
// מסך "כל האירועים מסוג X" — נפתח בלחיצה על פריט במקרא הלוח. משותף למנהל ולשחקנית.
// kind: "training" | "game" | "birthday" | "cancelled". משחקים נשלפים מהפתוחים + הארכיון (כולל תוצאה).
function LegendEventsModal({ kind, events, archive, players, playerProfiles, pc, onClose }) {
  const meta = ({
    training:  { icon: "🏋️", label: "אימונים" },
    game:      { icon: "🏆", label: "משחקים" },
    birthday:  { icon: "🎂", label: "ימי הולדת" },
    cancelled: { icon: "❌", label: "אירועים שבוטלו" },
  })[kind] || { icon: "📅", label: "אירועים" };

  // איחוד אירועים פתוחים + ארכיון, ללא כפילויות לפי id (ארכוב מסיר מהפתוחים — מסירים ליתר ביטחון).
  const seen = new Set();
  const allEvents = [...(events || []), ...(archive || [])].filter(e => {
    if (seen.has(e.id)) return false; seen.add(e.id); return true;
  });

  let rows = [];
  if (kind === "birthday") {
    rows = (players || [])
      .map(p => ({ p, b: (playerProfiles[p.id] || {}).birthday }))
      .filter(x => x.b)
      .sort((a, b) => monthDay(a.b).localeCompare(monthDay(b.b))) // לפי יום בשנה
      .map(({ p, b }) => ({
        key: "b" + p.id, icon: "🎂", title: p.name,
        dateLabel: formatShort(b),
      }));
  } else {
    const today = todayStr();
    const base = kind === "cancelled"
      ? allEvents.filter(e => e.cancelled)
      : allEvents.filter(e => e.type === kind && !e.cancelled && (e.date || "") >= today); // רק עתידיים
    rows = base
      .sort((a, b) => kind === "cancelled"
        ? (b.date || "").localeCompare(a.date || "")   // בוטלו: מהחדש לישן
        : (a.date || "").localeCompare(b.date || ""))  // עתידיים: הקרוב ביותר ראשון
      .map(ev => ({
        key: "e" + ev.id, ev,
        icon: ev.type === "training" ? "🏋️" : "🏆",
        title: ev.type === "training" ? "אימון" : (ev.opponent ? `משחק נגד ${ev.opponent}` : "משחק"),
        dateLabel: formatDate(ev.date) + (ev.time ? ` · ${ev.time}` : ""),
      }));
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 18, padding: 18, maxWidth: 360, width: "100%", boxSizing: "border-box", maxHeight: "82vh", display: "flex", flexDirection: "column", boxShadow: "0 18px 50px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: pc }}>{meta.icon} {meta.label} <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: 14 }}>({rows.length})</span></div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#64748b", fontWeight: 800 }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.length === 0 && <Empty icon={meta.icon} text={`אין ${meta.label} להצגה`} />}
          {rows.map(r => (
            <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 10, background: r.ev && r.ev.cancelled ? "#fef2f2" : "#f8fafc", borderRadius: 12, padding: "10px 12px" }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", textDecoration: r.ev && r.ev.cancelled ? "line-through" : "none" }}>{r.title}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{r.dateLabel}</div>
                {r.ev && r.ev.outcome && <div style={{ marginTop: 4 }}><OutcomeBadge outcome={r.ev.outcome} result={r.ev.result} /></div>}
              </div>
              {r.ev && r.ev.cancelled && <span style={{ background: "#fee2e2", color: "#ef4444", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>בוטל</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OutcomeBadge({ outcome, result, size }) {
  const map = { win: { lbl: "ניצחון", c: "#16a34a", bg: "#dcfce7" }, loss: { lbl: "הפסד", c: "#ef4444", bg: "#fee2e2" }, draw: { lbl: "תיקו", c: "#64748b", bg: "#f1f5f9" } };
  const o = map[outcome];
  if (!o) return null;
  return <span style={{ display: "inline-block", background: o.bg, color: o.c, borderRadius: 8, padding: size === "lg" ? "6px 14px" : "3px 10px", fontSize: size === "lg" ? 15 : 13, fontWeight: 800, whiteSpace: "nowrap" }}>{o.lbl}{result ? ` ${result}` : ""}</span>;
}

function Empty({ icon, text }) {
  return <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}><div style={{ fontSize: 48 }}>{icon}</div><p style={{ marginTop: 8 }}>{text}</p></div>;
}
function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>{children}</div>;
}
// כרטיס מתקפל לשימוש חוזר — כותרת לחיצה + מונה אופציונלי + חץ מסתובב
function Collapsible({ title, count, defaultOpen = false, accent = "#1e293b", children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", cursor: "pointer", padding: 14, textAlign: "right" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: accent }}>{title}{typeof count === "number" ? ` (${count})` : ""}</span>
        <span style={{ fontSize: 12, color: "#94a3b8", display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }}>▾</span>
      </button>
      <div className="collapse-grid" style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows 0.28s ease" }}>
        <div style={{ overflow: "hidden" }}>
          <div style={{ padding: "0 14px 14px" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
// ── ניווט תחתון (מובייל-ראשון) — מחליף את שורת הטאבים העליונה הצפופה ──────────
// items: הטאבים הראשיים [{key, icon, label, badge?}]. moreItems: השאר, נפתחים בגיליון "עוד".
// כשטאב מתוך "עוד" פעיל — המשבצת האחרונה מציגה אותו (אייקון+שם) במקום "עוד".
function BottomNav({ items, moreItems = [], active, onChange, pc }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const activeMoreItem = moreItems.find(m => m.key === active) || null;

  function Slot({ icon, label, isActive, badge, onClick }) {
    return (
      <button onClick={onClick}
        style={{ flex: 1, minWidth: 0, padding: "7px 2px 6px", background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <span style={{ position: "relative", fontSize: 21, lineHeight: "27px", background: isActive ? `${pc}14` : "transparent", borderRadius: 14, padding: "1px 13px", transition: "background 0.2s" }}>
          {icon}
          {badge && <span style={{ position: "absolute", top: 1, left: 6, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "1.5px solid white", animation: "navDotPulse 1s ease-in-out infinite" }} />}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: isActive ? 800 : 600, color: isActive ? pc : "#64748b", whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </button>
    );
  }

  return (
    <>
      <style>{`@keyframes navDotPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(1.4); } }`}</style>
      {moreOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 240 }} onClick={() => setMoreOpen(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "20px 20px 0 0", padding: "14px 14px", paddingBottom: "calc(14px + env(safe-area-inset-bottom))", boxShadow: "0 -10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e2e8f0", margin: "0 auto 12px" }} />
            {moreItems.map(m => (
              <button key={m.key} onClick={() => { onChange(m.key); setMoreOpen(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "13px 12px", background: active === m.key ? `${pc}0d` : "transparent", border: "none", borderRadius: 12, cursor: "pointer", textAlign: "right" }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{m.icon}</span>
                <span style={{ fontSize: 15, fontWeight: active === m.key ? 800 : 600, color: active === m.key ? pc : "#334155" }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 230, background: "white", borderTop: "1px solid #e2e8f0", boxShadow: "0 -4px 16px rgba(0,0,0,0.07)", display: "flex", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {items.map(it => (
          <Slot key={it.key} icon={it.icon} label={it.label} badge={it.badge} isActive={active === it.key && !moreOpen}
            onClick={() => { setMoreOpen(false); onChange(it.key); }} />
        ))}
        {moreItems.length > 0 && (
          <Slot icon={activeMoreItem ? activeMoreItem.icon : "⊞"} label={activeMoreItem ? activeMoreItem.label : "עוד"}
            badge={moreItems.some(m => m.badge)} isActive={!!activeMoreItem || moreOpen}
            onClick={() => setMoreOpen(v => !v)} />
        )}
      </nav>
    </>
  );
}

export { Confirm, AttModal, PurchaseBanner, NotifTicker, LegendEventsModal, OutcomeBadge, Empty, Label, Collapsible, BottomNav };
