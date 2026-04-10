const express = require('express');
const cron = require('node-cron');
const { initDatabase, backupDatabase } = require('./db');
const { initAI } = require('./services/ai');
const { initStripe } = require('./services/stripe');
const { initTranscription } = require('./services/transcription');
const whatsappManager = require('./services/whatsappManager');
const tenantManager = require('./services/tenantManager');
const { handleIncomingMessage } = require('./handlers/messageRouter');
const { adminRouter } = require('./web/adminDashboard');
const { customerRouter } = require('./web/customerPages');
const logger = require('./services/logger');

const PORT = parseInt(process.env.PORT, 10) || 3000;

async function main() {
  console.log('');
  console.log('🤖 === WhatsApp Assistant SaaS v3 ===');
  console.log('');

  // === שלב 1: מסד נתונים ===
  await initDatabase();

  // === שלב 2: שירותים ===
  initAI();
  initStripe();
  initTranscription();

  // === שלב 3: Express ===
  const app = express();

  // Stripe Webhook צריך raw body — חייב להיות לפני express.json()
  app.use('/c/stripe', customerRouter);

  // כל השאר
  app.use('/admin', adminRouter);
  app.use('/c', customerRouter);

  app.get('/', (req, res) => {
    res.redirect('/admin/login');
  });

  app.listen(PORT, () => {
    console.log('🌐 שרת פעיל על פורט ' + PORT);
    console.log('');
    console.log('📋 דשבורד ניהול: https://<your-server>/admin');
    console.log('🔑 סיסמת מנהל: ' + (process.env.ADMIN_PASSWORD || '(לא מוגדר — הגדר ADMIN_PASSWORD)'));
    console.log('');
  });

  // === שלב 4: חיבור WhatsApp לכל הלקוחות הפעילים ===
  logger.info('מחבר לקוחות WhatsApp...');
  await whatsappManager.reconnectAllTenants(handleIncomingMessage);

  const connStats = whatsappManager.getConnectionStats();
  logger.info('WhatsApp: ' + connStats.connected + '/' + connStats.total + ' מחוברים');

  // === שלב 5: Cron Jobs ===

  // תזכורות — כל 15 דקות
  cron.schedule('*/15 * * * *', async () => {
    try {
      await runRemindersForAllTenants();
    } catch (err) {
      logger.error('שגיאה בתזכורות: ' + err.message);
    }
  });

  // סיכום יומי — כל יום ב-20:00
  cron.schedule('0 20 * * *', async () => {
    try {
      await runDailySummaryForAllTenants();
    } catch (err) {
      logger.error('שגיאה בסיכום יומי: ' + err.message);
    }
  }, { timezone: process.env.TIMEZONE || 'Asia/Jerusalem' });

  // גיבוי DB — כל יום ב-03:00
  cron.schedule('0 3 * * *', () => {
    backupDatabase();
  });

  console.log('');
  console.log('🤖 המערכת פעילה!');
  const stats = tenantManager.getTenantStats();
  console.log('   לקוחות: ' + stats.total + ' | פעילים: ' + stats.active + ' | ניסיון: ' + stats.trial);
  console.log('');
}

/**
 * תזכורות per-tenant
 */
async function runRemindersForAllTenants() {
  const tenants = tenantManager.getAllTenants().filter(t =>
    ['active', 'trial'].includes(t.subscription_status) &&
    t.whatsapp_status === 'connected' &&
    t.google_refresh_token
  );

  for (const tenant of tenants) {
    try {
      const { getEventsForDay } = require('./services/calendar');
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const events = await getEventsForDay(today, tenant);

      for (const event of events) {
        if (!event.start?.dateTime) continue;
        const eventStart = new Date(event.start.dateTime);
        const minutesUntil = (eventStart.getTime() - now.getTime()) / (1000 * 60);

        if (minutesUntil >= 45 && minutesUntil <= 75) {
          const time = eventStart.toLocaleTimeString('he-IL', {
            timeZone: process.env.TIMEZONE || 'Asia/Jerusalem',
            hour: '2-digit', minute: '2-digit',
          });
          await whatsappManager.sendToTenant(tenant.id,
            '⏰ תזכורת: ' + event.summary + ' בעוד שעה (' + time + ')'
          );
        }
      }
    } catch (err) {
      logger.error('תזכורת שגיאה tenant ' + tenant.id + ': ' + err.message);
    }
  }
}

/**
 * סיכום יומי per-tenant
 */
async function runDailySummaryForAllTenants() {
  const tenants = tenantManager.getAllTenants().filter(t =>
    ['active', 'trial'].includes(t.subscription_status) &&
    t.whatsapp_status === 'connected' &&
    t.google_refresh_token
  );

  for (const tenant of tenants) {
    try {
      const { getEventsForDay } = require('./services/calendar');
      const tz = process.env.TIMEZONE || 'Asia/Jerusalem';
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

      const todayEvents = await getEventsForDay(today, tenant);
      const tomorrowEvents = await getEventsForDay(tomorrow, tenant);

      let msg = '📋 *סיכום יומי*\n━━━━━━━━━━\n\n';

      msg += '📌 *היום:*\n';
      if (todayEvents.length === 0) {
        msg += '   אין אירועים.\n';
      } else {
        todayEvents.forEach(e => {
          const passed = e.end?.dateTime && new Date(e.end.dateTime) < now;
          const time = e.start?.dateTime
            ? new Date(e.start.dateTime).toLocaleTimeString('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
            : 'כל היום';
          msg += '   ' + (passed ? '✔️' : '🔵') + ' ' + time + ' – ' + e.summary + '\n';
        });
      }

      msg += '\n📅 *מחר:*\n';
      if (tomorrowEvents.length === 0) {
        msg += '   אין אירועים מתוכננים.\n';
      } else {
        tomorrowEvents.forEach(e => {
          const time = e.start?.dateTime
            ? new Date(e.start.dateTime).toLocaleTimeString('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
            : 'כל היום';
          msg += '   🔹 ' + time + ' – ' + e.summary + '\n';
        });
      }

      await whatsappManager.sendToTenant(tenant.id, msg);
    } catch (err) {
      logger.error('סיכום יומי שגיאה tenant ' + tenant.id + ': ' + err.message);
    }
  }
}

// Error handling
process.on('uncaughtException', (err) => {
  logger.error('שגיאה לא צפויה: ' + err.message + '\n' + err.stack);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Promise rejected: ' + reason);
});

main().catch((err) => {
  logger.error('שגיאה קריטית: ' + err.message);
  process.exit(1);
});
