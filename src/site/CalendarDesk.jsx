// ── הלוח במחשב ──────────────────────────────────────────────────────────────
// בטלפון הלוח הוא רשת של ריבועים עם סמלים, ולחיצה פותחת את היום מתחת.
// במחשב אותה רשת נמתחה למשבצות ענק ריקות. כאן: חודש שלם במבט אחד, משבצות
// נמוכות שהאירוע כתוב בתוכן (שעה, סוג, כמה הגיעו), חגים וימי הולדת, רצועת
// הספורטיאדה — והיום הנבחר נפתח בטור הצד במקום לדחוף את הרשת.
//
// הנתונים: אותם events + archive של המסך הנייד, בלי כפילויות (אירוע שאורכב
// נשאר בלוח עם מי שהגיעה).
import { useMemo, useState } from "react";
import { CalEventRow } from "../components/shared";
import { holidayLabel } from "../lib/holidays";
import { ourGames, describeGame } from "../lib/tournament";
import { rosterOf, todayStr } from "../lib/utils";

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const DOW = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const pad = (n) => String(n).padStart(2, "0");

export default function CalendarDesk({
  events = [], archive = [], players = [], playerProfiles = {}, attendance = {}, player, pc,
  tour, tourState, showTour,
}) {
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const today = todayStr();
  const roster = rosterOf(players);

  const calEvents = useMemo(() => {
    const seen = new Set();
    return [...(events || []), ...(archive || [])].filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [events, archive]);

  // היום שנפתח בצד: ברירת המחדל היא האירוע הפתוח הקרוב, ואם אין — היום
  const firstOpen = useMemo(() => {
    const up = calEvents.filter((e) => e.date >= today && !e.cancelled && !e.attendanceData)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    return up ? up.date : today;
  }, [calEvents, today]);
  const [sel, setSel] = useState(null);
  const selected = sel || firstOpen;

  const { y, m } = cur;
  const ds = (d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const bdaysOn = (date) => roster.filter((p) => {
    const b = (playerProfiles[p.id] || {}).birthday;
    return b && b.slice(5) === date.slice(5);
  });
  const tourOn = (date) => showTour && tour && date >= tour.start && date <= tour.end;
  const tourGamesOn = (date) => (showTour && tour ? ourGames(tour).filter((g) => g.date === date) : []);
  const results = (tourState && tourState.results) || {};

  const onThis = y === now.getFullYear() && m === now.getMonth();
  const go = (delta) => {
    const d = new Date(y, m + delta, 1);
    setCur({ y: d.getFullYear(), m: d.getMonth() });
    setSel(null);
  };

  const selEvents = calEvents.filter((e) => e.date === selected);
  const selBdays = bdaysOn(selected);
  const selHol = holidayLabel(new Date(selected + "T12:00:00"));
  const selDate = new Date(selected + "T12:00:00");
  const myStatus = (ev) => attendance[`${ev.id}_${player && player.id}`]?.status;

  // האירועים הבאים — רשימה קצרה בצד, מתחת ליום הנבחר
  const upcoming = calEvents
    .filter((e) => e.date >= today && !e.cancelled && !e.attendanceData)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
    .slice(0, 5);

  return (
    <div className="st-cal">
      <div className="st-cal-card">
        <div className="st-cal-head">
          <h2>{MONTHS[m]} <span className="st-num">{y}</span></h2>
          {/* תמיד גלוי (קודם הופיע רק בחודש אחר, ולכן לא נמצא). מחזיר לחודש
              הנוכחי ופותח את היום בטור הצד. */}
          <button className={"st-cal-today" + (onThis && selected === today ? " st-here" : "")}
            onClick={() => { setCur({ y: now.getFullYear(), m: now.getMonth() }); setSel(today); }}>↩︎ חזרה להיום</button>
          {/* במחשב החץ שמצביע ימינה מוביל קדימה, כמו בדפדפן (בקשת אפי 28.9.26).
              בטלפון נשאר ההפך — ▶ מימין אחורה — ושם זה עובד טוב. */}
          <div className="st-cal-arrows">
            <button onClick={() => go(1)} aria-label="החודש הבא">›</button>
            <button onClick={() => go(-1)} aria-label="החודש הקודם">‹</button>
          </div>
        </div>
        <div className="st-cal-legend">
          <span><i className="st-lg-tr" />אימון</span>
          <span><i className="st-lg-gm" />משחק</span>
          <span><i className="st-lg-past" />הסתיים · כמה הגיעו</span>
          {showTour && <span><i className="st-lg-tour" />{tour.short}</span>}
          <span>🎂 יום הולדת</span>
        </div>
        <div className="st-cal-grid">
          {DOW.map((d) => <div key={d} className="st-cal-dow">{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={"x" + i} className="st-cal-cell st-out" />;
            const date = ds(d);
            const evs = calEvents.filter((e) => e.date === date).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
            const hol = holidayLabel(new Date(date + "T12:00:00"));
            const bd = bdaysOn(date);
            const tg = tourGamesOn(date);
            const inTour = tourOn(date);
            const cls = "st-cal-cell"
              + (date === today ? " st-today" : "")
              + (date === selected ? " st-sel" : "")
              + (i % 7 === 6 ? " st-sat" : "")
              + (inTour ? " st-in-tour" : "");
            return (
              <button key={date} className={cls} onClick={() => setSel(date)}>
                <span className="st-cal-d st-num">{d}</span>
                {hol && <span className={"st-cal-hol" + (hol.kind === "moed" ? " st-moed" : "")}>{hol.name}</span>}
                <span className="st-cal-items">
                  {evs.map((e) => {
                    const past = !!e.attendanceData;
                    const came = past ? e.attendanceData.filter((a) => a.status === "coming").length : 0;
                    const k = e.cancelled ? " st-cx" : past ? " st-past" : e.type === "game" ? " st-gm" : " st-tr";
                    return (
                      <span key={e.id} className={"st-cal-chip" + k} title={past ? `${came} מתוך ${roster.length} הגיעו` : undefined}>
                        {/* אירוע שהסתיים: סמל + כמה הגיעו — המילה "אימון" לא נכנסת לצד המספר ברוחב משבצת */}
                        <span>{e.type === "game" ? "🏆" : "🏋️"}{past ? "" : " " + e.time + (e.type === "game" ? (e.opponent ? " " + e.opponent : " משחק") : " אימון")}</span>
                        {past && <b className="st-num">{came}/{roster.length}</b>}
                        {!past && !e.cancelled && myStatus(e) === "coming" && <b>✓</b>}
                      </span>
                    );
                  })}
                  {tg.map((g) => (
                    <span key={g.id} className="st-cal-chip st-tg">
                      <span>🏐 {g.stage === "group" ? g.time + " " + describeGame(tour, results, g).opp : describeGame(tour, results, g).title}</span>
                    </span>
                  ))}
                  {bd.length > 0 && <span className="st-cal-bd">🎂 {bd.map((p) => p.name).join(", ")}</span>}
                </span>
                {inTour && date === tour.start && <span className="st-cal-tour">☀️ {tour.name} · {tour.city}</span>}
                {inTour && date !== tour.start && <span className={"st-cal-tour" + (date === tour.end ? " st-end" : "")} aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      <aside className="st-side">
        <div className="st-side-card st-cal-day">
          <div className="st-cal-day-h">
            <div className="st-ag-d st-big"><b className="st-num">{selDate.getDate()}</b><span>{MONTHS[selDate.getMonth()]}</span></div>
            <div>
              <h4>{selDate.toLocaleDateString("he-IL", { weekday: "long" })}{selected === today ? " · היום" : ""}</h4>
              {!sel && <p className="st-cal-day-k">{selEvents.length ? "האירוע הקרוב" : "היום"}</p>}
              {selHol && <p className="st-cal-day-hol">{selHol.name}</p>}
              {tourOn(selected) && <p className="st-cal-day-hol st-tourline">☀️ {tour.name} · {tour.city}</p>}
            </div>
          </div>
          {selEvents.length === 0 && selBdays.length === 0 && tourGamesOn(selected).length === 0 && (
            <p className="st-p-quiet">אין אירועים ביום הזה.</p>
          )}
          {selEvents.map((ev) => {
            // אירוע פתוח: מי סימנה עד עכשיו. אירוע שאורכב: CalEventRow מציג
            // את רשימת המשתתפות מהארכיון, כמו בטלפון.
            if (ev.attendanceData || ev.cancelled) return <CalEventRow key={ev.id} ev={ev} players={players} pc={pc} bg="#f8fafc" />;
            const st = (p) => attendance[`${ev.id}_${p.id}`]?.status;
            const yes = roster.filter((p) => st(p) === "coming");
            const no = roster.filter((p) => st(p) === "notcoming");
            const mine = myStatus(ev);
            return (
              <div key={ev.id} className="st-cal-ev">
                <p className="st-cal-ev-t">{ev.type === "game" ? `🏆 משחק${ev.opponent ? " מול " + ev.opponent : ""}` : "🏋️ אימון"} · <span className="st-num">{ev.time}</span></p>
                {ev.location && <p className="st-cal-ev-l">📍 {ev.location}</p>}
                {player && !player.viewer && (
                  <p className={"st-cal-mine" + (mine ? " st-" + mine : "")}>
                    {mine === "coming" ? "✅ סימנת שאת מגיעה" : mine === "notcoming" ? "❌ סימנת שאינך מגיעה" : "❓ עוד לא סימנת"}
                  </p>
                )}
                {yes.length > 0 && <><h5 className="st-ok">מגיעות · {yes.length}</h5>
                  <div className="st-mini">{yes.map((p) => <span key={p.id} className="st-ok">{p.name}</span>)}</div></>}
                {no.length > 0 && <><h5 className="st-no">לא מגיעות · {no.length}</h5>
                  <div className="st-mini">{no.map((p) => <span key={p.id} className="st-no">{p.name}</span>)}</div></>}
              </div>
            );
          })}
          {tourGamesOn(selected).map((g) => {
            const dd = describeGame(tour, results, g);
            return (
              <div key={g.id} className="st-cal-ev st-tg">
                <p className="st-cal-ev-t">🏐 {dd.title} · <span className="st-num">{g.time}</span></p>
                <p className="st-cal-ev-l">{dd.sub}{dd.hall && dd.hall !== "—" ? " · " + dd.hall : ""}</p>
              </div>
            );
          })}
          {selBdays.map((p) => (
            <p key={p.id} className="st-cal-bday">🎂 יום ההולדת של {p.name}</p>
          ))}
        </div>

        <div className="st-side-card">
          <h4>האירועים הקרובים</h4>
          {upcoming.length === 0 ? <p className="st-p-quiet">אין אירועים פתוחים.</p> : upcoming.map((e) => {
            const d = new Date(e.date + "T12:00:00");
            return (
              <button key={e.id} className={"st-ag st-ag-btn" + (e.type === "game" ? " st-game" : "")}
                onClick={() => { setCur({ y: d.getFullYear(), m: d.getMonth() }); setSel(e.date); }}>
                <div className="st-ag-d"><b className="st-num">{d.getDate()}</b><span>{MONTHS[d.getMonth()].slice(0, 3)}׳</span></div>
                <div className="st-ag-t">
                  <p>{e.type === "training" ? "אימון" : e.opponent ? `משחק מול ${e.opponent}` : "משחק"} · <span className="st-num">{e.time}</span></p>
                  <small>{d.toLocaleDateString("he-IL", { weekday: "long" })}{e.location ? ` · ${e.location}` : ""}</small>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
