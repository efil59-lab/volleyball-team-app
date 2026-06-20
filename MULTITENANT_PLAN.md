# 🏗️ מסמך תכנון — מסחור ובידוד רב-קבוצתי (Tier 2)

> **אפליקציה:** הבינלאומי · `volleyball-team-app`
> **סטטוס:** תכנון בלבד — אין עדיין קוד. ביצוע יתחיל אחרי אישור המסמך.
> **כתב:** Efi + Claude · יוני 2026
> **מבוסס על:** `App.jsx` (3119 שורות) ו-`ROADMAP.md` שהועלו — מקור אמת.

---

## 0. תקציר מנהלים (TL;DR)

המטרה: להפוך את האפליקציה ל-**multi-tenant אמיתי** — כל קבוצה רואה רק את הנתונים שלה, כל שחקנית מוגנת בתוך הקבוצה, וקבוצות חדשות נעולות עד אישור ידני שלך (אחרי תשלום חיצוני).

הבסיס כבר קיים (`teams/{id}/data/`, `meta` עם בעלות, מיפוי `users/{uid}`, `resolveAdminTeam`, מסך סופר-אדמין שלד). מה שחסר:

1. **כריכת זהות** — מסמך חברות `teams/{t}/members/{uid}` שקושר טוקן→קבוצה→שחקנית. בלעדיו אין אכיפה.
2. **כללי Firestore אמיתיים (Tier 2)** שבודקים חברות ובעלות פר-מסמך.
3. **פיצול מסמכים** — נוכחות ופרופילים ממסמך-ענק אחד למסמך-לשחקנית, כדי שכלל יוכל להגן פר-שחקנית.
4. **שער כניסה** — שדה `status: pending/active` + מסך אישור קבוצות בסופר-אדמין.
5. **שני תיקונים קריטיים שהתגלו בקוד:** נתיב גלריה ב-Storage לא ממופה לקבוצה; סיסמאות שחקניות ב-plaintext גלוי.

הביצוע מתוכנן בשבעה שלבים ש**כל אחד מהם שומר על האפליקציה עובדת** — הבנות לא מרגישות כלום עד שנרצה.

---

## 1. תמונת מצב נוכחית (מה כבר בנוי — מאומת מהקוד)

### מבנה נתונים היום
```
teams/{teamId}/data/{key}        ← מסמך אחד לכל key
  ├─ players          [ {id, name, phone, email, ...} ]
  ├─ events           [ {id, type, date, time, ...} ]
  ├─ attendance       { "eventId_playerId": {status, note, time} }   ← מפה אחת ענקית
  ├─ profiles         { playerId: {photo(base64!), password(plaintext!), birthday, setupDone} }
  ├─ notifications, archive, games, gallery, applause, polls, personalNotifs, chat
  ├─ settings         { teamName, primaryColor, ... }
  └─ meta             { ownerUid, ownerEmail, adminUids: [...] }

users/{uid}          { teamId, email }     ← מיפוי משתמש→קבוצה (מחוץ למרחב הקבוצה)
```

### זהות והרשאות היום
- **שחקניות** = טוקן אנונימי (`signInAnonymously`). הטוקן **לא קשור** לאף שחקנית — הזיהוי כולו צד-לקוח (בוחרים שם + סיסמה שמושווית ב-JS).
- **מנהלות** = Google. `resolveAdminTeam` מזהה: אם המייל ב-`BIBLEUMI_ADMIN_EMAILS` → `bibleumi`; אחרת → `team_{uid}` חדשה, נזרעת ריקה ו**זמינה מיד** (אין שער כניסה כרגע).
- **סופר-אדמין** = `efil59@gmail.com` בלבד. לחיצה ארוכה על הלוגו → מסך `superAdmin` (כרגע: לינק ROADMAP + כרטיס "בקרוב").

### כללי Firestore היום (Tier 1)
`request.auth != null` לכל קריאה/כתיבה. **כל טוקן מזוהה (כולל אנונימי) קורא וכותב לכל קבוצה.** אין בידוד.

---

## 2. הפערים הקריטיים

| # | פער | חומרה | בתוכנית שלך? |
|---|-----|-------|---------------|
| A | אין בידוד בין קבוצות (Tier 1 פתוח לכולם) | 🔴 קריטי | ✅ כן |
| B | אין כריכת uid↔playerId — אי אפשר לאכוף פר-שחקנית | 🔴 קריטי | ⚠️ חלקית (הנחנו שפיצול מספיק — לא מספיק) |
| C | קבוצה חדשה זמינה מיד, בלי שער תשלום/אישור | 🟠 גבוה | ✅ כן (status pending) |
| D | **גלריה ב-Storage בנתיב גלובלי** `gallery/...` — דליפה בין-קבוצתית | 🟠 גבוה | ❌ **לא — חדש** |
| E | **סיסמאות שחקניות plaintext** במסמך profiles הגלוי לכל חבר קבוצה | 🟠 גבוה | ❌ **לא — חדש** |
| F | תמונות פרופיל base64 בתוך Firestore (נפח קריאה כבד) | 🟡 בינוני | חופף ל-13.5 |
| G | צ'אט = מערך במסמך אחד, last-write-wins | 🟡 בינוני | ✅ כן (subcollection) |

> **הערה על B:** "פיצול הנתונים כך שכלל יגן פר-שחקנית" נכון — אבל כלל יכול לבדוק "השחקנית הזו" רק אם הוא יודע מי המשתמש. לטוקן אנונימי יש `uid`, אבל שום דבר ב-Firestore לא אומר ש-`uid` הזה שייך ל-playerId 7. לכן **חייבים מסמך חברות שמחזיק `playerId`** — וזה אותו מסמך שמשמש לבידוד הקבוצתי. שתי ציפורים, אבן אחת.

---

## 3. מבנה נתונים חדש (Target Model)

### 3.1 מסמך חברות — הלב של Tier 2
```
teams/{teamId}/members/{uid}
  {
    role: "admin" | "player",
    playerId: <number|null>,   // null למנהלת; מספר השחקנית לשחקנית
    name: "<שם תצוגה>",
    joinedAt: <ISO>
  }
```
- **מנהלת:** נכתב ב-`resolveAdminTeam` (כבר קיים) — נוסיף כתיבת members לצד meta.
- **שחקנית:** נכתב ב**הצטרפות** (קוד/לינק). קושר את הטוקן האנונימי שלה ל-playerId. זו הכריכה שמאפשרת אכיפה.

### 3.2 status על הקבוצה (שער כניסה)
מרחיבים את `meta`:
```
teams/{teamId}/data/meta
  {
    ownerUid, ownerEmail, adminUids: [...],   // קיים
    status: "pending" | "active",             // חדש
    plan: "trial" | "paid" | "free",          // חדש (לעתיד — דמו 7 ימים #6)
    createdAt, activatedAt                     // חדש
  }
```
- `bibleumi` + קבוצות מוכרות = `active` (מיגרציה חד-פעמית).
- קבוצה חדשה = `pending`. נעולה עד שתאשר ידנית בסופר-אדמין.

### 3.3 פיצול נוכחות — מסמך לשחקנית
```
לפני:  teams/{t}/data/attendance = { "ev1_p7": {...}, "ev1_p3": {...}, ... }
אחרי:  teams/{t}/attendance/{playerId} = { "ev1": {status,note,time}, "ev2": {...} }
```
- כלל: שחקנית כותבת רק ל-`attendance/{playerId}` שתואם ל-`playerId` במסמך החברות שלה. מנהלת — לכל אחד.
- **תאימות לאחור:** שכבת load/save תקרא משני המקורות בתקופת מעבר (ראה §6 מיגרציה).

### 3.4 פיצול פרופילים — ציבורי מול פרטי
הבעיה: האפליקציה צריכה לקרוא פרטי-תצוגה של *כל* השחקניות (שם, תמונה, יום הולדת לברכות) — אז אי אפשר לנעול את כל הפרופיל ל"עצמי בלבד". אבל הסיסמה כן חייבת להיות פרטית.
```
teams/{t}/profiles/{playerId}   ← ציבורי-לחברי-הקבוצה: photo, birthday, setupDone, display
teams/{t}/secrets/{playerId}    ← פרטי: password — קריא/כתיב לשחקנית עצמה + מנהלת בלבד
```
- שדרוג מומלץ בהמשך: לוותר על סיסמת-plaintext לטובת Email/Password של Firebase. כרגע — לפחות להוציא את הסיסמה למסמך נעול.
- תמונות פרופיל: בהמשך לעבור מ-base64 ל-Storage דחוס (חופף 13.5 + F).

### 3.5 גלריה — מיפוי Storage לקבוצה
```
לפני:  gallery/{ts}_{name}                      ← גלובלי, דולף בין קבוצות
אחרי:  teams/{teamId}/gallery/{ts}_{name}       ← ממופה
```
+ דחיסת canvas לפני העלאה (13.5) + הגבלת 5/יום (13.6).

### 3.6 צ'אט — subcollection
```
לפני:  teams/{t}/data/chat = [ {id, playerId, name, text, ts} ]   (200 אחרונות, last-write-wins)
אחרי:  teams/{t}/chat/{msgId}  (addDoc)                            ← בלי דריסות, query ב-200 אחרונים
```

---

## 4. כללי Firestore (Tier 2) — לוגיקה

> טיוטה רעיונית, לא קוד סופי. נכתוב ונבדוק ב-Firestore Emulator לפני פריסה.

**עוזרים:**
```
function signedIn()        { return request.auth != null; }
function member(t)         { return exists(/databases/(default)/documents/teams/$(t)/members/$(request.auth.uid)); }
function memberDoc(t)      { return get(/databases/(default)/documents/teams/$(t)/members/$(request.auth.uid)).data; }
function isAdmin(t)        { return signedIn() && memberDoc(t).role == "admin"; }
function isActive(t)       { return get(/databases/(default)/documents/teams/$(t)/data/meta).data.value.status == "active"; }
function myPlayerId(t)     { return memberDoc(t).playerId; }
function isSuper()         { return request.auth.token.email == "efil59@gmail.com"; }
```

**כללים:**
```
match /users/{uid} {
  allow read, write: if signedIn() && request.auth.uid == uid;   // כל אחד רק את המיפוי שלו
}

match /teams/{t} {

  match /members/{uid} {
    allow read:   if isAdmin(t) || request.auth.uid == uid;
    allow create: if signedIn() && request.auth.uid == uid && isActive(t);  // הצטרפות עצמית בלבד, לקבוצה פעילה
    allow update, delete: if isAdmin(t);
  }

  match /data/{key} {
    // נתונים משותפים (events, games, settings, notifications, gallery-index, polls...)
    allow read:  if member(t) && isActive(t);
    allow write: if isAdmin(t);
    // meta: סופר-אדמין יכול לשנות status (אישור קבוצה); אדמין יכול לעדכן adminUids
    // → match ייעודי ל-meta (ראה §5)
  }

  match /attendance/{playerId} {
    allow read:  if member(t) && isActive(t);
    allow write: if isAdmin(t) || (myPlayerId(t) == int(playerId) && isActive(t));
  }

  match /profiles/{playerId} {
    allow read:  if member(t) && isActive(t);                    // תצוגה לכולם
    allow write: if isAdmin(t) || (myPlayerId(t) == int(playerId));
  }

  match /secrets/{playerId} {
    allow read, write: if isAdmin(t) || myPlayerId(t) == int(playerId);  // סיסמה — עצמי/מנהלת בלבד
  }

  match /chat/{msgId} {
    allow read:   if member(t) && isActive(t);
    allow create: if member(t) && isActive(t) && request.resource.data.uid == request.auth.uid;
    allow delete: if isAdmin(t) || resource.data.uid == request.auth.uid;
  }
}
```

**נקודות עדינות שצריך להחליט:**
- **עלות קריאות בכללים:** כל `get()`/`exists()` בכלל = קריאת Firestore שמחויבת. כלל נוכחות עם 2–3 `get` לכל פעולה מכפיל קריאות. פתרון: לשמור `role`+`playerId` ב-**custom claims** של הטוקן (דורש Cloud Function) — מהיר וזול יותר. החלטה: Tier 2 עם `get` (פשוט), Tier 2.5 עם claims אם העלות מטפסת.
- **`isActive` בכל קריאה** = עוד `get(meta)`. אפשר להקל: לבדוק active רק על כתיבה ועל members/create, ולתת read אם member.
- **קבוצה pending:** במודל הנעול, גם הבעלים לא יכול לכתוב עד אישור — מה שמתנגש עם Onboarding (#7) שבו המנהלת מקימה את הקבוצה *לפני* שתשלם. → **החלטה פתוחה ב-§7.**

---

## 5. שער כניסה + מסך אישור קבוצות (סופר-אדמין)

### זרימה (מודל 1 — אישור ידני)
1. מנהלת חדשה מתחברת Google → `resolveAdminTeam` יוצר `team_{uid}` עם `status: "pending"`.
2. האפליקציה מציגה לה מסך "🔒 הקבוצה ממתינה לאישור — צרי קשר עם המפעיל" (לא נכנסת לפאנל).
3. תשלום מתבצע **מחוץ לאפליקציה** (העברה/ביט/וכו').
4. אתה נכנס לסופר-אדמין → רשימת קבוצות → רואה את ה-pending → "✅ אשר" → `status: "active"`.
5. בכניסה הבאה שלה — נכנסת רגיל.

### מסך הסופר-אדמין (הרחבת `SuperAdminScreen` הקיים)
מחליף את כרטיס "👥 בקרוב" ב:
- **רשימת קבוצות** — קריאה מ-collection `teams` (או index ב-`superadmin/teams`). לכל קבוצה: שם, בעלים (email), status, תאריך יצירה, מספר שחקניות.
- **כפתורי פעולה:** אשר (pending→active) · השהה (active→pending) · האריך דמו · מחק.
- **גישה לקריאה החוצה:** כדי שהסופר-אדמין יראה את *כל* הקבוצות צריך כלל read מיוחד: `allow read: if isSuper()` על `match /teams/{t}/data/meta` ועל אינדקס ייעודי. נשמור גם **מסמך אינדקס** `superadmin/index/teams/{teamId}` (נכתב ב-`resolveAdminTeam`) כדי לא לסרוק את כל ה-collection.

```
superadmin/index/teams/{teamId}  { teamName, ownerEmail, status, createdAt, playerCount }
  allow read, write: if isSuper();
```
(הקבוצה עצמה כותבת לכאן? לא — רק הבעלים/סופר. נכתוב ב-`resolveAdminTeam` תחת הרשאת הבעלים, או ב-Cloud Function בעתיד. החלטה ב-§7.)

---

## 6. אסטרטגיית מיגרציה — בלי לאבד שום נתון של הבנות

עיקרון-על: **כל שלב אחורה-תואם.** קוראים מהמבנה החדש *וגם* מהישן בתקופת מעבר; כותבים לחדש; ממירים פעם אחת.

### 6.1 meta — הוספת status
- סקריפט/פעולה חד-פעמית: לכל קבוצה קיימת (כרגע רק `bibleumi` + טסטים) → `status: "active"`, `plan: "free"`.
- בקוד: אם `meta.status` חסר → להתייחס כ-`active` (ברירת מחדל בטוחה לקבוצות ותיקות).

### 6.2 members — איכלוס רטרואקטיבי
- **מנהלות:** ב-login הבא, `resolveAdminTeam` כותב גם `members/{uid}` (role:admin). כבר מחוברות → ייכתב אוטומטית בכניסה.
- **שחקניות קיימות (הבינלאומי):** הן אנונימיות וכבר "זכורות במכשיר" (localStorage). בכניסה הבאה, אם יש `rememberPlayer_{id}` ואין `members/{uid}` → כותבים אוטומטית `members/{uid} = {role:player, playerId:id}` (self-binding שקט). כך הבנות לא צריכות לעשות כלום.
  - גיבוי: למי שמתחברת מחדש — מסך הזיהוי הרגיל יכתוב את החברות אחרי אימות הסיסמה.

### 6.3 attendance — פיצול
- שלב כתיבה-כפולה: `upd.attendance` כותב גם למפה הישנה וגם ל-`attendance/{playerId}`.
- סקריפט חד-פעמי: קורא `data/attendance`, מפזר ל-`attendance/{playerId}`.
- שלב קריאה: `loadTeamData` מאחד את שני המקורות (חדש גובר). אחרי שבוע יציב — מורידים את הישן.

### 6.4 profiles → profiles + secrets
- סקריפט: לכל playerId, מעתיק `password` ל-`secrets/{playerId}`, ושאר השדות ל-`profiles/{playerId}`. מוחק `password` מהפרופיל הציבורי.
- קריאה אחורה-תואמת בזמן המעבר.

### 6.5 גלריה ב-Storage — הקריטי
- **תמונות חדשות:** מעלות ל-`teams/{teamId}/gallery/...` (+ דחיסה).
- **תמונות קיימות:** ה-URL ב-`gallery`-index עדיין מצביע לקובץ הישן ב-`gallery/...` הגלובלי — **הן ימשיכו לעבוד** (ה-URL לא משתנה). לא נמחק אותן. רק *העלאות חדשות* יקבלו נתיב ממופה. הכלל החדש ב-Storage יחול על נתיבים חדשים; הישנים נשארים נגישים דרך ה-URL השמור.
- (אופציונלי בעתיד: Cloud Function שמעבירה קבצים ישנים ומעדכנת URL — לא נדרש להשקה.)

### 6.6 chat → subcollection
- כתיבה כפולה זמנית, ואז מעבר ל-`addDoc`. הצ'אט הקיים (200 הודעות) — מיגרציה חד-פעמית או פשוט "התחלה נקייה" (החלטה — הצ'אט לא קריטי היסטורית).

---

## 7. החלטות פתוחות (צריך תשובה לפני ביצוע)

1. **Onboarding מול pending:** קבוצה חדשה נעולה לגמרי (גם לבעלים) עד אישור? או — הבעלים יכול להקים/לשחק עם הקבוצה אבל היא לא "משוחררת" לשחקניות עד אישור? (האחרון ידידותי יותר למסחור: מנהלת מתרשמת, מקימה, ואז משלמת לשחרר.)
2. **דמו 7 ימים (#6):** להכניס עכשיו לתוך `status`/`plan`, או בשלב נפרד אחרי הבידוד?
3. **כתיבת אינדקס הסופר-אדמין:** מהקליינט (תחת הרשאת בעלים) או לחכות ל-Cloud Function? (קליינט = פשוט עכשיו; Function = נקי לקנה מידה.)
4. **Custom claims מול get():** מתחילים עם `get()` בכללים (פשוט, מעט יקר) ומשדרגים ל-claims רק אם צריך?
5. **סיסמאות:** מוציאים ל-`secrets` עכשיו, או קופצים ישר ל-Firebase Email/Password? (המלצתי: `secrets` עכשיו, Email/Password בעתיד.)
6. **צ'אט היסטורי:** מהגרים את 200 ההודעות או מתחילים נקי?

---

## 8. עלויות ותקרות בקנה מידה

| רכיב | חינמי עד | בקנה מידה (~50 קבוצות) | הערה |
|------|----------|------------------------|------|
| **Vercel** | Hobby — **אסור מסחרית** | **Pro $20/חודש קבוע** | חובה לעבור ל-Pro ברגע שיש הכנסה |
| **Firebase Firestore** | 50K read / 20K write ביום | ~$0–10/חודש | כללי Tier 2 עם `get()` מגדילים קריאות — לעקוב |
| **Firebase Storage** | 5GB / 1GB הורדה ביום | ~$5–30/חודש | **ההוצאה הדומיננטית.** $0.026/GB אחסון, $0.12/GB הורדה |
| **Auth** | ללא הגבלה מעשית | $0 | אנונימי + Google חינם |
| **סה"כ משוער** | | **~$25–60/חודש** | בעיקר Vercel Pro + תמונות |

**בלמי עלות מתוכננים:**
- 🔴 **חובה: Budget Alert ב-Google Cloud** (~$5–10) — Blaze **אין לו תקרה קשיחה**, חיוב יכול לטפס בלי גבול. זו ההגנה היחידה.
- 🗜️ **דחיסת תמונות (13.5)** — canvas צד-לקוח ל-300–500KB. חוסך ~פי 10 ב-Storage ובעיקר ב-**bandwidth** (ההוצאה האמיתית). הפריט הכי משתלם כלכלית.
- 🚦 **הגבלת 5 תמונות/שחקנית/יום (13.6)** — רך בקוד עכשיו, אכיפה בכללים ב-Tier 2.
- 📉 **claims במקום get()** אם קריאות הכללים מטפסות.
- כיום העלות בפועל כנראה **$0** (חינמי).

---

## 9. סדר ביצוע — שלב-שלב, האפליקציה עובדת תמיד

> כל שלב = מסירה עצמאית (`App.jsx` + `ROADMAP.md`), נבדק ב-Incognito (בגלל ה-SW cache), לא שובר את הקיים. שינויי אבטחה/מנהל **לא** מעלים WHATS_NEW; פיצ'רים מול שחקניות כן.

| שלב | מה עושים | מעלה WHATS_NEW? | סיכון |
|-----|----------|:---:|------|
| **0. הכנה** | Budget Alert ב-GCP · גיבוי ידני של נתוני הבינלאומי (export) · הקמת Firestore Emulator לבדיקת כללים | — | אפס |
| **1. status + meta** | הוספת `status` ל-meta · קבוצות קיימות→active · מסך "ממתין לאישור" לקבוצה pending · `resolveAdminTeam` יוצר חדשה כ-pending | לא | נמוך |
| **2. members + סופר-אדמין** | כתיבת `members/{uid}` (מנהלת ב-login, שחקנית ב-self-binding שקט) · אינדקס סופר-אדמין · מסך אישור קבוצות | לא | נמוך |
| **3. פיצול attendance** | כתיבה כפולה · סקריפט מיגרציה · קריאה מאוחדת | לא | בינוני |
| **4. פיצול profiles+secrets** | סיסמה→secrets · קריאה אחורה-תואמת · מיגרציה | לא | בינוני |
| **5. כללי Tier 2** | פריסת הכללים החדשים *אחרי* ש-1–4 יציבים · בדיקה ב-Emulator ואז production · גלגול אחורה מהיר מוכן | לא | **גבוה — נקודת האל-חזור** |
| **6. גלריה ממופה + דחיסה** | נתיב `teams/{t}/gallery/` · canvas compression · כללי Storage · הגבלת 5/יום (רך) | כן (דחיסה משפרת חוויה) | בינוני |
| **7. צ'אט subcollection** | `addDoc` · query 200 אחרונים · מיגרציה/התחלה נקייה | אפשר | נמוך |

**עקרון בטיחות לשלב 5:** הכללים נפרסים רק כשכל מבני הנתונים החדשים כבר מאוכלסים ומאומתים. לפני הפריסה — בדיקה מלאה ב-Emulator עם טוקן אנונימי + טוקן Google. אם משהו נשבר ב-production → גלגול מיידי ל-Tier 1 (שמור בצד).

---

## 10. מה צריך ממך עכשיו

1. אישור עקרוני של המבנה (§3) והכללים (§4).
2. תשובות ל-6 ההחלטות הפתוחות (§7) — בעיקר #1 (Onboarding מול pending) ו-#5 (סיסמאות).
3. אישור סדר הביצוע (§9), או שינוי סדר.

אחרי שתאשר — מתחילים משלב 0/1, מסירה ראשונה: `App.jsx` + `ROADMAP.md` מעודכן.
