const { handleCreateEvent } = require('./createEvent');
const { handleCreateMeeting } = require('./createMeeting');
const { handleUpdateEvent } = require('./updateEvent');
const { handleDeleteEvent, confirmDeletion, cancelDeletion, hasPendingDeletion } = require('./deleteEvent');
const { handleComposeMessage } = require('./composeMessage');

/**
 * מנתב את הכוונה ל-handler המתאים.
 * כל handler מחזיר הודעת אישור רק אחרי שהלופ המלא הושלם.
 *
 * @param {string} intent - סוג הכוונה
 * @param {object} params - פרמטרים מה-AI
 * @param {string} aiResponse - תשובת ה-AI למשתמש
 * @param {object} message - אובייקט ההודעה המקורית מ-WhatsApp
 * @returns {Promise<string>} - ההודעה לשליחה למשתמש
 */
async function routeIntent(intent, params, aiResponse, message) {
  const userId = message.from;

  // טיפול באישור/ביטול מחיקה ממתינה
  if (hasPendingDeletion(userId)) {
    const body = (message.body || '').trim().toLowerCase();
    if (['כן', 'כ', 'yes', 'y', '1'].includes(body)) {
      return await confirmDeletion(userId);
    } else {
      cancelDeletion(userId);
      return '👌 המחיקה בוטלה.';
    }
  }

  switch (intent) {
    case 'create_event':
      return await handleCreateEvent(params, aiResponse);

    case 'create_meeting':
      return await handleCreateMeeting(params, aiResponse);

    case 'update_event':
      return await handleUpdateEvent(params, aiResponse);

    case 'delete_event':
      return await handleDeleteEvent(params, aiResponse, userId);

    case 'set_reminder':
      // תזכורות נוצרות כאירוע ביומן עם תזכורת
      return await handleCreateEvent(
        { ...params, title: `⏰ ${params.title || 'תזכורת'}` },
        aiResponse
      );

    case 'compose_message':
      return await handleComposeMessage(params, aiResponse);

    case 'daily_summary':
      return aiResponse || 'הסיכום היומי נשלח כל יום ב-20:00 אוטומטית.';

    case 'general':
    default:
      return aiResponse || 'לא הבנתי. אפשר לנסח אחרת?';
  }
}

module.exports = { routeIntent };
