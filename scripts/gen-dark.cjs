// מחולל styles/dark.css — מתרגם את הצבעים שכתובים ישירות בקוד (inline) לצבעי לילה.
// React כותב style="background: rgb(241, 245, 249); color: rgb(30, 41, 59)" — ולכן
// הסלקטורים מחפשים את המחרוזות האלה בדיוק. "white" נשאר מילה.
const fs = require("fs");
const hex = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgb = (h) => `rgb(${hex(h).join(", ")})`;
const D = 'html[data-theme="dark"]';

// רקעים
const BG = [
  [["white", "#ffffff"], "#1d2439"],          // כרטיסים
  [["#f8fafc"], "#182033"],
  [["#f1f5f9"], "#151a2b"],                   // רקע מסך + שבבים בתוך כרטיס
  [["#e2e8f0"], "#2e3752"],
  [["#eef2f7"], "#232b42"],
  [["#fef2f2", "#fee2e2"], "rgba(239, 68, 68, 0.16)"],
  [["#dcfce7", "#f0fdf4", "#ecfdf5"], "rgba(34, 197, 94, 0.15)"],
  [["#fffbeb", "#fef9c3", "#fff7ed", "#fef3c7", "#fefce8", "#fff7e6", "#fff8e1", "#fffdf3"], "rgba(245, 200, 66, 0.14)"],
  [["#e0e7ff", "#eef2ff", "#f5f3ff", "#ede9fe"], "rgba(129, 140, 248, 0.18)"],
  [["#f3e8ff", "#faf5ff"], "rgba(168, 85, 247, 0.18)"],
  [["#fff1f3", "#fdf2f8", "#fce7f3", "#fff6f8"], "rgba(242, 85, 122, 0.16)"],
  [["#eff6ff", "#dbeafe", "#f0f9ff", "#e0f2fe"], "rgba(59, 130, 246, 0.16)"],
];
// טקסט
const FG = [
  [["#0f172a", "#1e293b", "#16203a", "#111827", "#1f2937"], "#e6e9f4"],
  [["#334155", "#374151"], "#d0d5e6"],
  [["#475569", "#4b5563"], "#b3bad0"],
  [["#64748b", "#6b7280"], "#a1a9c2"],
  [["#94a3b8", "#9ca3af"], "#8690ad"],
  [["#cbd5e1"], "#5d6788"],
  [["#1a237e"], "#a9b3ff"],                   // צבע הקבוצה כטקסט על רקע כהה
  [["#0b3b63"], "#8cc4f0"],                   // DEEP של הספורטיאדה
  [["#92400e", "#854d0e", "#a16207"], "#fcd34d"],
  [["#b45309"], "#fbbf24"],
  [["#9a3412", "#c2410c", "#ea580c"], "#fdba74"],
  [["#166534", "#15803d"], "#86efac"],
  [["#b91c1c", "#991b1b"], "#fca5a5"],
  [["#3730a3", "#4338ca"], "#a5b4fc"],
  [["#6b21a8", "#6d28d9", "#7c3aed"], "#d8b4fe"],
  [["#1e40af", "#1d4ed8"], "#93c5fd"],
];
// גבולות
const BD = [
  [["#e2e8f0", "#eef2f7", "#f1f5f9", "#e5e7eb"], "#2e3752"],
  [["#cbd5e1"], "#3a4463"],
  [["#fde68a", "#fcd34d", "#fde047"], "rgba(245, 200, 66, 0.4)"],
  [["#fecaca", "#fca5a5"], "rgba(239, 68, 68, 0.4)"],
  [["#bbf7d0", "#86efac"], "rgba(34, 197, 94, 0.4)"],
  [["#fed7aa"], "rgba(249, 115, 22, 0.4)"],
  [["#c7d2fe", "#ddd6fe"], "rgba(129, 140, 248, 0.4)"],
  [["#fbcfe8"], "rgba(236, 72, 153, 0.35)"],
];

const tok = (c) => (c === "white" ? "white" : rgb(c));
let out = `/* ── מצב לילה: שכבת תרגום לצבעים שכתובים ישירות בקוד ─────────────────────
   נוצר אוטומטית (scripts/gen-dark.cjs — מריצים: node scripts/gen-dark.cjs src/styles/dark.css; אתר המחשב ב-dark-site.css, נכתב ביד) — לא לערוך ידנית כל שורה; להוסיף צבע
   לטבלה במחולל. פעיל רק כש-<html data-theme="dark"> (lib/theme.js).
   למה ככה: באפליקציה מאות צבעים inline ולא משתני CSS. התרגום כאן נותן מצב
   לילה לכל המסכים בבת אחת, בלי לגעת בקומפוננטות. */

${D} {
  color-scheme: dark;
  --color-bg: #151a2b;
  --color-surface: #1d2439;
  --color-text: #e6e9f4;
  --color-text-muted: #a1a9c2;
  --color-text-faint: #8690ad;
  --color-border: #2e3752;
  --color-success-bg: rgba(34, 197, 94, 0.15);
  --color-danger-bg: rgba(239, 68, 68, 0.16);
  --color-warn-bg: rgba(245, 200, 66, 0.14);
  --shadow-card: 0 1px 4px rgba(0, 0, 0, 0.4);
}
${D} body { background: #151a2b; color: #e6e9f4; }
${D} input, ${D} textarea, ${D} select { background-color: #141a2c; color: #e6e9f4; border-color: #2e3752; }
${D} input::placeholder, ${D} textarea::placeholder { color: #6f7996; }
${D} img { color-scheme: normal; }

`;
for (const [list, to] of BG) {
  const sel = list.flatMap((c) => [`${D} [style*="background: ${tok(c)}"]`, `${D} [style*="background-color: ${tok(c)}"]`]);
  out += `${sel.join(",\n")} { background-color: ${to} !important; }\n`;
  // background: white בתוך קיצור עם gradient לא קיים אצלנו; רק צבע מלא
}
out += "\n";
for (const [list, to] of FG) {
  const sel = list.flatMap((c) => [`${D} [style^="color: ${rgb(c)}"]`, `${D} [style*="; color: ${rgb(c)}"]`]);
  out += `${sel.join(",\n")} { color: ${to} !important; }\n`;
}
out += "\n";
for (const [list, to] of BD) {
  const sel = list.flatMap((c) => [`${D} [style*="solid ${rgb(c)}"]`, `${D} [style*="dashed ${rgb(c)}"]`]);
  out += `${sel.join(",\n")} { border-color: ${to} !important; }\n`;
}
fs.writeFileSync(process.argv[2], out);
console.log("rules:", (out.match(/\{/g) || []).length, "bytes:", out.length);
