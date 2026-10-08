// ── קרוסלת לשוניות: החיווט ───────────────────────────────────────────────────
// אותה לוגיקה שאושרה במסך השחקנית (player.jsx, 8.10.26), ארוזה כ-hook כדי
// שפאנל המנהלת ישתמש בה כמו שהיא. המנוע עצמו ב-lib/swipe.js (מ-MyTV/גול־טיים).
//
// המסך שמשתמש בזה מרנדר:
//   <div className="app-shell vb-shell" ref={shellRef} {...shellSwipe}>
//     <div className="vb-pager">
//       <div className="vb-pane" ref={paneRef}>…הלשונית הנוכחית…</div>
//       {nextTab && <div className="vb-pane vb-incoming" ref={nextRef} data-dir="1" data-tab={nextTab}>…</div>}
//       {prevTab && <div className="vb-pane vb-incoming" ref={prevRef} data-dir="-1" data-tab={prevTab}>…</div>}
//     </div>
//   </div>
// השכנות בנויות מראש (לא ברגע נעילת המחווה) — זה מה שמונע את הקפיאה בתחילת
// ההחלקה. כל ה-hooks כאן רצים תמיד; enabled=false רק מנטרל אותם.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPager, tabAfterSettle } from "./swipe";

// טלפון = כל מה שאינו פריסת הטאבלט/מחשב של index.css (720×640 ומעלה, שם יש
// סרגל צד במקום הסרגל התחתון).
export function usePhoneLayout() {
  const Q = "(min-width: 720px) and (min-height: 640px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(Q).matches);
  useEffect(() => {
    const m = window.matchMedia(Q);
    const h = () => setWide(m.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);
  return !wide;
}

export function useTabCarousel({ enabled, tab, setTab, tabs }) {
  const shellRef = useRef(null);
  const paneRef = useRef(null);
  const nextRef = useRef(null);
  const prevRef = useRef(null);
  const incomingRef = useRef(null);   // השכנה שבמשחק כרגע
  const gestureRef = useRef(null);
  const paintRef = useRef(null);

  // הרצועה היא טבעת: אחרי האחרונה חוזרים לראשונה. לשונית שאינה ברצועה = אין דפדוף.
  const index = enabled ? tabs.indexOf(tab) : -1;
  const indexRef = useRef(index);
  indexRef.current = index;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const pager = createPager({
    paneRef, incomingRef, gestureRef, paintRef,
    canNext: () => indexRef.current >= 0,
    canPrev: () => indexRef.current >= 0,
    // בלי setState: השכנה כבר קיימת, ונעילת המחווה רק מכוונת את המנוע אליה.
    onDragStart: (dir) => {
      const el = dir > 0 ? nextRef.current : prevRef.current;
      const other = dir > 0 ? prevRef.current : nextRef.current;
      // האצבע חזרה מעבר לנקודת ההתחלה: הצד השני חוזר למקום החניה שלו
      if (other && other.style.transform) { other.style.transition = ""; other.style.transform = ""; }
      // שכנה שעוד בנויה ללשונית אחרת (מיד אחרי נחיתה) לא נכנסת
      const want = tabAfterSettle(tabsRef.current, indexRef.current, dir);
      incomingRef.current = el && el.dataset.tab === want ? el : null;
    },
    onSettle: (committed) => {
      const target = tabAfterSettle(tabsRef.current, indexRef.current, committed);
      if (target) setTab(target); else pager.snapBack();
    },
  });

  // המסך בגובה קבוע, ולכן כשהמקלדת נפתחת הוא צריך להתכווץ איתה (אחרת שדה
  // ההקלדה נשאר מאחוריה). חל רק כשהקרוסלה פעילה, ומוחזר ביציאה.
  useEffect(() => {
    if (!enabled) return;
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const before = meta.getAttribute("content") || "";
    if (!before.includes("interactive-widget")) meta.setAttribute("content", before + ", interactive-widget=resizes-content");
    return () => meta.setAttribute("content", before);
  }, [enabled]);

  // החלקה הצידה אסור שתהיה גלילה של הדפדפן. React מאזין ל-touchmove באופן
  // פסיבי, ולכן כרום פותח מחווה משלו ו"זריקה" בשחרור — ולחיצה מיד אחרי החלקה
  // נבלעת (נמדד בגול־טיים). מאזין אחד, לא פסיבי, תופס את התנועה ברגע שהיא אופקית.
  useEffect(() => {
    const el = shellRef.current;
    if (!el || !enabled) return;
    const onMove = (e) => {
      const st = gestureRef.current;
      if (!st || st.canceled || !e.cancelable || !e.touches || !e.touches.length) return;
      if (st.horizontal) { e.preventDefault(); return; }
      const t = e.touches[0];
      if (Math.abs(t.clientX - st.x) > Math.abs(t.clientY - st.y)) e.preventDefault();
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, [enabled]);

  // מקום אחד שמאפס את התצוגה אחרי מעבר לשונית: אחרי עדכון ה-DOM ולפני הציור.
  useLayoutEffect(() => {
    const el = paneRef.current;
    if (el && el.style.transform) { el.style.transition = "none"; el.style.transform = ""; }
    if (el) el.scrollTop = 0;
    for (const nb of [nextRef.current, prevRef.current]) if (nb && nb.style.transform) { nb.style.transition = ""; nb.style.transform = ""; }
    incomingRef.current = null;
    paintRef.current = null;
  }, [tab]);

  // מגע שהתחיל על חלון קופץ או על הסרגל התחתון (position: fixed) אינו דפדוף.
  const onFixed = (target) => {
    for (let el = target; el && el !== shellRef.current; el = el.parentElement) {
      if (el.nodeType === 1 && getComputedStyle(el).position === "fixed") return true;
    }
    return false;
  };
  const shellSwipe = index >= 0
    ? {
        onTouchStart: (e) => { if (onFixed(e.target)) { gestureRef.current = null; return; } pager.onTouchStart(e); },
        onTouchMove: pager.onTouchMove, onTouchEnd: pager.onTouchEnd, onTouchCancel: pager.onTouchCancel,
      }
    : {};

  return {
    shellRef, paneRef, nextRef, prevRef, shellSwipe,
    nextTab: tabAfterSettle(tabs, index, 1),
    prevTab: tabAfterSettle(tabs, index, -1),
  };
}
