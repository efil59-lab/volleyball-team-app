// ── דלת הכניסה בדסקטופ ───────────────────────────────────────────────────────
// המסך הראשון שרואים. שני מצבים שונים לגמרי:
//   א׳ מכשיר זכור  → דשבורד אישי: אישור הגעה + מי מגיעה + קיצורים
//   ב׳ מכשיר חדש   → בחירת שם, וזה כל מה שהמסך צריך לעשות
//
// אותו מסטהד, אותה רצועת מגרש ואותו לוח הגעה כמו בבית השחקנית (PlayerHome),
// כדי ששני המסכים ירגישו כאותו אתר. הפעולות מגיעות ב-props מאותו state של
// המסך הנייד.
import { useState } from "react";
import { eventPhase, eventStateLabel, attendanceWords, rosterOf, showGhosts } from "../lib/utils";
import HolidayBanner from "../components/HolidayBanner";
import { Brand, Court, TallyBoard, WhoGroups } from "./Site";
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
          {note ? "עריכת הערה" : "✏️ הוספת הערה"}
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

export default function HomeSite({
  me, players = [], playerProfiles = {}, attendance = {}, settings = {},
  nextEvent, myStatus, activeNotifs = [], bdayOthers = [],
  onRSVP, onNote, myNote = "", onSelectPlayer, onOpenMine, onOpenTab, onSwitchUser, tourCard,
  onAdmin, onAbout, onSuperAdmin, onPurchase, superAdminHandlers, pc, sc,
}) {
  const roster = rosterOf(players);
  // רשימת הבחירה: חשבונות בדיקה מוסתרים אלא אם ?test=1
  const pickable = players.filter(p => !p.ghost || showGhosts());
  const counts = (() => {
    if (!nextEvent) return { coming: 0, notcoming: 0, pending: roster.length };
    let coming = 0, notcoming = 0, pending = 0;
    for (const p of roster) {
      const s = attendance[`${nextEvent.id}_${p.id}`]?.status;
      if (s === "coming") coming++; else if (s === "notcoming") notcoming++; else pending++;
    }
    return { coming, notcoming, pending };
  })();
  const phase = nextEvent ? eventPhase(nextEvent) : "before";
  const words = attendanceWords(phase);

  // הודעת ביטול היא הדבר שהכי יקר לפספס. במובייל היא ticker שמתחלף; כאן יש
  // רוחב להראות אותה במלואה, כרצועה שאי אפשר לגלול מעליה בלי לראות.
  const cancels = activeNotifs.filter(n => n.type === "cancel");
  const others = activeNotifs.filter(n => n.type !== "cancel");

  const d = nextEvent ? new Date(nextEvent.date + "T12:00:00") : null;
  const evKind = nextEvent
    ? (nextEvent.type === "training" ? "🏋️ אימון" : nextEvent.opponent ? `🏆 משחק מול ${nextEvent.opponent}` : "🏆 משחק")
    : null;

  // צבעי הקבוצה מוזרמים כמו ב-SiteChrome. בלי זה כל קבוצה מקבלת את הכחול
  // של ברירת המחדל — הבאג שתוקן שם, וכאן היה חוזר.
  const vars = {};
  if (pc) vars["--st-pc"] = pc;
  if (sc) vars["--st-sc"] = sc;

  return (
    <div className="st-h-root" style={vars}>
      <header className="st-head">
        <div className="st-top">
          <div className="st-top-in">
            {/* לחיצה ארוכה על המותג → סופר-אדמין (superAdminHandlers) */}
            <Brand teamName={settings.teamName || "קבוצת הכדורשת"} sub="אימונים, משחקים ומי מגיעה" handlers={superAdminHandlers} />
            <span className="st-h-links">
              <button onClick={onAbout}>ℹ אודות</button>
              <button onClick={onAdmin}>🔐 כניסת מנהלת</button>
            </span>
          </div>
        </div>
      </header>

      {cancels.map(n => (
        <div key={n.id} className="st-h-alert"><div className="st-h-alert-in">{n.text}</div></div>
      ))}

      <section className="st-p-hero">
        <Court />
        <div className="st-p-hero-in">
          <div className="st-p-hero-main">
            {me ? (
              <>
                <p className="st-p-eyebrow">שלום {me.name} 👋</p>
                {nextEvent ? (
                  <>
                    <div className="st-p-pills">
                      <span className="st-pill">{evKind}</span>
                      <span className={"st-pill st-gold" + (phase === "live" ? " st-live" : "")}>{eventStateLabel(nextEvent, phase).pill}</span>
                    </div>
                    <h1 className="st-p-h1">{d.toLocaleDateString("he-IL", { weekday: "long" })}, <em className="st-num">{d.getDate()}</em> ב{HE_MONTHS[d.getMonth()]}</h1>
                    <p className="st-p-meta">
                      <span>⏰ <b className="st-num">{nextEvent.time}</b></span>
                      {nextEvent.location ? <span>📍 {nextEvent.location}</span> : null}
                    </p>
                    {phase !== "before" ? (
                      <p className="st-p-saved st-strong">{eventStateLabel(nextEvent, phase).line}</p>
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
                  <>
                    <h1 className="st-p-h1">אין אירוע קרוב</h1>
                    <p className="st-p-meta">כשהמנהלת תקבע אימון או משחק הוא יופיע כאן, ותקבלי תזכורת יום לפני.</p>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="st-p-eyebrow">ברוכה הבאה 🏐</p>
                <h1 className="st-p-h1">בחרי את שמך כדי להיכנס</h1>
                <p className="st-p-meta">
                  {nextEvent
                    ? <span>האירוע הקרוב: {d.toLocaleDateString("he-IL", { weekday: "long" })}, {d.getDate()} ב{HE_MONTHS[d.getMonth()]} · <b className="st-num">{nextEvent.time}</b>{nextEvent.location ? ` · ${nextEvent.location}` : ""}</span>
                    : <span>עוד אין אירוע קרוב בלוח.</span>}
                </p>
              </>
            )}
          </div>
          {nextEvent && <TallyBoard counts={counts} words={words} live={phase === "before"} />}
        </div>
      </section>

      <div className="st-p-body">
        <div className="st-p-main">
          {me ? (
            <>
              {nextEvent && (
                <section className="st-p-card">
                  <div className="st-p-sh">
                    <h2>{words.heading}</h2>
                    <span className="st-p-note">{roster.length} שחקניות</span>
                  </div>
                  <WhoGroups roster={roster} attendance={attendance} eventId={nextEvent.id}
                    playerProfiles={playerProfiles} meId={me.id} words={words} />
                </section>
              )}

              <div className="st-h-quick">
                <button className="st-h-q" onClick={onOpenMine}>
                  <span className="st-h-q-ic">📊</span>
                  <span><b>המסך האישי שלי</b><span>נוכחות, סטטיסטיקה, תמונות</span></span>
                </button>
                <button className="st-h-q" onClick={() => onOpenTab("calendar")}>
                  <span className="st-h-q-ic">🗓️</span>
                  <span><b>לוח האימונים</b><span>החודש במבט אחד</span></span>
                </button>
                <button className="st-h-q" onClick={() => onOpenTab("chat")}>
                  <span className="st-h-q-ic">💬</span>
                  <span><b>הצ׳אט הקבוצתי</b><span>מה מתחדש אצל הבנות</span></span>
                </button>
              </div>
            </>
          ) : (
            <section className="st-p-card">
              <div className="st-p-sh">
                <h2>מי את?</h2>
                <span className="st-p-note">{roster.length} שחקניות בקבוצה</span>
              </div>
              <div className="st-h-pick">
                {pickable.map(p => {
                  const prof = playerProfiles[p.id] || {};
                  return (
                    <button key={p.id} className="st-h-pb" onClick={() => onSelectPlayer(p)}>
                      {prof.photo
                        ? <img className="st-h-pb-av" src={prof.photo} alt="" />
                        : <span className="st-h-pb-av">{ini(p.name)}</span>}
                      <span className="st-h-pb-t">
                        <b>{p.viewer ? "👁️ " : ""}{p.name}</b>
                        <span>{p.viewer ? "צופה · " : ""}{prof.setupDone ? "כניסה עם סיסמה" : "כניסה ראשונה"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {!settings.hidePromoBanner && (
            <button className="st-h-promo" onClick={onPurchase}>
              🏐 רוצה אפליקציה כזו לקבוצה שלך? <b>לפרטים ←</b>
            </button>
          )}
        </div>

        <aside className="st-side">
          <HolidayBanner slim={bdayOthers.length > 0} />
          {tourCard}
          {bdayOthers.length > 0 && (
            <button className="st-h-bday" onClick={onOpenMine}>
              <span aria-hidden>🎂</span>
              היום יום ההולדת של {bdayOthers.map(p => p.name).join(", ")} — שלחי ברכה!
            </button>
          )}
          {others.map(n => (
            <div key={n.id} className="st-h-note"><b>💬 עדכון</b>{n.text}</div>
          ))}
        </aside>
      </div>

      <footer className="st-foot">
        <div className="st-foot-in">
          <div className="st-foot-brand"><span className="st-ball st-ball-sm" aria-hidden /> {settings.teamName || "כדורשת"}</div>
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
