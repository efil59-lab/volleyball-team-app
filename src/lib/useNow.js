import { useEffect, useState } from "react";

/**
 * שעון שמתקתק פעם בדקה.
 *
 * בלעדיו התווית על כרטיס האירוע לא מתחלפת למי שהאפליקציה פתוחה אצלה
 * ברגע שהאימון מתחיל — היא נשארת על "היום!" עד שמשהו אחר יגרום לרינדור.
 *
 * visibilitychange חשוב לא פחות מהאינטרוול: טלפון שהיה נעול חצי שעה
 * מקפיא טיימרים, ובלי הרענון בחזרה למסך התווית תהיה מיושנת עד דקה שלמה.
 */
export default function useNow(ms = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    const onVis = () => { if (!document.hidden) setNow(new Date()); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [ms]);
  return now;
}
