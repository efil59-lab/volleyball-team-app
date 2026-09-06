import { useEffect, useRef } from "react";

// ── קונפטי ────────────────────────────────────────────────────────────────────
// כתוב ידנית ולא דרך ספרייה: canvas-confetti שוקל ~5KB, וזה הרבה בשביל אפקט
// אחד באפליקציה כמעט חסרת תלויות — ובעיקר, מה שרצינו כאן הוא דווקא השליטה
// בצבעים. הקונפטי צבוע בצבעי הקבוצה (pc/sc), כלומר לכל קבוצה הקונפטי שלה.
//
// קנבס אחד ולא עשרות אלמנטים עם keyframes: בטלפונים החלשים שיש בקבוצה, 90
// אלמנטים שמסתובבים בו-זמנית מקפיצים את הפריים. קנבס מצייר את כולם בפעם אחת.
//
// variant: "fall" — נופל מלמעלה, 2.6 שניות (יום ההולדת עצמו)
//          "burst" — פרץ קצר מהמרכז, 1.2 שניות (אישור אחרי שליחת ברכה)
export default function Confetti({ colors = [], variant = "fall", onDone }) {
  const ref = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    // "הפחת תנועה" היא הגדרת נגישות אמיתית ולא קפריזה — מכבדים ויוצאים.
    let reduced = false;
    try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* ignore */ }
    if (reduced) { doneRef.current && doneRef.current(); return; }

    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // מעל 2 זה בזבוז טהור
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.scale(dpr, dpr);

    const pal = (colors.length ? colors : ["#1a237e", "#f5c842", "#ffffff"]);
    const burst = variant === "burst";
    const N = burst ? 40 : 90;
    const LIFE = burst ? 1200 : 2600;

    const parts = Array.from({ length: N }, (_, i) => {
      if (burst) {
        const a = (Math.PI * 2 * i) / N + Math.random() * 0.3;
        const sp = 3 + Math.random() * 4;
        return {
          x: W / 2, y: H / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
          rot: Math.random() * 6.28, vrot: (Math.random() - 0.5) * 0.3,
          size: 5 + Math.random() * 5, color: pal[i % pal.length],
          ball: i % 10 === 0, // אחד מעשרה הוא כדורשת — הזהות של הקבוצה
        };
      }
      return {
        x: Math.random() * W, y: -20 - Math.random() * H * 0.5,
        vx: (Math.random() - 0.5) * 1.2, vy: 2 + Math.random() * 2.5,
        rot: Math.random() * 6.28, vrot: (Math.random() - 0.5) * 0.25,
        size: 6 + Math.random() * 6, color: pal[i % pal.length],
        ball: i % 10 === 0,
      };
    });

    const t0 = performance.now();
    let raf = 0;
    function frame(now) {
      const t = now - t0;
      if (t > LIFE) { doneRef.current && doneRef.current(); return; }
      const fade = t > LIFE - 600 ? Math.max(0, (LIFE - t) / 600) : 1;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = fade;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        p.vy += burst ? 0.16 : 0.045;   // כבידה
        p.vx *= 0.995;                   // גרר
        if (p.ball) {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.font = `${p.size * 2}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("🏐", 0, 0);
          ctx.restore();
        } else {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    // ניקוי חובה: בלעדיו הלולאה ממשיכה לרוץ אחרי שהחלון נסגר, ובאפליקציה
    // שנשארת פתוחה שעות זה ההבדל בין אפקט לבין סוללה שנגמרת.
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas ref={ref} aria-hidden
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1200 }} />
  );
}
