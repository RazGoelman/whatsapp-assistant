"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
function optionalEnv(name, fallback) {
    return process.env[name] || fallback;
}
exports.config = {
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
    timezone: optionalEnv("TZ", "Asia/Jerusalem"),
    notion: { apiKey: process.env["NOTION_API_KEY"] || "", databaseId: process.env["NOTION_DATABASE_ID"] || "" },
    baseUrl: optionalEnv("BASE_URL", "https://YOUR_DOMAIN"),
};
