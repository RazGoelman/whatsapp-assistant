import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  // WhatsApp Meta Cloud API
  meta: {
    accessToken: requireEnv('META_ACCESS_TOKEN'),
    phoneNumberId: requireEnv('META_PHONE_NUMBER_ID'),
    webhookVerifyToken: requireEnv('WEBHOOK_VERIFY_TOKEN'),
    graphApiVersion: 'v21.0',
  },

  // OpenAI
  openai: {
    apiKey: requireEnv('OPENAI_API_KEY'),
  },

  // Google Calendar
  google: {
    credentials: requireEnv('GOOGLE_CREDENTIALS'),
    calendarId: requireEnv('GOOGLE_CALENDAR_ID'),
  },

  // App
  port: parseInt(optionalEnv('PORT', '3000'), 10),
  userPhoneNumber: requireEnv('USER_PHONE_NUMBER'),
  timezone: optionalEnv('TZ', 'Asia/Jerusalem'),
};
