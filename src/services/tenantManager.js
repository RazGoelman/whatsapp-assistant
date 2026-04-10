const db = require('../db');
const logger = require('./logger');

/**
 * 🔒 Tenant Manager — ניהול לקוחות
 * כל פעולת כתיבה מתועדת ב-audit log.
 * גישה רק מקוד פנימי — אין endpoint ציבורי ישיר.
 */

function getTenantByPhone(phone) {
  return db.getTenantByPhone(phone);
}

function getTenantById(id) {
  return db.getTenantById(id);
}

function getAllTenants() {
  return db.getAllTenants();
}

function createTenant({ name, phone, license_key, stripe_customer_id }) {
  // וולידציה
  if (!name || name.length < 2) throw new Error('שם חייב להיות לפחות 2 תווים');
  if (!phone || !/^[0-9]{10,15}$/.test(phone.replace(/[^0-9]/g, ''))) {
    throw new Error('מספר טלפון לא תקין');
  }

  // בדיקת כפילות
  const existing = db.getTenantByPhone(phone);
  if (existing) throw new Error('מספר טלפון כבר רשום במערכת');

  const id = db.createTenant({
    name,
    phone: phone.replace(/[^0-9]/g, ''),
    license_key,
    stripe_customer_id,
  });

  logger.info('לקוח חדש נוצר: ' + name + ' (ID: ' + id + ')');
  return id;
}

function updateTenant(id, data, actor) {
  const tenant = db.getTenantById(id);
  if (!tenant) throw new Error('לקוח לא נמצא');

  db.updateTenant(id, data);
  db.logAudit(actor || 'admin', 'update_tenant', 'tenant', id, JSON.stringify(data));
  logger.info('לקוח עודכן: ' + tenant.name + ' (ID: ' + id + ')');
}

function deleteTenant(id, actor) {
  const tenant = db.getTenantById(id);
  if (!tenant) throw new Error('לקוח לא נמצא');

  db.softDeleteTenant(id);
  db.logAudit(actor || 'admin', 'delete_tenant', 'tenant', id, 'שם: ' + tenant.name);
  logger.info('לקוח נמחק (soft): ' + tenant.name + ' (ID: ' + id + ')');
}

function isSubscriptionActive(tenantId) {
  const tenant = db.getTenantById(tenantId);
  if (!tenant) return false;
  return ['active', 'trial'].includes(tenant.subscription_status);
}

function getActiveTenantsCount() {
  const tenants = db.getAllTenants();
  return tenants.filter(t => ['active', 'trial'].includes(t.subscription_status)).length;
}

function getTenantStats() {
  const tenants = db.getAllTenants();
  return {
    total: tenants.length,
    active: tenants.filter(t => t.subscription_status === 'active').length,
    trial: tenants.filter(t => t.subscription_status === 'trial').length,
    expired: tenants.filter(t => t.subscription_status === 'expired').length,
    cancelled: tenants.filter(t => t.subscription_status === 'cancelled').length,
    whatsappConnected: tenants.filter(t => t.whatsapp_status === 'connected').length,
  };
}

module.exports = {
  getTenantByPhone,
  getTenantById,
  getAllTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  isSubscriptionActive,
  getActiveTenantsCount,
  getTenantStats,
};
