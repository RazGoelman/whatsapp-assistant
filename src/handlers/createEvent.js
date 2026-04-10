const { createEvent } = require('../services/calendar');
const { config } = require('../config');

/**
 * מטפל ביצירת אירוע חדש ביומן.
 * שולח אישור רק אחרי שכל הלופ הושלם בהצלחה.
 *
 * @param {object} params - פרמטרים מה-AI
 * @param {string} aiResponse - תשובת ה-AI (fallback)
 * @returns {Promise<string>} - הודעת אישור או שגיאה
 */
async function handleCreateEvent(params, aiResponse) {
  const { title, date, time, duration_minutes, attendees } = params;

  // בדיקה שיש את כל הפרמטרים הנדרשים
  if (!title || !date || !time) {
    return aiResponse || 'חסרים פרטים ליצירת האירוע. ציין כותרת, תאריך ושעה.';
  }

  try {
    // יצירת האירוע ביומן
    const event = await createEvent({
      title,
      date,
      time,
      durationMinutes: duration_minutes || 60,
    });

    // אימות שהאירוע נוצר בהצלחה
    if (!event || !event.id) {
      return '❌ האירוע לא נוצר מסיבה לא ידועה. נסה שוב.';
    }

    // הרכבת הודעת אישור עם כל הפרטים
    const dateFormatted = formatDate(date);
    const duration = duration_minutes || 60;

    let confirmation = `✅ נקבע: ${title}`;
    confirmation += ` | ${dateFormatted}`;
    confirmation += ` | ${time}`;
    confirmation += ` | ${duration} דקות`;
    confirmation += ` | תזכורת שעה לפני`;

    if (attendees && attendees.length > 0) {
      confirmation += ` | משתתפים: ${attendees.join(', ')}`;
    }

    return confirmation;
  } catch (err) {
    return `❌ שגיאה ביצירת האירוע. נסה שוב.`;
  }
}

/**
 * מפרמט תאריך לפורמט קריא
 */
function formatDate(dateStr) {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const date = new Date(dateStr + 'T00:00:00');
  const dayName = days[date.getDay()];
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  return `יום ${dayName} (${dd}.${mm})`;
}

module.exports = { handleCreateEvent };
