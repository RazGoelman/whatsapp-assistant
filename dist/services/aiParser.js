"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIntent = parseIntent;
const openai_1 = __importDefault(require("openai"));
const config_1 = require("../config");
const openai = new openai_1.default({ apiKey: config_1.config.openai.apiKey });
async function parseIntent(message) {
    const now = new Date();
    const today = now.toLocaleDateString('he-IL', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: config_1.config.timezone,
    });
    const currentTime = now.toLocaleTimeString('he-IL', {
        hour: '2-digit', minute: '2-digit', timeZone: config_1.config.timezone,
    });
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `You are a calendar assistant that parses Hebrew and English messages into calendar actions.

Today is: ${today}
Current time: ${currentTime}
Timezone: ${config_1.config.timezone}

Return a JSON object with these fields:
- action: "create" | "update" | "delete" | "query" | "availability" | "unknown"
- summary: event title (string, optional)
- date: ISO date string YYYY-MM-DD (optional)
- startTime: "HH:mm" (optional)
- endTime: "HH:mm" (optional, default 1 hour after startTime)
- description: event description (optional)
- location: location (optional)
- targetEvent: name of existing event to update/delete (optional)
- addMeet: true if user wants a video meeting (optional)
- attendees: array of email addresses (optional)
- newTime: "HH:mm" for rescheduling (optional)
- newDate: "YYYY-MM-DD" for rescheduling (optional)
- recurrence: object for recurring events (optional):
  - freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
  - interval: number (default 1)
  - count: number of occurrences (optional)
  - until: end date "YYYY-MM-DD" (optional)
  - byDay: array of day codes ["MO","TU","WE","TH","FR","SA","SU"] (optional)

Examples for recurring:
"קבע ישיבת צוות כל יום שני ב-9" -> {"action":"create","summary":"ישיבת צוות","date":"next Monday","startTime":"09:00","endTime":"10:00","recurrence":{"freq":"WEEKLY","byDay":["MO"]}}
"קבע פגישה כל יום ב-8 בבוקר" -> {"action":"create","summary":"פגישה","date":"tomorrow","startTime":"08:00","endTime":"09:00","recurrence":{"freq":"DAILY"}}
"קבע ישיבה כל יום שני ורביעי ב-10" -> {"action":"create","summary":"ישיבה","date":"next Monday","startTime":"10:00","endTime":"11:00","recurrence":{"freq":"WEEKLY","byDay":["MO","WE"]}}

Examples for availability:
"מתי אני פנוי מחר?" -> {"action":"availability","date":"tomorrow"}
"האם אני פנוי מחר ב-3?" -> {"action":"availability","date":"tomorrow","startTime":"15:00"}
"מתי אני פנוי ביום שלישי אחהצ?" -> {"action":"availability","date":"next Tuesday","startTime":"12:00","endTime":"20:00"}

- newDate "YYYY-MM-DD" for rescheduling (optional)

Examples:
"קבע פגישה מחר ב-3 עם דני" → {"action":"create","summary":"פגישה עם דני","date":"tomorrow's date","startTime":"15:00","endTime":"16:00"}
"מה יש לי היום?" → {"action":"query","date":"today's date"}
"תבטל את הפגישה עם דני" → {"action":"delete","targetEvent":"פגישה עם דני"}
"תזיז את הישיבה ל-5" → {"action":"update","targetEvent":"ישיבה","newTime":"17:00"}
"קבע פגישת וידאו מחר ב-10" → {"action":"create","summary":"פגישת וידאו","date":"tomorrow's date","startTime":"10:00","endTime":"11:00","addMeet":true}

Parse relative dates into absolute ISO dates.
If the user says "ב-3" interpret as 15:00 unless context suggests AM.
Only return JSON, nothing else.`,
            },
            { role: 'user', content: message },
        ],
    });
    const text = response.choices[0]?.message?.content || '{}';
    try {
        return JSON.parse(text);
    }
    catch {
        return { action: 'unknown' };
    }
}
