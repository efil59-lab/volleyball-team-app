// כפתור מצב התצוגה: אוטומטי 🌓 → יום ☀️ → לילה 🌙 → אוטומטי.
// variant="onDark" — על כותרת כחולה (טלפון, מסטהד); "plain" — על רקע בהיר.
import { useThemePref, THEME_ICON, THEME_LABEL } from "../lib/theme";

export default function ThemeToggle({ variant = "onDark", style }) {
  const [pref, cycle] = useThemePref();
  const base = variant === "onDark"
    ? { background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }
    : { background: "transparent", border: "1px solid #e2e8f0", color: "#475569" };
  return (
    <button onClick={cycle} title={THEME_LABEL[pref]} aria-label={`מראה: ${THEME_LABEL[pref]}. לחיצה מחליפה`}
      style={{ ...base, borderRadius: 10, minWidth: 36, height: 34, padding: "0 9px", cursor: "pointer", fontSize: 16, lineHeight: 1,
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...style }}>
      {THEME_ICON[pref]}
    </button>
  );
}
