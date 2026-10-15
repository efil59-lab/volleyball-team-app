import { useEffect, useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase";
import { CURRENT_TEAM } from "../lib/db";
import { compressImage } from "../lib/images";
import { activeTournament, canSeeTournament, ourScore, ourPlace, describeGame, isoLocal } from "../lib/tournament";

// ── הפתעות ניצחון בספורטיאדה ──────────────────────────────────────────────────
// אפי, 15.10.26: הפתעה בכניסה לאפליקציה אם מנצחות את המשטרה, ואחר כך גם
// לחצי הגמר ולגמר. אין שום מתג להדליק: ברגע שנשמרת תוצאה של ניצחון באחד
// המשחקים האלה, כל שחקנית שנכנסת מקבלת פעם אחת מסך חגיגה, וכרטיס הספורטיאדה
// מוזהב עם הכותרת המתאימה עד סוף אותו יום. בהפסד — כלום. בלי פוש.
//
// כל חגיגה בתוקף רק עד שמתחיל המשחק הבא שלנו (מי שנכנסת אחרי חצי הגמר לא
// צריכה לקבל "עצרנו את המשטרה" כחדשה). לגמר אין משחק הבא, אז הוא נשאר כמה ימים.
//
// התמונות (רשות) מועלות מפאנל הניהול ונשמרות ב-state של הטורניר, לא בקוד —
// הריפו ציבורי. לחגיגת המשטרה השדה הוא celebratePhoto (השם הראשון שהיה),
// לאחרות celebratePhoto_<gameId>.
const TOURNAMENT_ID = "sportiada-2026";
const DAY = 86400000;

const CELEBRATIONS = [
  {
    gameId: "g3", theme: "police", rain: ["🏐", "🎉", "🏆", "⭐", "🎊", "💙", "💛"],
    title: () => "🚨 עצרנו את המשטרה!",
    line: () => <>ניצחון על משטרת ישראל ת״א.<br />איזו קבוצה! 💙</>,
    card: "🏆 ניצחנו את המשטרה!",
  },
  {
    gameId: "sf", theme: "fire", rain: ["🔥", "🏐", "⭐", "🔥", "🎉", "💥", "🧡"],
    title: () => "🔥 עלינו לגמר!",
    line: ({ opp, named, next }) => <>{named ? <>ניצחנו את {opp} בחצי הגמר.</> : "ניצחנו בחצי הגמר!"}<br />{next ? <>נתראה בגמר ב-{next.time}, {next.hall}! 💪</> : "עכשיו — הגמר! 💪"}</>,
    card: "🔥 עלינו לגמר!",
  },
  {
    gameId: "fn", theme: "gold", rain: ["🏆", "🥇", "✨", "🎉", "⭐", "🏐", "💛", "🎊"], linger: 3 * DAY,
    title: ({ bracket }) => `🏆 זכינו בגמר ${bracket ? "ה" + bracket : ""}!`.replace("  ", " "),
    line: ({ opp, named }) => <>{named ? <>ניצחנו את {opp} בגמר.</> : "ניצחנו בגמר!"}<br />הספורטיאדה 2026 שלנו! 💙💛</>,
    card: "🏆 זכינו בגמר!",
  },
];

const photoField = (gameId) => (gameId === "g3" ? "celebratePhoto" : `celebratePhoto_${gameId}`);
const seenKey = (gameId) => `vb_celebrated_${TOURNAMENT_ID}_${gameId}`;
const at = (g) => new Date(`${g.date}T${g.time || "00:00"}:00`);

// הניצחון במשחק של החגיגה, אם יש: { cfg, game, score, opp, bracket, next } או null
function winFor(t, state, cfg) {
  if (!t || t.id !== TOURNAMENT_ID || !state) return null;
  const results = state.results || {};
  const game = t.games.find((g) => g.id === cfg.gameId);
  const score = game && ourScore(t, results, game);
  if (!score || !score.won) return null;
  const d = describeGame(t, results, game);
  const k = t.ko[ourPlace(t, results)];
  const nextGame = t.games
    .filter((g) => (g.a === t.us || g.b === t.us) && at(g) > at(game))
    .sort((x, y) => at(x) - at(y))[0];
  const next = nextGame ? { ...describeGame(t, results, nextGame), time: nextGame.time } : null;
  // named: היריבה ידועה בשם (משחק בית, או שם שהוזן) — אחרת "מקום 2 בבית ג" וכו׳, שלא נשמע טוב במשפט
  const named = game.stage === "group" || !!(results[game.id] && results[game.id].opp);
  return { cfg, game, score, opp: d.opp, named, bracket: k && k.bracket, next: next && !next.out ? next : null, nextGame };
}
function ends(w) {
  return w.nextGame ? at(w.nextGame) : new Date(at(w.game).getTime() + (w.cfg.linger || 0) + DAY);
}

// החגיגה שבתוקף עכשיו (האחרונה בזמן), או null
function openCelebration(t, state, now = new Date()) {
  const open = CELEBRATIONS.map((c) => winFor(t, state, c)).filter((w) => w && now < ends(w));
  return open.sort((x, y) => at(y.game) - at(x.game))[0] || null;
}
// הכרטיס ביום ניצחון: הכותרת המתאימה (מחרוזת), או null. האחרון באותו יום גובר.
export function celebratingToday(t, state, now = new Date()) {
  const today = isoLocal(now);
  const wins = CELEBRATIONS.map((c) => winFor(t, state, c)).filter((w) => w && w.game.date === today);
  wins.sort((x, y) => at(y.game) - at(x.game));
  return wins[0] ? wins[0].cfg.card : null;
}

export function Celebration({ t, state, win, onClose }) {
  if (!win) return null;
  const { cfg, score } = win;
  const photo = state[photoField(cfg.gameId)];
  const rain = Array.from({ length: 18 }, (_, i) => cfg.rain[i % cfg.rain.length]);
  return (
    <div className={`vb-cel vb-cel-${cfg.theme}`} role="dialog" aria-label="חגיגת ניצחון" onClick={onClose}>
      <style>{CSS}</style>
      {cfg.theme === "police" && <div className="vb-cel-siren" aria-hidden="true"><i /><i /></div>}
      {cfg.theme === "gold" && <div className="vb-cel-rays" aria-hidden="true" />}
      <div className="vb-cel-rain" aria-hidden="true">
        {rain.map((b, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.35}s`, animationDuration: `${2.8 + (i % 5) * 0.45}s` }}>{b}</span>)}
      </div>
      <div className="vb-cel-card" onClick={(e) => e.stopPropagation()}>
        {cfg.theme === "gold" && <div className="vb-cel-cup" aria-hidden="true">🏆</div>}
        <div className="vb-cel-kicker">☀️ {t.name} · {t.city} {t.year}</div>
        <h2>{cfg.title(win)}</h2>
        <div className="vb-cel-score">{score.us}–{score.them}</div>
        <p>{cfg.line(win)}</p>
        {photo && <img src={photo} alt="הקבוצה" />}
        <button onClick={onClose}>יאללה! 🎉</button>
      </div>
    </div>
  );
}

// מופיע פעם אחת לכל מכשיר ולכל ניצחון. נטען בדף הבית ובמסך האישי (App.jsx).
export function CelebrationGate({ tournaments, player }) {
  const t = activeTournament();
  const state = t ? (tournaments || {})[t.id] : null;
  const win = t && state && canSeeTournament(state, player) ? openCelebration(t, state) : null;
  const id = win ? win.cfg.gameId : null;
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!id) return;
    let seen = false;
    try { seen = localStorage.getItem(seenKey(id)) === "1"; } catch {}
    if (!seen) setShown(id);
  }, [id]);
  if (!win || shown !== id) return null;
  const close = () => { try { localStorage.setItem(seenKey(id), "1"); } catch {} setShown(null); };
  return <Celebration t={t} state={state} win={win} onClose={close} />;
}

// ── פאנל הניהול: לכל חגיגה — תמונה ותצוגה מקדימה (גם לפני שיש ניצחון) ──
const LABELS = { g3: "🚨 ניצחון על המשטרה", sf: "🔥 ניצחון בחצי הגמר", fn: "🏆 ניצחון בגמר" };
// תוצאות מדומות לתצוגה המקדימה: ניצחון בכל מה שצריך כדי להגיע לחגיגה
const DEMO = { g3: { a: 17, b: 21 }, sf: { a: 21, b: 15 }, fn: { a: 21, b: 18 } };

export function CelebrationAdmin({ t, state, merge, notify, askConfirm }) {
  const [busy, setBusy] = useState(null);
  const [show, setShow] = useState(null);
  if (!t || t.id !== TOURNAMENT_ID) return null;

  async function upload(gameId, file) {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) { notify && notify("אפשר להעלות רק תמונה"); return; }
    setBusy(gameId);
    try {
      const img = await compressImage(file);
      const path = `teams/${CURRENT_TEAM}/gallery/celebrate_${gameId}_${Date.now()}.jpg`;
      const r = ref(storage, path);
      await uploadBytes(r, img);
      const url = await getDownloadURL(r);
      const f = photoField(gameId);
      if (state[f + "Path"]) { try { await deleteObject(ref(storage, state[f + "Path"])); } catch {} }
      await merge(t.id, { [f]: url, [f + "Path"]: path });
      notify && notify("התמונה נשמרה למסך החגיגה", { icon: "✅" });
    } catch (e) { console.error("celebrate photo:", e); notify && notify("העלאת התמונה נכשלה, נסי שוב"); }
    setBusy(null);
  }
  async function remove(gameId) {
    setBusy(gameId);
    const f = photoField(gameId);
    try {
      if (state[f + "Path"]) { try { await deleteObject(ref(storage, state[f + "Path"])); } catch {} }
      await merge(t.id, { [f]: null, [f + "Path"]: null });
    } catch {}
    setBusy(null);
  }
  function preview(cfg) {
    // הניצחון האמיתי אם יש; אחרת אותו מסך עם תוצאות מדומות
    const real = winFor(t, state, cfg);
    if (real) return setShow({ win: real, state });
    const results = { ...(state.results || {}) };
    for (const g of t.games) {
      if (g.stage === "group" && !results[g.id]) results[g.id] = g.a === t.us ? { a: 2, b: 0 } : g.b === t.us ? { a: 0, b: 2 } : { a: 2, b: 0 };
    }
    for (const id of ["g3", "sf", "fn"]) {
      if (cfg.gameId === "g3" ? id === "g3" : cfg.gameId === "sf" ? id !== "fn" : true) results[id] = { ...(results[id] || {}), ...DEMO[id] };
    }
    const demoState = { ...state, results };
    setShow({ win: winFor(t, demoState, cfg), state: demoState });
  }

  const btn = { border: "none", borderRadius: 10, padding: "8px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
  return (
    <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: "#16203a" }}>🎉 הפתעות ניצחון</div>
      <div style={{ fontSize: 12.5, color: "#5b6478", margin: "4px 0 6px", lineHeight: 1.55 }}>
        ברגע שנשמרת תוצאה של ניצחון באחד המשחקים האלה, כל שחקנית שנכנסת מקבלת פעם אחת מסך חגיגה — עד שמתחיל המשחק הבא שלנו (בגמר: שלושה ימים). כרטיס הספורטיאדה מוזהב עד סוף היום. בלי פוש.
      </div>
      {CELEBRATIONS.map((cfg) => {
        const photo = state[photoField(cfg.gameId)] || null;
        const won = !!winFor(t, state, cfg);
        return (
          <div key={cfg.gameId} style={{ borderTop: "1px solid #fde68a", paddingTop: 10, marginTop: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#16203a" }}>
              {LABELS[cfg.gameId]} {won && <span style={{ color: "#15803d", fontSize: 12 }}>· ✓ פעילה</span>}
            </div>
            {photo && <img src={photo} alt="" style={{ width: "100%", maxHeight: 150, objectFit: "cover", borderRadius: 10, display: "block", margin: "6px 0" }} />}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              <label style={{ ...btn, background: "#1a237e", color: "#fff", opacity: busy === cfg.gameId ? 0.6 : 1 }}>
                {busy === cfg.gameId ? "מעלה…" : photo ? "📷 החלפת תמונה" : "📷 הוספת תמונה"}
                <input type="file" accept="image/*" disabled={!!busy} style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; upload(cfg.gameId, f); }} />
              </label>
              {photo && <button disabled={!!busy} onClick={() => askConfirm ? askConfirm("להסיר את התמונה ממסך החגיגה?", () => remove(cfg.gameId)) : remove(cfg.gameId)} style={{ ...btn, background: "#fef2f2", color: "#ef4444" }}>🗑️ הסרה</button>}
              <button onClick={() => preview(cfg)} style={{ ...btn, background: "#fff", color: "#1a237e", border: "1.5px solid #1a237e" }}>👀 תצוגה מקדימה</button>
            </div>
          </div>
        );
      })}
      {show && show.win && <Celebration t={t} state={show.state} win={show.win} onClose={() => setShow(null)} />}
    </div>
  );
}

const CSS = `
.vb-cel { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center; padding: 18px; overflow: hidden; animation: vbCelIn .35s ease-out both; }
.vb-cel-police { background: radial-gradient(120% 90% at 50% 20%, #2a36a8 0%, #1a237e 50%, #0b0f3a 100%); }
.vb-cel-fire { background: radial-gradient(120% 90% at 50% 100%, #ffb347 0%, #f2552c 38%, #9b1c1c 70%, #3b0a0a 100%); }
.vb-cel-gold { background: radial-gradient(120% 90% at 50% 30%, #fff2b3 0%, #f5c842 30%, #c48a0c 65%, #4a3000 100%); }
@keyframes vbCelIn { from { opacity: 0; } to { opacity: 1; } }
.vb-cel-siren { position: absolute; top: 0; left: 0; right: 0; height: 120px; display: flex; pointer-events: none; }
.vb-cel-siren i { flex: 1; animation: vbSiren 0.9s steps(1) infinite; }
.vb-cel-siren i:first-child { background: radial-gradient(70% 100% at 50% 0%, rgba(59,130,246,.85), transparent 70%); }
.vb-cel-siren i:last-child { background: radial-gradient(70% 100% at 50% 0%, rgba(239,68,68,.85), transparent 70%); animation-delay: .45s; }
@keyframes vbSiren { 0% { opacity: 1; } 50% { opacity: .1; } }
.vb-cel-rays { position: absolute; left: 50%; top: 42%; width: 160vmax; height: 160vmax; margin: -80vmax 0 0 -80vmax; pointer-events: none; opacity: .35;
  background: repeating-conic-gradient(from 0deg, rgba(255,255,255,.9) 0deg 6deg, transparent 6deg 22deg); animation: vbSpin 24s linear infinite; }
@keyframes vbSpin { to { transform: rotate(360deg); } }
.vb-cel-rain { position: absolute; inset: 0; pointer-events: none; }
.vb-cel-rain span { position: absolute; top: -50px; font-size: 30px; animation-name: vbFall; animation-timing-function: linear; animation-iteration-count: infinite; }
@keyframes vbFall { from { transform: translateY(0) rotate(0deg); } to { transform: translateY(110vh) rotate(360deg); } }
.vb-cel-card { position: relative; width: 100%; max-width: 400px; max-height: calc(100dvh - 36px); overflow-y: auto; text-align: center; color: #fff;
  background: rgba(16, 22, 79, .82); border: 2px solid #f5c842; border-radius: 26px; padding: 24px 20px 20px; box-shadow: 0 24px 60px rgba(0,0,0,.5);
  animation: vbPop .6s cubic-bezier(.2, 1.4, .35, 1) .15s both; }
.vb-cel-fire .vb-cel-card { background: rgba(60, 10, 10, .78); border-color: #ffb347; }
.vb-cel-gold .vb-cel-card { background: rgba(40, 26, 0, .78); border-color: #fff2b3; }
@keyframes vbPop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
.vb-cel-cup { font-size: 76px; line-height: 1; margin: -6px 0 6px; animation: vbBounce 1.4s ease-in-out .6s infinite; filter: drop-shadow(0 8px 14px rgba(0,0,0,.45)); }
@keyframes vbBounce { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-12px) rotate(4deg); } }
.vb-cel-kicker { font-size: 12.5px; font-weight: 800; letter-spacing: .04em; opacity: .9; }
.vb-cel-card h2 { margin: 8px 0 0; font-size: 34px; font-weight: 900; line-height: 1.15; color: #f5c842; }
.vb-cel-fire .vb-cel-card h2 { color: #ffc46b; }
.vb-cel-gold .vb-cel-card h2 { color: #ffe27a; }
.vb-cel-score { margin-top: 8px; font-size: 58px; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; direction: ltr; }
.vb-cel-card p { margin: 10px 0 0; font-size: 16px; line-height: 1.55; opacity: .95; }
.vb-cel-card img { display: block; width: 100%; max-height: 38vh; object-fit: cover; border-radius: 16px; margin-top: 14px; border: 2px solid rgba(255,255,255,.25); }
.vb-cel-card button { margin-top: 16px; width: 100%; border: none; border-radius: 999px; padding: 14px; background: #f5c842; color: #10163f; font-size: 17px; font-weight: 900; cursor: pointer; font-family: inherit; }
@media (prefers-reduced-motion: reduce) { .vb-cel-rain, .vb-cel-siren, .vb-cel-rays { display: none; } .vb-cel, .vb-cel-card, .vb-cel-cup { animation: none; } }
`;
