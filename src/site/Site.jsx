// ── שכבת ההצגה של הדסקטופ ──────────────────────────────────────────────────
// לא סרגל צד ולא מתיחה של מסך הטלפון: הצגה שנייה מעל אותה שכבת state בדיוק.
// כל מה שכאן מקבל את הנתונים דרך ה-props שכבר קיימים למסך הנייד — אם משהו כאן
// צריך fetch משלו, הוא שייך למעלה ולא לכאן.
//
// הקבצים: Site.jsx (העץ) + site.css (כל מחלקה בקידומת st-). מחלקה בלי הקידומת
// תתנגש עם ה-shell של הטלפון.
import { useState, useEffect, useRef, useMemo } from "react";
import { formatShort, todayStr, rosterOf } from "../lib/utils";
import "@fontsource-variable/rubik"; // כותרות ומספרים באתר בלבד — הקובץ יורד רק כשמשתמשים בו
import "./site.css";

// 1100×600 ולא 1100 בלבד: טלפון שמוחזק לרוחב הוא ~1100 רחב ו-400 גבוה, ובלי
// חצי-הגובה הוא היה מקבל את אתר הדסקטופ ורואה מסטהד שממלא את כל המסך.
const DESKTOP_Q = "(min-width: 1100px) and (min-height: 600px)";

export function useIsDesktop() {
  const [on, setOn] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(DESKTOP_Q).matches
  );
  useEffect(() => {
    const m = window.matchMedia(DESKTOP_Q);
    const h = () => setOn(m.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);
  return on;
}

// ── חיפוש גלובלי ────────────────────────────────────────────────────────────
// הסימן החזק ביותר שדף הוא אתר ולא אפליקציה. מחפש רוחבית על מה שהמוצר עוסק בו:
// שחקניות, אירועים ותוצאות — ולא רק בלשונית שפתוחה כרגע.
function useSearch({ players = [], events = [], archive = [], playerProfiles = {} }) {
  const [q, setQ] = useState("");
  const boxRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const results = useMemo(() => {
    const t = q.trim();
    if (t.length < 2) return [];
    const hit = (s) => String(s || "").toLowerCase().includes(t.toLowerCase());
    const out = [];
    for (const p of players) {
      const prof = playerProfiles[p.id] || {};
      if (hit(p.name) || hit(prof.phone) || hit(prof.email))
        out.push({ kind: "player", key: "p" + p.id, icon: "👤", title: p.name, sub: "שחקנית", tab: "players" });
    }
    for (const ev of [...events, ...archive]) {
      if (hit(ev.opponent) || hit(ev.location) || hit(ev.note) || hit(formatShort(ev.date))) {
        const isGame = ev.type === "game";
        out.push({
          kind: "event",
          key: "e" + ev.id,
          icon: isGame ? "🏆" : "🏋️",
          title: isGame ? (ev.opponent ? "משחק נגד " + ev.opponent : "משחק") : "אימון",
          sub: `${formatShort(ev.date)}${ev.location ? " · " + ev.location : ""}${ev.result ? " · " + ev.result : ""}`,
          tab: isGame && (ev.outcome || ev.result) ? "games" : "calendar",
        });
      }
    }
    return out.slice(0, 8);
  }, [q, players, events, archive, playerProfiles]);

  return { q, setQ, open, setOpen, results, boxRef };
}

function SearchBox({ ctx, onPick, placeholder }) {
  const { q, setQ, open, setOpen, results, boxRef } = useSearch(ctx);
  return (
    <div className="st-search" ref={boxRef}>
      <span className="st-search-icon" aria-hidden>🔍</span>
      <input
        className="st-search-input"
        value={q}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        aria-label="חיפוש באתר"
      />
      {open && q.trim().length >= 2 && (
        <div className="st-results">
          {results.length === 0 && <div className="st-result-empty">לא נמצא כלום עבור «{q.trim()}»</div>}
          {results.map((r) => (
            <button key={r.key} className="st-result" onClick={() => { setOpen(false); setQ(""); onPick(r); }}>
              <span className="st-result-icon">{r.icon}</span>
              <span className="st-result-text">
                <span className="st-result-title">{r.title}</span>
                <span className="st-result-sub">{r.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// גלילה לעוגן בתוך .st-root — לא window.scrollTo: החלון עצמו לא נגלל כאן.
// הקיזוז נמדד מגובה המסטהד בפועל ולא ממספר קבוע: מאז שהניווט עוטף לשורה
// שנייה הגובה משתנה לפי הרוחב ומספר הלשוניות, וכל קבוע היה נכון ברוחב אחד
// בלבד. scroll-margin-top ב-CSS נשאר כרשת ביטחון.
function scrollToAnchor(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const root = document.querySelector(".st-root");
  if (!root) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  const head = document.querySelector(".st-head");
  const offset = (head ? head.getBoundingClientRect().height : 0) + 12;
  const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - offset;
  root.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

// ── מסטהד ───────────────────────────────────────────────────────────────────
// שני מצבי ניווט: anchors = קישורים שגוללים בתוך אותו עמוד (בית השחקנית),
// items = לשוניות שמחליפות תוכן (פאנל המנהלת, ומסכי העומק של השחקנית).
// ── קווי מגרש ───────────────────────────────────────────────────────────────
// החתימה של האתר: מגרש כדורשת בקווים דקים ברקע של כל רצועה כהה — מספיק
// כדי לזהות מגרש, לא מספיק כדי להתחרות בטקסט (השקיפות ב-CSS).
export function Court() {
  return (
    <svg className="st-court" viewBox="0 0 1280 300" preserveAspectRatio="none" aria-hidden>
      <g fill="none" stroke="#fff" strokeWidth="2">
        <rect x="120" y="36" width="1040" height="228" />
        <line x1="467" y1="36" x2="467" y2="264" />
        <line x1="813" y1="36" x2="813" y2="264" />
      </g>
      <line x1="640" y1="18" x2="640" y2="282" stroke="var(--st-sc, #f5c842)" strokeWidth="4" />
    </svg>
  );
}

// המותג: כדור + שם הקבוצה המלא בשתי שורות. השם הארוך ("קבוצת הכדורשת של
// הבנק הבינלאומי") נחתך קודם ל"...הבינ…" בשורה אחת.
export function Brand({ teamName, sub, onClick, handlers }) {
  return (
    <button className="st-brand" onClick={onClick} title="חזרה למסך הפתיחה" {...(handlers || {})}>
      <span className="st-ball" aria-hidden />
      <span className="st-brand-text">
        <span className="st-brand-name">{teamName || "קבוצת הכדורשת"}</span>
        {sub && <span className="st-brand-sub">{sub}</span>}
      </span>
    </button>
  );
}

// ── לוח ההגעה ────────────────────────────────────────────────────────────────
// הכרטיס הכהה לצד האירוע הקרוב: שלושה מספרים ופס. משותף לבית השחקנית
// ולדלת הכניסה, כדי ששניהם יספרו אותו דבר.
export function TallyBoard({ counts, words, live }) {
  const total = counts.coming + counts.notcoming + counts.pending || 1;
  return (
    <div className="st-board">
      <h4>לוח ההגעה{live ? " · מתעדכן בזמן אמת" : ""}</h4>
      <div className="st-board-t">
        <div><b className="st-num st-ok">{counts.coming}</b><span>{words.coming}</span></div>
        <div><b className="st-num st-no">{counts.notcoming}</b><span>{words.notcoming}</span></div>
        <div><b className="st-num">{counts.pending}</b><span>{words.pending}</span></div>
      </div>
      <div className="st-board-m" aria-hidden>
        <i className="st-ok" style={{ width: (counts.coming / total) * 100 + "%" }} />
        <i className="st-no" style={{ width: (counts.notcoming / total) * 100 + "%" }} />
      </div>
    </div>
  );
}

// ── מי מגיעה — בקבוצות ולא ברשת ─────────────────────────────────────────────
// שלוש שורות (מגיעות / לא / טרם) עם צ'יפ לכל שחקנית. ברשת של 13 עיגולים
// גדולים צריך היה לבחון את צבע הטבעת של כל אחת כדי להבין מי מה.
export function WhoGroups({ roster, attendance, eventId, playerProfiles = {}, meId, words }) {
  const st = (p) => attendance[`${eventId}_${p.id}`]?.status;
  const groups = [
    ["coming", words.coming, roster.filter((p) => st(p) === "coming")],
    ["notcoming", words.notcoming, roster.filter((p) => st(p) === "notcoming")],
    ["pending", words.pending, roster.filter((p) => !st(p))],
  ];
  return (
    <div className="st-who-g">
      {groups.map(([k, label, list]) => list.length > 0 && (
        <div key={k} className={"st-who-row st-" + k}>
          <h5><i />{label} · <span className="st-num">{list.length}</span></h5>
          <div className="st-chips">
            {list.map((p) => {
              const prof = playerProfiles[p.id] || {};
              const me = String(p.id) === String(meId);
              return (
                <span key={p.id} className={"st-chip" + (me ? " st-me" : "")}>
                  {prof.photo ? <img src={prof.photo} alt="" /> : <span className="st-chip-av">{String(p.name || "?").trim().slice(0, 2)}</span>}
                  {p.name}{me ? " (את)" : ""}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SiteHeader({ ctx, tab, setTab, items = [], anchors, teamName, brandSub, who, onHome, onLogout, searchPlaceholder }) {
  return (
    <header className="st-head">
      <div className="st-top">
       <div className="st-top-in">
        <Brand teamName={teamName} sub={brandSub || "ניהול קבוצה"} onClick={onHome} />

        <SearchBox ctx={ctx} placeholder={searchPlaceholder} onPick={(r) => setTab(r.tab)} />

        <div className="st-account">
          <span className="st-av" aria-hidden>{String(who || "?").trim().slice(0, 1)}</span>
          <span className="st-who" title={who}>{who}</span>
          <button className="st-out" onClick={onLogout}>יציאה</button>
        </div>
       </div>
      </div>

      <div className="st-navbar">
        <nav className="st-nav" aria-label="ניווט ראשי">
          {(anchors || []).map((a) => (
            <a
              key={a.id}
              className="st-nav-link"
              href={"#" + a.id}
              onClick={(e) => { e.preventDefault(); scrollToAnchor(a.id); }}
            >{a.label}</a>
          ))}
          {items.map((it) => (
            <button
              key={it.key}
              className={"st-nav-link" + (tab === it.key ? " st-on" : "") + (it.lead ? " st-lead" : "")}
              onClick={() => setTab(it.key)}
            >
              <span aria-hidden>{it.icon}</span> {it.label}
              {it.badge ? <span className="st-dot" aria-label="חדש" /> : null}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

// ── רצועת הכותרת של עמוד ─────────────────────────────────────────────────────
// כל עמוד שאינו הבית מקבל רצועה כהה עם קווי המגרש ושם העמוד — כך שכל מסך
// באתר נפתח באותה שפה, גם כשגוף העמוד הוא המסך של הטלפון.
const BAND_SUB = {
  calendar: "כל האימונים והמשחקים. לחיצה על יום פותחת אותו בצד.",
  games: "תוצאות המשחקים של הקבוצה",
  chat: "מה מתחדש אצל הבנות",
  polls: "סקרים פעילים",
  gallery: "תמונות מהמשחקים והאימונים",
  tournament: "אילת · דרג 5 · בית א",
  about: "על האפליקציה ועל הקבוצה",
};
function PageBand({ item, teamName }) {
  if (!item) return null;
  return (
    <section className="st-band">
      <Court />
      <div className="st-band-in">
        <p className="st-band-eyebrow">{teamName || "קבוצת הכדורשת"}</p>
        <h1 className="st-band-h"><span aria-hidden>{item.icon}</span> {item.label}</h1>
        {BAND_SUB[item.key] && <p className="st-band-sub">{BAND_SUB[item.key]}</p>}
      </div>
    </section>
  );
}

function SiteFooter({ teamName, extra }) {
  return (
    <footer className="st-foot">
      <div className="st-foot-in">
        <div className="st-foot-brand">
          <span className="st-ball st-ball-sm" aria-hidden /> {teamName || "כדורשת"}
        </div>
        <div className="st-foot-links">{extra}</div>
        <div className="st-foot-legal">
          © {new Date().getFullYear()} · נבנה עבור קבוצות כדורשת
        </div>
      </div>
    </footer>
  );
}

// ── רצועת מספרים לפאנל המנהלת ───────────────────────────────────────────────
// לא hero שיווקי — זו קונסולת ניהול. מה שמנהלת רוצה בלי ללחוץ: כמה אישרו,
// מה האירוע הבא, ומה ממתין לטיפול.
function AdminStrip({ ctx, nextEvent, onGo, title }) {
  const { players: all = [], attendance = {}, events = [], archive = [] } = ctx;
  // בלי צופה וחשבון בדיקה — כמו כל ספירה אחרת באפליקציה. קודם נספרו כאן כל
  // החשבונות, והרצועה הראתה "טרם ענו 5" ליד כרטיס שהראה 4.
  const players = rosterOf(all);
  const st = (s) => (nextEvent ? players.filter((p) => attendance[`${nextEvent.id}_${p.id}`]?.status === s).length : 0);
  const noAnswer = nextEvent ? players.filter((p) => !attendance[`${nextEvent.id}_${p.id}`]?.status).length : 0;
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const pending = events.filter((e) => (e.date < todayStr() || (e.date === todayStr() && (e.time || "00:00") <= hm)) && !e.cancelled).length;

  return (
    <section className="st-strip">
      <Court />
      <div className="st-strip-in">
        <div className="st-strip-lead">
          <p className="st-eyebrow">פאנל ניהול{title ? " · " + title : ""} · האירוע הקרוב</p>
          <h2 className="st-h2">
            {nextEvent
              ? `${nextEvent.type === "training" ? "🏋️ אימון" : nextEvent.opponent ? "🏆 משחק נגד " + nextEvent.opponent : "🏆 משחק"} · ${formatShort(nextEvent.date)} ${nextEvent.time}`
              : "אין אירוע קרוב"}
          </h2>
        </div>
        <div className="st-tiles">
          <button className="st-tile st-good" onClick={() => onGo("attendance")}><b>{st("coming")}</b><span>מגיעות</span></button>
          <button className="st-tile st-bad" onClick={() => onGo("attendance")}><b>{st("notcoming")}</b><span>לא מגיעות</span></button>
          <button className="st-tile" onClick={() => onGo("attendance")}><b>{noAnswer}</b><span>טרם ענו</span></button>
          <button className={"st-tile" + (pending ? " st-warn" : "")} onClick={() => onGo("events")}><b>{pending}</b><span>ממתינים לארכוב</span></button>
          <button className="st-tile" onClick={() => onGo("players")}><b>{players.length}</b><span>שחקניות</span></button>
          <button className="st-tile" onClick={() => onGo("archive")}><b>{archive.length}</b><span>אירועים בארכיון</span></button>
        </div>
      </div>
    </section>
  );
}

// ── העטיפה ──────────────────────────────────────────────────────────────────
// children = גוף הלשונית הקיים (.tab-body). זהו מסלול ה-embed של הסקיל: מסכים
// שהם טפסים ורשימות נראים טוב בעמודה, ואין טעם לבנות להם גרסה נפרדת.
export function SiteChrome({
  ctx, tab, setTab, items, anchors, teamName, brandSub, who, onHome, onLogout,
  hero, footerExtra, searchPlaceholder, children, page, pc, sc,
}) {
  const rootRef = useRef(null);
  // החלפת לשונית שמגיעה לאמצע של סקשן חדש מרגישה שבורה
  useEffect(() => { if (rootRef.current) rootRef.current.scrollTop = 0; }, [tab]);

  // צבעי הקבוצה מגיעים מ-settings בזמן ריצה. בלי ההזרמה הזאת כל שכבת הדסקטופ
  // נופלת לכחול ברירת המחדל, ולקבוצה עם מיתוג אחר האתר נראה של מישהו אחר.
  const vars = {};
  if (pc) vars["--st-pc"] = pc;
  if (sc) vars["--st-sc"] = sc;

  return (
    <div className="st-root" ref={rootRef} style={vars}>
      <SiteHeader
        ctx={ctx} tab={tab} setTab={setTab} items={items} anchors={anchors}
        teamName={teamName} brandSub={brandSub} who={who} onHome={onHome} onLogout={onLogout}
        searchPlaceholder={searchPlaceholder}
      />
      {hero || (!page && <PageBand item={(items || []).find((i) => i.key === tab)} teamName={teamName} />)}
      {/* page = תוכן שמעצב את הרוחב בעצמו (בית השחקנית). ברירת המחדל היא
          מסלול ה-embed: גוף לשונית של הטלפון שמוגש בעמודה ממורכזת. */}
      {/* st-banded: לעמוד יש רצועת כותרת, ולכן הכותרת הקטנה של מסך הטלפון
          ("🗳️ סקר") מיותרת ומוסתרת ב-CSS. בפאנל אין רצועה כזו — שם נשארת. */}
      {page ? <main>{children}</main> : <main className={"st-embed" + (hero ? "" : " st-banded")}>{children}</main>}
      <SiteFooter teamName={teamName} extra={footerExtra} />
    </div>
  );
}

export { AdminStrip };
