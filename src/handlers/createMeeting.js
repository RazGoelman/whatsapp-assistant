const { createEvent } = require('../services/calendar');

/**
 * מטפל ביצירת פגישת וידאו עם Google Meet.
 * מבקש מייל של המשתתף אם לא צוין.
 * אישור נשלח רק אחרי שהלופ המלא הושלם.
 *
 * @param {object} params - פרמטרים מה-AI
 * @param {string} aiResponse - תשובת ה-AI
 * @returns {Promise<string>}
 */
async function handleCreateMeeting(params, aiResponse) {
  const { title, date, time, duration_minutes, email, attendees } = params;

  // בדיקת פרמטרים בסיסיים
  if (!title || !date || !time) {
    return aiResponse || 'חסרים פרטים לפגישה. ציין כותרת, תאריך ושעה.';
  }

  // בדיקה שיש מייל
  if (!email) {
    return aiResponse || `לצורך שליחת הזמנה ל-Google Meet, מה כתובת המייל של המשתתף?`;
  }

  // וולידציה בסיסית של מייל
  if (!email.includes('@') || !email.includes('.')) {
    return `❌ כתובת המייל "${email}" לא נראית תקינה. שלח כתובת מייל תקינה.`;
  }

  try {
    // יצירת אירוע עם Google Meet
    const event = await createEvent({
      title,
      date,
      time,
      durationMinutes: duration_minutes || 60,
      attendeeEmails: [email],
      withMeet: true,
    });

    // אימות
    if (!event || !event.id) {
      return '❌ הפגישה לא נוצרה מסיבה לא ידועה. נסה שוב.';
    }

    // שליפת קישור Meet
    const meetLink =
      event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
      event.hangoutLink ||
      'לא זמין';

    // הרכבת אישור
    const dateObj = new Date(`${date}T00:00:00`);
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = days[dateObj.getDay()];
    const dd = dateObj.getDate().toString().padStart(2, '0');
    const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');

    let confirmation = `✅ נקבעה פגישת וידאו: ${title}`;
    confirmation += `\n📅 יום ${dayName} (${dd}.${mm}) | ${time}`;
    confirmation += `\n📧 הזמנה נשלחה ל-${email}`;
    confirmation += `\n🔗 ${meetLink}`;

    return confirmation;
  } catch (err) {
    return `❌ שגיאה ביצירת הפגישה. נסה שוב.`;
  }
}

module.exports = { handleCreateMeeting };
