"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIntent = parseIntent;
exports.summarizeMeeting = summarizeMeeting;
const openai_1 = __importDefault(require("openai"));
const config_1 = require("../config");
const openai = new openai_1.default({ apiKey: config_1.config.openai.apiKey });
async function parseIntent(message) {
    const now = new Date();
    const today = now.toLocaleDateString("he-IL", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: config_1.config.timezone });
    const currentTime = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: config_1.config.timezone });
    const prompt = "You are a calendar assistant parsing Hebrew/English into calendar actions.\nToday: " + today + "\nTime: " + currentTime + "\nTZ: " + config_1.config.timezone + "\n\nReturn JSON with: action (create|update|delete|query|availability|notion_create|notion_query|birthday_add|birthday_query|meeting_summary|booking_link|unknown), summary, date (YYYY-MM-DD), startTime (HH:mm), endTime, description, location, targetEvent, addMeet, attendees, newTime, newDate, recurrence ({freq,interval,count,until,byDay}), notionTitle, notionContent, birthdayName, birthdayDate (MM-DD), needsEmail, inviteeName.\n\nRULES: zoom -> location=Zoom NOT addMeet. Google Meet -> addMeet=true. availability keywords: free/pnuy/ein li. Notion keywords: tirshom/hosef. Birthday: yom huledet shel. Summary: sachem pgisha. Booking: link lkvi'at pgisha. If invite but no email: needsEmail=true. b-3=15:00. JSON only.\n\nExamples:\nkvoa pgisha machar b-3 im dani -> create,summary=pgisha im dani,date=tomorrow,startTime=15:00\nma yesh li hayom -> query,date=today\nkvoa pgisha b-zoom machar b-3 -> create,summary=pgisha,date=tomorrow,startTime=15:00,location=Zoom\nmatai ani panui machar -> availability,date=tomorrow\ntirshom b-Notion: rayon -> notion_create,notionTitle=rayon\nyom huledet shel dani b-15 l-mai -> birthday_add,birthdayName=dani,birthdayDate=05-15\nsachem pgisha -> meeting_summary\nlink lkviat pgisha -> booking_link";
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", response_format: { type: "json_object" },
        messages: [{ role: "system", content: prompt }, { role: "user", content: message }],
    });
    const text = response.choices[0]?.message?.content || "{}";
    try {
        return JSON.parse(text);
    }
    catch {
        return { action: "unknown" };
    }
}
async function summarizeMeeting(content) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "Summarize meeting notes in Hebrew with: 1) key topics 2) decisions 3) action items 4) next steps. Use emoji bullets. Be concise." }, { role: "user", content }],
    });
    return response.choices[0]?.message?.content || "Failed to summarize";
}
