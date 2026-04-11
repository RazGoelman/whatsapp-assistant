import { parseIntent, ParsedIntent } from './aiParser';
import { createEvent, updateEvent, deleteEvent, queryEvents, findEventByName, findAllEventsByName } from './calendar';
import { sendWhatsAppMessage } from './whatsapp';
import { transcribeAudio } from './transcription';
import { isHelpTrigger, getHelpMenu, getWelcomeMessage } from "./locale";
import { config } from '../config';

const seenUsers = new Set<string>();

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: config.timezone });
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: config.timezone });
}

function buildDateTime(date: string, time: string): string {
  return `${date}T${time}:00`;
}

export async function handleIncomingMessage(from: string, message: string): Promise<void> {
  try {
    if (!seenUsers.has(from)) {
      seenUsers.add(from);
      await sendWhatsAppMessage(from, getWelcomeMessage(from));
    }
    if (isHelpTrigger(message)) {
      await sendWhatsAppMessage(from, getHelpMenu(from));
      return;
    }
    console.log("Processing message from " + from + ": " + message);
    const intent = await parseIntent(message);
    console.log("Parsed intent: " + JSON.stringify(intent));
    const reply = await executeIntent(intent);
    await sendWhatsAppMessage(from, reply);
  } catch (error: any) {
    console.error("Error handling message:", error.message);
    await sendWhatsAppMessage(from, "שגיאה: " + error.message);
  }
}

export async function handleVoiceMessage(from: string, mediaId: string): Promise<void> {
  try {
    const text = await transcribeAudio(mediaId);
    await sendWhatsAppMessage(from, `🎙️ תמלול: "${text}"`);
    await handleIncomingMessage(from, text);
  } catch (error: any) {
    console.error('❌ Error handling voice:', error.message);
    await sendWhatsAppMessage(from, '❌ לא הצלחתי לתמלל את ההודעה הקולית');
  }
}

async function executeIntent(intent: ParsedIntent): Promise<string> {
  switch (intent.action) {
    case 'create': return handleCreate(intent);
    case 'query': return handleQuery(intent);
    case 'delete': return handleDelete(intent);
    case 'update': return handleUpdate(intent);
    case 'availability': return handleAvailability(intent);
    default: return '🤔 לא הבנתי את הבקשה. נסה שוב, למשל:\n• "קבע פגישה מחר ב-3 עם דני"\n• "מה יש לי היום?"\n• "תבטל את הפגישה עם דני"';
  }
}

async function handleCreate(intent: ParsedIntent): Promise<string> {
  if (!intent.summary || !intent.date || !intent.startTime) {
    return '❌ חסרים פרטים ליצירת אירוע. צריך לפחות: שם, תאריך ושעה.';
  }
  const endTime = intent.endTime || addHour(intent.startTime);
  const start = buildDateTime(intent.date, intent.startTime);
  const end = buildDateTime(intent.date, endTime);

  const event = await createEvent({
    summary: intent.summary, start, end,
    description: intent.description, location: intent.location,
    addMeet: intent.addMeet, attendees: intent.attendees,
    recurrence: intent.recurrence,
  });

  const isRecurring = intent.recurrence?.freq;
  const recurText = isRecurring ? " חוזר" : "";
  let reply = "נוצר אירוע" + recurText + ": " + event.summary + "\n📅 " + formatDate(event.start) + " " + formatTime(event.start) + "-" + formatTime(event.end);
  if (isRecurring) {
    const freqMap: Record<string, string> = { DAILY: "כל יום", WEEKLY: "כל שבוע", MONTHLY: "כל חודש", YEARLY: "כל שנה" };
    reply += "\n🔄 " + (freqMap[intent.recurrence!.freq] || intent.recurrence!.freq);
    if (intent.recurrence!.byDay?.length) reply += " (" + intent.recurrence!.byDay.join(", ") + ")";
  }
  if (event.meetLink) reply += "\n📹 Google Meet: " + event.meetLink;
  return reply;
}

async function handleQuery(intent: ParsedIntent): Promise<string> {
  const date = intent.date || new Date().toISOString().split('T')[0];
  const timeMin = `${date}T00:00:00`;
  const timeMax = `${date}T23:59:59`;
  const events = await queryEvents(new Date(timeMin).toISOString(), new Date(timeMax).toISOString());

  if (events.length === 0) return `📅 אין אירועים ב-${formatDate(timeMin)}`;

  let reply = `📅 אירועים ב-${formatDate(timeMin)}:\n`;
  events.forEach((e, i) => {
    reply += `\n${i + 1}. ${e.summary} — ${formatTime(e.start)}-${formatTime(e.end)}`;
    if (e.meetLink) reply += ` 📹`;
  });
  return reply;
}

async function handleDelete(intent: ParsedIntent): Promise<string> {
  if (!intent.targetEvent) return '❌ לא הבנתי איזה אירוע למחוק. נסה: "תבטל את הפגישה עם דני"';
  const event = await findEventByName(intent.targetEvent);
  if (!event || !event.id) return `❌ לא מצאתי אירוע "${intent.targetEvent}" בשבוע הקרוב`;
  await deleteEvent(event.id);
  return `✅ נמחק: ${event.summary}`;
}

async function handleUpdate(intent: ParsedIntent): Promise<string> {
  if (!intent.targetEvent) return '❌ לא הבנתי איזה אירוע לעדכן. נסה: "תזיז את הישיבה ל-5"';
  const event = await findEventByName(intent.targetEvent);
  if (!event || !event.id) return `❌ לא מצאתי אירוע "${intent.targetEvent}" בשבוע הקרוב`;

  const updates: any = {};
  if (intent.newDate && !intent.newTime) {
    const time = event.start.split('T')[1]?.substring(0, 5) || '09:00';
    const endTime = event.end.split('T')[1]?.substring(0, 5) || addHour(time);
    updates.start = buildDateTime(intent.newDate, time);
    updates.end = buildDateTime(intent.newDate, endTime);
  }
  if (intent.summary) updates.summary = intent.summary;

  const updated = await updateEvent(event.id, updates);
  return `✅ עודכן: ${updated.summary} → ${formatDate(updated.start)} ${formatTime(updated.start)}-${formatTime(updated.end)}`;
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function handleAvailability(intent: ParsedIntent): Promise<string> {
  const date = intent.date || new Date().toISOString().split("T")[0];
  const dayStart = date + "T08:00:00";
  const dayEnd = date + "T20:00:00";
  const events = await queryEvents(new Date(dayStart).toISOString(), new Date(dayEnd).toISOString());

  if (intent.startTime) {
    const checkTime = intent.startTime;
    const checkEnd = intent.endTime || addHour(checkTime);
    const checkStart = buildDateTime(date, checkTime);
    const checkEndDt = buildDateTime(date, checkEnd);
    const conflict = events.find((e) => e.start < checkEndDt && e.end > checkStart);
    if (conflict) return "תפוס — " + conflict.summary + " " + formatTime(conflict.start) + "-" + formatTime(conflict.end);
    return "פנוי ב-" + formatDate(dayStart) + " " + checkTime;
  }

  const busySlots = events.map((e) => ({
    start: e.start.split("T")[1]?.substring(0, 5) || "00:00",
    end: e.end.split("T")[1]?.substring(0, 5) || "00:00",
  })).sort((a, b) => a.start.localeCompare(b.start));

  const freeSlots: string[] = [];
  let cursor = "08:00";
  for (const slot of busySlots) {
    if (slot.start > cursor) freeSlots.push(cursor + "-" + slot.start);
    if (slot.end > cursor) cursor = slot.end;
  }
  if (cursor < "20:00") freeSlots.push(cursor + "-20:00");

  if (freeSlots.length === 0) return "אין חלונות פנויים ב-" + formatDate(dayStart) + " (08:00-20:00)";
  return "חלונות פנויים ב-" + formatDate(dayStart) + ":\n" + freeSlots.map((s) => "• " + s).join("\n");
}
