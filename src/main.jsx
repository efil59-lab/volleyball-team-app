import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/heebo"; // פונט עברי — קובץ אחד לכל המשקלים, ללא רשת חיצונית
import "./styles/tokens.css";
import "./styles/index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA — ללא Service Worker: מבטיח שכל משתמשת מקבלת תמיד את הקוד העדכני.
// ההתקנה למסך הבית עדיין עובדת (תלויה ב-manifest, לא ב-SW).
// ה-unregister מנקה SW ישן שנשאר ממכשירים מתקופת CRA.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
}
