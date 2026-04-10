const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const tenantManager = require('../services/tenantManager');
const whatsappManager = require('../services/whatsappManager');
const logger = require('../services/logger');

const router = express.Router();
const SESSION_TOKEN = crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE = 'admin_session';

// === Security ===
router.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

function requireAdmin(req, res, next) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k && v) cookies[k] = v;
  });
  if (cookies[SESSION_COOKIE] === SESSION_TOKEN) return next();
  res.redirect('/admin/login');
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function adminPage(title, body) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #0a1628; color: #e0e0e0; padding: 16px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.4rem; color: #25D366; margin-bottom: 16px; }
    h2 { font-size: 1.1rem; color: #fff; margin: 16px 0 8px; }
    nav { margin-bottom: 20px; padding: 12px; background: #1a2a44; border-radius: 10px; }
    nav a { color: #25D366; text-decoration: none; margin-left: 16px; font-size: 0.9rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 16px 0; }
    .stat { background: #1a2a44; border-radius: 10px; padding: 14px; text-align: center; }
    .stat-num { font-size: 1.8rem; font-weight: 700; color: #25D366; }
    .stat-label { font-size: 0.8rem; color: #888; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 0.85rem; }
    th { text-align: right; padding: 10px 8px; background: #1a2a44; color: #888; font-weight: 600; }
    td { padding: 10px 8px; border-bottom: 1px solid #1a2a44; }
    tr:hover td { background: rgba(37,211,102,0.05); }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; }
    .badge-green { background: #0d3320; color: #25D366; }
    .badge-yellow { background: #3d3511; color: #f0c040; }
    .badge-red { background: #3d1111; color: #e74c3c; }
    .badge-gray { background: #2a2a2a; color: #888; }
    .btn { display: inline-block; padding: 10px 16px; background: #25D366; color: #fff; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; text-decoration: none; margin: 4px; }
    .btn-sm { padding: 6px 12px; font-size: 0.8rem; }
    .btn-danger { background: #e74c3c; }
    .btn-secondary { background: #2a3f5f; }
    input[type="text"], input[type="password"] { width: 100%; padding: 12px; border: 1px solid #333; border-radius: 8px; background: #1a2a44; color: #fff; font-size: 16px; }
    .card { background: #1a2a44; border-radius: 12px; padding: 16px; margin: 12px 0; }
    .filter { display: flex; gap: 8px; margin: 12px 0; flex-wrap: wrap; }
    .filter select { padding: 8px; border-radius: 8px; background: #1a2a44; color: #fff; border: 1px solid #333; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="container">
    <nav>
      🤖 <a href="/admin">דשבורד</a>
      <a href="/admin/logs">לוגים</a>
      <a href="/admin/invite">הזמנה חדשה</a>
    </nav>
    ${body}
  </div>
</body>
</html>`;
}

// === Login ===
router.get('/login', (req, res) => {
  res.send(adminPage('כניסה', `
    <h1>🔒 כניסה לדשבורד</h1>
    <form method="POST" action="/admin/login">
      <input type="password" name="password" placeholder="סיסמת מנהל" required autofocus>
      <button type="submit" class="btn" style="width:100%;margin-top:12px">כניסה</button>
    </form>
  `));
});

router.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    res.setHeader('Set-Cookie', SESSION_COOKIE + '=' + SESSION_TOKEN + '; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=86400');
    return res.redirect('/admin');
  }
  res.status(401).send(adminPage('שגיאה', '<div style="background:#3d1111;padding:16px;border-radius:10px">סיסמה שגויה.</div><a href="/admin/login" class="btn" style="margin-top:12px">חזור</a>'));
});

// === US-008: דשבורד ראשי ===
router.get('/', requireAdmin, (req, res) => {
  const stats = tenantManager.getTenantStats();
  const tenants = tenantManager.getAllTenants();
  const connStats = whatsappManager.getConnectionStats();
  const monthlyRevenue = db.getMonthlyRevenue();

  const statusBadge = (s) => {
    if (s === 'active') return '<span class="badge badge-green">פעיל</span>';
    if (s === 'trial') return '<span class="badge badge-yellow">ניסיון</span>';
    if (s === 'expired') return '<span class="badge badge-red">פג</span>';
    return '<span class="badge badge-gray">' + esc(s) + '</span>';
  };
  const waBadge = (s) => s === 'connected' ? '🟢' : '🔴';

  res.send(adminPage('דשבורד', `
    <h1>🤖 דשבורד ניהול</h1>

    <div class="stats">
      <div class="stat"><div class="stat-num">${stats.total}</div><div class="stat-label">לקוחות</div></div>
      <div class="stat"><div class="stat-num">${stats.active}</div><div class="stat-label">פעילים</div></div>
      <div class="stat"><div class="stat-num">${connStats.connected}/${connStats.max}</div><div class="stat-label">WA מחובר</div></div>
      <div class="stat"><div class="stat-num">$${(monthlyRevenue / 100).toFixed(0)}</div><div class="stat-label">הכנסה/חודש</div></div>
    </div>

    <a href="/admin/invite" class="btn">+ צור הזמנה חדשה</a>

    <h2>לקוחות</h2>
    <table>
      <tr><th>שם</th><th>טלפון</th><th>סוכן</th><th>WA</th><th>מנוי</th><th>הצטרף</th><th></th></tr>
      ${tenants.map(t => `
        <tr>
          <td><a href="/admin/tenant/${t.id}" style="color:#25D366">${esc(t.name)}</a></td>
          <td style="font-size:0.8rem">${esc(t.phone)}</td>
          <td>${esc(t.agent_name) || '-'}</td>
          <td>${waBadge(t.whatsapp_status)}</td>
          <td>${statusBadge(t.subscription_status)}</td>
          <td style="font-size:0.8rem">${t.created_at ? t.created_at.substring(0, 10) : ''}</td>
          <td><a href="/admin/tenant/${t.id}" class="btn btn-sm btn-secondary">פרטים</a></td>
        </tr>
      `).join('')}
    </table>
    ${tenants.length === 0 ? '<p style="color:#666;text-align:center">אין לקוחות עדיין. צור הזמנה חדשה.</p>' : ''}
  `));
});

// === יצירת הזמנה ===
router.get('/invite', requireAdmin, (req, res) => {
  res.send(adminPage('הזמנה חדשה', `
    <h1>📨 צור הזמנה חדשה</h1>
    <form method="POST" action="/admin/invite">
      <label>שם הלקוח</label>
      <input type="text" name="name" placeholder="ישראל ישראלי" required>
      <button type="submit" class="btn" style="width:100%;margin-top:16px">צור לינק הזמנה</button>
    </form>

    <h2 style="margin-top:30px">או: הוסף לקוח ישירות (Trial)</h2>
    <p style="color:#888;font-size:0.85rem">בלי Stripe — מוסיף לקוח במצב ניסיון</p>
    <form method="POST" action="/admin/add-tenant">
      <label>שם מלא</label>
      <input type="text" name="name" placeholder="ישראל ישראלי" required>
      <label>מספר טלפון (WhatsApp)</label>
      <div style="display:flex;gap:8px">
        <select name="country_code" style="width:140px;padding:14px;border:1px solid #333;border-radius:10px;background:#1a2a44;color:#fff;font-size:14px">
          <option value="972">🇮🇱 +972</option>
          <option value="1">🇺🇸 +1</option>
          <option value="44">🇬🇧 +44</option>
          <option value="49">🇩🇪 +49</option>
          <option value="33">🇫🇷 +33</option>
          <option value="39">🇮🇹 +39</option>
          <option value="34">🇪🇸 +34</option>
          <option value="31">🇳🇱 +31</option>
          <option value="41">🇨🇭 +41</option>
          <option value="43">🇦🇹 +43</option>
          <option value="32">🇧🇪 +32</option>
          <option value="46">🇸🇪 +46</option>
          <option value="47">🇳🇴 +47</option>
          <option value="45">🇩🇰 +45</option>
          <option value="358">🇫🇮 +358</option>
          <option value="48">🇵🇱 +48</option>
          <option value="420">🇨🇿 +420</option>
          <option value="36">🇭🇺 +36</option>
          <option value="40">🇷🇴 +40</option>
          <option value="30">🇬🇷 +30</option>
          <option value="90">🇹🇷 +90</option>
          <option value="7">🇷🇺 +7</option>
          <option value="380">🇺🇦 +380</option>
          <option value="971">🇦🇪 +971</option>
          <option value="966">🇸🇦 +966</option>
          <option value="962">🇯🇴 +962</option>
          <option value="20">🇪🇬 +20</option>
          <option value="212">🇲🇦 +212</option>
          <option value="216">🇹🇳 +216</option>
          <option value="91">🇮🇳 +91</option>
          <option value="86">🇨🇳 +86</option>
          <option value="81">🇯🇵 +81</option>
          <option value="82">🇰🇷 +82</option>
          <option value="61">🇦🇺 +61</option>
          <option value="64">🇳🇿 +64</option>
          <option value="55">🇧🇷 +55</option>
          <option value="52">🇲🇽 +52</option>
          <option value="54">🇦🇷 +54</option>
          <option value="57">🇨🇴 +57</option>
          <option value="56">🇨🇱 +56</option>
          <option value="27">🇿🇦 +27</option>
          <option value="234">🇳🇬 +234</option>
          <option value="254">🇰🇪 +254</option>
          <option value="233">🇬🇭 +233</option>
          <option value="65">🇸🇬 +65</option>
          <option value="60">🇲🇾 +60</option>
          <option value="66">🇹🇭 +66</option>
          <option value="63">🇵🇭 +63</option>
          <option value="62">🇮🇩 +62</option>
          <option value="84">🇻🇳 +84</option>
          <option value="886">🇹🇼 +886</option>
          <option value="852">🇭🇰 +852</option>
          <option value="353">🇮🇪 +353</option>
          <option value="351">🇵🇹 +351</option>
          <option value="375">🇧🇾 +375</option>
          <option value="994">🇦🇿 +994</option>
          <option value="995">🇬🇪 +995</option>
          <option value="374">🇦🇲 +374</option>
          <option value="998">🇺🇿 +998</option>
          <option value="992">🇹🇯 +992</option>
        </select>
        <input type="tel" name="local_phone" placeholder="501234567" required pattern="[0-9]{6,12}" style="flex:1">
      </div>
      <p style="font-size:0.8rem;color:#666;margin-top:4px">בחר קידומת והזן את המספר המקומי ללא 0 בהתחלה</p>
      <button type="submit" class="btn" style="width:100%;margin-top:16px;background:#f0c040;color:#000">+ הוסף לקוח (Trial)</button>
    </form>
  `));
});

// === הוספת לקוח ישירות (Trial, בלי Stripe) ===
router.post('/add-tenant', requireAdmin, express.urlencoded({ extended: true }), (req, res) => {
  const name = (req.body.name || '').trim();
  const countryCode = (req.body.country_code || '').trim().replace(/[^0-9]/g, '');
  const localPhone = (req.body.local_phone || '').trim().replace(/[^0-9]/g, '').replace(/^0+/, ''); // מסיר 0 בהתחלה
  const phone = countryCode + localPhone;

  if (!name || name.length < 2) {
    return res.send(adminPage('שגיאה', '<div style="background:#3d1111;padding:16px;border-radius:10px">שם חייב להיות לפחות 2 תווים.</div><a href="/admin/invite" class="btn">← חזור</a>'));
  }
  if (!countryCode || !localPhone || !/^[0-9]{8,15}$/.test(phone)) {
    return res.send(adminPage('שגיאה', '<div style="background:#3d1111;padding:16px;border-radius:10px">מספר טלפון לא תקין.</div><a href="/admin/invite" class="btn">← חזור</a>'));
  }

  try {
    const tenantId = tenantManager.createTenant({ name, phone, license_key: null, stripe_customer_id: null });
    logger.info('לקוח Trial נוצר מהדשבורד: ' + name + ' (ID: ' + tenantId + ')');

    res.send(adminPage('לקוח נוצר', `
      <h1>✅ לקוח נוצר!</h1>
      <div class="card">
        <p>שם: <strong>${esc(name)}</strong></p>
        <p>טלפון: <strong>${esc(phone)}</strong></p>
        <p>סטטוס: <span class="badge badge-yellow">Trial</span></p>
      </div>
      <p>השלב הבא: חבר את ה-WhatsApp של הלקוח</p>
      <a href="/admin/tenant/${tenantId}" class="btn">פתח דף לקוח →</a>
      <a href="/admin" class="btn btn-secondary">← חזור לדשבורד</a>
    `));
  } catch (err) {
    logger.error('שגיאה ביצירת לקוח: ' + err.message);
    res.send(adminPage('שגיאה', '<div style="background:#3d1111;padding:16px;border-radius:10px">שגיאה: ' + esc(err.message) + '</div><a href="/admin/invite" class="btn">← חזור</a>'));
  }
});

router.post('/invite', requireAdmin, express.urlencoded({ extended: true }), (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.redirect('/admin/invite');

  const token = db.createInvitation(name);
  const link = req.protocol + '://' + req.get('host') + '/c/invite/' + token;

  res.send(adminPage('הזמנה נוצרה', `
    <h1>✅ הזמנה נוצרה</h1>
    <p>שם: <strong>${esc(name)}</strong></p>
    <div class="card">
      <p style="word-break:break-all;font-size:0.9rem;color:#25D366">${esc(link)}</p>
    </div>
    <p>שלח את הלינק ללקוח ב-WhatsApp, SMS, או מייל.</p>
    <p style="color:#888;font-size:0.85rem">הלינק חד-פעמי — לאחר שימוש הוא פג.</p>
    <a href="/admin" class="btn btn-secondary">← חזור לדשבורד</a>
  `));
});

// === US-009: דף לקוח בודד ===
router.get('/tenant/:id', requireAdmin, (req, res) => {
  const tenant = tenantManager.getTenantById(parseInt(req.params.id, 10));
  if (!tenant) return res.status(404).send(adminPage('לא נמצא', '<p>לקוח לא נמצא.</p>'));

  const usage = db.getTenantUsageStats(tenant.id);
  const billing = db.getBillingHistory(tenant.id);
  const waConnected = whatsappManager.isTenantConnected(tenant.id);

  const statusBadge = (s) => {
    if (s === 'active') return '<span class="badge badge-green">פעיל</span>';
    if (s === 'trial') return '<span class="badge badge-yellow">ניסיון</span>';
    if (s === 'expired') return '<span class="badge badge-red">פג</span>';
    return '<span class="badge badge-gray">' + esc(s) + '</span>';
  };

  const billingStatusBadge = (s) => {
    if (s === 'paid') return '<span class="badge badge-green">שולם</span>';
    if (s === 'failed') return '<span class="badge badge-red">נכשל</span>';
    if (s === 'refunded') return '<span class="badge badge-yellow">הוחזר</span>';
    return '<span class="badge badge-gray">' + esc(s) + '</span>';
  };

  res.send(adminPage(tenant.name, `
    <h1>👤 ${esc(tenant.name)}</h1>

    <div class="card">
      <p>📱 טלפון: <strong>${esc(tenant.phone)}</strong></p>
      <p>🤖 שם סוכן: <strong>${esc(tenant.agent_name) || 'לא נבחר'}</strong></p>
      <p>📅 הצטרף: ${tenant.created_at ? tenant.created_at.substring(0, 10) : '-'}</p>
      <p>💳 מנוי: ${statusBadge(tenant.subscription_status)}</p>
      <p>📱 WhatsApp: ${waConnected ? '🟢 מחובר' : '🔴 מנותק'}</p>
    </div>

    <div class="stats">
      <div class="stat"><div class="stat-num">${usage.today}</div><div class="stat-label">היום</div></div>
      <div class="stat"><div class="stat-num">${usage.week}</div><div class="stat-label">השבוע</div></div>
      <div class="stat"><div class="stat-num">${usage.month}</div><div class="stat-label">החודש</div></div>
    </div>

    <h2>💳 היסטוריית חיובים</h2>
    ${billing.length > 0 ? `
      <table>
        <tr><th>תאריך</th><th>סכום</th><th>סטטוס</th><th>תקופה</th></tr>
        ${billing.map(b => `
          <tr>
            <td style="font-size:0.8rem">${b.paid_at ? b.paid_at.substring(0, 10) : b.created_at.substring(0, 10)}</td>
            <td>$${(b.amount_cents / 100).toFixed(2)}</td>
            <td>${billingStatusBadge(b.status)}</td>
            <td style="font-size:0.75rem">${b.period_start ? b.period_start.substring(0, 10) : ''} → ${b.period_end ? b.period_end.substring(0, 10) : ''}</td>
          </tr>
        `).join('')}
      </table>
    ` : '<p style="color:#666">אין חיובים עדיין.</p>'}

    <h2>פעולות</h2>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${!waConnected ? '<a href="/admin/tenant/' + tenant.id + '/reconnect" class="btn btn-sm">🔌 חבר WhatsApp</a>' : '<a href="/admin/tenant/' + tenant.id + '/disconnect" class="btn btn-sm btn-secondary">🔌 נתק WhatsApp</a>'}
      <a href="/admin/tenant/${tenant.id}/delete" class="btn btn-sm btn-danger" onclick="return confirm('בטוח?')">🗑️ מחק לקוח</a>
    </div>

    <a href="/admin" class="btn btn-secondary" style="margin-top:20px">← חזור לדשבורד</a>
  `));
});

// Tenant actions
router.get('/tenant/:id/reconnect', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const { handleIncomingMessage } = require('../handlers/messageRouter');
    await whatsappManager.connectTenant(id, handleIncomingMessage);
  } catch (err) { logger.error('Reconnect error: ' + err.message); }
  res.redirect('/admin/tenant/' + id);
});

router.get('/tenant/:id/disconnect', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try { await whatsappManager.disconnectTenant(id); } catch { /* */ }
  res.redirect('/admin/tenant/' + id);
});

router.get('/tenant/:id/delete', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  try { tenantManager.deleteTenant(id, 'admin'); } catch { /* */ }
  res.redirect('/admin');
});

// === US-010: לוג פעילות ===
router.get('/logs', requireAdmin, (req, res) => {
  const tenantId = req.query.tenant ? parseInt(req.query.tenant, 10) : null;
  const actionType = req.query.action || null;

  const logs = db.getUsageLogs({ tenantId, actionType, limit: 500 });
  const tenants = tenantManager.getAllTenants();

  res.send(adminPage('לוגים', `
    <h1>📋 לוג פעילות</h1>

    <form class="filter" method="GET" action="/admin/logs">
      <select name="tenant">
        <option value="">כל הלקוחות</option>
        ${tenants.map(t => '<option value="' + t.id + '"' + (tenantId === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('')}
      </select>
      <select name="action">
        <option value="">כל הפעולות</option>
        ${['create_event','update_event','delete_event','create_meeting','set_reminder','compose_message','transcription','onboarding_complete','error','blocked_expired'].map(a =>
          '<option value="' + a + '"' + (actionType === a ? ' selected' : '') + '>' + a + '</option>'
        ).join('')}
      </select>
      <button type="submit" class="btn btn-sm">סנן</button>
    </form>

    <table>
      <tr><th>זמן</th><th>לקוח</th><th>פעולה</th><th>סטטוס</th></tr>
      ${logs.map(l => `
        <tr>
          <td style="font-size:0.75rem">${l.timestamp ? l.timestamp.substring(5, 16).replace('T', ' ') : ''}</td>
          <td>${esc(l.tenant_name) || '-'}</td>
          <td><span class="badge badge-gray">${esc(l.action_type)}</span></td>
          <td>${l.status === 'success' ? '✅' : l.status === 'error' ? '❌' : '⚠️'}</td>
        </tr>
      `).join('')}
    </table>
    ${logs.length === 0 ? '<p style="color:#666;text-align:center">אין לוגים.</p>' : ''}
    <p style="color:#666;font-size:0.8rem;text-align:center;margin-top:12px">מציג ${logs.length} רשומות אחרונות</p>
  `));
});

module.exports = { adminRouter: router };
