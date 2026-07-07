import { useState, useEffect, useRef } from "react";
import { db, auth } from "./firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from "firebase/auth";
import { googleProvider, isGoogleUser } from "./lib/auth";
import { DEFAULT_TEAM, SUPER_ADMIN_EMAIL, KEYS, DEFAULT_SETTINGS, WHATS_NEW, DEFAULT_PLAYERS, DEFAULT_EVENTS, DEFAULT_GAMES } from "./lib/constants";
import {
  CURRENT_TEAM, TEAM_FROM_URL, setCurrentTeam, load, save,
  loadAttendanceSplit, saveAttendanceSplit, loadProfilesSplit, saveProfilesSplit,
  resolveAdminTeam,
  pollVote, pollUpsert, pollSetActive, pollDelete, applauseAdd, personalNotifAdd, personalNotifSetItems,
} from "./lib/db";
import { isIOS } from "./lib/utils";
import { Confirm } from "./components/shared";
import { InstallScreen, WhatsNewScreen, LockedTeamScreen, Splash, PurchaseScreen, NotRegisteredScreen, LandingScreen, PendingRequestScreen, AdminLogin } from "./screens/gate";
import { SuperAdminScreen } from "./screens/superadmin";
import { HomeScreen, OnboardScreen } from "./screens/home";
import { PlayerScreen } from "./screens/player";
import { AdminPanel } from "./screens/admin";
import { HelpScreen, AboutScreen } from "./screens/info";

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("splash");
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [archive, setArchive] = useState([]);
  const [games, setGames] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [playerProfiles, setPlayerProfiles] = useState({});
  const [applause, setApplause] = useState([]);
  const [polls, setPolls] = useState([]);
  const [personalNotifs, setPersonalNotifs] = useState({});
  const [chat, setChat] = useState([]);
  const chatUnsubRef = useRef(null);
  const attUnsubRef = useRef(null);
  const pollsUnsubRef = useRef(null);
  const applauseUnsubRef = useRef(null);
  const pnUnsubRef = useRef(null);
  const [confirm, setConfirm] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [googleLoginError, setGoogleLoginError] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [teamMeta, setTeamMeta] = useState(null); // meta של הקבוצה הנוכחית (status/בעלות) — לשער הכניסה
  const [updateReady, setUpdateReady] = useState(false); // גרסה חדשה זמינה בשרת → באנר רענון

  // ── באנר "יש עדכון": משווים את מזהה ה-build המוטמע מול /version.json בשרת ─────
  // נבדק בכל חזרה לאפליקציה (focus) וכל 5 דקות. אין SW-cache, אז רענון = קוד חדש מיד.
  useEffect(() => {
    if (import.meta.env.DEV) return; // בפיתוח אין version.json
    let stop = false;
    async function check() {
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const v = await r.json();
        if (!stop && v.id && v.id !== __BUILD_ID__) setUpdateReady(true);
      } catch { /* אופליין/שגיאת רשת — ננסה שוב בפעם הבאה */ }
    }
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    const iv = setInterval(check, 5 * 60 * 1000);
    const t0 = setTimeout(check, 15 * 1000); // בדיקה ראשונה קצת אחרי הטעינה
    return () => { stop = true; document.removeEventListener("visibilitychange", onVisible); clearInterval(iv); clearTimeout(t0); };
  }, []);

  // ── שלב מעבר לאבטחה: bootstrap של Auth מתבצע באפקט המאוחד למטה ────────────────
  // קודם פותרים redirect של Google, ורק אם אין משתמש כלל — מתחברים אנונימית.
  // איחוד הרצף מונע מצב שבו ההתחברות האנונימית "דורסת" את תוצאת ה-redirect.

  // טוען את כל נתוני הקבוצה הנוכחית (CURRENT_TEAM). ניתן לקריאה חוזרת אחרי החלפת קבוצה.
  async function loadTeamData() {
    // ערכי ברירת המחדל (רשימת שחקניות/אירועים/משחקים לדוגמה) שייכים אך ורק לבינלאומי.
    // לכל קבוצה אחרת — fallback ריק, אחרת נתוני-הדוגמה של בינלאומי "דולפים" לקבוצה חדשה/ריקה.
    const isBibleumi = CURRENT_TEAM === DEFAULT_TEAM;
    const fbPlayers = isBibleumi ? DEFAULT_PLAYERS : [];
    const fbEvents = isBibleumi ? DEFAULT_EVENTS : [];
    const fbGames = isBibleumi ? DEFAULT_GAMES : [];
    const [p, e, a, n, s, ar, g, gal, pp] = await Promise.all([
      load(KEYS.players, fbPlayers),
      load(KEYS.events, fbEvents),
      loadAttendanceSplit(),
      load(KEYS.notifications, []),
      load(KEYS.settings, DEFAULT_SETTINGS),
      load(KEYS.archive, []),
      load(KEYS.games, fbGames),
      load(KEYS.gallery, []),
      loadProfilesSplit(),
    ]);
    setPlayers(p); setEvents(e); setAttendance(a); setNotifications(n);
    setSettings({ ...DEFAULT_SETTINGS, ...s });
    setArchive(ar); setGames(g); setGallery(gal); setPlayerProfiles(pp);
    // meta של הקבוצה (status/בעלות) — לשער הכניסה. חסר status ⇒ "active" (קבוצה ותיקה, לא נועלים)
    const m = await load(KEYS.meta, null);
    setTeamMeta(m);
    // ── שלב 3: סקרים/מחיאות/התראות בזמן-אמת (subcollection, מסמך-פר-פריט) ──────
    // מחליף את מודל המסמך-היחיד שאיבד כתיבות מקבילות (last-write-wins). כל listener
    // בונה מחדש את אותה צורה בזיכרון (מערך/מפה) כך שה-UI לא משתנה. התחלה נקייה
    // (כמו הצ'אט) — המסמכים הישנים data/{polls,applause,personalNotifs} נשמרים כגיבוי.
    if (pollsUnsubRef.current) pollsUnsubRef.current();
    pollsUnsubRef.current = onSnapshot(collection(db, "teams", CURRENT_TEAM, "polls"),
      snap => setPolls(snap.docs.map(d => d.data()).sort((a, b) => (a.id || 0) - (b.id || 0))),
      err => console.error("polls onSnapshot:", err));
    if (applauseUnsubRef.current) applauseUnsubRef.current();
    applauseUnsubRef.current = onSnapshot(collection(db, "teams", CURRENT_TEAM, "applause"),
      snap => setApplause(snap.docs.map(d => d.data())),
      err => console.error("applause onSnapshot:", err));
    if (pnUnsubRef.current) pnUnsubRef.current();
    pnUnsubRef.current = onSnapshot(collection(db, "teams", CURRENT_TEAM, "personalNotifs"),
      snap => { const map = {}; snap.forEach(d => { map[d.id] = d.data().items || []; }); setPersonalNotifs(map); },
      err => console.error("personalNotifs onSnapshot:", err));
    // צ'אט בזמן אמת — subcollection (כל הודעה = מסמך נפרד). אין דריסה, אין אובדן הודעות.
    // מוגבל ל-200 האחרונות; ממוין לפי ts. הפורמט זהה למערך הישן כך שה-UI לא משתנה.
    if (chatUnsubRef.current) chatUnsubRef.current();
    const chatQ = query(collection(db, "teams", CURRENT_TEAM, "chat"), orderBy("ts", "desc"), limit(200));
    chatUnsubRef.current = onSnapshot(chatQ,
      snap => {
        const msgs = snap.docs.map(d => ({ ...d.data(), _docId: d.id }));
        msgs.reverse(); // desc→asc: הישנה למעלה, החדשה למטה
        setChat(msgs);
      },
      err => console.error("chat onSnapshot:", err));
    // נוכחות בזמן אמת — כל שחקנית = מסמך attendance/{playerId}. listener מונע מצב שבו
    // מכשיר עובד מול state ישן ודורס רישומים של שחקניות אחרות (last-write-wins).
    if (attUnsubRef.current) attUnsubRef.current();
    attUnsubRef.current = onSnapshot(collection(db, "teams", CURRENT_TEAM, "attendance"),
      snap => {
        const flat = {};
        snap.forEach(d => {
          const evs = d.data() || {};
          for (const eventId in evs) flat[`${eventId}_${d.id}`] = evs[eventId];
        });
        setAttendance(flat);
      },
      err => console.error("attendance onSnapshot:", err));
    return { players: p, playerProfiles: pp, meta: m };
  }

  // משקיף בלבד על מצב ההזדהות (לא מתחבר — כך אין מרוץ עם ה-redirect). משמש לאבחון ולכפתור "המשך".
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthUser(u));
    return () => unsub();
  }, []);

  // ניקוי כל המנויים בזמן-אמת בעת יציאה
  useEffect(() => () => {
    [chatUnsubRef, attUnsubRef, pollsUnsubRef, applauseUnsubRef, pnUnsubRef].forEach(r => { if (r.current) r.current(); });
  }, []);

  useEffect(() => {
    (async () => {
      // ממתינים ש-Firebase ישחזר את ה-session השמורה (שחקנית מחוברת עם מייל) לפני שבודקים currentUser.
      // בלי זה, ב-bootstrap הראשוני currentUser=null עדיין, ואז signInAnonymously דורס את החיבור השמור
      // → השחקנית הופכת אנונימית בכל כניסה ונדרשת סיסמה מחדש.
      try { if (auth.authStateReady) await auth.authStateReady(); } catch (e) { console.error("authStateReady:", e); }
      const wasPending = sessionStorage.getItem("pendingGoogleLogin") === "1";
      sessionStorage.removeItem("pendingGoogleLogin");
      let adminUser = null;

      // 1) לפתור redirect של Google — אך ורק אם באמת חזרנו מ-redirect (wasPending).
      // באייפון/ספארי getRedirectResult עלול לתלות עד timeout ארוך (ITP); לקרוא לו בכל פתיחה
      // מאט את הטעינה לכל המשתמשות (גם שחקניות שלא ניסו להתחבר). מדלגים כשאין redirect ממתין.
      if (wasPending) {
        try {
          const result = await getRedirectResult(auth);
          if (result && result.user) adminUser = result.user;
        } catch (e) {
          console.error("Redirect login error:", e);
          setGoogleLoginError(e.code || e.message || "שגיאה לא ידועה");
          await loadTeamData();
          setScreen("admin-login");
          return;
        }
      }

      // גיבוי: אם getRedirectResult ריק אבל סשן Google נשמר — נשתמש במשתמש המחובר.
      // חשוב: רק חשבון Google = מנהל. חשבון שחקנית (Email/Password) לא-אנונימי אך אינו מנהל.
      if (!adminUser && isGoogleUser(auth.currentUser)) {
        adminUser = auth.currentUser;
      }

      // 2) אם אין משתמש כלל — התחברות אנונימית (טוקן בסיס לשחקניות)
      if (!auth.currentUser) {
        try { await signInAnonymously(auth); } catch (e) { console.error("Anon auth error:", e); }
      }

      // 3) אם זוהה מנהל — לזהות/לאמץ קבוצה ולעבור לפאנל
      if (adminUser) {
        const wantPurchase = sessionStorage.getItem("purchaseFlow") === "1";
        sessionStorage.removeItem("purchaseFlow");
        const teamId = await resolveAdminTeam(adminUser, wantPurchase);
        if (teamId === "__PENDING_REQUEST__") { setScreen("pending-request"); return; }
        if (teamId === "__NOT_REGISTERED__") { setScreen("not-registered"); return; }
        setCurrentTeam(teamId);
        await loadTeamData();
        setScreen("admin");
        return;
      }

      // אם ניסה להתחבר ולא הצליח — נחזיר אותו למסך הכניסה (לראות סטטוס ולנסות "המשך")
      if (wasPending) {
        await loadTeamData();
        setScreen("admin-login");
        return;
      }

      // 3.5) כניסה לכתובת חשופה (בלי ?team=) ואין מנהל מזוהה → דף נחיתה (שער ראשי), לא ניחוש קבוצה.
      if (!TEAM_FROM_URL) {
        setScreen("landing");
        return;
      }

      // 4) זרימה רגילה
      const td = await loadTeamData();
      // קבוצת-רפאים: ?team= שמצביע לקבוצה שלא קיימת (נמחקה/מזהה שגוי/pwaTeam ישן).
      // לכל קבוצה אמיתית יש meta. בלי הבדיקה: מסך ריק עם שם ברירת-מחדל מבלבל.
      if (CURRENT_TEAM !== DEFAULT_TEAM && !td?.meta) {
        try { localStorage.removeItem("pwaTeam"); localStorage.removeItem("currentTeamId"); } catch {}
        setScreen("landing");
        return;
      }
      const seenWhatsNew = parseInt(localStorage.getItem("whatsNewSeenVer") || "0");
      // מסך התקנה: מוצג בכל כניסה מהדפדפן — עד שמתקינות למסך הבית (ואז standalone=true
      // והוא נעלם מעצמו). ההתקנה קריטית: בלעדיה אין תזכורות push באייפון.
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
      // שחקנית שהמכשיר זוכר → קפיצה ישירה לעמוד שלה — אך ורק אם היא כבר מחוברת עם מייל (לא אנונימית).
      // אם היא אנונימית (הטוקן פג/נפלה ל-anon) → לא קופצים; היא תעבור דרך מסך הבית→כניסה כדי להתחבר נכון,
      // אחרת תישאר אנונימית ותיחסם בצ'אט/קריאת נוכחות (permission-denied).
      const authedWithEmail = auth.currentUser && !auth.currentUser.isAnonymous;
      const remembered = authedWithEmail ? (td?.players || []).find(p => localStorage.getItem("rememberPlayer_" + p.id) === "1") : null;
      setTimeout(() => {
        if (!isStandalone) setShowInstall(true);
        else if (seenWhatsNew < WHATS_NEW.version) setShowWhatsNew(true);
        else if (remembered) { setCurrentPlayer(remembered); setScreen(s => s === "splash" ? "player" : s); }
        else setScreen(s => s === "splash" ? "home" : s);
      }, 1200);
    })();
  }, []);

  // התחברות מנהל עם Google.
  // אנדרואיד/מחשב: popup (אמין, לא תלוי אחסון בין-דומייני), עם נפילה ל-redirect אם נחסם.
  // אייפון/iPadOS: redirect ישיר — שם ה-popup לא אמין (ITP מאבד את התוצאה בדרך חזרה).
  async function handleGoogleLogin(purchaseFlow) {
    setGoogleLoginError("");
    if (isIOS()) {
      try {
        sessionStorage.setItem("pendingGoogleLogin", "1");
        if (purchaseFlow) sessionStorage.setItem("purchaseFlow", "1"); else sessionStorage.removeItem("purchaseFlow");
        await signInWithRedirect(auth, googleProvider);
        return { ok: true };
      } catch (e) {
        console.error("iOS Google redirect error:", e);
        sessionStorage.removeItem("pendingGoogleLogin");
        return { ok: false, error: e.code || e.message };
      }
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const teamId = await resolveAdminTeam(result.user, !!purchaseFlow);
      if (teamId === "__PENDING_REQUEST__") { setScreen("pending-request"); return { ok: true }; }
      if (teamId === "__NOT_REGISTERED__") { setScreen("not-registered"); return { ok: true }; }
      setCurrentTeam(teamId);
      await loadTeamData();
      setScreen("admin");
      return { ok: true };
    } catch (e) {
      console.error("Google popup error:", e);
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
        return { ok: false, error: "" }; // המשתמש סגר — לא שגיאה אמיתית
      }
      // popup נחסם או לא נתמך → ננסה redirect
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
        try {
          sessionStorage.setItem("pendingGoogleLogin", "1");
          if (purchaseFlow) sessionStorage.setItem("purchaseFlow", "1"); else sessionStorage.removeItem("purchaseFlow");
          await signInWithRedirect(auth, googleProvider);
          return { ok: true };
        } catch (e2) {
          console.error("Google redirect error:", e2);
          return { ok: false, error: e2.code || e2.message };
        }
      }
      return { ok: false, error: e.code || e.message };
    }
  }

  // מסלול חלופי: אם כבר מחובר עם Google (הסשן נשמר) — להיכנס בלי redirect נוסף.
  async function continueAsAdmin(purchaseFlow) {
    if (!isGoogleUser(auth.currentUser)) return { ok: false, error: "אין משתמש Google מחובר" };
    const teamId = await resolveAdminTeam(auth.currentUser, !!purchaseFlow);
    if (teamId === "__PENDING_REQUEST__") { setScreen("pending-request"); return { ok: true }; }
    if (teamId === "__NOT_REGISTERED__") { setScreen("not-registered"); return { ok: true }; }
    setCurrentTeam(teamId);
    await loadTeamData();
    setScreen("admin");
    return { ok: true };
  }

  // התנתקות שחקנית: יוצא מחשבון Firebase שלה, חוזר לטוקן אנונימי, וחוזר למסך הבית (בחירת שם).
  async function handlePlayerLogout() {
    try { await signOut(auth); } catch (e) { console.error("player signOut:", e); }
    try { await signInAnonymously(auth); } catch (e) { console.error("anon after player logout:", e); }
    setScreen("home");
  }

  // התנתקות מנהל: יוצא מ-Google, חוזר לטוקן אנונימי (כדי שהשחקניות ימשיכו לעבוד), חוזר לבינלאומי ולמסך הבית.
  async function handleAdminLogout() {
    try { await signOut(auth); } catch (e) { console.error("signOut:", e); }
    try { await signInAnonymously(auth); } catch (e) { console.error("anon after logout:", e); }
    setCurrentTeam(DEFAULT_TEAM);
    await loadTeamData();
    setScreen("home");
  }

  // כניסה לסופר אדמין (לחיצה ארוכה על הלוגו). רק בעל המוצר. אם מחובר כבר — נכנס; אחרת Google.
  async function enterSuperAdmin() {
    const cur = (auth.currentUser?.email || "").toLowerCase();
    if (cur === SUPER_ADMIN_EMAIL) { setScreen("superAdmin"); return; }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if ((result.user.email || "").toLowerCase() === SUPER_ADMIN_EMAIL) setScreen("superAdmin");
      else setScreen("superAdmin"); // נכנס למסך — שם יוצג "אין הרשאה" אם לא הבעלים
    } catch (e) { console.error("super admin login:", e); }
  }


  const upd = {
    players: async v => { setPlayers(v); await save(KEYS.players, v); },
    events: async v => { setEvents(v); await save(KEYS.events, v); },
    attendance: async v => { setAttendance(v); await saveAttendanceSplit(attendance, v); },
    notifications: async v => { setNotifications(v); await save(KEYS.notifications, v); },
    settings: async v => { setSettings(v); await save(KEYS.settings, v); },
    archive: async v => { setArchive(v); await save(KEYS.archive, v); },
    games: async v => { setGames(v); await save(KEYS.games, v); },
    gallery: async v => { setGallery(v); await save(KEYS.gallery, v); },
    playerProfiles: async v => { setPlayerProfiles(v); await saveProfilesSplit(playerProfiles, v); },
    // שלב 3 — כתיבות ממוקדות (בלי read-modify-write). ה-state מתעדכן מה-listeners.
    pollVote, pollUpsert, pollSetActive, pollDelete,
    applauseAdd, personalNotifAdd, personalNotifSetItems,
    installVersion: async v => { setSettings(s => ({ ...s, installVersion: v })); await save(KEYS.installVersion, v); },
  };

  function askConfirm(msg, onOk) { setConfirm({ msg, onOk }); }
  // עדכון אופטימי: מציג הודעת צ'אט מיד לשולחת, בלי להמתין ל-listener. ה-listener יחליף לפי _docId (אין כפילות).
  function addChatLocal(msg) {
    setChat(prev => {
      if (prev.some(m => m._docId === msg._docId || m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }
  // התראת-יידוע מעוצבת (כפתור אחד). מחליפה את חלון ה-alert המכוער של הדפדפן.
  function notify(msg, opts) { setConfirm({ msg, notice: true, icon: opts?.icon, okLabel: opts?.okLabel, tone: opts?.tone }); }

  const pc = settings.primaryColor || "#1a237e";
  const sc = settings.secondaryColor || "#f5c842";
  const common = { players, events, attendance, notifications, settings, archive, games, gallery, playerProfiles, applause, polls, personalNotifs, chat, upd, pc, sc, askConfirm, notify, teamMeta, addChatLocal };

  // ── שער כניסה (מסחור) ────────────────────────────────────────────────────────
  // קבוצה ללא status נחשבת "active" (ותיקה — לא נועלים). רק "pending" מפורש נועל לשחקניות.
  const teamStatus = teamMeta?.status || "active";
  const isTeamAdmin = !!(authUser && !authUser.isAnonymous && teamMeta && (teamMeta.adminUids || []).includes(authUser.uid));
  const lockedForPlayers = teamStatus === "pending" && !isTeamAdmin;

  if (screen === "splash" && !showInstall && !showWhatsNew) return <Splash pc={pc} sc={sc} />;
  if (screen === "superAdmin") return <SuperAdminScreen pc={pc} sc={sc} authUser={authUser} onGoogle={handleGoogleLogin} onBack={() => setScreen("home")} />;
  if (screen === "landing") return <LandingScreen pc={pc} sc={sc}
    onAdminLogin={() => setScreen("admin-login")}
    onPurchase={() => setScreen("purchase")}
    onEnterBibleumi={async () => { setCurrentTeam(DEFAULT_TEAM); await loadTeamData(); setScreen("home"); }} />;
  if (screen === "purchase") return <PurchaseScreen pc={pc} sc={sc} authUser={authUser}
    onGoogle={() => handleGoogleLogin(true)} onContinue={() => continueAsAdmin(true)}
    onBack={() => setScreen(TEAM_FROM_URL ? "home" : "landing")} />;
  if (screen === "not-registered") return <NotRegisteredScreen pc={pc} sc={sc} authUser={authUser}
    onPurchase={() => setScreen("purchase")} onLogout={handleAdminLogout}
    onBack={() => setScreen(TEAM_FROM_URL ? "home" : "landing")} />;
  if (screen === "pending-request") return <PendingRequestScreen pc={pc} sc={sc} authUser={authUser} onLogout={handleAdminLogout} onBack={() => setScreen("home")} />;
  if (showInstall) return <InstallScreen pc={pc} sc={sc} installVersion={settings.installVersion||1} onDone={(ver) => {
    localStorage.setItem("installSeenVer", String(ver));
    setShowInstall(false);
    const seenWhatsNew = parseInt(localStorage.getItem("whatsNewSeenVer") || "0");
    if (seenWhatsNew < WHATS_NEW.version) setShowWhatsNew(true); else setScreen("home");
  }} />;
  if (showWhatsNew) return <WhatsNewScreen pc={pc} sc={sc} onDone={() => {
    localStorage.setItem("whatsNewSeenVer", String(WHATS_NEW.version));
    setShowWhatsNew(false); setScreen("home");
  }} />;

  // קבוצה pending: השחקניות רואות מסך נעילה. המנהלת (admin-login/admin/superAdmin) ממשיכה רגיל.
  if (lockedForPlayers && (screen === "home" || screen === "onboard" || screen === "player")) {
    return <LockedTeamScreen pc={pc} sc={sc} settings={settings} onAdmin={() => setScreen("admin-login")} />;
  }

  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: "#f1f5f9" }}>
      <style>{`
        /* מעבר-מסך = דעיכת-שקיפות בלבד. חשוב: אין transform! transform על ההורה יוצר
           containing-block שגורם ל-position:fixed (התפריט התחתון) להיתלות בתוכן במקום
           בחלון — ואז צריך לגלול כדי לראות את התפריט. opacity לבד לא יוצר את הבעיה. */
        @keyframes screenFade { from { opacity: 0; } to { opacity: 1; } }
        .screen-fade { animation: screenFade 0.28s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .screen-fade { animation: none !important; }
          .collapse-grid { transition: none !important; }
        }
      `}</style>
      {confirm && <Confirm msg={confirm.msg} icon={confirm.icon} okLabel={confirm.okLabel} tone={confirm.tone}
        onOk={() => { if (confirm.onOk) confirm.onOk(); setConfirm(null); }}
        onCancel={confirm.notice ? undefined : () => setConfirm(null)} />}

      {/* באנר "יש עדכון" — כמו ב-televizia: מוצג כשנפרסה גרסה חדשה; לחיצה = רענון לקוד החדש */}
      {updateReady && (
        <button onClick={() => window.location.reload()}
          style={{ position: "fixed", top: 10, left: 12, right: 12, zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: pc, color: "white", border: `2px solid ${sc}`, borderRadius: 14, padding: "12px 16px", cursor: "pointer",
            fontSize: 14, fontWeight: 800, boxShadow: "0 8px 30px rgba(0,0,0,0.35)" }}>
          <span style={{ fontSize: 18 }}>🚀</span> יש גרסה חדשה! לחצי כאן לעדכון
        </button>
      )}

      <div key={screen} className="screen-fade">
        {screen === "home" && <HomeScreen {...common} onSelectPlayer={p => {
          setCurrentPlayer(p);
          const remembered = localStorage.getItem("rememberPlayer_" + p.id) === "1";
          const authedWithEmail = auth.currentUser && !auth.currentUser.isAnonymous;
          // קפיצה ישירה לעמוד רק אם השחקנית מחוברת עם מייל. אם אנונימית — דרך onboard (סיסמה→emailAuth),
          // אחרת תיכנס בלי טוקן-מייל ותיחסם בצ'אט/נוכחות.
          if (remembered && authedWithEmail && playerProfiles[p.id]?.setupDone) setScreen("player");
          else setScreen("onboard");
        }} onAdmin={() => setScreen("admin-login")} onHelp={() => setScreen("help")} onAbout={() => setScreen("about")} onSuperAdmin={enterSuperAdmin} onPurchase={() => setScreen("purchase")} />}
        {screen === "onboard" && <OnboardScreen {...common} player={currentPlayer} onDone={() => setScreen("player")} onBack={() => setScreen("home")} />}
        {screen === "player" && <PlayerScreen {...common} player={currentPlayer} onBack={() => setScreen("home")} onLogout={handlePlayerLogout} />}
        {screen === "admin-login" && <AdminLogin pc={pc} sc={sc} onGoogle={handleGoogleLogin} onContinue={continueAsAdmin} authUser={authUser} initialError={googleLoginError} onBack={() => { setGoogleLoginError(""); setScreen("home"); }} />}
        {screen === "admin" && <AdminPanel {...common} onBack={() => setScreen("home")} onLogout={handleAdminLogout} />}
        {screen === "help" && <HelpScreen pc={pc} sc={sc} settings={settings} onBack={() => setScreen("home")} />}
        {screen === "about" && <AboutScreen pc={pc} sc={sc} settings={settings} onBack={() => setScreen("home")} />}
      </div>
    </div>
  );
}
