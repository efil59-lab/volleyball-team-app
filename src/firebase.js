import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

// Vite: import.meta.env (במקום process.env של CRA). envPrefix ב-vite.config.js
// כולל REACT_APP_ — כך משתני הסביבה הקיימים ב-Vercel ממשיכים לעבוד ללא שינוי.
const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.REACT_APP_FIREBASE_API_KEY,
  authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: `${env.REACT_APP_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
// Cloud Functions (us-central1 — אותו region של הפונקציות שנפרסו)
export const functions = getFunctions(app);
