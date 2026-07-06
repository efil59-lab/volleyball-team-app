import { useState, useEffect, useRef } from "react";
import { db, storage, auth } from "../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { S } from "../styles/S";
import {
  formatDate, formatShort, getNextEvent, countdownLabel, todayStr, monthDay,
  isBirthdayToday, applauseThisMonth, alreadyApplaudedToday,
} from "../lib/utils";
import { CURRENT_TEAM } from "../lib/db";
import { compressImage, uploadProfilePhoto } from "../lib/images";
import { AttModal, Collapsible, Empty, Label, LegendEventsModal, OutcomeBadge, BottomNav } from "../components/shared";

// ── PLAYER SCREEN ─────────────────────────────────────────────────────────────
function PlayerScreen({ player, events, attendance, players, notifications, games, gallery, playerProfiles, settings, applause, polls, personalNotifs, archive, chat, upd, pc, sc, askConfirm, onBack, onLogout, notify, addChatLocal }) {
  const [tab, setTab] = useState("event");
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);
  const [attModal, setAttModal] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [showNoteFor, setShowNoteFor] = useState(null);
  const [editProfile, setEditProfile] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editBirthday, setEditBirthday] = useState("");
  const [entryPopups, setEntryPopups] = useState([]); // birthday + applause greetings shown once on entry
  const galleryRef = useRef();
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [galleryUploading, setGalleryUploading] = useState(false); // מצב טעינה לכפתור ההעלאה
  const [galleryMsg, setGalleryMsg] = useState(""); // הודעת שגיאה/הגבלה לשחקנית
  const photoRef = useRef();

  const prof = playerProfiles[player.id] || {};
  const nextEvent = getNextEvent(events);
  const myKey = nextEvent ? `${nextEvent.id}_${player.id}` : null;
  const myRecord = myKey ? attendance[myKey] : null;
  const activeNotifs = notifications.filter(n => n.active && !(n.type === "cancel" && n.expiresOn && n.expiresOn < todayStr()));

  // ── Build entry popups (birthday greeting + unseen applause) — runs once on mount ──
  useEffect(() => {
    const popups = [];
    // Birthday greeting for self (once per day)
    if (isBirthdayToday(prof.birthday)) {
      const seenKey = `bdaySeen_${player.id}_${todayStr()}`;
      if (!localStorage.getItem(seenKey)) {
        popups.push({ kind: "birthday", id: "bday" });
        localStorage.setItem(seenKey, "1");
      }
    }
    // Other players' birthdays today → offer to send a greeting (once per viewer per celebrant per day)
    players.forEach(other => {
      if (other.id === player.id) return;
      const oprof = playerProfiles[other.id] || {};
      if (isBirthdayToday(oprof.birthday)) {
        const seenKey = `othersBdaySeen_${player.id}_${other.id}_${todayStr()}`;
        if (!localStorage.getItem(seenKey)) {
          popups.push({ kind: "otherBirthday", id: "obday_" + other.id, celebrantId: other.id, celebrantName: other.name });
          localStorage.setItem(seenKey, "1");
        }
      }
    });
    // Unseen personal notifications: applause (one each) + birthday greetings (aggregated)
    const myNotifs = (personalNotifs[player.id] || []).filter(n => !n.seen && (n.type === "applause" || n.type === "birthday"));
    myNotifs.filter(n => n.type === "applause").forEach(n => popups.push({ kind: "applause", id: n.id, fromName: n.fromName }));
    const bdayGreets = myNotifs.filter(n => n.type === "birthday");
    if (bdayGreets.length > 0) {
      const names = [...new Set(bdayGreets.map(n => n.fromName))];
      const namesStr = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " ו" + names[names.length - 1];
      popups.push({ kind: "birthdayReceived", id: "bdayrecv", fromNames: namesStr, multi: names.length > 1 });
    }
    if (popups.length > 0) {
      setEntryPopups(popups);
      // Mark applause + birthday notifs as seen
      if (myNotifs.length > 0) {
        const updated = {
          ...personalNotifs,
          [player.id]: (personalNotifs[player.id] || []).map(n => (n.type === "applause" || n.type === "birthday") ? { ...n, seen: true } : n),
        };
        upd.personalNotifs(updated);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissTopPopup() {
    setEntryPopups(p => p.slice(1));
  }

  // שליחת ברכת יום הולדת לחוגגת (התראה אישית, פעם אחת לכל צופה לכל חוגגת ביום)
  async function sendBirthdayGreeting(celebrantId, celebrantName) {
    const key = `bdayGreetSent_${player.id}_${celebrantId}_${todayStr()}`;
    if (!localStorage.getItem(key)) {
      const notif = { id: `bday_${player.id}_${Date.now()}`, type: "birthday", fromName: player.name, seen: false, date: todayStr() };
      const updated = { ...personalNotifs, [celebrantId]: [...(personalNotifs[celebrantId] || []), notif] };
      await upd.personalNotifs(updated);
      localStorage.setItem(key, "1");
    }
    dismissTopPopup();
  }

  function countAtt(status) {
    if (!nextEvent) return 0;
    if (status === "pending") return players.filter(p => !attendance[`${nextEvent.id}_${p.id}`]?.status).length;
    return players.filter(p => attendance[`${nextEvent.id}_${p.id}`]?.status === status).length;
  }
  function getList(status) {
    if (!nextEvent) return [];
    if (status === "pending") return players.filter(p => !attendance[`${nextEvent.id}_${p.id}`]?.status);
    return players.filter(p => attendance[`${nextEvent.id}_${p.id}`]?.status === status);
  }

  async function handleRSVP(status) {
    const key = `${nextEvent.id}_${player.id}`;
    await upd.attendance({ ...attendance, [key]: { status, note: "", time: new Date().toISOString() } });
    // Show inline note option
    setShowNoteFor(status);
  }

  async function saveNote() {
    const key = `${nextEvent.id}_${player.id}`;
    const cur = attendance[key] || {};
    await upd.attendance({ ...attendance, [key]: { ...cur, note: noteInput } });
    setShowNoteFor(null); setNoteInput("");
  }

  async function sendApplause(toPlayer) {
    if (toPlayer.id === player.id) return;
    if (alreadyApplaudedToday(applause, player.id, toPlayer.id)) return;
    // Record applause
    const newApplause = [...applause, {
      id: Date.now(), fromId: player.id, fromName: player.name,
      toId: toPlayer.id, toName: toPlayer.name, date: todayStr(),
    }];
    await upd.applause(newApplause);
    // Add personal notification for the recipient
    const recipNotifs = personalNotifs[toPlayer.id] || [];
    await upd.personalNotifs({
      ...personalNotifs,
      [toPlayer.id]: [...recipNotifs, {
        id: Date.now() + 1, type: "applause", fromName: player.name,
        seen: false, createdAt: new Date().toISOString(),
      }],
    });
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    setProfilePhotoUploading(true);
    try {
      const url = await uploadProfilePhoto(file, player.id);
      const updated = { ...playerProfiles, [player.id]: { ...prof, photo: url } };
      await upd.playerProfiles(updated);
    } catch (err) {
      console.error("profile photo upload:", err);
      notify("העלאת התמונה נכשלה. נסי שוב או בחרי תמונה אחרת.");
    }
    setProfilePhotoUploading(false);
  }

  // הגבלה: 5 תמונות לשחקנית ליום (ספירה בצד-לקוח מתוך הגלריה הטעונה).
  const GALLERY_DAILY_LIMIT = 5;
  function uploadedTodayByPlayer() {
    const today = new Date().toDateString();
    return (gallery || []).filter(g =>
      g.playerId === player.id && g.date && new Date(g.date).toDateString() === today
    ).length;
  }

  async function uploadGallery(e) {
    const file = e.target.files[0];
    if (galleryRef.current) galleryRef.current.value = ""; // איפוס כדי לאפשר בחירה חוזרת של אותו קובץ
    if (!file) return;
    setGalleryMsg("");

    // 1) הגבלת 5/יום
    if (uploadedTodayByPlayer() >= GALLERY_DAILY_LIMIT) {
      setGalleryMsg(`הגעת ל-${GALLERY_DAILY_LIMIT} תמונות היום 🏐 אפשר להמשיך מחר`);
      return;
    }
    // 2) ולידציית סוג (הגנה ראשונית; כללי Storage אוכפים גם בצד-שרת)
    if (!file.type || !file.type.startsWith("image/")) {
      setGalleryMsg("אפשר להעלות רק קבצי תמונה");
      return;
    }

    setGalleryUploading(true);
    try {
      const compressed = await compressImage(file); // דחיסה לפני העלאה
      const safeName = (compressed.name || "photo").replace(/[^\w.\-]/g, "_");
      const path = `teams/${CURRENT_TEAM}/gallery/${Date.now()}_${safeName}`; // נתיב לפי קבוצה
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, compressed);
      const url = await getDownloadURL(storageRef);
      await upd.gallery([...gallery, {
        id: Date.now(), playerId: player.id, playerName: player.name,
        photo: url, storagePath: path, date: new Date().toISOString(),
        eventTitle: nextEvent ? `${nextEvent.type === "training" ? "אימון" : "משחק"} ${formatShort(nextEvent.date)}` : "כללי"
      }]);
    } catch (err) {
      console.error("שגיאה בהעלאת תמונה:", err);
      setGalleryMsg("ההעלאה נכשלה, נסי שוב");
    } finally {
      setGalleryUploading(false);
    }
  }

  async function deleteGalleryPhoto(item) {
    try { if (item.storagePath) await deleteObject(ref(storage, item.storagePath)); }
    catch (err) { console.error("שגיאה במחיקת קובץ מ-Storage:", err); }
    await upd.gallery(gallery.filter(g => g.id !== item.id));
    setSelectedPhoto(null);
  }

  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [calSelected, setCalSelected] = useState(null); // יום נבחר בלוח (yyyy-mm-dd)
  const [legendKind, setLegendKind] = useState(null); // סוג אירוע שנבחר במקרא הלוח (פותח מסך כל האירועים מהסוג)

  const [chatText, setChatText] = useState("");
  const chatEndRef = useRef(null);
  const [chatSeenTs, setChatSeenTs] = useState(() => Number(localStorage.getItem("chatLastSeen_" + player.id) || 0));
  const hasUnreadChat = (chat || []).some(m => m.playerId !== player.id && (m.ts || 0) > chatSeenTs);

  // ניווט תחתון: 4 ראשיים + "עוד" (תוצאות משחקים, סקר). נקודה אדומה על צ'אט עם הודעות שלא נקראו.
  const navItems = [
    { key: "event", icon: "📋", label: "נוכחות" },
    { key: "calendar", icon: "🗓️", label: "לוח" },
    { key: "chat", icon: "💬", label: "צ'אט", badge: hasUnreadChat },
    { key: "gallery", icon: "📸", label: "תמונות" },
  ];
  const navMore = [
    { key: "games", icon: "🏆", label: "תוצאות משחקים" },
    { key: "polls", icon: "🗳️", label: "סקר" },
  ];

  async function sendChat() {
    const t = chatText.trim();
    if (!t) return;
    setChatText("");
    const id = `${player.id}_${Date.now()}`;
    const msg = { id, playerId: player.id, name: player.name, text: t, ts: Date.now(), uid: (auth.currentUser && auth.currentUser.uid) || null };
    try {
      // כל הודעה = מסמך נפרד (id כשם המסמך) — אין דריסה, אין אובדן בשליחה במקביל.
      await setDoc(doc(db, "teams", CURRENT_TEAM, "chat", id), msg);
      if (addChatLocal) addChatLocal({ ...msg, _docId: id }); // הצגה מיידית לשולחת (לא תלוי ב-listener)
    } catch (err) {
      console.error("שגיאה בשליחת הודעה:", err);
      setChatText(t); // החזרת הטקסט כדי שאפשר לנסות שוב
      notify("ההודעה לא נשלחה. ייתכן שצריך להיכנס מחדש — צאי ובחרי את שמך עם הסיסמה.");
    }
  }
  async function deleteChatMsg(m) {
    const docId = (m && (m._docId || m.id));
    if (!docId) return;
    try {
      await deleteDoc(doc(db, "teams", CURRENT_TEAM, "chat", String(docId)));
      // ה-listener (onSnapshot) יסיר את ההודעה מהתצוגה אוטומטית.
    } catch (err) {
      console.error("שגיאה במחיקת הודעה:", err);
      notify("לא ניתן היה למחוק את ההודעה. נסי שוב, או צאי והיכנסי מחדש.");
    }
  }
  useEffect(() => {
    if (tab === "chat") {
      if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      const latest = (chat && chat.length) ? Math.max(...chat.map(m => m.ts || 0)) : 0;
      if (latest > chatSeenTs) { localStorage.setItem("chatLastSeen_" + player.id, String(latest)); setChatSeenTs(latest); }
    }
  }, [chat, tab]);

  // Attendees of the most recent event (last archived event, else current event's "coming" list)
  const lastArchived = [...(archive || [])].sort((a, b) => b.date.localeCompare(a.date))[0];
  let lastEventAttendees = [];
  let lastEventLabel = "";
  if (lastArchived) {
    const ids = (lastArchived.attendanceData || []).filter(a => a.status === "coming").map(a => a.playerId);
    lastEventAttendees = players.filter(p => ids.includes(p.id));
    lastEventLabel = `${lastArchived.type === "training" ? "אימון" : "משחק"} ${formatShort(lastArchived.date)}`;
  } else if (nextEvent) {
    lastEventAttendees = players.filter(p => attendance[`${nextEvent.id}_${p.id}`]?.status === "coming");
    lastEventLabel = `${nextEvent.type === "training" ? "אימון" : "משחק"} ${formatShort(nextEvent.date)}`;
  }
  const myApplauseCount = applauseThisMonth(applause, player.id);

  return (
    <div style={{ minHeight: "100vh" }}>
      <style>{`@keyframes chatDotPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(1.45); } }`}</style>
      {/* Entry popups: self birthday, others' birthday (send greeting), applause, received greetings */}
      {entryPopups.length > 0 && (() => {
        const top = entryPopups[0];
        const icon = top.kind === "applause" ? "👏" : top.kind === "otherBirthday" ? "🎂" : top.kind === "birthdayReceived" ? "🎉" : "🎂";
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={dismissTopPopup}>
            <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 22, padding: "32px 26px", maxWidth: 320, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", animation: "bounce 0.5s ease" }}>
              <div style={{ fontSize: 64, marginBottom: 10 }}>{icon}</div>
              {top.kind === "birthday" ? (
                <>
                  <div style={{ fontSize: 22, fontWeight: 900, color: pc, marginBottom: 8 }}>יום הולדת שמח, {player.name}! 🎉</div>
                  <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, margin: "0 0 6px" }}>כל הקבוצה מאחלת לך יום מדהים ומלא שמחה!</p>
                  <p style={{ fontSize: 14, color: pc, fontWeight: 700, margin: 0 }}>🏐 שתמשיכי לכבוש את המגרש! 🏐</p>
                </>
              ) : top.kind === "applause" ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 900, color: pc, marginBottom: 8 }}>{top.fromName} שלחה לך כל הכבוד!</div>
                  <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: 0 }}>על ההגעה לאימון/משחק. כל הכבוד! 💪</p>
                </>
              ) : top.kind === "otherBirthday" ? (
                <>
                  <div style={{ fontSize: 22, fontWeight: 900, color: pc, marginBottom: 8 }}>היום יום ההולדת של {top.celebrantName}!</div>
                  <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: 0 }}>רוצה לשלוח לה ברכה חמה? היא תקבל אותה ישר אצלה 🎉</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 20, fontWeight: 900, color: pc, marginBottom: 8 }}>קיבלת ברכה ליום ההולדת!</div>
                  <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, margin: 0 }}><b style={{ color: pc }}>{top.fromNames}</b> {top.multi ? "בירכו" : "בירכה"} אותך ליום הולדת שמח 🎂</p>
                </>
              )}
              {top.kind === "otherBirthday" ? (
                <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => sendBirthdayGreeting(top.celebrantId, top.celebrantName)} style={{ width: "100%", padding: 13, background: sc, color: pc, border: "none", borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: 15 }}>🎂 שלחי ברכה</button>
                  <button onClick={dismissTopPopup} style={{ width: "100%", padding: 10, background: "transparent", color: "#94a3b8", border: "none", cursor: "pointer", fontSize: 14 }}>אולי אחר כך</button>
                </div>
              ) : (
                <button onClick={dismissTopPopup} style={{ marginTop: 22, width: "100%", padding: 13, background: pc, color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: 15 }}>
                  {entryPopups.length > 1 ? "תודה! הבא ←" : "תודה! 🥰"}
                </button>
              )}
            </div>
          </div>
        );
      })()}
      <div style={{ background: `linear-gradient(160deg, ${pc}, ${pc}bb)`, padding: "20px 16px 28px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← חזור</button>
        <button onClick={() => { localStorage.removeItem("rememberPlayer_" + player.id); onLogout ? onLogout() : onBack(); }} style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>🔓 התנתקי</button>
        <div style={{ position: "relative", display: "inline-block", marginBottom: 8 }}>
          {prof.photo
            ? <img src={prof.photo} style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", border: `3px solid ${sc}` }} />
            : <div style={{ width: 68, height: 68, borderRadius: "50%", background: sc, color: pc, fontSize: 26, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid white", margin: "0 auto" }}>{player.name[0]}</div>
          }
          <button onClick={() => !profilePhotoUploading && photoRef.current.click()} style={{ position: "absolute", bottom: 0, left: -2, background: sc, border: "2px solid white", borderRadius: "50%", width: 24, height: 24, cursor: profilePhotoUploading ? "default" : "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>{profilePhotoUploading ? "⏳" : "📷"}</button>
          <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
        </div>
        <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>שלום, {player.name}! 👋</h2>
        {myApplauseCount > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.18)", borderRadius: 20, padding: "4px 12px", marginTop: 8 }}>
            <span style={{ fontSize: 14 }}>👏</span>
            <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>{myApplauseCount} מחיאות כפיים החודש</span>
          </div>
        )}
        <div>
          <button onClick={() => { setEditPhone(prof.phone||""); setEditEmail(prof.email||""); setEditWhatsapp(prof.whatsapp||""); setEditBirthday(prof.birthday||""); setEditProfile(true); }}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, marginTop: 8 }}>
            ✏️ עריכת פרופיל
          </button>
        </div>
      </div>

      {/* Edit profile modal */}
      {editProfile && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxHeight: "80vh", overflowY: "auto", boxSizing: "border-box" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: pc, marginBottom: 16, marginTop: 0 }}>✏️ עריכת פרופיל</h3>
            <Label>טלפון</Label>
            <input type="tel" value={editPhone} onChange={e => { setEditPhone(e.target.value); setEditWhatsapp("972" + e.target.value.replace(/\D/g,"").replace(/^0/,"")); }}
              placeholder="050-0000000" style={S.input} />
            <Label>וואטסאפ</Label>
            <input type="tel" value={editWhatsapp} onChange={e => setEditWhatsapp(e.target.value)}
              placeholder="972501234567" style={S.input} />
            <Label>מייל</Label>
            <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
              placeholder="example@email.com" style={S.input} />
            <Label>🎂 תאריך לידה</Label>
            <input type="date" value={editBirthday} onChange={e => setEditBirthday(e.target.value)} style={S.input} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => {
                const updated = { ...playerProfiles, [player.id]: { ...prof, phone: editPhone, whatsapp: editWhatsapp, email: editEmail, birthday: editBirthday } };
                await upd.playerProfiles(updated);
                setEditProfile(false);
              }} style={{ flex: 1, padding: 12, background: pc, color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>שמור</button>
              <button onClick={() => setEditProfile(false)} style={{ flex: 1, padding: 12, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, cursor: "pointer" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav items={navItems} moreItems={navMore} active={tab} onChange={setTab} pc={pc} />

      <div style={{ padding: "16px 16px 96px" }}>
        {/* ── EVENT TAB ── */}
        {tab === "event" && (
          <>
            {!nextEvent ? <Empty icon="😴" text="אין אירועים קרובים" /> : (
              <>
                <div style={{ background: pc, borderRadius: 18, padding: "18px 18px 16px", marginBottom: 14, boxShadow: `0 6px 20px ${pc}40` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ background: "rgba(255,255,255,0.16)", color: "white", borderRadius: 20, padding: "5px 12px", fontSize: 13, fontWeight: 700 }}>{nextEvent.type === "training" ? "🏋️ אימון" : "🏆 משחק"}</div>
                    <div style={{ background: sc, color: pc, borderRadius: 20, padding: "6px 14px", fontSize: 14, fontWeight: 800 }}>⏳ {countdownLabel(nextEvent.date)}</div>
                  </div>
                  <div style={{ color: "white", fontSize: 21, fontWeight: 800, marginBottom: 8, lineHeight: 1.3 }}>{formatDate(nextEvent.date)}</div>
                  <div style={{ display: "flex", gap: 16, color: "rgba(255,255,255,0.92)", fontSize: 15, flexWrap: "wrap" }}>
                    <span>⏰ {nextEvent.time}</span>
                    <span>📍 {nextEvent.location}</span>
                  </div>
                  {nextEvent.note && <div style={{ color: sc, fontSize: 14, fontWeight: 600, marginTop: 10 }}>📝 {nextEvent.note}</div>}
                </div>

                {/* Clickable counters */}
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  {[["coming", "מגיעות", "#22c55e"], ["notcoming", "לא מגיעות", "#ef4444"], ["pending", "טרם ענו", "#94a3b8"]].map(([s, label, color]) => (
                    <button key={s} onClick={() => setAttModal(s)}
                      style={{ flex: 1, background: "white", border: `2px solid ${color}30`, borderRadius: 12, padding: "10px 4px", cursor: "pointer", textAlign: "center" }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color }}>{countAtt(s)}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{label}</div>
                    </button>
                  ))}
                </div>

                {/* Who's coming - collapsible */}
                {getList("coming").length > 0 && (
                  <Collapsible title="✅ מגיעות" count={getList("coming").length} accent="#16a34a" defaultOpen>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {getList("coming").map(p => <span key={p.id} style={{ background: "#22c55e", color: "white", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{p.name}</span>)}
                    </div>
                  </Collapsible>
                )}

                {/* RSVP */}
                {myRecord?.status ? (
                  <div style={{ ...S.card, textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 6 }}>{myRecord.status === "coming" ? "✅" : "❌"}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>סימנת: <strong>{myRecord.status === "coming" ? "מגיעה" : "לא מגיעה"}</strong></div>
                    {myRecord.note && <div style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic", margin: "6px 0" }}>"{myRecord.note}"</div>}

                    {/* Inline note add without popup */}
                    {showNoteFor && (
                      <div style={{ marginTop: 12, textAlign: "right" }}>
                        <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
                          placeholder='הוסיפי הערה... (למשל: "מאחרת")'
                          style={{ ...S.input, marginBottom: 6 }} autoFocus />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={saveNote} style={{ flex: 1, padding: 10, background: pc, color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>שמור הערה</button>
                          <button onClick={() => setShowNoteFor(null)} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer" }}>דלג</button>
                        </div>
                      </div>
                    )}

                    {!showNoteFor && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
                        <button onClick={() => setShowNoteFor("note")} style={{ padding: "7px 16px", background: `${pc}15`, color: pc, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✏️ הוסף הערה</button>
                        <button onClick={() => upd.attendance({ ...attendance, [myKey]: { ...myRecord, status: null } })}
                          style={{ padding: "7px 16px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>שינוי תשובה</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ ...S.card, textAlign: "center" }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>האם את מגיעה?</p>
                    <div style={{ display: "flex", gap: 10, marginBottom: showNoteFor ? 12 : 0 }}>
                      <button onClick={() => handleRSVP("coming")}
                        style={{ flex: 1, padding: "16px", background: "#22c55e", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 16, fontWeight: 800 }}>✅ מגיעה</button>
                      <button onClick={() => handleRSVP("notcoming")}
                        style={{ flex: 1, padding: "16px", background: "#ef4444", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 16, fontWeight: 800 }}>❌ לא מגיעה</button>
                    </div>
                    {showNoteFor && (
                      <div style={{ textAlign: "right" }}>
                        <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
                          placeholder='הוסיפי הערה (אופציונלי)...'
                          style={{ ...S.input, marginBottom: 6 }} autoFocus />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={saveNote} style={{ flex: 1, padding: 10, background: pc, color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>שמור</button>
                          <button onClick={() => setShowNoteFor(null)} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer" }}>דלג</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 👏 Applause — collapsible */}
                {lastEventAttendees.filter(p => p.id !== player.id).length > 0 && (
                  <Collapsible title="👏 כל הכבוד לחברות" count={lastEventAttendees.filter(p => p.id !== player.id).length} accent={pc}>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>שלחי מחיאות כפיים למי שהגיעה ל{lastEventLabel} (פעם ביום לכל אחת)</div>
                    {lastEventAttendees.filter(p => p.id !== player.id).map(p => {
                      const prof2 = playerProfiles[p.id] || {};
                      const done = alreadyApplaudedToday(applause, player.id, p.id);
                      const cnt = applauseThisMonth(applause, p.id);
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                          {prof2.photo ? <img src={prof2.photo} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                            : <div style={{ width: 36, height: 36, borderRadius: "50%", background: pc, color: sc, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{p.name[0]}</div>}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                            {cnt > 0 && <div style={{ fontSize: 11, color: "#94a3b8" }}>👏 {cnt} החודש</div>}
                          </div>
                          <button onClick={() => sendApplause(p)} disabled={done}
                            style={{ padding: "7px 14px", borderRadius: 20, border: "none", cursor: done ? "default" : "pointer", fontSize: 13, fontWeight: 700,
                              background: done ? "#f0fdf4" : sc, color: done ? "#16a34a" : pc, opacity: done ? 1 : 1 }}>
                            {done ? "✓ נשלח היום" : "👏 כל הכבוד"}
                          </button>
                        </div>
                      );
                    })}
                  </Collapsible>
                )}
              </>
            )}

            {/* 📊 Personal stats — based on archived (verified) events only */}
                {(() => {
                  const arch = archive || [];
                  const calc = type => {
                    const evs = arch.filter(a => a.type === type);
                    const came = evs.filter(a => (a.attendanceData || []).some(d => d.playerId === player.id && d.status === "coming")).length;
                    return { total: evs.length, came };
                  };
                  const tr = calc("training"), gm = calc("game");
                  const totT = tr.total + gm.total, totC = tr.came + gm.came;
                  const col = p => p >= 75 ? "#16a34a" : p >= 50 ? "#f59e0b" : "#ef4444";
                  const pct = (c, t) => t ? Math.round(c / t * 100) : 0;
                  const bar = (icon, label, c, t, big) => {
                    const p = pct(c, t);
                    return (
                      <div style={{ marginBottom: big ? 0 : 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: big ? 14 : 13, marginBottom: 5 }}>
                          <span style={{ color: big ? "#1e293b" : "#475569", fontWeight: big ? 800 : 500 }}>{icon} {label}</span>
                          <span style={{ fontWeight: 800, color: col(p) }}>{c} / {t} · {p}%</span>
                        </div>
                        <div style={{ height: big ? 10 : 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${p}%`, height: "100%", background: big ? pc : col(p), borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  };
                  return (
                    <Collapsible title="📊 הסטטיסטיקה שלי" count={totT} accent={pc}>
                      {totT === 0
                        ? <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "8px 0" }}>עדיין אין נתונים — הסטטיסטיקה תופיע אחרי שהמנהלת תארכב אירועים.</div>
                        : <>
                            {bar("🏋️", "אימונים", tr.came, tr.total, false)}
                            {bar("🏆", "משחקים", gm.came, gm.total, false)}
                            <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 12 }}>{bar("✅", 'סה"כ נוכחות', totC, totT, true)}</div>
                          </>}
                    </Collapsible>
                  );
                })()}
          </>
        )}

        {/* ── CALENDAR TAB ── */}
        {tab === "calendar" && (() => {
          const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
          const dayHeaders = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
          const { y, m } = calMonth;
          const firstDay = new Date(y, m, 1).getDay(); // 0=ראשון
          const daysInMonth = new Date(y, m + 1, 0).getDate();
          const today = todayStr();
          // אירועים ללוח = פתוחים + מאורכבים (כדי שאירוע שהסתיים/אורכב ימשיך להופיע), ללא כפילויות
          const calEvents = (() => { const seen = new Set(); return [...(events || []), ...(archive || [])].filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; }); })();
          const pad = n => String(n).padStart(2, "0");
          const dateStr = d => `${y}-${pad(m + 1)}-${pad(d)}`;

          // נתונים ליום: אירועים (לא מבוטלים / מבוטלים) + ימי הולדת
          const dayInfo = d => {
            const ds = dateStr(d);
            const evs = calEvents.filter(e => e.date === ds);
            const bdays = (players || []).filter(p => { const b = (playerProfiles[p.id] || {}).birthday; return b && monthDay(b) === `${pad(m + 1)}-${pad(d)}`; });
            return { ds, evs, bdays };
          };

          const cells = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);

          const prevMonth = () => { setCalSelected(null); setCalMonth(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }); };
          const nextMonth = () => { setCalSelected(null); setCalMonth(m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }); };

          const selInfo = calSelected ? (() => {
            const evs = calEvents.filter(e => e.date === calSelected);
            const bdays = (players || []).filter(p => { const b = (playerProfiles[p.id] || {}).birthday; return b && monthDay(b) === calSelected.slice(5); });
            return { evs, bdays };
          })() : null;

          return (
            <div>
              {/* כותרת + ניווט חודשים */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <button onClick={prevMonth} style={{ background: `${pc}12`, border: "none", borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 18, color: pc, fontWeight: 800 }}>▶</button>
                <div style={{ fontSize: 17, fontWeight: 800, color: pc }}>{monthNames[m]} {y}</div>
                <button onClick={nextMonth} style={{ background: `${pc}12`, border: "none", borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 18, color: pc, fontWeight: 800 }}>◀</button>
              </div>

              {/* כותרות ימים */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                {dayHeaders.map((h, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{h}</div>)}
              </div>

              {/* רשת הימים */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {cells.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const info = dayInfo(d);
                  const isToday = info.ds === today;
                  const isSel = info.ds === calSelected;
                  const hasTraining = info.evs.some(e => e.type === "training" && !e.cancelled);
                  const hasGame = info.evs.some(e => e.type === "game" && !e.cancelled);
                  const hasCancelled = info.evs.some(e => e.cancelled);
                  const hasBday = info.bdays.length > 0;
                  const marks = [];
                  if (hasTraining) marks.push("🏋️");
                  if (hasGame) marks.push("🏆");
                  if (hasBday) marks.push("🎂");
                  if (hasCancelled && marks.length === 0) marks.push("❌");
                  return (
                    <button key={i} onClick={() => setCalSelected(isSel ? null : info.ds)}
                      style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, border: isSel ? `2px solid ${pc}` : "1px solid #eef2f7", borderRadius: 10, background: isToday ? pc : (marks.length ? `${pc}0a` : "white"), cursor: "pointer", padding: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 600, color: isToday ? "white" : "#1e293b" }}>{d}</span>
                      {marks.length > 0 && <span style={{ fontSize: 9, lineHeight: 1 }}>{marks.join("")}</span>}
                    </button>
                  );
                })}
              </div>

              {/* פרטי יום נבחר */}
              {calSelected && selInfo && (
                <div style={{ marginTop: 14, background: "#f8fafc", borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: pc, marginBottom: 8 }}>{formatDate(calSelected)}</div>
                  {selInfo.evs.length === 0 && selInfo.bdays.length === 0 && <div style={{ fontSize: 13, color: "#94a3b8" }}>אין אירועים ביום זה.</div>}
                  {selInfo.evs.map(ev => (
                    <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "white", borderRadius: 10, padding: "10px 12px", marginBottom: 8, opacity: ev.cancelled ? 0.6 : 1 }}>
                      <span style={{ fontSize: 22 }}>{ev.type === "training" ? "🏋️" : "🏆"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", textDecoration: ev.cancelled ? "line-through" : "none" }}>{ev.type === "training" ? "אימון" : (ev.opponent ? `משחק נגד ${ev.opponent}` : "משחק")} · {ev.time}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>📍 {ev.location}</div>
                      </div>
                      {ev.cancelled && <span style={{ background: "#fee2e2", color: "#ef4444", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>בוטל</span>}
                    </div>
                  ))}
                  {selInfo.bdays.map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                      <span style={{ fontSize: 22 }}>🎂</span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>יום ההולדת של {p.name}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* מקרא — לחיץ: פתיחת רשימת כל האירועים מאותו סוג */}
              <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                {[["training", "🏋️ אימון"], ["game", "🏆 משחק"], ["birthday", "🎂 יום הולדת"], ["cancelled", "❌ בוטל"]].map(([k, lbl]) => (
                  <button key={k} onClick={() => setLegendKind(k)}
                    style={{ fontSize: 12, color: "#64748b", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 20, padding: "5px 11px", cursor: "pointer", fontWeight: 600 }}>{lbl}</button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 8 }}>טיפ: לחצי על סוג כדי לראות את כל האירועים מאותו סוג.</p>

              {legendKind && (
                <LegendEventsModal kind={legendKind} events={events} archive={archive} players={players} playerProfiles={playerProfiles} pc={pc} onClose={() => setLegendKind(null)} />
              )}
            </div>
          );
        })()}

        {/* ── CHAT TAB ── */}
        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "62vh" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 2px", display: "flex", flexDirection: "column", gap: 8 }}>
              {(!chat || chat.length === 0) && <Empty icon="💬" text="אין הודעות עדיין — התחילי שיחה!" />}
              {(chat || []).map(m => {
                const mine = m.playerId === player.id;
                return (
                  <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                    {!mine && <div style={{ fontSize: 11, color: pc, fontWeight: 700, marginBottom: 2 }}>{m.name}</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: mine ? "row" : "row-reverse" }}>
                      <div style={{ background: mine ? pc : "white", color: mine ? "white" : "#1e293b", borderRadius: 14, padding: "8px 12px", fontSize: 14, lineHeight: 1.4, overflowWrap: "anywhere", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>{m.text}</div>
                      {mine && <button onClick={() => deleteChatMsg(m)} style={{ background: "transparent", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 13, padding: 2 }}>🗑</button>}
                    </div>
                    <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 2, textAlign: mine ? "left" : "right" }}>{new Date(m.ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid #eef2f7" }}>
              <input value={chatText} onChange={e => setChatText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendChat(); }} placeholder="הקלידי הודעה..." style={{ ...S.input, margin: 0, flex: 1 }} />
              <button onClick={sendChat} style={{ background: pc, color: "white", border: "none", borderRadius: 10, padding: "0 18px", cursor: "pointer", fontWeight: 800, fontSize: 14 }}>שלחי</button>
            </div>
          </div>
        )}

        {/* ── GAMES TAB ── */}
        {tab === "games" && (() => {
          // תוצאות משחקים = אירועי-משחק (כולל מהארכיון) שיש להם תוצאה. מהחדש לישן.
          const allEvents = [...(events || []), ...(archive || [])];
          const results = allEvents.filter(e => e.type === "game" && (e.outcome || e.result))
            .sort((a, b) => b.date.localeCompare(a.date));
          return (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: pc, marginBottom: 12 }}>🏆 תוצאות משחקים</h3>
            {results.length === 0 && <Empty icon="🏐" text="עדיין אין תוצאות משחקים" />}
            {results.map(g => (
              <div key={g.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{formatDate(g.date)} • {g.time}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>נגד: {g.opponent || "—"}</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>📍 {g.location}</div>
                </div>
                {g.outcome
                  ? <div style={{ textAlign: "center" }}><OutcomeBadge outcome={g.outcome} result={g.result} size="lg" /></div>
                  : <div style={{ background: `${pc}15`, borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>תוצאה</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: pc }}>{g.result}</div>
                    </div>
                }
              </div>
            ))}
          </div>
          );
        })()}

        {/* ── POLLS TAB ── */}
        {tab === "polls" && (
          <PlayerPolls polls={polls} player={player} players={players} upd={upd} pc={pc} sc={sc} />
        )}

        {/* ── GALLERY TAB ── */}
        {tab === "gallery" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: pc, margin: 0 }}>📸 תמונות מהמשחק</h3>
              <label style={{ background: galleryUploading ? "#94a3b8" : pc, color: "white", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: galleryUploading ? "default" : "pointer", opacity: galleryUploading ? 0.85 : 1 }}>
                {galleryUploading ? "מעלה..." : "+ העלי תמונה"}
                <input ref={galleryRef} type="file" accept="image/*" onChange={uploadGallery} disabled={galleryUploading} style={{ display: "none" }} />
              </label>
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px" }}>נא להעלות כאן רק תמונות מהמשחקים והאימונים של הקבוצה 🏐</p>
            <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 12px" }}>נותרו לך {Math.max(0, GALLERY_DAILY_LIMIT - uploadedTodayByPlayer())} תמונות להעלאה היום</p>
            {galleryMsg && <p style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, margin: "0 0 12px", textAlign: "center" }}>{galleryMsg}</p>}
            {gallery.length === 0 && <Empty icon="📸" text="אין תמונות עדיין - היי הראשונה!" />}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {[...gallery].reverse().map(item => (
                <div key={item.id} onClick={() => setSelectedPhoto(item)} style={{ borderRadius: 12, overflow: "hidden", position: "relative", cursor: "pointer" }}>
                  <img src={item.photo} style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.65))", padding: "16px 8px 6px" }}>
                    <div style={{ color: "white", fontSize: 11, fontWeight: 600 }}>{item.playerName}</div>
                    <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 10 }}>{item.eventTitle || new Date(item.date).toLocaleDateString("he-IL")}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Lightbox */}
            {selectedPhoto && (
              <div onClick={() => setSelectedPhoto(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
                <img src={selectedPhoto.photo} style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12, objectFit: "contain" }} />
                <div style={{ color: "white", fontSize: 13, fontWeight: 600, marginTop: 12 }}>{selectedPhoto.playerName}</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 4 }}>{selectedPhoto.eventTitle || new Date(selectedPhoto.date).toLocaleDateString("he-IL")}</div>
                {selectedPhoto.playerId === player.id && (
                  <button onClick={(e) => { e.stopPropagation(); askConfirm("למחוק את התמונה?", () => deleteGalleryPhoto(selectedPhoto)); }}
                    style={{ marginTop: 16, background: "#ef4444", color: "white", border: "none", borderRadius: 10, padding: "9px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    🗑️ מחקי תמונה
                  </button>
                )}
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 16 }}>לחץ לסגירה</div>
              </div>
            )}
          </div>
        )}

        {/* ── UPDATES TAB ── */}
        {tab === "updates" && (
          <div>
            {activeNotifs.length === 0 && <Empty icon="📭" text="אין עדכונים כרגע" />}
            {[...activeNotifs].reverse().map(n => (
              <div key={n.id} style={{ ...S.card, borderRight: `4px solid ${n.type === "cancel" ? "#ef4444" : n.type === "coach" ? sc : pc}`, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>
                  {n.type === "cancel" ? "❌ ביטול" : n.type === "coach" ? "📢 המאמן" : "💬 עדכון"} • {new Date(n.createdAt).toLocaleDateString("he-IL")}
                </div>
                <div style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.6 }}>{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {attModal && nextEvent && (
        <AttModal
          title={attModal === "coming" ? "✅ מגיעות" : attModal === "notcoming" ? "❌ לא מגיעות" : "⏳ טרם ענו"}
          list={getList(attModal)} players={players.map(p => ({ ...p, ...(playerProfiles[p.id] || {}) }))}
          attendance={attendance} eventId={nextEvent.id}
          onClose={() => setAttModal(null)} pc={pc} sc={sc} />
      )}
    </div>
  );
}

// ── PLAYER POLLS ──────────────────────────────────────────────────────────────
function PlayerPolls({ polls, player, players, upd, pc, sc }) {
  const activePolls = [...(polls || [])].filter(p => p.active !== false).reverse();
  const [showVoters, setShowVoters] = useState({}); // pollId -> bool: הצגת שמות המצביעות
  const nameOf = id => ((players || []).find(p => String(p.id) === String(id)) || {}).name || "—";

  async function vote(pollId, optionIdx) {
    const updated = polls.map(poll => {
      if (poll.id !== pollId) return poll;
      const votes = { ...(poll.votes || {}) };
      votes[player.id] = optionIdx; // one vote per player; re-voting replaces
      return { ...poll, votes };
    });
    await upd.polls(updated);
  }

  if (activePolls.length === 0) return <Empty icon="🗳️" text="אין סקרים פעילים כרגע" />;

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: pc, marginBottom: 12 }}>🗳️ סקר</h3>
      {activePolls.map(poll => {
        const votes = poll.votes || {};
        const myVote = votes[player.id];
        const hasVoted = myVote !== undefined;
        const total = Object.keys(votes).length;
        const counts = poll.options.map((_, i) => Object.values(votes).filter(v => v === i).length);
        return (
          <div key={poll.id} style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 4 }}>{poll.question}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>{total} {total === 1 ? "הצביעה" : "הצביעו"} • {hasVoted ? "הצבעת ✓ (ניתן לשנות)" : "בחרי תשובה"}</div>
            {poll.options.map((opt, i) => {
              const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
              const isMine = myVote === i;
              const voters = Object.entries(votes).filter(([, v]) => v === i).map(([pid]) => nameOf(pid));
              return (
                <div key={i}>
                  <button onClick={() => vote(poll.id, i)}
                    style={{ position: "relative", width: "100%", textAlign: "right", border: `2px solid ${isMine ? pc : "#e2e8f0"}`, borderRadius: 10, padding: "11px 14px", marginBottom: showVoters[poll.id] ? 2 : 8, cursor: "pointer", background: "white", overflow: "hidden" }}>
                    {hasVoted && <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: `${pct}%`, background: isMine ? `${pc}22` : "#f1f5f9", transition: "width 0.4s ease", zIndex: 0 }} />}
                    <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: isMine ? 800 : 600, color: isMine ? pc : "#1e293b" }}>{isMine ? "● " : ""}{opt}</span>
                      {hasVoted && <span style={{ fontSize: 13, fontWeight: 800, color: pc }}>{pct}% ({counts[i]})</span>}
                    </div>
                  </button>
                  {showVoters[poll.id] && (
                    <div style={{ fontSize: 11, color: "#64748b", padding: "0 6px 8px", lineHeight: 1.6 }}>
                      {counts[i] > 0 ? `👤 ${voters.join(" · ")}` : <span style={{ color: "#cbd5e1" }}>— אין מצביעות —</span>}
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={() => setShowVoters(s => ({ ...s, [poll.id]: !s[poll.id] }))} disabled={total === 0}
              style={{ background: showVoters[poll.id] ? `${pc}15` : "#f1f5f9", color: total === 0 ? "#cbd5e1" : pc, border: "none", borderRadius: 8, padding: "7px 12px", cursor: total === 0 ? "default" : "pointer", fontSize: 12, fontWeight: 700 }}>
              {showVoters[poll.id] ? "🙈 הסתר מצביעות" : "👁️ מי הצביעה"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
export { PlayerScreen };
