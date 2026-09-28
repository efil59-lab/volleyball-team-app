// ── עמוד הבית של השחקנית בדסקטופ ────────────────────────────────────────────
// לא לשוניות: עמוד אחד רציף שהקישורים במסטהד גוללים אליו. לשחקנית יש בדיוק
// שאלה אחת ("מתי, ואמרתי שאני באה?") ולכן האירוע הקרוב פותח את העמוד ברצועה
// כהה עם קווי מגרש, והכפתורים שלו הם הגדולים בעמוד.
//
// מתחת: טור ראשי (מי מגיעה, העונה שלי, מהקבוצה) וטור צד דביק (חג, ספורטיאדה,
// הבא בלוח, ימי הולדת) — אותו מבנה כמו גול־טיים.
//
// הכל מגיע ב-props מאותו state של המסך הנייד. מסכי העומק (לוח מלא, תוצאות,
// צ'אט מלא, גלריה) הם עמודים נפרדים — כאן רק התקצירים והקישור אליהם.
import { useMemo } from "react";
import { formatShort, countdownLabel, alreadyApplaudedToday, attendanceWords, rosterOf, isBirthdayToday, todayStr } from "../lib/utils";
import HolidayBanner from "../components/HolidayBanner";
import { Court, TallyBoard, WhoGroups } from "./Site";

const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const HE_MONTHS_SHORT = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

function initials(name) {
  return String(name || "?").trim().slice(0, 2);
}

export default function PlayerHome({
  player, players = [], playerProfiles = {}, attendance = {}, archive = [], events = [],
  chat = [], polls = [], gallery = [], applause = [], nextEvent, myRecord,
  clapList = [], clapLabel = "", evPhase = "before", evState = null,
  onRSVP, onVote, onApplause, onOpen, onProfile, tourCard,
}) {
  // ── האירוע הקרוב ─────────────────────────────────────────────────────────
  // צופה (מאמנת) מחוץ לספירות — היא אינה מסמנת נוכחות
  const isViewer = !!player.viewer;
  // ראה הערה מקבילה ב-player.jsx: צ׳אט, תמונות, סקר ומחיאות כפיים
  const noSocial = isViewer || !!player.ghost;
  const evWords = attendanceWords(evPhase);
  const roster = rosterOf(players);
  const my = myRecord?.status || null;
  const counts = useMemo(() => {
    if (!nextEvent) return { coming: 0, notcoming: 0, pending: roster.length };
    let coming = 0, notcoming = 0, pending = 0;
    for (const p of roster) {
      const s = attendance[`${nextEvent.id}_${p.id}`]?.status;
      if (s === "coming") coming++;
      else if (s === "notcoming") notcoming++;
      else pending++;
    }
    return { coming, notcoming, pending };
  }, [nextEvent, roster, attendance]);

  const when = useMemo(() => {
    if (!nextEvent) return null;
    const d = new Date(nextEvent.date + "T12:00:00");
    return {
      weekday: d.toLocaleDateString("he-IL", { weekday: "long" }),
      day: d.getDate(),
      month: HE_MONTHS[d.getMonth()],
      pill: evState ? evState.pill : countdownLabel(nextEvent.date),
    };
  }, [nextEvent, evPhase, evState]);

  // ── העונה שלי ────────────────────────────────────────────────────────────
  const season = useMemo(() => {
    const sorted = [...archive].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const came = (ev) => (ev.attendanceData || []).some(a => String(a.playerId) === String(player.id) && a.status === "coming");
    const mine = sorted.filter(came).length;
    const pct = sorted.length ? Math.round((mine / sorted.length) * 100) : 0;

    // רצף: מהאירוע האחרון אחורה, כל עוד הגיעה
    let streak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) { if (came(sorted[i])) streak++; else break; }

    // דירוג בקבוצה לפי מספר ההגעות
    const tallies = roster.map(p => ({
      id: p.id,
      n: sorted.filter(ev => (ev.attendanceData || []).some(a => String(a.playerId) === String(p.id) && a.status === "coming")).length,
    })).sort((a, b) => b.n - a.n);
    const rank = tallies.findIndex(t => String(t.id) === String(player.id)) + 1;

    const avg = tallies.length ? tallies.reduce((s, t) => s + t.n, 0) / tallies.length : 0;

    const strip = sorted.slice(-9).map(ev => ({
      key: "a" + ev.id,
      kind: ev.type === "training" ? "🏋️" : "🏆",
      date: formatShort(ev.date),
      came: came(ev),
    }));
    if (nextEvent) {
      strip.push({
        key: "next",
        kind: nextEvent.type === "training" ? "🏋️" : "🏆",
        date: formatShort(nextEvent.date),
        next: true,
        mark: my === "coming" ? "✓" : my === "notcoming" ? "✕" : "?",
      });
    }
    return { total: sorted.length, mine, pct, streak, rank, aboveAvg: mine > avg, strip };
  }, [archive, players, player.id, nextEvent, my]);

  // ── טור הצד ──────────────────────────────────────────────────────────────
  // הבא בלוח: שלושת האירועים הפתוחים הבאים (כולל הקרוב — שם מופיע התאריך
  // המלא, כאן זו רשימה שאפשר לסרוק במבט).
  const upcoming = useMemo(() => {
    const t = todayStr();
    return [...(events || [])]
      .filter(e => e.date >= t && !e.cancelled)
      .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
      .slice(0, 4);
  }, [events]);
  // ימי הולדת החודש — לפי חודש ויום בלבד, ממוינים לפי היום בחודש
  const bdays = useMemo(() => {
    const m = String(new Date().getMonth() + 1).padStart(2, "0");
    return roster
      .map(p => ({ p, b: (playerProfiles[p.id] || {}).birthday }))
      .filter(x => x.b && x.b.slice(5, 7) === m)
      .map(x => ({ name: x.p.name, day: Number(x.b.slice(8, 10)) }))
      .sort((a, b) => a.day - b.day);
  }, [roster, playerProfiles]);

  // ── מהקבוצה ──────────────────────────────────────────────────────────────
  const lastMsgs = useMemo(
    () => [...(chat || [])].sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(-3),
    [chat]
  );
  const poll = useMemo(() => [...(polls || [])].filter(p => p.active !== false).reverse()[0] || null, [polls]);
  const shots = useMemo(
    () => [...(gallery || [])].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 4),
    [gallery]
  );

  // מי הגיעה לאירוע האחרון — מחושב במסך השחקנית ומועבר לכאן. מקור אחד,
  // שני מסכים (הדסקטופ והנייד הסכימו קודם כל אחד על רשימה אחרת).
  const clapTargets = useMemo(() => ({
    label: clapLabel || "",
    list: (clapList || []).filter(p => String(p.id) !== String(player.id)).slice(0, 8),
  }), [clapList, clapLabel, player.id]);

  const pollTotal = poll ? Object.keys(poll.votes || {}).length : 0;
  const myVote = poll ? (poll.votes || {})[player.id] : undefined;

  const evKind = nextEvent
    ? (nextEvent.type === "training" ? "🏋️ אימון" : nextEvent.opponent ? `🏆 משחק מול ${nextEvent.opponent}` : "🏆 משחק")
    : null;

  return (
    <>
      {/* ── האירוע הקרוב ─────────────────────────────────────────────────── */}
      <section className="st-p-hero" id="st-next">
        <Court />
        <div className="st-p-hero-in">
          <div className="st-p-hero-main">
            <p className="st-p-eyebrow">
              שלום {player.name} 👋
              {onProfile && (
                <button type="button" className="st-p-prof" onClick={onProfile}>✏️ פרופיל והתראות</button>
              )}
            </p>
            {nextEvent ? (
              <>
                <div className="st-p-pills">
                  <span className="st-pill">{evKind}</span>
                  {when.pill && <span className={"st-pill st-gold" + (evPhase === "live" ? " st-live" : "")}>{when.pill}</span>}
                </div>
                <h1 className="st-p-h1">{when.weekday}, <em className="st-num">{when.day}</em> ב{when.month}</h1>
                <p className="st-p-meta">
                  <span>⏰ <b className="st-num">{nextEvent.time}</b></span>
                  {nextEvent.location ? <span>📍 {nextEvent.location}</span> : null}
                </p>
                {/* צופה אינה מסמנת נוכחות — המספר שבשבילו היא כאן נמצא בלוח שבצד */}
                {isViewer ? (
                  <p className="st-p-saved">👁️ את רשומה כצופה ואינך מסמנת נוכחות.</p>
                ) : evPhase !== "before" ? (
                  <p className="st-p-saved st-strong">{evState && evState.line}</p>
                ) : (
                  <>
                    <div className="st-p-rsvp">
                      <button
                        className={"st-p-rbtn st-yes" + (my === "coming" ? " st-on" : "")}
                        aria-pressed={my === "coming"}
                        onClick={() => onRSVP("coming")}
                      >✅ אני מגיעה</button>
                      <button
                        className={"st-p-rbtn st-no" + (my === "notcoming" ? " st-on" : "")}
                        aria-pressed={my === "notcoming"}
                        onClick={() => onRSVP("notcoming")}
                      >❌ לא מגיעה</button>
                    </div>
                    <p className="st-p-saved">
                      {my === "coming" ? "נשמר — סימנת שאת מגיעה. אפשר לשנות בכל רגע."
                        : my === "notcoming" ? "נשמר — סימנת שאינך מגיעה. אפשר לשנות בכל רגע."
                          : "טרם אישרת הגעה"}
                      {myRecord?.note ? <> · «{myRecord.note}»</> : null}
                    </p>
                  </>
                )}
              </>
            ) : (
              <>
                <h1 className="st-p-h1">אין אירוע קרוב</h1>
                <p className="st-p-meta">כשהמנהלת תקבע אימון או משחק הוא יופיע כאן, ותקבלי תזכורת יום לפני.</p>
                <div className="st-p-rsvp">
                  <button className="st-p-rbtn" onClick={() => onOpen("calendar")}>🗓️ הלוח המלא</button>
                </div>
              </>
            )}
          </div>
          {nextEvent && <TallyBoard counts={counts} words={evWords} live={evPhase === "before"} />}
        </div>
      </section>

      <div className="st-p-body">
        <div className="st-p-main">
          {/* ── מי מגיעה ───────────────────────────────────────────────────── */}
          {nextEvent && (
            <section className="st-p-card" id="st-team">
              <div className="st-p-sh">
                <h2>{evWords.heading}</h2>
                <span className="st-p-note">{roster.length} שחקניות</span>
              </div>
              <WhoGroups roster={roster} attendance={attendance} eventId={nextEvent.id}
                playerProfiles={playerProfiles} meId={player.id} words={evWords} />
            </section>
          )}

          {/* ── העונה שלי — לצופה אין, ראה הערה ב-player.jsx ─────────────── */}
          {!isViewer && (
            <section className="st-p-card" id="st-season">
              <div className="st-p-sh">
                <h2>העונה שלי</h2>
                <span className="st-p-note">{season.total} אירועים עד כה</span>
                <button className="st-p-more" onClick={() => onOpen("calendar")}>הלוח המלא ←</button>
              </div>
              {season.total === 0 && !nextEvent ? (
                <p className="st-p-empty">עוד לא ארכבנו אירועים — הסטטיסטיקה שלך תתחיל להצטבר אחרי האירוע הראשון.</p>
              ) : (
                <>
                  <div className="st-p-strip">
                    {season.strip.map(e => (
                      <div key={e.key} className={"st-p-ev" + (e.next ? " st-next" : e.came ? " st-ok" : " st-no")}>
                        <div className="st-p-ev-d st-num">{e.date}</div>
                        <div className="st-p-ev-dot">{e.next ? e.mark : e.came ? "✓" : "✕"}</div>
                      </div>
                    ))}
                  </div>
                  <div className="st-p-mystats">
                    <div><b className="st-num">{season.pct}%</b><span>אחוז ההגעה{season.total > 0 ? (season.aboveAvg ? " · מעל הממוצע" : " · מתחת לממוצע") : ""}</span></div>
                    <div><b className="st-num">{season.mine}</b><span>אירועים שהגעת</span></div>
                    <div><b className="st-num">{season.streak}{season.streak >= 3 ? " 🔥" : ""}</b><span>ברצף האחרון</span></div>
                    <div><b className="st-num">{season.rank || "—"}</b><span>מקומך בקבוצה · מתוך {roster.length}</span></div>
                  </div>
                </>
              )}
            </section>
          )}

          {/* ── מהקבוצה ────────────────────────────────────────────────────── */}
          {!noSocial && (
            <section id="st-feed">
              <div className="st-p-cols">
                <article className="st-p-card st-p-col">
                  <div className="st-p-ch">💬 הצ׳אט
                    <button className="st-p-sp st-p-link" onClick={() => onOpen("chat")}>לצ׳אט המלא ←</button>
                  </div>
                  <div className="st-p-cb">
                    {lastMsgs.length === 0
                      ? <p className="st-p-quiet">עוד לא נכתבה הודעה. את יכולה להיות הראשונה.</p>
                      : lastMsgs.map(m => (
                        <div key={m.id} className="st-p-msg">
                          <span className="st-p-av">{initials(m.name)}</span>
                          <div>
                            <div className="st-p-who">{m.name}</div>
                            <div className="st-p-tx">{m.text}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </article>

                <article className="st-p-card st-p-col">
                  <div className="st-p-ch">🗳️ סקר פעיל
                    {poll ? <span className="st-p-sp">{pollTotal} {pollTotal === 1 ? "הצביעה" : "הצביעו"}</span> : null}
                  </div>
                  <div className="st-p-cb">
                    {!poll ? (
                      <p className="st-p-quiet">אין סקר פעיל כרגע.</p>
                    ) : (
                      <>
                        <p className="st-p-q">{poll.question}</p>
                        {poll.options.map((opt, i) => {
                          const n = Object.values(poll.votes || {}).filter(v => v === i).length;
                          const pct = pollTotal ? Math.round((n / pollTotal) * 100) : 0;
                          const mineOpt = myVote === i;
                          return (
                            <button key={i} className="st-p-opt" aria-pressed={mineOpt} onClick={() => onVote(poll.id, i)}>
                              {myVote !== undefined && <span className="st-p-fill" style={{ width: pct + "%" }} />}
                              <span className="st-p-lb">
                                <span>{mineOpt ? "● " : ""}{opt}</span>
                                {myVote !== undefined && <b className="st-num">{pct}%</b>}
                              </span>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                </article>
              </div>

              {shots.length > 0 && (
                <article className="st-p-card st-p-photos">
                  <div className="st-p-ch">📸 תמונות אחרונות
                    <button className="st-p-sp st-p-link" onClick={() => onOpen("gallery")}>לגלריה ←</button>
                  </div>
                  <div className="st-p-shots">
                    {shots.map(s => (
                      <button key={s.id} className="st-p-shot" onClick={() => onOpen("gallery")}>
                        <img src={s.photo} alt={s.eventTitle || ""} loading="lazy" />
                        <span>{s.eventTitle || s.playerName}</span>
                      </button>
                    ))}
                  </div>
                </article>
              )}

              {clapTargets.list.length > 0 && (
                <div className="st-p-card st-p-clap">
                  <span className="st-p-clap-i" aria-hidden>👏</span>
                  <span className="st-p-clap-t">
                    <b>כל הכבוד לחברות</b> — שלחי מחיאת כפיים למי שהגיעה ל{clapTargets.label}
                  </span>
                  <span className="st-p-clap-w">
                    {clapTargets.list.map(p => {
                      const done = alreadyApplaudedToday(applause, player.id, p.id);
                      return (
                        <button key={p.id} className="st-p-cbtn" aria-pressed={done} disabled={done} onClick={() => onApplause(p)}>
                          {done ? "👏 " : ""}{p.name}
                        </button>
                      );
                    })}
                  </span>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── טור הצד ──────────────────────────────────────────────────────── */}
        <aside className="st-side">
          <HolidayBanner slim={isBirthdayToday((playerProfiles[player.id] || {}).birthday)} />
          {tourCard}
          <div className="st-side-card">
            <h4>הבא בלוח <button className="st-p-link" onClick={() => onOpen("calendar")}>הלוח המלא ←</button></h4>
            {upcoming.length === 0 ? (
              <p className="st-p-quiet">אין אירועים קרובים בלוח.</p>
            ) : upcoming.map(e => {
              const d = new Date(e.date + "T12:00:00");
              return (
                <div key={e.id} className={"st-ag" + (e.type === "game" ? " st-game" : "")}>
                  <div className="st-ag-d"><b className="st-num">{d.getDate()}</b><span>{HE_MONTHS_SHORT[d.getMonth()]}</span></div>
                  <div className="st-ag-t">
                    <p>{e.type === "training" ? "אימון" : e.opponent ? `משחק מול ${e.opponent}` : "משחק"} · <span className="st-num">{e.time}</span></p>
                    <small>{d.toLocaleDateString("he-IL", { weekday: "long" })}{e.location ? ` · ${e.location}` : ""}</small>
                  </div>
                </div>
              );
            })}
          </div>
          {bdays.length > 0 && (
            <div className="st-side-card">
              <h4>🎂 ימי הולדת החודש</h4>
              <p className="st-side-line">
                {bdays.map((b, i) => <span key={i}>{b.name} · <span className="st-num">{b.day}.{new Date().getMonth() + 1}</span></span>)}
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
