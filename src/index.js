import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA - ביטול Service Worker: מבטיח שכל משתמשת מקבלת תמיד את הקוד העדכני.
// ההתקנה למסך הבית עדיין עובדת (תלויה ב-manifest, לא ב-SW).
serviceWorkerRegistration.unregister();

reportWebVitals();
