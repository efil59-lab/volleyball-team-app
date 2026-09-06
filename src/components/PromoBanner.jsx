import { useEffect, useState } from "react";

/**
 * באנר שורה אחת במסך "אודות", שמתחלף בין האפליקציות האחרות של אפי.
 *
 * למה כאן ולא בדף הבית: למסך אודות נכנסים ביוזמה, ולכן שורה כזאת לא
 * מרגישה כמו פרסומת שנדחפה. גובה 46px — נראה, ולא מתחרה בתוכן.
 *
 * להוספת אפליקציה: שורה אחת ב-APPS. הנקודות והסבב מתעדכנים לבד.
 */
const APPS = [
  {
    icon: "📺",
    name: "טלוויזיה.נט",
    pitch: "הסדרות שגדלנו עליהן",
    url: "https://televizia.net",
    bg: "linear-gradient(100deg,#0f172a,#3f2a12 70%,#7c5410)",
  },
  {
    icon: "🇬🇧",
    name: "English Master",
    pitch: "אנגלית בעברית, בקצב שלך",
    url: "https://english-master-efil59-labs-projects.vercel.app",
    bg: "linear-gradient(100deg,#065f46,#0d9488 70%,#14b8a6)",
  },
];

const H = 46;        // גובה השורה
const HOLD = 3600;   // כמה זמן כל אפליקציה על המסך
const SLIDE = 550;   // משך ההחלפה

export default function PromoBanner({ pc = "#1a237e" }) {
  const n = APPS.length;

  // i רץ 0..n (כולל), כש-n הוא שיבוט של הראשונה שמאפשר גלילה רציפה
  // קדימה במקום קפיצה אחורה דרך כל הרשימה.
  const [i, setI] = useState(0);
  const [anim, setAnim] = useState(true);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduced || n < 2) return;
    const t = setInterval(() => setI((v) => v + 1), HOLD);
    return () => clearInterval(t);
  }, [reduced, n]);

  // הגענו לשיבוט — לכבות אנימציה, לחזור ל-0 בלי שרואים את המעבר
  useEffect(() => {
    if (i !== n) return;
    const t = setTimeout(() => { setAnim(false); setI(0); }, SLIDE + 10);
    return () => clearTimeout(t);
  }, [i, n]);

  useEffect(() => {
    if (anim) return;
    const t = setTimeout(() => setAnim(true), 40);
    return () => clearTimeout(t);
  }, [anim]);

  if (!n) return null;

  const cur = APPS[i % n];
  const track = [...APPS, APPS[0]];

  return (
    <div style={{ margin: "0 0 14px" }}>
      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 6 }}>
        עוד מהמעבדה של אפי
      </div>

      <a
        href={cur.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${cur.name} — ${cur.pitch}`}
        style={{
          position: "relative",
          display: "block",
          height: H,
          overflow: "hidden",
          borderRadius: 12,
          textDecoration: "none",
        }}
      >
        <div
          style={{
            transform: `translateY(-${i * H}px)`,
            transition: anim ? `transform ${SLIDE}ms cubic-bezier(.4,0,.2,1)` : "none",
          }}
        >
          {track.map((app, k) => (
            <div
              key={k}
              style={{
                height: H,
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "0 14px",
                background: app.bg,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{app.icon}</span>
              <span style={{ fontWeight: 800, flexShrink: 0 }}>{app.name}</span>
              <span
                style={{
                  fontWeight: 500,
                  opacity: 0.92,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                }}
              >
                {app.pitch}
              </span>
              <span style={{ marginInlineStart: "auto", flexShrink: 0, fontWeight: 800, opacity: 0.9 }}>←</span>
            </div>
          ))}
        </div>
      </a>

      {n > 1 && (
        <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 7 }}>
          {APPS.map((_, k) => (
            <span
              key={k}
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: k === i % n ? pc : "#e2e8f0",
                transition: "background .3s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
