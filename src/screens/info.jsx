import { S } from "../styles/S";
import { WHATS_NEW } from "../lib/constants";

// ── HELP SCREEN ───────────────────────────────────────────────────────────────
function HelpScreen({ pc, sc, settings, onBack }) {
  const sections = [
    { icon: "📲", title: "התקנה על הנייד — מומלץ!", text: "אנדרואיד (Chrome): תפריט ⋮ ← 'הוסף למסך הבית'\nאייפון (Safari): כפתור שיתוף ↑ ← 'הוסף למסך הבית'\nכך האפליקציה תיפתח ישירות ומהר יותר!", featured: true },
    { icon: "👋", title: "כניסה ראשונה", text: "בכניסה הראשונה לחצי על שמך ברשימה. תתבקשי לבחור סיסמה אישית ולהוסיף תמונת פרופיל ופרטי קשר. מהפעם הבאה — רק סיסמה." },
    { icon: "✅", title: "אישור הגעה לאימון", text: "הכי מהר: ישר מהמסך הראשי — על כרטיס האימון/משחק הקרוב לחצי 'מגיעה' או 'לא מגיעה' וזה נשמר מיד. אפשר גם דרך המסך האישי, שם ניתן להוסיף הערה קצרה. ניתן לשנות תשובה בכל עת לפני האימון." },
    { icon: "📱", title: "התפריט התחתון", text: "הלשוניות נמצאות בתחתית המסך: נוכחות, לוח, צ'אט ותמונות. לחצי על 'עוד' כדי להגיע לתוצאות המשחקים ולסקרים. נקודה אדומה על הצ'אט = הודעות חדשות." },
    { icon: "🔔", title: "תזכורות לטלפון", text: "בלשונית 'נוכחות' יש כרטיס 'תזכורות לטלפון' — לחצי 'הפעילי' ואשרי התראות. אם טרם אישרת הגעה תקבלי תזכורת בערב שלפני (19:00) ובבוקר האירוע (10:00; המנהלת יכולה לשנות את השעות), והתראה מיידית אם אירוע בוטל. באייפון: קודם התקיני את האפליקציה למסך הבית (כפתור שיתוף ← הוסף למסך הבית) ורק אז הפעילי." },
    { icon: "👀", title: "מי מגיעה?", text: "לחצי על המספרים (מגיעות / לא מגיעות / טרם ענו) כדי לראות את שמות השחקניות בכל קטגוריה." },
    { icon: "📸", title: "תמונות מהמשחק", text: "בלשונית 'תמונות מהמשחק' ניתן להעלות תמונות מהאימון או המשחק — לחצי על '+ העלי תמונה'. כדי למחוק תמונה שהעלית: לחצי עליה ואז על 'מחקי תמונה'." },
    { icon: "🏆", title: "לוח משחקים", text: "בלשונית 'משחקים' תמצאי את לוח המשחקים העתידיים. לאחר המשחק יוצג גם התוצאה." },
    { icon: "👏", title: "מחיאות כפיים", text: "בלשונית 'אירוע' תוכלי לשלוח 'כל הכבוד' לחברות שהגיעו לאימון או המשחק האחרון — פעם ביום לכל אחת. בפרופיל שלך תראי כמה מחיאות כפיים קיבלת החודש!" },
    { icon: "🗳️", title: "סקר", text: "בלשונית 'סקר' תוכלי להצביע על נושאים שהמנהל פותח (למשל איפה לחגוג סוף עונה). ניתן לשנות את הבחירה, והתוצאות מוצגות מיד." },
    { icon: "🎂", title: "יום הולדת", text: "הוסיפי תאריך לידה בפרופיל, ותקבלי ברכה חמה מהקבוצה ביום ההולדת שלך! 🎉" },
    { icon: "🔑", title: "שכחת סיסמה?", text: "אין בעיה — פני למנהל/ת הקבוצה ויאפסו לך אותה. בכניסה הבאה תתבקשי לבחור סיסמה חדשה." },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "28px 20px 36px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        <div style={{ fontSize: 48 }}>❓</div>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: "8px 0 4px" }}>מדריך שימוש</h2>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: 0 }}>{settings.teamName}</p>
      </div>
      <div style={{ padding: 16 }}>
        {sections.map((sec, i) => (
          <div key={i} style={{ ...S.card, marginBottom: 10, display: "flex", gap: 12, alignItems: "flex-start", ...(sec.featured ? { border: "1px solid #e2e8f0", background: `${pc}08` } : {}) }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{sec.icon}</div>
            <div>
              <div style={{ fontWeight: 700, color: pc, fontSize: sec.featured ? 15 : 14, marginBottom: 4 }}>{sec.title}</div>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-line" }}>{sec.text}</div>
            </div>
          </div>
        ))}
        <div style={{ background: `${sc}30`, borderRadius: 14, padding: 16, textAlign: "center", marginTop: 8 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🏐</div>
          <div style={{ fontSize: 13, color: pc, fontWeight: 600 }}>שאלות? פני למנהל הקבוצה</div>
        </div>
      </div>
    </div>
  );
}

// ── ABOUT SCREEN ──────────────────────────────────────────────────────────────
function AboutScreen({ pc, sc, settings, onBack }) {
  const faq = [
    { q: "איך מתקינים את האפליקציה על הנייד?", a: "אנדרואיד (Chrome): תפריט ⋮ ← 'הוסף למסך הבית'. אייפון (Safari): כפתור שיתוף ↑ ← 'הוסף למסך הבית'. כך האפליקציה תיפתח ישירות ומהר יותר." },
    { q: "איך נכנסים בפעם הראשונה?", a: "לחצי על שמך ברשימה במסך הבית, בחרי סיסמה אישית (לפחות 6 תווים) והוסיפי פרטי קשר. מהפעם הבאה — רק שם וסיסמה." },
    { q: "שכחתי את הסיסמה — מה עושים?", a: "פני למנהלת הקבוצה, והיא תאפס לך אותה ותעביר לך סיסמה זמנית. בכניסה הבאה תתבקשי לבחור סיסמה חדשה משלך." },
    { q: "איך מאשרים הגעה לאימון?", a: "לחצי על שמך, ואז על 'מגיעה' או 'לא מגיעה'. אפשר להוסיף הערה, ואפשר לשנות את התשובה בכל עת לפני האימון." },
    { q: "איך רואים מי מגיעה?", a: "במסך הבית לחצי על המספרים (מגיעות / לא מגיעות / טרם ענו) כדי לראות את שמות השחקניות בכל קטגוריה." },
    { q: "איך שולחים הודעה בצ'אט?", a: "בלשונית '💬 צ'אט' כותבים הודעה ושולחים — כולן רואות מיד. נקודה אדומה מהבהבת ליד הצ'אט מסמנת שיש הודעות חדשות שלא קראת." },
    { q: "איפה רואים את תוצאות המשחקים?", a: "בלשונית '🏆 תוצאות משחקים' מופיעות תוצאות המשחקים שכבר התקיימו (ניצחון/הפסד/תיקו). משחק עתידי שדורש סימון הגעה מופיע בלשונית 'נוכחות' ובלוח." },
    { q: "איך רואים את כל האירועים הקרובים?", a: "בלשונית '🗓️ לוח', מתחת ללוח החודשי, יש מקרא עם הסוגים (🏋️ אימון · 🏆 משחק · 🎂 יום הולדת · ❌ בוטל). לחיצה על סוג פותחת רשימה של כל האירועים מאותו סוג. באימונים ובמשחקים מוצגים רק הקרובים (העתידיים), כשהקרוב ביותר ראשון." },
    { q: "מה זה מחיאות כפיים?", a: "בלשונית האירוע אפשר לשלוח 'כל הכבוד' לחברות שהגיעו לאימון או למשחק האחרון — פעם ביום לכל אחת. בפרופיל שלך תראי כמה מחיאות כפיים קיבלת החודש!" },
    { q: "איך מצביעים בסקר?", a: "בלשונית '🗳️ סקר' אפשר להצביע על נושאים שהמנהלת פותחת (למשל איפה לחגוג סוף עונה). ניתן לשנות את הבחירה, והתוצאות מוצגות מיד. אפשר גם ללחוץ על 'מי הצביעה' כדי לראות ליד כל אפשרות מי בחרה בה." },
    { q: "איך מקבלים ברכת יום הולדת?", a: "הוסיפי תאריך לידה בפרופיל שלך, ותקבלי ברכה חמה מהקבוצה ביום ההולדת! 🎉" },
    { q: "איך מעלים תמונה?", a: "בלשונית '📸 תמונות מהמשחק' לחצי על '+ העלי תמונה'. כדי למחוק תמונה שהעלית — לחצי עליה ואז על 'מחקי תמונה'." },
    { q: "הנתונים שלי מאובטחים?", a: "כן. לכל שחקנית חשבון אישי ומאובטח, וכל אחת רואה ועורכת רק את הפרטים שלה. הסיסמאות מאוחסנות בצורה מוצפנת ואינן גלויות לאיש." },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "28px 20px 36px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        <div style={{ fontSize: 48 }}>🏐</div>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: "8px 0 4px" }}>אודות</h2>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: 0 }}>{settings.teamName}</p>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ ...S.card, marginBottom: 14, textAlign: "center", padding: "20px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: pc, marginBottom: 4 }}>{settings.teamName || "הקבוצה שלי"}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>אפליקציה לניהול קבוצת הכדורשת</div>
          <div style={{ display: "inline-block", background: `${pc}10`, borderRadius: 10, padding: "8px 16px" }}>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>פותח על ידי</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: pc }}>אפי לוי</div>
          </div>
          <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 12 }}>{WHATS_NEW.versionName || `גרסה ${WHATS_NEW.version}`}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 4px 10px" }}>
          <span style={{ fontSize: 20 }}>❓</span>
          <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 16 }}>שאלות ותשובות</span>
        </div>
        {faq.map((item, i) => (
          <div key={i} style={{ ...S.card, marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: pc, fontSize: 14, marginBottom: 5 }}>{item.q}</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-line" }}>{item.a}</div>
          </div>
        ))}

        <div style={{ background: `${sc}30`, borderRadius: 14, padding: 16, textAlign: "center", marginTop: 8 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>💙</div>
          <div style={{ fontSize: 13, color: pc, fontWeight: 600 }}>תודה שאתן חלק מהקבוצה!</div>
        </div>
      </div>
    </div>
  );
}

// ── SHARED ────────────────────────────────────────────────────────────────────
export { HelpScreen, AboutScreen };
