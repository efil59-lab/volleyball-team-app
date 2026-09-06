// ── שחקניות בדסקטופ: רשימה + פרופיל ─────────────────────────────────────────
// במובייל כל שחקנית היא כרטיס שנפתח ונסגר, ולראות פרטים של אחת אומר לדחוף
// את כל השאר למטה. במסך רחב אין סיבה לכך: הרשימה מימין, הפרופיל המלא משמאל,
// והמעבר בין שחקניות לא מזיז כלום. זה האידיום שהופך מסך לתוכנה.
//
// כל הלוגיקה נשארה ב-AdminPlayers ומגיעה לכאן כ-props. הקומפוננטה הזו היא
// פריסה בלבד — כדי ששינוי בהתנהגות לא יצטרך להיכתב פעמיים.
import { useState, useMemo } from "react";
import { formatShort, ageFromBirthday } from "../lib/utils";
import "./site.css";

const ini = (n) => String(n || "?").trim().slice(0, 2);

export default function PlayersDesktop({
  players = [], playerProfiles = {}, archive = [], pushBy,
  selectedId, onSelect,
  editData, setEditData, onSaveEdit, onStartEdit,
  onPhoto, fileRefs,
  onResetPassword, onResetToSetup, onDelete, onToggleViewer,
  pc,
}) {
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return players;
    return players.filter(p => {
      const prof = playerProfiles[p.id] || {};
      return [p.name, prof.phone, prof.email].some(v => String(v || "").toLowerCase().includes(t));
    });
  }, [q, players, playerProfiles]);

  const sel = players.find(p => String(p.id) === String(selectedId)) || null;
  const prof = sel ? (playerProfiles[sel.id] || {}) : {};

  // סטטיסטיקת הגעה — המידע שהמנהלת רוצה כשהיא פותחת שחקנית, ובמובייל אין לו מקום
  const stats = useMemo(() => {
    if (!sel) return null;
    const evs = [...archive].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const came = ev => (ev.attendanceData || []).some(a => String(a.playerId) === String(sel.id) && a.status === "coming");
    const n = evs.filter(came).length;
    let streak = 0;
    for (let i = evs.length - 1; i >= 0; i--) { if (came(evs[i])) streak++; else break; }
    return {
      total: evs.length, came: n,
      pct: evs.length ? Math.round((n / evs.length) * 100) : 0,
      streak,
      last: evs.slice(-10).map(ev => ({ id: ev.id, d: formatShort(ev.date), ok: came(ev), kind: ev.type === "training" ? "🏋️" : "🏆" })),
    };
  }, [sel, archive]);

  const hasPush = (p) => (pushBy ? !!pushBy[String(p.id)] : null);

  return (
    <div className="st-pl">
      {/* ── רשימה ── */}
      <aside className="st-pl-list">
        <div className="st-pl-search">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש שחקנית…" aria-label="חיפוש שחקנית" />
        </div>
        <div className="st-pl-scroll">
          {list.length === 0 && <p className="st-pl-empty">לא נמצאה שחקנית בשם «{q.trim()}»</p>}
          {list.map(p => {
            const pr = playerProfiles[p.id] || {};
            const on = String(p.id) === String(selectedId);
            return (
              <button key={p.id} className={"st-pl-row" + (on ? " st-on" : "")} onClick={() => onSelect(p.id)}>
                {pr.photo ? <img className="st-pl-av" src={pr.photo} alt="" /> : <span className="st-pl-av">{ini(p.name)}</span>}
                <span className="st-pl-nm">
                  <b>{p.name}</b>
                  <span>
                    {pr.device || "—"}
                    {p.viewer ? " · 👁️ צופה" : ""}
                    {hasPush(p) === false ? " · 🔕" : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── פרופיל ── */}
      <section className="st-pl-detail">
        {!sel ? (
          <div className="st-pl-none">
            <div style={{ fontSize: 42 }}>👥</div>
            <p>בחרי שחקנית מהרשימה כדי לראות ולערוך את הפרטים שלה.</p>
          </div>
        ) : (
          <>
            <div className="st-pl-head">
              <button className="st-pl-photo" onClick={() => fileRefs.current[sel.id]?.click()} title="החלפת תמונה">
                {prof.photo ? <img src={prof.photo} alt="" /> : <span>{ini(sel.name)}</span>}
                <span className="st-pl-cam" aria-hidden>📷</span>
                <input ref={el => fileRefs.current[sel.id] = el} type="file" accept="image/*"
                  onChange={e => onPhoto(sel.id, e)} style={{ display: "none" }} />
              </button>
              <div className="st-pl-title">
                <h2>{sel.name}</h2>
                <div className="st-pl-chips">
                  {prof.device && <span className="st-pl-chip">{prof.device}</span>}
                  {sel.viewer && <span className="st-pl-chip st-view">👁️ צופה</span>}
                  {hasPush(sel) === false && <span className="st-pl-chip st-warn">🔕 ללא התראות</span>}
                  {prof.birthday && <span className="st-pl-chip">🎂 {formatShort(prof.birthday)}{ageFromBirthday(prof.birthday) != null ? ` · גיל ${ageFromBirthday(prof.birthday)}` : ""}</span>}
                </div>
              </div>
              <div className="st-pl-reach">
                {prof.whatsapp && <a href={`https://wa.me/${String(prof.whatsapp).replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="st-pl-wa">💬 וואטסאפ</a>}
                {prof.phone && <a href={`tel:${prof.phone}`} className="st-pl-tel">📞 {prof.phone}</a>}
                {prof.email && <a href={`mailto:${prof.email}`} className="st-pl-mail">✉️ מייל</a>}
              </div>
            </div>

            {stats && stats.total > 0 && (
              <div className="st-pl-stats">
                <div><b className="st-num">{stats.pct}%</b><span>אחוז הגעה</span></div>
                <div><b className="st-num">{stats.came}</b><span>מתוך {stats.total} אירועים</span></div>
                <div><b className="st-num">{stats.streak}</b><span>ברצף האחרון</span></div>
                <div className="st-pl-strip">
                  {stats.last.map(e => (
                    <span key={e.id} className={"st-pl-dot " + (e.ok ? "st-ok" : "st-no")} title={`${e.kind} ${e.d}`}>{e.ok ? "✓" : "✗"}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="st-pl-form">
              <h3>פרטי קשר</h3>
              <div className="st-pl-grid">
                <label>📞 טלפון
                  <input value={editData.phone || ""} onChange={e => {
                    const val = e.target.value;
                    const digits = val.replace(/\D/g, "");
                    setEditData({ ...editData, phone: val, whatsapp: digits.startsWith("0") ? "972" + digits.slice(1) : digits });
                  }} />
                </label>
                <label>💬 וואטסאפ
                  <input value={editData.whatsapp || ""} onChange={e => setEditData({ ...editData, whatsapp: e.target.value })} />
                </label>
                <label>✉️ מייל
                  <input value={editData.email || ""} onChange={e => setEditData({ ...editData, email: e.target.value })} />
                </label>
                <label>🏠 כתובת
                  <input value={editData.address || ""} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                </label>
              </div>
              <button className="st-pl-save" onClick={() => onSaveEdit(sel.id)}>שמירת פרטים</button>
            </div>

            <div className="st-pl-form">
              <h3>הרשאות</h3>
              <div className="st-pl-toggle">
                <div>
                  <b>👁️ צופה בלבד</b>
                  <span>מאמנת או כל מי שלא מסמנת נוכחות. רואה מי מגיעה, את הלוח והתוצאות — ולא נספרת בנוכחות ובסטטיסטיקה.</span>
                </div>
                <button className={sel.viewer ? "st-on" : ""} onClick={() => onToggleViewer(sel)}>
                  {sel.viewer ? "👁️ צופה" : "🏐 שחקנית"}
                </button>
              </div>
            </div>

            <div className="st-pl-form st-pl-danger">
              <h3>פעולות חשבון</h3>
              <p>פעולות נדירות. כל אחת מהן משפיעה על היכולת שלה להיכנס.</p>
              <div className="st-pl-acts">
                <button className="st-a1" onClick={() => onResetPassword(sel)}>🔑 איפוס סיסמה</button>
                <button className="st-a2" onClick={() => onResetToSetup(sel)}>↩️ החזרה לכניסה ראשונה</button>
                <button className="st-a3" onClick={() => onDelete(sel)}>🗑 מחיקה לצמיתות</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
