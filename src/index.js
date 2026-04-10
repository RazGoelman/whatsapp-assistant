const express = require('express');
const { config, isSetupComplete } = require('./config');
const { isLicensed } = require('./services/license');
const { initWhatsApp, sendMessage, onQr, onReady } = require('./services/whatsapp');
const { initAI, processMessage } = require('./services/ai');
const { initCalendar } = require('./services/calendar');
const { initTranscription, transcribeVoiceMessage } = require('./services/transcription');
const { startReminderScheduler } = require('./services/reminderScheduler');
const { startDailySummary } = require('./services/dailySummary');
const { extractAgentCommand } = require('./handlers/nameFilter');
const { routeIntent } = require('./handlers/intentRouter');
const { setupRouter, setQrData, setWhatsAppReady } = require('./web/setupServer');
const logger = require('./services/logger');

async function main() {
  console.log('');
  console.log('🤖 === מפעיל את העוזר האישי ===');
  console.log('');

  // === שלב 0: בדיקת רישיון ===
  // שרת Express עולה תמיד כדי לאפשר הזנת רישיון בדף Setup
  const app = express();
  app.use('/setup', setupRouter);
  app.get('/', (req, res) => {
    res.redirect('/setup/login');
  });

  app.listen(config.port, () => {
    console.log('🌐 דף ההגדרה זמין:');
    console.log('   https://<your-server>/setup/login');
    console.log('');
    console.log('🔑 סיסמת כניסה: ' + config.setupPassword);
    console.log('');
  });

  // ממתין לרישיון תקין
  if (!isLicensed()) {
    console.log('');
    console.log('🔐 נדרש מפתח רישיון.');
    console.log('   הזן את המפתח בדף ה-Setup בדפדפן.');
    console.log('');
    await waitForLicense();
  }

  logger.info('✅ רישיון תקין.');

  // === שלב 1: ממתין ל-setup אם צריך ===
  if (!isSetupComplete()) {
    logger.warn('ההגדרה טרם הושלמה – ממתין למילוי דרך דף ה-Setup.');
    await waitForSetup();
  }

  // === שלב 3: אתחול שירותים ===
  logger.info('מאתחל שירותים...');
  initAI();
  initCalendar();
  initTranscription();

  // === שלב 4: WhatsApp + גשר לדף הווב ===
  onQr((dataUrl) => setQrData(dataUrl));
  onReady((ready) => setWhatsAppReady(ready));

  await initWhatsApp(async (message) => {
    try {
      let messageText = message.body || '';

      // תמלול קולי
      if (message.hasMedia && (message.type === 'ptt' || message.type === 'audio')) {
        const transcribed = await transcribeVoiceMessage(message);
        if (!transcribed) return;
        messageText = transcribed;
      }

      // פילטר שם
      const command = extractAgentCommand(messageText);
      if (!command) return;

      logger.info('פקודה: "' + command + '"');

      // AI
      const { intent, response, params } = await processMessage(command);
      logger.info('כוונה: ' + intent);

      // Router
      const reply = await routeIntent(intent, params, response, message);
      if (reply) await sendMessage(message.from, reply);
    } catch (err) {
      logger.error('שגיאה בעיבוד: ' + err.message + '\n' + err.stack);
      try {
        // 🔒 לא חושפים פרטי שגיאה פנימיים למשתמש
        await sendMessage(message.from, '⚠️ משהו השתבש. נסה שוב בעוד רגע.');
      } catch { /* silent */ }
    }
  });

  // === שלב 5: Cron jobs ===
  startReminderScheduler();
  startDailySummary();

  console.log('');
  if (config.agentName) {
    console.log('🤖 ' + config.agentName + ' מוכן!');
  } else {
    console.log('🤖 ממתין לבחירת שם דרך WhatsApp...');
  }
  console.log('');
}

function waitForSetup() {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (isSetupComplete()) {
        clearInterval(check);
        logger.info('ההגדרה הושלמה!');
        resolve();
      }
    }, 5000);
  });
}

function waitForLicense() {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (isLicensed()) {
        clearInterval(check);
        resolve();
      }
    }, 5000);
  });
}

process.on('uncaughtException', (err) => {
  logger.error('שגיאה לא צפויה: ' + err.message);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Promise rejected: ' + reason);
});

main().catch((err) => {
  logger.error('שגיאה קריטית: ' + err.message);
  process.exit(1);
});
