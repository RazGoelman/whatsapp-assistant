"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEvent = createEvent;
exports.updateEvent = updateEvent;
exports.deleteEvent = deleteEvent;
exports.queryEvents = queryEvents;
exports.findEventByName = findEventByName;
exports.findAllEventsByName = findAllEventsByName;
const googleAuth_1 = require("./googleAuth");
const config_1 = require("../config");
async function createEvent(event) {
    const calendar = (0, googleAuth_1.getCalendar)();
    const eventBody = {
        summary: event.summary,
        start: { dateTime: event.start, timeZone: config_1.config.timezone },
        end: { dateTime: event.end, timeZone: config_1.config.timezone },
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
        calendarId: googleAuth_1.calendarId,
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
async function updateEvent(eventId, updates) {
    const calendar = (0, googleAuth_1.getCalendar)();
    const body = {};
    if (updates.summary)
        body.summary = updates.summary;
    if (updates.start)
        body.start = { dateTime: updates.start, timeZone: config_1.config.timezone };
    if (updates.end)
        body.end = { dateTime: updates.end, timeZone: config_1.config.timezone };
    if (updates.description)
        body.description = updates.description;
    if (updates.location)
        body.location = updates.location;
    const res = await calendar.events.patch({ calendarId: googleAuth_1.calendarId, eventId, requestBody: body });
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
async function deleteEvent(eventId) {
    const calendar = (0, googleAuth_1.getCalendar)();
    await calendar.events.delete({ calendarId: googleAuth_1.calendarId, eventId });
}
async function queryEvents(timeMin, timeMax) {
    const calendar = (0, googleAuth_1.getCalendar)();
    const res = await calendar.events.list({
        calendarId: googleAuth_1.calendarId, timeMin, timeMax, singleEvents: true, orderBy: 'startTime', timeZone: config_1.config.timezone,
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
async function findEventByName(name, daysAhead = 7) {
    const now = new Date();
    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const events = await queryEvents(now.toISOString(), future.toISOString());
    const lower = name.toLowerCase();
    return events.find((e) => e.summary.toLowerCase().includes(lower)) || null;
}
async function findAllEventsByName(name, daysAhead = 7) {
    const now = new Date();
    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const events = await queryEvents(now.toISOString(), future.toISOString());
    const lower = name.toLowerCase();
    return events.filter((e) => e.summary.toLowerCase().includes(lower));
}
