const db = require('../src/db');

async function seed() {
  await db.initDatabase();

  // לקוחות
  const t1 = db.createTenant({ name: 'יוסי כהן', phone: '972501234567' });
  const t2 = db.createTenant({ name: 'מיכל לוי', phone: '972521234567' });
  const t3 = db.createTenant({ name: 'דוד אברהם', phone: '972531234567' });
  const t4 = db.createTenant({ name: 'שרה גולד', phone: '972541234567' });

  db.updateTenant(t1, { agent_name: 'ג׳ארביס', subscription_status: 'active', whatsapp_status: 'connected' });
  db.updateTenant(t2, { agent_name: 'אלכסה', subscription_status: 'active', whatsapp_status: 'connected' });
  db.updateTenant(t3, { subscription_status: 'trial', whatsapp_status: 'disconnected' });
  db.updateTenant(t4, { agent_name: 'סירי', subscription_status: 'expired', whatsapp_status: 'disconnected' });

  // billing
  db.addBillingRecord({ tenant_id: t1, stripe_invoice_id: 'inv_001', amount_cents: 7900, currency: 'usd', status: 'paid', period_start: '2026-03-10', period_end: '2026-04-10', paid_at: '2026-03-10' });
  db.addBillingRecord({ tenant_id: t1, stripe_invoice_id: 'inv_002', amount_cents: 7900, currency: 'usd', status: 'paid', period_start: '2026-02-10', period_end: '2026-03-10', paid_at: '2026-02-10' });
  db.addBillingRecord({ tenant_id: t2, stripe_invoice_id: 'inv_003', amount_cents: 7900, currency: 'usd', status: 'paid', period_start: '2026-03-15', period_end: '2026-04-15', paid_at: '2026-03-15' });
  db.addBillingRecord({ tenant_id: t2, stripe_invoice_id: 'inv_004', amount_cents: 7900, currency: 'usd', status: 'failed', period_start: '2026-02-15', period_end: '2026-03-15', paid_at: null });
  db.addBillingRecord({ tenant_id: t4, stripe_invoice_id: 'inv_005', amount_cents: 7900, currency: 'usd', status: 'failed', period_start: '2026-03-20', period_end: '2026-04-20', paid_at: null });

  // usage
  const actions = ['create_event', 'update_event', 'delete_event', 'create_meeting', 'compose_message', 'transcription'];
  for (let i = 0; i < 25; i++) db.logUsage(t1, actions[i % actions.length], Math.floor(Math.random() * 500), 'success');
  for (let i = 0; i < 15; i++) db.logUsage(t2, actions[i % actions.length], Math.floor(Math.random() * 300), i === 3 ? 'error' : 'success');
  db.logUsage(t3, 'blocked_expired', 0, 'blocked', 'trial');
  db.logUsage(t4, 'blocked_expired', 0, 'blocked', 'expired');

  // invitation
  db.createInvitation('רון גולדמן');

  console.log('✅ Seed complete: 4 tenants, billing, usage, invitation');
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
