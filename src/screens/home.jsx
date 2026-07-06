import { useState, useRef } from "react";
import { updatePassword } from "firebase/auth";
import { auth } from "../firebase";
import { S } from "../styles/S";
import { getNextEvent, formatDate, formatShort, countdownLabel, todayStr, isBirthdayToday } from "../lib/utils";
import { CURRENT_TEAM, bindPlayerMembership } from "../lib/db";
import { playerEmail, emailAuth } from "../lib/auth";
import { uploadProfilePhoto } from "../lib/images";
import { NotifTicker, PurchaseBanner, Label } from "../components/shared";

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
function HomeScreen({ players, events, attendance, settings, notifications, playerProfiles, upd, pc, sc, onSelectPlayer, onAdmin, onHelp, onAbout, onSuperAdmin, onPurchase }) {
  const lpRef = useRef();
  const gridRef = useRef();
  const [forceRoster, setForceRoster] = useState(false);
  const activeNotifs = notifications.filter(n => n.active && !(n.type === "cancel" && n.expiresOn && n.expiresOn < todayStr()));
  const nextEvent = getNextEvent(events || []);
  // שחקנית שהמכשיר "זוכר" — אם קיימת, מציגים דשבורד אישי (מצב א'); אחרת רשימת בחירה (מצב ב')
  // rememberPlayer נשמר רק לאחר כניסה מוצלחת — עדות מספקת בלי לדרוש setupDone שאולי טרם נטען.
  const me = !forceRoster ? players.find(p => localStorage.getItem("rememberPlayer_" + p.id) === "1") : null;

  // כותרת דקה משותפת לשני המצבים (כולל לחיצה ארוכה על הלוגו → סופר-אדמין)
  const header = (
    <div style={{ background: pc, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderRadius: "0 0 20px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1 }}>
        <span
          onPointerDown={() => { lpRef.current = setTimeout(() => { onSuperAdmin && onSuperAdmin(); }, 1000); }}
          onPointerUp={() => clearTimeout(lpRef.current)}
          onPointerLeave={() => clearTimeout(lpRef.current)}
          onContextMenu={(e) => e.preventDefault()}
          style={{ fontSize: 28, userSelect: "none", WebkitUserSelect: "none", flexShrink: 0 }}>🏐</span>
        <span style={{ color: "white", fontSize: 15, fontWeight: 800, lineHeight: 1.25, minWidth: 0, overflowWrap: "break-word" }}>{settings.teamName}</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={onAbout} style={{ flexShrink: 0, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          <span style={{ color: sc, fontWeight: 800 }}>ℹ</span> אודות
        </button>
      </div>
    </div>
  );

  const adminLink = (
    <div style={{ padding: "8px 0 24px" }}>
      <div style={{ padding: "0 0 14px" }}><PurchaseBanner pc={pc} sc={sc} onClick={onPurchase} /></div>
      <div style={{ textAlign: "center" }}>
        <button onClick={onAdmin} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>🔐 כניסת מנהל</button>
      </div>
    </div>
  );

  // ── מצב א': דשבורד אישי (מכשיר זכור) ──
  if (me) {
    const myStatus = nextEvent ? (attendance[`${nextEvent.id}_${me.id}`] || {}).status : null;
    const bdayOthers = players.filter(p => p.id !== me.id && isBirthdayToday((playerProfiles[p.id] || {}).birthday));
    // אישור הגעה בלחיצה אחת מהמסך הראשי. דורש חיבור אמיתי (מייל) — אחרת עוברים דרך
    // מסך הסיסמה כרגיל (onSelectPlayer), כדי לא להיחסם בכללי ה-Firestore.
    async function quickRSVP(status) {
      const authed = auth.currentUser && !auth.currentUser.isAnonymous;
      if (!authed || !nextEvent) { onSelectPlayer(me); return; }
      const key = `${nextEvent.id}_${me.id}`;
      const cur = attendance[key] || {};
      if (cur.status === status) return; // כבר מסומן — אין מה לכתוב
      await upd.attendance({ ...attendance, [key]: { ...cur, status, note: cur.note || "", time: new Date().toISOString() } });
    }
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", overflowX: "hidden" }}>
        {header}

        <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", minWidth: 0, overflowWrap: "break-word" }}>שלום {me.name} 👋</span>
          <button onClick={() => setForceRoster(true)} style={{ flexShrink: 0, background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>לא את? החליפי</button>
        </div>

        {activeNotifs.length > 0 && <div style={{ padding: "10px 16px 0" }}><NotifTicker notifs={activeNotifs} pc={pc} sc={sc} /></div>}

        <div style={{ padding: "12px 16px 0" }}>
          {nextEvent ? (
            <div style={{ background: pc, borderRadius: 18, padding: 16, boxShadow: `0 6px 20px ${pc}40` }}>
              <button onClick={() => onSelectPlayer(me)} style={{ display: "block", width: "100%", textAlign: "right", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ background: "rgba(255,255,255,0.16)", color: "white", borderRadius: 20, padding: "4px 11px", fontSize: 13, fontWeight: 700 }}>{nextEvent.type === "training" ? "🏋️ אימון" : "🏆 משחק"}</span>
                  <span style={{ background: sc, color: pc, borderRadius: 20, padding: "5px 12px", fontSize: 13, fontWeight: 800 }}>⏳ {countdownLabel(nextEvent.date)}</span>
                </div>
                <div style={{ color: "white", fontSize: 18, fontWeight: 800, marginBottom: 4, lineHeight: 1.3 }}>{formatDate(nextEvent.date)} · {nextEvent.time}</div>
                <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, marginBottom: 12 }}>📍 {nextEvent.location}</div>
              </button>
              {/* אישור הגעה בלחיצה אחת — נשמר מיד; הכפתור הפעיל מסומן במילוי מלא */}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => quickRSVP("coming")}
                  style={{ flex: 1, padding: "13px 6px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 800,
                    background: myStatus === "coming" ? "#22c55e" : "rgba(255,255,255,0.94)", color: myStatus === "coming" ? "white" : "#16a34a",
                    boxShadow: myStatus === "coming" ? "0 0 0 3px rgba(255,255,255,0.6)" : "none", transition: "all 0.15s" }}>
                  {myStatus === "coming" ? "✓ מגיעה" : "✅ מגיעה"}
                </button>
                <button onClick={() => quickRSVP("notcoming")}
                  style={{ flex: 1, padding: "13px 6px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 800,
                    background: myStatus === "notcoming" ? "#ef4444" : "rgba(255,255,255,0.94)", color: myStatus === "notcoming" ? "white" : "#dc2626",
                    boxShadow: myStatus === "notcoming" ? "0 0 0 3px rgba(255,255,255,0.6)" : "none", transition: "all 0.15s" }}>
                  {myStatus === "notcoming" ? "✗ לא מגיעה" : "❌ לא מגיעה"}
                </button>
              </div>
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <button onClick={() => onSelectPlayer(me)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                  {myStatus ? "נשמר ✓ · מי עוד מגיעה? להוספת הערה ולרשימות ←" : "מי עוד מגיעה? לרשימות המלאות ←"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: "white", borderRadius: 16, padding: 22, textAlign: "center", color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>😴 אין אירועים קרובים כרגע</div>
          )}
        </div>

        {bdayOthers.length > 0 && (
          <div style={{ padding: "12px 16px 0" }}>
            <button onClick={() => onSelectPlayer(me)} style={{ width: "100%", textAlign: "right", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🎂</span>
              <span style={{ fontSize: 13, color: "#92400e", fontWeight: 700 }}>היום יום ההולדת של {bdayOthers.map(p => p.name).join(", ")} — שלחי ברכה!</span>
            </button>
          </div>
        )}

        <div style={{ padding: "12px 16px 0" }}>
          <button onClick={() => onSelectPlayer(me)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "white", border: `2px solid ${pc}20`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", textAlign: "right", boxShadow: "0 3px 12px rgba(26,35,126,0.10)" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: sc, color: pc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>👤</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: pc }}>המסך האישי שלי</div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>תמונות מהמשחק · סטטיסטיקה · סקרים ועוד</div>
            </div>
            <div style={{ fontSize: 22, color: pc, flexShrink: 0 }}>←</div>
          </button>
        </div>

        {adminLink}
      </div>
    );
  }

  // ── מצב ב': רשימת בחירה (כניסה ראשונה / החלפת שחקנית) ──
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", overflowX: "hidden" }}>
      {header}

      <div style={{ padding: "12px 16px 0", textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>בחרי את שמך כדי להיכנס</span>
      </div>

      {activeNotifs.length > 0 && <div style={{ padding: "10px 16px 0" }}><NotifTicker notifs={activeNotifs} pc={pc} sc={sc} /></div>}

      {nextEvent && (
        <div style={{ padding: "10px 16px 0" }}>
          <button onClick={() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: pc, border: "none", borderRadius: 16, padding: "12px 16px", cursor: "pointer", textAlign: "right", boxShadow: `0 4px 14px ${pc}33` }}>
            <div style={{ fontSize: 26 }}>{nextEvent.type === "training" ? "🏋️" : "🏆"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "white", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {nextEvent.type === "training" ? "אימון" : (nextEvent.opponent ? `משחק נגד ${nextEvent.opponent}` : "משחק")} · {formatShort(nextEvent.date)} · {nextEvent.time}
              </div>
              <div style={{ color: sc, fontSize: 12, fontWeight: 700, marginTop: 2 }}>בחרי את שמך לאישור הגעה ←</div>
            </div>
            <div style={{ background: sc, color: pc, borderRadius: 20, padding: "5px 12px", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{countdownLabel(nextEvent.date)}</div>
          </button>
        </div>
      )}

      <div style={{ padding: "12px 16px 0" }}>
        <div ref={gridRef} style={{ background: "white", borderRadius: 18, padding: 16, boxShadow: "0 4px 18px rgba(26,35,126,0.10)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {players.map(p => {
              const prof = playerProfiles[p.id] || {};
              return (
                <button key={p.id} onClick={() => onSelectPlayer(p)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "13px 6px", background: `${pc}0d`, border: `2px solid ${pc}25`, borderRadius: 14, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${pc}20`; e.currentTarget.style.borderColor = pc; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${pc}0d`; e.currentTarget.style.borderColor = `${pc}25`; }}>
                  {prof.photo
                    ? <img src={prof.photo} style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", border: `2px solid ${sc}` }} />
                    : <div style={{ width: 50, height: 50, borderRadius: "50%", background: `linear-gradient(135deg, ${pc}, ${pc}99)`, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, border: `2px solid ${sc}` }}>{p.name[0]}</div>
                  }
                  <span style={{ fontSize: 12, fontWeight: 700, color: pc, textAlign: "center", overflowWrap: "anywhere", maxWidth: "100%" }}>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {adminLink}
    </div>
  );
}

// ── ONBOARD SCREEN ────────────────────────────────────────────────────────────
function OnboardScreen({ player, playerProfiles, upd, pc, sc, onDone, onBack, notify }) {
  const prof = playerProfiles[player.id] || {};
  const isReturning = !!prof.setupDone;
  const [pass, setPass] = useState("");
  const [passError, setPassError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [remember, setRemember] = useState(true);
  const [photo, setPhoto] = useState(prof.photo || null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [phone, setPhone] = useState(prof.phone || "");
  const [whatsapp, setWhatsapp] = useState(prof.whatsapp || "");
  const [email, setEmail] = useState(prof.email || "");
  const [birthday, setBirthday] = useState(prof.birthday || "");
  const photoRef = useRef();
  const [forceChange, setForceChange] = useState(false); // אחרי איפוס: חובה לבחור סיסמה חדשה
  const [newPass, setNewPass] = useState("");
  const [newPassErr, setNewPassErr] = useState("");

  // כניסה: אימות מול Firebase (חשבון אמיתי). אין יותר השוואת סיסמה בצד-לקוח.
  async function tryLogin() {
    if (!pass.trim()) { setLoginError(true); setTimeout(() => setLoginError(false), 1500); return; }
    const res = await emailAuth(playerEmail(CURRENT_TEAM, player.id), pass);
    if (res.ok) {
      if (remember) localStorage.setItem("rememberPlayer_" + player.id, "1");
      else localStorage.removeItem("rememberPlayer_" + player.id);
      await bindPlayerMembership(CURRENT_TEAM, auth.currentUser?.uid, player); // כריכת uid אמיתי ↔ playerId
      // נכנסה עם סיסמה זמנית אחרי איפוס → חובה לבחור סיסמה חדשה
      if ((playerProfiles[player.id] || {}).mustChangePassword) { setForceChange(true); return; }
      onDone();
    }
    else { setLoginError(true); setTimeout(() => setLoginError(false), 1500); }
  }

  // החלפת סיסמה מאולצת אחרי איפוס (השחקנית כבר מחוברת — updatePassword מותר).
  async function submitNewPass() {
    if (newPass.trim().length < 6) { setNewPassErr("הסיסמה חייבת להכיל לפחות 6 תווים"); return; }
    try {
      await updatePassword(auth.currentUser, newPass.trim());
    } catch (e) {
      setNewPassErr("שגיאה בעדכון הסיסמה — נסי להיכנס מחדש"); return;
    }
    const cur = playerProfiles[player.id] || {};
    await upd.playerProfiles({ ...playerProfiles, [player.id]: { ...cur, mustChangePassword: false, setupDone: true } });
    onDone();
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await uploadProfilePhoto(file, player.id);
      setPhoto(url);
    } catch (err) {
      console.error("profile photo upload:", err);
      notify("העלאת התמונה נכשלה. נסי שוב או בחרי תמונה אחרת.");
    }
    setPhotoUploading(false);
  }

  function handlePhoneChange(val) {
    setPhone(val);
    // Auto-fill whatsapp: convert Israeli format to international
    const digits = val.replace(/\D/g, "");
    const wa = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
    setWhatsapp(wa);
  }

  async function completeSetup() {
    let valid = true;
    if (!pass.trim()) { setPassError("יש להזין סיסמה"); valid = false; }
    else if (pass.trim().length < 6) { setPassError("הסיסמה חייבת להכיל לפחות 6 תווים"); valid = false; }
    else setPassError("");
    if (!phone.trim()) { setPhoneError("יש להזין מספר טלפון"); valid = false; } else setPhoneError("");
    if (!valid) return;
    // יצירת חשבון Firebase אמיתי (או כניסה אם כבר קיים) — הסיסמה נשמרת ב-Firebase, לא בפרופיל.
    const res = await emailAuth(playerEmail(CURRENT_TEAM, player.id), pass.trim());
    if (!res.ok) {
      setPassError(res.error === "weak" ? "הסיסמה חלשה מדי (לפחות 6 תווים)" : "החשבון כבר קיים — נסי להיכנס עם הסיסמה הקיימת, או בקשי איפוס מהמנהלת");
      return;
    }
    // כריכת חברות עם ה-uid האמיתי לפני כתיבת הפרופיל (כדי שכללי שלב 5 יתירו את הכתיבה)
    await bindPlayerMembership(CURRENT_TEAM, auth.currentUser?.uid, player);
    const updated = {
      ...playerProfiles,
      [player.id]: { ...prof, photo, phone, whatsapp, email, birthday, setupDone: true }
    };
    await upd.playerProfiles(updated);
    onDone();
  }

  if (forceChange) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
        <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>🔑</div>
          <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: "8px 0 0" }}>בחירת סיסמה חדשה</h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: "6px 0 0" }}>הסיסמה שלך אופסה. בחרי סיסמה חדשה כדי להמשיך.</p>
        </div>
        <div style={{ padding: 28, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: 300 }}>
            <input type={showPass ? "text" : "password"} value={newPass} onChange={e => { setNewPass(e.target.value); setNewPassErr(""); }}
              placeholder="סיסמה חדשה (לפחות 6 תווים)" autoFocus onKeyDown={e => e.key === "Enter" && submitNewPass()}
              style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 0, paddingLeft: 44, border: `2px solid ${newPassErr ? "#ef4444" : "#e2e8f0"}` }} />
            <button type="button" onClick={() => setShowPass(v => !v)} aria-label="הצג/הסתר סיסמה"
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: 18, padding: 4, lineHeight: 1 }}>{showPass ? "🙈" : "👁️"}</button>
          </div>
          {newPassErr && <p style={{ color: "#ef4444", fontSize: 13, margin: "8px 0 0", fontWeight: 600 }}>⚠️ {newPassErr}</p>}
          <button onClick={submitNewPass} style={{ width: "100%", maxWidth: 300, marginTop: 18, padding: 14, background: pc, color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 16, fontWeight: 800 }}>שמרי והמשיכי ✓</button>
        </div>
      </div>
    );
  }

  if (isReturning) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
        <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "36px 20px 44px", textAlign: "center", position: "relative" }}>
          <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
          {prof.photo
            ? <img src={prof.photo} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: `3px solid ${sc}`, marginBottom: 10 }} />
            : <div style={{ width: 72, height: 72, borderRadius: "50%", background: sc, color: pc, fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", border: "3px solid white" }}>{player.name[0]}</div>
          }
          <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: 0 }}>שלום, {player.name}! 👋</h2>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, margin: "4px 0 0" }}>נשמח לראות אותך</p>
        </div>
        <div style={{ padding: 28, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16, textAlign: "center" }}>הכנסי את הסיסמה שלך להמשך</p>
          <div style={{ position: "relative", width: "100%", maxWidth: 260, marginBottom: 10 }}>
            <input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && tryLogin()}
              placeholder="סיסמה אישית" autoFocus
              style={{ ...S.input, width: "100%", maxWidth: "none", marginBottom: 0, boxSizing: "border-box", textAlign: "center", fontSize: 20, letterSpacing: 6, paddingLeft: 44, border: `2px solid ${loginError ? "#ef4444" : "#e2e8f0"}` }} />
            <button type="button" onClick={() => setShowPass(v => !v)} aria-label="הצג/הסתר סיסמה"
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: 18, padding: 4, lineHeight: 1 }}>{showPass ? "🙈" : "👁️"}</button>
          </div>
          {loginError && <p style={{ color: "#ef4444", margin: "0 0 12px", fontSize: 13 }}>{!pass.trim() ? "יש להזין סיסמה ❌" : "סיסמה שגויה ❌"}</p>}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b", cursor: "pointer", marginTop: 10, maxWidth: 280 }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: 18, height: 18, accentColor: pc, cursor: "pointer", flexShrink: 0 }} />
            זכרי אותי במכשיר הזה (כניסה מהירה בפעם הבאה)
          </label>
          <button onClick={tryLogin} style={{ padding: "13px 48px", background: pc, color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 700, marginTop: 14 }}>כניסה ✓</button>
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 20, textAlign: "center" }}>שכחת סיסמה? פני למנהל הקבוצה</p>
        </div>
      </div>
    );
  }

  // First time setup
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, padding: "28px 20px 36px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        <div style={{ fontSize: 48 }}>👋</div>
        <h2 style={{ color: "white", fontSize: 20, fontWeight: 800, margin: "8px 0 4px" }}>שלום, {player.name}!</h2>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: 0 }}>כניסה ראשונה — בואי נגדיר את הפרופיל שלך</p>
      </div>

      <div style={{ padding: "20px 20px 32px" }}>
        {/* Photo */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            {photo
              ? <img src={photo} style={{ width: 90, height: 90, borderRadius: "50%", objectFit: "cover", border: `3px solid ${sc}` }} />
              : <div style={{ width: 90, height: 90, borderRadius: "50%", background: `linear-gradient(135deg, ${pc}, ${pc}99)`, color: sc, fontSize: 34, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: `3px solid ${sc}`, margin: "0 auto" }}>{player.name[0]}</div>
            }
            <button onClick={() => !photoUploading && photoRef.current.click()}
              style={{ position: "absolute", bottom: 0, left: 0, background: sc, border: "2px solid white", borderRadius: "50%", width: 30, height: 30, cursor: photoUploading ? "default" : "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>{photoUploading ? "⏳" : "📷"}</button>
            <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
          </div>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>{photoUploading ? "מעלה תמונה…" : "לחצי להוספת תמונה"}</p>
        </div>

        <div style={S.card}>
          <Label>סיסמה אישית <span style={{ color: "#ef4444" }}>*</span></Label>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <input type={showPass ? "text" : "password"} value={pass} onChange={e => { setPass(e.target.value); setPassError(""); }} placeholder="בחרי סיסמה לכניסות הבאות (לפחות 6 תווים)" style={{ ...S.input, marginBottom: 0, boxSizing: "border-box", paddingLeft: 44, border: `2px solid ${passError ? "#ef4444" : "#e2e8f0"}` }} />
            <button type="button" onClick={() => setShowPass(v => !v)} aria-label="הצג/הסתר סיסמה"
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: 18, padding: 4, lineHeight: 1 }}>{showPass ? "🙈" : "👁️"}</button>
          </div>
          {passError && <p style={{ color: "#ef4444", fontSize: 12, margin: "-6px 0 8px", fontWeight: 600 }}>⚠️ {passError}</p>}

          <Label>טלפון <span style={{ color: "#ef4444" }}>*</span></Label>
          <input type="tel" value={phone} onChange={e => { handlePhoneChange(e.target.value); setPhoneError(""); }} placeholder="050-0000000" style={{ ...S.input, border: `2px solid ${phoneError ? "#ef4444" : "#e2e8f0"}` }} />
          {phoneError && <p style={{ color: "#ef4444", fontSize: 12, margin: "-6px 0 8px", fontWeight: 600 }}>⚠️ {phoneError}</p>}

          <Label>וואטסאפ <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 400 }}>(ממולא אוטומטית)</span></Label>
          <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="972501234567" style={S.input} />

          <Label>מייל <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 400 }}>(אופציונלי)</span></Label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" style={S.input} />

          <Label>🎂 תאריך לידה <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 400 }}>(אופציונלי)</span></Label>
          <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} style={S.input} />
        </div>

        <button onClick={completeSetup}
          style={{ width: "100%", padding: 14, background: pc, color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 700, marginTop: 4 }}>
          ✅ סיום הגדרה — כניסה
        </button>
      </div>
    </div>
  );
}
export { HomeScreen, OnboardScreen };
