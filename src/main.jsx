import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/heebo"; // פונט עברי — קובץ אחד לכל המשקלים, ללא רשת חיצונית
import "./styles/tokens.css";
import "./styles/index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { logError } from "./lib/errorLog";

// לכידת שגיאות גלובליות שנופלות מחוץ ל-React (Promise שנדחה, שגיאה בטיפול אירוע).
// מדווח ל-console + ל-ניטור (errorLogs ב-Firestore, נצפה בסופר-אדמין).
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  console.error("🔴 Unhandled promise rejection:", r);
  logError("promise", (r && r.message) || r, r && r.stack);
});
window.addEventListener("error", (e) => {
  logError("window", e.message, e.error && e.error.stack);
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// PWA — שלב 4: Service Worker דחיפה-בלבד (sw.js). אין בו fetch/cache בכלל,
// כך שהקוד תמיד מגיע עדכני מהשרת (הסיבה שה-SW הקודם בוטל). הרישום באותו scope
// מחליף אוטומטית כל SW ישן שנשאר ממכשירים מתקופת CRA.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((e) => console.error("SW register:", e));
}
