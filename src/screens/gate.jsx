import { useState } from "react";
import { WHATS_NEW, OWNER_CONTACT_EMAIL, OWNER_CONTACT_WHATSAPP } from "../lib/constants";
import { isGoogleUser } from "../lib/auth";
import { PurchaseBanner } from "../components/shared";

// ── INSTALL SCREEN ───────────────────────────────────────────────────────────
// מוצג בכל כניסה מהדפדפן עד שמתקינות (standalone). באנדרואיד/כרום יש כפתור
// התקנה אמיתי בלחיצה אחת (beforeinstallprompt שנלכד ב-main.jsx); באייפון — הוראות.
function InstallScreen({ pc, sc, onDone, installVersion }) {
  const [installing, setInstalling] = useState(false);
  const canOneClick = !!window.__installPrompt;

  async function oneClickInstall() {
    const ev = window.__installPrompt;
    if (!ev) return;
    setInstalling(true);
    try {
      ev.prompt();
      const choice = await ev.userChoice;
      if (choice && choice.outcome === "accepted") {
        window.__installPrompt = null;
        onDone(installVersion); // הותקן — ממשיכים; בפתיחה הבאה מהאייקון המסך לא יופיע
        return;
      }
    } catch { /* ignore */ }
    setInstalling(false);
  }

  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: pc, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28 }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>📲</div>
      <h2 style={{ color: "white", fontSize: 22, fontWeight: 800, margin: "0 0 10px", textAlign: "center" }}>התקיני את האפליקציה!</h2>
      <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, textAlign: "center", lineHeight: 1.7, margin: "0 0 18px", maxWidth: 320 }}>
        פתיחה מהירה מהמסך הבית — <strong style={{ color: sc }}>וחובה כדי לקבל תזכורות 🔔 לאימונים ולמשחקים</strong>
      </p>
      {canOneClick ? (
        <button onClick={oneClickInstall} disabled={installing}
          style={{ background: sc, color: pc, border: "none", borderRadius: 14, padding: "16px 40px", fontSize: 17, fontWeight: 800, cursor: installing ? "default" : "pointer", marginBottom: 18, width: "100%", maxWidth: 320, boxShadow: "0 6px 24px rgba(0,0,0,0.3)" }}>
          {installing ? "מתקינה…" : "⚡ התקיני עכשיו בלחיצה אחת"}
        </button>
      ) : (
        <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 16, padding: "18px 22px", width: "100%", maxWidth: 320, marginBottom: 20 }}>
          <div style={{ color: "white", fontSize: 14, lineHeight: 2 }}>
            <div>🍎 <strong>אייפון (Safari):</strong></div>
            <div style={{ paddingRight: 22, color: "rgba(255,255,255,0.85)" }}>כפתור שיתוף ↑ ← הוסף למסך הבית</div>
            <div style={{ marginTop: 10 }}>📱 <strong>אנדרואיד (Chrome):</strong></div>
            <div style={{ paddingRight: 22, color: "rgba(255,255,255,0.85)" }}>תפריט ⋮ ← הוסף למסך הבית</div>
          </div>
        </div>
      )}
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center", margin: "0 0 14px", maxWidth: 300, lineHeight: 1.6 }}>
        אחרי ההתקנה — פתחי את האפליקציה מהאייקון 🏐 במסך הבית, והתזכורת הזו תיעלם.
      </p>
      <button onClick={() => onDone(installVersion)} style={{ background: "transparent", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 12, fontSize: 13, cursor: "pointer", padding: "10px 24px", fontWeight: 600 }}>
        אמשיך בדפדפן בינתיים ←
      </button>
    </div>
  );
}

// ── WHAT'S NEW SCREEN ─────────────────────────────────────────────────────────
function WhatsNewScreen({ pc, sc, onDone }) {
  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: `linear-gradient(170deg, ${pc}, ${pc}dd)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 24, padding: "30px 24px", maxWidth: 360, width: "100%", boxShadow: "0 24px 70px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 56 }}>✨</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: pc, margin: "6px 0 2px" }}>מה חדש?</h2>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${sc}40`, borderRadius: 20, padding: "4px 14px", marginTop: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: pc }}>{WHATS_NEW.versionName}</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>• {WHATS_NEW.date}</span>
          </div>
        </div>

        {WHATS_NEW.features.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 0", borderBottom: i < WHATS_NEW.features.length - 1 ? "1px solid #f1f5f9" : "none" }}>
            <div style={{ fontSize: 30, flexShrink: 0 }}>{f.icon}</div>
            <div>
              <div style={{ fontWeight: 800, color: "#1e293b", fontSize: 15, marginBottom: 2 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{f.text}</div>
            </div>
          </div>
        ))}

        <button onClick={onDone} style={{ width: "100%", marginTop: 22, padding: 15, background: pc, color: "white", border: "none", borderRadius: 14, cursor: "pointer", fontSize: 16, fontWeight: 800 }}>
          מגניב! בואו נתחיל 🏐
        </button>
      </div>
    </div>
  );
}

// ── LOCKED TEAM (קבוצה pending — נעולה לשחקניות עד אישור) ─────────────────────
function LockedTeamScreen({ pc, sc, settings, onAdmin }) {
  const teamName = settings?.teamName || "הקבוצה";
  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: pc, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 8 }}>🔒</div>
      <h2 style={{ color: "white", fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>{teamName}</h2>
      <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>הקבוצה עדיין לא פעילה</p>
      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.6, maxWidth: 320, margin: "0 0 24px" }}>
        מנהל/ת הקבוצה בתהליך הקמה. ברגע שהקבוצה תופעל — תוכלי להיכנס ולסמן הגעה. נסי שוב מאוחר יותר 🏐
      </p>
      <button onClick={onAdmin} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
        כניסת מנהל/ת
      </button>
    </div>
  );
}

// ── SPLASH ────────────────────────────────────────────────────────────────────
function Splash({ pc, sc }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: pc }}>
      <style>{`
        @keyframes splashFloat {
          0%, 100% { transform: translateY(0) rotate(-6deg); }
          50%      { transform: translateY(-22px) rotate(6deg); }
        }
        @keyframes splashShadow {
          0%, 100% { transform: scaleX(1);   opacity: 0.28; }
          50%      { transform: scaleX(0.62); opacity: 0.14; }
        }
        @keyframes splashShimmer {
          0%   { transform: translateX(-130%); }
          100% { transform: translateX(130%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-ball, .splash-shadow, .splash-shimmer { animation: none !important; }
        }
      `}</style>
      <div className="splash-ball" style={{ fontSize: 84, userSelect: "none", animation: "splashFloat 1.4s ease-in-out infinite", willChange: "transform" }}>🏐</div>
      <div className="splash-shadow" style={{ width: 64, height: 11, background: "rgba(0,0,0,0.5)", borderRadius: "50%", marginTop: 6, filter: "blur(3px)", animation: "splashShadow 1.4s ease-in-out infinite" }} />
      <div style={{ position: "relative", width: 120, height: 5, background: "rgba(255,255,255,0.18)", borderRadius: 3, marginTop: 30, overflow: "hidden" }}>
        <div className="splash-shimmer" style={{ position: "absolute", top: 0, bottom: 0, width: "55%", background: sc, borderRadius: 3, animation: "splashShimmer 1.1s ease-in-out infinite" }} />
      </div>
    </div>
  );
}


// ── NO-INVITE (מנהלת חדשה ללא הזמנה — מסך "פתיחת קבוצה") ──────────────────────
function NoInviteScreen({ pc, sc, authUser, onLogout, onBack }) {
  const email = (authUser && authUser.email) || "";
  const waLink = OWNER_CONTACT_WHATSAPP
    ? `https://wa.me/${OWNER_CONTACT_WHATSAPP}?text=${encodeURIComponent(`היי, אני רוצה לפתוח קבוצת כדורשת באפליקציה. כתובת ה-Gmail שלי: ${email}`)}`
    : "";
  const mailLink = `mailto:${OWNER_CONTACT_EMAIL}?subject=${encodeURIComponent("בקשה לפתיחת קבוצה")}&body=${encodeURIComponent(`היי, אני רוצה לפתוח קבוצת כדורשת. כתובת ה-Gmail שלי: ${email}`)}`;
  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 20, padding: "30px 24px", width: "100%", maxWidth: 360, boxShadow: "0 12px 40px rgba(0,0,0,0.2)", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>🏐</div>
        <h2 style={{ fontSize: 21, fontWeight: 800, color: pc, margin: "10px 0 6px" }}>פתיחת קבוצה חדשה</h2>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: "0 0 14px" }}>
          כדי לפתוח קבוצה חדשה, יש ליצור קשר. לאחר האישור — תוכלי להיכנס ולהקים את הקבוצה שלך.
        </p>
        <div style={{ background: "#fef9c3", borderRadius: 10, padding: "9px 12px", margin: "0 0 18px", fontSize: 12.5, color: "#854d0e", lineHeight: 1.5 }}>
          💳 השירות כרוך בעלות חודשית. הפרטים יימסרו בפנייה.
        </div>
        <div style={{ background: "#f1f5f9", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: "#64748b", margin: "0 0 18px", lineHeight: 1.5 }}>
          חשוב: יש להיכנס עם <strong>אותה כתובת Gmail</strong> שתמסרי. הכתובת שלך כעת:<br />
          <strong style={{ color: pc, wordBreak: "break-all" }}>{email || "—"}</strong>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ background: "#25D366", color: "white", borderRadius: 12, padding: "13px", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>📱 פנייה בוואטסאפ</a>
          )}
          <a href={mailLink} style={{ background: pc, color: "white", borderRadius: 12, padding: "13px", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>✉️ פנייה במייל</a>
        </div>
        <button onClick={() => onLogout ? onLogout() : onBack()} style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", marginTop: 16, width: "100%" }}>← חזרה / התנתקות</button>
      </div>
    </div>
  );
}

// ── מסך רכישה (מנהלת חדשה שרוצה לפתוח קבוצה) — מסביר, ורק באישור מפורש שולח בקשה ──
function PurchaseScreen({ pc, sc, authUser, onGoogle, onContinue, onBack }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const alreadyGoogle = isGoogleUser(authUser);
  async function go(fn) {
    setBusy(true); setErr("");
    const res = await fn();
    if (res && !res.ok && res.error) setErr(res.error);
    setBusy(false);
  }
  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: `linear-gradient(160deg, ${pc}, ${pc}dd)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ textAlign: "center", fontSize: 46 }}>🏐</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: pc, textAlign: "center", margin: "8px 0 4px" }}>אפליקציה לקבוצה שלך</h2>
        <p style={{ fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 1.6, margin: "0 0 18px" }}>
          כל מה שצריך לניהול קבוצת כדורשת במקום אחד:
        </p>
        <div style={{ background: "#f8fafc", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          {[["✅", "וידוא הגעה לאימונים ומשחקים"], ["📊", "סטטיסטיקות ודירוג שחקניות"], ["💬", "צ'אט קבוצתי, סקרים ותזכורות"], ["🏆", "לוח משחקים וגלריית תמונות"]].map(([ic, tx]) => (
            <div key={tx} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#334155", padding: "4px 0" }}>
              <span style={{ fontSize: 17 }}>{ic}</span><span>{tx}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#fef9c3", borderRadius: 10, padding: "10px 14px", margin: "0 0 18px", fontSize: 13, color: "#854d0e", lineHeight: 1.5, textAlign: "center" }}>
          💳 השירות כרוך בעלות חודשית. הפרטים יימסרו לאחר אישור הבקשה.
        </div>
        <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", margin: "0 0 14px", lineHeight: 1.5 }}>
          כדי לבקש לפתוח קבוצה, התחברי עם חשבון Google שלך. <strong>הבקשה תישלח רק לאחר אישורך במסך הבא.</strong>
        </p>
        {err && <div style={{ background: "#fee2e2", color: "#b91c1c", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{err}</div>}
        {alreadyGoogle ? (
          <button disabled={busy} onClick={() => go(onContinue)} style={{ width: "100%", background: pc, color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 800, cursor: busy ? "default" : "pointer", marginBottom: 10 }}>
            {busy ? "רגע…" : `המשיכי כ-${authUser.email}`}
          </button>
        ) : (
          <button disabled={busy} onClick={() => go(onGoogle)} style={{ width: "100%", background: pc, color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 800, cursor: busy ? "default" : "pointer", marginBottom: 10 }}>
            {busy ? "רגע…" : "התחברי עם Google"}
          </button>
        )}
        <button onClick={onBack} style={{ width: "100%", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>חזרה</button>
      </div>
    </div>
  );
}

// ── מבוי-סתום מנומס: "כניסת מנהל" של חשבון לא-משויך. לא נשלחה בקשה. דרך קדימה לרכישה. ──
function NotRegisteredScreen({ pc, sc, authUser, onPurchase, onLogout, onBack }) {
  const email = (authUser && authUser.email) || "";
  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 20, padding: "30px 24px", width: "100%", maxWidth: 360, boxShadow: "0 12px 40px rgba(0,0,0,0.2)", textAlign: "center" }}>
        <div style={{ fontSize: 46 }}>🔍</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: pc, margin: "10px 0 6px" }}>החשבון אינו משויך לקבוצה</h2>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: "0 0 14px" }}>
          החשבון <strong style={{ color: pc, wordBreak: "break-all" }}>{email || "—"}</strong> אינו מנהל של קבוצה קיימת.
        </p>
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "12px 14px", margin: "0 0 18px", fontSize: 13, color: "#0c4a6e", lineHeight: 1.5 }}>
          מעוניינת לפתוח קבוצה משלך? אפשר לרכוש את האפליקציה ולהקים קבוצה.
        </div>
        <button onClick={onPurchase} style={{ width: "100%", background: pc, color: "white", border: "none", borderRadius: 12, padding: "13px", fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 10 }}>
          🏐 לפרטים על פתיחת קבוצה ←
        </button>
        <button onClick={() => onLogout ? onLogout() : onBack()} style={{ width: "100%", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>יציאה</button>
      </div>
    </div>
  );
}

// ── LANDING (שער ראשי — כניסה לכתובת חשופה בלי ?team=) ────────────────────────
function LandingScreen({ pc, sc, onAdminLogin, onPurchase, onEnterBibleumi }) {
  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: `linear-gradient(160deg, ${pc}, ${pc}dd)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 60 }}>🏐</div>
        <h1 style={{ color: "white", fontSize: 26, fontWeight: 800, margin: "10px 0 6px" }}>אפליקציית כדורשת</h1>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>
          ניהול קבוצה במקום אחד: וידוא הגעה, סטטיסטיקות, צ'אט קבוצתי, תזכורות ועוד.
        </p>
      </div>

      <div style={{ background: "white", borderRadius: 20, padding: "24px 22px", width: "100%", maxWidth: 360, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
        <button onClick={onAdminLogin} style={{ width: "100%", background: pc, color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 12 }}>
          🔑 כניסת מנהל/ת
        </button>

        <button onClick={onEnterBibleumi} style={{ width: "100%", background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
          כניסה לקבוצת הבינלאומי ←
        </button>

        <PurchaseBanner pc={pc} sc={sc} onClick={onPurchase} />

        <p style={{ fontSize: 11.5, color: "#94a3b8", textAlign: "center", margin: "16px 0 0", lineHeight: 1.5 }}>
          שחקנית בקבוצה אחרת? היכנסי דרך הקישור שקיבלת מהמנהלת שלך.
        </p>
      </div>
    </div>
  );
}

// ── PENDING REQUEST (מנהלת נכנסה — בקשתה נרשמה אוטומטית, ממתינה לאישור הסופר-אדמין) ──
function PendingRequestScreen({ pc, sc, authUser, onLogout, onBack }) {
  const email = (authUser && authUser.email) || "";
  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 20, padding: "30px 24px", width: "100%", maxWidth: 360, boxShadow: "0 12px 40px rgba(0,0,0,0.2)", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>⏳</div>
        <h2 style={{ fontSize: 21, fontWeight: 800, color: pc, margin: "10px 0 6px" }}>הבקשה שלך נשלחה!</h2>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: "0 0 14px" }}>
          קיבלנו את בקשתך לפתוח קבוצה. לאחר אישור — תוכלי להיכנס שוב ולהקים את הקבוצה שלך.
        </p>
        <div style={{ background: "#f1f5f9", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: "#64748b", margin: "0 0 14px", lineHeight: 1.5 }}>
          נרשמה בקשה עבור:<br />
          <strong style={{ color: pc, wordBreak: "break-all" }}>{email || "—"}</strong>
        </div>
        <div style={{ background: "#fef9c3", borderRadius: 10, padding: "9px 12px", margin: "0 0 18px", fontSize: 12.5, color: "#854d0e", lineHeight: 1.5 }}>
          💳 השירות כרוך בעלות חודשית. פרטים יימסרו עם האישור.
        </div>
        <button onClick={() => onLogout ? onLogout() : onBack()} style={{ background: pc, color: "white", border: "none", borderRadius: 12, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" }}>הבנתי, אצא כעת</button>
      </div>
    </div>
  );
}

// ── ADMIN LOGIN ───────────────────────────────────────────────────────────────
function AdminLogin({ pc, sc, onGoogle, onContinue, authUser, onBack, initialError }) {
  const [gLoading, setGLoading] = useState(false); const [gError, setGError] = useState(initialError || "");
  const isAdminGoogle = isGoogleUser(authUser); // רק חשבון Google = מנהל; חשבון שחקנית לא נחשב
  async function googleLogin() {
    setGError(""); setGLoading(true);
    const res = await onGoogle();
    if (!res.ok) { setGLoading(false); setGError(res.error ? "ההתחברות נכשלה: " + res.error : ""); }
  }
  async function continueAdmin() {
    setGError(""); setGLoading(true);
    const res = await onContinue();
    if (!res.ok) { setGLoading(false); setGError(res.error || "שגיאה"); }
  }
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "40px 20px 50px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        <div style={{ fontSize: 52 }}>🔐</div>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 700, margin: "10px 0 0" }}>כניסת מנהל</h2>
      </div>
      <div style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {isAdminGoogle ? (
          <>
            <p style={{ color: "#16a34a", fontSize: 14, margin: "0 0 14px", fontWeight: 600 }}>✓ מחובר כ-{authUser.email}</p>
            <button onClick={continueAdmin} disabled={gLoading}
              style={{ width: "100%", maxWidth: 300, padding: "14px 16px", background: pc, color: "white", border: "none", borderRadius: 12, cursor: gLoading ? "default" : "pointer", fontSize: 15, fontWeight: 700 }}>
              {gLoading ? "טוען..." : "המשך לניהול →"}
            </button>
          </>
        ) : (
          <>
            <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 18px", textAlign: "center" }}>התחברי עם חשבון Google כדי לנהל את הקבוצה</p>
            <button onClick={googleLogin} disabled={gLoading}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", maxWidth: 300, padding: "14px 16px", background: "white", color: "#3c4043", border: "1px solid #dadce0", borderRadius: 12, cursor: gLoading ? "default" : "pointer", fontSize: 15, fontWeight: 600, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
              <span style={{ fontSize: 18 }}>🔵</span>
              {gLoading ? "מתחבר..." : "התחבר עם Google"}
            </button>
          </>
        )}
        {gError && <p style={{ color: "#ef4444", margin: "12px 0 0", fontSize: 13, textAlign: "center", maxWidth: 300, wordBreak: "break-word" }}>{gError}</p>}
      </div>
    </div>
  );
}

export { InstallScreen, WhatsNewScreen, LockedTeamScreen, Splash, NoInviteScreen, PurchaseScreen, NotRegisteredScreen, LandingScreen, PendingRequestScreen, AdminLogin };
