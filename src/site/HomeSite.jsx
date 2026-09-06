// ── דלת הכניסה בדסקטופ ───────────────────────────────────────────────────────
// המסך הראשון שרואים, ועד היום היחיד שכלל לא נגע בו שכבת הדסקטופ — הוא נמתח
// על כל הרוחב כעמודת טלפון. שני מצבים שונים לגמרי:
//   א׳ מכשיר זכור  → דשבורד אישי: אישור הגעה + מי מגיעה + קיצורים
//   ב׳ מכשיר חדש   → בחירת שם, וזה כל מה שהמסך צריך לעשות
//
// אותו הירו ואותו עלה-לוח-שנה כמו במסך השחקנית (PlayerHome), כדי ששני המסכים
// ירגישו כאותו אתר. הפעולות מגיעות ב-props מאותו state של המסך הנייד.
import { useState } from "react";
import { eventPhase, eventStateLabel } from "../lib/utils";
import "./site.css";

const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const ini = (n) => String(n || "?").trim().slice(0, 2);

// הערה לאישור ההגעה — אותה יכולת שיש בפריסה הניידת, כדי ששתי הפריסות
// לא יתפצלו. מופיעה רק כל עוד יש מה לבחור: אחרי שהאירוע התחיל הכפתורים
// נעלמים, ואיתם גם היא.
function SiteNote({ note, onSave }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note || "");
  if (!open) {
    return (
      <p className="st-p-saved" style={{ marginTop: 6 }}>
        {note ? <em style={{ opacity: 0.9 }}>"{note}" · </em> : null}
        <button type="button" onClick={() => { setText(note || ""); setOpen(true); }}
          style={{ background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
          {note ? "עריכת הערה" : "הוספת הערה"}
        </button>
      </p>
    );
  }
  return (
    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input value={text} onChange={e => setText(e.target.value)} autoFocus
        placeholder="הערה (אופציונלי) — למשל: מאחרת ב-15 דק'"
        style={{ flex: "1 1 220px", minWidth: 0, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.95)", color: "#1e293b", fontSize: 14, fontFamily: "inherit" }} />
      <button type="button" onClick={() => { onSave(text.trim()); setOpen(false); }} className="st-p-rbtn" style={{ flex: "0 0 auto", padding: "10px 18px" }}>שמור</button>
      <button type="button" onClick={() => setOpen(false)} className="st-p-rbtn" style={{ flex: "0 0 auto", padding: "10px 18px", opacity: 0.75 }}>דלג</button>
    </div>
  );
}

function Leaf({ ev }) {
  if (!ev) return null;
  const d = new Date(ev.date + "T12:00:00");
  return (
    <div className="st-p-leaf">
      <div className="st-p-leaf-h">{d.toLocaleDateString("he-IL", { weekday: "long" })}</div>
      <div className="st-p-leaf-d st-num">{d.getDate()}</div>
      <div className="st-p-leaf-m">{HE_MONTHS[d.getMonth()]}</div>
      <div className="st-p-leaf-t">{eventStateLabel(ev, eventPhase(ev)).pillShort.replace(/^[^ ]+ /, "")}</div>
    </div>
  );
}

export default function HomeSite({
  me, players = [], playerProfiles = {}, attendance = {}, settings = {},
  nextEvent, myStatus, activeNotifs = [], bdayOthers = [],
  onRSVP, onNote, myNote = "", onSelectPlayer, onOpenMine, onOpenTab, onSwitchUser,
  onAdmin, onAbout, onSuperAdmin, onPurchase, superAdminHandlers, pc, sc,
}) {
  const roster = players.filter(p => !p.viewer);
  const counts = (() => {
    if (!nextEvent) return { coming: 0, notcoming: 0, pending: roster.length };
    let coming = 0, notcoming = 0, pending = 0;
    for (const p of roster) {
      const s = attendance[`${nextEvent.id}_${p.id}`]?.status;
      if (s === "coming") coming++; else if (s === "notcoming") notcoming++; else pending++;
    }
    return { coming, notcoming, pending };
  })();

  // הודעת ביטול היא הדבר שהכי יקר לפספס. במובייל היא ticker שמתחלף; כאן יש
  // רוחב להראות אותה במלואה, כרצועה שאי אפשר לגלול מעליה בלי לראות.
  const cancels = activeNotifs.filter(n => n.type === "cancel");
  const others = activeNotifs.filter(n => n.type !== "cancel");

  const evTitle = nextEvent
    ? (nextEvent.type === "training" ? "האימון הקרוב" : nextEvent.opponent ? `המשחק הקרוב מול ${nextEvent.opponent}` : "המשחק הקרוב")
    : "אין אירוע קרוב";

  // צבעי הקבוצה מוזרמים כמו ב-SiteChrome. בלי זה כל קבוצה מקבלת את הכחול
  // של ברירת המחדל — הבאג שתוקן שם, וכאן היה חוזר.
  const vars = {};
  if (pc) vars["--st-pc"] = pc;
  if (sc) vars["--st-sc"] = sc;

  return (
    <div className="st-h-root" style={vars}>
      <header className="st-h-top">
        <div className="st-h-top-in">
          <div className="st-h-bd">
            <span className="st-h-mk" {...superAdminHandlers} aria-hidden>🏐</span>
            <span className="st-h-name">{settings.teamName || "קבוצת הכדורשת"}</span>
          </div>
          <span className="st-h-links">
            <button onClick={onAbout}>ℹ אודות</button>
            <button onClick={onAdmin}>🔐 כניסת מנהלת</button>
          </span>
        </div>
      </header>

      {cancels.map(n => (
        <div key={n.id} className="st-h-alert"><div className="st-h-alert-in">{n.text}</div></div>
      ))}

      <section className="st-p-hero">
        <div className="st-p-hero-in">
          <div className="st-p-hero-main">
            {me ? (
              <>
                <p className="st-p-eyebrow">שלום {me.name} 👋</p>
                <h1 className="st-p-h1">{evTitle}</h1>
                {nextEvent ? (
                  <>
                    <p className="st-p-meta">
                      {new Date(nextEvent.date + "T12:00:00").toLocaleDateString("he-IL", { weekday: "long" })} · <b>{nextEvent.time}</b>
                      {nextEvent.location ? <> · {nextEvent.location}</> : null}
                    </p>
                    {eventPhase(nextEvent) !== "before" ? (
                      <p className="st-p-saved" style={{ fontSize: "1.15rem", opacity: 1 }}>
                        {eventStateLabel(nextEvent, eventPhase(nextEvent)).line}
                      </p>
                    ) : (<>
                    <div className="st-p-rsvp">
                      <button className={"st-p-rbtn st-yes" + (myStatus === "coming" ? " st-on" : "")}
                        aria-pressed={myStatus === "coming"} onClick={() => onRSVP("coming")}>✅ אני מגיעה</button>
                      <button className={"st-p-rbtn st-no" + (myStatus === "notcoming" ? " st-on" : "")}
                        aria-pressed={myStatus === "notcoming"} onClick={() => onRSVP("notcoming")}>❌ לא מגיעה</button>
                    </div>
                    <p className="st-p-saved">
                      {myStatus === "coming" ? "נשמר — סימנת שאת מגיעה. אפשר לשנות בכל רגע."
                        : myStatus === "notcoming" ? "נשמר — סימנת שאינך מגיעה. אפשר לשנות בכל רגע."
                          : "טרם אישרת הגעה"}
                    </p>
                    {myStatus && onNote && <SiteNote note={myNote} onSave={onNote} />}
                    </>)}
                  </>
                ) : (
                  <p className="st-p-meta">כשהמנהלת תקבע אימון או משחק הוא יופיע כאן, ותקבלי תזכורת יום לפני.</p>
                )}
              </>
            ) : (
              <>
                <p className="st-p-eyebrow">ברוכה הבאה 🏐</p>
                <h1 className="st-p-h1">בחרי את שמך כדי להיכנס</h1>
                <p className="st-p-meta">
                  {nextEvent
                    ? <>האירוע הקרוב: {new Date(nextEvent.date + "T12:00:00").toLocaleDateString("he-IL", { weekday: "long" })} · <b>{nextEvent.time}</b>{nextEvent.location ? ` · ${nextEvent.location}` : ""}</>
                    : "עוד אין אירוע קרוב בלוח."}
                </p>
              </>
            )}
          </div>
          <Leaf ev={nextEvent} />
        </div>
      </section>

      <section className="st-p-sec">
        <div className="st-p-wrap">
          {others.length > 0 && (
            <div className="st-h-notes">
              {others.map(n => (
                <div key={n.id} className="st-h-note"><b>💬 עדכון</b> {n.text}</div>
              ))}
            </div>
          )}

          {bdayOthers.length > 0 && (
            <button className="st-h-bday" onClick={onOpenMine}>
              <span aria-hidden>🎂</span>
              היום יום ההולדת של {bdayOthers.map(p => p.name).join(", ")} — שלחי ברכה!
            </button>
          )}

          {me ? (
            <>
              {nextEvent && (
                <>
                  <div className="st-p-sh">
                    <h2>מי מגיעה</h2>
                    <span className="st-p-note">מתעדכן בזמן אמת</span>
                    <span className="st-p-tally">
                      <span><i style={{ background: "var(--color-success, #16a34a)" }} /><b className="st-num">{counts.coming}</b> מגיעות</span>
                      <span><i style={{ background: "var(--color-danger, #ef4444)" }} /><b className="st-num">{counts.notcoming}</b> לא</span>
                      <span><i style={{ background: "#cbd5e1" }} /><b className="st-num">{counts.pending}</b> טרם ענו</span>
                    </span>
                  </div>
                  <div className="st-p-card st-p-faces-box">
                    <div className="st-p-faces">
                      {roster.map(p => {
                        const s = attendance[`${nextEvent.id}_${p.id}`]?.status;
                        const prof = playerProfiles[p.id] || {};
                        return (
                          <div key={p.id} className={"st-face " + (s === "coming" ? "st-ok" : s === "notcoming" ? "st-no" : "st-wait") + (p.id === me.id ? " st-me-face" : "")}>
                            <span className="st-ring">
                              {prof.photo ? <img src={prof.photo} alt="" /> : ini(p.name)}
                              <span className="st-mark" aria-hidden>{s === "coming" ? "✓" : "✕"}</span>
                            </span>
                            <b>{p.name}{p.id === me.id ? " (את)" : ""}</b>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div className="st-p-sh" style={{ marginTop: 32 }}><h2>מה עוד יש</h2></div>
              <div className="st-h-quick">
                <button className="st-h-q" onClick={onOpenMine}>
                  <span className="st-h-q-ic">📊</span>
                  <span><b>המסך האישי שלי</b><span>נוכחות, סטטיסטיקה, תמונות</span></span>
                </button>
                <button className="st-h-q" onClick={() => onOpenTab("calendar")}>
                  <span className="st-h-q-ic">🗓️</span>
                  <span><b>לוח האימונים</b><span>כל האירועים הקרובים</span></span>
                </button>
                <button className="st-h-q" onClick={() => onOpenTab("chat")}>
                  <span className="st-h-q-ic">💬</span>
                  <span><b>הצ׳אט הקבוצתי</b><span>מה מתחדש אצל הבנות</span></span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="st-p-sh">
                <h2>מי את?</h2>
                <span className="st-p-note">{roster.length} שחקניות בקבוצה</span>
              </div>
              <div className="st-h-pick">
                {players.map(p => {
                  const prof = playerProfiles[p.id] || {};
                  return (
                    <button key={p.id} className="st-h-pb" onClick={() => onSelectPlayer(p)}>
                      {prof.photo
                        ? <img className="st-h-pb-av" src={prof.photo} alt="" />
                        : <span className="st-h-pb-av">{ini(p.name)}</span>}
                      <span className="st-h-pb-t">
                        <b>{p.name}</b>
                        <span>{prof.setupDone ? "כניסה עם סיסמה" : "כניסה ראשונה"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {!settings.hidePromoBanner && (
            <button className="st-h-promo" onClick={onPurchase}>
              🏐 רוצה אפליקציה כזו לקבוצה שלך? <b>לפרטים ←</b>
            </button>
          )}
        </div>
      </section>

      <footer className="st-foot">
        <div className="st-foot-in">
          <div className="st-foot-brand"><span aria-hidden>🏐</span> {settings.teamName || "כדורשת"}</div>
          <div className="st-foot-links">
            {me && <button onClick={onSwitchUser}>לא את? החליפי משתמשת</button>}
            <button onClick={onAbout}>אודות</button>
            <button onClick={onAdmin}>כניסת מנהלת</button>
          </div>
          <div className="st-foot-legal">© {new Date().getFullYear()} · נבנה עבור קבוצות כדורשת</div>
        </div>
      </footer>
    </div>
  );
}
