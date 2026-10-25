import { S } from "../styles/S";
import { monthDay } from "../lib/utils";

// ── יום הולדת: יום וחודש בלבד ─────────────────────────────────────────────────
// אפי, 25.10.26: "לא יהיה צורך להכניס שנת לידה. מספיק יום וחודש". הערך נשמר
// כ-"MM-DD". ערך ישן עם שנה ("YYYY-MM-DD") נקרא כרגיל, והשנה יורדת בשמירה הבאה.
const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export default function BirthdayInput({ value, onChange }) {
  const md = monthDay(value);
  const [m, d] = md ? md.split("-").map(Number) : [0, 0];
  const pad = (n) => String(n).padStart(2, "0");
  const set = (nm, nd) => {
    if (!nm && !nd) { onChange(""); return; }
    const mm = nm || 1;
    const dd = Math.min(nd || 1, DAYS_IN[mm - 1]);
    onChange(`${pad(mm)}-${pad(dd)}`);
  };
  const sel = { ...S.input, marginBottom: 0, flex: 1, minWidth: 0, background: "white" };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: S.input.marginBottom ?? 12 }}>
      <select value={d || ""} onChange={(e) => set(m, Number(e.target.value))} style={{ ...sel, flex: "0 0 92px" }} aria-label="יום">
        <option value="">יום</option>
        {Array.from({ length: DAYS_IN[(m || 1) - 1] }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <select value={m || ""} onChange={(e) => set(Number(e.target.value), d)} style={sel} aria-label="חודש">
        <option value="">חודש</option>
        {MONTHS.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
      </select>
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="ניקוי"
          style={{ flex: "0 0 auto", background: "transparent", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer", padding: "0 4px" }}>✕</button>
      )}
    </div>
  );
}
