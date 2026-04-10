const { searchEvents, updateEvent } = require('../services/calendar');

/**
 * מטפל בעדכון אירוע קיים ביומן.
 * אישור נשלח רק אחרי שהעדכון הושלם בהצלחה.
 *
 * @param {object} params - פרמטרים מה-AI
 * @param {string} aiResponse - תשובת ה-AI (fallback)
 * @param {Function} askUser - פונקציה לשאילת המשתמש (לבירור בין כמה אירועים)
 * @returns {Promise<string>}
 */
async function handleUpdateEvent(params, aiResponse, askUser) {
  const { search_query, updates } = params;

  if (!search_query) {
    return aiResponse || 'לא הצלחתי לזהות איזה אירוע לעדכן. נסה להיות יותר ספציפי.';
  }

  if (!updates || Object.keys(updates).length === 0) {
    return aiResponse || 'לא ציינת מה לעדכן. למשל: "תזיז ל-14:00" או "תשנה את הכותרת ל..."';
  }

  try {
    // חיפוש האירוע
    const events = await searchEvents(search_query);

    if (events.length === 0) {
      return `❌ לא נמצא אירוע שמתאים ל-"${search_query}". בדוק את השם ונסה שוב.`;
    }

    let targetEvent;

    if (events.length === 1) {
      targetEvent = events[0];
    } else {
      // כמה אירועים תואמים – מחזיר שאלה למשתמש
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
      options += '\nשלח את המספר של האירוע שאתה רוצה לעדכן.';
      return options;
    }

    // ביצוע העדכון
    const oldStart = new Date(targetEvent.start.dateTime);
    const oldTime = oldStart.toTimeString().substring(0, 5);

    const updatedEvent = await updateEvent(targetEvent.id, updates);

    // אימות
    if (!updatedEvent || !updatedEvent.id) {
      return '❌ העדכון לא הצליח מסיבה לא ידועה. נסה שוב.';
    }

    // הרכבת אישור
    const newStart = new Date(updatedEvent.start.dateTime);
    const newTime = newStart.toTimeString().substring(0, 5);

    let confirmation = `✅ עודכן: ${updatedEvent.summary}`;
    if (updates.time) {
      confirmation += ` | ${oldTime} → ${newTime}`;
    }
    if (updates.date) {
      confirmation += ` | תאריך חדש: ${updates.date}`;
    }
    if (updates.title) {
      confirmation += ` | שם חדש: ${updates.title}`;
    }

    return confirmation;
  } catch (err) {
    return `❌ שגיאה בעדכון האירוע. נסה שוב.`;
  }
}

module.exports = { handleUpdateEvent };
