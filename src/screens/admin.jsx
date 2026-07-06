import { useState, useEffect, useRef } from "react";
import { storage, auth } from "../firebase";
import { ref, deleteObject } from "firebase/storage";
import { S } from "../styles/S";
import { KEYS, DEFAULT_TEAM } from "../lib/constants";
import {
  formatDate, formatShort, getNextEvent, todayStr, monthDay,
  isBirthdayToday, isBirthdayTomorrow, ageFromBirthday,
} from "../lib/utils";
import { CURRENT_TEAM, load, save, adminResetPlayer, adminDeletePlayerRemote } from "../lib/db";
import { loadExcelJS } from "../lib/images";
import { AttModal, Empty, Label, LegendEventsModal, OutcomeBadge, BottomNav } from "../components/shared";

// ── ADMIN GALLERY (מחיקה גורפת למנהל) ─────────────────────────────────────────
function AdminGallery({ gallery, upd, pc, sc, askConfirm }) {
  const [selected, setSelected] = useState(null);
  async function deletePhoto(item) {
    try { if (item.storagePath) await deleteObject(ref(storage, item.storagePath)); }
    catch (err) { console.error("שגיאה במחיקת קובץ מ-Storage:", err); }
    await upd.gallery(gallery.filter(g => g.id !== item.id));
    setSelected(null);
  }
  if (!gallery || gallery.length === 0) return <Empty icon="📸" text="אין תמונות מהמשחק" />;
  return (
    <div>
      <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>כמנהל ניתן למחוק כל תמונה.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {[...gallery].reverse().map(item => (
          <div key={item.id} style={{ borderRadius: 12, overflow: "hidden", position: "relative" }}>
            <img src={item.photo} onClick={() => setSelected(item)} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", cursor: "pointer" }} />
            <button onClick={() => askConfirm(`למחוק את התמונה של ${item.playerName}?`, () => deletePhoto(item))}
              style={{ position: "absolute", top: 6, left: 6, background: "rgba(239,68,68,0.92)", color: "white", border: "none", borderRadius: 8, width: 30, height: 30, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              🗑️
            </button>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.65))", padding: "16px 8px 6px" }}>
              <div style={{ color: "white", fontSize: 11, fontWeight: 600 }}>{item.playerName}</div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 10 }}>{item.eventTitle || new Date(item.date).toLocaleDateString("he-IL")}</div>
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={selected.photo} style={{ maxWidth: "100%", maxHeight: "75vh", borderRadius: 12, objectFit: "contain" }} />
          <div style={{ color: "white", fontSize: 13, fontWeight: 600, marginTop: 12 }}>{selected.playerName}</div>
          <button onClick={(e) => { e.stopPropagation(); askConfirm(`למחוק את התמונה של ${selected.playerName}?`, () => deletePhoto(selected)); }}
            style={{ marginTop: 16, background: "#ef4444", color: "white", border: "none", borderRadius: 10, padding: "9px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            🗑️ מחק תמונה
          </button>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 16 }}>לחץ לסגירה</div>
        </div>
      )}
    </div>
  );
}

// ── ADMIN ONBOARDING (אשף הקמת קבוצה למנהלת חדשה) ─────────────────────────────
function AdminOnboarding({ settings, players, upd, pc, sc, isPending, onFinish }) {
  const [step, setStep] = useState(1);
  const [teamName, setTeamName] = useState(settings?.teamName && settings.teamName !== "הקבוצה שלי" ? settings.teamName : "");
  const [newPlayer, setNewPlayer] = useState("");
  const [copied, setCopied] = useState(false);

  const inviteLink = `${window.location.origin}/?team=${CURRENT_TEAM}`;

  async function saveName() {
    const t = teamName.trim();
    if (!t) return;
    await upd.settings({ ...settings, teamName: t });
    setStep(2);
  }
  async function addPlayer() {
    const n = newPlayer.trim();
    if (!n) return;
    await upd.players([...players, { id: Date.now(), name: n, phone: "", email: "", address: "", whatsapp: "" }]);
    setNewPlayer("");
  }
  async function finish() { await completeWizard(); }
  async function skipWizard() {
    // יציאה מהאשף לפאנל הניהול בלי להשלים — שומר את מה שכבר הוקלד ומסמן שלא להציג שוב.
    await completeWizard();
  }
  // שומר onboardingDone+teamName מבלי לדרוס שדות אחרים (צבעים וכו') שאולי נשמרו במקביל.
  // קורא את ה-settings הטרי מהדיסק ומאחה עליו, במקום להסתמך על ה-prop שאולי התיישן.
  async function completeWizard() {
    let base = settings || {};
    try { const fresh = await load(KEYS.settings, null); if (fresh) base = fresh; } catch {}
    await upd.settings({ ...base, teamName: teamName.trim() || base.teamName, onboardingDone: true });
    onFinish();
  }
  function copyLink() {
    try { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  function shareWhatsapp() {
    const msg = `היי! הצטרפי לקבוצת ${teamName.trim() || "הכדורשת"} שלנו באפליקציה 🏐\nהיכנסי לקישור, בחרי את שמך וקבעי סיסמה:\n${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const btn = { background: pc, color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 16, fontWeight: 800, cursor: "pointer", width: "100%" };
  const btnGhost = { background: "transparent", color: "#94a3b8", border: "none", padding: "10px", fontSize: 13, cursor: "pointer", width: "100%" };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${pc}, ${pc}cc)`, display: "flex", flexDirection: "column" }}>
      {/* מד התקדמות */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ width: 60 }} />
          <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 700 }}>צעד {step} מתוך 3</span>
          <button onClick={skipWizard} style={{ width: 60, background: "transparent", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 12, cursor: "pointer", textAlign: "left" }}>דלגי ✕</button>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.25)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(step / 3) * 100}%`, background: sc, borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 22px" }}>
        <div style={{ background: "white", borderRadius: 20, padding: "28px 22px", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>

          {/* צעד 1 — שם הקבוצה */}
          {step === 1 && (
            <>
              <div style={{ fontSize: 44, textAlign: "center" }}>🏐</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: pc, textAlign: "center", margin: "8px 0 4px" }}>ברוכה הבאה!</h2>
              <p style={{ fontSize: 14, color: "#64748b", textAlign: "center", margin: "0 0 22px" }}>בואי נקים את הקבוצה שלך בכמה צעדים פשוטים. איך קוראים לקבוצה?</p>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveName()}
                placeholder="לדוגמה: קבוצת הכדורשת של הבינלאומי" autoFocus
                style={{ ...S.input, fontSize: 16, textAlign: "center", margin: "0 0 18px" }} />
              <button onClick={saveName} disabled={!teamName.trim()} style={{ ...btn, opacity: teamName.trim() ? 1 : 0.5 }}>המשך ←</button>
            </>
          )}

          {/* צעד 2 — הוספת שחקניות */}
          {step === 2 && (
            <>
              <div style={{ fontSize: 44, textAlign: "center" }}>👥</div>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: pc, textAlign: "center", margin: "8px 0 4px" }}>מי השחקניות?</h2>
              <p style={{ fontSize: 13.5, color: "#64748b", textAlign: "center", margin: "0 0 18px" }}>הוסיפי את שמות השחקניות (אפשר גם אחר כך).</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input value={newPlayer} onChange={e => setNewPlayer(e.target.value)} onKeyDown={e => e.key === "Enter" && addPlayer()}
                  placeholder="שם שחקנית" autoFocus style={{ ...S.input, flex: 1, margin: 0 }} />
                <button onClick={addPlayer} disabled={!newPlayer.trim()} style={{ background: pc, color: "white", border: "none", borderRadius: 10, padding: "0 18px", cursor: "pointer", fontWeight: 800, fontSize: 22, opacity: newPlayer.trim() ? 1 : 0.5 }}>+</button>
              </div>
              {players.length > 0 ? (
                <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 18 }}>
                  {players.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#f8fafc", borderRadius: 10, marginBottom: 6 }}>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: sc, color: pc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", flex: 1 }}>{p.name}</span>
                      <button onClick={() => upd.players(players.filter(x => x.id !== p.id))} style={{ background: "transparent", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 15 }}>🗑</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12.5, color: "#94a3b8", textAlign: "center", margin: "0 0 18px" }}>עדיין לא הוספת שחקניות</p>
              )}
              <button onClick={() => setStep(3)} style={btn}>{players.length > 0 ? `המשך עם ${players.length} שחקניות ←` : "המשך ←"}</button>
              {players.length === 0 && <button onClick={() => setStep(3)} style={btnGhost}>דלגי ואוסיף אחר כך</button>}
            </>
          )}

          {/* צעד 3 — סיום + שיתוף קישור */}
          {step === 3 && (
            <>
              <div style={{ fontSize: 48, textAlign: "center" }}>🎉</div>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: pc, textAlign: "center", margin: "8px 0 4px" }}>{teamName.trim() || "הקבוצה"} מוכנה!</h2>
              <p style={{ fontSize: 13.5, color: "#64748b", textAlign: "center", margin: "0 0 18px" }}>
                {players.length > 0 ? `${players.length} שחקניות נוספו. ` : ""}עכשיו שתפי את הקישור — כל שחקנית תיכנס, תבחר את שמה ותקבע סיסמה.
              </p>
              <div style={{ background: "#f1f5f9", borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: pc, fontWeight: 700, wordBreak: "break-all", textAlign: "center" }}>{inviteLink}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={copyLink} style={{ flex: 1, background: "#e2e8f0", color: "#1e293b", border: "none", borderRadius: 10, padding: "12px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>{copied ? "✓ הועתק" : "📋 העתקי קישור"}</button>
                <button onClick={shareWhatsapp} style={{ flex: 1, background: "#25D366", color: "white", border: "none", borderRadius: 10, padding: "12px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📱 וואטסאפ</button>
              </div>
              {isPending && (
                <div style={{ background: "#fef9c3", borderRadius: 10, padding: "10px 12px", margin: "6px 0 14px", fontSize: 12, color: "#854d0e", textAlign: "center", lineHeight: 1.5 }}>
                  ⏳ הקבוצה תיפתח לשחקניות זמן קצר לאחר אישור. בינתיים אפשר להגדיר הכל.
                </div>
              )}
              <button onClick={finish} style={btn}>סיום — לפאנל הניהול</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ADMIN PANEL ───────────────────────────────────────────────────────────────
function AdminPanel(props) {
  const [tab, setTab] = useState("attendance");
  const { pc, sc, onBack, onLogout, teamMeta, askConfirm, settings, players, upd } = props;
  const isPending = (teamMeta?.status || "active") === "pending";
  // אשף הקמה למנהלת חדשה: קבוצה שאינה הבינלאומי, טרם הושלם onboarding, ואין עדיין שחקניות.
  // אשף הקמה למנהלת חדשה: מותנה אך ורק בדגל onboardingDone (יציב — לא תלוי במספר שחקניות).
  // הבינלאומי מוחרגת (היא ותיקה ואין לה את הדגל). מנהלת שטרם השלימה רואה אשף; שהשלימה — לא.
  const [showWizard, setShowWizard] = useState(
    CURRENT_TEAM !== DEFAULT_TEAM && !settings?.onboardingDone
  );
  if (showWizard) {
    return <AdminOnboarding settings={settings} players={players} upd={upd} pc={pc} sc={sc} isPending={isPending} onFinish={() => setShowWizard(false)} />;
  }
  // ניווט תחתון: 4 ראשיים + "עוד" (סקר, סטטיסטיקה, תמונות, הגדרות)
  const navItems = [
    { key: "attendance", icon: "📋", label: "נוכחות" },
    { key: "events", icon: "📅", label: "אירועים" },
    { key: "players", icon: "👥", label: "שחקניות" },
    { key: "notifications", icon: "💬", label: "הודעות" },
  ];
  const navMore = [
    { key: "polls", icon: "🗳️", label: "סקר" },
    { key: "archive", icon: "📊", label: "סטטיסטיקה" },
    { key: "gallery", icon: "📸", label: "תמונות מהמשחק" },
    { key: "settings", icon: "⚙️", label: "הגדרות" },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}bb)`, padding: "18px 16px 14px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        {onLogout && <button onClick={() => askConfirm ? askConfirm("להתנתק מחשבון המנהל?", onLogout) : onLogout()} style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>🔓 התנתק</button>}
        <div style={{ fontSize: 32 }}>🔐</div>
        <h2 style={{ color: "white", fontSize: 16, fontWeight: 700, margin: "4px 0 0" }}>פאנל מנהל</h2>
      </div>
      {isPending && (
        <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", borderBottom: "1px solid #fcd34d", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>⏳</span>
          <div style={{ fontSize: 12.5, color: "#92400e", fontWeight: 600, lineHeight: 1.45 }}>
            הקבוצה ממתינה לאישור — את/ה יכול/ה להקים הכול, אך <strong>השחקניות עדיין לא רואות אותה</strong>. לאחר ההפעלה — היא תיפתח לכולן.
          </div>
        </div>
      )}
      <BottomNav items={navItems} moreItems={navMore} active={tab} onChange={setTab} pc={pc} />
      <div style={{ padding: "16px 16px 96px" }}>
        {tab === "attendance" && <AdminAttendance {...props} />}
        {tab === "events" && <AdminEvents {...props} />}
        {tab === "players" && <AdminPlayers {...props} />}
        {tab === "notifications" && <AdminNotifications {...props} players={props.players} playerProfiles={props.playerProfiles} />}
        {tab === "polls" && <AdminPolls {...props} />}
        {tab === "gallery" && <AdminGallery {...props} />}
        {tab === "archive" && <ArchiveStats {...props} />}
        {tab === "settings" && <AdminSettings {...props} />}
      </div>
    </div>
  );
}

// ── ADMIN ATTENDANCE ──────────────────────────────────────────────────────────
function AdminAttendance({ players, events, attendance, playerProfiles, upd, pc, sc, askConfirm, settings, notify }) {
  const [attModal, setAttModal] = useState(null);
  const nextEvent = getNextEvent(events);

  // Birthday reminders for admin
  const birthdaysToday = players.filter(p => isBirthdayToday((playerProfiles[p.id] || {}).birthday));
  const birthdaysTomorrow = players.filter(p => isBirthdayTomorrow((playerProfiles[p.id] || {}).birthday));

  const BirthdayBanners = () => (
    <>
      {birthdaysTomorrow.length > 0 && (
        <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "1px solid #fcd34d", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>🎂</span>
          <div>
            <div style={{ fontWeight: 800, color: "#92400e", fontSize: 14 }}>תזכורת: יום הולדת מחר!</div>
            <div style={{ fontSize: 13, color: "#a16207", fontWeight: 600 }}>{birthdaysTomorrow.map(p => p.name).join(", ")} — אל תשכחי לברך 🎉</div>
          </div>
        </div>
      )}
      {birthdaysToday.length > 0 && (
        <div style={{ background: "linear-gradient(135deg, #fce7f3, #fbcfe8)", border: "1px solid #f9a8d4", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 800, color: "#9d174d", fontSize: 14 }}>יום הולדת היום!</div>
            <div style={{ fontSize: 13, color: "#be185d", fontWeight: 600 }}>{birthdaysToday.map(p => p.name).join(", ")} חוגגת היום 🥳</div>
          </div>
        </div>
      )}
    </>
  );

  if (!nextEvent) return (
    <div>
      <BirthdayBanners />
      <Empty icon="📅" text="אין אירוע פתוח כרגע" />
    </div>
  );

  const countAtt = s => s === "pending"
    ? players.filter(p => !attendance[`${nextEvent.id}_${p.id}`]?.status).length
    : players.filter(p => attendance[`${nextEvent.id}_${p.id}`]?.status === s).length;
  const getList = s => s === "pending"
    ? players.filter(p => !attendance[`${nextEvent.id}_${p.id}`]?.status)
    : players.filter(p => attendance[`${nextEvent.id}_${p.id}`]?.status === s);

  function sendWAReminder() {
    const pending = getList("pending");
    // Exact wording requested by captain
    const msg = encodeURIComponent("היי, ראיתי שלא סימנת הגעה לאימון/משחק למחר. את מתכוונת להגיע?");
    let sent = 0;
    pending.forEach(p => {
      const prof = playerProfiles[p.id] || {};
      const wa = (prof.whatsapp || "").replace(/\D/g, "");
      if (wa) { window.open(`https://wa.me/${wa}?text=${msg}`, "_blank"); sent++; }
    });
    if (sent === 0) notify("אין מספרי וואטסאפ לשחקניות שטרם ענו. הוסיפי אותם בלשונית שחקניות.");
  }

  // תזכורת קבוצתית: הודעה אחת עם שמות החוסרים, לשיתוף לקבוצת הוואטסאפ.
  // (קישור chat.whatsapp.com הוא קישור הצטרפות בלבד — לא ניתן לשלוח אליו טקסט מוכן,
  //  לכן: שיתוף נייטיב אם נתמך, אחרת העתקה ללוח + פתיחת הקבוצה.)
  async function shareGroupReminder() {
    const pending = getList("pending");
    if (pending.length === 0) return;
    const names = pending.map(p => p.name).join(", ");
    const kind = nextEvent.type === "training" ? "לאימון" : "למשחק";
    const text = `🏐 טרם סימנו הגעה ${kind} ב-${formatShort(nextEvent.date)}: ${names}.\nאנא סמנו באפליקציה 🙏`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch (e) { if (e && e.name === "AbortError") return; } // המשתמשת ביטלה — לא ליפול להעתקה
    try {
      await navigator.clipboard.writeText(text);
      const grp = (settings && settings.whatsappGroup) || "";
      notify("✅ רשימת החוסרים הועתקה. " + (grp ? "פותחת את קבוצת הוואטסאפ — הדביקי שם." : "הדביקי בקבוצת הוואטסאפ."));
      if (grp) window.open(grp, "_blank");
    } catch {
      notify("לא ניתן להעתיק אוטומטית. הרשימה:\n\n" + text);
    }
  }

  return (
    <div>
      <BirthdayBanners />
      <div style={S.card}>
        <div style={{ fontWeight: 700, color: pc, fontSize: 13 }}>{nextEvent.type === "training" ? "🏋️ אימון" : "🏆 משחק"}</div>
        <div style={{ fontWeight: 800, fontSize: 15, margin: "3px 0" }}>{formatDate(nextEvent.date)} • {nextEvent.time}</div>
        <div style={{ color: "#64748b", fontSize: 13 }}>📍 {nextEvent.location}</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        {[["coming","מגיעות","#22c55e"],["notcoming","לא מגיעות","#ef4444"],["pending","טרם ענו","#f5a623"]].map(([s,label,color]) => (
          <button key={s} onClick={() => setAttModal(s)}
            style={{ flex: 1, background: "white", border: `2px solid ${color}30`, borderRadius: 12, padding: "10px 4px", cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{countAtt(s)}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{label}</div>
          </button>
        ))}
      </div>

      {countAtt("pending") > 0 && (
        <button onClick={sendWAReminder}
          style={{ width: "100%", padding: "10px", background: "#25D366", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
          💬 שלח וואטסאפ אישי לשחקניות שלא סימנו הגעה ({countAtt("pending")})
        </button>
      )}
      {countAtt("pending") > 0 && (
        <button onClick={shareGroupReminder}
          style={{ width: "100%", padding: "10px", background: "white", color: "#16a34a", border: "2px solid #25D366", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
          📢 תזכורת קבוצתית עם שמות החוסרות ({countAtt("pending")})
        </button>
      )}
      {countAtt("pending") > 0 && (
        <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 14, fontStyle: "italic" }}>
          הטקסט: "היי, ראיתי שלא סימנת הגעה לאימון/משחק למחר. את מתכוונת להגיע?"
        </div>
      )}

      {/* Read-only list */}
      {players.map(p => {
        const prof = playerProfiles[p.id] || {};
        const rec = attendance[`${nextEvent.id}_${p.id}`];
        const status = rec?.status;
        return (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "white", borderRadius: 10, padding: "10px 12px", marginBottom: 8, border: "1px solid #e2e8f0" }}>
            {prof.photo ? <img src={prof.photo} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
              : <div style={{ width: 36, height: 36, borderRadius: "50%", background: pc, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{p.name[0]}</div>}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
              {rec?.note && <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic" }}>"{rec.note}"</div>}
            </div>
            <div style={{ fontSize: 18 }}>
              {status === "coming" ? "✅" : status === "notcoming" ? "❌" : <span style={{ color: "#94a3b8", fontSize: 13 }}>טרם ענתה</span>}
            </div>
          </div>
        );
      })}

      {attModal && (
        <AttModal
          title={attModal === "coming" ? "✅ מגיעות" : attModal === "notcoming" ? "❌ לא מגיעות" : "⏳ טרם ענו"}
          list={getList(attModal)} players={players.map(p => ({ ...p, ...(playerProfiles[p.id] || {}) }))}
          attendance={attendance} eventId={nextEvent.id}
          onClose={() => setAttModal(null)} pc={pc} sc={sc} />
      )}
    </div>
  );
}

// ── ADMIN EVENTS ──────────────────────────────────────────────────────────────
function AdminEvents({ events, settings, attendance, archive, notifications, players, playerProfiles, upd, pc, sc, askConfirm, notify }) {
  const [adding, setAdding] = useState(false);
  const [newEv, setNewEv] = useState({ type: "training", date: "", time: "16:30", location: settings.defaultTrainingLocation, note: "", open: true });
  const [calView, setCalView] = useState("list"); // "list" | "calendar"
  const [evTab, setEvTab] = useState("training"); // לשונית סוג אירוע ברשימה: "training" | "game"
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [calSelected, setCalSelected] = useState(null);
  const [legendKind, setLegendKind] = useState(null); // סוג אירוע שנבחר במקרא הלוח
  const [evResult, setEvResult] = useState({});
  const [evOutcome, setEvOutcome] = useState({});
  const [evSavedId, setEvSavedId] = useState(null);
  const [editId, setEditId] = useState(null);   // id האירוע שבעריכה (מנהל)
  const [editEv, setEditEv] = useState(null);   // טיוטת השדות הנערכים

  function startEdit(ev) {
    setEditId(ev.id);
    setEditEv({ type: ev.type, opponent: ev.opponent || "", date: ev.date, time: ev.time || "16:30", location: ev.location || "", note: ev.note || "" });
  }
  async function saveEdit() {
    if (!editEv.date) { notify("יש לבחור תאריך."); return; }
    const fields = { ...editEv };
    if (fields.type !== "game") fields.opponent = ""; // אימון — בלי קבוצה יריבה
    await upd.events(events.map(e => e.id === editId ? { ...e, ...fields } : e));
    setEditId(null); setEditEv(null);
    notify("האירוע עודכן ✔");
  }

  async function addEvent() {
    if (!newEv.date) return;
    // חסימת תאריך עבר: אירוע נקבע מהיום והלאה בלבד (מגן גם מהקלדה ידנית).
    if (newEv.date < todayStr()) { notify("לא ניתן לקבוע אירוע בתאריך שעבר. בחרי תאריך מהיום והלאה."); return; }
    await upd.events([...events, { ...newEv, id: Date.now() }]);
    setAdding(false);
    setNewEv({ type: "training", date: "", time: "16:30", location: settings.defaultTrainingLocation, note: "", open: true });
  }

  const [archiveDialog, setArchiveDialog] = useState(null); // האירוע שממתין לאישור ארכוב
  const [verified, setVerified] = useState(false);

  async function lockToArchive(ev) {
    const attData = Object.entries(attendance).filter(([k]) => k.startsWith(`${ev.id}_`)).map(([k, v]) => ({ playerId: parseInt(k.split("_")[1]), ...v }));
    await upd.archive([...archive, { ...ev, archivedAt: new Date().toISOString(), verified: true, verifiedBy: auth.currentUser?.email || "מנהל/ת", attendanceData: attData }]);
    await upd.events(events.filter(e => e.id !== ev.id));
  }

  function openArchiveDialog(ev) { setVerified(false); setArchiveDialog(ev); }
  async function confirmArchiveDialog() {
    const ev = archiveDialog;
    setArchiveDialog(null);
    if (ev) await lockToArchive(ev);
  }

  // ── ביטול אימון/משחק ──
  const [cancelDialog, setCancelDialog] = useState(null); // האירוע שממתין לאישור ביטול
  const [cancelNote, setCancelNote] = useState("");
  const [waShare, setWaShare] = useState(null); // טקסט הביטול לשיתוף בוואטסאפ
  const [waCopied, setWaCopied] = useState(false);

  const cancelText = (ev, note) => `❌ בוטל: ${ev.type === "training" ? "אימון" : "משחק"} · ${formatDate(ev.date)} · ${ev.time}${note && note.trim() ? `\n${note.trim()}` : ""}`;

  function openCancelDialog(ev) { setCancelNote(""); setCancelDialog(ev); }

  async function confirmCancel() {
    const ev = cancelDialog;
    setCancelDialog(null);
    if (!ev) return;
    const txt = cancelText(ev, cancelNote);
    // 1) סימון האירוע כבוטל (יורד מהבאנר בדף הבית כי open:false)
    await upd.events(events.map(e => e.id === ev.id ? { ...e, cancelled: true } : e));
    // 2) הודעת ביטול בדף הבית (קדימות אדומה, תוקף עד סוף יום האירוע)
    const notif = { id: Date.now(), type: "cancel", text: txt, active: true, createdAt: new Date().toISOString(), expiresOn: ev.date, eventId: ev.id };
    await upd.notifications([...(notifications || []), notif]);
    // 3) שיתוף ידני לוואטסאפ
    setWaCopied(false);
    setWaShare(txt);
  }

  async function undoCancel(ev) {
    await upd.events(events.map(e => e.id === ev.id ? { ...e, cancelled: false } : e));
    await upd.notifications((notifications || []).filter(n => !(n.type === "cancel" && n.eventId === ev.id)));
  }

  async function shareCancelWA(txt) {
    try { await navigator.clipboard.writeText(txt); setWaCopied(true); } catch (e) { setWaCopied(false); }
    const link = settings && settings.whatsappGroup ? settings.whatsappGroup : "";
    if (link) setTimeout(() => window.open(link, "_blank"), 300);
    else notify("לא הוגדר קישור לקבוצת וואטסאפ. אפשר להוסיף בהגדרות.");
  }

  // ניתן לארכב אירוע שעבר רק אם אינו משחק, או שהוא משחק שכבר יש לו תוצאה (זהה לכלל הארכוב הבודד)
  const canArchiveEv = e => e.date < todayStr() && (e.type !== "game" || e.outcome);
  const pastArchivable = [...events].filter(canArchiveEv).sort((a, b) => a.date.localeCompare(b.date));
  const pastPendingResult = [...events].filter(e => e.date < todayStr() && e.type === "game" && !e.outcome);

  // ארכוב כל האירועים הניתנים לארכוב שעברו בלחיצה אחת — כתיבה אחת לכל מערך (ללא מצבי מרוץ)
  async function archiveAllPast() {
    const past = events.filter(canArchiveEv);
    if (past.length === 0) return;
    const by = auth.currentUser?.email || "מנהל/ת";
    const newEntries = past.map(ev => {
      const attData = Object.entries(attendance).filter(([k]) => k.startsWith(`${ev.id}_`)).map(([k, v]) => ({ playerId: parseInt(k.split("_")[1]), ...v }));
      return { ...ev, archivedAt: new Date().toISOString(), verified: true, verifiedBy: by, attendanceData: attData };
    });
    await upd.archive([...archive, ...newEntries]);
    // נשמרים ב-events: אירועים עתידיים + משחקים שעברו וממתינים לתוצאה
    await upd.events(events.filter(e => !canArchiveEv(e)));
  }

  return (
    <div>
      {archiveDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 18, maxWidth: 340, width: "100%", boxSizing: "border-box", boxShadow: "0 8px 30px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", marginBottom: 4 }}>ארכוב אירוע</div>
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 16 }}>{archiveDialog.type === "training" ? "🏋️ אימון" : "🏆 משחק"} · {formatDate(archiveDialog.date)} · {archiveDialog.time}</div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 12, cursor: "pointer", marginBottom: 8 }}>
              <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} style={{ width: 20, height: 20, accentColor: "#16a34a", cursor: "pointer", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: "#92400e", fontWeight: 600, lineHeight: 1.4 }}>אימתתי את נתוני ההגעה של השחקניות לאירוע זה</span>
            </label>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 16 }}>חובה לסמן — הנתונים נכנסים לסטטיסטיקה האישית של השחקניות.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button disabled={!verified} onClick={confirmArchiveDialog}
                style={{ flex: 1, padding: 12, background: verified ? pc : "#cbd5e1", color: "white", border: "none", borderRadius: 10, cursor: verified ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 800 }}>🔒 ארכב</button>
              <button onClick={() => setArchiveDialog(null)}
                style={{ flex: 1, padding: 12, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14 }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* דיאלוג אישור ביטול אימון/משחק */}
      {cancelDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 24, maxWidth: 340, width: "100%", boxSizing: "border-box", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>⚠️</div>
            <p style={{ fontSize: 17, fontWeight: 800, color: "#1e293b", margin: "0 0 6px" }}>לבטל את ה{cancelDialog.type === "training" ? "אימון" : "משחק"}?</p>
            <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>{formatDate(cancelDialog.date)} · {cancelDialog.time}</p>
            <textarea value={cancelNote} onChange={e => setCancelNote(e.target.value)} rows={2} placeholder="סיבה / הערה (אופציונלי) — למשל: בגלל גשם"
              style={{ ...S.input, resize: "none", textAlign: "right", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setCancelDialog(null)} style={{ flex: 1, padding: 12, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>חזרה</button>
              <button onClick={confirmCancel} style={{ flex: 1.3, padding: 12, background: "#ef4444", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 800 }}>❌ כן, בטלי</button>
            </div>
          </div>
        </div>
      )}

      {/* שיתוף ידני לוואטסאפ אחרי ביטול */}
      {waShare && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 24, maxWidth: 340, width: "100%", boxSizing: "border-box", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📲</div>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", margin: "0 0 6px" }}>שליחת הביטול לקבוצת הוואטסאפ</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px" }}>הטקסט יועתק ותיפתח הקבוצה. הדביקי (הקשה ארוכה ← הדבק) ושלחי.</p>
            <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "8px 12px", margin: "0 0 14px", fontSize: 13, color: "#1e293b", fontWeight: 600, whiteSpace: "pre-wrap", textAlign: "right" }}>{waShare}</div>
            {waCopied && <p style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, margin: "0 0 12px" }}>✓ הטקסט הועתק</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setWaShare(null)} style={{ flex: 1, padding: 12, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>סגור</button>
              <button onClick={() => shareCancelWA(waShare)} style={{ flex: 1.4, padding: 12, background: "#25D366", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 800 }}>📋 העתק ופתח קבוצה</button>
            </div>
          </div>
        </div>
      )}

      {(pastArchivable.length > 0 || pastPendingResult.length > 0) && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          {pastArchivable.length > 0 && <>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#92400e", marginBottom: 4 }}>⚠️ {pastArchivable.length === 1 ? "אירוע שעבר וטרם אורכב" : `${pastArchivable.length} אירועים שעברו וטרם אורכבו`}</div>
            <div style={{ fontSize: 12, color: "#b45309", marginBottom: 10 }}>נוכחות נכנסת לסטטיסטיקה רק אחרי ארכוב. אפשר לארכב כל אחד בנפרד, או הכל בלחיצה אחת:</div>
            <button onClick={() => askConfirm(`לארכב ${pastArchivable.length} אירועים שעברו? הנוכחות שלהם תיכנס לסטטיסטיקה.`, archiveAllPast)}
              style={{ background: "#f59e0b", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>🔒 ארכב הכל ({pastArchivable.length})</button>
          </>}
          {pastPendingResult.length > 0 && (
            <div style={{ fontSize: 12, color: "#b45309", fontWeight: 700, marginTop: pastArchivable.length > 0 ? 12 : 0, paddingTop: pastArchivable.length > 0 ? 10 : 0, borderTop: pastArchivable.length > 0 ? "1px solid #fed7aa" : "none" }}>🏆 {pastPendingResult.length === 1 ? "משחק שעבר ממתין לתוצאה" : `${pastPendingResult.length} משחקים שעברו ממתינים לתוצאה`} — מלאי את התוצאה בכרטיס המשחק כדי שניתן יהיה לארכב אותו.</div>
          )}
        </div>
      )}
      {adding && (
        <div style={{ ...S.card, marginBottom: 14 }}>
          <Label>סוג אירוע</Label>
          <select value={newEv.type} onChange={e => { const t = e.target.value; setNewEv({ ...newEv, type: t, location: t === "training" ? settings.defaultTrainingLocation : settings.defaultGameLocation }); }} style={S.select}>
            <option value="training">🏋️ אימון</option>
            <option value="game">🏆 משחק</option>
          </select>
          {newEv.type === "game" && (<>
            <Label>מול מי (קבוצה יריבה)</Label>
            <input value={newEv.opponent || ""} onChange={e => setNewEv({ ...newEv, opponent: e.target.value })} placeholder="שם הקבוצה היריבה" style={S.input} />
          </>)}
          <Label>תאריך</Label>
          <input type="date" value={newEv.date} min={todayStr()} onChange={e => setNewEv({ ...newEv, date: e.target.value })} style={S.input} />
          <Label>שעה</Label>
          <input type="time" value={newEv.time} onChange={e => setNewEv({ ...newEv, time: e.target.value })} style={S.input} />
          <Label>מיקום</Label>
          <input value={newEv.location} onChange={e => setNewEv({ ...newEv, location: e.target.value })} placeholder="מיקום" style={S.input} />
          <Label>הערה (אופציונלי)</Label>
          <input value={newEv.note} onChange={e => setNewEv({ ...newEv, note: e.target.value })} placeholder="הערה (אופציונלי)" style={S.input} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addEvent} style={{ flex: 1, padding: 10, background: pc, color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>הוסף</button>
            <button onClick={() => setAdding(false)} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer" }}>ביטול</button>
          </div>
        </div>
      )}

      {!adding && <>
      {/* מתג רשימה / לוח */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["list", "📋 רשימה"], ["calendar", "🗓️ לוח"]].map(([v, lbl]) => (
          <button key={v} onClick={() => { setCalView(v); setCalSelected(null); }}
            style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: calView === v ? `2px solid ${pc}` : "2px solid #e2e8f0", background: calView === v ? `${pc}12` : "white", color: calView === v ? pc : "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: calView === v ? 800 : 600 }}>{lbl}</button>
        ))}
      </div>

      {calView === "calendar" && (() => {
        const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
        const dayHeaders = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
        const { y, m } = calMonth;
        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const today = todayStr();
        const pad = n => String(n).padStart(2, "0");
        const dateStr = d => `${y}-${pad(m + 1)}-${pad(d)}`;
        const cells = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        const prevMonth = () => { setCalSelected(null); setCalMonth(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }); };
        const nextMonth = () => { setCalSelected(null); setCalMonth(m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }); };
        const calEvents = (() => { const seen = new Set(); return [...(events || []), ...(archive || [])].filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; }); })();
        const dayEvents = ds => calEvents.filter(e => e.date === ds);
        const dayBdays = ds => (players || []).filter(p => { const b = (playerProfiles[p.id] || {}).birthday; return b && monthDay(b) === ds.slice(5); });
        const startAdd = ds => { setNewEv({ type: "training", date: ds, time: "16:30", location: settings.defaultTrainingLocation, note: "", open: true }); setAdding(true); window.scrollTo({ top: 0, behavior: "smooth" }); };

        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button onClick={prevMonth} style={{ background: `${pc}12`, border: "none", borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 18, color: pc, fontWeight: 800 }}>▶</button>
              <div style={{ fontSize: 17, fontWeight: 800, color: pc }}>{monthNames[m]} {y}</div>
              <button onClick={nextMonth} style={{ background: `${pc}12`, border: "none", borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 18, color: pc, fontWeight: 800 }}>◀</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
              {dayHeaders.map((h, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{h}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const ds = dateStr(d);
                const evs = dayEvents(ds);
                const isToday = ds === today;
                const isSel = ds === calSelected;
                const marks = [];
                if (evs.some(e => e.type === "training" && !e.cancelled)) marks.push("🏋️");
                if (evs.some(e => e.type === "game" && !e.cancelled)) marks.push("🏆");
                if (dayBdays(ds).length > 0) marks.push("🎂");
                if (evs.some(e => e.cancelled) && marks.length === 0) marks.push("❌");
                return (
                  <button key={i} onClick={() => setCalSelected(isSel ? null : ds)}
                    style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, border: isSel ? `2px solid ${pc}` : "1px solid #eef2f7", borderRadius: 10, background: isToday ? pc : (marks.length ? `${pc}0a` : "white"), cursor: "pointer", padding: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 600, color: isToday ? "white" : "#1e293b" }}>{d}</span>
                    {marks.length > 0 && <span style={{ fontSize: 9, lineHeight: 1 }}>{marks.join("")}</span>}
                  </button>
                );
              })}
            </div>

            {calSelected && (() => {
              const evs = dayEvents(calSelected);
              const bdays = dayBdays(calSelected);
              return (
                <div style={{ marginTop: 14, background: "#f8fafc", borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: pc, marginBottom: 10 }}>{formatDate(calSelected)}</div>
                  {evs.map(ev => (
                    <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "white", borderRadius: 10, padding: "10px 12px", marginBottom: 8, opacity: ev.cancelled ? 0.6 : 1 }}>
                      <span style={{ fontSize: 22 }}>{ev.type === "training" ? "🏋️" : "🏆"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", textDecoration: ev.cancelled ? "line-through" : "none" }}>{ev.type === "training" ? "אימון" : (ev.opponent ? `משחק נגד ${ev.opponent}` : "משחק")} · {ev.time}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>📍 {ev.location}</div>
                      </div>
                      {ev.cancelled && <span style={{ background: "#fee2e2", color: "#ef4444", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>בוטל</span>}
                    </div>
                  ))}
                  {bdays.map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                      <span style={{ fontSize: 22 }}>🎂</span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>יום ההולדת של {p.name}</div>
                    </div>
                  ))}
                  <button onClick={() => startAdd(calSelected)} style={{ width: "100%", padding: 11, background: pc, color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 800, marginTop: 4 }}>➕ אירוע חדש ביום זה</button>
                </div>
              );
            })()}

            <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              {[["training", "🏋️ אימון"], ["game", "🏆 משחק"], ["birthday", "🎂 יום הולדת"], ["cancelled", "❌ בוטל"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setLegendKind(k)}
                  style={{ fontSize: 12, color: "#64748b", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 20, padding: "5px 11px", cursor: "pointer", fontWeight: 600 }}>{lbl}</button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 10 }}>טיפ: לחצי על יום כדי לראות פרטים או להוסיף אירוע · לחצי על סוג במקרא כדי לראות את כל האירועים מאותו סוג.</p>

            {legendKind && (
              <LegendEventsModal kind={legendKind} events={events} archive={archive} players={players} playerProfiles={playerProfiles} pc={pc} onClose={() => setLegendKind(null)} />
            )}
          </div>
        );
      })()}

      {calView === "list" && <>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
        {[["training", "🏋️ אימונים"], ["game", "🏆 משחקים"]].map(([t, lbl]) => (
          <button key={t} onClick={() => setEvTab(t)}
            style={{ border: "none", borderRadius: 999, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: evTab === t ? pc : "#f1f5f9", color: evTab === t ? "white" : "#64748b" }}>{lbl}</button>
        ))}
      </div>
      {(() => {
        const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
        const renderEvent = (ev) => {
        // "עבר" = תאריך מוקדם מהיום, או היום אך השעה כבר חלפה (אפשר לארכב אחרי המשחק, לא רק אחרי חצות).
        const nowHM = `${String(new Date().getHours()).padStart(2,"0")}:${String(new Date().getMinutes()).padStart(2,"0")}`;
        const isPast = ev.date < todayStr() || (ev.date === todayStr() && (ev.time || "00:00") <= nowHM);
        return (
        <div key={ev.id} style={{ ...S.card, marginBottom: 10, ...(isPast ? { borderColor: "#fdba74", background: "#fffbeb" } : {}) }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: pc, fontSize: 13 }}>{ev.type === "training" ? "🏋️ אימון" : (ev.opponent ? `🏆 משחק נגד ${ev.opponent}` : "🏆 משחק")}</div>
              {isPast && <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309", marginTop: 2 }}>⚠️ עבר — ממתין לארכוב</div>}
              <div style={{ fontWeight: 700, fontSize: 14 }}>{formatDate(ev.date)} • {ev.time}</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>📍 {ev.location}</div>
              {ev.note && <div style={{ color: sc, fontSize: 12, fontWeight: 600 }}>📝 {ev.note}</div>}
              {ev.outcome && <div style={{ marginTop: 4 }}><OutcomeBadge outcome={ev.outcome} result={ev.result} /></div>}
              {ev.cancelled && <div style={{ display: "inline-block", background: "#fee2e2", color: "#ef4444", borderRadius: 8, padding: "2px 10px", fontSize: 12, fontWeight: 800, marginTop: 4 }}>❌ בוטל</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              {ev.cancelled
                ? <button onClick={() => undoCancel(ev)}
                    style={{ background: "#dcfce7", color: "#166534", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>↩️ ביטול הביטול</button>
                : <button onClick={() => openCancelDialog(ev)}
                    style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>❌ ביטול</button>}
              {isPast && (ev.type !== "game" || ev.outcome) && <button onClick={() => openArchiveDialog(ev)}
                style={{ background: "#fef3c7", color: "#92400e", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🔒 ארכיון</button>}
              <button onClick={() => (editId === ev.id ? (setEditId(null), setEditEv(null)) : startEdit(ev))}
                style={{ background: "#eff6ff", color: "#2563eb", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✏️ עריכה</button>
              <button onClick={() => askConfirm("למחוק אירוע זה?", () => upd.events(events.filter(e => e.id !== ev.id)))}
                style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11 }}>🗑 מחק</button>
            </div>
          </div>
          {editId === ev.id && editEv && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: pc, marginBottom: 8 }}>✏️ עריכת אירוע</div>
              <Label>סוג אירוע</Label>
              <select value={editEv.type} onChange={e => setEditEv({ ...editEv, type: e.target.value })} style={S.select}>
                <option value="training">🏋️ אימון</option>
                <option value="game">🏆 משחק</option>
              </select>
              {editEv.type === "game" && (<>
                <Label>מול מי (קבוצה יריבה)</Label>
                <input value={editEv.opponent} onChange={e => setEditEv({ ...editEv, opponent: e.target.value })} placeholder="שם הקבוצה היריבה" style={S.input} />
              </>)}
              <Label>תאריך</Label>
              <input type="date" value={editEv.date} onChange={e => setEditEv({ ...editEv, date: e.target.value })} style={S.input} />
              <Label>שעה</Label>
              <input type="time" value={editEv.time} onChange={e => setEditEv({ ...editEv, time: e.target.value })} style={S.input} />
              <Label>מיקום</Label>
              <input value={editEv.location} onChange={e => setEditEv({ ...editEv, location: e.target.value })} placeholder="מיקום" style={S.input} />
              <Label>הערה (אופציונלי)</Label>
              <input value={editEv.note} onChange={e => setEditEv({ ...editEv, note: e.target.value })} placeholder="הערה (אופציונלי)" style={S.input} />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={saveEdit} style={{ flex: 1, padding: 10, background: pc, color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>שמור שינויים</button>
                <button onClick={() => { setEditId(null); setEditEv(null); }} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer" }}>ביטול</button>
              </div>
            </div>
          )}
          {ev.type === "game" && !ev.cancelled && isPast && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #fde68a" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: pc, marginBottom: 8 }}>📊 תוצאת המשחק</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {[["win", "🟢 ניצחנו", "#16a34a"], ["loss", "🔴 הפסדנו", "#ef4444"], ["draw", "⚪ תיקו", "#64748b"]].map(([val, lbl, c]) => {
                  const sel = (evOutcome[ev.id] ?? ev.outcome) === val;
                  return <button key={val} onClick={() => setEvOutcome({ ...evOutcome, [ev.id]: val })}
                    style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: sel ? `2px solid ${c}` : "2px solid #e2e8f0", background: sel ? `${c}15` : "white", color: sel ? c : "#94a3b8", cursor: "pointer", fontSize: 12, fontWeight: sel ? 800 : 600 }}>{lbl}</button>;
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={evResult[ev.id] ?? (ev.result || "")} onChange={e => setEvResult({ ...evResult, [ev.id]: e.target.value })}
                  placeholder="תוצאה (3-1)" style={{ ...S.input, margin: 0, flex: 1 }} />
                <button onClick={async () => {
                  await upd.events(events.map(x => x.id === ev.id ? { ...x, result: evResult[ev.id] ?? x.result, outcome: evOutcome[ev.id] ?? x.outcome } : x));
                  setEvResult(e => { const n = { ...e }; delete n[ev.id]; return n; });
                  setEvOutcome(e => { const n = { ...e }; delete n[ev.id]; return n; });
                  setEvSavedId(ev.id); setTimeout(() => setEvSavedId(s => s === ev.id ? null : s), 2000);
                }} style={{ background: pc, color: "white", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", fontWeight: 700 }}>שמור</button>
              </div>
              {evSavedId === ev.id && <div style={{ color: "#16a34a", fontSize: 13, fontWeight: 700, marginTop: 8, textAlign: "center" }}>✓ נשמר</div>}
            </div>
          )}
        </div>
        );
        }; // סוף renderEvent
        const list = sorted.filter(e => e.type === evTab);
        return (
          <>
            {evTab === "game" && <p style={{ fontSize: 11.5, color: "#94a3b8", margin: "0 0 8px", lineHeight: 1.4 }}>יש למלא את תוצאת המשחק לאחר סיומו. רק לאחר מילוי התוצאה ניתן יהיה לארכב את המשחק.</p>}
            {list.length === 0
              ? <Empty icon={evTab === "training" ? "🏋️" : "🏆"} text={evTab === "training" ? "אין אימונים פתוחים" : "אין משחקים פתוחים"} />
              : list.map(renderEvent)}
          </>
        );
      })()}
      </>}
      </>}
    </div>
  );
}

// ── ADMIN PLAYERS ─────────────────────────────────────────────────────────────
function AdminPlayers({ players, playerProfiles, upd, pc, sc, askConfirm, notify }) {
  const [newName, setNewName] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [editData, setEditData] = useState({});
  const [resetMsg, setResetMsg] = useState(null);
  const fileRefs = useRef({});

  async function handlePhoto(id, e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const updated = { ...playerProfiles, [id]: { ...(playerProfiles[id] || {}), photo: ev.target.result } };
      await upd.playerProfiles(updated);
    };
    reader.readAsDataURL(file);
  }

  async function resetPassword(p) {
    setResetMsg({ name: p.name, loading: true });
    try {
      const res = await adminResetPlayer(CURRENT_TEAM, p.id);
      if (res && res.ok) {
        // מסמנים שחובה להחליף סיסמה — כך השחקנית תיאלץ לבחור סיסמה חדשה בכניסה עם הזמנית.
        const cur = playerProfiles[p.id] || {};
        await upd.playerProfiles({ ...playerProfiles, [p.id]: { ...cur, mustChangePassword: true } });
        setResetMsg({ name: p.name, temp: res.tempPassword, whatsapp: (playerProfiles[p.id] || {}).whatsapp || "" });
      }
      else setResetMsg({ name: p.name, error: "האיפוס נכשל" });
    } catch (e) {
      setResetMsg({ name: p.name, error: e.message || "שגיאה באיפוס" });
    }
  }

  async function deletePlayerFull(p) {
    try {
      await adminDeletePlayerRemote(CURRENT_TEAM, p.id);
    } catch (e) {
      notify("המחיקה נכשלה: " + (e.message || "שגיאה"));
      return;
    }
    // ה-Function מחקה הכל בשרת (חשבון + מסמכים + רשימה). מעדכנים גם את ה-state המקומי.
    upd.players(players.filter(x => x.id !== p.id));
  }

  function startEdit(p) {
    const prof = playerProfiles[p.id] || {};
    setExpanded(p.id);
    setEditData({ phone: prof.phone||p.phone||"", email: prof.email||p.email||"", address: prof.address||p.address||"", whatsapp: prof.whatsapp||p.whatsapp||"" });
  }

  async function saveEdit(id) {
    const updated = { ...playerProfiles, [id]: { ...(playerProfiles[id]||{}), ...editData } };
    await upd.playerProfiles(updated);
    setExpanded(null);
  }

  return (
    <div>
      {resetMsg && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 14px", marginBottom: 12, fontSize: 13, color: "#9a3412", position: "relative" }}>
          <button onClick={() => setResetMsg(null)} style={{ position: "absolute", left: 8, top: 8, background: "transparent", border: "none", cursor: "pointer", fontSize: 16, color: "#9a3412" }}>✕</button>
          {resetMsg.loading ? (
            <span style={{ fontWeight: 600 }}>🔑 מאפס סיסמה ל{resetMsg.name}…</span>
          ) : resetMsg.error ? (
            <span style={{ fontWeight: 600, color: "#dc2626" }}>⚠️ {resetMsg.name}: {resetMsg.error}</span>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>🔑 סיסמה זמנית ל{resetMsg.name}:</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3, color: "#ea580c", background: "white", borderRadius: 8, padding: "8px 12px", textAlign: "center", margin: "6px 0", fontFamily: "monospace" }}>{resetMsg.temp}</div>
              <div style={{ fontSize: 12, marginBottom: 8 }}>העבירי לה אותה. בכניסה הבאה היא תתבקש לבחור סיסמה חדשה.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { try { navigator.clipboard.writeText(resetMsg.temp); } catch {} }}
                  style={{ flex: 1, background: "#fde68a", color: "#92400e", border: "none", borderRadius: 8, padding: "8px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>📋 העתק</button>
                {resetMsg.whatsapp && (
                  <button onClick={() => window.open(`https://wa.me/${resetMsg.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`היי ${resetMsg.name}, הסיסמה הזמנית שלך לאפליקציה: ${resetMsg.temp}\nבכניסה הבאה תתבקשי לבחור סיסמה חדשה.`)}`, "_blank")}
                    style={{ flex: 1, background: "#25D366", color: "white", border: "none", borderRadius: 8, padding: "8px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>📱 שלח בוואטסאפ</button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="שם שחקנית חדשה"
          onKeyDown={e => e.key === "Enter" && newName.trim() && (upd.players([...players, { id: Date.now(), name: newName.trim(), phone:"", email:"", address:"", whatsapp:"" }]), setNewName(""))}
          style={{ ...S.input, flex: 1, margin: 0 }} />
        <button onClick={() => { if (newName.trim()) { upd.players([...players, { id: Date.now(), name: newName.trim(), phone:"", email:"", address:"", whatsapp:"" }]); setNewName(""); } }}
          style={{ background: pc, color: "white", border: "none", borderRadius: 8, padding: "0 16px", cursor: "pointer", fontWeight: 700, fontSize: 18 }}>+</button>
      </div>
      {players.map(p => {
        const prof = playerProfiles[p.id] || {};
        return (
          <div key={p.id} style={{ ...S.card, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", cursor: "pointer", flexShrink: 0 }} onClick={() => fileRefs.current[p.id]?.click()}>
                {prof.photo ? <img src={prof.photo} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: `2px solid ${sc}` }} />
                  : <div style={{ width: 44, height: 44, borderRadius: "50%", background: pc, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, border: `2px solid ${sc}` }}>{p.name[0]}</div>}
                <div style={{ position: "absolute", bottom: -1, left: -1, background: sc, borderRadius: "50%", width: 17, height: 17, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>📷</div>
                <input ref={el => fileRefs.current[p.id] = el} type="file" accept="image/*" onChange={e => handlePhoto(p.id, e)} style={{ display: "none" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#1e293b" }}>{p.name}</div>
                <div style={{ display: "flex", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
                  {prof.whatsapp && <button onClick={() => window.open(`https://wa.me/${prof.whatsapp.replace(/\D/g,"")}`, "_blank")} style={{ fontSize: 11, background: "#25D366", color: "white", borderRadius: 6, padding: "2px 7px", border: "none", cursor: "pointer", fontWeight: 600 }}>💬 WA</button>}
                  {prof.email && <button onClick={() => window.open(`mailto:${prof.email}`, "_blank")} style={{ fontSize: 11, background: `${pc}20`, color: pc, borderRadius: 6, padding: "2px 7px", border: "none", cursor: "pointer", fontWeight: 600 }}>✉️ מייל</button>}
                  {prof.phone && <button onClick={() => window.open(`tel:${prof.phone}`, "_blank")} style={{ fontSize: 11, background: "#f1f5f9", color: "#374151", borderRadius: 6, padding: "2px 7px", border: "none", cursor: "pointer", fontWeight: 600 }}>📞 {prof.phone}</button>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <button onClick={() => askConfirm(`לאפס את הסיסמה של ${p.name}? תיווצר סיסמה זמנית שתעבירי לה, והיא תבחר סיסמה חדשה בכניסה הבאה.`, () => resetPassword(p))}
                  style={{ background: "#fff7ed", color: "#ea580c", border: "none", borderRadius: 7, padding: "6px 9px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🔑</button>
                <button onClick={() => expanded === p.id ? setExpanded(null) : startEdit(p)}
                  style={{ background: `${pc}15`, color: pc, border: "none", borderRadius: 7, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️</button>
                <button onClick={() => askConfirm(`למחוק לצמיתות את ${p.name}? הפעולה תמחק את חשבונה, הפרופיל וכל הנתונים שלה — לא ניתן לשחזר.`, () => deletePlayerFull(p))}
                  style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 7, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>🗑</button>
              </div>
            </div>
            {expanded === p.id && (
              <div style={{ marginTop: 12, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                <Label>📞 טלפון</Label>
                <input value={editData.phone||""} onChange={e => {
                  const val = e.target.value;
                  const digits = val.replace(/\D/g, "");
                  const wa = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
                  setEditData({ ...editData, phone: val, whatsapp: wa });
                }} style={{ ...S.input, marginBottom: 8 }} />
                <Label>💬 וואטסאפ (קוד מדינה) - ממולא אוטומטית</Label>
                <input value={editData.whatsapp||""} onChange={e => setEditData({...editData, whatsapp: e.target.value})} style={{ ...S.input, marginBottom: 8 }} />
                <Label>✉️ מייל</Label>
                <input value={editData.email||""} onChange={e => setEditData({...editData, email: e.target.value})} style={{ ...S.input, marginBottom: 8 }} />
                <Label>🏠 כתובת</Label>
                <input value={editData.address||""} onChange={e => setEditData({...editData, address: e.target.value})} style={{ ...S.input, marginBottom: 8 }} />
                {prof.birthday && (
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>🎂 יום הולדת: {formatShort(prof.birthday)}{ageFromBirthday(prof.birthday) != null ? ` (גיל ${ageFromBirthday(prof.birthday)})` : ""}</div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => saveEdit(p.id)} style={{ flex: 1, padding: 10, background: pc, color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>שמור</button>
                  <button onClick={() => setExpanded(null)} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer" }}>ביטול</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ADMIN NOTIFICATIONS ───────────────────────────────────────────────────────
function AdminNotifications({ notifications, players, playerProfiles, events, settings, upd, pc, sc, askConfirm, notify }) {
  const [type, setType] = useState("general");
  const [text, setText] = useState("");
  const [showWAConfirm, setShowWAConfirm] = useState(null);
  const [copied, setCopied] = useState(false);

  async function addNotif() {
    if (!text.trim()) return;
    const notif = { id: Date.now(), type, text: text.trim(), active: true, createdAt: new Date().toISOString() };
    // ביטול: שומר את תאריך האירוע הקרוב כדי שההודעה תיעלם בסוף יום האירוע
    if (type === "cancel") {
      const ev = getNextEvent(events || []);
      notif.expiresOn = ev ? ev.date : todayStr();
    }
    await upd.notifications([...notifications, notif]);
    setText("");
    // ביטול → דיאלוג שיתוף לקבוצת הוואטסאפ
    if (type === "cancel") { setCopied(false); setShowWAConfirm(notif.text); }
  }

  async function shareCancelWA(msgText) {
    const fullMsg = `❌ הודעת ביטול 🏐\n${msgText}`;
    try { await navigator.clipboard.writeText(fullMsg); setCopied(true); } catch (e) { setCopied(false); }
    const link = (settings && settings.whatsappGroup) ? settings.whatsappGroup : "";
    if (link) setTimeout(() => window.open(link, "_blank"), 300);
    else notify("לא הוגדר קישור לקבוצת וואטסאפ. אפשר להוסיף בהגדרות.");
  }

  async function toggleNotif(id) {
    await upd.notifications(notifications.map(n => n.id === id ? { ...n, active: !n.active } : n));
  }

  async function editNotif(id, newText) {
    await upd.notifications(notifications.map(n => n.id === id ? { ...n, text: newText } : n));
  }

  const typeLabel = { coach: "📢 הודעת מאמן", cancel: "❌ ביטול", general: "💬 עדכון כללי" };
  const typeColor = { coach: sc, cancel: "#ef4444", general: pc };

  return (
    <div>
      {/* WhatsApp share after cancel notification — copy text + open group, manual send */}
      {showWAConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 24, maxWidth: 320, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📲</div>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 6 }}>שליחת הודעת הביטול לקבוצה</p>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>הטקסט יועתק ותיפתח קבוצת הוואטסאפ. הדביקי (הקשה ארוכה ← הדבק) ושלחי.</p>
            <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "8px 12px", margin: "8px 0 16px", fontSize: 13, color: "#1e293b", fontWeight: 600 }}>❌ הודעת ביטול 🏐<br />{showWAConfirm}</div>
            {copied && <p style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, margin: "0 0 12px" }}>✓ הטקסט הועתק</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowWAConfirm(null)} style={{ flex: 1, padding: 12, background: "#f1f5f9", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, color: "#64748b" }}>סגור</button>
              <button onClick={() => shareCancelWA(showWAConfirm)} style={{ flex: 1.4, padding: 12, background: "#25D366", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 800, color: "white" }}>📋 העתק ופתח קבוצה</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.card}>
        <Label>סוג הודעה</Label>
        <select value={type} onChange={e => setType(e.target.value)} style={S.select}>
          <option value="general">💬 עדכון כללי</option>
          <option value="coach">📢 הודעת מאמן</option>
        </select>
        <Label>תוכן ההודעה</Label>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="כתבי את ההודעה כאן..."
          style={{ ...S.input, resize: "none" }} />
        <button onClick={addNotif} style={{ width: "100%", padding: 12, background: pc, color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>
          📤 פרסם הודעה
        </button>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: pc, marginBottom: 10 }}>הודעות פעילות</h3>
      {notifications.length === 0 && <Empty icon="📭" text="אין הודעות עדיין" />}
      {[...notifications].reverse().map(n => (
        <NotifCard key={n.id} notif={n} typeLabel={typeLabel} typeColor={typeColor} onToggle={() => toggleNotif(n.id)}
          onEdit={newText => editNotif(n.id, newText)}
          onDelete={() => askConfirm("למחוק הודעה זו?", () => upd.notifications(notifications.filter(x => x.id !== n.id)))}
          pc={pc} sc={sc} />
      ))}
    </div>
  );
}

function NotifCard({ notif, typeLabel, typeColor, onToggle, onEdit, onDelete, pc }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(notif.text);
  const color = typeColor[notif.type] || pc;

  return (
    <div style={{ ...S.card, marginBottom: 10, borderRight: `4px solid ${color}`, opacity: notif.active ? 1 : 0.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color }}>{typeLabel[notif.type]}</div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(notif.createdAt).toLocaleDateString("he-IL")}</div>
      </div>
      {editing ? (
        <div>
          <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2} style={{ ...S.input, resize: "none", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 6, marginBottom: 0 }}>
            <button onClick={() => { onEdit(editText); setEditing(false); }} style={{ flex: 1, padding: 8, background: pc, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>שמור</button>
            <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 8, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12 }}>ביטול</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.5, marginBottom: 10 }}>{notif.text}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onToggle} style={{ padding: "5px 10px", background: notif.active ? "#fef3c7" : "#f0fdf4", color: notif.active ? "#92400e" : "#16a34a", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
              {notif.active ? "🔇 השהה" : "🔔 הפעל"}
            </button>
            <button onClick={() => setEditing(true)} style={{ padding: "5px 10px", background: `${pc}15`, color: pc, border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✏️ ערוך</button>
            <button onClick={onDelete} style={{ padding: "5px 10px", background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11 }}>🗑 מחק</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── ADMIN POLLS ───────────────────────────────────────────────────────────────
function AdminPolls({ polls, players, playerProfiles, upd, pc, sc, askConfirm }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [showVoters, setShowVoters] = useState({}); // pollId -> bool: הצגת שמות המצביעות
  const nameOf = id => (players.find(p => String(p.id) === String(id)) || {}).name || "—";

  function setOpt(i, val) {
    setOptions(opts => opts.map((o, idx) => idx === i ? val : o));
  }
  function addOpt() { if (options.length < 4) setOptions([...options, ""]); }
  function removeOpt(i) { if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i)); }

  async function createPoll() {
    const clean = options.map(o => o.trim()).filter(Boolean);
    if (!question.trim() || clean.length < 2) return;
    const poll = { id: Date.now(), question: question.trim(), options: clean, votes: {}, active: true, createdAt: new Date().toISOString() };
    await upd.pollUpsert(poll); // מסמך נפרד polls/{id} — לא דורס סקרים אחרים
    setQuestion(""); setOptions(["", ""]);
  }

  async function toggleActive(id) {
    const cur = (polls || []).find(p => p.id === id);
    await upd.pollSetActive(id, cur?.active === false ? true : false);
  }

  const sorted = [...(polls || [])].reverse();

  return (
    <div>
      {/* Create poll */}
      <div style={S.card}>
        <Label>שאלת הסקר</Label>
        <input value={question} onChange={e => setQuestion(e.target.value)} placeholder='למשל: "איפה נחגוג סוף עונה?"' style={S.input} />
        <Label>אפשרויות (2-4)</Label>
        {options.map((opt, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input value={opt} onChange={e => setOpt(i, e.target.value)} placeholder={`אפשרות ${i + 1}`} style={{ ...S.input, margin: 0, flex: 1 }} />
            {options.length > 2 && (
              <button onClick={() => removeOpt(i)} style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 8, padding: "0 12px", cursor: "pointer", fontSize: 16 }}>×</button>
            )}
          </div>
        ))}
        {options.length < 4 && (
          <button onClick={addOpt} style={{ background: `${pc}12`, color: pc, border: `1px dashed ${pc}55`, borderRadius: 8, padding: "8px", cursor: "pointer", fontSize: 13, fontWeight: 600, width: "100%", marginBottom: 10 }}>+ הוסף אפשרות</button>
        )}
        <button onClick={createPoll} style={{ width: "100%", padding: 12, background: pc, color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>
          🗳️ צור סקר
        </button>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: pc, marginBottom: 10 }}>סקרים קיימים</h3>
      {sorted.length === 0 && <Empty icon="🗳️" text="עדיין לא יצרת סקרים" />}
      {sorted.map(poll => {
        const votes = poll.votes || {};
        const total = Object.keys(votes).length;
        const counts = poll.options.map((_, i) => Object.values(votes).filter(v => v === i).length);
        const maxCount = Math.max(0, ...counts);
        return (
          <div key={poll.id} style={{ ...S.card, marginBottom: 10, opacity: poll.active === false ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b" }}>{poll.question}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>{total} הצביעו</div>
            </div>
            {poll.options.map((opt, i) => {
              const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
              const isWinner = total > 0 && counts[i] === maxCount;
              const voters = Object.entries(votes).filter(([, idx]) => idx === i).map(([pid]) => nameOf(pid));
              return (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ position: "relative", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: `${pct}%`, background: isWinner ? `${sc}55` : "#f1f5f9", zIndex: 0 }} />
                    <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: isWinner ? 800 : 600, color: "#1e293b" }}>{isWinner && total > 0 ? "🏆 " : ""}{opt}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: pc }}>{pct}% ({counts[i]})</span>
                    </div>
                  </div>
                  {showVoters[poll.id] && (
                    <div style={{ fontSize: 11, color: "#64748b", padding: "4px 10px 0", lineHeight: 1.6 }}>
                      {counts[i] > 0 ? `👤 ${voters.join(" · ")}` : <span style={{ color: "#cbd5e1" }}>— אין מצביעות —</span>}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowVoters(s => ({ ...s, [poll.id]: !s[poll.id] }))} disabled={total === 0}
                style={{ padding: "5px 10px", background: showVoters[poll.id] ? `${pc}15` : "#f1f5f9", color: total === 0 ? "#cbd5e1" : pc, border: "none", borderRadius: 7, cursor: total === 0 ? "default" : "pointer", fontSize: 11, fontWeight: 600 }}>
                {showVoters[poll.id] ? "🙈 הסתר מצביעות" : "👁️ מי הצביעה"}
              </button>
              <button onClick={() => toggleActive(poll.id)} style={{ padding: "5px 10px", background: poll.active === false ? "#f0fdf4" : "#fef3c7", color: poll.active === false ? "#16a34a" : "#92400e", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                {poll.active === false ? "🔔 הפעל" : "🔇 סגור סקר"}
              </button>
              <button onClick={() => askConfirm("למחוק סקר זה?", () => upd.pollDelete(poll.id))} style={{ padding: "5px 10px", background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11 }}>🗑 מחק</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ARCHIVE & STATS ───────────────────────────────────────────────────────────
function ArchiveStats({ archive, players, playerProfiles, pc, sc, notify }) {
  const [view, setView] = useState("stats"); // "stats" | "table"
  const [exporting, setExporting] = useState(false);
  const total = archive.length;
  const stats = players.map(p => {
    const attended = archive.filter(ev => ev.attendanceData?.find(a => a.playerId === p.id && a.status === "coming")).length;
    return { ...p, ...(playerProfiles[p.id]||{}), attended, pct: total > 0 ? Math.round((attended / total) * 100) : 0 };
  }).sort((a, b) => b.pct - a.pct);
  const avg = stats.length ? Math.round(stats.reduce((s, p) => s + p.pct, 0) / stats.length) : 0;

  // Column totals - how many came per event
  const colTotals = archive.map(ev =>
    ev.attendanceData?.filter(a => a.status === "coming").length || 0
  );

  // ייצוא לאקסל — שני גיליונות (נוכחות + סיכום) מעוצבים, RTL, עם נוסחאות אמיתיות. ExcelJS נטען רק בלחיצה.
  async function exportToExcel() {
    if (archive.length === 0) return;
    setExporting(true);
    try {
      const ExcelJS = await loadExcelJS();
      const evs = [...archive].sort((a, b) => a.date.localeCompare(b.date));
      const N = evs.length, P = players.length;
      const dm = d => { const x = new Date(d + "T12:00:00"); return x.getDate() + "/" + (x.getMonth() + 1); };
      const cameSet = evs.map(e => new Set((e.attendanceData || []).filter(a => a.status === "coming").map(a => a.playerId)));
      const colLetter = n => { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

      const TH = { style: "thin", color: { argb: "FFBFBFBF" } };
      const BORDER = { top: TH, left: TH, right: TH, bottom: TH };
      const pfill = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
      const HEAD = { font: { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } }, fill: pfill("FF2F5496"), alignment: { horizontal: "center", vertical: "center" }, border: BORDER };
      const TYPE = { font: { name: "Arial", size: 9, bold: true, color: { argb: "FF1F4E78" } }, fill: pfill("FFDDEBF7"), alignment: { horizontal: "center", vertical: "center" }, border: BORDER };
      const NAME = { font: { name: "Arial", size: 11, bold: true }, fill: pfill("FFF2F2F2"), alignment: { horizontal: "right", vertical: "center" }, border: BORDER };
      const CHECK = { font: { name: "Arial", size: 11, bold: true, color: { argb: "FF006100" } }, fill: pfill("FFC6EFCE"), alignment: { horizontal: "center", vertical: "center" }, border: BORDER };
      const EMPTY = { font: { name: "Arial", size: 11 }, alignment: { horizontal: "center", vertical: "center" }, border: BORDER };
      const TOTAL = { font: { name: "Arial", size: 11, bold: true }, fill: pfill("FFE2EFDA"), alignment: { horizontal: "center", vertical: "center" }, border: BORDER };
      const apply = (cell, st) => Object.assign(cell, st);

      const wb = new ExcelJS.Workbook();

      // גיליון 1 — נוכחות
      const ws = wb.addWorksheet("נוכחות", { views: [{ rightToLeft: true, state: "frozen", xSplit: 1, ySplit: 2 }] });
      const totalCol = N + 2, pctCol = N + 3;
      const r1 = ws.getRow(1); r1.height = 18;
      apply(r1.getCell(1), HEAD); r1.getCell(1).value = "סוג";
      evs.forEach((e, i) => { const c = r1.getCell(2 + i); c.value = e.type === "training" ? "אימון" : "משחק"; apply(c, TYPE); });
      const r2 = ws.getRow(2); r2.height = 19.5;
      apply(r2.getCell(1), HEAD); r2.getCell(1).value = "שחקנית \\ תאריך";
      evs.forEach((e, i) => { const c = r2.getCell(2 + i); c.value = dm(e.date); apply(c, HEAD); });
      apply(r2.getCell(totalCol), HEAD); r2.getCell(totalCol).value = 'סה"כ';
      apply(r2.getCell(pctCol), HEAD); r2.getCell(pctCol).value = "אחוז";
      players.forEach((p, pi) => {
        const rr = 3 + pi, row = ws.getRow(rr);
        apply(row.getCell(1), NAME); row.getCell(1).value = p.name;
        evs.forEach((e, i) => { const c = row.getCell(2 + i); if (cameSet[i].has(p.id)) { c.value = "✓"; apply(c, CHECK); } else apply(c, EMPTY); });
        const tc = row.getCell(totalCol); tc.value = { formula: `COUNTIF(${colLetter(1)}${rr}:${colLetter(N)}${rr},"✓")` }; apply(tc, TOTAL);
        const pc2 = row.getCell(pctCol); pc2.value = { formula: `${colLetter(totalCol - 1)}${rr}/${N}` }; apply(pc2, TOTAL); pc2.numFmt = "0%";
      });
      const trr = 3 + P, trow = ws.getRow(trr);
      apply(trow.getCell(1), HEAD); trow.getCell(1).value = 'סה"כ נוכחות';
      for (let i = 0; i < N; i++) { const c = trow.getCell(2 + i), cl = colLetter(1 + i); c.value = { formula: `COUNTIF(${cl}3:${cl}${2 + P},"✓")` }; apply(c, TOTAL); }
      const gc = trow.getCell(totalCol); gc.value = { formula: `SUM(${colLetter(totalCol - 1)}3:${colLetter(totalCol - 1)}${2 + P})` }; apply(gc, TOTAL);
      ws.getColumn(1).width = 16;
      for (let i = 0; i < N; i++) ws.getColumn(2 + i).width = 6.6;
      ws.getColumn(totalCol).width = 7; ws.getColumn(pctCol).width = 7;

      // גיליון 2 — סיכום
      const ws2 = wb.addWorksheet("סיכום", { views: [{ rightToLeft: true }] });
      const summary = players.map(p => { let t = 0, g = 0; evs.forEach((e, i) => { if (cameSet[i].has(p.id)) { e.type === "training" ? t++ : g++; } }); return { name: p.name, total: t + g, training: t, game: g }; }).sort((a, b) => b.total - a.total);
      const trainCount = evs.filter(e => e.type === "training").length, gameCount = N - trainCount;
      const h = ws2.getRow(1);
      ["שחקנית", 'סה"כ מפגשים', "אחוז כללי", "מתוכם אימונים", "מתוכם משחקים"].forEach((t, i) => { const c = h.getCell(1 + i); c.value = t; apply(c, HEAD); });
      summary.forEach((s, i) => {
        const rr = 2 + i, row = ws2.getRow(rr);
        apply(row.getCell(1), NAME); row.getCell(1).value = s.name;
        const b = row.getCell(2); b.value = s.total; apply(b, TOTAL);
        const c = row.getCell(3); c.value = { formula: `B${rr}/${N}` }; apply(c, TOTAL); c.numFmt = "0%";
        const d = row.getCell(4); d.value = s.training; apply(d, TOTAL);
        const e = row.getCell(5); e.value = s.game; apply(e, TOTAL);
      });
      const fc = ws2.getRow(2 + summary.length + 1).getCell(1);
      fc.value = `סה"כ מפגשים: ${N}  |  אימונים: ${trainCount}  |  משחקים: ${gameCount}`;
      fc.font = { name: "Arial", size: 11, bold: true };
      ws2.getColumn(1).width = 14; ws2.getColumn(2).width = 12; ws2.getColumn(3).width = 12; ws2.getColumn(4).width = 16; ws2.getColumn(5).width = 16;

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `נוכחות_שחקניות_${todayStr()}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Excel export error:", e);
      notify("שגיאה בייצוא הקובץ. נסה שוב.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, ...S.card, textAlign: "center", margin: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: pc }}>{total}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>אירועים</div>
        </div>
        <div style={{ flex: 1, ...S.card, textAlign: "center", margin: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#22c55e" }}>{avg}%</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>הגעה ממוצעת</div>
        </div>
      </div>

      {/* Export to Excel */}
      <button onClick={exportToExcel} disabled={exporting || archive.length === 0}
        style={{ width: "100%", padding: "11px", marginBottom: 12, background: archive.length === 0 ? "#cbd5e1" : "#16a34a", color: "white", border: "none", borderRadius: 10, cursor: (exporting || archive.length === 0) ? "default" : "pointer", fontWeight: 700, fontSize: 13 }}>
        {exporting ? "מייצא..." : "📥 ייצוא לאקסל"}
      </button>

      {/* View toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setView("stats")}
          style={{ flex: 1, padding: "9px", background: view === "stats" ? pc : "white", color: view === "stats" ? "white" : pc, border: `2px solid ${pc}`, borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          📊 דירוג שחקניות
        </button>
        <button onClick={() => setView("table")}
          style={{ flex: 1, padding: "9px", background: view === "table" ? pc : "white", color: view === "table" ? "white" : pc, border: `2px solid ${pc}`, borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          📅 טבלת נוכחות
        </button>
      </div>


      {/* Stats view */}
      {view === "stats" && (
        <div>
          {stats.map((p, i) => (
            <div key={p.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: i < 3 ? sc : "#f1f5f9", color: i < 3 ? pc : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{i + 1}</div>
              {p.photo ? <img src={p.photo} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 36, height: 36, borderRadius: "50%", background: pc, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{p.name[0]}</div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <div style={{ flex: 1, height: 7, background: "#e2e8f0", borderRadius: 4 }}>
                    <div style={{ width: `${p.pct}%`, height: "100%", background: p.pct >= 80 ? "#22c55e" : p.pct >= 50 ? sc : "#ef4444", borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: pc, minWidth: 38 }}>{p.pct}%</span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.attended} מתוך {total} אירועים</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table view */}
      {view === "table" && (
        archive.length === 0
          ? <Empty icon="📁" text="אין אירועים בארכיון עדיין" />
          : (
            <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 16px rgba(26,35,126,0.12)", border: `2px solid ${pc}20` }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, direction: "rtl" }}>
                  <thead>
                    {/* Header row - dates */}
                    <tr>
                      <th style={{ padding: "10px 12px", background: pc, color: "white", textAlign: "right", whiteSpace: "nowrap", position: "sticky", right: 0, zIndex: 2, fontSize: 13, fontWeight: 800, minWidth: 80 }}>
                        שחקנית
                      </th>
                      {archive.map(ev => (
                        <th key={ev.id} style={{ padding: "8px 6px", background: pc, color: sc, textAlign: "center", whiteSpace: "nowrap", minWidth: 52, fontWeight: 700 }}>
                          <div style={{ fontSize: 14 }}>{ev.type === "training" ? "🏋️" : "🏆"}</div>
                          <div style={{ fontSize: 10, color: "white", marginTop: 2 }}>{formatShort(ev.date)}</div>
                        </th>
                      ))}
                      <th style={{ padding: "8px 10px", background: pc, color: sc, textAlign: "center", whiteSpace: "nowrap", fontWeight: 800, fontSize: 13 }}>
                        סה״כ
                      </th>
                      <th style={{ padding: "8px 10px", background: pc, color: sc, textAlign: "center", whiteSpace: "nowrap", fontWeight: 800, fontSize: 13 }}>
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Player rows - sorted by attendance */}
                    {stats.map((p, ri) => (
                      <tr key={p.id} style={{ background: ri % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ padding: "9px 12px", fontWeight: 700, whiteSpace: "nowrap", position: "sticky", right: 0, background: ri % 2 === 0 ? "white" : "#f8fafc", borderLeft: `2px solid ${pc}20`, fontSize: 13, color: "#1e293b" }}>
                          {p.name}
                        </td>
                        {archive.map(ev => {
                          const rec = ev.attendanceData?.find(a => a.playerId === p.id);
                          const came = rec?.status === "coming";
                          const notCame = rec?.status === "notcoming";
                          return (
                            <td key={ev.id} style={{ textAlign: "center", padding: "7px 4px", background: came ? "#f0fdf4" : notCame ? "#fef2f2" : "transparent" }}>
                              <span style={{ fontSize: 15 }}>{came ? "✅" : notCame ? "❌" : <span style={{ color: "#cbd5e1", fontSize: 16 }}>—</span>}</span>
                            </td>
                          );
                        })}
                        {/* Row totals */}
                        <td style={{ textAlign: "center", fontWeight: 800, color: pc, background: `${pc}08`, padding: "7px 8px", fontSize: 13 }}>
                          {p.attended}
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 800, padding: "7px 8px", fontSize: 13, color: p.pct >= 80 ? "#22c55e" : p.pct >= 50 ? "#f59e0b" : "#ef4444", background: p.pct >= 80 ? "#f0fdf4" : p.pct >= 50 ? "#fffbeb" : "#fef2f2" }}>
                          {p.pct}%
                        </td>
                      </tr>
                    ))}
                    {/* Column totals row */}
                    <tr style={{ background: `${pc}10`, borderTop: `2px solid ${pc}30` }}>
                      <td style={{ padding: "9px 12px", fontWeight: 800, position: "sticky", right: 0, background: `${pc}10`, color: pc, fontSize: 12, borderLeft: `2px solid ${pc}20` }}>
                        סה״כ מגיעות
                      </td>
                      {colTotals.map((n, i) => (
                        <td key={i} style={{ textAlign: "center", fontWeight: 800, color: pc, padding: "7px 4px", fontSize: 13 }}>
                          {n}
                        </td>
                      ))}
                      <td style={{ textAlign: "center", fontWeight: 800, color: pc, background: `${pc}15`, padding: "7px 8px", fontSize: 13 }}>
                        {stats.reduce((s, p) => s + p.attended, 0)}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 800, color: "#22c55e", background: "#f0fdf4", padding: "7px 8px", fontSize: 13 }}>
                        {avg}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
      )}
    </div>
  );
}

// ── ADMIN SETTINGS ────────────────────────────────────────────────────────────
function AdminSettings({ settings, upd, pc, sc, notify }) {
  const [s, setS] = useState({ ...settings });
  const [linkCopied, setLinkCopied] = useState(false);
  const teamLink = `${window.location.origin}/?team=${CURRENT_TEAM}`;
  function copyTeamLink() {
    try { navigator.clipboard.writeText(teamLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); } catch {}
  }
  function shareTeamLink() {
    const msg = `היי! הצטרפי לקבוצת ${s.teamName || "הכדורשת"} שלנו באפליקציה 🏐\nהיכנסי לקישור, בחרי את שמך וקבעי סיסמה:\n${teamLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  // Sync if settings change from outside
  useEffect(() => { setS({ ...settings }); }, [settings.primaryColor, settings.secondaryColor]);

  async function handleChange(field, value) {
    const updated = { ...s, [field]: value };
    setS(updated);
    await upd.settings(updated);
  }
  return (
    <div>
      <div style={{ ...S.card, border: `2px solid ${pc}`, background: `${pc}08` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>🔗</span>
          <span style={{ fontWeight: 800, color: pc, fontSize: 15 }}>הקישור של הקבוצה שלך</span>
        </div>
        <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 10px", lineHeight: 1.5 }}>
          שלחי את הקישור הזה לשחקניות. הן ייכנסו, יבחרו את שמן ויקבעו סיסמה. כדאי לשמור אותו במסך הבית של הטלפון.
        </p>
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 10, fontSize: 12.5, color: pc, fontWeight: 700, wordBreak: "break-all", textAlign: "center" }}>{teamLink}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copyTeamLink} style={{ flex: 1, background: "#e2e8f0", color: "#1e293b", border: "none", borderRadius: 10, padding: "11px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>{linkCopied ? "✓ הועתק" : "📋 העתקי קישור"}</button>
          <button onClick={shareTeamLink} style={{ flex: 1, background: "#25D366", color: "white", border: "none", borderRadius: 10, padding: "11px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📱 וואטסאפ</button>
        </div>
      </div>
      <div style={S.card}>
        <Label>שם הקבוצה</Label>
        <input value={s.teamName} onChange={e => handleChange("teamName", e.target.value)} style={S.input} />
        <Label>טקסט כפתור ברוכות הבאות (הכפתור הצהוב)</Label>
        <input value={s.welcomeText || "ברוכות הבאות לקבוצת הכדורשת שלנו!"} onChange={e => handleChange("welcomeText", e.target.value)} placeholder="ברוכות הבאות לקבוצת הכדורשת שלנו!" style={S.input} />
        <Label>מיקום ברירת מחדל — אימון</Label>
        <input value={s.defaultTrainingLocation} onChange={e => handleChange("defaultTrainingLocation", e.target.value)} style={S.input} />
        <Label>מיקום ברירת מחדל — משחק</Label>
        <input value={s.defaultGameLocation} onChange={e => handleChange("defaultGameLocation", e.target.value)} style={S.input} />
        <Label>קישור קבוצת וואטסאפ (לשליחת הודעות ביטול)</Label>
        <input value={s.whatsappGroup || ""} onChange={e => handleChange("whatsappGroup", e.target.value)} placeholder="https://chat.whatsapp.com/..." style={S.input} />
        <p style={{ fontSize: 11, color: "#94a3b8", margin: "-4px 0 10px" }}>כשתשלחי הודעת "ביטול", הטקסט יועתק ותיפתח הקבוצה — הדביקי ושלחי.</p>
        <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <Label>צבע ראשי</Label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="color" value={s.primaryColor} onChange={e => handleChange("primaryColor", e.target.value)} style={{ width: 42, height: 36, border: "none", borderRadius: 8, cursor: "pointer", padding: 2 }} />
              <input value={s.primaryColor} onChange={e => handleChange("primaryColor", e.target.value)} style={{ ...S.input, margin: 0, flex: 1, fontSize: 12 }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <Label>צבע משני</Label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="color" value={s.secondaryColor} onChange={e => handleChange("secondaryColor", e.target.value)} style={{ width: 42, height: 36, border: "none", borderRadius: 8, cursor: "pointer", padding: 2 }} />
              <input value={s.secondaryColor} onChange={e => handleChange("secondaryColor", e.target.value)} style={{ ...S.input, margin: 0, flex: 1, fontSize: 12 }} />
            </div>
          </div>
        </div>

        {/* Color presets */}
        <Label>צבעים מהירים</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { label: "🔵 ברירת מחדל", primary: "#1a237e", secondary: "#f5c842" },
            { label: "🟢 ירוק", primary: "#1b5e20", secondary: "#ffeb3b" },
            { label: "🔴 אדום", primary: "#b71c1c", secondary: "#ffd54f" },
            { label: "🟣 סגול", primary: "#4a148c", secondary: "#f5c842" },
            { label: "⚫ שחור", primary: "#212121", secondary: "#f5c842" },
          ].map(preset => (
            <button key={preset.label} onClick={() => { handleChange("primaryColor", preset.primary); handleChange("secondaryColor", preset.secondary); setS(prev => ({ ...prev, primaryColor: preset.primary, secondaryColor: preset.secondary })); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, border: `2px solid ${s.primaryColor === preset.primary ? preset.primary : "#e2e8f0"}`, background: s.primaryColor === preset.primary ? `${preset.primary}15` : "white", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              <div style={{ display: "flex", gap: 3 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: preset.primary }} />
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: preset.secondary }} />
              </div>
              {preset.label}
            </button>
          ))}
        </div>
        <Label>סיסמת מנהל</Label>
        <input type="password" value={s.captainPassword} onChange={e => handleChange("captainPassword", e.target.value)} style={S.input} />
        <Label>מסך פתיחה להתקנה</Label>
        <button onClick={async () => {
          const newVer = (s.installVersion || 1) + 1;
          await handleChange("installVersion", newVer);
          await save(KEYS.installVersion, newVer);
        }} style={{ width: "100%", padding: "11px", background: "#1a237e", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
          📲 הצג מסך התקנה לכולם מחדש
        </button>
        <button onClick={() => { localStorage.removeItem("whatsNewSeenVer"); notify("מסך 'מה חדש' יוצג לך שוב בכניסה הבאה. לכל שחקנית הוא יוצג פעם אחת אוטומטית כשמשתחררת גרסה חדשה."); }}
          style={{ width: "100%", padding: "11px", background: "#7c3aed", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
          ✨ הצג שוב את מסך "מה חדש"
        </button>
        <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#16a34a", fontWeight: 600 }}>✅ הגדרות נשמרות אוטומטית</div>
      </div>
    </div>
  );
}
export { AdminPanel };
