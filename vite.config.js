import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // תאימות ל-CRA: משתני הסביבה ב-Vercel מוגדרים כ-REACT_APP_* — לא צריך לשנות שם בדשבורד.
  envPrefix: ["VITE_", "REACT_APP_"],
  server: { port: 3000, open: false },
  // build/ (ולא dist/) — תואם את הגדרת Output Directory הקיימת ב-Vercel מתקופת CRA.
  build: { outDir: "build" },
});
