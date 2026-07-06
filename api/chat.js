// ── נקודת קצה ל-AI (מאמן AI — שלב 5) — מושבתת בכוונה ─────────────────────────
// עד שלב 5 (מאמן AI) נקודת הקצה סגורה. בעבר היא הייתה פתוחה לגמרי: CORS "*",
// ללא אימות, עם מפתח Anthropic חי — כלומר כל מי שמצא את הכתובת יכול היה לשרוף
// קרדיטים על חשבוננו. אף חלק באפליקציה לא קורא לה כרגע (נבדק), אז ההשבתה
// לא משפיעה על המשתמשות — היא רק סוגרת חשיפת עלות/אבטחה.
//
// שלב 5 יבנה אותה מחדש עם:
//   1. אימות Firebase ID token בצד-שרת (firebase-admin + service account ב-Vercel env).
//   2. הגבלת קצב פר-קבוצה (מניעת ניצול/עלות).
//   3. הפעלה מפורשת דרך משתנה סביבה (AI_COACH_ENABLED) — כבוי כברירת מחדל.
//   4. עדכון שם המודל לגרסה עדכנית.
// קוד ההיגיון המקורי נשמר למטה (לא נגיש) כנקודת התחלה לשלב 5.

export default async function handler(req, res) {
  return res.status(403).json({ error: "AI endpoint is disabled — will be rebuilt with authentication in a later phase." });

  // eslint-disable-next-line no-unreachable
  /* שלב 5 — לשחזר עם אימות והפעלה מבוקרת:
  if (process.env.AI_COACH_ENABLED !== "true") {
    return res.status(403).json({ error: "AI endpoint disabled" });
  }
  // TODO(שלב 5): לאמת Firebase ID token מ-Authorization header לפני כל קריאה.
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { system, messages, max_tokens } = req.body;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: max_tokens || 1000, system, messages }),
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
  */
}
