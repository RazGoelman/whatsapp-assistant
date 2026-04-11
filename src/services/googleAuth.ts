import { google, calendar_v3 } from 'googleapis';
import { config } from '../config';

let calendarClient: calendar_v3.Calendar | null = null;

function getAuth() {
  const credentials = JSON.parse(
    Buffer.from(config.google.credentials, 'base64').toString('utf-8')
  );

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  });
}

export function getCalendar(): calendar_v3.Calendar {
  if (!calendarClient) {
    const auth = getAuth();
    calendarClient = google.calendar({ version: 'v3', auth });
  }
  return calendarClient;
}

export const calendarId = config.google.calendarId;
