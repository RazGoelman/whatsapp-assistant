"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReminders = startReminders;
exports.startDailySummary = startDailySummary;
exports.startWeeklySummary = startWeeklySummary;
exports.startBirthdayReminders = startBirthdayReminders;
const node_cron_1 = __importDefault(require("node-cron"));
const calendar_1 = require("./calendar");
const whatsapp_1 = require("./whatsapp");
const birthdays_1 = require("./birthdays");
const config_1 = require("../config");
function formatTime(iso) { return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: config_1.config.timezone }); }
function formatDate(iso) { return new Date(iso).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: config_1.config.timezone }); }
const remindedEvents = new Set();
function startReminders() {
    node_cron_1.default.schedule("*/5 * * * *", async () => {
        try {
            const now = new Date();
            const events = await (0, calendar_1.queryEvents)(new Date(now.getTime() + 55 * 60000).toISOString(), new Date(now.getTime() + 65 * 60000).toISOString());
            for (const e of events) {
                if (e.id && !remindedEvents.has(e.id)) {
                    remindedEvents.add(e.id);
                    let m = "\u23f0 " + e.summary + " \u05d1\u05e2\u05d5\u05d3 \u05e9\u05e2\u05d4 (" + formatTime(e.start) + ")";
                    if (e.meetLink)
                        m += "\n\u{1f4f9} " + e.meetLink;
                    await (0, whatsapp_1.sendWhatsAppMessage)(config_1.config.userPhoneNumber, m);
                }
            }
            if (remindedEvents.size > 100) {
                const a = Array.from(remindedEvents);
                a.slice(0, a.length - 50).forEach((id) => remindedEvents.delete(id));
            }
        }
        catch (e) {
            console.error("Reminder error:", e.message);
        }
    });
    console.log("Reminders started");
}
function startDailySummary() {
    node_cron_1.default.schedule("0 20 * * *", async () => {
        try {
            const now = new Date();
            const te = new Date(now);
            te.setHours(23, 59, 59, 999);
            const todayEv = await (0, calendar_1.queryEvents)(now.toISOString(), te.toISOString());
            const tm = new Date(now);
            tm.setDate(tm.getDate() + 1);
            tm.setHours(0, 0, 0, 0);
            const tme = new Date(tm);
            tme.setHours(23, 59, 59, 999);
            const tmEv = await (0, calendar_1.queryEvents)(tm.toISOString(), tme.toISOString());
            let m = "\u{1f4cb} \u05e1\u05d9\u05db\u05d5\u05dd \u05d9\u05d5\u05de\u05d9\n\n\u{1f4c5} " + formatDate(now.toISOString()) + ":\n";
            if (todayEv.length === 0)
                m += "\u05d0\u05d9\u05df \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd\n";
            else
                todayEv.forEach((e, i) => { m += (i + 1) + ". " + e.summary + " \u2014 " + formatTime(e.start) + "\n"; });
            m += "\n\u{1f4c5} \u05de\u05d7\u05e8 (" + formatDate(tm.toISOString()) + "):\n";
            if (tmEv.length === 0)
                m += "\u05d0\u05d9\u05df \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd\n";
            else
                tmEv.forEach((e, i) => { m += (i + 1) + ". " + e.summary + " \u2014 " + formatTime(e.start) + "\n"; });
            await (0, whatsapp_1.sendWhatsAppMessage)(config_1.config.userPhoneNumber, m);
        }
        catch (e) {
            console.error("Daily error:", e.message);
        }
    }, { timezone: config_1.config.timezone });
    console.log("Daily summary started");
}
function startWeeklySummary() {
    node_cron_1.default.schedule("0 7 * * 0", async () => {
        try {
            const now = new Date();
            let m = "\u{1f4cb} \u05e1\u05d9\u05db\u05d5\u05dd \u05e9\u05d1\u05d5\u05e2\u05d9\n";
            for (let i = 0; i < 7; i++) {
                const d = new Date(now);
                d.setDate(d.getDate() + i);
                const ds = new Date(d);
                ds.setHours(0, 0, 0, 0);
                const de = new Date(d);
                de.setHours(23, 59, 59, 999);
                const ev = await (0, calendar_1.queryEvents)(ds.toISOString(), de.toISOString());
                m += "\n\u{1f4c5} " + formatDate(ds.toISOString()) + ":\n";
                if (ev.length === 0)
                    m += "\u05d0\u05d9\u05df \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd\n";
                else
                    ev.forEach((e, idx) => { m += (idx + 1) + ". " + e.summary + " \u2014 " + formatTime(e.start) + "\n"; });
            }
            await (0, whatsapp_1.sendWhatsAppMessage)(config_1.config.userPhoneNumber, m);
        }
        catch (e) {
            console.error("Weekly error:", e.message);
        }
    }, { timezone: config_1.config.timezone });
    console.log("Weekly summary started");
}
function startBirthdayReminders() {
    node_cron_1.default.schedule("0 8 * * *", async () => {
        try {
            for (const b of (0, birthdays_1.getTodayBirthdays)())
                await (0, whatsapp_1.sendWhatsAppMessage)(config_1.config.userPhoneNumber, "\u{1f389} \u05d4\u05d9\u05d5\u05dd \u05d9\u05d5\u05dd \u05d4\u05d4\u05d5\u05dc\u05d3\u05ea \u05e9\u05dc " + b.name + "!");
            for (const b of (0, birthdays_1.getTomorrowBirthdays)())
                await (0, whatsapp_1.sendWhatsAppMessage)(config_1.config.userPhoneNumber, "\u{1f382} \u05de\u05d7\u05e8 \u05d9\u05d5\u05dd \u05d4\u05d4\u05d5\u05dc\u05d3\u05ea \u05e9\u05dc " + b.name + "!");
        }
        catch (e) {
            console.error("Birthday error:", e.message);
        }
    }, { timezone: config_1.config.timezone });
    console.log("Birthday reminders started");
}
