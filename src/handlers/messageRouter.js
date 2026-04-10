const tenantManager = require('../services/tenantManager');
const whatsappManager = require('../services/whatsappManager');
const { processMessage } = require('../services/ai');
const { transcribeVoiceMessage } = require('../services/transcription');
const { routeIntent } = require('./intentRouter');
const { extractAgentCommand } = require('./nameFilter');
const db = require('../db');
const logger = require('../services/logger');

/**
 * מטפל בהודעה נכנסת — מנתב ל-tenant הנכון
 * @param {number} tenantId - מזהה הלקוח (מ-WhatsApp Manager)
 * @param {object} message - אובייקט ההודעה מ-whatsapp-web.js
 */
async function handleIncomingMessage(tenantId, message) {
  const tenant = tenantManager.getTenantById(tenantId);
  if (!tenant) {
    logger.warn('הודעה ל-tenant לא קיים: ' + tenantId);
    return;
  }

  // 🔒 בדיקת מנוי פעיל
  if (!tenantManager.isSubscriptionActive(tenantId)) {
    try {
      await whatsappManager.sendMessage(tenantId, message.from,
        '⚠️ המנוי שלך לא פעיל. חדש את המנוי כדי להמשיך להשתמש בעוזר.'
      );
    } catch { /* silent */ }
    db.logUsage(tenantId, 'blocked_expired', 0, 'blocked', 'מנוי לא פעיל');
    return;
  }

  // מצב onboarding — בחירת שם
  if (!tenant.agent_name) {
    await handleOnboarding(tenantId, tenant, message);
    return;
  }

  try {
    let messageText = message.body || '';

    // תמלול קולי
    if (message.hasMedia && (message.type === 'ptt' || message.type === 'audio')) {
      const transcribed = await transcribeVoiceMessage(message, tenantId);
      if (!transcribed) return;
      messageText = transcribed;
      db.logUsage(tenantId, 'transcription', 0, 'success');
    }

    // בדיקת שם סוכן
    const command = extractAgentCommand(messageText, tenant.agent_name);
    if (!command) return;

    logger.info('[' + tenant.name + '] פקודה: "' + command + '"');

    // עיבוד AI בהקשר הלקוח
    const { intent, response, params } = await processMessage(command, tenant);
    logger.info('[' + tenant.name + '] כוונה: ' + intent);

    db.logUsage(tenantId, intent, 0, 'success');

    // ניתוב
    const reply = await routeIntent(intent, params, response, message, tenant);
    if (reply) {
      await whatsappManager.sendMessage(tenantId, message.from, reply);
    }
  } catch (err) {
    logger.error('[' + tenant.name + '] שגיאה: ' + err.message);
    db.logUsage(tenantId, 'error', 0, 'error', err.message);
    try {
      await whatsappManager.sendMessage(tenantId, message.from,
        '⚠️ משהו השתבש. נסה שוב בעוד רגע.'
      );
    } catch { /* silent */ }
  }
}

/**
 * Onboarding — בחירת שם לסוכן (per-tenant)
 */
async function handleOnboarding(tenantId, tenant, message) {
  const name = (message.body || '').trim();

  if (name.length < 2) {
    await whatsappManager.sendMessage(tenantId, message.from,
      'השם חייב להיות לפחות 2 תווים. נסה שוב 😊'
    );
    return;
  }

  tenantManager.updateTenant(tenantId, { agent_name: name }, 'onboarding');

  const msg = 'מעולה! מעכשיו שמי *' + name + '*.\n' +
    'שלח לי הודעה שמתחילה ב-*' + name + '* ואני כאן!\n\n' +
    'למשל:\n' +
    '• ' + name + ', תקבע לי פגישה מחר ב-10\n' +
    '• ' + name + ', מה יש לי ביומן מחר?\n' +
    '• ' + name + ', תנסח הודעה ליוסי\n\n' +
    'אפשר גם הקלטה קולית! 🎤';

  await whatsappManager.sendMessage(tenantId, message.from, msg);
  db.logUsage(tenantId, 'onboarding_complete', 0, 'success', 'שם: ' + name);
  logger.info('[' + tenant.name + '] שם סוכן נקבע: ' + name);
}

module.exports = { handleIncomingMessage };
