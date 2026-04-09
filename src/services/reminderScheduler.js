const cron = require('node-cron');
const { getEventsForDay } = require('./calendar');
const { sendToUser } = require('./whatsapp');
const { config } = require('../config');

// מאגר אירועים שכבר נשלחה עליהם תזכורת (למניעת כפילויות)
const sentReminders = new Set();

/**
 * מפעיל את מערכת התזכורות – בודק כל 15 דקות
 */
function startReminderScheduler() {
  // כל 15 דקות
  cron.schedule('*/15 * * * *', async () => {
    try {
      await checkUpcomingEvents();
    } catch (err) {
      console.error('❌ שגיאה בבדיקת תזכורות:', err.message);
    }
  });

  console.log('✅ מערכת תזכורות פעילה (בודק כל 15 דקות).');
}

/**
 * בודק אם יש אירועים בעוד 45-75 דקות ושולח תזכורת
 */
async function checkUpcomingEvents() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // בודק אירועים של היום ומחר (למקרה שאנחנו קרובים לחצות)
  const events = [
    ...(await getEventsForDay(today)),
    ...(await getEventsForDay(tomorrow)),
  ];

  for (const event of events) {
    if (!event.start?.dateTime) continue; // מדלג על אירועים של יום שלם

    const eventStart = new Date(event.start.dateTime);
    const minutesUntil = (eventStart.getTime() - now.getTime()) / (1000 * 60);

    // שולח תזכורת אם האירוע בעוד 45-75 דקות
    if (minutesUntil >= 45 && minutesUntil <= 75) {
      const reminderId = `${event.id}_${today}`;

      // בדיקה שלא כבר נשלחה תזכורת
      if (sentReminders.has(reminderId)) continue;

      const timeFormatted = eventStart.toLocaleTimeString('he-IL', {
        timeZone: config.timezone,
        hour: '2-digit',
        minute: '2-digit',
      });

      const message = `⏰ תזכורת: ${event.summary} בעוד שעה (${timeFormatted})`;

      try {
        await sendToUser(config.userPhoneNumber, message);
        sentReminders.add(reminderId);
        console.log(`📤 תזכורת נשלחה: ${event.summary} @ ${timeFormatted}`);
      } catch (err) {
        console.error(`❌ שגיאה בשליחת תזכורת ל-${event.summary}:`, err.message);
      }
    }
  }

  // ניקוי תזכורות ישנות (מעל 24 שעות)
  cleanOldReminders();
}

/**
 * מנקה תזכורות ישנות מהמאגר
 */
function cleanOldReminders() {
  // ניקוי פעם ביום – שומר את ה-Set בגודל סביר
  if (sentReminders.size > 100) {
    sentReminders.clear();
  }
}

module.exports = { startReminderScheduler };
