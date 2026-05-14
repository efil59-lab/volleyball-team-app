import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCdIrh_ohM7GjB_qpvbqayKiMA67ZVkMcw",
  authDomain: "volleyball-team-app-e1a2f.firebaseapp.com",
  projectId: "volleyball-team-app-e1a2f",
  storageBucket: "volleyball-team-app-e1a2f.firebasestorage.app",
  messagingSenderId: "740298383548",
  appId: "1:740298383548:web:f897e9c4b5c68a3bcdb0b9",
  measurementId: "G-FTHBRGE0VX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
