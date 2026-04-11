"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReminders = startReminders;
exports.startDailySummary = startDailySummary;
const node_cron_1 = __importDefault(require("node-cron"));
const calendar_1 = require("./calendar");
const whatsapp_1 = require("./whatsapp");
const config_1 = require("../config");
function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: config_1.config.timezone });
}
function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: config_1.config.timezone });
}
const remindedEvents = new Set();
function startReminders() {
    node_cron_1.default.schedule('*/5 * * * *', async () => {
        try {
            const now = new Date();
            const inOneHour = new Date(now.getTime() + 65 * 60 * 1000);
            const in55Min = new Date(now.getTime() + 55 * 60 * 1000);
            const events = await (0, calendar_1.queryEvents)(in55Min.toISOString(), inOneHour.toISOString());
            for (const event of events) {
                if (event.id && !remindedEvents.has(event.id)) {
                    remindedEvents.add(event.id);
                    let msg = `⏰ תזכורת: ${event.summary} מתחיל בעוד שעה (${formatTime(event.start)})`;
                    if (event.meetLink)
                        msg += `\n📹 ${event.meetLink}`;
                    await (0, whatsapp_1.sendWhatsAppMessage)(config_1.config.userPhoneNumber, msg);
                    console.log(`⏰ Reminder sent for: ${event.summary}`);
                }
            }
            if (remindedEvents.size > 100) {
                const arr = Array.from(remindedEvents);
                arr.slice(0, arr.length - 50).forEach((id) => remindedEvents.delete(id));
            }
        }
        catch (error) {
            console.error('❌ Reminder cron error:', error.message);
        }
    });
    console.log('⏰ Reminders cron started (every 5 min)');
}
function startDailySummary() {
    node_cron_1.default.schedule('0 20 * * *', async () => {
        try {
            const now = new Date();
            const todayEnd = new Date(now);
            todayEnd.setHours(23, 59, 59, 999);
            const todayEvents = await (0, calendar_1.queryEvents)(now.toISOString(), todayEnd.toISOString());
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const tomorrowEnd = new Date(tomorrow);
            tomorrowEnd.setHours(23, 59, 59, 999);
            const tomorrowEvents = await (0, calendar_1.queryEvents)(tomorrow.toISOString(), tomorrowEnd.toISOString());
            let msg = '📋 סיכום יומי\n';
            msg += `\n📅 היום (${formatDate(now.toISOString())}):\n`;
            if (todayEvents.length === 0) {
                msg += 'אין עוד אירועים היום.\n';
            }
            else {
                todayEvents.forEach((e, i) => { msg += `${i + 1}. ${e.summary} — ${formatTime(e.start)}\n`; });
            }
            msg += `\n📅 מחר (${formatDate(tomorrow.toISOString())}):\n`;
            if (tomorrowEvents.length === 0) {
                msg += 'אין אירועים מתוכננים.\n';
            }
            else {
                tomorrowEvents.forEach((e, i) => { msg += `${i + 1}. ${e.summary} — ${formatTime(e.start)}\n`; });
            }
            await (0, whatsapp_1.sendWhatsAppMessage)(config_1.config.userPhoneNumber, msg);
            console.log('📋 Daily summary sent');
        }
        catch (error) {
            console.error('❌ Daily summary cron error:', error.message);
        }
    }, { timezone: config_1.config.timezone });
    console.log('📋 Daily summary cron started (20:00)');
}
