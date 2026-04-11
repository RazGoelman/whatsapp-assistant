import cron from 'node-cron';
import { queryEvents } from './calendar';
import { sendWhatsAppMessage } from './whatsapp';
import { config } from '../config';

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: config.timezone });
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: config.timezone });
}

const remindedEvents = new Set<string>();

export function startReminders(): void {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const inOneHour = new Date(now.getTime() + 65 * 60 * 1000);
      const in55Min = new Date(now.getTime() + 55 * 60 * 1000);
      const events = await queryEvents(in55Min.toISOString(), inOneHour.toISOString());

      for (const event of events) {
        if (event.id && !remindedEvents.has(event.id)) {
          remindedEvents.add(event.id);
          let msg = `⏰ תזכורת: ${event.summary} מתחיל בעוד שעה (${formatTime(event.start)})`;
          if (event.meetLink) msg += `\n📹 ${event.meetLink}`;
          await sendWhatsAppMessage(config.userPhoneNumber, msg);
          console.log(`⏰ Reminder sent for: ${event.summary}`);
        }
      }

      if (remindedEvents.size > 100) {
        const arr = Array.from(remindedEvents);
        arr.slice(0, arr.length - 50).forEach((id) => remindedEvents.delete(id));
      }
    } catch (error: any) {
      console.error('❌ Reminder cron error:', error.message);
    }
  });
  console.log('⏰ Reminders cron started (every 5 min)');
}

export function startDailySummary(): void {
  cron.schedule('0 20 * * *', async () => {
    try {
      const now = new Date();
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      const todayEvents = await queryEvents(now.toISOString(), todayEnd.toISOString());

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(23, 59, 59, 999);
      const tomorrowEvents = await queryEvents(tomorrow.toISOString(), tomorrowEnd.toISOString());

      let msg = '📋 סיכום יומי\n';
      msg += `\n📅 היום (${formatDate(now.toISOString())}):\n`;
      if (todayEvents.length === 0) { msg += 'אין עוד אירועים היום.\n'; }
      else { todayEvents.forEach((e, i) => { msg += `${i + 1}. ${e.summary} — ${formatTime(e.start)}\n`; }); }

      msg += `\n📅 מחר (${formatDate(tomorrow.toISOString())}):\n`;
      if (tomorrowEvents.length === 0) { msg += 'אין אירועים מתוכננים.\n'; }
      else { tomorrowEvents.forEach((e, i) => { msg += `${i + 1}. ${e.summary} — ${formatTime(e.start)}\n`; }); }

      await sendWhatsAppMessage(config.userPhoneNumber, msg);
      console.log('📋 Daily summary sent');
    } catch (error: any) {
      console.error('❌ Daily summary cron error:', error.message);
    }
  }, { timezone: config.timezone });
  console.log('📋 Daily summary cron started (20:00)');
}

export function startWeeklySummary(): void {
  cron.schedule("0 7 * * 0", async () => {
    try {
      const now = new Date();
      let msg = "📋 סיכום שבועי\n";
      for (let i = 0; i < 7; i++) {
        const day = new Date(now);
        day.setDate(day.getDate() + i);
        const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
        const events = await queryEvents(dayStart.toISOString(), dayEnd.toISOString());
        msg += "\n📅 " + formatDate(dayStart.toISOString()) + ":\n";
        if (events.length === 0) { msg += "אין אירועים\n"; }
        else { events.forEach((e, idx) => { msg += (idx + 1) + ". " + e.summary + " — " + formatTime(e.start) + "\n"; }); }
      }
      await sendWhatsAppMessage(config.userPhoneNumber, msg);
      console.log("Weekly summary sent");
    } catch (error: any) {
      console.error("Weekly summary cron error:", error.message);
    }
  }, { timezone: config.timezone });
  console.log("Weekly summary cron started (Sunday 07:00)");
}
