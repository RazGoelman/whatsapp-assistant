import OpenAI from 'openai';
import { config } from '../config';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export interface ParsedIntent {
  action: 'create' | 'update' | 'delete' | 'query' | 'unknown';
  summary?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  location?: string;
  targetEvent?: string;
  addMeet?: boolean;
  attendees?: string[];
  newTime?: string;
  newDate?: string;
}

export async function parseIntent(message: string): Promise<ParsedIntent> {
  const now = new Date();
  const today = now.toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: config.timezone,
  });
  const currentTime = now.toLocaleTimeString('he-IL', {
    hour: '2-digit', minute: '2-digit', timeZone: config.timezone,
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
Timezone: ${config.timezone}

Return a JSON object with these fields:
- action: "create" | "update" | "delete" | "query" | "unknown"
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
    return JSON.parse(text) as ParsedIntent;
  } catch {
    return { action: 'unknown' };
  }
}
