// ── זהות קבוצה ────────────────────────────────────────────────────────────────
// בינלאומי = ברירת המחדל (שחקניות קיימות לא מושפעות). קבוצה אחרת מגיעה דרך ?team=XXXX.
const DEFAULT_TEAM = "bibleumi";
const BIBLEUMI_ADMIN_EMAILS = ["efil59@gmail.com", "miri.levi1962@gmail.com"]; // מנהלי קבוצת הבינלאומי
const SUPER_ADMIN_EMAIL = "efil59@gmail.com"; // בעל המוצר — גישה לסופר אדמין (רק הוא)
// פרטי יצירת קשר למסך "פתיחת קבוצה" (מנהלת חדשה ללא הזמנה). ⚠️ אפי — מלא כאן את מספר הוואטסאפ שלך:
const OWNER_CONTACT_EMAIL = "efil59@gmail.com";
const OWNER_CONTACT_WHATSAPP = ""; // לדוגמה: "972501234567" (קוד מדינה ללא +). ריק = לא יוצג כפתור וואטסאפ.
// ── מסחור (שלב 5): ניסיון חינם + תשלום בביט ──────────────────────────────────
const TRIAL_DAYS = 14; // אורך תקופת הניסיון לקבוצה חדשה
const PAYMENT = {
  priceText: "₪39 לחודש לקבוצה",   // ⚠️ אפי — אשר/עדכן את המחיר
  bitPhone: "052-4473685",           // ביט של אפי
};

// Google Analytics 4 — מזהה מדידה (G-XXXXXXXXXX) מ-analytics.google.com.
// ריק = כבוי לחלוטין (לא נטען סקריפט, לא נשמרות עוגיות) — ברירת מחדל בטוחה לפרטיות.
const GA_MEASUREMENT_ID = "";

// מפתח Web Push ציבורי (VAPID) — נוצר ב-Firebase Console ← Cloud Messaging ← Web Push certificates.
// ציבורי בעיצובו (מוטמע בכל אתר). ריק = כפתור התזכורות מוסתר (הפיצ'ר כבוי).
const VAPID_PUBLIC_KEY = "BFR1srx9sLjwoIACSvzHrZxJioEdOUyOfOwq3Tm57x1ZRpEq3LSmst1uIv2dpQa8Hx8gyJC0UTRpdM19ESC_I7w";

const KEYS = {
  players: "players",
  events: "events",
  attendance: "attendance",
  notifications: "notifications",
  settings: "settings",
  archive: "archive",
  games: "games",
  gallery: "gallery",
  playerProfiles: "profiles",
  installVersion: "installVersion",
  applause: "applause",
  polls: "polls",
  personalNotifs: "personalNotifs",
  chat: "chat",
  whatsNewVersion: "whatsNewVersion",
  meta: "meta",
  tournaments: "tournaments",
};

const DEFAULT_SETTINGS = {
  teamName: "קבוצת הכדורשת של הבנק הבינלאומי",
  primaryColor: "#1a237e",
  secondaryColor: "#f5c842",
  defaultTrainingLocation: "ביה\"ס מקיף עירוני ט' ת\"א",
  defaultGameLocation: "אולם ספורט עירוני",
  whatsappGroup: "https://chat.whatsapp.com/BQFmLoO8PU4A3kdXSkIJ6U?s=hd&p=i&mlu=3",
  captainPassword: "1234",
};

// "מה חדש" — מתעדכן עם כל גרסה. version עולה ב-1 בכל שחרור פיצ'רים.
// בלוק אחד בלבד — העדכון המשמעותי האחרון, לא היסטוריה. העלאת version פותחת את
// החלון פעם אחת לכל מכשיר. (20 → 21: החלקה בין המסכים, 8.10.26, אפי: "שווה הכרזה")
const WHATS_NEW = {
  version: 21,
  versionName: "גרסה 21.0",
  date: "אוקטובר 2026",
  features: [
    { icon: "👆", title: "מחליקים בין המסכים", text: "מעכשיו אפשר לעבור בין הלשוניות בהחלקת אצבע ימינה ושמאלה — נוכחות, לוח, תוצאות, צ'אט וכל השאר, כולל מה שנמצא ב'עוד'. הסרגל שלמטה ממשיך לעבוד כרגיל." },
  ],
};

const DEFAULT_PLAYERS = [
  { id: 1, name: "מירי", phone: "", email: "", address: "", whatsapp: "" },
  { id: 2, name: "ויקי", phone: "", email: "", address: "", whatsapp: "" },
  { id: 3, name: "איילה", phone: "", email: "", address: "", whatsapp: "" },
  { id: 4, name: "דנה", phone: "", email: "", address: "", whatsapp: "" },
  { id: 5, name: "מיכל", phone: "", email: "", address: "", whatsapp: "" },
  { id: 6, name: "נטלי", phone: "", email: "", address: "", whatsapp: "" },
  { id: 7, name: "נטע", phone: "", email: "", address: "", whatsapp: "" },
  { id: 8, name: "סיגי", phone: "", email: "", address: "", whatsapp: "" },
  { id: 9, name: "רונית", phone: "", email: "", address: "", whatsapp: "" },
  { id: 10, name: "ציפי", phone: "", email: "", address: "", whatsapp: "" },
  { id: 11, name: "שרונה", phone: "", email: "", address: "", whatsapp: "" },
  { id: 12, name: "קרן", phone: "", email: "", address: "", whatsapp: "" },
  { id: 13, name: "עדית", phone: "", email: "", address: "", whatsapp: "" },
];

const DEFAULT_EVENTS = [
  { id: 1, type: "training", date: "2026-05-13", time: "19:00", location: "אולם ספורט הבנק הבינלאומי", note: "", open: true },
];

const DEFAULT_GAMES = [
  { id: 1, date: "2026-05-20", time: "18:00", opponent: "מכבי תל אביב", location: "אולם עירוני", result: null },
  { id: 2, date: "2026-06-03", time: "19:00", opponent: "הפועל ירושלים", location: "אולם ספורט הבנק הבינלאומי", result: null },
];
export { DEFAULT_TEAM, BIBLEUMI_ADMIN_EMAILS, SUPER_ADMIN_EMAIL, OWNER_CONTACT_EMAIL, OWNER_CONTACT_WHATSAPP, VAPID_PUBLIC_KEY, GA_MEASUREMENT_ID, TRIAL_DAYS, PAYMENT, KEYS, DEFAULT_SETTINGS, WHATS_NEW, DEFAULT_PLAYERS, DEFAULT_EVENTS, DEFAULT_GAMES };
