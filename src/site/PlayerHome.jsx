// ── עמוד הבית של השחקנית בדסקטופ ────────────────────────────────────────────
// לא לשוניות: עמוד אחד רציף שהקישורים במסטהד גוללים אליו. לשחקנית יש בדיוק
// שאלה אחת ("מתי, ואמרתי שאני באה?") ולכן אישור ההגעה תופס חצי מסך, ושאר
// המידע יורד ממנו לפי סדר החשיבות.
//
// הכל מגיע ב-props מאותו state של המסך הנייד. מסכי העומק (לוח מלא, תוצאות,
// צ'אט מלא, גלריה) נשארים המסכים הקיימים — כאן רק התקצירים והקישור אליהם.
import { useMemo } from "react";
import { formatShort, countdownLabel, alreadyApplaudedToday } from "../lib/utils";

const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

function initials(name) {
  return String(name || "?").trim().slice(0, 2);
}

function Face({ p, prof, status, isMe }) {
  const cls = status === "coming" ? "st-ok" : status === "notcoming" ? "st-no" : "st-wait";
  return (
    <div className={"st-face " + cls + (isMe ? " st-me-face" : "")}>
      <span className="st-ring">
        {prof?.photo
          ? <img src={prof.photo} alt="" />
          : initials(p.name)}
        <span className="st-mark" aria-hidden>{status === "coming" ? "✓" : "✕"}</span>
      </span>
      <b>{p.name}{isMe ? " (את)" : ""}</b>
    </div>
  );
}

export default function PlayerHome({
  player, players = [], playerProfiles = {}, attendance = {}, archive = [],
  chat = [], polls = [], gallery = [], applause = [], nextEvent, myRecord,
  clapList = [], clapLabel = "",
  onRSVP, onVote, onApplause, onOpen,
}) {
  // ── האירוע הקרוב ─────────────────────────────────────────────────────────
  const my = myRecord?.status || null;
  const counts = useMemo(() => {
    if (!nextEvent) return { coming: 0, notcoming: 0, pending: players.length };
    let coming = 0, notcoming = 0, pending = 0;
    for (const p of players) {
      const s = attendance[`${nextEvent.id}_${p.id}`]?.status;
      if (s === "coming") coming++;
      else if (s === "notcoming") notcoming++;
      else pending++;
    }
    return { coming, notcoming, pending };
  }, [nextEvent, players, attendance]);

  const leaf = useMemo(() => {
    if (!nextEvent) return null;
    const d = new Date(nextEvent.date + "T12:00:00");
    return {
      weekday: d.toLocaleDateString("he-IL", { weekday: "long" }),
      day: d.getDate(),
      month: HE_MONTHS[d.getMonth()],
      when: countdownLabel(nextEvent.date),
    };
  }, [nextEvent]);

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
    const tallies = players.map(p => ({
      id: p.id,
      n: sorted.filter(ev => (ev.attendanceData || []).some(a => String(a.playerId) === String(p.id) && a.status === "coming")).length,
    })).sort((a, b) => b.n - a.n);
    const rank = tallies.findIndex(t => String(t.id) === String(player.id)) + 1;

    const avg = tallies.length ? tallies.reduce((s, t) => s + t.n, 0) / tallies.length : 0;

    const strip = sorted.slice(-8).map(ev => ({
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

  // מי הגיעה לאירוע האחרון — מחושב במסך השחקנית ומועבר לכאן. היה כאן חישוב
  // שני שהסתמך על הארכיון בלבד, ולכן הדסקטופ והנייד לא הסכימו ביניהם על מי
  // מוצגת. מקור אחד, שני מסכים.
  const clapTargets = useMemo(() => ({
    label: clapLabel || "",
    list: (clapList || []).filter(p => String(p.id) !== String(player.id)).slice(0, 8),
  }), [clapList, clapLabel, player.id]);

  const pollTotal = poll ? Object.keys(poll.votes || {}).length : 0;
  const myVote = poll ? (poll.votes || {})[player.id] : undefined;

  return (
    <>
      {/* ── האירוע הקרוב ─────────────────────────────────────────────────── */}
      <section className="st-p-hero" id="st-next">
        <div className="st-p-hero-in">
          <div className="st-p-hero-main">
            <p className="st-p-eyebrow">שלום {player.name} 👋</p>
            {nextEvent ? (
              <>
                <h1 className="st-p-h1">
                  {nextEvent.type === "training"
                    ? "האימון הקרוב"
                    : nextEvent.opponent ? `המשחק הקרוב מול ${nextEvent.opponent}` : "המשחק הקרוב"}
                </h1>
                <p className="st-p-meta">
                  {leaf.weekday} · <b>{nextEvent.time}</b>
                  {nextEvent.location ? <> · {nextEvent.location}</> : null}
                </p>
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
          {leaf && (
            <div className="st-p-leaf" aria-hidden={false}>
              <div className="st-p-leaf-h">{leaf.weekday}</div>
              <div className="st-p-leaf-d st-num">{leaf.day}</div>
              <div className="st-p-leaf-m">{leaf.month}</div>
              <div className="st-p-leaf-t">{leaf.when}</div>
            </div>
          )}
        </div>
      </section>

      {/* ── מי מגיעה ─────────────────────────────────────────────────────── */}
      {nextEvent && (
        <section className="st-p-sec st-p-alt" id="st-team">
          <div className="st-p-wrap">
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
                {players.map(p => (
                  <Face
                    key={p.id}
                    p={p}
                    prof={playerProfiles[p.id]}
                    status={attendance[`${nextEvent.id}_${p.id}`]?.status}
                    isMe={String(p.id) === String(player.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── העונה שלי ────────────────────────────────────────────────────── */}
      <section className="st-p-sec" id="st-season">
        <div className="st-p-wrap">
          <div className="st-p-sh">
            <h2>העונה שלי</h2>
            <span className="st-p-note">{season.total} אירועים עד כה</span>
            <button className="st-p-more" onClick={() => onOpen("calendar")}>הלוח המלא ←</button>
          </div>
          {season.total === 0 && !nextEvent ? (
            <div className="st-p-card st-p-empty">עוד לא ארכבנו אירועים — הסטטיסטיקה שלך תתחיל להצטבר אחרי האירוע הראשון.</div>
          ) : (
            <div className="st-p-season">
              <div className="st-p-card">
                <div className="st-p-strip">
                  {season.strip.map(e => (
                    <div key={e.key} className={"st-p-ev" + (e.next ? " st-next" : e.came ? " st-ok" : " st-no")}>
                      <div className="st-p-ev-k">{e.kind}</div>
                      <div className="st-p-ev-d st-num">{e.date}</div>
                      <div className="st-p-ev-dot">{e.next ? e.mark : e.came ? "✓" : "✕"}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="st-p-mystats">
                <div><b className="st-num">{season.pct}%</b><span>אחוז ההגעה שלך</span>
                  {season.total > 0 && <span className="st-p-sp" style={{ color: season.aboveAvg ? "var(--color-success, #16a34a)" : "var(--color-text-faint, #94a3b8)" }}>{season.aboveAvg ? "מעל הממוצע" : "מתחת לממוצע"}</span>}
                </div>
                <div><b className="st-num">{season.mine}</b><span>אירועים שהגעת</span></div>
                <div><b className="st-num">{season.streak}</b><span>ברצף האחרון</span>{season.streak >= 3 && <span className="st-p-sp">🔥</span>}</div>
                <div><b className="st-num">{season.rank || "—"}</b><span>מקומך בקבוצה</span><span className="st-p-sp">מתוך {players.length}</span></div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── מהקבוצה ──────────────────────────────────────────────────────── */}
      <section className="st-p-sec st-p-alt" id="st-feed">
        <div className="st-p-wrap">
          <div className="st-p-sh"><h2>מהקבוצה</h2></div>
          <div className="st-p-cols">

            <article className="st-p-card">
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

            <article className="st-p-card">
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
                        <button
                          key={i}
                          className="st-p-opt"
                          aria-pressed={mineOpt}
                          onClick={() => onVote(poll.id, i)}
                        >
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

            <article className="st-p-card">
              <div className="st-p-ch">📸 תמונות אחרונות
                <button className="st-p-sp st-p-link" onClick={() => onOpen("gallery")}>לגלריה ←</button>
              </div>
              <div className="st-p-cb">
                {shots.length === 0
                  ? <p className="st-p-quiet">הגלריה עוד ריקה. אפשר להעלות תמונה מהאירוע האחרון.</p>
                  : (
                    <div className="st-p-shots">
                      {shots.map(s => (
                        <button key={s.id} className="st-p-shot" onClick={() => onOpen("gallery")}>
                          <img src={s.photo} alt={s.eventTitle || ""} loading="lazy" />
                          <span>{s.eventTitle || s.playerName}</span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            </article>

          </div>

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
                    <button
                      key={p.id}
                      className="st-p-cbtn"
                      aria-pressed={done}
                      disabled={done}
                      onClick={() => onApplause(p)}
                    >{done ? "👏 " : ""}{p.name}</button>
                  );
                })}
              </span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
