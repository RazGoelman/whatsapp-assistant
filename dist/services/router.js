"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIncomingMessage = handleIncomingMessage;
exports.handleVoiceMessage = handleVoiceMessage;
const aiParser_1 = require("./aiParser");
const calendar_1 = require("./calendar");
const whatsapp_1 = require("./whatsapp");
const transcription_1 = require("./transcription");
const config_1 = require("../config");
function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: config_1.config.timezone });
}
function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: config_1.config.timezone });
}
function buildDateTime(date, time) {
    return `${date}T${time}:00`;
}
async function handleIncomingMessage(from, message) {
    try {
        console.log(`💬 Processing message from ${from}: ${message}`);
        const intent = await (0, aiParser_1.parseIntent)(message);
        console.log(`🧠 Parsed intent:`, JSON.stringify(intent));
        const reply = await executeIntent(intent);
        await (0, whatsapp_1.sendWhatsAppMessage)(from, reply);
    }
    catch (error) {
        console.error('❌ Error handling message:', error.message);
        await (0, whatsapp_1.sendWhatsAppMessage)(from, `❌ שגיאה: ${error.message}`);
    }
}
async function handleVoiceMessage(from, mediaId) {
    try {
        const text = await (0, transcription_1.transcribeAudio)(mediaId);
        await (0, whatsapp_1.sendWhatsAppMessage)(from, `🎙️ תמלול: "${text}"`);
        await handleIncomingMessage(from, text);
    }
    catch (error) {
        console.error('❌ Error handling voice:', error.message);
        await (0, whatsapp_1.sendWhatsAppMessage)(from, '❌ לא הצלחתי לתמלל את ההודעה הקולית');
    }
}
async function executeIntent(intent) {
    switch (intent.action) {
        case 'create': return handleCreate(intent);
        case 'query': return handleQuery(intent);
        case 'delete': return handleDelete(intent);
        case 'update': return handleUpdate(intent);
        default: return '🤔 לא הבנתי את הבקשה. נסה שוב, למשל:\n• "קבע פגישה מחר ב-3 עם דני"\n• "מה יש לי היום?"\n• "תבטל את הפגישה עם דני"';
    }
}
async function handleCreate(intent) {
    if (!intent.summary || !intent.date || !intent.startTime) {
        return '❌ חסרים פרטים ליצירת אירוע. צריך לפחות: שם, תאריך ושעה.';
    }
    const endTime = intent.endTime || addHour(intent.startTime);
    const start = buildDateTime(intent.date, intent.startTime);
    const end = buildDateTime(intent.date, endTime);
    const event = await (0, calendar_1.createEvent)({
        summary: intent.summary, start, end,
        description: intent.description, location: intent.location,
        addMeet: intent.addMeet, attendees: intent.attendees,
    });
    let reply = `✅ נוצר אירוע: ${event.summary}\n📅 ${formatDate(event.start)} ${formatTime(event.start)}-${formatTime(event.end)}`;
    if (event.meetLink)
        reply += `\n📹 Google Meet: ${event.meetLink}`;
    return reply;
}
async function handleQuery(intent) {
    const date = intent.date || new Date().toISOString().split('T')[0];
    const timeMin = `${date}T00:00:00`;
    const timeMax = `${date}T23:59:59`;
    const events = await (0, calendar_1.queryEvents)(new Date(timeMin).toISOString(), new Date(timeMax).toISOString());
    if (events.length === 0)
        return `📅 אין אירועים ב-${formatDate(timeMin)}`;
    let reply = `📅 אירועים ב-${formatDate(timeMin)}:\n`;
    events.forEach((e, i) => {
        reply += `\n${i + 1}. ${e.summary} — ${formatTime(e.start)}-${formatTime(e.end)}`;
        if (e.meetLink)
            reply += ` 📹`;
    });
    return reply;
}
async function handleDelete(intent) {
    if (!intent.targetEvent)
        return '❌ לא הבנתי איזה אירוע למחוק. נסה: "תבטל את הפגישה עם דני"';
    const event = await (0, calendar_1.findEventByName)(intent.targetEvent);
    if (!event || !event.id)
        return `❌ לא מצאתי אירוע "${intent.targetEvent}" בשבוע הקרוב`;
    await (0, calendar_1.deleteEvent)(event.id);
    return `✅ נמחק: ${event.summary}`;
}
async function handleUpdate(intent) {
    if (!intent.targetEvent)
        return '❌ לא הבנתי איזה אירוע לעדכן. נסה: "תזיז את הישיבה ל-5"';
    const event = await (0, calendar_1.findEventByName)(intent.targetEvent);
    if (!event || !event.id)
        return `❌ לא מצאתי אירוע "${intent.targetEvent}" בשבוע הקרוב`;
    const updates = {};
    if (intent.newDate && !intent.newTime) {
        const time = event.start.split('T')[1]?.substring(0, 5) || '09:00';
        const endTime = event.end.split('T')[1]?.substring(0, 5) || addHour(time);
        updates.start = buildDateTime(intent.newDate, time);
        updates.end = buildDateTime(intent.newDate, endTime);
    }
    if (intent.summary)
        updates.summary = intent.summary;
    const updated = await (0, calendar_1.updateEvent)(event.id, updates);
    return `✅ עודכן: ${updated.summary} → ${formatDate(updated.start)} ${formatTime(updated.start)}-${formatTime(updated.end)}`;
}
function addHour(time) {
    const [h, m] = time.split(':').map(Number);
    return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
