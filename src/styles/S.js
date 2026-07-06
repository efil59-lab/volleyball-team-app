// אובייקטי סגנון משותפים (cards/inputs). בהמשך (שלב 2) יוחלפו ב-tokens.css.

const S = {
  card: { background: "white", borderRadius: 14, padding: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 12 },
  input: { width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 14, boxSizing: "border-box", direction: "rtl", outline: "none", marginBottom: 10, fontFamily: "inherit" },
  select: { width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 14, boxSizing: "border-box", marginBottom: 10, direction: "rtl" },
};
export { S };
