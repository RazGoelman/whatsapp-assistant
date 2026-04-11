"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIncomingMessage = handleIncomingMessage;
exports.handleVoiceMessage = handleVoiceMessage;
const aiParser_1 = require("./aiParser");
const calendar_1 = require("./calendar");
const whatsapp_1 = require("./whatsapp");
const transcription_1 = require("./transcription");
const locale_1 = require("./locale");
const config_1 = require("../config");
const seenUsers = new Set();
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
        if (!seenUsers.has(from)) {
            seenUsers.add(from);
            await (0, whatsapp_1.sendWhatsAppMessage)(from, (0, locale_1.getWelcomeMessage)(from));
        }
        if ((0, locale_1.isHelpTrigger)(message)) {
            await (0, whatsapp_1.sendWhatsAppMessage)(from, (0, locale_1.getHelpMenu)(from));
            return;
        }
        console.log("Processing message from " + from + ": " + message);
        const intent = await (0, aiParser_1.parseIntent)(message);
        console.log("Parsed intent: " + JSON.stringify(intent));
        const reply = await executeIntent(intent);
        await (0, whatsapp_1.sendWhatsAppMessage)(from, reply);
    }
    catch (error) {
        console.error("Error handling message:", error.message);
        await (0, whatsapp_1.sendWhatsAppMessage)(from, "שגיאה: " + error.message);
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
        recurrence: intent.recurrence,
    });
    const isRecurring = intent.recurrence?.freq;
    const recurText = isRecurring ? " חוזר" : "";
    let reply = "נוצר אירוע" + recurText + ": " + event.summary + "\n📅 " + formatDate(event.start) + " " + formatTime(event.start) + "-" + formatTime(event.end);
    if (isRecurring) {
        const freqMap = { DAILY: "כל יום", WEEKLY: "כל שבוע", MONTHLY: "כל חודש", YEARLY: "כל שנה" };
        reply += "\n🔄 " + (freqMap[intent.recurrence.freq] || intent.recurrence.freq);
        if (intent.recurrence.byDay?.length)
            reply += " (" + intent.recurrence.byDay.join(", ") + ")";
    }
    if (event.meetLink)
        reply += "\n📹 Google Meet: " + event.meetLink;
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
async function handleAvailability(intent) {
    const date = intent.date || new Date().toISOString().split("T")[0];
    const dayStart = date + "T08:00:00";
    const dayEnd = date + "T20:00:00";
    const events = await (0, calendar_1.queryEvents)(new Date(dayStart).toISOString(), new Date(dayEnd).toISOString());
    if (intent.startTime) {
        const checkTime = intent.startTime;
        const checkEnd = intent.endTime || addHour(checkTime);
        const checkStart = buildDateTime(date, checkTime);
        const checkEndDt = buildDateTime(date, checkEnd);
        const conflict = events.find((e) => e.start < checkEndDt && e.end > checkStart);
        if (conflict)
            return "תפוס — " + conflict.summary + " " + formatTime(conflict.start) + "-" + formatTime(conflict.end);
        return "פנוי ב-" + formatDate(dayStart) + " " + checkTime;
    }
    const busySlots = events.map((e) => ({
        start: e.start.split("T")[1]?.substring(0, 5) || "00:00",
        end: e.end.split("T")[1]?.substring(0, 5) || "00:00",
    })).sort((a, b) => a.start.localeCompare(b.start));
    const freeSlots = [];
    let cursor = "08:00";
    for (const slot of busySlots) {
        if (slot.start > cursor)
            freeSlots.push(cursor + "-" + slot.start);
        if (slot.end > cursor)
            cursor = slot.end;
    }
    if (cursor < "20:00")
        freeSlots.push(cursor + "-20:00");
    if (freeSlots.length === 0)
        return "אין חלונות פנויים ב-" + formatDate(dayStart) + " (08:00-20:00)";
    return "חלונות פנויים ב-" + formatDate(dayStart) + ":\n" + freeSlots.map((s) => "• " + s).join("\n");
}
