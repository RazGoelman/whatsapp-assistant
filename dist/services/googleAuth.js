"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarId = void 0;
exports.getCalendar = getCalendar;
const googleapis_1 = require("googleapis");
const config_1 = require("../config");
let calendarClient = null;
function getAuth() {
    const credentials = JSON.parse(Buffer.from(config_1.config.google.credentials, 'base64').toString('utf-8'));
    return new googleapis_1.google.auth.GoogleAuth({
        credentials,
        scopes: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
        ],
    });
}
function getCalendar() {
    if (!calendarClient) {
        const auth = getAuth();
        calendarClient = googleapis_1.google.calendar({ version: 'v3', auth });
    }
    return calendarClient;
}
exports.calendarId = config_1.config.google.calendarId;
