const { searchEvents, deleteEvent } = require('../services/calendar');

// מאגר זמני לאירועים שממתינים לאישור מחיקה
const pendingDeletions = new Map();

/**
 * מטפל במחיקת אירוע מהיומן.
 * שלב 1: מבקש אישור מהמשתמש.
 * שלב 2 (אחרי אישור): מוחק ושולח אישור רק אם ההמחיקה הצליחה.
 *
 * @param {object} params - פרמטרים מה-AI
 * @param {string} aiResponse - תשובת ה-AI
 * @param {string} userId - מזהה המשתמש (מספר טלפון)
 * @returns {Promise<string>}
 */
async function handleDeleteEvent(params, aiResponse, userId) {
  const { search_query } = params;

  if (!search_query) {
    return aiResponse || 'לא הצלחתי לזהות איזה אירוע למחוק. נסה להיות יותר ספציפי.';
  }

  try {
    const events = await searchEvents(search_query);

    if (events.length === 0) {
      return `❌ לא נמצא אירוע שמתאים ל-"${search_query}".`;
    }

    let targetEvent;

    if (events.length === 1) {
      targetEvent = events[0];
    } else {
      let options = '🔍 נמצאו כמה אירועים תואמים:\n';
      events.forEach((e, i) => {
        const start = new Date(e.start.dateTime).toLocaleString('he-IL', {
          timeZone: 'Asia/Jerusalem',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        options += `${i + 1}. ${e.summary} – ${start}\n`;
      });
      options += '\nשלח את המספר של האירוע שאתה רוצה למחוק.';
      return options;
    }

    // שמירה לאישור
    const start = new Date(targetEvent.start.dateTime);
    const dateFormatted = start.toLocaleDateString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
    });
    const timeFormatted = start.toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
    });

    // שומר את האירוע לאישור
    pendingDeletions.set(userId, {
      eventId: targetEvent.id,
      summary: targetEvent.summary,
      date: dateFormatted,
      time: timeFormatted,
      timestamp: Date.now(),
    });

    return `🗑️ למחוק את "${targetEvent.summary}" ב-${dateFormatted} ${timeFormatted}? (כן/לא)`;
  } catch (err) {
    return `❌ שגיאה בחיפוש האירוע: ${err.message}`;
  }
}

/**
 * מאשר מחיקה ממתינה
 * @param {string} userId
 * @returns {Promise<string|null>} - הודעת אישור, או null אם אין מחיקה ממתינה
 */
async function confirmDeletion(userId) {
  const pending = pendingDeletions.get(userId);
  if (!pending) return null;

  // תוקף – 5 דקות
  if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
    pendingDeletions.delete(userId);
    return 'הבקשה פגה. שלח מחדש את בקשת המחיקה.';
  }

  try {
    await deleteEvent(pending.eventId);
    pendingDeletions.delete(userId);
    return `✅ בוטל: ${pending.summary} | ${pending.date} | ${pending.time}`;
  } catch (err) {
    pendingDeletions.delete(userId);
    return `❌ שגיאה במחיקת האירוע: ${err.message}`;
  }
}

/**
 * מבטל מחיקה ממתינה
 */
function cancelDeletion(userId) {
  pendingDeletions.delete(userId);
}

/**
 * בודק אם יש מחיקה ממתינה למשתמש
 */
function hasPendingDeletion(userId) {
  return pendingDeletions.has(userId);
}

module.exports = {
  handleDeleteEvent,
  confirmDeletion,
  cancelDeletion,
  hasPendingDeletion,
};
