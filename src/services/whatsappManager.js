const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const db = require('../db');
const tenantManager = require('./tenantManager');
const logger = require('./logger');

const MAX_TENANTS = parseInt(process.env.MAX_TENANTS, 10) || 10;

// מאגר חיבורים פעילים: tenantId → { client, isReady, qrDataUrl }
const connections = new Map();

/**
 * מחבר WhatsApp ללקוח ספציפי
 * @param {number} tenantId
 * @param {Function} onMessage - callback להודעות נכנסות
 * @returns {Promise<void>}
 */
async function connectTenant(tenantId, onMessage) {
  if (connections.size >= MAX_TENANTS) {
    throw new Error('מקסימום חיבורים: ' + MAX_TENANTS);
  }

  if (connections.has(tenantId)) {
    logger.warn('Tenant ' + tenantId + ' כבר מחובר');
    return;
  }

  const tenant = tenantManager.getTenantById(tenantId);
  if (!tenant) throw new Error('לקוח לא נמצא: ' + tenantId);

  const conn = { client: null, isReady: false, qrDataUrl: null };
  connections.set(tenantId, conn);

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: 'tenant_' + tenantId,
      dataPath: '.wwebjs_auth',
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

  conn.client = client;

  // QR
  client.on('qr', async (qr) => {
    logger.info('QR עבור tenant ' + tenantId);
    try {
      conn.qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
    } catch (err) {
      logger.error('שגיאה ביצירת QR: ' + err.message);
    }
  });

  // מחובר
  client.on('ready', () => {
    conn.isReady = true;
    conn.qrDataUrl = null;
    db.updateTenant(tenantId, { whatsapp_status: 'connected' });
    logger.info('WhatsApp מחובר: tenant ' + tenantId + ' (' + tenant.name + ')');
  });

  // ניתוק
  client.on('disconnected', (reason) => {
    conn.isReady = false;
    db.updateTenant(tenantId, { whatsapp_status: 'disconnected' });
    logger.warn('WhatsApp נותק: tenant ' + tenantId + ' - ' + reason);
  });

  client.on('authenticated', () => {
    logger.info('WhatsApp authenticated: tenant ' + tenantId);
  });

  client.on('auth_failure', (msg) => {
    logger.error('WhatsApp auth failed: tenant ' + tenantId + ' - ' + msg);
  });

  // הודעות נכנסות
  client.on('message', async (message) => {
    if (message.fromMe) return;
    if (onMessage) {
      try {
        await onMessage(tenantId, message);
      } catch (err) {
        logger.error('שגיאה בעיבוד הודעה (tenant ' + tenantId + '): ' + err.message);
      }
    }
  });

  logger.info('מתחבר ל-WhatsApp: tenant ' + tenantId + '...');
  await client.initialize();
}

/**
 * מנתק WhatsApp של לקוח
 */
async function disconnectTenant(tenantId) {
  const conn = connections.get(tenantId);
  if (!conn || !conn.client) return;

  try {
    await conn.client.destroy();
  } catch { /* silent */ }

  connections.delete(tenantId);
  db.updateTenant(tenantId, { whatsapp_status: 'disconnected' });
  logger.info('WhatsApp נותק: tenant ' + tenantId);
}

/**
 * שולח הודעה ללקוח
 */
async function sendToTenant(tenantId, text) {
  const conn = connections.get(tenantId);
  if (!conn || !conn.isReady) {
    throw new Error('WhatsApp לא מחובר ל-tenant ' + tenantId);
  }

  const tenant = tenantManager.getTenantById(tenantId);
  if (!tenant) throw new Error('לקוח לא נמצא');

  const chatId = tenant.phone + '@c.us';
  await conn.client.sendMessage(chatId, text);
}

/**
 * שולח הודעה למספר ספציפי דרך חיבור של tenant
 */
async function sendMessage(tenantId, to, text) {
  const conn = connections.get(tenantId);
  if (!conn || !conn.isReady) {
    throw new Error('WhatsApp לא מחובר');
  }
  await conn.client.sendMessage(to, text);
}

/**
 * מחזיר QR Data URL ללקוח (לדף ה-onboarding)
 */
function getQrForTenant(tenantId) {
  const conn = connections.get(tenantId);
  return conn ? conn.qrDataUrl : null;
}

/**
 * האם הלקוח מחובר?
 */
function isTenantConnected(tenantId) {
  const conn = connections.get(tenantId);
  return conn ? conn.isReady : false;
}

/**
 * מחבר מחדש את כל הלקוחות עם session קיים בהפעלת השרת
 */
async function reconnectAllTenants(onMessage) {
  const tenants = tenantManager.getAllTenants();
  const active = tenants.filter(t =>
    ['active', 'trial'].includes(t.subscription_status) &&
    t.whatsapp_status === 'connected'
  );

  logger.info('מחבר מחדש ' + active.length + ' לקוחות...');

  for (const tenant of active) {
    try {
      await connectTenant(tenant.id, onMessage);
    } catch (err) {
      logger.error('שגיאה בחיבור מחדש tenant ' + tenant.id + ': ' + err.message);
    }
  }
}

/**
 * מחזיר סטטיסטיקות חיבורים
 */
function getConnectionStats() {
  return {
    connected: Array.from(connections.values()).filter(c => c.isReady).length,
    total: connections.size,
    max: MAX_TENANTS,
  };
}

module.exports = {
  connectTenant,
  disconnectTenant,
  sendToTenant,
  sendMessage,
  getQrForTenant,
  isTenantConnected,
  reconnectAllTenants,
  getConnectionStats,
};
