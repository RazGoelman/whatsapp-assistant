const cron = require('node-cron');
const { getEventsForDay } = require('./calendar');
const { sendToUser } = require('./whatsapp');
const { config } = require('../config');

/**
 * מפעיל את הסיכום היומי – כל יום ב-20:00
 */
function startDailySummary() {
  const hour = config.dailySummaryHour;
  const minute = config.dailySummaryMinute;

  cron.schedule(`${minute} ${hour} * * *`, async () => {
    try {
      await sendDailySummary();
    } catch (err) {
      console.error('❌ שגיאה בשליחת סיכום יומי:', err.message);
    }
  }, {
    timezone: config.timezone,
  });

  console.log(`✅ סיכום יומי מתוזמן לכל יום ב-${hour}:${minute.toString().padStart(2, '0')}.`);
}

/**
 * בונה ושולח את הסיכום היומי
 */
async function sendDailySummary() {
  const now = new Date();
  const today = formatDateISO(now);
  const tomorrow = formatDateISO(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  const todayEvents = await getEventsForDay(today);
  const tomorrowEvents = await getEventsForDay(tomorrow);

  let message = '📋 *סיכום יומי*\n';
  message += '━━━━━━━━━━━━━━━\n\n';

  // אירועי היום
  message += '📌 *היום:*\n';
  if (todayEvents.length === 0) {
    message += '   אין אירועים.\n';
  } else {
    for (const event of todayEvents) {
      const status = isEventPassed(event) ? '✔️' : '🔵';
      const time = formatEventTime(event);
      message += `   ${status} ${time} – ${event.summary}\n`;
    }
  }

  message += '\n';

  // אירועי מחר
  message += '📅 *מחר:*\n';
  if (tomorrowEvents.length === 0) {
    message += '   אין אירועים מתוכננים.\n';
  } else {
    for (const event of tomorrowEvents) {
      const time = formatEventTime(event);
      message += `   🔹 ${time} – ${event.summary}\n`;
    }
  }

  message += '\n━━━━━━━━━━━━━━━';

  // סיכום כמותי
  const passedToday = todayEvents.filter(isEventPassed).length;
  const totalToday = todayEvents.length;
  const totalTomorrow = tomorrowEvents.length;

  message += `\n📊 היום: ${passedToday}/${totalToday} הושלמו | מחר: ${totalTomorrow} מתוכננים`;

  await sendToUser(config.userPhoneNumber, message);
  console.log('📤 סיכום יומי נשלח.');
}

/**
 * בודק אם אירוע כבר עבר
 */
function isEventPassed(event) {
  if (!event.end?.dateTime) return false;
  return new Date(event.end.dateTime) < new Date();
}

/**
 * מפרמט שעת אירוע
 */
function formatEventTime(event) {
  if (!event.start?.dateTime) return 'כל היום';
  
  const start = new Date(event.start.dateTime);
  return start.toLocaleTimeString('he-IL', {
    timeZone: config.timezone,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * מפרמט תאריך ל-YYYY-MM-DD
 */
function formatDateISO(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = { startDailySummary };
