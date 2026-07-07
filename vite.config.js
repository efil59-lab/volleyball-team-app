import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// מזהה-build ייחודי לכל בנייה — משמש את באנר "יש עדכון" (משווים מול /version.json).
const BUILD_ID = Date.now().toString(36);

// פולט version.json לתוך תיקיית הפלט בכל build. האפליקציה מושכת אותו מדי פעם;
// אם ה-id שונה מזה שהוטמע ב-bundle — יש גרסה חדשה ומוצג באנר רענון.
function versionJsonPlugin() {
  return {
    name: "emit-version-json",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ id: BUILD_ID }) });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionJsonPlugin()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  // תאימות ל-CRA: משתני הסביבה ב-Vercel מוגדרים כ-REACT_APP_* — לא צריך לשנות שם בדשבורד.
  envPrefix: ["VITE_", "REACT_APP_"],
  server: { port: 3000, open: false },
  // build/ (ולא dist/) — תואם את הגדרת Output Directory הקיימת ב-Vercel מתקופת CRA.
  build: { outDir: "build" },
});
