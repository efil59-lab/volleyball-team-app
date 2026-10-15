import { useEffect, useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase";
import { CURRENT_TEAM } from "../lib/db";
import { compressImage } from "../lib/images";
import { activeTournament, canSeeTournament, ourScore, isoLocal } from "../lib/tournament";

// ── הפתעה: ניצחון על המשטרה (ספורטיאדה 2026) ─────────────────────────────────
// אפי, 15.10.26: "אם במקרה ינצחו את קבוצת השוטרים — הפתעה בכניסה לאפליקציה".
// אין שום מתג להדליק: ברגע שנשמרת תוצאה של ניצחון במשחק הזה, כל שחקנית
// שנכנסת מקבלת פעם אחת מסך חגיגה, וכרטיס הספורטיאדה מוזהב עד סוף אותו יום.
// בהפסד, או בלי תוצאה — לא קורה כלום. בלי פוש (כבוי בכוונה, ראה RESULT_PUSH).
//
// התמונה (רשות) מועלית מפאנל הניהול ונשמרת ב-state של הטורניר (celebratePhoto),
// לא בקוד — הריפו ציבורי.
const CELEBRATE = { tournamentId: "sportiada-2026", gameId: "g3", title: "🚨 עצרנו את המשטרה!" };

// הניצחון, אם יש: { game, score } או null
export function celebrationFor(t, state) {
  if (!t || t.id !== CELEBRATE.tournamentId || !state) return null;
  const game = t.games.find((g) => g.id === CELEBRATE.gameId);
  const score = game && ourScore(t, state.results || {}, game);
  return score && score.won ? { game, score } : null;
}
// מסך החגיגה בתוקף רק עד שמתחיל המשחק הבא שלנו (אפי, 15.10.26): מי שנכנסת
// אחרי חצי הגמר כבר לא צריכה לקבל "עצרנו את המשטרה" כחדשה — אולי אפילו אחרי
// הפסד. בלי משחק הבא (סיימנו) — עד סוף יום הניצחון.
const at = (g) => new Date(`${g.date}T${g.time || "00:00"}:00`);
function celebrationEnds(t, game) {
  const next = t.games
    .filter((g) => (g.a === t.us || g.b === t.us) && at(g) > at(game))
    .sort((x, y) => at(x) - at(y))[0];
  return next ? at(next) : new Date(`${game.date}T23:59:59`);
}
export function celebrationOpen(t, state, now = new Date()) {
  const c = celebrationFor(t, state);
  return !!c && now < celebrationEnds(t, c.game);
}
// הכרטיס מוזהב רק ביום הניצחון עצמו
export function celebratingToday(t, state, now = new Date()) {
  const c = celebrationFor(t, state);
  return !!c && isoLocal(now) === c.game.date;
}

const BITS = ["🏐", "🎉", "🏆", "⭐", "🏐", "🎊", "💙", "🏐", "⭐", "🎉", "🏐", "💛", "🎊", "🏐", "⭐", "🏆", "🎉", "🏐"];

export function Celebration({ t, state, onClose }) {
  const c = celebrationFor(t, state);
  if (!c) return null;
  const photo = state.celebratePhoto;
  return (
    <div className="vb-cel" role="dialog" aria-label="חגיגת ניצחון" onClick={onClose}>
      <style>{CSS}</style>
      <div className="vb-cel-siren" aria-hidden="true"><i /><i /></div>
      <div className="vb-cel-rain" aria-hidden="true">
        {BITS.map((b, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.35}s`, animationDuration: `${2.8 + (i % 5) * 0.45}s` }}>{b}</span>)}
      </div>
      <div className="vb-cel-card" onClick={(e) => e.stopPropagation()}>
        <div className="vb-cel-kicker">☀️ {t.name} · {t.city} {t.year}</div>
        <h2>{CELEBRATE.title}</h2>
        <div className="vb-cel-score">{c.score.us}–{c.score.them}</div>
        <p>ניצחון על משטרת ישראל ת״א.<br />איזו קבוצה! 💙</p>
        {photo && <img src={photo} alt="הקבוצה" />}
        <button onClick={onClose}>יאללה! 🎉</button>
      </div>
    </div>
  );
}

// מופיע פעם אחת לכל מכשיר, אחרי שהניצחון נשמר. נטען בדף הבית ובמסך האישי.
export function CelebrationGate({ tournaments, player }) {
  const t = activeTournament();
  const state = t ? (tournaments || {})[t.id] : null;
  const key = `vb_celebrated_${CELEBRATE.tournamentId}_${CELEBRATE.gameId}`;
  const [open, setOpen] = useState(false);
  const due = !!(t && state && canSeeTournament(state, player) && celebrationOpen(t, state));
  useEffect(() => {
    if (!due) return;
    let seen = false;
    try { seen = localStorage.getItem(key) === "1"; } catch {}
    if (!seen) setOpen(true);
  }, [due]);
  if (!open) return null;
  const close = () => { try { localStorage.setItem(key, "1"); } catch {} setOpen(false); };
  return <Celebration t={t} state={state} onClose={close} />;
}

// פאנל הניהול: תמונה למסך החגיגה + תצוגה מקדימה (גם לפני שיש ניצחון)
export function CelebrationAdmin({ t, state, merge, notify, askConfirm }) {
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  if (!t || t.id !== CELEBRATE.tournamentId) return null;
  const photo = state.celebratePhoto || null;
  async function upload(file) {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) { notify && notify("אפשר להעלות רק תמונה"); return; }
    setBusy(true);
    try {
      const img = await compressImage(file);
      const path = `teams/${CURRENT_TEAM}/gallery/celebrate_${Date.now()}.jpg`;
      const r = ref(storage, path);
      await uploadBytes(r, img);
      const url = await getDownloadURL(r);
      if (state.celebratePhotoPath) { try { await deleteObject(ref(storage, state.celebratePhotoPath)); } catch {} }
      await merge(t.id, { celebratePhoto: url, celebratePhotoPath: path });
      notify && notify("התמונה נשמרה למסך החגיגה", { icon: "✅" });
    } catch (e) { console.error("celebrate photo:", e); notify && notify("העלאת התמונה נכשלה, נסי שוב"); }
    setBusy(false);
  }
  async function remove() {
    setBusy(true);
    try {
      if (state.celebratePhotoPath) { try { await deleteObject(ref(storage, state.celebratePhotoPath)); } catch {} }
      await merge(t.id, { celebratePhoto: null, celebratePhotoPath: null });
    } catch {}
    setBusy(false);
  }
  // תצוגה מקדימה: אותו מסך בדיוק, עם תוצאה מדומה אם עוד אין ניצחון
  const demo = celebrationFor(t, state) ? state : { ...state, results: { ...(state.results || {}), [CELEBRATE.gameId]: { a: 17, b: 21 } } };
  const btn = { border: "none", borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
  return (
    <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: "#16203a" }}>🚨 הפתעה אם מנצחות את המשטרה</div>
      <div style={{ fontSize: 12.5, color: "#5b6478", margin: "4px 0 10px", lineHeight: 1.55 }}>
        ברגע שנשמרת תוצאה של ניצחון במשחק מול המשטרה, כל שחקנית שנכנסת מקבלת פעם אחת מסך חגיגה — עד שמתחיל המשחק הבא שלנו. כרטיס הספורטיאדה מוזהב עד סוף היום. בלי פוש. אפשר להוסיף תמונה.
      </div>
      {photo && <img src={photo} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, display: "block", marginBottom: 8 }} />}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ ...btn, background: "#1a237e", color: "#fff", opacity: busy ? 0.6 : 1 }}>
          {busy ? "מעלה…" : photo ? "📷 החלפת תמונה" : "📷 הוספת תמונה"}
          <input type="file" accept="image/*" disabled={busy} style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; upload(f); }} />
        </label>
        {photo && <button disabled={busy} onClick={() => askConfirm ? askConfirm("להסיר את התמונה ממסך החגיגה?", remove) : remove()} style={{ ...btn, background: "#fef2f2", color: "#ef4444" }}>🗑️ הסרה</button>}
        <button onClick={() => setShow(true)} style={{ ...btn, background: "#fff", color: "#1a237e", border: "1.5px solid #1a237e" }}>👀 תצוגה מקדימה</button>
      </div>
      {show && <Celebration t={t} state={demo} onClose={() => setShow(false)} />}
    </div>
  );
}

const CSS = `
.vb-cel { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center; padding: 18px;
  background: radial-gradient(120% 90% at 50% 20%, #2a36a8 0%, #1a237e 50%, #0b0f3a 100%); overflow: hidden; animation: vbCelIn .35s ease-out both; }
@keyframes vbCelIn { from { opacity: 0; } to { opacity: 1; } }
.vb-cel-siren { position: absolute; top: 0; left: 0; right: 0; height: 120px; display: flex; pointer-events: none; }
.vb-cel-siren i { flex: 1; animation: vbSiren 0.9s steps(1) infinite; }
.vb-cel-siren i:first-child { background: radial-gradient(70% 100% at 50% 0%, rgba(59,130,246,.85), transparent 70%); }
.vb-cel-siren i:last-child { background: radial-gradient(70% 100% at 50% 0%, rgba(239,68,68,.85), transparent 70%); animation-delay: .45s; }
@keyframes vbSiren { 0% { opacity: 1; } 50% { opacity: .1; } }
.vb-cel-rain { position: absolute; inset: 0; pointer-events: none; }
.vb-cel-rain span { position: absolute; top: -50px; font-size: 30px; animation-name: vbFall; animation-timing-function: linear; animation-iteration-count: infinite; }
@keyframes vbFall { from { transform: translateY(0) rotate(0deg); } to { transform: translateY(110vh) rotate(360deg); } }
.vb-cel-card { position: relative; width: 100%; max-width: 400px; max-height: calc(100dvh - 36px); overflow-y: auto; text-align: center; color: #fff;
  background: rgba(16, 22, 79, .82); border: 2px solid #f5c842; border-radius: 26px; padding: 24px 20px 20px; box-shadow: 0 24px 60px rgba(0,0,0,.5);
  animation: vbPop .6s cubic-bezier(.2, 1.4, .35, 1) .15s both; }
@keyframes vbPop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
.vb-cel-kicker { font-size: 12.5px; font-weight: 800; letter-spacing: .04em; opacity: .9; }
.vb-cel-card h2 { margin: 8px 0 0; font-size: 34px; font-weight: 900; line-height: 1.15; color: #f5c842; }
.vb-cel-score { margin-top: 8px; font-size: 58px; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; direction: ltr; }
.vb-cel-card p { margin: 10px 0 0; font-size: 16px; line-height: 1.55; opacity: .95; }
.vb-cel-card img { display: block; width: 100%; max-height: 38vh; object-fit: cover; border-radius: 16px; margin-top: 14px; border: 2px solid rgba(255,255,255,.25); }
.vb-cel-card button { margin-top: 16px; width: 100%; border: none; border-radius: 999px; padding: 14px; background: #f5c842; color: #10163f; font-size: 17px; font-weight: 900; cursor: pointer; font-family: inherit; }
@media (prefers-reduced-motion: reduce) { .vb-cel-rain, .vb-cel-siren { display: none; } .vb-cel, .vb-cel-card { animation: none; } }
`;
