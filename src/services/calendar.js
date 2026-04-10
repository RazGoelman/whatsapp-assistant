const { google } = require('googleapis');

const tz = process.env.TIMEZONE || 'Asia/Jerusalem';

function getCalendar(tenant) {
  if (!tenant || !tenant.google_refresh_token) {
    throw new Error('לקוח לא מחובר ל-Google Calendar');
  }
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: tenant.google_refresh_token });
  return google.calendar({ version: 'v3', auth });
}

function initCalendar() { /* v3: per-tenant, no global init */ }

async function createEvent({ title, date, time, durationMinutes = 60, attendeeEmails = [], withMeet = false }, tenant) {
  const cal = getCalendar(tenant);
  const start = new Date(date + 'T' + time + ':00');
  const end = new Date(start.getTime() + durationMinutes * 60000);

  const event = {
    summary: title,
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
  };

  if (attendeeEmails.length > 0) {
    event.attendees = attendeeEmails.map(e => ({ email: e }));
  }
  if (withMeet) {
    event.conferenceData = {
      createRequest: { requestId: 'meet-' + Date.now(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
    };
  }

  const resp = await cal.events.insert({
    calendarId: 'primary', resource: event,
    conferenceDataVersion: withMeet ? 1 : 0,
    sendUpdates: attendeeEmails.length > 0 ? 'all' : 'none',
  });
  return resp.data;
}

async function updateEvent(eventId, updates, tenant) {
  const cal = getCalendar(tenant);
  const existing = await cal.events.get({ calendarId: 'primary', eventId });
  const event = existing.data;

  if (updates.title) event.summary = updates.title;
  if (updates.date || updates.time) {
    const curStart = new Date(event.start.dateTime);
    const newDate = updates.date || curStart.toISOString().split('T')[0];
    const newTime = updates.time || curStart.toTimeString().substring(0, 5);
    const newStart = new Date(newDate + 'T' + newTime + ':00');
    const duration = new Date(event.end.dateTime).getTime() - curStart.getTime();
    event.start = { dateTime: newStart.toISOString(), timeZone: tz };
    event.end = { dateTime: new Date(newStart.getTime() + duration).toISOString(), timeZone: tz };
  }

  const resp = await cal.events.update({ calendarId: 'primary', eventId, resource: event });
  return resp.data;
}

async function deleteEvent(eventId, tenant) {
  const cal = getCalendar(tenant);
  await cal.events.delete({ calendarId: 'primary', eventId });
}

async function getEventsForDay(date, tenant) {
  const cal = getCalendar(tenant);
  const min = new Date(date + 'T00:00:00');
  const max = new Date(date + 'T23:59:59');
  const resp = await cal.events.list({
    calendarId: 'primary',
    timeMin: min.toISOString(), timeMax: max.toISOString(),
    timeZone: tz, singleEvents: true, orderBy: 'startTime',
  });
  return resp.data.items || [];
}

async function searchEvents(query, tenant) {
  const cal = getCalendar(tenant);
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 86400000);
  const resp = await cal.events.list({
    calendarId: 'primary', q: query,
    timeMin: now.toISOString(), timeMax: week.toISOString(),
    timeZone: tz, singleEvents: true, orderBy: 'startTime',
  });
  return resp.data.items || [];
}

module.exports = { initCalendar, createEvent, updateEvent, deleteEvent, getEventsForDay, searchEvents };
