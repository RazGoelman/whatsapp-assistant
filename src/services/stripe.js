const logger = require('./logger');
const db = require('../db');

let stripe = null;

/**
 * מאתחל את Stripe
 */
function initStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    logger.warn('STRIPE_SECRET_KEY לא מוגדר — תשלומים לא פעילים.');
    return;
  }
  stripe = require('stripe')(key);
  logger.info('Stripe מוכן.');
}

/**
 * יוצר Checkout Session למנוי חודשי
 * @param {object} options
 * @param {string} options.tenantName - שם הלקוח
 * @param {string} options.tenantPhone - מספר טלפון
 * @param {number} options.tenantId - מזהה ב-DB
 * @param {string} options.successUrl - URL לאחר תשלום מוצלח
 * @param {string} options.cancelUrl - URL לביטול
 * @returns {Promise<string>} - URL של דף התשלום
 */
async function createCheckoutSession({ tenantName, tenantPhone, tenantId, successUrl, cancelUrl }) {
  if (!stripe) throw new Error('Stripe לא מוגדר');

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) throw new Error('STRIPE_PRICE_ID לא מוגדר');

  // יצירת Customer ב-Stripe
  const customer = await stripe.customers.create({
    name: tenantName,
    phone: tenantPhone,
    metadata: { tenant_id: String(tenantId) },
  });

  // שמירת Customer ID ב-DB
  db.updateTenant(tenantId, { stripe_customer_id: customer.id });

  // יצירת Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenant_id: String(tenantId) },
    subscription_data: {
      metadata: { tenant_id: String(tenantId) },
    },
  });

  logger.info('Stripe Checkout נוצר ל-tenant ' + tenantId);
  return session.url;
}

/**
 * מעבד Webhook event מ-Stripe
 * @param {object} event - Stripe event
 */
async function handleWebhookEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const tenantId = parseInt(session.metadata.tenant_id, 10);
      if (!tenantId) break;

      db.updateTenant(tenantId, {
        stripe_subscription_id: session.subscription,
        subscription_status: 'active',
      });

      // רשומת billing ראשונה
      db.addBillingRecord({
        tenant_id: tenantId,
        stripe_invoice_id: session.invoice || 'checkout_' + session.id,
        amount_cents: session.amount_total || 0,
        currency: session.currency || 'usd',
        status: 'paid',
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        paid_at: new Date().toISOString(),
      });

      logger.info('מנוי הופעל: tenant ' + tenantId);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const tenantId = getTenantIdFromInvoice(invoice);
      if (!tenantId) break;

      db.updateTenant(tenantId, { subscription_status: 'active' });

      db.addBillingRecord({
        tenant_id: tenantId,
        stripe_invoice_id: invoice.id,
        amount_cents: invoice.amount_paid || 0,
        currency: invoice.currency || 'usd',
        status: 'paid',
        period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
        period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
        paid_at: new Date().toISOString(),
      });

      logger.info('חיוב שולם: tenant ' + tenantId);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const tenantId = getTenantIdFromInvoice(invoice);
      if (!tenantId) break;

      db.updateTenant(tenantId, { subscription_status: 'expired' });

      db.addBillingRecord({
        tenant_id: tenantId,
        stripe_invoice_id: invoice.id,
        amount_cents: invoice.amount_due || 0,
        currency: invoice.currency || 'usd',
        status: 'failed',
        period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
        period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
        paid_at: null,
      });

      logger.warn('חיוב נכשל: tenant ' + tenantId);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const tenantId = parseInt(subscription.metadata.tenant_id, 10);
      if (!tenantId) break;

      db.updateTenant(tenantId, { subscription_status: 'cancelled' });
      logger.info('מנוי בוטל: tenant ' + tenantId);
      break;
    }

    default:
      break;
  }
}

/**
 * מחלץ tenant_id מ-invoice
 */
function getTenantIdFromInvoice(invoice) {
  // מ-subscription metadata
  if (invoice.subscription_details?.metadata?.tenant_id) {
    return parseInt(invoice.subscription_details.metadata.tenant_id, 10);
  }
  // מ-customer metadata
  if (invoice.customer) {
    const tenants = db.getAllTenants();
    const tenant = tenants.find(t => t.stripe_customer_id === invoice.customer);
    if (tenant) return tenant.id;
  }
  return null;
}

/**
 * מאמת חתימת Webhook
 */
function constructWebhookEvent(rawBody, signature) {
  if (!stripe) throw new Error('Stripe לא מוגדר');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET לא מוגדר');
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

module.exports = { initStripe, createCheckoutSession, handleWebhookEvent, constructWebhookEvent };
