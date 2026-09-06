import { useState, useEffect } from "react";
import { S } from "../styles/S";
import { pushSupport, pushEnabledLocally, enablePush, disablePush } from "../lib/push";
import { testPushRemote } from "../lib/db";

// ── כרטיס "תזכורות" — הפעלה/ביטול של Web Push במכשיר הנוכחי ──────────────────
// role: "player" | "admin". לשחקנית: תזכורת לפני אימון/משחק אם טרם אישרה.
// למנהלת: גם סיכום הגעה בבוקר האירוע. מוצג רק כשהפיצ'ר מוגדר (VAPID קיים).
// הזרימה: לחיצה על "הפעילי" ← מסך-הכנה ("הטלפון ישאל — לחצי אפשר") ← השאלה של
// הדפדפן. ההכנה קריטית: בלי הסבר, חלק מהמשתמשות דוחות את השאלה ונחסמות.
export default function ReminderCard({ role, playerId, pc, notify, hideWhenOn, onEnabled }) {
  const who = role === "admin" ? "admin" : `p${playerId}`;
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(() => pushEnabledLocally(who));
  const [explain, setExplain] = useState(false); // מסך-ההכנה לפני שאלת הדפדפן
  const [, setRecheck] = useState(0);            // "בדקי שוב" אחרי שחרור חסימה
  // שלב הבדיקה: מוצג מיד אחרי הפעלה מוצלחת. "הופעל" הוא הבטחה, התראה שמגיעה
  // בפועל היא הוכחה — ובדיוק ההבדל הזה נשבר בשטח (הכרטיס הציג "פעיל" בזמן
  // שהטוקן בשרת נדרס, ואף התראה לא הגיעה).
  const [justOn, setJustOn] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState(null);   // "sent" | "none" | "fail"
  const [testErr, setTestErr] = useState("");     // קוד השגיאה, לאבחון
  const support = pushSupport();

  // ── ריפוי-עצמי של הרישום בשרת ────────────────────────────────────────────
  // הדגל ב-localStorage אומר רק "אישרה פעם במכשיר הזה". הוא לא יודע אם מסמך
  // הטוקן בשרת עדיין קיים, ועדיין נושא את התפקיד הזה. שני דברים מפילים אותו
  // בשקט: טוקן FCM שמתחלף מעצמו, והפעלה בתפקיד השני מאותו מכשיר (עד 5.9.26
  // ה-setDoc דרס את התפקיד הקודם). התוצאה הייתה הגרועה מכולן — הכרטיס מציג
  // "פעיל", ולכן לעולם לא נרשם מחדש, ואף התראה לא מגיעה.
  // הרישום אידמפוטנטי, ו-requestPermission חוזר מיד כשההרשאה כבר ניתנה, אז
  // אין כאן שאלה נוספת למשתמשת. חייב להיות מעל ה-return המותנה שמתחת.
  useEffect(() => {
    if (support === "no-vapid" || support === "unsupported") return;
    if (!pushEnabledLocally(who)) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    enablePush(role, playerId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (support === "no-vapid" || support === "unsupported") return null; // הפיצ'ר כבוי/לא נתמך — לא מציקים
  if (on && hideWhenOn) return null; // כבר פעיל → אין מה להציג (הביטול זמין בעריכת פרופיל)

  const label = role === "admin"
    ? "תזכורות למנהלת: סיכום הגעה בבוקר כל אימון/משחק, ישירות לטלפון."
    : "קבלי תזכורת לטלפון לפני כל אימון/משחק — גם כשהאפליקציה סגורה.";

  async function reallyEnable() {
    setExplain(false);
    setBusy(true);
    const res = await enablePush(role, playerId);
    if (res.ok) {
      setOn(true);
      // בכוונה לא סוגרים כאן את חלון ההנעה: קודם שלב הבדיקה, וממנו סוגרים.
      if (role === "player") setJustOn(true);
      else { onEnabled && onEnabled(); notify && notify("התזכורות הופעלו במכשיר הזה 🔔", { icon: "🔔", okLabel: "מעולה" }); }
    } else if (res.reason === "denied") {
      setRecheck(x => x + 1); // יציג את כרטיס ה"חסום" עם ההוראות
    } else if (res.reason !== "dismissed") {
      notify && notify("הפעלת התזכורות נכשלה. נסי שוב מאוחר יותר.", { icon: "⚠️" });
    }
    setBusy(false);
  }

  async function sendTest() {
    setTesting(true);
    const r = await testPushRemote(playerId);
    // permission-denied הוא מצב משלו: המכשיר מחובר לחשבון אחר (למשל מנהלת
    // שפתחה את המסך של שחקנית). זו ההגנה עובדת, לא תקלה — ואסור שתיראה ככשל.
    const denied = String(r.reason || "").includes("permission-denied");
    setTestRes(r.ok && r.sent > 0 ? "sent" : r.reason === "no-tokens" ? "none" : denied ? "other" : "fail");
    setTestErr(r.ok ? "" : String(r.reason || ""));
    setTesting(false);
  }

  async function turnOff() {
    setBusy(true);
    await disablePush(role, playerId);
    setOn(false);
    setBusy(false);
  }

  // שלב הבדיקה — אחרי הפעלה מוצלחת, לפני שסוגרים
  if (justOn) {
    return (
      <div style={{ ...S.card }}>
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 34 }}>🔔</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#166534" }}>ההתראות הופעלו!</div>
          <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
            רוצה לוודא שזה באמת עובד? שלחי לעצמך התראה עכשיו.
          </div>
        </div>
        {testRes === "sent" && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 12px", marginBottom: 8, fontSize: 13, color: "#166534", fontWeight: 700, textAlign: "center", lineHeight: 1.5 }}>
            ✓ נשלחה! הסתכלי על ההתראות בטלפון.<br />
            <span style={{ fontWeight: 500, fontSize: 12 }}>לא רואה? ייתכן שהיא מוסתרת כי האפליקציה פתוחה — נעלי את המסך ונסי שוב.</span>
          </div>
        )}
        {testRes === "none" && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", marginBottom: 8, fontSize: 13, color: "#92400e", fontWeight: 600, textAlign: "center", lineHeight: 1.5 }}>
            המכשיר עדיין לא רשום אצלנו. נסי לסגור ולפתוח את האפליקציה, ואז שוב.
          </div>
        )}
        {testRes === "fail" && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 12px", marginBottom: 8, fontSize: 13, color: "#b91c1c", fontWeight: 600, textAlign: "center" }}>
            השליחה נכשלה. אפשר לנסות שוב בעוד רגע.
            {testErr && <div style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 500, marginTop: 3, direction: "ltr" }}>{testErr}</div>}
          </div>
        )}
        {testRes === "other" && (
          <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", marginBottom: 8, fontSize: 13, color: "#475569", fontWeight: 600, textAlign: "center", lineHeight: 1.5 }}>
            המכשיר הזה מחובר לחשבון אחר, אז אי אפשר לשלוח מכאן. הבדיקה עובדת מהטלפון של השחקנית עצמה.
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={sendTest} disabled={testing}
            style={{ flex: 1.3, padding: 12, borderRadius: 10, border: "none", cursor: testing ? "default" : "pointer", fontSize: 14, fontWeight: 800, background: testing ? "#cbd5e1" : pc, color: "white" }}>
            {testing ? "שולחת..." : testRes ? "🔔 שלחי שוב" : "🔔 שלחי לי התראת בדיקה"}
          </button>
          <button onClick={() => { setJustOn(false); onEnabled && onEnabled(); }}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: "#f1f5f9", color: "#64748b" }}>
            {testRes === "sent" ? "סיימתי" : "דלגי"}
          </button>
        </div>
      </div>
    );
  }

  if (support === "ios-install") {
    return (
      <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ fontSize: 26, flexShrink: 0 }}>🔔</div>
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
          <b>רוצה תזכורות לטלפון?</b> באייפון זה עובד רק מהאפליקציה המותקנת:
          כפתור שיתוף ↑ ← "הוסף למסך הבית", ואז הפעילי תזכורות מכאן.
        </div>
      </div>
    );
  }

  // חסום: הסבר צעד-צעד המותאם למצב המכשיר — אפליקציה מותקנת (אין שורת כתובת/מנעול!)
  // מול דפדפן רגיל. עם "בדקי שוב" למי שתיקנה את ההגדרה.
  if (support === "denied" && !on) {
    const standalone = (() => {
      try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; }
      catch { return false; }
    })();
    return (
      <div style={{ ...S.card }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ fontSize: 26, flexShrink: 0 }}>🔕</div>
          <div style={{ fontSize: 13.5, color: "#1e293b", fontWeight: 700, lineHeight: 1.5 }}>
            ההתראות חסומות במכשיר הזה — ככה פותחים אותן:
          </div>
        </div>
        {standalone ? (
          <>
            <ol style={{ fontSize: 13, color: "#475569", lineHeight: 1.8, margin: "0 0 8px", paddingRight: 22 }}>
              <li>פתחי את <b>הדפדפן</b> בטלפון (כרום / אדג' — זה שממנו התקנת)</li>
              <li>תפריט <b>⋮ או ⋯</b> ← <b>הגדרות</b> ← <b>הרשאות אתרים</b> (Site permissions) ← <b>התראות</b></li>
              <li>מצאי ברשימה את <b style={{ direction: "ltr", unicodeBidi: "embed" }}>{window.location.hostname}</b> ← <b>אפשרי</b></li>
              <li>חזרי לכאן ולחצי "בדקי שוב"</li>
            </ol>
            <p style={{ fontSize: 11.5, color: "#94a3b8", margin: "0 0 10px", lineHeight: 1.5 }}>
              עדיין לא עובד? ודאי גם בהגדרות הטלפון ← אפליקציות ← הדפדפן שלך ← התראות — מופעל.
            </p>
          </>
        ) : (
          <>
            <ol style={{ fontSize: 13, color: "#475569", lineHeight: 1.8, margin: "0 0 8px", paddingRight: 22 }}>
              <li>לחצי על סמל <b>🔒 המנעול</b> (או ⓘ) ליד הכתובת למעלה</li>
              <li>בחרי <b>הרשאות ← התראות ← אפשרי</b></li>
              <li>חזרי לכאן ולחצי "בדקי שוב"</li>
            </ol>
            <p style={{ fontSize: 11.5, color: "#94a3b8", margin: "0 0 10px", lineHeight: 1.5 }}>
              לא רואה מנעול? תפריט הדפדפן (⋮ או ⋯) ← הגדרות ← הרשאות אתרים ← התראות ← אפשרי לאתר הזה.
            </p>
          </>
        )}
        <button onClick={() => setRecheck(x => x + 1)}
          style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 800, background: pc, color: "white" }}>
          ✓ פתחתי — בדקי שוב
        </button>
      </div>
    );
  }

  // מסך-ההכנה: מסביר מה עומד לקרות לפני שהדפדפן שואל
  if (explain) {
    return (
      <div style={{ ...S.card, border: `2px solid ${pc}`, background: `${pc}06` }}>
        <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🔔</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 6 }}>עוד רגע הטלפון ישאל אותך</div>
          <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, margin: "0 0 14px" }}>
            תופיע שאלה אם לאפשר התראות —<br />
            <b style={{ color: pc }}>חשוב ללחוץ "אפשר" (Allow) 👍</b><br />
            בלי זה התזכורות לא יגיעו.
          </p>
          <button onClick={reallyEnable} disabled={busy}
            style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: busy ? "default" : "pointer", fontSize: 15, fontWeight: 800, background: busy ? "#94a3b8" : pc, color: "white", marginBottom: 8 }}>
            {busy ? "רגע…" : "הבנתי, שאלי אותי ←"}
          </button>
          <button onClick={() => setExplain(false)} style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", padding: 6 }}>
            אולי אחר כך
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ fontSize: 26, flexShrink: 0 }}>{on ? "🔔" : "🔕"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{on ? "תזכורות פעילות במכשיר הזה" : "תזכורות לטלפון"}</div>
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginTop: 2 }}>{label}</div>
        {on && role === "player" && (
          <div style={{ marginTop: 5 }}>
            <button onClick={sendTest} disabled={testing}
              style={{ background: "transparent", border: "none", padding: 0, color: pc, fontSize: 12, fontWeight: 700, cursor: testing ? "default" : "pointer", textDecoration: "underline" }}>
              {testing ? "שולחת…" : "🔔 שלחי לי התראת בדיקה"}
            </button>
            {testRes === "sent" && <div style={{ fontSize: 11.5, color: "#166534", fontWeight: 700, marginTop: 3, lineHeight: 1.45 }}>✓ נשלחה — הסתכלי על ההתראות. לא רואה? נעלי את המסך ונסי שוב.</div>}
            {testRes === "none" && <div style={{ fontSize: 11.5, color: "#b45309", fontWeight: 700, marginTop: 3, lineHeight: 1.45 }}>המכשיר לא רשום אצלנו. בטלי והפעילי מחדש.</div>}
            {testRes === "other" && <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600, marginTop: 3, lineHeight: 1.45 }}>המכשיר מחובר לחשבון אחר — הבדיקה עובדת מהטלפון של השחקנית עצמה.</div>}
            {testRes === "fail" && (
              <div style={{ fontSize: 11.5, color: "#b91c1c", fontWeight: 700, marginTop: 3 }}>
                השליחה נכשלה. נסי שוב בעוד רגע.
                {testErr && <span style={{ color: "#94a3b8", fontWeight: 500, direction: "ltr" }}> ({testErr})</span>}
              </div>
            )}
          </div>
        )}
      </div>
      <button onClick={() => (on ? turnOff() : setExplain(true))} disabled={busy}
        style={{ flexShrink: 0, padding: "9px 16px", borderRadius: 10, border: "none", cursor: busy ? "default" : "pointer", fontSize: 13, fontWeight: 800,
          background: busy ? "#94a3b8" : on ? "#f1f5f9" : pc, color: on ? "#64748b" : "white" }}>
        {busy ? "רגע…" : on ? "בטלי" : "הפעילי 🔔"}
      </button>
    </div>
  );
}
