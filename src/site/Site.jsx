// ── שכבת ההצגה של הדסקטופ ──────────────────────────────────────────────────
// לא סרגל צד ולא מתיחה של מסך הטלפון: הצגה שנייה מעל אותה שכבת state בדיוק.
// כל מה שכאן מקבל את הנתונים דרך ה-props שכבר קיימים למסך הנייד — אם משהו כאן
// צריך fetch משלו, הוא שייך למעלה ולא לכאן.
//
// הקבצים: Site.jsx (העץ) + site.css (כל מחלקה בקידומת st-). מחלקה בלי הקידומת
// תתנגש עם ה-shell של הטלפון.
import { useState, useEffect, useRef, useMemo } from "react";
import { formatShort, todayStr } from "../lib/utils";
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
// scroll-margin-top ב-CSS הוא מה שמונע מהכותרת לנחות מתחת למסטהד הדביק.
function scrollToAnchor(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── מסטהד ───────────────────────────────────────────────────────────────────
// שני מצבי ניווט: anchors = קישורים שגוללים בתוך אותו עמוד (בית השחקנית),
// items = לשוניות שמחליפות תוכן (פאנל המנהלת, ומסכי העומק של השחקנית).
function SiteHeader({ ctx, tab, setTab, items = [], anchors, teamName, brandSub, who, onHome, onLogout, searchPlaceholder }) {
  return (
    <header className="st-head">
      <div className="st-head-in">
        <button className="st-brand" onClick={onHome} title="חזרה למסך הפתיחה">
          <span className="st-brand-ball" aria-hidden>🏐</span>
          <span className="st-brand-text">
            <span className="st-brand-name">{teamName || "כדורשת"}</span>
            <span className="st-brand-sub">{brandSub || "ניהול קבוצה"}</span>
          </span>
        </button>

        <SearchBox ctx={ctx} placeholder={searchPlaceholder} onPick={(r) => setTab(r.tab)} />

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

        <div className="st-account">
          <span className="st-who" title={who}>{who}</span>
          <button className="st-out" onClick={onLogout}>יציאה</button>
        </div>
      </div>
    </header>
  );
}

function SiteFooter({ teamName, extra }) {
  return (
    <footer className="st-foot">
      <div className="st-foot-in">
        <div className="st-foot-brand">
          <span aria-hidden>🏐</span> {teamName || "כדורשת"}
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
function AdminStrip({ ctx, nextEvent, onGo }) {
  const { players = [], attendance = {}, events = [], archive = [] } = ctx;
  const st = (s) => (nextEvent ? players.filter((p) => attendance[`${nextEvent.id}_${p.id}`]?.status === s).length : 0);
  const noAnswer = nextEvent ? players.filter((p) => !attendance[`${nextEvent.id}_${p.id}`]?.status).length : 0;
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const pending = events.filter((e) => (e.date < todayStr() || (e.date === todayStr() && (e.time || "00:00") <= hm)) && !e.cancelled).length;

  return (
    <section className="st-strip">
      <div className="st-strip-in">
        <div className="st-strip-lead">
          <p className="st-eyebrow">האירוע הקרוב</p>
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
      {hero}
      {/* page = תוכן שמעצב את הרוחב בעצמו (בית השחקנית). ברירת המחדל היא
          מסלול ה-embed: גוף לשונית של הטלפון שמוגש בעמודה ממורכזת. */}
      {page ? <main>{children}</main> : <main className="st-embed">{children}</main>}
      <SiteFooter teamName={teamName} extra={footerExtra} />
    </div>
  );
}

export { AdminStrip };
