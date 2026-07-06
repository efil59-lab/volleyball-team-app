import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { S } from "../styles/S";
import { SUPER_ADMIN_EMAIL, DEFAULT_TEAM, KEYS } from "../lib/constants";
import { formatShort } from "../lib/utils";
import {
  loadInvite, saveInvite, inviteKey, generateTeamId, seedNewTeam, saveTeamKey,
  syncTeamIndex, deleteJoinRequest, loadJoinRequests, listAllTeams, setTeamStatus,
  adminDeleteTeamRemote,
} from "../lib/db";

// ── SUPER ADMIN ──────────────────────────────────────────────────────────────
// כניסה דרך לחיצה ארוכה על הלוגו במסך הבית. הרשאה: רק בעל המוצר (Google), לעתיד הרב-קבוצתי.


function SuperAdminScreen({ pc, sc, authUser, onGoogle, onBack }) {
  const [gErr, setGErr] = useState("");
  const isOwner = authUser && (authUser.email || "").toLowerCase() === SUPER_ADMIN_EMAIL;
  const [teams, setTeams] = useState(null); // null = טוען
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [delErr, setDelErr] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState(null); // { teamId, email } | { error }
  const [inviteBusy, setInviteBusy] = useState(false);
  const [requests, setRequests] = useState(null); // בקשות הצטרפות ממתינות
  const [reqBusy, setReqBusy] = useState(null);

  // יוצר קבוצה ריקה + הזמנה למייל. משותף ל"כלי ידני" ול"אישור בקשה".
  async function createTeamForEmail(email) {
    const existing = await loadInvite(email);
    if (existing && existing.teamId) {
      const metaSnap = await getDoc(doc(db, "teams", existing.teamId, "data", "meta"));
      if (metaSnap.exists()) return { teamId: existing.teamId, reused: true };
      await deleteDoc(doc(db, "invites", inviteKey(email))).catch(() => {}); // הזמנה יתומה
    }
    const teamId = await generateTeamId();
    await seedNewTeam(teamId);
    await saveTeamKey(teamId, KEYS.meta, {
      ownerUid: null, ownerEmail: email, adminUids: [],
      status: "pending", plan: "free", createdAt: new Date().toISOString(),
    });
    await saveInvite(email, teamId);
    await syncTeamIndex(teamId);
    return { teamId, reused: false };
  }

  async function createTeamInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) { setInviteMsg({ error: "כתובת מייל לא תקינה" }); return; }
    setInviteBusy(true); setInviteMsg(null);
    try {
      const { teamId, reused } = await createTeamForEmail(email);
      await deleteJoinRequest(email);   // אם הייתה בקשה ממתינה לאותו מייל — מסירים
      setInviteMsg({ teamId, email, reused });
      setInviteEmail("");
      await refreshTeams();
      await refreshRequests();
    } catch (e) {
      setInviteMsg({ error: e.message || "יצירת ההזמנה נכשלה" });
    }
    setInviteBusy(false);
  }

  async function refreshRequests() {
    const list = await loadJoinRequests();
    setRequests(list);
  }
  async function approveRequest(email) {
    setReqBusy(email);
    try {
      await createTeamForEmail(email);
      await deleteJoinRequest(email);
      await refreshTeams();
      await refreshRequests();
    } catch (e) { setInviteMsg({ error: e.message || "אישור הבקשה נכשל" }); }
    setReqBusy(null);
  }
  async function rejectRequest(email) {
    setReqBusy(email);
    await deleteJoinRequest(email);
    await refreshRequests();
    setReqBusy(null);
  }

  async function refreshTeams() {
    setTeams(null);
    const list = await listAllTeams();
    setTeams(list);
  }
  useEffect(() => { if (isOwner) { refreshTeams(); refreshRequests(); } }, [isOwner]);

  async function act(teamId, status) {
    setBusyId(teamId);
    await setTeamStatus(teamId, status);
    await refreshTeams();
    setBusyId(null);
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.teamId); setDelErr("");
    try {
      await adminDeleteTeamRemote(deleteTarget.teamId);
      setDeleteTarget(null); setConfirmText("");
      await refreshTeams();
    } catch (e) {
      setDelErr(e.message || "המחיקה נכשלה");
    }
    setBusyId(null);
  }

  async function login() {
    setGErr("");
    const res = await onGoogle();
    if (!res.ok && res.error) setGErr("ההתחברות נכשלה: " + res.error);
  }

  if (!isOwner) {
    return (
      <div style={{ direction: "rtl", minHeight: "100vh", background: pc, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ fontSize: 60, marginBottom: 12 }}>👑</div>
        <h2 style={{ color: "white", fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>סופר אדמין</h2>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, margin: "0 0 24px", textAlign: "center" }}>אזור זה מיועד לבעל המוצר בלבד.</p>
        <div style={{ background: "white", borderRadius: 16, padding: 22, width: "100%", maxWidth: 340 }}>
          <button onClick={login} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "13px 16px", background: "white", color: "#3c4043", border: "1px solid #dadce0", borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 600, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
            <span style={{ fontSize: 18 }}>🔵</span> התחבר עם Google
          </button>
          {gErr && <p style={{ color: "#ef4444", fontSize: 12, margin: "10px 0 0", textAlign: "center", wordBreak: "break-word" }}>{gErr}</p>}
          {authUser && !authUser.isAnonymous && <p style={{ color: "#94a3b8", fontSize: 12, margin: "10px 0 0", textAlign: "center" }}>מחובר כ-{authUser.email} — אין הרשאת סופר אדמין.</p>}
          <button onClick={onBack} style={{ width: "100%", padding: "10px", background: "transparent", color: "#64748b", border: "none", cursor: "pointer", fontSize: 13, marginTop: 8 }}>ביטול</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, sans-serif", minHeight: "100vh", background: "#f1f5f9" }}>
      <div style={{ background: pc, padding: "18px 16px 14px", textAlign: "center", position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>← יציאה</button>
        <div style={{ fontSize: 32 }}>👑</div>
        <h2 style={{ color: "white", fontSize: 16, fontWeight: 700, margin: "4px 0 0" }}>סופר אדמין</h2>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "12px 16px", color: "#64748b", fontSize: 12 }}>מחובר כבעל המוצר: {authUser.email}</div>
        <a href="https://github.com/efil59-lab/volleyball-team-app/blob/main/ROADMAP.md" target="_blank" rel="noopener noreferrer"
          style={{ background: "white", borderRadius: 14, padding: "16px 18px", textDecoration: "none", color: pc, fontWeight: 700, fontSize: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🗺️</span> מפת הדרכים (ROADMAP)
        </a>

        {/* בקשות הצטרפות ממתינות — מנהלות שנכנסו עם Google ומחכות לאישור */}
        {requests && requests.length > 0 && (
          <div style={{ background: "white", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "2px solid #f59e0b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 14 }}>בקשות הצטרפות ממתינות ({requests.length})</span>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>מנהלות שנכנסו עם Google וממתינות לאישור. אישור יוצר להן קבוצה ריקה — בכניסה הבאה הן יקבלו אשף הקמה.</p>
            {requests.map(r => (
              <div key={r.email} style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>{r.name || "מנהלת חדשה"}</div>
                <div style={{ fontSize: 12.5, color: "#64748b", wordBreak: "break-all", marginBottom: 8 }}>{r.email}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => approveRequest(r.email)} disabled={reqBusy === r.email}
                    style={{ flex: 1, background: reqBusy === r.email ? "#94a3b8" : "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "9px", cursor: reqBusy === r.email ? "default" : "pointer", fontWeight: 700, fontSize: 13 }}>
                    {reqBusy === r.email ? "מאשר…" : "✓ אשר וצור קבוצה"}
                  </button>
                  <button onClick={() => rejectRequest(r.email)} disabled={reqBusy === r.email}
                    style={{ background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    דחה
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* כלי: יצירת קבוצה + הזמנה למנהלת חדשה */}
        <div style={{ background: "white", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>➕</span>
            <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 14 }}>פתיחת קבוצה למנהלת חדשה</span>
          </div>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px", lineHeight: 1.5 }}>הקלידי את כתובת ה-Gmail של המנהלת. תיווצר קבוצה ריקה (ממתינה), והיא תוכל להיכנס איתה ולהקים אותה.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="gmail של המנהלת" type="email"
              style={{ ...S.input, flex: 1, margin: 0 }} />
            <button onClick={createTeamInvite} disabled={inviteBusy} style={{ background: inviteBusy ? "#94a3b8" : pc, color: "white", border: "none", borderRadius: 8, padding: "0 16px", cursor: inviteBusy ? "default" : "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
              {inviteBusy ? "יוצר…" : "צור הזמנה"}
            </button>
          </div>
          {inviteMsg && inviteMsg.error && <p style={{ color: "#ef4444", fontSize: 12.5, margin: "10px 0 0", fontWeight: 600 }}>⚠️ {inviteMsg.error}</p>}
          {inviteMsg && inviteMsg.teamId && (
            <div style={{ background: "#dcfce7", borderRadius: 10, padding: "10px 12px", marginTop: 10, fontSize: 12.5, color: "#166534", lineHeight: 1.6 }}>
              ✅ {inviteMsg.reused ? "כבר קיימת הזמנה" : "נוצרה קבוצה"} עבור <strong>{inviteMsg.email}</strong> (קוד: <strong>{inviteMsg.teamId}</strong>).<br />
              עכשיו המנהלת יכולה להיכנס עם אותו Gmail, והאשף ייפתח.
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 2px 0" }}>
          <span style={{ fontSize: 18 }}>👥</span>
          <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 15 }}>קבוצות במערכת</span>
          <button onClick={refreshTeams} style={{ marginRight: "auto", background: "transparent", border: "none", color: pc, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>↻ רענן</button>
        </div>

        {teams === null && <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 18 }}>טוען קבוצות…</div>}
        {teams && teams.length === 0 && <div style={{ background: "white", borderRadius: 14, padding: 18, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>אין עדיין קבוצות באינדקס. קבוצה תופיע כאן אחרי שמנהל/ת מתחבר/ת בפעם הראשונה.</div>}

        {teams && teams.map(t => {
          const pending = (t.status || "active") === "pending";
          return (
            <div key={t.teamId} style={{ background: "white", borderRadius: 14, padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 800, color: "#1e293b", fontSize: 14, overflowWrap: "anywhere" }}>{t.teamName || t.teamId}</div>
                <span style={{ marginRight: "auto", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: pending ? "#fef3c7" : "#dcfce7", color: pending ? "#92400e" : "#166534" }}>
                  {pending ? "⏳ ממתינה" : "✅ פעילה"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, overflowWrap: "anywhere" }}>{t.ownerEmail || "—"}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {t.playerCount || 0} שחקניות{t.createdAt ? ` · נוצרה ${formatShort(t.createdAt.split("T")[0])}` : ""} · <code style={{ fontSize: 10 }}>{t.teamId}</code>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {pending ? (
                  <button disabled={busyId === t.teamId} onClick={() => act(t.teamId, "active")}
                    style={{ flex: 1, padding: "9px", background: "#22c55e", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: busyId === t.teamId ? 0.6 : 1 }}>
                    {busyId === t.teamId ? "…" : "✅ אשר והפעל"}
                  </button>
                ) : (
                  <button disabled={busyId === t.teamId || t.teamId === DEFAULT_TEAM} onClick={() => act(t.teamId, "pending")}
                    style={{ flex: 1, padding: "9px", background: t.teamId === DEFAULT_TEAM ? "#e2e8f0" : "#fff", color: t.teamId === DEFAULT_TEAM ? "#94a3b8" : "#ef4444", border: `1px solid ${t.teamId === DEFAULT_TEAM ? "#e2e8f0" : "#fecaca"}`, borderRadius: 10, cursor: t.teamId === DEFAULT_TEAM ? "default" : "pointer", fontSize: 13, fontWeight: 700, opacity: busyId === t.teamId ? 0.6 : 1 }}>
                    {t.teamId === DEFAULT_TEAM ? "🔒 הבינלאומי (קבוע)" : (busyId === t.teamId ? "…" : "⏸️ השהה")}
                  </button>
                )}
                {t.teamId !== DEFAULT_TEAM && (
                  <button disabled={busyId === t.teamId} onClick={() => { setDeleteTarget(t); setConfirmText(""); setDelErr(""); }}
                    style={{ padding: "9px 12px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, cursor: busyId === t.teamId ? "default" : "pointer", fontSize: 13, fontWeight: 700, opacity: busyId === t.teamId ? 0.6 : 1 }}>🗑</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {deleteTarget && (() => {
        const expected = deleteTarget.teamName || deleteTarget.teamId;
        const match = confirmText.trim() === expected;
        const busy = busyId === deleteTarget.teamId;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}
            onClick={() => { if (!busy) { setDeleteTarget(null); setConfirmText(""); setDelErr(""); } }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 18, padding: 22, width: "100%", maxWidth: 380, boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize: 40, textAlign: "center" }}>⚠️</div>
              <h3 style={{ color: "#dc2626", fontSize: 18, fontWeight: 800, textAlign: "center", margin: "8px 0 6px" }}>מחיקת קבוצה לצמיתות</h3>
              <p style={{ fontSize: 13, color: "#475569", textAlign: "center", margin: "0 0 6px", lineHeight: 1.6 }}>
                פעולה זו תמחק <b>לצמיתות</b> את הקבוצה «{expected}», כולל כל השחקניות, החשבונות, הנוכחות, התמונות וכל הנתונים. <b>לא ניתן לשחזר.</b>
              </p>
              <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", margin: "10px 0 6px" }}>כדי לאשר, הקלידי את שם הקבוצה במדויק:</p>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textAlign: "center", background: "#f1f5f9", borderRadius: 8, padding: "6px", marginBottom: 8 }}>{expected}</div>
              <input value={confirmText} onChange={e => { setConfirmText(e.target.value); setDelErr(""); }} placeholder="הקלידי כאן את שם הקבוצה"
                style={{ ...S.input, textAlign: "center", border: `2px solid ${match ? "#22c55e" : "#e2e8f0"}` }} autoFocus />
              {delErr && <p style={{ color: "#dc2626", fontSize: 12, margin: "0 0 8px", fontWeight: 600, textAlign: "center" }}>⚠️ {delErr}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button disabled={busy} onClick={() => { setDeleteTarget(null); setConfirmText(""); setDelErr(""); }}
                  style={{ flex: 1, padding: 12, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>ביטול</button>
                <button disabled={!match || busy} onClick={doDelete}
                  style={{ flex: 1, padding: 12, background: (!match || busy) ? "#fca5a5" : "#dc2626", color: "white", border: "none", borderRadius: 12, cursor: (!match || busy) ? "default" : "pointer", fontSize: 14, fontWeight: 800 }}>
                  {busy ? "מוחק…" : "🗑 מחק לצמיתות"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
export { SuperAdminScreen };
