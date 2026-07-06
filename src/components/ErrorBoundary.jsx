import { Component } from "react";

// גבול-שגיאה: תופס קריסת רינדור בכל מקום בעץ ומציג מסך "טעני מחדש" ידידותי
// במקום מסך לבן ריק (שלמשתמשת לא-טכנית = "האפליקציה מתה"). מדווח ל-console עם הקשר.
// מקור השגיאה נשמר ב-lastAppError (module-level) לשימוש עתידי (ניטור/סופר-אדמין).
export let lastAppError = null;

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    lastAppError = { message: String(error?.message || error), stack: (info?.componentStack || "").slice(0, 2000), ts: Date.now() };
    console.error("🔴 App crash caught by ErrorBoundary:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const pc = "#1a237e", sc = "#f5c842";
    return (
      <div style={{ direction: "rtl", minHeight: "100vh", background: pc, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 60, marginBottom: 8 }}>🏐</div>
        <h2 style={{ color: "white", fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>אופס, משהו השתבש</h2>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, lineHeight: 1.6, maxWidth: 320, margin: "0 0 24px" }}>
          נתקלנו בתקלה קטנה. טעינה מחדש בדרך כלל פותרת את זה.
        </p>
        <button onClick={() => window.location.reload()}
          style={{ background: sc, color: pc, border: "none", borderRadius: 14, padding: "14px 40px", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
          טעינה מחדש 🔄
        </button>
      </div>
    );
  }
}
