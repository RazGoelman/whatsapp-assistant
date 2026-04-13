import { parseIntent, ParsedIntent, summarizeMeeting } from "./aiParser";
import { createEvent, updateEvent, deleteEvent, queryEvents, findEventByName, findAllEventsByName } from "./calendar";
import { sendWhatsAppMessage } from "./whatsapp";
import { transcribeAudio } from "./transcription";
import { isHelpTrigger, getHelpMenu, getWelcomeMessage } from "./locale";
import { createNotionPage, queryNotionPages, isNotionConfigured } from "./notion";
import { addBirthday, getUpcomingBirthdays } from "./birthdays";
import { config } from "../config";

const seenUsers = new Set<string>();
const pendingEmails = new Map<string, { intent: ParsedIntent; expires: number }>();
const pendingSummary = new Map<string, number>();

function formatTime(iso: string): string { return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: config.timezone }); }
function formatDate(iso: string): string { return new Date(iso).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: config.timezone }); }
function buildDateTime(d: string, t: string): string { return d + "T" + t + ":00"; }
function addHour(t: string): string { const [h, m] = t.split(":").map(Number); return String(h + 1).padStart(2, "0") + ":" + String(m).padStart(2, "0"); }

export async function handleIncomingMessage(from: string, message: string): Promise<void> {
  try {
    if (!seenUsers.has(from)) { seenUsers.add(from); await sendWhatsAppMessage(from, getWelcomeMessage(from)); }
    if (isHelpTrigger(message)) { await sendWhatsAppMessage(from, getHelpMenu(from)); return; }
    const pending = pendingEmails.get(from);
    if (pending && Date.now() < pending.expires) {
      const msg = message.trim().toLowerCase();
      if (msg === "cancel" || msg === "\u05d1\u05d9\u05d8\u05d5\u05dc") { pendingEmails.delete(from); await sendWhatsAppMessage(from, "\u274c \u05d1\u05d5\u05d8\u05dc"); return; }
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg)) { pendingEmails.delete(from); pending.intent.attendees = [msg]; pending.intent.needsEmail = false; const r = await executeIntent(pending.intent); await sendWhatsAppMessage(from, r); return; }
      await sendWhatsAppMessage(from, "\u274c \u05de\u05d9\u05d9\u05dc \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d0\u05d5 \u05e9\u05dc\u05d7 \u05d1\u05d9\u05d8\u05d5\u05dc"); return;
    }
    pendingEmails.delete(from);
    const summaryExp = pendingSummary.get(from);
    if (summaryExp && Date.now() < summaryExp) { pendingSummary.delete(from); await sendWhatsAppMessage(from, "\u23f3 \u05de\u05e1\u05db\u05dd..."); const s = await summarizeMeeting(message); await sendWhatsAppMessage(from, s); return; }
    pendingSummary.delete(from);
    const intent = await parseIntent(message);
    if (intent.needsEmail && intent.inviteeName) { pendingEmails.set(from, { intent, expires: Date.now() + 300000 }); await sendWhatsAppMessage(from, "\u{1f4e7} \u05de\u05d4 \u05d4\u05de\u05d9\u05d9\u05dc \u05e9\u05dc " + intent.inviteeName + "?"); return; }
    const reply = await executeIntent(intent);
    if (intent.action === "meeting_summary") pendingSummary.set(from, Date.now() + 600000);
    await sendWhatsAppMessage(from, reply);
  } catch (error: any) { await sendWhatsAppMessage(from, "\u274c \u05e9\u05d2\u05d9\u05d0\u05d4: " + error.message); }
}

export async function handleVoiceMessage(from: string, mediaId: string): Promise<void> {
  try {
    const summaryExp = pendingSummary.get(from);
    if (summaryExp && Date.now() < summaryExp) { pendingSummary.delete(from); const text = await transcribeAudio(mediaId); await sendWhatsAppMessage(from, "\u{1f399}\ufe0f " + text + "\n\n\u23f3 \u05de\u05e1\u05db\u05dd..."); const s = await summarizeMeeting(text); await sendWhatsAppMessage(from, s); return; }
    const text = await transcribeAudio(mediaId);
    await sendWhatsAppMessage(from, "\u{1f399}\ufe0f " + text);
    await handleIncomingMessage(from, text);
  } catch (e: any) { await sendWhatsAppMessage(from, "\u274c \u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05ea\u05d9 \u05dc\u05ea\u05de\u05dc\u05dc"); }
}

async function executeIntent(intent: ParsedIntent): Promise<string> {
  switch (intent.action) {
    case "create": return handleCreate(intent);
    case "query": return handleQuery(intent);
    case "delete": return handleDelete(intent);
    case "update": return handleUpdate(intent);
    case "availability": return handleAvailability(intent);
    case "notion_create": return handleNotionCreate(intent);
    case "notion_query": return handleNotionQuery();
    case "birthday_add": return handleBirthdayAdd(intent);
    case "birthday_query": return handleBirthdayQuery();
    case "meeting_summary": return "\u{1f4dd} \u05e9\u05dc\u05d7 \u05ea\u05d5\u05db\u05df \u05d4\u05e4\u05d2\u05d9\u05e9\u05d4 (\u05d8\u05e7\u05e1\u05d8/\u05d4\u05e7\u05dc\u05d8\u05d4)";
    case "booking_link": return "\u{1f4c5} \u05d4\u05dc\u05d9\u05e0\u05e7 \u05e9\u05dc\u05da:\n" + config.baseUrl + "/book";
    default: return "\u{1f914} \u05dc\u05d0 \u05d4\u05d1\u05e0\u05ea\u05d9. \u05e9\u05dc\u05d7 ? \u05dc\u05e2\u05d6\u05e8\u05d4";
  }
}

async function handleCreate(intent: ParsedIntent): Promise<string> {
  if (!intent.summary || !intent.date || !intent.startTime) return "\u274c \u05d7\u05e1\u05e8\u05d9\u05dd \u05e4\u05e8\u05d8\u05d9\u05dd";
  const end = intent.endTime || addHour(intent.startTime);
  const event = await createEvent({ summary: intent.summary, start: buildDateTime(intent.date, intent.startTime), end: buildDateTime(intent.date, end), description: intent.description, location: intent.location, addMeet: intent.addMeet, attendees: intent.attendees, recurrence: intent.recurrence });
  const isRec = intent.recurrence?.freq;
  let r = "\u2705 \u05e0\u05d5\u05e6\u05e8 \u05d0\u05d9\u05e8\u05d5\u05e2" + (isRec ? " \u05d7\u05d5\u05d6\u05e8" : "") + ": " + event.summary + "\n\u{1f4c5} " + formatDate(event.start) + " " + formatTime(event.start) + "-" + formatTime(event.end);
  if (intent.location) r += "\n\u{1f4cd} " + intent.location;
  if (isRec) { const fm: Record<string, string> = { DAILY: "\u05db\u05dc \u05d9\u05d5\u05dd", WEEKLY: "\u05db\u05dc \u05e9\u05d1\u05d5\u05e2", MONTHLY: "\u05db\u05dc \u05d7\u05d5\u05d3\u05e9", YEARLY: "\u05db\u05dc \u05e9\u05e0\u05d4" }; r += "\n\u{1f504} " + (fm[intent.recurrence!.freq] || intent.recurrence!.freq); }
  if (event.meetLink) r += "\n\u{1f4f9} " + event.meetLink;
  return r;
}

async function handleQuery(intent: ParsedIntent): Promise<string> {
  const date = intent.date || new Date().toISOString().split("T")[0];
  const events = await queryEvents(new Date(date + "T00:00:00").toISOString(), new Date(date + "T23:59:59").toISOString());
  if (events.length === 0) return "\u{1f4c5} \u05d0\u05d9\u05df \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd \u05d1-" + formatDate(date + "T00:00:00");
  let r = "\u{1f4c5} \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd \u05d1-" + formatDate(date + "T00:00:00") + ":\n";
  events.forEach((e, i) => { r += "\n" + (i + 1) + ". " + e.summary + " \u2014 " + formatTime(e.start) + "-" + formatTime(e.end); });
  return r;
}

async function handleDelete(intent: ParsedIntent): Promise<string> {
  if (!intent.targetEvent) return "\u274c \u05dc\u05d0 \u05d4\u05d1\u05e0\u05ea\u05d9 \u05d0\u05d9\u05d6\u05d4 \u05d0\u05d9\u05e8\u05d5\u05e2 \u05dc\u05de\u05d7\u05d5\u05e7";
  const events = await findAllEventsByName(intent.targetEvent);
  if (events.length === 0) return "\u274c \u05dc\u05d0 \u05de\u05e6\u05d0\u05ea\u05d9 \u05d0\u05d9\u05e8\u05d5\u05e2 " + intent.targetEvent;
  for (const e of events) { if (e.id) await deleteEvent(e.id); }
  return events.length === 1 ? "\u2705 \u05e0\u05de\u05d7\u05e7: " + events[0].summary : "\u2705 \u05e0\u05de\u05d7\u05e7\u05d5 " + events.length + " \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd";
}

async function handleUpdate(intent: ParsedIntent): Promise<string> {
  if (!intent.targetEvent) return "\u274c \u05dc\u05d0 \u05d4\u05d1\u05e0\u05ea\u05d9 \u05d0\u05d9\u05d6\u05d4 \u05d0\u05d9\u05e8\u05d5\u05e2 \u05dc\u05e2\u05d3\u05db\u05df";
  const event = await findEventByName(intent.targetEvent);
  if (!event || !event.id) return "\u274c \u05dc\u05d0 \u05de\u05e6\u05d0\u05ea\u05d9 " + intent.targetEvent;
  const updates: any = {};
  const nd = intent.newDate || event.start.split("T")[0];
  const nt = intent.newTime || event.start.split("T")[1]?.substring(0, 5) || "09:00";
  const ne = intent.newTime ? addHour(intent.newTime) : (event.end.split("T")[1]?.substring(0, 5) || addHour(nt));
  if (intent.newDate || intent.newTime) { updates.start = buildDateTime(nd, nt); updates.end = buildDateTime(nd, ne); }
  if (intent.summary) updates.summary = intent.summary;
  const updated = await updateEvent(event.id, updates);
  return "\u2705 \u05e2\u05d5\u05d3\u05db\u05df: " + updated.summary + " \u2192 " + formatDate(updated.start) + " " + formatTime(updated.start) + "-" + formatTime(updated.end);
}

async function handleAvailability(intent: ParsedIntent): Promise<string> {
  const date = intent.date || new Date().toISOString().split("T")[0];
  const events = await queryEvents(new Date(date + "T08:00:00").toISOString(), new Date(date + "T20:00:00").toISOString());
  if (intent.startTime) {
    const cs = buildDateTime(date, intent.startTime); const ce = buildDateTime(date, intent.endTime || addHour(intent.startTime));
    const conflict = events.find((e) => e.start < ce && e.end > cs);
    if (conflict) return "\u274c \u05ea\u05e4\u05d5\u05e1 \u2014 " + conflict.summary + " " + formatTime(conflict.start) + "-" + formatTime(conflict.end);
    return "\u2705 \u05e4\u05e0\u05d5\u05d9 \u05d1-" + formatDate(date + "T00:00:00") + " " + intent.startTime;
  }
  const busy = events.map((e) => ({ start: e.start.split("T")[1]?.substring(0, 5) || "00:00", end: e.end.split("T")[1]?.substring(0, 5) || "00:00" })).sort((a, b) => a.start.localeCompare(b.start));
  const free: string[] = []; let cursor = "08:00";
  for (const s of busy) { if (s.start > cursor) free.push(cursor + "-" + s.start); if (s.end > cursor) cursor = s.end; }
  if (cursor < "20:00") free.push(cursor + "-20:00");
  if (free.length === 0) return "\u{1f4c5} \u05d0\u05d9\u05df \u05d7\u05dc\u05d5\u05e0\u05d5\u05ea \u05e4\u05e0\u05d5\u05d9\u05d9\u05dd";
  return "\u{1f4c5} \u05d7\u05dc\u05d5\u05e0\u05d5\u05ea \u05e4\u05e0\u05d5\u05d9\u05d9\u05dd \u05d1-" + formatDate(date + "T00:00:00") + ":\n" + free.map((s) => "\u2022 " + s).join("\n");
}

async function handleNotionCreate(intent: ParsedIntent): Promise<string> {
  if (!isNotionConfigured()) return "\u274c Notion \u05dc\u05d0 \u05de\u05d5\u05d2\u05d3\u05e8";
  const title = intent.notionTitle || intent.summary || "untitled";
  await createNotionPage(title, intent.notionContent || "");
  return "\u{1f4dd} \u05e0\u05d5\u05e6\u05e8 \u05d1-Notion: " + title;
}
async function handleNotionQuery(): Promise<string> {
  if (!isNotionConfigured()) return "\u274c Notion \u05dc\u05d0 \u05de\u05d5\u05d2\u05d3\u05e8";
  const pages = await queryNotionPages(5);
  if (pages.length === 0) return "\u{1f4dd} \u05d0\u05d9\u05df \u05d3\u05e4\u05d9\u05dd";
  let r = "\u{1f4dd} \u05d3\u05e4\u05d9\u05dd \u05d1-Notion:\n";
  pages.forEach((p, i) => { r += "\n" + (i + 1) + ". " + p.title; });
  return r;
}
async function handleBirthdayAdd(intent: ParsedIntent): Promise<string> {
  if (!intent.birthdayName || !intent.birthdayDate) return "\u274c \u05d7\u05e1\u05e8\u05d9\u05dd \u05e4\u05e8\u05d8\u05d9\u05dd";
  addBirthday(intent.birthdayName, intent.birthdayDate);
  const [mm, dd] = intent.birthdayDate.split("-");
  const months = ["","\u05d9\u05e0\u05d5\u05d0\u05e8","\u05e4\u05d1\u05e8\u05d5\u05d0\u05e8","\u05de\u05e8\u05e5","\u05d0\u05e4\u05e8\u05d9\u05dc","\u05de\u05d0\u05d9","\u05d9\u05d5\u05e0\u05d9","\u05d9\u05d5\u05dc\u05d9","\u05d0\u05d5\u05d2\u05d5\u05e1\u05d8","\u05e1\u05e4\u05d8\u05de\u05d1\u05e8","\u05d0\u05d5\u05e7\u05d8\u05d5\u05d1\u05e8","\u05e0\u05d5\u05d1\u05de\u05d1\u05e8","\u05d3\u05e6\u05de\u05d1\u05e8"];
  return "\u{1f382} \u05e0\u05e9\u05de\u05e8: " + intent.birthdayName + " \u2014 " + parseInt(dd) + " \u05d1" + months[parseInt(mm)];
}
async function handleBirthdayQuery(): Promise<string> {
  const upcoming = getUpcomingBirthdays(30);
  if (upcoming.length === 0) return "\u{1f382} \u05d0\u05d9\u05df \u05d9\u05de\u05d9 \u05d4\u05d5\u05dc\u05d3\u05ea \u05e7\u05e8\u05d5\u05d1\u05d9\u05dd";
  const months = ["","\u05d9\u05e0\u05d5\u05d0\u05e8","\u05e4\u05d1\u05e8\u05d5\u05d0\u05e8","\u05de\u05e8\u05e5","\u05d0\u05e4\u05e8\u05d9\u05dc","\u05de\u05d0\u05d9","\u05d9\u05d5\u05e0\u05d9","\u05d9\u05d5\u05dc\u05d9","\u05d0\u05d5\u05d2\u05d5\u05e1\u05d8","\u05e1\u05e4\u05d8\u05de\u05d1\u05e8","\u05d0\u05d5\u05e7\u05d8\u05d5\u05d1\u05e8","\u05e0\u05d5\u05d1\u05de\u05d1\u05e8","\u05d3\u05e6\u05de\u05d1\u05e8"];
  let r = "\u{1f382} \u05d9\u05de\u05d9 \u05d4\u05d5\u05dc\u05d3\u05ea \u05e7\u05e8\u05d5\u05d1\u05d9\u05dd:\n";
  upcoming.forEach((b) => { const [mm, dd] = b.date.split("-"); r += "\n\u2022 " + b.name + " \u2014 " + parseInt(dd) + " \u05d1" + months[parseInt(mm)]; });
  return r;
}
