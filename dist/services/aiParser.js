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
    const today = now.toLocaleDateString("he-IL", {
        weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: config_1.config.timezone,
    });
    const currentTime = now.toLocaleTimeString("he-IL", {
        hour: "2-digit", minute: "2-digit", timeZone: config_1.config.timezone,
    });
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: "You are a calendar assistant that parses Hebrew and English messages into calendar actions.\n\nToday is: " + today + "\nCurrent time: " + currentTime + "\nTimezone: " + config_1.config.timezone + "\n\nReturn a JSON object with these fields:\n- action: create | update | delete | query | availability | unknown\n- summary: event title (optional)\n- date: YYYY-MM-DD (optional)\n- startTime: HH:mm (optional)\n- endTime: HH:mm (optional, default 1 hour after startTime)\n- description: event description (optional)\n- location: location (optional)\n- targetEvent: name of existing event to update/delete (optional)\n- addMeet: true if user wants a video meeting (optional)\n- attendees: array of email addresses (optional)\n- newTime: HH:mm for rescheduling (optional)\n- newDate: YYYY-MM-DD for rescheduling (optional)\n- recurrence: object with freq (DAILY/WEEKLY/MONTHLY/YEARLY), interval, count, until, byDay array (optional)\n\nIMPORTANT RULES:\n- Parse relative dates into absolute YYYY-MM-DD dates\n- \"ב-3\" means 15:00 unless context suggests AM\n- \"מתי אני פנוי\" or \"האם אני פנוי\" or \"מתי אין לי\" or \"when am I free\" = action availability\n- \"כל יום שני\" or \"every Monday\" = recurrence with freq WEEKLY\n- Only return valid JSON\n\nExamples:\n\"קבע פגישה מחר ב-3 עם דני\" -> {\"action\":\"create\",\"summary\":\"פגישה עם דני\",\"date\":\"tomorrow\",\"startTime\":\"15:00\",\"endTime\":\"16:00\"}\n\"מה יש לי היום?\" -> {\"action\":\"query\",\"date\":\"today\"}\n\"מה יש לי מחר?\" -> {\"action\":\"query\",\"date\":\"tomorrow\"}\n\"תבטל את הפגישה עם דני\" -> {\"action\":\"delete\",\"targetEvent\":\"פגישה עם דני\"}\n\"תזיז את הישיבה ל-5\" -> {\"action\":\"update\",\"targetEvent\":\"ישיבה\",\"newTime\":\"17:00\"}\n\"תשנה את הפגישה מיום ראשון ליום שני\" -> {\"action\":\"update\",\"targetEvent\":\"פגישה\",\"newDate\":\"next Monday\"}\n\"קבע ישיבת צוות כל יום שני ב-9\" -> {\"action\":\"create\",\"summary\":\"ישיבת צוות\",\"date\":\"next Monday\",\"startTime\":\"09:00\",\"endTime\":\"10:00\",\"recurrence\":{\"freq\":\"WEEKLY\",\"byDay\":[\"MO\"]}}\n\"קבע פגישה כל יום ב-8 בבוקר\" -> {\"action\":\"create\",\"summary\":\"פגישה\",\"date\":\"tomorrow\",\"startTime\":\"08:00\",\"endTime\":\"09:00\",\"recurrence\":{\"freq\":\"DAILY\"}}\n\"מתי אני פנוי מחר?\" -> {\"action\":\"availability\",\"date\":\"tomorrow\"}\n\"האם אני פנוי מחר ב-3?\" -> {\"action\":\"availability\",\"date\":\"tomorrow\",\"startTime\":\"15:00\"}\n\"מתי אין לי פגישות מחר?\" -> {\"action\":\"availability\",\"date\":\"tomorrow\"}\n\"when am I free tomorrow?\" -> {\"action\":\"availability\",\"date\":\"tomorrow\"}\n\"מתי אני פנוי ביום שלישי אחהצ?\" -> {\"action\":\"availability\",\"date\":\"next Tuesday\",\"startTime\":\"12:00\",\"endTime\":\"20:00\"}",
            },
            { role: "user", content: message },
        ],
    });
    const text = response.choices[0]?.message?.content || "{}";
    try {
        return JSON.parse(text);
    }
    catch {
        return { action: "unknown" };
    }
}
