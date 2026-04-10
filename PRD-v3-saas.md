# PRD: עוזר אישי ב-WhatsApp — מודל SaaS (Multi-Tenant MVP)

## מבוא

שדרוג הפרויקט ממודל "כל משתמש מריץ לעצמו" למודל **SaaS מרכזי**: שרת אחד שלך מנהל 5-10 לקוחות (MVP), כל לקוח מחבר את ה-WhatsApp ואת ה-Google Calendar שלו, אבל כל ה-AI וה-infrastructure רצים מהחשבון שלך. הלקוח לא צריך לדעת מה זה API key.

**חוויית הלקוח:** מקבל ממך לינק → נרשם → סורק QR → מחבר יומן → בוחר שם לעוזר → מתחיל לעבוד. תשלום מנוי חודשי דרך Stripe.

**חוויית המנהל (אתה):** דשבורד ווב עם כל הלקוחות, סטטוסים, שימוש, יצירת הזמנות, ניהול מנויים.

---

## מטרות

- שרת מרכזי אחד שמנהל עד 10 לקוחות במקביל (MVP)
- כל לקוח מחבר WhatsApp + Google Calendar שלו בלבד (ללא API keys)
- מנוי חודשי דרך Stripe — תשלום אוטומטי
- דשבורד ניהול למנהל: לקוחות, סטטוסים, שימוש, הכנסות
- הרשמת לקוח דרך לינק ייחודי ששולח המנהל
- כל יכולות העוזר מ-v2.2: יומן, פגישות, תזכורות, סיכום יומי, קול, ניסוח הודעות
- אישור full-loop על כל פעולה
- מערכת רישוי — כל לקוח עם מפתח ייחודי חד-פעמי

---

## סיפורי משתמש (User Stories)

### Phase 1: תשתית Multi-Tenant + DB

---

### US-001: מסד נתונים — סכמת לקוחות ומנויים (מאובטח)
**תיאור:** כמפתח, אני רוצה מסד נתונים מאובטח שמחזיק את כל נתוני הלקוחות, סגור לגישה חיצונית, רק המנהל יכול לגשת אליו.

**קריטריונים לקבלה:**
- [ ] SQLite DB (קובץ אחד, פשוט ל-MVP) עם ספריית `better-sqlite3`
- [ ] 🔒 קובץ ה-DB נשמר מחוץ ל-public folder — לא נגיש מהווב
- [ ] 🔒 קובץ ה-DB מוצפן ב-encryption at rest (באמצעות `better-sqlite3` עם `sqlcipher` או הצפנת filesystem)
- [ ] 🔒 סיסמת DB נשמרת כמשתנה סביבה `DB_ENCRYPTION_KEY` — לא בקוד
- [ ] 🔒 גישה ל-DB אך ורק דרך שכבת ה-service (src/db/index.js) — אין גישה ישירה מ-routes
- [ ] 🔒 אין endpoint ציבורי שחושף נתוני DB — כל הגישה דרך דשבורד מוגן סיסמה בלבד
- [ ] 🔒 שדות רגישים (google_refresh_token, license_key) מוצפנים ב-AES-256 לפני שמירה ל-DB
- [ ] 🔒 DB file ב-`.gitignore` — לא עולה ל-GitHub לעולם
- [ ] 🔒 גיבוי אוטומטי של ה-DB פעם ביום לתיקיית backups (שמירת 7 ימים אחרונים)
- [ ] טבלת `tenants`: id, name, phone, agent_name, license_key (encrypted), stripe_customer_id, stripe_subscription_id, subscription_status (active/trial/expired/cancelled), google_refresh_token (encrypted), whatsapp_status (connected/disconnected), created_at, updated_at
- [ ] טבלת `usage_logs`: id, tenant_id, action_type, tokens_used, timestamp
- [ ] טבלת `invitations`: id, token (UUID), tenant_name, created_by, used, used_at, created_at
- [ ] טבלת `billing_history`: id, tenant_id, stripe_invoice_id, amount_cents, currency, status (paid/failed/refunded), period_start, period_end, paid_at, created_at
- [ ] קובץ `src/db/index.js` עם פונקציות CRUD בסיסיות
- [ ] Migration script שיוצר את הטבלאות בהפעלה ראשונה
- [ ] Typecheck passes

---

### US-002: Tenant Manager — ניהול לקוחות (גישה מוגבלת למנהל בלבד)
**תיאור:** כמפתח, אני רוצה שכבה שמנהלת את כל הלקוחות, שרק המנהל יכול לבצע בה שינויים.

**קריטריונים לקבלה:**
- [ ] שירות `src/services/tenantManager.js`
- [ ] 🔒 כל פונקציות כתיבה (create, update, delete) נגישות **רק** מדשבורד מוגן סיסמה או מ-Stripe webhook
- [ ] 🔒 פונקציות קריאה (get, list) נגישות רק מקוד פנימי — אין endpoint ציבורי
- [ ] 🔒 כל שינוי ב-tenant מתועד בלוג: מי שינה, מה שונה, מתי
- [ ] פונקציה `getTenantByPhone(phone)` — מחזיר את הלקוח לפי מספר טלפון
- [ ] פונקציה `createTenant(data)` — יוצר לקוח חדש
- [ ] פונקציה `updateTenant(id, data)` — מעדכן פרטים
- [ ] פונקציה `deleteTenant(id)` — מוחק לקוח (soft delete — מסמן כ-deleted, לא מוחק מ-DB)
- [ ] פונקציה `getAllTenants()` — רשימת כל הלקוחות (לא כולל deleted)
- [ ] פונקציה `isSubscriptionActive(tenantId)` — בודק אם המנוי פעיל
- [ ] אם מנוי לא פעיל — הסוכן עונה "המנוי שלך לא פעיל. חדש את המנוי."
- [ ] Typecheck passes

---

### US-003: Multi-WhatsApp Manager — ניהול חיבורי WhatsApp מרובים
**תיאור:** כמפתח, אני רוצה לנהל חיבורי WhatsApp נפרדים לכל לקוח על אותו שרת.

**קריטריונים לקבלה:**
- [ ] שירות `src/services/whatsappManager.js`
- [ ] כל לקוח מקבל instance נפרד של whatsapp-web.js עם session נפרד
- [ ] Sessions נשמרים בתיקיות נפרדות: `.wwebjs_auth/tenant_{id}/`
- [ ] פונקציה `connectTenant(tenantId)` — מפעיל WhatsApp ללקוח ומחזיר QR
- [ ] פונקציה `disconnectTenant(tenantId)` — מנתק לקוח
- [ ] פונקציה `sendToTenant(tenantId, message)` — שולח הודעה ללקוח
- [ ] בהפעלת השרת — מחבר מחדש את כל הלקוחות עם session קיים
- [ ] מגבלה: מקסימום 10 חיבורים במקביל (MVP)
- [ ] Typecheck passes

---

### US-004: Message Router — ניתוב הודעות לפי לקוח
**תיאור:** כמפתח, אני רוצה שכל הודעה נכנסת תנותב ללקוח הנכון ותעובד בהקשר שלו.

**קריטריונים לקבלה:**
- [ ] כשמגיעה הודעה — מזהה את מספר השולח → מוצא tenant → בודק מנוי פעיל
- [ ] בודק שההודעה מתחילה בשם הסוכן של אותו tenant
- [ ] שולח ל-AI עם System Prompt ספציפי ללקוח (שם הסוכן שלו)
- [ ] משתמש ב-Google Calendar של אותו tenant (לפי ה-refresh token שלו)
- [ ] תזכורות וסיכום יומי — לכל tenant בנפרד
- [ ] לוג של כל פעולה ב-usage_logs
- [ ] Typecheck passes

---

### Phase 2: הרשמת לקוח + תשלום

---

### US-005: דף הרשמה ללקוח (Invitation Link)
**תיאור:** כמנהל, אני רוצה ליצור לינק הזמנה ולשלוח ללקוח, כדי שהוא ירשם בעצמו.

**קריטריונים לקבלה:**
- [ ] בדשבורד: כפתור "צור הזמנה" → מייצר לינק ייחודי `https://server/invite/{token}`
- [ ] הלינק חד-פעמי — לאחר שימוש הוא פג
- [ ] דף הרשמה מותאם לנייד בכתובת `/invite/{token}`
- [ ] הלקוח ממלא: שם מלא, מספר טלפון
- [ ] לאחר מילוי → הלקוח מועבר לדף תשלום (Stripe Checkout)
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-006: אינטגרציית Stripe — מנוי חודשי + היסטוריית חיובים
**תיאור:** כמנהל, אני רוצה שהלקוח ישלם מנוי חודשי אוטומטית דרך Stripe, ושכל חיוב יתועד ב-DB.

**קריטריונים לקבלה:**
- [ ] שירות `src/services/stripe.js`
- [ ] Stripe Checkout Session נוצר בעת הרשמה עם price_id מוגדר
- [ ] Webhook endpoint `/api/stripe/webhook` מקבל אירועי Stripe:
  - `checkout.session.completed` → מפעיל לקוח + שומר רשומת billing ראשונה
  - `invoice.paid` → מחדש מנוי + שומר רשומת billing
  - `invoice.payment_failed` → מסמן מנוי כ-expired + שומר רשומת billing עם status=failed
  - `customer.subscription.deleted` → מבטל מנוי
- [ ] Stripe Customer ID ו-Subscription ID נשמרים בטבלת tenants
- [ ] 🔒 Webhook מאומת עם `STRIPE_WEBHOOK_SECRET` — דוחה בקשות לא חתומות
- [ ] **היסטוריית חיובים per-tenant** — כל אירוע Stripe נשמר בטבלת `billing_history`:
  - `tenant_id` — לאיזה לקוח
  - `stripe_invoice_id` — מזהה החשבונית ב-Stripe
  - `amount_cents` — סכום בסנט (למשל 7900 = $79.00)
  - `currency` — מטבע (usd/ils)
  - `status` — paid / failed / refunded
  - `period_start` / `period_end` — תקופת החיוב
  - `paid_at` — תאריך תשלום בפועל
- [ ] בדשבורד לקוח (US-009): טבלת היסטוריית חיובים מסודרת — תאריך, סכום, סטטוס, תקופה
- [ ] בדשבורד ראשי (US-008): סה"כ הכנסה חודשית מחושב מ-billing_history
- [ ] מחיר מוגדר כמשתנה סביבה: `STRIPE_PRICE_ID`
- [ ] Typecheck passes

---

### US-007: Onboarding לקוח — חיבור WhatsApp + יומן + שם
**תיאור:** כלקוח, אחרי תשלום אני רוצה לחבר את ה-WhatsApp שלי ואת היומן שלי בתהליך פשוט.

**קריטריונים לקבלה:**
- [ ] אחרי תשלום מוצלח → הלקוח מועבר לדף onboarding: `/onboard/{tenant_id}`
- [ ] שלב 1: סריקת QR ל-WhatsApp (כתמונה בדף, כמו ב-v2)
- [ ] שלב 2: כפתור "חבר Google Calendar" → OAuth flow
- [ ] שלב 3: הסוכן שולח הודעת WhatsApp: "איך תרצה לקרוא לי?"
- [ ] שלב 4: הלקוח עונה ב-WhatsApp → שם הסוכן נשמר → מוכן!
- [ ] דף הסטטוס מתעדכן בזמן אמת (polling)
- [ ] הדף מותאם לנייד
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### Phase 3: דשבורד ניהול

---

### US-008: דשבורד — מסך ראשי עם רשימת לקוחות
**תיאור:** כמנהל, אני רוצה לראות את כל הלקוחות שלי במבט אחד.

**קריטריונים לקבלה:**
- [ ] דף `/admin` מוגן בסיסמה (cookie-based כמו ב-v2)
- [ ] טבלת לקוחות: שם, טלפון, שם הסוכן, סטטוס WhatsApp (🟢/🔴), סטטוס מנוי (🟢/🟡/🔴), תאריך הצטרפות
- [ ] סיכום למעלה: סה"כ לקוחות, פעילים, מנויים פעילים, הכנסה חודשית
- [ ] כפתור "צור הזמנה חדשה" → מייצר לינק
- [ ] מותאם לנייד
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-009: דשבורד — דף לקוח בודד
**תיאור:** כמנהל, אני רוצה לראות פרטים מלאים על כל לקוח.

**קריטריונים לקבלה:**
- [ ] דף `/admin/tenant/{id}`
- [ ] פרטי הלקוח: שם, טלפון, שם הסוכן, תאריך הצטרפות
- [ ] סטטוס WhatsApp + כפתור "חבר מחדש" / "נתק"
- [ ] סטטוס מנוי + לינק ל-Stripe Dashboard
- [ ] לוג שימוש: כמה הודעות היום/השבוע/החודש
- [ ] כפתור "השהה לקוח" / "בטל לקוח"
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### US-010: דשבורד — לוג פעילות
**תיאור:** כמנהל, אני רוצה לראות לוג של כל הפעולות שהמערכת מבצעת.

**קריטריונים לקבלה:**
- [ ] דף `/admin/logs`
- [ ] טבלה: timestamp, שם לקוח, סוג פעולה (create_event, etc.), סטטוס (success/error)
- [ ] פילטר לפי לקוח, לפי סוג פעולה, לפי תאריך
- [ ] מוגבל ל-1000 רשומות אחרונות
- [ ] Typecheck passes
- [ ] Verify changes work in browser

---

### Phase 4: לוגיקת העוזר (מועברת מ-v2)

---

### US-011: AI Service — עם הקשר per-tenant
**תיאור:** כמפתח, אני רוצה שה-AI יעבוד בהקשר של הלקוח הספציפי.

**קריטריונים לקבלה:**
- [ ] `processMessage(userMessage, tenant)` — מקבל tenant כפרמטר
- [ ] System Prompt כולל את שם הסוכן של ה-tenant
- [ ] הגנת Prompt Injection (מ-v2.1)
- [ ] Input length limit (2000 chars)
- [ ] Output intent validation (whitelist)
- [ ] לוג tokens שנצרכו ב-usage_logs
- [ ] Typecheck passes

---

### US-012: Calendar Service — per-tenant Google Calendar
**תיאור:** כמפתח, אני רוצה שכל פעולת יומן תבוצע ביומן של הלקוח הספציפי.

**קריטריונים לקבלה:**
- [ ] כל פונקציה (createEvent, updateEvent, etc.) מקבלת tenant כפרמטר
- [ ] OAuth client נוצר עם ה-refresh token של ה-tenant
- [ ] אם ה-token פג — מעדכן אוטומטית ושומר את ה-token החדש
- [ ] אם ה-token לא תקין — שולח הודעה ללקוח: "צריך לחבר מחדש את היומן"
- [ ] Typecheck passes

---

### US-013: Handlers — Create/Update/Delete/Meeting (per-tenant)
**תיאור:** כמפתח, אני רוצה שכל ה-handlers יעבדו בהקשר per-tenant.

**קריטריונים לקבלה:**
- [ ] כל handler מקבל `tenant` כפרמטר נוסף
- [ ] Full-loop confirmation (מ-v2): אישור רק אחרי הצלחה מלאה
- [ ] הודעות שגיאה גנריות (לא חושפות מידע פנימי)
- [ ] Typecheck passes

---

### US-014: תמלול קולי — per-tenant
**תיאור:** כמפתח, אני רוצה שתמלול הודעות קוליות יעבוד לכל לקוח.

**קריטריונים לקבלה:**
- [ ] לוג של tokens/שניות תמלול ב-usage_logs ליד ה-tenant
- [ ] Temp files עם tenant_id בשם (למניעת התנגשויות)
- [ ] Cleanup בכל מקרה (try/finally)
- [ ] Typecheck passes

---

### US-015: תזכורות — per-tenant scheduler
**תיאור:** כמפתח, אני רוצה שתזכורות ישלחו לכל לקוח בנפרד.

**קריטריונים לקבלה:**
- [ ] Scheduler אחד שרץ כל 15 דקות ועובר על כל הלקוחות הפעילים
- [ ] בודק אירועים ביומן של כל tenant בנפרד
- [ ] שולח תזכורת WhatsApp + popup ביומן לכל tenant
- [ ] מנגנון למניעת כפילויות per-tenant
- [ ] Typecheck passes

---

### US-016: סיכום יומי — per-tenant
**תיאור:** כמפתח, אני רוצה שסיכום יומי ב-20:00 ישלח לכל לקוח בנפרד.

**קריטריונים לקבלה:**
- [ ] Cron ב-20:00 שעובר על כל הלקוחות הפעילים
- [ ] שולף אירועי היום ומחר מהיומן של כל tenant
- [ ] שולח הודעת סיכום ב-WhatsApp לכל tenant
- [ ] Typecheck passes

---

### Phase 5: אבטחה + לוגים

---

### US-017: אבטחה — כל תיקוני v2.1 + multi-tenant
**תיאור:** כמפתח, אני רוצה שכל תיקוני האבטחה מ-v2.1 יעבדו במודל multi-tenant.

**קריטריונים לקבלה:**
- [ ] כל הודעה נבדקת: האם המספר שייך ל-tenant רשום?
- [ ] כל הודעה נבדקת: האם המנוי של ה-tenant פעיל?
- [ ] Security headers על כל דף (admin, onboard, invite)
- [ ] Rate limiting על דפי login ו-API
- [ ] Cookie-based auth לדשבורד
- [ ] הודעות שגיאה גנריות (לא חושפות מידע)
- [ ] Temp file cleanup
- [ ] Prompt injection protection per-tenant
- [ ] Typecheck passes

---

### US-018: מערכת לוגים — מרכזית ל-multi-tenant
**תיאור:** כמפתח, אני רוצה מערכת לוגים שתומכת ב-multi-tenant.

**קריטריונים לקבלה:**
- [ ] כל לוג כולל: timestamp, tenant_id (או 'system'), level, message
- [ ] לוגים נשמרים גם ל-console וגם ל-DB (usage_logs)
- [ ] שגיאות קריטיות (WhatsApp disconnect, API failure) מתועדות
- [ ] Typecheck passes

---

## לא-מטרות (Non-Goals) — MVP

- **לא** יותר מ-10 לקוחות (MVP)
- **לא** horizontal scaling — שרת אחד בלבד
- **לא** אפליקציה — רק WhatsApp + דפי ווב
- **לא** תמיכה רב-שפתית — עברית בלבד
- **לא** API חיצוני לפיתוח צד שלישי
- **לא** דשבורד ללקוח — רק למנהל
- **לא** free tier — רק מנוי בתשלום
- **לא** העברת WhatsApp בין מכשירים ללא סריקה מחדש

---

## הערות טכניות

### סטאק טכנולוגי
- **Runtime:** Node.js + Express
- **DB:** SQLite (better-sqlite3) — קובץ אחד, מספיק ל-MVP
- **WhatsApp:** whatsapp-web.js — instance נפרד לכל tenant
- **AI:** Claude API (Anthropic) — חשבון אחד של המנהל
- **תמלול:** OpenAI Whisper API — חשבון אחד של המנהל
- **יומן:** Google Calendar API — OAuth per-tenant (כל לקוח מחבר שלו)
- **תשלומים:** Stripe (Checkout + Webhooks + Subscriptions)
- **הרצה:** Railway (שרת אחד) — או VPS עם Docker

### ארכיטקטורה
```
שרת מרכזי (Railway)
│
├── Express Web Server
│   ├── /invite/{token}     → דף הרשמה ללקוח
│   ├── /onboard/{id}       → חיבור WhatsApp + Calendar + שם
│   ├── /api/stripe/webhook → אירועי תשלום
│   ├── /admin              → דשבורד ניהול (מוגן סיסמה)
│   └── /admin/tenant/{id}  → דף לקוח בודד
│
├── WhatsApp Manager
│   ├── Tenant 1 → whatsapp-web.js instance → session_1/
│   ├── Tenant 2 → whatsapp-web.js instance → session_2/
│   └── ...
│
├── Message Router
│   └── הודעה נכנסת → מזהה tenant → בודק מנוי → AI → Handler → Calendar → תשובה
│
├── Cron Jobs
│   ├── Reminder Scheduler (כל 15 דק) → לכל tenant
│   └── Daily Summary (20:00) → לכל tenant
│
└── SQLite DB (data.db)
    ├── tenants
    ├── usage_logs
    └── invitations
```

### משתני סביבה
```
# שרת
PORT=3000
ADMIN_PASSWORD=

# מסד נתונים
DB_ENCRYPTION_KEY=          # מפתח הצפנה ל-DB (AES-256, נוצר אוטומטית בהפעלה ראשונה)

# AI (חשבון המנהל)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Google OAuth App (אפליקציה אחת, כל tenant מאשר בנפרד)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

# הגדרות
TIMEZONE=Asia/Jerusalem
MAX_TENANTS=10
```

### תהליך הרשמת לקוח
```
1. מנהל → דשבורד → "צור הזמנה" → לינק ייחודי
2. מנהל שולח לינק ללקוח (WhatsApp/SMS/מייל)
3. לקוח → פותח לינק → ממלא שם + טלפון
4. לקוח → Stripe Checkout → משלם
5. Webhook → tenant נוצר → מועבר ל-onboarding
6. לקוח → סורק QR → מחבר Calendar → בוחר שם
7. עוזר שולח: "מוכן! שלח הודעה שמתחילה ב-[שם]"
```

### סדר הרצה מומלץ
1. **US-001** – DB (אין תלויות)
2. **US-002** – Tenant Manager (תלוי ב-001)
3. **US-003** – WhatsApp Manager (תלוי ב-002)
4. **US-004** – Message Router (תלוי ב-002, 003)
5. **US-005** – דף הרשמה (תלוי ב-002)
6. **US-006** – Stripe (תלוי ב-002, 005)
7. **US-007** – Onboarding (תלוי ב-003, 006)
8. **US-008** – דשבורד ראשי (תלוי ב-002)
9. **US-009** – דף לקוח (תלוי ב-008)
10. **US-010** – לוג פעילות (תלוי ב-008)
11. **US-011** – AI per-tenant (תלוי ב-004)
12. **US-012** – Calendar per-tenant (תלוי ב-004)
13. **US-013** – Handlers per-tenant (תלוי ב-011, 012)
14. **US-014** – תמלול per-tenant (תלוי ב-004)
15. **US-015** – תזכורות per-tenant (תלוי ב-003, 012)
16. **US-016** – סיכום יומי per-tenant (תלוי ב-003, 012)
17. **US-017** – אבטחה (תלוי ב-כל השאר)
18. **US-018** – לוגים (ניתן בכל שלב)
