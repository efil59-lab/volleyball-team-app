import { useEffect, useState } from "react";
import "../styles/kitchen-banner.css";

// ── באנר "המטבח שלי" ─────────────────────────────────────────────────────────
// הזמנה לאפליקציה אחרת, ולכן בצבעים שלה (קרם, ורוד, לוגו בכתב יד) ולא בצבעי
// הקבוצה. יושב בדף הבית מתחת ל"המסך האישי שלי" — בתוך הדף, לא צף מעל תוכן.
//
// PWA מותקנת לא שולחת referrer, ולכן הקישור מתויג: בלי זה הכניסה נרשמת במטבח
// כ"ישירה" ואי אפשר לדעת שהגיעה מכאן.
const SRC = "volleyball";
const URL = "https://hamitbach.vercel.app/"
  + `?utm_source=${SRC}&utm_medium=app-banner&utm_campaign=cross-promo&ref=${SRC}`;

// בשלב זה הבאנר קבוע (אפי, 10.10.26): בלי ✕, ולחיצה לא מסתירה אותו. מנגנון
// המנוחה נשאר בקוד — כדי להחזיר אותו מספיק להפוך את PERMANENT ל-false.
const PERMANENT = true;
const KEY = "vb_kitchen_promo";
const DAY = 86400000;
const REST_AFTER_CLOSE = 7 * DAY;    // ✕ — חוזר אחרי שבוע
const REST_AFTER_VISIT = 30 * DAY;   // לחצה ונכנסה — לא מציקים חודש

function resting() {
  try { return Number(localStorage.getItem(KEY) || 0) > Date.now(); } catch { return false; }
}
function rest(ms) {
  try { localStorage.setItem(KEY, String(Date.now() + ms)); } catch {}
}

// הגופן של הלוגו נטען רק כשהבאנר באמת מוצג
function loadLogoFont() {
  if (document.getElementById("kb-font")) return;
  const l = document.createElement("link");
  l.id = "kb-font";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&display=swap";
  document.head.appendChild(l);
}

export default function KitchenBanner() {
  const [hidden, setHidden] = useState(() => !PERMANENT && resting());
  useEffect(() => { if (!hidden) loadLogoFont(); }, [hidden]);
  if (hidden) return null;

  return (
    <div className={"kb" + (PERMANENT ? " kb-fixed" : "")}>
      <a className="kb-link" href={URL} target="_blank" rel="noopener"
        onClick={() => { if (PERMANENT) return; rest(REST_AFTER_VISIT); setTimeout(() => setHidden(true), 400); }}>
        <span className="kb-ic" aria-hidden="true">🍲</span>
        <span className="kb-tx">
          <span className="kb-nm">המטבח שלי</span>
          <span className="kb-pt">ראית מתכון? שמרת. המטבח מסדר, ואת מוצאת.</span>
        </span>
        <span className="kb-go">לטעימה ←</span>
      </a>
      {!PERMANENT && (
        <button className="kb-x" aria-label="סגירת הבאנר"
          onClick={() => { rest(REST_AFTER_CLOSE); setHidden(true); }}>✕</button>
      )}
    </div>
  );
}
