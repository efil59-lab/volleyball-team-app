import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { CURRENT_TEAM } from "./db";

// ── דחיסת תמונה בצד-לקוח (canvas) — מקס' 1280px, JPEG 0.8 ────────────────────
// חיסכון ~10x ברוחב פס ובעלות Storage. אם הקריאה נכשלת — מחזיר את הקובץ המקורי.
// העלאת תמונת פרופיל ל-Storage והחזרת URL קבוע. תמונות פרופיל דחוסות לקטן (512px) —
// הן מוצגות בעיגול קטן. שומרים URL בלבד בפרופיל (לא base64), כדי לא לחרוג מגבול 1MB של Firestore.
async function uploadProfilePhoto(file, playerId) {
  const compressed = await compressImage(file, 512, 0.8);
  const safeName = (compressed.name || "photo").replace(/[^\w.\-]/g, "_");
  const path = `teams/${CURRENT_TEAM}/profiles/${playerId}_${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, compressed);
  return await getDownloadURL(storageRef);
}

// טוען ExcelJS מ-CDN בפעם הראשונה שצריך (ייצוא לאקסל). אינה מותקנת כחבילה.
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
    s.onload = () => window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error("exceljs missing after load"));
    s.onerror = () => reject(new Error("exceljs load failed"));
    document.head.appendChild(s);
  });
}

// טוען את ספריית heic2any מ-CDN בפעם הראשונה שצריך (תמונות אייפון בפורמט HEIC).
function loadHeic2any() {
  if (window.heic2any) return Promise.resolve(window.heic2any);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js";
    s.onload = () => resolve(window.heic2any);
    s.onerror = () => reject(new Error("heic load failed"));
    document.head.appendChild(s);
  });
}

async function compressImage(file, maxDim = 1280, quality = 0.8) {
  // אייפון מצלם ב-HEIC — דפדפנים לא יודעים להציג/לדחוס אותו. ממירים ל-JPEG קודם.
  const isHeic = file && (/heic|heif/i.test(file.type || "") || /\.(heic|heif)$/i.test(file.name || ""));
  if (isHeic) {
    try {
      const heic2any = await loadHeic2any();
      const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      const out = Array.isArray(blob) ? blob[0] : blob;
      file = new File([out], (file.name || "photo").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch (e) { console.error("HEIC convert failed:", e); /* ננסה להמשיך עם המקורי */ }
  }
  return compressImageCanvas(file, maxDim, quality);
}

function compressImageCanvas(file, maxDim = 1280, quality = 0.8) {
  return new Promise((resolve) => {
    if (!file || !file.type || !file.type.startsWith("image/")) { resolve(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) { resolve(file); return; } // כבר קטנה — לא נוגעים
      if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
      else { width = Math.round(width * maxDim / height); height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], (file.name || "photo").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
export { uploadProfilePhoto, loadExcelJS, loadHeic2any, compressImage, compressImageCanvas };
