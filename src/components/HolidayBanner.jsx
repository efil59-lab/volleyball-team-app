import { holidayFor } from "../lib/holidays";

// ── ברכת חג ─────────────────────────────────────────────────────────────────
// האיורים הם SVG שנכתב כאן ולא תמונות: שוקלים כלום, חדים בכל מסך, בלי
// זכויות יוצרים ובלי קובץ להעלות לכל חג חדש. תמונה אמיתית גם נראית כמו
// משהו שהודבק על האפליקציה במקום חלק ממנה.
const ART = {
  apple: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 13c-7 0-12 5-12 12s5 15 12 15 12-8 12-15-5-12-12-12z" fill="#dc2626" />
      <path d="M24 13c0-4 2-7 6-8" stroke="#65a30d" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="19" cy="22" rx="3" ry="4" fill="#fff" opacity=".28" />
      <path d="M30 30c3 2 4 5 3 8" stroke="#f5c842" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  sukka: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="10" y="20" width="28" height="20" rx="2" fill="#a16207" />
      <path d="M6 20h36l-4-6H10z" fill="#16a34a" />
      <path d="M12 14c3-4 7-6 10-6M24 14c3-3 6-4 9-4" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
      <rect x="21" y="29" width="6" height="11" fill="#78350f" />
    </svg>
  ),
  candles: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="8" y="26" width="4" height="14" rx="1" fill="#1e3a8a" />
      <rect x="18" y="24" width="4" height="16" rx="1" fill="#1e3a8a" />
      <rect x="28" y="24" width="4" height="16" rx="1" fill="#1e3a8a" />
      <rect x="38" y="26" width="4" height="14" rx="1" fill="#1e3a8a" />
      <g fill="#f5c842">
        <ellipse cx="10" cy="21" rx="3" ry="5" /><ellipse cx="20" cy="19" rx="3" ry="5" />
        <ellipse cx="30" cy="19" rx="3" ry="5" /><ellipse cx="40" cy="21" rx="3" ry="5" />
      </g>
    </svg>
  ),
  mask: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M8 18c0-3 3-5 6-4l10 3 10-3c3-1 6 1 6 4 0 8-5 16-11 16-2 0-4-1-5-3-1 2-3 3-5 3-6 0-11-8-11-16z" fill="#7c3aed" />
      <circle cx="16" cy="21" r="3" fill="#fff" /><circle cx="32" cy="21" r="3" fill="#fff" />
      <path d="M24 34c2 3 5 5 8 5" stroke="#f5c842" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  matza: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="32" height="32" rx="4" fill="#eab308" />
      <g fill="#a16207" opacity=".6">
        {[15, 24, 33].map(y => [15, 24, 33].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
      </g>
    </svg>
  ),
  wheat: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 42V18" stroke="#a16207" strokeWidth="2.5" strokeLinecap="round" />
      <g fill="#facc15">
        {[18, 24, 30].map((y, i) => (
          <g key={i}><ellipse cx="18" cy={y} rx="5" ry="3" transform={`rotate(-25 18 ${y})`} />
            <ellipse cx="30" cy={y} rx="5" ry="3" transform={`rotate(25 30 ${y})`} /></g>
        ))}
      </g>
      <ellipse cx="24" cy="13" rx="3.5" ry="5" fill="#fde047" />
    </svg>
  ),
  flag: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="6" y="12" width="36" height="24" rx="2" fill="#fff" />
      <rect x="6" y="12" width="36" height="4" fill="#0038b8" />
      <rect x="6" y="32" width="36" height="4" fill="#0038b8" />
      <path d="M24 19l5 8H19z" stroke="#0038b8" strokeWidth="2" fill="none" />
      <path d="M24 29l-5-8h10z" stroke="#0038b8" strokeWidth="2" fill="none" />
    </svg>
  ),
  memorial: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="20" y="24" width="8" height="17" rx="1" fill="#64748b" />
      <ellipse cx="24" cy="17" rx="4.5" ry="7.5" fill="#94a3b8" />
      <ellipse cx="24" cy="18" rx="2" ry="4" fill="#cbd5e1" />
    </svg>
  ),
  quiet: (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="15" stroke="#7dd3fc" strokeWidth="2.5" fill="none" />
      <path d="M24 14v10l7 4" stroke="#bae6fd" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
};

/**
 * מוצג רק בימי החג עצמם, ומחזיר null בכל יום אחר — אפשר לשתול אותו בכל
 * מסך בלי תנאי מסביב.
 *
 * slim: שורה דקה במקום כרטיס. מגיע משני מקומות — כשיש יום הולדת (הברכה
 * האישית גוברת, ושתיהן במלואן על אותו מסך הן עומס), וכשהטבלה עצמה מגדירה
 * את היום כדק, למשל חול המועד. החג לא נמחק ביום הולדת: הוא נמשך ימים,
 * ויום הולדת אחד באמצע לא צריך למחוק את כולו.
 */
export default function HolidayBanner({ slim = false }) {
  const h = holidayFor();
  if (!h) return null;
  // slim מגיע משני מקומות: מהקורא (מסך צר), ומהטבלה עצמה — חול המועד מוגדר
  // דק מלכתחילה, בכל מסך.
  slim = slim || !!h.slim;

  const bg = h.bg.length > 2
    ? `linear-gradient(105deg, ${h.bg[0]}, ${h.bg[1]} 58%, ${h.bg[2]})`
    : `linear-gradient(105deg, ${h.bg[0]}, ${h.bg[1]})`;

  return (
    <div style={{
      background: bg, color: "white", borderRadius: slim ? 12 : 16,
      padding: slim ? "9px 13px" : "13px 15px", marginBottom: 12,
      display: "flex", alignItems: "center", gap: slim ? 10 : 13,
      boxShadow: h.kind === "moed" ? "none" : "0 4px 16px rgba(16,24,64,0.14)",
    }}>
      <span style={{ flex: "0 0 auto", width: slim ? 28 : 44, height: slim ? 28 : 44, display: "block" }}>
        {ART[h.art]}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: slim ? 13 : 15.5, fontWeight: 800, lineHeight: 1.3 }}>{h.title}</div>
        {!slim && h.sub && (
          <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 2, lineHeight: 1.45 }}>{h.sub}</div>
        )}
      </div>
    </div>
  );
}
