# 🤖 עוזר אישי ב-WhatsApp

סוכן AI שרץ בענן ומנהל את היומן שלך דרך WhatsApp. **כל ההתקנה מהפלאפון — אין צורך במחשב.**

## מה הוא עושה?

- 📅 **ניהול יומן** – יוצר, מעדכן ומוחק אירועים (מופיע ביומן הטלפון)
- 📹 **פגישות וידאו** – Google Meet + הזמנות מייל
- ⏰ **תזכורות** – WhatsApp + התראה ביומן שעה לפני
- 📋 **סיכום יומי** – כל יום ב-20:00
- 🎤 **הודעות קוליות** – מתמלל ומבצע
- ✉️ **ניסוח הודעות** – מנסח טקסטים חכמים

## התקנה מהפלאפון (5 דקות)

### שלב 1: Deploy
נכנס מדפדפן הנייד ל-[Railway](https://railway.app) או [Render](https://render.com), מחבר GitHub, לוחץ Deploy.

### שלב 2: דף Setup
פותח בדפדפן הנייד:
```
https://<your-server>/setup?password=<הסיסמה מהלוגים>
```
ממלא: מספר טלפון, API keys, מחבר Google Calendar.

### שלב 3: חיבור WhatsApp
בדף `/setup/whatsapp` – סורק QR code (מטלפון שני או מחשב).

### שלב 4: בחירת שם
הסוכן שולח הודעת WhatsApp: *"איך תרצה לקרוא לי?"*
עונים – ומתחילים לעבוד!

## שימוש

| הודעה | מה קורה |
|-------|---------|
| `[שם], תקבע לי פגישה מחר ב-10 עם יוסי` | אירוע ביומן |
| `[שם], תזיז את הפגישה עם יוסי ל-14:00` | עדכון |
| `[שם], תבטל את הפגישה עם יוסי` | מחיקה (אחרי אישור) |
| `[שם], תקבע פגישת וידאו עם יוסי` | Google Meet + מייל |
| `[שם], תזכיר לי לקנות חלב מחר ב-9` | תזכורת |
| `[שם], תנסח הודעה ליוסי שאני מאחר` | ניסוח הודעה |

אפשר גם הקלטות קוליות!

## מבנה הפרויקט

```
src/
├── index.js                  # נקודת כניסה + Express
├── config/
│   └── index.js              # משתני סביבה
├── web/
│   └── setupServer.js        # דף Setup מותאם לנייד
├── services/
│   ├── whatsapp.js           # WhatsApp + QR + Onboarding
│   ├── ai.js                 # Claude API
│   ├── calendar.js           # Google Calendar
│   ├── transcription.js      # תמלול (Whisper)
│   ├── reminderScheduler.js  # תזכורות
│   ├── dailySummary.js       # סיכום יומי
│   └── logger.js             # לוגים
└── handlers/
    ├── nameFilter.js         # זיהוי שם הסוכן
    ├── intentRouter.js       # ניתוב כוונות
    ├── createEvent.js        # יצירת אירוע
    ├── createMeeting.js      # פגישת וידאו
    ├── updateEvent.js        # עדכון אירוע
    ├── deleteEvent.js        # מחיקת אירוע
    └── composeMessage.js     # ניסוח הודעות
```

## דרישות
- Node.js 18+
- חשבון Google (Calendar)
- Anthropic API key (Claude)
- OpenAI API key (Whisper)
