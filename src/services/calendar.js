const { google } = require('googleapis');
const { config } = require('../config');

let calendar = null;

/**
 * מאתחל את חיבור Google Calendar API
 */
function initCalendar() {
  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret
  );

  oauth2Client.setCredentials({
    refresh_token: config.google.refreshToken,
  });

  calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  console.log('✅ Google Calendar מחובר.');
}

/**
 * יוצר אירוע חדש ביומן
 * @param {object} eventData
 * @param {string} eventData.title - כותרת
 * @param {string} eventData.date - תאריך YYYY-MM-DD
 * @param {string} eventData.time - שעה HH:MM
 * @param {number} [eventData.durationMinutes=60] - משך בדקות
 * @param {string[]} [eventData.attendeeEmails=[]] - כתובות מייל של משתתפים
 * @param {boolean} [eventData.withMeet=false] - האם להוסיף Google Meet
 * @returns {Promise<object>} - האירוע שנוצר
 */
async function createEvent({
  title,
  date,
  time,
  durationMinutes = 60,
  attendeeEmails = [],
  withMeet = false,
}) {
  const startDateTime = new Date(`${date}T${time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);

  const event = {
    summary: title,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: config.timezone,
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: config.timezone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 }, // התראה במכשיר שעה לפני
      ],
    },
  };

  // הוספת משתתפים
  if (attendeeEmails.length > 0) {
    event.attendees = attendeeEmails.map((email) => ({ email }));
  }

  // הוספת Google Meet
  if (withMeet) {
    event.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: withMeet ? 1 : 0,
    sendUpdates: attendeeEmails.length > 0 ? 'all' : 'none',
  });

  return response.data;
}

/**
 * מעדכן אירוע קיים
 * @param {string} eventId - מזהה האירוע
 * @param {object} updates - שדות לעדכון
 * @returns {Promise<object>}
 */
async function updateEvent(eventId, updates) {
  const existing = await calendar.events.get({
    calendarId: 'primary',
    eventId,
  });

  const event = existing.data;

  if (updates.title) {
    event.summary = updates.title;
  }

  if (updates.date || updates.time) {
    const currentStart = new Date(event.start.dateTime);
    const newDate = updates.date || currentStart.toISOString().split('T')[0];
    const newTime =
      updates.time || currentStart.toTimeString().split(' ')[0].substring(0, 5);
    const newStart = new Date(`${newDate}T${newTime}:00`);

    // שומר על אותו משך
    const currentEnd = new Date(event.end.dateTime);
    const duration = currentEnd.getTime() - currentStart.getTime();
    const newEnd = new Date(newStart.getTime() + duration);

    event.start = { dateTime: newStart.toISOString(), timeZone: config.timezone };
    event.end = { dateTime: newEnd.toISOString(), timeZone: config.timezone };
  }

  const response = await calendar.events.update({
    calendarId: 'primary',
    eventId,
    resource: event,
  });

  return response.data;
}

/**
 * מוחק אירוע מהיומן
 * @param {string} eventId
 * @returns {Promise<void>}
 */
async function deleteEvent(eventId) {
  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
}

/**
 * מחזיר את כל האירועים ביום מסוים
 * @param {string} date - תאריך YYYY-MM-DD
 * @returns {Promise<object[]>}
 */
async function getEventsForDay(date) {
  const timeMin = new Date(`${date}T00:00:00`);
  const timeMax = new Date(`${date}T23:59:59`);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    timeZone: config.timezone,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

/**
 * מחפש אירועים לפי מילות מפתח (ב-7 ימים הקרובים)
 * @param {string} query - מילות חיפוש
 * @returns {Promise<object[]>}
 */
async function searchEvents(query) {
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId: 'primary',
    q: query,
    timeMin: now.toISOString(),
    timeMax: weekLater.toISOString(),
    timeZone: config.timezone,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

module.exports = {
  initCalendar,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventsForDay,
  searchEvents,
};
