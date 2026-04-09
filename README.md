# 🤖 WhatsApp Personal Assistant

An AI-powered personal assistant that runs in the cloud and manages your calendar, reminders, and messages — all through WhatsApp. **Entire setup from your phone — no computer needed.**

## Features

- 📅 **Calendar Management** – Create, update, and delete events (syncs to your phone's calendar)
- 📹 **Video Meetings** – Google Meet with email invitations
- ⏰ **Reminders** – WhatsApp + calendar popup 1 hour before events
- 📋 **Daily Summary** – Every day at 8:00 PM
- 🎤 **Voice Messages** – Transcribes and processes voice notes
- ✉️ **Smart Compose** – Drafts messages on request

## Setup (from your phone, ~5 minutes)

### Step 1: Deploy
Open [Railway](https://railway.app) or [Render](https://render.com) in your mobile browser, connect GitHub, and deploy this repo.

### Step 2: Configure
Open in your mobile browser:
```
https://<your-server>/setup?password=<password from deploy logs>
```
Fill in: phone number, API keys, connect Google Calendar.

### Step 3: Connect WhatsApp
On the `/setup/whatsapp` page — scan the QR code (from a second phone or computer).

### Step 4: Name Your Assistant
The agent sends a WhatsApp message: *"Hi! What would you like to call me?"*
Reply with a name — and you're ready!

## Usage

| Message | What happens |
|---------|-------------|
| `[name], schedule a meeting tomorrow at 10 with Yossi` | Creates calendar event |
| `[name], move the meeting with Yossi to 2pm` | Updates event |
| `[name], cancel the meeting with Yossi` | Deletes (after confirmation) |
| `[name], set up a video call with Yossi tomorrow at 10` | Google Meet + email invite |
| `[name], remind me to buy milk tomorrow at 9` | Calendar reminder |
| `[name], draft a message to Yossi that I'm running 10 min late` | Composes message |

Voice messages work too! 🎤

## Tech Stack

- **Runtime:** Node.js + Express
- **WhatsApp:** whatsapp-web.js
- **AI:** Claude API (Anthropic)
- **Calendar:** Google Calendar API
- **Transcription:** OpenAI Whisper API
- **Scheduling:** node-cron

## Requirements

- Node.js 18+
- Google account (Calendar)
- Anthropic API key (Claude)
- OpenAI API key (Whisper)

---

# 🤖 עוזר אישי ב-WhatsApp

סוכן AI שרץ בענן ומנהל את היומן שלך דרך WhatsApp. **כל ההתקנה מהפלאפון — אין צורך במחשב.**

## יכולות

- 📅 **ניהול יומן** – יוצר, מעדכן ומוחק אירועים (מופיע ביומן הטלפון)
- 📹 **פגישות וידאו** – Google Meet + הזמנות מייל
- ⏰ **תזכורות** – WhatsApp + התראה ביומן שעה לפני
- 📋 **סיכום יומי** – כל יום ב-20:00
- 🎤 **הודעות קוליות** – מתמלל ומבצע
- ✉️ **ניסוח הודעות** – מנסח טקסטים חכמים

## התקנה מהפלאפון (5 דקות)

### שלב 1: Deploy
פתח את [Railway](https://railway.app) או [Render](https://render.com) בדפדפן הנייד, חבר GitHub, לחץ Deploy.

### שלב 2: הגדרות
פתח בדפדפן הנייד:
```
https://<your-server>/setup?password=<הסיסמה מהלוגים>
```
מלא: מספר טלפון, API keys, חבר Google Calendar.

### שלב 3: חיבור WhatsApp
בדף `/setup/whatsapp` – סרוק QR code (מטלפון שני או מחשב).

### שלב 4: בחירת שם
הסוכן שולח הודעת WhatsApp: *"היי! איך תרצה לקרוא לי?"*
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

אפשר גם הקלטות קוליות! 🎤

## דרישות

- Node.js 18+
- חשבון Google (Calendar)
- Anthropic API key (Claude)
- OpenAI API key (Whisper)

---

## License

MIT License

Copyright (c) 2026 RazGoelman

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
