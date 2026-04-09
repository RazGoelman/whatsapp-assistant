const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const { config, saveToEnv } = require('../config');
const logger = require('./logger');

let client = null;
let isReady = false;
let onQrCallback = null;
let onReadyCallback = null;

/**
 * מאתחל ומחבר את הלקוח ל-WhatsApp
 * @param {Function} onMessage - callback שמופעל על כל הודעה נכנסת
 */
async function initWhatsApp(onMessage) {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  // QR code – ממיר לתמונה Data URL לדף הווב
  client.on('qr', async (qr) => {
    logger.info('QR code חדש – ממתין לסריקה.');
    try {
      const dataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
      if (onQrCallback) onQrCallback(dataUrl);
    } catch (err) {
      logger.error('שגיאה ביצירת QR image: ' + err.message);
    }
  });

  // חיבור מוצלח
  client.on('ready', async () => {
    isReady = true;
    logger.info('WhatsApp מחובר בהצלחה!');
    if (onReadyCallback) onReadyCallback(true);

    // אם אין שם לסוכן – מפעיל onboarding
    if (!config.agentName && config.userPhoneNumber) {
      config.isOnboarding = true;
      try {
        await sendToUser(config.userPhoneNumber,
          '👋 היי! אני העוזר האישי החדש שלך.\n\nאיך תרצה לקרוא לי?'
        );
        logger.info('הודעת onboarding נשלחה.');
      } catch (err) {
        logger.error('שגיאה בשליחת onboarding: ' + err.message);
      }
    }
  });

  client.on('disconnected', (reason) => {
    isReady = false;
    logger.warn('WhatsApp התנתק: ' + reason);
    if (onReadyCallback) onReadyCallback(false);
  });

  client.on('authenticated', () => {
    logger.info('אימות WhatsApp הצליח – Session נשמר.');
  });

  client.on('auth_failure', (msg) => {
    logger.error('אימות WhatsApp נכשל: ' + msg);
  });

  // האזנה להודעות
  client.on('message', async (message) => {
    if (message.fromMe) return;

    // מצב onboarding – בחירת שם
    if (config.isOnboarding) {
      await handleOnboarding(message);
      return;
    }

    logger.info('הודעה מ-' + message.from + ': ' + (message.body || '[מדיה]'));

    if (onMessage) {
      try {
        await onMessage(message);
      } catch (err) {
        logger.error('שגיאה בעיבוד הודעה: ' + err.message);
      }
    }
  });

  logger.info('מתחבר ל-WhatsApp...');
  await client.initialize();
}

/**
 * Onboarding – בחירת שם לסוכן דרך WhatsApp
 */
async function handleOnboarding(message) {
  const name = (message.body || '').trim();

  if (name.length < 2) {
    await sendMessage(message.from, 'השם חייב להיות לפחות 2 תווים. נסה שוב 😊');
    return;
  }

  saveToEnv('AGENT_NAME', name);
  config.agentName = name;
  config.isOnboarding = false;

  const msg = `מעולה! מעכשיו שמי *${name}*.\n` +
    `שלח לי הודעה שמתחילה ב-*${name}* ואני כאן!\n\n` +
    `למשל:\n` +
    `• ${name}, תקבע לי פגישה מחר ב-10\n` +
    `• ${name}, מה יש לי ביומן מחר?\n` +
    `• ${name}, תנסח הודעה ליוסי\n\n` +
    `אפשר גם לשלוח הקלטה קולית! 🎤`;

  await sendMessage(message.from, msg);
  logger.info('שם הסוכן נקבע ל-"' + name + '" דרך onboarding.');
}

async function sendMessage(to, text) {
  if (!client || !isReady) throw new Error('WhatsApp לא מחובר');
  await client.sendMessage(to, text);
}

async function sendToUser(phoneNumber, text) {
  const chatId = phoneNumber.includes('@') ? phoneNumber : phoneNumber + '@c.us';
  await sendMessage(chatId, text);
}

function onQr(callback) { onQrCallback = callback; }
function onReady(callback) { onReadyCallback = callback; }
function getClient() { return client; }
function isConnected() { return isReady; }

module.exports = {
  initWhatsApp, sendMessage, sendToUser,
  getClient, isConnected, onQr, onReady,
};
