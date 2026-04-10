const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../services/logger');

// 🔒 DB file מחוץ ל-public — לא נגיש מהווב
const DB_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'app.db');
const BACKUP_DIR = path.resolve(__dirname, '../../data/backups');

// 🔒 מפתח הצפנה לשדות רגישים (AES-256)
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

let db = null;

// === הצפנה/פענוח ===

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

// === אתחול DB ===

function initDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations();
  logger.info('מסד נתונים מאותחל: ' + DB_PATH);

  // 🔒 אם אין מפתח הצפנה ב-.env — מדפיס אזהרה
  if (!process.env.DB_ENCRYPTION_KEY) {
    logger.warn('DB_ENCRYPTION_KEY לא מוגדר. נוצר מפתח זמני. הגדר ב-.env לקביעות!');
    logger.warn('מפתח: ' + ENCRYPTION_KEY);
  }

  return db;
}

// === Migrations ===

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      agent_name TEXT DEFAULT '',
      license_key TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_status TEXT DEFAULT 'trial',
      google_refresh_token TEXT,
      whatsapp_status TEXT DEFAULT 'disconnected',
      deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER,
      action_type TEXT NOT NULL,
      tokens_used INTEGER DEFAULT 0,
      status TEXT DEFAULT 'success',
      details TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      tenant_name TEXT,
      created_by TEXT DEFAULT 'admin',
      used INTEGER DEFAULT 0,
      used_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS billing_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      stripe_invoice_id TEXT,
      amount_cents INTEGER NOT NULL,
      currency TEXT DEFAULT 'usd',
      status TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT DEFAULT 'system',
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tenants_phone ON tenants(phone);
    CREATE INDEX IF NOT EXISTS idx_usage_tenant ON usage_logs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_billing_tenant ON billing_history(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
  `);
}

// === CRUD Functions ===

// --- Tenants ---

function createTenant({ name, phone, license_key, stripe_customer_id }) {
  const stmt = db.prepare(`
    INSERT INTO tenants (name, phone, license_key, stripe_customer_id)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(name, phone, encrypt(license_key), stripe_customer_id || null);
  logAudit('admin', 'create_tenant', 'tenant', result.lastInsertRowid, 'שם: ' + name);
  return result.lastInsertRowid;
}

function getTenantById(id) {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ? AND deleted = 0').get(id);
  if (tenant) decryptTenantFields(tenant);
  return tenant;
}

function getTenantByPhone(phone) {
  const cleaned = phone.replace(/[^0-9]/g, '');
  const tenant = db.prepare('SELECT * FROM tenants WHERE phone = ? AND deleted = 0').get(cleaned);
  if (tenant) decryptTenantFields(tenant);
  return tenant;
}

function getAllTenants() {
  const tenants = db.prepare('SELECT * FROM tenants WHERE deleted = 0 ORDER BY created_at DESC').all();
  tenants.forEach(t => decryptTenantFields(t));
  return tenants;
}

function updateTenant(id, data) {
  const fields = [];
  const values = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
  if (data.agent_name !== undefined) { fields.push('agent_name = ?'); values.push(data.agent_name); }
  if (data.license_key !== undefined) { fields.push('license_key = ?'); values.push(encrypt(data.license_key)); }
  if (data.stripe_customer_id !== undefined) { fields.push('stripe_customer_id = ?'); values.push(data.stripe_customer_id); }
  if (data.stripe_subscription_id !== undefined) { fields.push('stripe_subscription_id = ?'); values.push(data.stripe_subscription_id); }
  if (data.subscription_status !== undefined) { fields.push('subscription_status = ?'); values.push(data.subscription_status); }
  if (data.google_refresh_token !== undefined) { fields.push('google_refresh_token = ?'); values.push(encrypt(data.google_refresh_token)); }
  if (data.whatsapp_status !== undefined) { fields.push('whatsapp_status = ?'); values.push(data.whatsapp_status); }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const sql = 'UPDATE tenants SET ' + fields.join(', ') + ' WHERE id = ?';
  db.prepare(sql).run(...values);

  logAudit('admin', 'update_tenant', 'tenant', id, JSON.stringify(Object.keys(data)));
}

function softDeleteTenant(id) {
  db.prepare("UPDATE tenants SET deleted = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  logAudit('admin', 'delete_tenant', 'tenant', id, 'soft delete');
}

// --- Invitations ---

function createInvitation(tenantName) {
  const { v4: uuidv4 } = require('uuid');
  const token = uuidv4();
  db.prepare('INSERT INTO invitations (token, tenant_name) VALUES (?, ?)').run(token, tenantName);
  logAudit('admin', 'create_invitation', 'invitation', null, 'שם: ' + tenantName);
  return token;
}

function getInvitation(token) {
  return db.prepare('SELECT * FROM invitations WHERE token = ?').get(token);
}

function markInvitationUsed(token) {
  db.prepare("UPDATE invitations SET used = 1, used_at = datetime('now') WHERE token = ?").run(token);
}

// --- Billing History ---

function addBillingRecord({ tenant_id, stripe_invoice_id, amount_cents, currency, status, period_start, period_end, paid_at }) {
  db.prepare(`
    INSERT INTO billing_history (tenant_id, stripe_invoice_id, amount_cents, currency, status, period_start, period_end, paid_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tenant_id, stripe_invoice_id, amount_cents, currency || 'usd', status, period_start, period_end, paid_at);
}

function getBillingHistory(tenantId) {
  return db.prepare('SELECT * FROM billing_history WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId);
}

function getMonthlyRevenue() {
  const row = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) as total
    FROM billing_history 
    WHERE status = 'paid' 
    AND paid_at >= datetime('now', '-30 days')
  `).get();
  return row.total;
}

// --- Usage Logs ---

function logUsage(tenantId, actionType, tokensUsed, status, details) {
  db.prepare(`
    INSERT INTO usage_logs (tenant_id, action_type, tokens_used, status, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(tenantId, actionType, tokensUsed || 0, status || 'success', details || null);
}

function getUsageLogs(options = {}) {
  let sql = 'SELECT ul.*, t.name as tenant_name FROM usage_logs ul LEFT JOIN tenants t ON ul.tenant_id = t.id WHERE 1=1';
  const params = [];

  if (options.tenantId) { sql += ' AND ul.tenant_id = ?'; params.push(options.tenantId); }
  if (options.actionType) { sql += ' AND ul.action_type = ?'; params.push(options.actionType); }
  if (options.since) { sql += ' AND ul.timestamp >= ?'; params.push(options.since); }

  sql += ' ORDER BY ul.timestamp DESC LIMIT ?';
  params.push(options.limit || 1000);

  return db.prepare(sql).all(...params);
}

function getTenantUsageStats(tenantId) {
  const today = db.prepare("SELECT COUNT(*) as count FROM usage_logs WHERE tenant_id = ? AND timestamp >= date('now')").get(tenantId);
  const week = db.prepare("SELECT COUNT(*) as count FROM usage_logs WHERE tenant_id = ? AND timestamp >= date('now', '-7 days')").get(tenantId);
  const month = db.prepare("SELECT COUNT(*) as count FROM usage_logs WHERE tenant_id = ? AND timestamp >= date('now', '-30 days')").get(tenantId);
  return { today: today.count, week: week.count, month: month.count };
}

// --- Audit Log ---

function logAudit(actor, action, targetType, targetId, details) {
  db.prepare(`
    INSERT INTO audit_log (actor, action, target_type, target_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(actor, action, targetType || null, targetId || null, details || null);
}

// --- Backup ---

function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const backupPath = path.join(BACKUP_DIR, 'backup-' + timestamp + '.db');

  try {
    db.backup(backupPath);
    logger.info('גיבוי DB: ' + backupPath);

    // 🔒 שמירת 7 ימים אחרונים בלבד
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
      .sort()
      .reverse();

    files.slice(7).forEach(f => {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
    });
  } catch (err) {
    logger.error('שגיאה בגיבוי DB: ' + err.message);
  }
}

// --- Helpers ---

function decryptTenantFields(tenant) {
  if (tenant.license_key) tenant.license_key = decrypt(tenant.license_key);
  if (tenant.google_refresh_token) tenant.google_refresh_token = decrypt(tenant.google_refresh_token);
}

function getDb() { return db; }

module.exports = {
  initDatabase,
  getDb,
  // Tenants
  createTenant,
  getTenantById,
  getTenantByPhone,
  getAllTenants,
  updateTenant,
  softDeleteTenant,
  // Invitations
  createInvitation,
  getInvitation,
  markInvitationUsed,
  // Billing
  addBillingRecord,
  getBillingHistory,
  getMonthlyRevenue,
  // Usage
  logUsage,
  getUsageLogs,
  getTenantUsageStats,
  // Audit
  logAudit,
  // Backup
  backupDatabase,
  // Encryption (for external use)
  encrypt,
  decrypt,
};
