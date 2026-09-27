import { useState } from "react";
import {
  TOURNAMENTS, activeTournament, tournamentPhase, daysToStart, resultOf, standings, groupDone,
  ourPlace, describeGame, ourScore, ourGames, nextOurGame, dayLabel,
} from "../lib/tournament";
import { notifyTeamPushRemote, mergeTournament } from "../lib/db";

// ── הספורטיאדה ─────────────────────────────────────────────────────────────
// שלושה רכיבים: כרטיס בדף הבית (ספירה לאחור → המשחק הבא → סיכום), מסך
// הטורניר (המשחקים שלנו + טבלת הבית), ופאנל הדיווח של המנהלת.
// העיצוב הוא "אילת": שקיעה שיורדת לים. הוא שונה בכוונה משאר האפליקציה —
// זה אירוע של פעם בשנה, והוא צריך להרגיש כמו אירוע.

const SUNSET = "linear-gradient(160deg,#ff8a4c 0%,#f2557a 46%,#0b3b63 100%)";
const DEEP = "#0b3b63";
const CORAL = "#f2557a";
// ההתראה שיוצאת פעם אחת, בפרסום הראשון לקבוצה
const ANNOUNCE = "☀️ הספורטיאדה באפליקציה — לוח המשחקים והספירה לאחור";

function Scene() {
  return (
    <svg viewBox="0 0 360 70" preserveAspectRatio="none" aria-hidden="true"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 56, display: "block" }}>
      <circle cx="290" cy="30" r="22" fill="#ffd27a" opacity=".9" />
      <path d="M0 42 C60 30 120 50 180 40 S300 30 360 44 V70 H0Z" fill="#0e8fa6" opacity=".55" />
      <path d="M0 52 C70 44 140 60 210 50 S320 44 360 54 V70 H0Z" fill="#0b3b63" opacity=".8" />
      <path d="M0 62 C90 56 170 68 260 60 S340 58 360 62 V70 H0Z" fill="#fde7c7" opacity=".9" />
    </svg>
  );
}

// "ניצחון אחד" ולא "1 ניצחונות"
const count = (n, one, many) => (n === 1 ? `${one} אחד` : `${n} ${many}`);
const record = (w, l) => [w && count(w, "ניצחון", "ניצחונות"), l && count(l, "הפסד", "הפסדים")].filter(Boolean).join(" · ");

const chip = { background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "4px 10px", fontSize: 11.5, fontWeight: 700 };

function DraftPill() {
  return (
    <span style={{ display: "inline-block", background: "#fff", color: "#7c3aed", borderRadius: 20, padding: "2px 9px", fontSize: 10.5, fontWeight: 900 }}>
      🧪 טיוטה — הבנות עוד לא רואות
    </span>
  );
}

function dateRange(t) {
  const s = new Date(t.start + "T12:00:00"), e = new Date(t.end + "T12:00:00");
  const months = ["בינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני", "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר"];
  return `${s.getDate()}–${e.getDate()} ${months[e.getMonth()]}`;
}

// שורת הסיכום אחרי הטורניר, לפי מה שקרה בפועל
function summary(t, results) {
  const place = ourPlace(t, results);
  const scores = ourGames(t).map((g) => ourScore(t, results, g)).filter(Boolean);
  const won = scores.filter((s) => s.won).length;
  const k = place && t.ko[place];
  const fn = ourScore(t, results, t.games.find((g) => g.stage === "final"));
  const sf = ourScore(t, results, t.games.find((g) => g.stage === "semi"));
  let title;
  if (k && fn) {
    title = fn.won
      ? (k.bracket === "עליון" ? `אלופות ${t.division}! 🥇` : "זכינו בגמר התחתון 🏅")
      : (k.bracket === "עליון" ? `מקום שני ב${t.division} 🥈` : "הגענו לגמר התחתון");
  } else if (k && sf && !sf.won) title = `הגענו לחצי הגמר ה${k.bracket}`;
  else if (place) title = `מקום ${place} ב${t.group}`;
  else title = `${t.name} הסתיימה`;
  return { title, won, lost: scores.length - won };
}

// ── כרטיס בדף הבית ─────────────────────────────────────────────────────────
// עד שבוע לפני היציאה הכרטיס הוא פס דק בשורה אחת, כדי לא לדחוף את האימון
// הקרוב למטה; בשבוע האחרון ובימי הטורניר — הכרטיס המלא.
// size: "auto" (לפי התאריך) | "slim" | "big" — הכפייה משמשת את התצוגה בפאנל.
const SLIM_UNTIL_DAYS = 7;

export function TournamentCard({ t, state, onOpen, now = new Date(), size = "auto" }) {
  if (!t) return null;
  const results = (state && state.results) || {};
  const phase = tournamentPhase(t, now);
  const clickable = !!onOpen;
  const slim = size === "slim" || (size === "auto" && phase === "before" && daysToStart(t, now) > SLIM_UNTIL_DAYS);
  if (slim) {
    const d = daysToStart(t, now);
    const Tag = clickable ? "button" : "div";
    return (
      <Tag onClick={onOpen} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "right", border: "none",
        fontFamily: "inherit", cursor: clickable ? "pointer" : "default", borderRadius: 14, background: SUNSET,
        color: "white", padding: "10px 13px", marginBottom: 12, boxShadow: "0 6px 16px rgba(242,85,122,0.22)",
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>☀️</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block", fontSize: 14.5, fontWeight: 800 }}>עוד {d} ימים ל{t.short}</b>
          <span style={{ fontSize: 11.5, opacity: 0.92 }}>
            {t.city} · {dateRange(t)}{state && !state.published ? " · 🧪 טיוטה" : ""}
          </span>
        </span>
        {clickable && <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, background: "rgba(255,255,255,0.22)", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>לוח המשחקים ›</span>}
      </Tag>
    );
  }

  let body;
  if (phase === "before") {
    const d = daysToStart(t, now);
    body = (
      <>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".05em", opacity: 0.92 }}>☀️ {t.name} · {t.city} {t.year}</div>
        <div style={{ fontSize: 19, fontWeight: 900, marginTop: 3 }}>{d === 1 ? "מחר יוצאות לאילת!" : "יוצאות לאילת!"}</div>
        {d > 1 && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 8 }}>
            <b style={{ fontSize: 44, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{d}</b>
            <span style={{ fontSize: 14, fontWeight: 700 }}>ימים ל{t.short}</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
          <span style={chip}>{dateRange(t)}</span>
          <span style={chip}>{t.division} · {t.group}</span>
          {clickable && <span style={chip}>לוח המשחקים ←</span>}
        </div>
      </>
    );
  } else if (phase === "during") {
    const place = ourPlace(t, results);
    const g = nextOurGame(t, results);
    const dsc = g && describeGame(t, results, g);
    body = (
      <>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", color: CORAL, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 900 }}>
          <i style={{ width: 7, height: 7, borderRadius: "50%", background: CORAL, animation: "tourPulse 1.2s infinite" }} /> {t.name} עכשיו
        </span>
        <div style={{ fontSize: 19, fontWeight: 900, marginTop: 8 }}>
          {place ? `מקום ${place} ב${t.group}` : "בהצלחה, בנות! 🏐"}
        </div>
        {g ? (
          <div style={{ background: "rgba(255,255,255,0.95)", color: "#16203a", borderRadius: 13, padding: "10px 12px", marginTop: 10 }}>
            <small style={{ fontSize: 10.5, fontWeight: 800, color: CORAL }}>המשחק הבא</small>
            <b style={{ display: "block", fontSize: 14.5, fontWeight: 800, marginTop: 1 }}>{dsc.title}</b>
            <span style={{ fontSize: 11.5, color: "#64748b" }}>{dayLabel(g.date)} · {g.time} · {dsc.hall}</span>
          </div>
        ) : (
          <div style={{ fontSize: 13, marginTop: 6, opacity: 0.95 }}>סיימנו את המשחקים שלנו. תודה לכולן! 💙</div>
        )}
      </>
    );
  } else {
    const s = summary(t, results);
    body = (
      <>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".05em", opacity: 0.92 }}>{t.name} · {t.city} {t.year}</div>
        <div style={{ fontSize: 19, fontWeight: 900, marginTop: 3 }}>{s.title}</div>
        <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
          {(s.won + s.lost) > 0 && <span style={chip}>{record(s.won, s.lost)}</span>}
          {clickable && <span style={chip}>לכל התוצאות ←</span>}
        </div>
      </>
    );
  }

  const Tag = clickable ? "button" : "div";
  return (
    <>
      <style>{`@keyframes tourPulse{50%{opacity:.25}}`}</style>
      <Tag onClick={onOpen} style={{
        position: "relative", display: "block", width: "100%", textAlign: "right", border: "none",
        fontFamily: "inherit", cursor: clickable ? "pointer" : "default", overflow: "hidden",
        borderRadius: 18, background: SUNSET, color: "white", padding: "14px 15px 60px",
        marginBottom: 12, boxShadow: "0 10px 26px rgba(242,85,122,0.28)",
      }}>
        {state && !state.published && <div style={{ marginBottom: 8 }}><DraftPill /></div>}
        <div style={{ position: "relative", zIndex: 1 }}>{body}</div>
        <Scene />
      </Tag>
    </>
  );
}

// ── מסך הטורניר ────────────────────────────────────────────────────────────
function ResultPill({ t, results, g }) {
  const s = ourScore(t, results, g);
  if (s) {
    return (
      <span style={{ flexShrink: 0, borderRadius: 10, padding: "4px 9px", fontSize: 15, fontWeight: 900, fontVariantNumeric: "tabular-nums",
        background: s.won ? "#dcfce7" : "#fee2e2", color: s.won ? "#15803d" : "#b91c1c" }}>
        {s.us}–{s.them}
      </span>
    );
  }
  return <span style={{ flexShrink: 0, borderRadius: 10, padding: "4px 9px", fontSize: 11, fontWeight: 800, background: "#f1f5f9", color: "#94a3b8" }}>טרם</span>;
}

function GameRow({ t, results, g, highlight }) {
  const d = describeGame(t, results, g);
  return (
    <div style={{ background: "#fff", borderRadius: 13, padding: "10px 12px", marginBottom: 7, display: "flex", alignItems: "center", gap: 10,
      // קו אחד שלם ולא border+borderStyle — ערבוב של שניהם שובר את העיצוב ברינדור חוזר
      border: highlight ? `1.5px solid ${CORAL}` : `1px ${g.stage !== "group" ? "dashed #cbd5e1" : "solid #eef2f7"}`,
      opacity: d.out ? 0.5 : 1 }}>
      <div style={{ flex: "0 0 52px", textAlign: "center" }}>
        <b style={{ display: "block", fontSize: 15, fontWeight: 800, color: DEEP, fontVariantNumeric: "tabular-nums" }}>{g.time}</b>
        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{d.hall}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "#16203a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</b>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{d.sub}{highlight ? " · הבא בתור" : ""}</span>
      </div>
      <ResultPill t={t} results={results} g={g} />
    </div>
  );
}

function GroupTable({ t, results }) {
  const rows = standings(t, results);
  const th = { background: DEEP, color: "#fff", fontWeight: 700, fontSize: 11, padding: "7px 4px" };
  const td = { padding: "8px 4px", textAlign: "center", borderBottom: "1px solid #f1f5f9", fontVariantNumeric: "tabular-nums" };
  return (
    <>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 13, overflow: "hidden", fontSize: 12.5 }}>
        <thead><tr>
          <th style={th}>#</th><th style={{ ...th, textAlign: "right" }}>קבוצה</th>
          <th style={th}>מש׳</th><th style={th}>נ׳</th><th style={th}>ה׳</th><th style={th}>יחס</th><th style={th}>נק׳</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const us = r.name === t.us;
            const cell = { ...td, background: us ? "#fff7e6" : "#fff", fontWeight: us ? 800 : 400, borderBottom: i === 1 ? "2px dashed #cbd5e1" : td.borderBottom };
            return (
              <tr key={r.name}>
                <td style={cell}>
                  <span style={{ display: "inline-flex", width: 20, height: 20, borderRadius: "50%", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900,
                    background: i < 2 ? "#f5c842" : "#f1f5f9", color: i < 2 ? "#1a237e" : "#475569" }}>{i + 1}</span>
                </td>
                <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap", color: us ? "#1a237e" : "#16203a" }}>{r.name}{us ? " ⭐" : ""}</td>
                <td style={cell}>{r.played}</td><td style={cell}>{r.won}</td><td style={cell}>{r.lost}</td>
                <td style={cell}>{r.scored}:{r.conceded}</td><td style={{ ...cell, fontWeight: 900 }}>{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 6, lineHeight: 1.6 }}>
        מקום 1 → חצי גמר עליון · מקום 2 → חצי גמר תחתון · מקומות 3–4 מסיימים<br />
        ניצחון {t.points.win} נק׳ · הפסד {t.points.loss} נק׳ · שוויון נקודות נפתח במפגש הישיר
      </div>
    </>
  );
}

// bleed: בלשונית של השחקנית הראש נמתח עד קצוות המסך (מבטל את הריפוד של
// הלשונית). בתצוגה המקדימה בפאנל הוא יושב בתוך מסגרת, ושם מתיחה כזו
// גולשת מהמסגרת ונראית כמו תמונה בתוך תמונה.
export function TournamentScreen({ t, state, now = new Date(), bleed = true }) {
  if (!t) return null;
  const results = (state && state.results) || {};
  const phase = tournamentPhase(t, now);
  const place = ourPlace(t, results);
  const next = phase === "during" ? nextOurGame(t, results) : null;
  const mine = ourGames(t);
  const dates = [...new Set(mine.map((g) => g.date))];
  const others = t.games.filter((g) => g.stage === "group" && g.a !== t.us && g.b !== t.us);

  let medal, headline, line;
  if (phase === "before") {
    medal = "☀️"; headline = daysToStart(t, now) === 1 ? "מחר יוצאות לאילת!" : `עוד ${daysToStart(t, now)} ימים`; line = `3 משחקים ב${t.group}. מקום 1 או 2 ממשיכים לשישי`;
  } else if (phase === "during") {
    medal = place || "🏐"; headline = place ? `מקום ${place} ב${t.group}` : "בהצלחה, בנות!";
    line = !place ? "הטבלה תתעדכן אחרי התוצאה הראשונה"
      : groupDone(t, results) ? (t.ko[place] ? `ממשיכות לחצי הגמר ה${t.ko[place].bracket}` : `סיימנו את המשחקים ב${t.group}`)
      : place <= 2 ? "כרגע במקומות שממשיכים לשישי 💪" : "צריך ניצחון כדי לעלות";
  } else {
    const s = summary(t, results);
    medal = "🏆"; headline = s.title; line = record(s.won, s.lost) || "";
  }

  return (
    <div style={bleed ? { margin: "-16px -16px 0" } : { background: "#f1f5f9", paddingBottom: 6 }}>
      <div style={{ position: "relative", color: "#fff", overflow: "hidden", background: SUNSET, padding: "18px 16px 74px" }}>
        {state && !state.published && <div style={{ marginBottom: 8 }}><DraftPill /></div>}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{t.name} · {t.city} {t.year}</div>
          <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 2 }}>{dateRange(t)} · {t.division} · {t.group}</div>
        </div>
        <Scene />
      </div>

      <div style={{ position: "relative", margin: "-46px 14px 0", background: "#fff", borderRadius: 16, padding: "12px 14px",
        display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 22px rgba(11,59,99,0.18)" }}>
        <div style={{ flex: "0 0 46px", height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 900, color: "#fff", background: "linear-gradient(135deg,#f5c842,#e8a317)" }}>{medal}</div>
        <div style={{ minWidth: 0 }}>
          <b style={{ display: "block", fontSize: 15, fontWeight: 800, color: "#16203a" }}>{headline}</b>
          <span style={{ fontSize: 12, color: "#64748b" }}>{line}</span>
        </div>
      </div>

      <div style={{ padding: "16px 14px 0" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: DEEP, marginBottom: 4 }}>המשחקים שלנו</div>
        {dates.map((d) => (
          <div key={d}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", margin: "10px 2px 6px" }}>
              {dayLabel(d)}{mine.filter((g) => g.date === d).every((g) => g.stage !== "group" && describeGame(t, results, g).locked) ? " · אם נעלה" : ""}
            </div>
            {mine.filter((g) => g.date === d).map((g) => (
              <GameRow key={g.id} t={t} results={results} g={g} highlight={next && next.id === g.id} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: "16px 14px 0" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: DEEP, marginBottom: 8 }}>טבלת {t.group}</div>
        <GroupTable t={t} results={results} />
      </div>

      <div style={{ padding: "16px 14px 8px" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: DEEP, marginBottom: 6 }}>שאר המשחקים ב{t.group}</div>
        {others.map((g) => {
          const r = resultOf(results, g);
          return (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#475569", padding: "6px 2px", borderBottom: "1px solid #eef2f7" }}>
              <span style={{ flex: "0 0 auto", color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>{dayLabel(g.date).split(" · ")[1]} {g.time}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{g.a} – {g.b}</span>
              <b style={{ flex: "0 0 auto", fontVariantNumeric: "tabular-nums", color: r ? "#16203a" : "#cbd5e1" }}>{r ? `${r.a}–${r.b}` : "טרם"}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── פאנל הדיווח (מירי / אפי) ────────────────────────────────────────────────
function pushText(t, results, g, next) {
  const s = ourScore(t, next, g);
  if (!s) return null;
  const d = describeGame(t, next, g);
  const opp = d.opp || (g.stage === "semi" ? "חצי הגמר" : "הגמר");
  const head = s.won ? `ניצחנו את ${opp} ${s.us}–${s.them}! 🎉` : `הפסד ל${opp} ${s.us}–${s.them}`;
  const p = g.stage === "group" ? ourPlace(t, next) : null;
  return p ? `${head} · מקום ${p} ב${t.group}` : head;
}

function AdminGame({ t, results, g, onSave, onClear }) {
  const saved = (results && results[g.id]) || {};
  const [a, setA] = useState(saved.a ?? "");
  const [b, setB] = useState(saved.b ?? "");
  const [opp, setOpp] = useState(saved.opp || "");
  const ko = g.stage !== "group";
  const d = describeGame(t, results, g);
  const aName = g.a, bName = ko ? (opp || d.opp || "היריבה") : g.b;
  const valid = a !== "" && b !== "" && Number(a) !== Number(b);
  const dirty = String(a) !== String(saved.a ?? "") || String(b) !== String(saved.b ?? "") || opp !== (saved.opp || "");
  const inp = { width: 56, border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "8px 4px", textAlign: "center",
    fontSize: 17, fontWeight: 800, color: DEEP, background: "#f8fafc", fontFamily: "inherit" };
  const mineGame = g.a === t.us || g.b === t.us;
  // חצי גמר/גמר שלא עלינו אליו, או שעוד לא ידוע אם נעלה — אין מה להזין.
  // עד עכשיו הכרטיס הציג "הבינלאומי 2" מול "היריבה" כבר לפני שלב הבתים.
  if (ko && (d.out || d.locked) && saved.a == null) {
    return (
      <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 13, padding: "11px 12px", marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#94a3b8", fontWeight: 700 }}>
          <span>{dayLabel(g.date)} · {g.time}</span><span>{d.title}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 5 }}>
          {d.out ? `לא עלינו לשלב הזה — ${d.sub}`
            : d.sub.startsWith("אם ננצח") ? `ייפתח לדיווח רק ${d.sub}`
            : `ייפתח לדיווח רק אם נעלה · ${d.sub.replace(/^אם נעלה: /, "")}`}
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: "#fff", border: `1px solid ${mineGame ? "#fbcfe8" : "#e2e8f0"}`, borderRadius: 13, padding: "11px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#94a3b8", fontWeight: 700, marginBottom: 7 }}>
        <span>{dayLabel(g.date)} · {g.time} · {d.hall}</span>
        <span>{ko ? d.title : mineGame ? "המשחק שלנו" : `משחק ב${t.group}`}</span>
      </div>
      {ko && (
        <input value={opp} onChange={(e) => setOpp(e.target.value)} placeholder={`היריבה (${d.opp || "לפי הלוח"})`}
          style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", fontSize: 13, marginBottom: 8, fontFamily: "inherit" }} />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: g.a === t.us ? "#1a237e" : "#16203a" }}>{aName}</span>
        <input inputMode="numeric" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, "").slice(0, 3))} style={inp} aria-label={aName} />
        <span style={{ fontSize: 13, fontWeight: 700, color: g.b === t.us ? "#1a237e" : "#16203a" }}>{bName}</span>
        <input inputMode="numeric" value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, "").slice(0, 3))} style={inp} aria-label={bName} />
      </div>
      {a !== "" && b !== "" && Number(a) === Number(b) && (
        <div style={{ fontSize: 11.5, color: "#b91c1c", marginTop: 6 }}>אין תיקו — אחת הקבוצות חייבת לנצח</div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
        <button disabled={!valid || !dirty} onClick={() => onSave(g, { a: Number(a), b: Number(b), ...(ko && opp ? { opp } : {}) })}
          style={{ flex: 1, border: "none", borderRadius: 10, padding: 10, fontSize: 13.5, fontWeight: 900, color: "#fff", fontFamily: "inherit",
            cursor: valid && dirty ? "pointer" : "default", opacity: valid && dirty ? 1 : 0.45, background: `linear-gradient(135deg,${CORAL},#ff8a4c)` }}>
          {saved.a != null ? "עדכון תוצאה" : "שמירת תוצאה"}
        </button>
        {saved.a != null && (
          <button onClick={() => { setA(""); setB(""); setOpp(""); onClear(g); }}
            style={{ border: "none", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, fontWeight: 700, background: "#f1f5f9", color: "#64748b", cursor: "pointer", fontFamily: "inherit" }}>
            מחיקה
          </button>
        )}
      </div>
    </div>
  );
}

// merge: כתיבה חלקית למסד (ברירת המחדל). נמסר מבחוץ רק בדף בדיקה.
export function TournamentAdmin({ tournaments = {}, notify, askConfirm, merge = mergeTournament }) {
  const t = activeTournament() || TOURNAMENTS[TOURNAMENTS.length - 1];
  const state = tournaments[t.id] || {};
  const results = state.results || {};
  const [preview, setPreview] = useState(false);
  // חלון אישור הפרסום. ההתראה מסומנת מראש רק אם עוד לא יצאה אחת (announced)
  const [pubAsk, setPubAsk] = useState(null);

  async function saveResult(g, r) {
    const next = { ...results, [g.id]: r };
    await merge(t.id, { results: { [g.id]: r } });
    const mineGame = g.a === t.us || g.b === t.us;
    // התראה לכל הקבוצה רק אחרי פרסום, ורק על המשחקים שלנו — בטיוטה אסור
    // שתצא התראה אמיתית לבנות על תוצאת בדיקה.
    const body = mineGame && state.published ? pushText(t, results, g, next) : null;
    if (body) notifyTeamPushRemote(`🏐 ${t.name}`, body);
    notify(body ? "התוצאה נשמרה ונשלחה לקבוצה 📣" : "התוצאה נשמרה", { icon: "✅" });
  }
  async function clearResult(g) {
    await merge(t.id, { results: { [g.id]: null } });
  }
  function togglePublish() {
    if (state.published) {
      askConfirm("להחזיר לטיוטה? הבנות לא יראו יותר את הספורטיאדה באפליקציה.", () => merge(t.id, { published: false }));
    } else {
      setPubAsk({ push: !state.announced });
    }
  }
  async function confirmPublish() {
    const push = pubAsk.push;
    setPubAsk(null);
    await merge(t.id, push ? { published: true, announced: true } : { published: true });
    if (push) notifyTeamPushRemote(`🏐 ${t.name}`, ANNOUNCE);
    notify(push ? "פורסם ונשלחה התראה לקבוצה 📣" : "פורסם לקבוצה", { icon: "✅" });
  }
  function resetAll() {
    askConfirm("למחוק את כל התוצאות? זה מתאים לניקוי תוצאות בדיקה לפני הטורניר.", () => merge(t.id, { results: null }));
  }

  const dates = [...new Set(t.games.map((g) => g.date))].sort();
  return (
    <div>
      <div style={{ borderRadius: 16, overflow: "hidden", position: "relative", background: SUNSET, color: "#fff", padding: "14px 15px 58px", marginBottom: 12 }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>🏆 {t.name} {t.year}</div>
          <div style={{ fontSize: 12.5, opacity: 0.92 }}>{dateRange(t)} · {t.division} · {t.group}</div>
        </div>
        <Scene />
      </div>

      <div style={{ background: state.published ? "#f0fdf4" : "#f5f3ff", border: `1px solid ${state.published ? "#86efac" : "#ddd6fe"}`, borderRadius: 13, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: state.published ? "#166534" : "#6d28d9" }}>
          {state.published ? "✅ פורסם — כל הבנות רואות" : "🧪 טיוטה — רק חשבון הבדיקה רואה"}
        </div>
        <div style={{ fontSize: 12, color: "#475569", marginTop: 3, lineHeight: 1.55 }}>
          {state.published
            ? "כל תוצאה של משחק שלנו נשלחת כהתראה לקבוצה."
            : "אפשר לבדוק הכל, כולל תוצאות, בלי שאף אחת רואה. בטיוטה לא נשלחות התראות."}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={togglePublish} style={{ flex: 1, border: "none", borderRadius: 10, padding: 10, fontSize: 13.5, fontWeight: 900, cursor: "pointer", fontFamily: "inherit",
            background: state.published ? "#fff" : "#1a237e", color: state.published ? "#1a237e" : "#fff", boxShadow: state.published ? "inset 0 0 0 1.5px #1a237e" : "none" }}>
            {state.published ? "החזרה לטיוטה" : "פרסום לקבוצה"}
          </button>
          <button onClick={() => setPreview((v) => !v)} style={{ flex: 1, border: "none", borderRadius: 10, padding: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "#fff", color: "#475569", boxShadow: "inset 0 0 0 1px #cbd5e1" }}>
            {preview ? "סגירת התצוגה" : "👀 איך הבנות רואות"}
          </button>
        </div>
      </div>

      {pubAsk && (() => {
        const has = Object.keys(results).length;
        return (
          <div style={{ background: "#fff", border: "1.5px solid #1a237e", borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#16203a" }}>לפרסם לכל הקבוצה?</div>
            <div style={{ fontSize: 12.5, color: "#5b6478", margin: "4px 0 10px", lineHeight: 1.55 }}>
              מרגע זה כל הבנות יראו את הספירה לאחור ואת לוח המשחקים.
              {has > 0 && <b style={{ color: "#b91c1c" }}> יש כרגע {has === 1 ? "תוצאה אחת שמורה" : `${has} תוצאות שמורות`} — אם אלה תוצאות בדיקה, כדאי למחוק אותן קודם.</b>}
            </div>
            <label style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "#fff6f8", border: "1.5px solid #fbcfe8", borderRadius: 12, padding: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={pubAsk.push} onChange={(e) => setPubAsk({ push: e.target.checked })}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: CORAL, flexShrink: 0 }} />
              <span>
                <b style={{ fontSize: 13, color: "#16203a" }}>לשלוח התראה לכל הקבוצה</b>
                <span style={{ display: "block", fontSize: 12, color: "#5b6478" }}>
                  {state.announced ? "כבר נשלחה התראה בפרסום קודם" : `"${ANNOUNCE}"`}
                </span>
              </span>
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => setPubAsk(null)} style={{ flex: 1, border: "none", borderRadius: 10, padding: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "#f1f5f9", color: "#475569" }}>ביטול</button>
              <button onClick={confirmPublish} style={{ flex: 1, border: "none", borderRadius: 10, padding: 10, fontSize: 13.5, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", background: CORAL, color: "#fff" }}>
                {pubAsk.push ? "פרסום ושליחה" : "פרסום בשקט"}
              </button>
            </div>
          </div>
        );
      })()}

      {preview && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#64748b", margin: "0 2px 7px" }}>בדף הבית, עד שבוע לפני — פס דק מתחת לאימון</div>
          <TournamentCard t={t} state={{ ...state, published: true }} size="slim" />
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#64748b", margin: "8px 2px 7px" }}>בשבוע האחרון ובימי הטורניר — הכרטיס המלא</div>
          <TournamentCard t={t} state={{ ...state, published: true }} size="big" />
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#64748b", margin: "8px 2px 7px" }}>המסך המלא, אחרי לחיצה על הכרטיס</div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 16px rgba(16,24,64,0.08)" }}>
            <TournamentScreen t={t} state={{ ...state, published: true }} bleed={false} />
          </div>
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 800, color: DEEP, marginBottom: 2 }}>תוצאות</div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.55 }}>
        תוצאה סופית בלבד. כדי שהטבלה תהיה נכונה צריך להזין גם את המשחקים ב{t.group} שלא שיחקנו בהם.
      </div>
      {dates.map((d) => (
        <div key={d}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: "#94a3b8", margin: "12px 2px 6px" }}>{dayLabel(d)}</div>
          {t.games.filter((g) => g.date === d).sort((x, y) => x.time.localeCompare(y.time)).map((g) => (
            <AdminGame key={`${g.id}:${JSON.stringify(results[g.id] || {})}`} t={t} results={results} g={g} onSave={saveResult} onClear={clearResult} />
          ))}
        </div>
      ))}

      {Object.keys(results).length > 0 && (
        <button onClick={resetAll} style={{ width: "100%", marginTop: 10, border: "none", borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 700, background: "#fef2f2", color: "#b91c1c", cursor: "pointer", fontFamily: "inherit" }}>
          מחיקת כל התוצאות
        </button>
      )}
    </div>
  );
}
