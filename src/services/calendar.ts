import { getCalendar, calendarId } from './googleAuth';
import { config } from '../config';

export interface CalendarEvent {
  id?: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  meetLink?: string;
}

export async function createEvent(event: {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  addMeet?: boolean;
  attendees?: string[];
}): Promise<CalendarEvent> {
  const calendar = getCalendar();

  const eventBody: any = {
    summary: event.summary,
    start: { dateTime: event.start, timeZone: config.timezone },
    end: { dateTime: event.end, timeZone: config.timezone },
    description: event.description || '',
    location: event.location || '',
  };

  if (event.addMeet) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  if (event.attendees && event.attendees.length > 0) {
    eventBody.attendees = event.attendees.map((email) => ({ email }));
  }

  const res = await calendar.events.insert({
    calendarId,
    requestBody: eventBody,
    conferenceDataVersion: event.addMeet ? 1 : 0,
    sendUpdates: event.attendees?.length ? 'all' : 'none',
  });

  const created = res.data;
  return {
    id: created.id || undefined,
    summary: created.summary || event.summary,
    start: created.start?.dateTime || event.start,
    end: created.end?.dateTime || event.end,
    description: created.description || '',
    meetLink: created.hangoutLink || undefined,
  };
}

export async function updateEvent(
  eventId: string,
  updates: Partial<{ summary: string; start: string; end: string; description: string; location: string; }>
): Promise<CalendarEvent> {
  const calendar = getCalendar();
  const body: any = {};
  if (updates.summary) body.summary = updates.summary;
  if (updates.start) body.start = { dateTime: updates.start, timeZone: config.timezone };
  if (updates.end) body.end = { dateTime: updates.end, timeZone: config.timezone };
  if (updates.description) body.description = updates.description;
  if (updates.location) body.location = updates.location;

  const res = await calendar.events.patch({ calendarId, eventId, requestBody: body });
  const updated = res.data;
  return {
    id: updated.id || eventId,
    summary: updated.summary || '',
    start: updated.start?.dateTime || '',
    end: updated.end?.dateTime || '',
    description: updated.description || '',
    meetLink: updated.hangoutLink || undefined,
  };
}

export async function deleteEvent(eventId: string): Promise<void> {
  const calendar = getCalendar();
  await calendar.events.delete({ calendarId, eventId });
}

export async function queryEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  const calendar = getCalendar();
  const res = await calendar.events.list({
    calendarId, timeMin, timeMax, singleEvents: true, orderBy: 'startTime', timeZone: config.timezone,
  });

  return (res.data.items || []).map((item) => ({
    id: item.id || undefined,
    summary: item.summary || '(ללא כותרת)',
    start: item.start?.dateTime || item.start?.date || '',
    end: item.end?.dateTime || item.end?.date || '',
    description: item.description || '',
    meetLink: item.hangoutLink || undefined,
  }));
}

export async function findEventByName(name: string, daysAhead: number = 7): Promise<CalendarEvent | null> {
  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const events = await queryEvents(now.toISOString(), future.toISOString());
  const lower = name.toLowerCase();
  return events.find((e) => e.summary.toLowerCase().includes(lower)) || null;
}

export async function findAllEventsByName(name: string, daysAhead: number = 7): Promise<CalendarEvent[]> {
  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const events = await queryEvents(now.toISOString(), future.toISOString());
  const lower = name.toLowerCase();
  return events.filter((e) => e.summary.toLowerCase().includes(lower));
}
