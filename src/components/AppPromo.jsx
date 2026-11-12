import KitchenBanner from "./KitchenBanner";
import "../styles/kitchen-banner.css";

// ── באנר לאפליקציות של אפי — בתחלופה ─────────────────────────────────────────
// אפי, 12.11.26: אחרי "המטבח שלי" גם CartFlow (רשימת הקניות), ובכל כניסה
// לאפליקציה מוצג אחד מהם — פעם זה, פעם זה. "כניסה" = טעינה של האפליקציה; בתוך
// אותה כניסה הבאנר לא מתחלף, וזהה בדף הבית ובמסך האישי.
// הקישורים מתויגים (PWA מותקנת לא שולחת referrer), ו-utm_medium=app-banner
// גורם לאפליקציה בצד השני לפתוח קודם את סרטון הפרומו שלה.
const SRC = "volleyball";
const tag = (url) => `${url}?utm_source=${SRC}&utm_medium=app-banner&utm_campaign=cross-promo&ref=${SRC}`;

function CartflowBanner() {
  return (
    <div className="kb kb-fixed kb-cf">
      <a className="kb-link" href={tag("https://cartflow-one.vercel.app/")} target="_blank" rel="noopener">
        <span className="kb-ic" aria-hidden="true">🛒</span>
        <span className="kb-tx">
          <span className="kb-nm">CartFlow</span>
          <span className="kb-pt">רשימת קניות אחת. לכל המשפחה — מתעדכנת אצל כולם בזמן אמת.</span>
        </span>
        <span className="kb-go">להצצה ←</span>
      </a>
    </div>
  );
}

const BANNERS = [KitchenBanner, CartflowBanner];
const TURN_KEY = "vb_promo_turn";

// נקבע פעם אחת לכל טעינה של האפליקציה, ומתקדם בטעינה הבאה
let pick = null;
function currentPick() {
  if (pick !== null) return pick;
  let n = 0;
  try { n = Number(localStorage.getItem(TURN_KEY) || 0) || 0; localStorage.setItem(TURN_KEY, String(n + 1)); } catch {}
  pick = n % BANNERS.length;
  return pick;
}

export default function AppPromo() {
  const Banner = BANNERS[currentPick()];
  return <Banner />;
}
