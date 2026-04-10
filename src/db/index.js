const initSqlJs = require('sql.js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'app.db');
const BACKUP_DIR = path.resolve(__dirname, '../../data/backups');
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

let db = null;

// === Encryption ===
function encrypt(text) {
  if (!text) return null;
  const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  return iv.toString('hex') + ':' + enc;
}

function decrypt(text) {
  if (!text) return null;
  try {
    const [ivHex, enc] = text.split(':');
    const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ivHex, 'hex'), key);
    let dec = decipher.update(enc, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch { return null; }
}

// === Init ===
async function initDatabase() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  runMigrations();
  saveDb();

  if (!process.env.DB_ENCRYPTION_KEY) {
    console.log('[DB] ⚠️ DB_ENCRYPTION_KEY not set. Using temp key: ' + ENCRYPTION_KEY);
  }
  console.log('[DB] ✅ Database ready: ' + DB_PATH);
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function runMigrations() {
  db.run(`
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
      timestamp TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now'))
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
  `);
}

// === Helpers ===
function queryOne(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
  stmt.free(); return null;
}

function queryAll(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free(); return rows;
}

function runSql(sql, params) {
  if (params) { const stmt = db.prepare(sql); stmt.bind(params); stmt.step(); stmt.free(); }
  else db.run(sql);
  saveDb();
}

// === Tenants ===
function createTenant({ name, phone, license_key, stripe_customer_id }) {
  runSql('INSERT INTO tenants (name, phone, license_key, stripe_customer_id) VALUES (?,?,?,?)',
    [name, phone, encrypt(license_key), stripe_customer_id || null]);
  const row = queryOne("SELECT last_insert_rowid() as id");
  const id = row.id;
  logAudit('admin', 'create_tenant', 'tenant', id, 'name: ' + name);
  return id;
}

function getTenantById(id) {
  const t = queryOne('SELECT * FROM tenants WHERE id = ? AND deleted = 0', [id]);
  if (t) decryptFields(t);
  return t;
}

function getTenantByPhone(phone) {
  const cleaned = phone.replace(/[^0-9]/g, '');
  const t = queryOne('SELECT * FROM tenants WHERE phone = ? AND deleted = 0', [cleaned]);
  if (t) decryptFields(t);
  return t;
}

function getAllTenants() {
  const rows = queryAll('SELECT * FROM tenants WHERE deleted = 0 ORDER BY created_at DESC');
  rows.forEach(t => decryptFields(t));
  return rows;
}

function updateTenant(id, data) {
  const fields = []; const vals = [];
  if (data.name !== undefined) { fields.push('name=?'); vals.push(data.name); }
  if (data.phone !== undefined) { fields.push('phone=?'); vals.push(data.phone); }
  if (data.agent_name !== undefined) { fields.push('agent_name=?'); vals.push(data.agent_name); }
  if (data.license_key !== undefined) { fields.push('license_key=?'); vals.push(encrypt(data.license_key)); }
  if (data.stripe_customer_id !== undefined) { fields.push('stripe_customer_id=?'); vals.push(data.stripe_customer_id); }
  if (data.stripe_subscription_id !== undefined) { fields.push('stripe_subscription_id=?'); vals.push(data.stripe_subscription_id); }
  if (data.subscription_status !== undefined) { fields.push('subscription_status=?'); vals.push(data.subscription_status); }
  if (data.google_refresh_token !== undefined) { fields.push('google_refresh_token=?'); vals.push(encrypt(data.google_refresh_token)); }
  if (data.whatsapp_status !== undefined) { fields.push('whatsapp_status=?'); vals.push(data.whatsapp_status); }
  if (fields.length === 0) return;
  fields.push("updated_at=datetime('now')");
  vals.push(id);
  runSql('UPDATE tenants SET ' + fields.join(',') + ' WHERE id=?', vals);
}

function softDeleteTenant(id) {
  runSql("UPDATE tenants SET deleted=1, updated_at=datetime('now') WHERE id=?", [id]);
  logAudit('admin', 'delete_tenant', 'tenant', id, 'soft delete');
}

// === Invitations ===
function createInvitation(tenantName) {
  const { v4: uuidv4 } = require('uuid');
  const token = uuidv4();
  runSql('INSERT INTO invitations (token, tenant_name) VALUES (?,?)', [token, tenantName]);
  logAudit('admin', 'create_invitation', 'invitation', null, tenantName);
  return token;
}

function getInvitation(token) { return queryOne('SELECT * FROM invitations WHERE token=?', [token]); }
function markInvitationUsed(token) { runSql("UPDATE invitations SET used=1, used_at=datetime('now') WHERE token=?", [token]); }

// === Billing ===
function addBillingRecord({ tenant_id, stripe_invoice_id, amount_cents, currency, status, period_start, period_end, paid_at }) {
  runSql('INSERT INTO billing_history (tenant_id,stripe_invoice_id,amount_cents,currency,status,period_start,period_end,paid_at) VALUES (?,?,?,?,?,?,?,?)',
    [tenant_id, stripe_invoice_id, amount_cents, currency || 'usd', status, period_start, period_end, paid_at]);
}

function getBillingHistory(tenantId) {
  return queryAll('SELECT * FROM billing_history WHERE tenant_id=? ORDER BY created_at DESC', [tenantId]);
}

function getMonthlyRevenue() {
  const row = queryOne("SELECT COALESCE(SUM(amount_cents),0) as total FROM billing_history WHERE status='paid' AND paid_at >= datetime('now','-30 days')");
  return row ? row.total : 0;
}

// === Usage Logs ===
function logUsage(tenantId, actionType, tokensUsed, status, details) {
  runSql('INSERT INTO usage_logs (tenant_id,action_type,tokens_used,status,details) VALUES (?,?,?,?,?)',
    [tenantId, actionType, tokensUsed || 0, status || 'success', details || null]);
}

function getUsageLogs(options = {}) {
  let sql = 'SELECT ul.*, t.name as tenant_name FROM usage_logs ul LEFT JOIN tenants t ON ul.tenant_id=t.id WHERE 1=1';
  const params = [];
  if (options.tenantId) { sql += ' AND ul.tenant_id=?'; params.push(options.tenantId); }
  if (options.actionType) { sql += ' AND ul.action_type=?'; params.push(options.actionType); }
  sql += ' ORDER BY ul.timestamp DESC LIMIT ?';
  params.push(options.limit || 500);
  return queryAll(sql, params);
}

function getTenantUsageStats(tenantId) {
  const today = queryOne("SELECT COUNT(*) as count FROM usage_logs WHERE tenant_id=? AND timestamp>=date('now')", [tenantId]);
  const week = queryOne("SELECT COUNT(*) as count FROM usage_logs WHERE tenant_id=? AND timestamp>=date('now','-7 days')", [tenantId]);
  const month = queryOne("SELECT COUNT(*) as count FROM usage_logs WHERE tenant_id=? AND timestamp>=date('now','-30 days')", [tenantId]);
  return { today: today?.count || 0, week: week?.count || 0, month: month?.count || 0 };
}

// === Audit ===
function logAudit(actor, action, targetType, targetId, details) {
  runSql('INSERT INTO audit_log (actor,action,target_type,target_id,details) VALUES (?,?,?,?,?)',
    [actor, action, targetType, targetId, details]);
}

// === Backup ===
function backupDatabase() {
  if (!db) return;
  const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const bkPath = path.join(BACKUP_DIR, 'backup-' + ts + '.db');
  try {
    fs.writeFileSync(bkPath, Buffer.from(db.export()));
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('backup-')).sort().reverse();
    files.slice(7).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
    console.log('[DB] Backup: ' + bkPath);
  } catch (err) { console.error('[DB] Backup error: ' + err.message); }
}

function decryptFields(t) {
  if (t.license_key) t.license_key = decrypt(t.license_key);
  if (t.google_refresh_token) t.google_refresh_token = decrypt(t.google_refresh_token);
}

function getDb() { return db; }

module.exports = {
  initDatabase, getDb, saveDb,
  createTenant, getTenantById, getTenantByPhone, getAllTenants, updateTenant, softDeleteTenant,
  createInvitation, getInvitation, markInvitationUsed,
  addBillingRecord, getBillingHistory, getMonthlyRevenue,
  logUsage, getUsageLogs, getTenantUsageStats,
  logAudit, backupDatabase, encrypt, decrypt,
};
