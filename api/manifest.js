// ── מניפסט דינמי לפי קבוצה ────────────────────────────────────────────────────
// המניפסט הסטטי הכריז start_url: "." — כלומר האייקון פותח את הכתובת החשופה,
// בלי ?team=. באנדרואיד זה לא הורגש: ל-PWA מותקן יש שם אותו אחסון כמו לדפדפן,
// והסקריפט ב-index.html שיחזר את הקבוצה מ-localStorage.
//
// באייפון זה נשבר. ל-web app שמותקן במסך הבית יש מאגר אחסון **נפרד לגמרי**
// מ-Safari, אז pwaTeam שנשמר בזמן הגלישה פשוט לא קיים שם. התוצאה: השחקנית
// מתקינה, לוחצת על האייקון, ומקבלת את דף המכירה במקום את הקבוצה שלה —
// ולקבוצה שאינה הבינלאומי אין בכלל דרך להגיע משם ליעד (דווח 5.9.2026).
//
// כאן start_url נושא את הקבוצה, ולכן האייקון מגיע ליעד גם כשהאחסון ריק.
// index.html מפנה לכאן בזמן ריצה כשידועה קבוצה.
const ICONS = [
  { src: "/favicon.ico", sizes: "64x64 32x32 24x24 16x16", type: "image/x-icon" },
  { src: "/logo192.png", type: "image/png", sizes: "192x192" },
  { src: "/logo512.png", type: "image/png", sizes: "512x512" },
];

export default function handler(req, res) {
  // מזהי קבוצה הם [a-z0-9-] (generateTeamId). מסננים כל השאר כדי שלא ייכנס
  // לכאן טקסט שרירותי שנשמר אחר כך כ-start_url אצל המשתמשת.
  const raw = (req.query && req.query.team) || "";
  const team = String(raw).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  const startUrl = team ? `/?team=${encodeURIComponent(team)}` : "/";

  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  // חייב להיות טרי: קבוצה מתחלפת בין משתמשות על אותו דומיין
  res.setHeader("Cache-Control", "no-store");

  res.status(200).json({
    short_name: "כדורשת",
    name: "אפליקציית כדורשת",
    description: "אפליקציית ניהול קבוצת כדורשת",
    icons: ICONS,
    start_url: startUrl,
    scope: "/",
    // id מפורש "/" ולא ברירת המחדל (שהיא start_url): בלי זה כל קבוצה הופכת
    // לזהות-אפליקציה אחרת, והתקנות אנדרואיד קיימות היו נחשבות לאפליקציה
    // אחרת ומוצע להתקין שוב לצד האייקון הקיים.
    id: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#1a237e",
    background_color: "#1a237e",
  });
}
