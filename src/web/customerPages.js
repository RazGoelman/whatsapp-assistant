const express = require('express');
const { google } = require('googleapis');
const db = require('../db');
const tenantManager = require('../services/tenantManager');
const whatsappManager = require('../services/whatsappManager');
const { createCheckoutSession } = require('../services/stripe');
const { handleIncomingMessage } = require('../handlers/messageRouter');
const logger = require('../services/logger');

const router = express.Router();

// === Helper: HTML מותאם לנייד (עיצוב לקוח) ===
function customerPage(title, body) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a1628 0%, #1a2a44 100%);
      color: #e0e0e0; padding: 20px; min-height: 100vh;
    }
    .container { max-width: 480px; margin: 0 auto; }
    h1 { font-size: 1.6rem; margin-bottom: 8px; color: #25D366; }
    h2 { font-size: 1.1rem; margin: 16px 0 8px; color: #fff; }
    p { margin: 8px 0; line-height: 1.6; color: #bbb; }
    label { display: block; margin: 14px 0 6px; font-weight: 600; font-size: 0.95rem; }
    input[type="text"], input[type="tel"] {
      width: 100%; padding: 14px; border: 1px solid #333;
      border-radius: 10px; background: #1a2a44; color: #fff; font-size: 16px;
    }
    input:focus { outline: 2px solid #25D366; border-color: #25D366; }
    .btn {
      display: block; width: 100%; padding: 16px; margin: 20px 0;
      background: #25D366; color: #fff; border: none; border-radius: 12px;
      font-size: 1.1rem; font-weight: 700; cursor: pointer; text-align: center; text-decoration: none;
    }
    .btn:active { background: #1da851; }
    .success { background: #0d3320; border: 1px solid #25D366; border-radius: 12px; padding: 16px; margin: 16px 0; }
    .error { background: #3d1111; border: 1px solid #e74c3c; border-radius: 12px; padding: 16px; margin: 16px 0; }
    .step { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin: 12px 0; }
    .step-num { display: inline-block; width: 28px; height: 28px; background: #25D366; color: #fff; border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; margin-left: 8px; }
    .qr-container { text-align: center; margin: 20px 0; }
    .qr-container img { max-width: 280px; border-radius: 12px; background: white; padding: 12px; }
    .check { color: #25D366; font-size: 1.3rem; }
    .pending { color: #888; }
    .logo { text-align: center; font-size: 3rem; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    ${body}
  </div>
</body>
</html>`;
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// === Security headers ===
router.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// === US-005: דף הרשמה (Invitation Link) ===

router.get('/invite/:token', (req, res) => {
  const invitation = db.getInvitation(req.params.token);

  if (!invitation) {
    return res.status(404).send(customerPage('שגיאה', `
      <div class="logo">🤖</div>
      <h1>הזמנה לא נמצאה</h1>
      <p>הלינק לא תקין או שפג תוקפו. פנה למנהל לקבלת לינק חדש.</p>
    `));
  }

  if (invitation.used) {
    return res.send(customerPage('הזמנה כבר בשימוש', `
      <div class="logo">🤖</div>
      <h1>ההזמנה הזו כבר מומשה</h1>
      <p>אם כבר נרשמת, בדוק את ה-WhatsApp שלך להודעה מהעוזר.</p>
    `));
  }

  res.send(customerPage('הרשמה לעוזר אישי', `
    <div class="logo">🤖</div>
    <h1>ברוך הבא!</h1>
    <p>העוזר האישי שלך ב-WhatsApp מחכה לך. ממלאים פרטים, משלמים, ומתחילים.</p>

    <form method="POST" action="/c/register/${esc(req.params.token)}">
      <label>שם מלא</label>
      <input type="text" name="name" placeholder="ישראל ישראלי" required minlength="2">

      <label>מספר טלפון (WhatsApp)</label>
      <div style="display:flex;gap:8px">
        <select name="country_code" style="width:130px;padding:14px;border:1px solid #333;border-radius:10px;background:#1a2a44;color:#fff;font-size:14px">
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
          <option value="90">🇹🇷 +90</option>
          <option value="971">🇦🇪 +971</option>
          <option value="966">🇸🇦 +966</option>
          <option value="962">🇯🇴 +962</option>
          <option value="20">🇪🇬 +20</option>
          <option value="91">🇮🇳 +91</option>
          <option value="86">🇨🇳 +86</option>
          <option value="61">🇦🇺 +61</option>
          <option value="55">🇧🇷 +55</option>
          <option value="27">🇿🇦 +27</option>
          <option value="7">🇷🇺 +7</option>
        </select>
        <input type="tel" name="local_phone" placeholder="501234567" required pattern="[0-9]{6,12}" style="flex:1">
      </div>
      <p style="font-size: 0.8rem; color: #666;">בחר קידומת והזן מספר מקומי ללא 0 בהתחלה</p>

      <button type="submit" class="btn">המשך לתשלום →</button>
    </form>
  `));
});

router.post('/register/:token', express.urlencoded({ extended: true }), async (req, res) => {
  const invitation = db.getInvitation(req.params.token);

  if (!invitation || invitation.used) {
    return res.status(400).send(customerPage('שגיאה', `
      <div class="error">הזמנה לא תקינה.</div>
    `));
  }

  const { name, country_code, local_phone } = req.body;
  const countryCode = (country_code || '').replace(/[^0-9]/g, '');
  const localPhone = (local_phone || '').replace(/[^0-9]/g, '').replace(/^0+/, '');
  const phone = countryCode + localPhone;

  // 🔒 Validation
  if (!name || name.length < 2) {
    return res.status(400).send(customerPage('שגיאה', `
      <div class="error">שם חייב להיות לפחות 2 תווים.</div>
      <a href="/c/invite/${esc(req.params.token)}" class="btn">← חזור</a>
    `));
  }
  if (!countryCode || !localPhone || !/^[0-9]{8,15}$/.test(phone)) {
    return res.status(400).send(customerPage('שגיאה', `
      <div class="error">מספר טלפון לא תקין.</div>
      <a href="/c/invite/${esc(req.params.token)}" class="btn">← חזור</a>
    `));
  }

  try {
    // יצירת לקוח ב-DB
    const tenantId = tenantManager.createTenant({
      name,
      phone,
      license_key: null,
      stripe_customer_id: null,
    });

    // סימון ההזמנה כמומשת
    db.markInvitationUsed(req.params.token);

    // יצירת Stripe Checkout
    const baseUrl = req.protocol + '://' + req.get('host');
    const checkoutUrl = await createCheckoutSession({
      tenantName: name,
      tenantPhone: phone,
      tenantId,
      successUrl: baseUrl + '/c/onboard/' + tenantId,
      cancelUrl: baseUrl + '/c/invite/' + req.params.token + '?cancelled=1',
    });

    // מעביר לדף תשלום
    res.redirect(checkoutUrl);
  } catch (err) {
    logger.error('שגיאה בהרשמה: ' + err.message);
    res.status(500).send(customerPage('שגיאה', `
      <div class="error">שגיאה בהרשמה. ייתכן שהמספר כבר רשום. נסה שוב או פנה למנהל.</div>
      <a href="/c/invite/${esc(req.params.token)}" class="btn">← חזור</a>
    `));
  }
});

// === US-007: Onboarding — חיבור WhatsApp + Calendar + שם ===

router.get('/onboard/:tenantId', (req, res) => {
  const tenantId = parseInt(req.params.tenantId, 10);
  const tenant = tenantManager.getTenantById(tenantId);

  if (!tenant) {
    return res.status(404).send(customerPage('שגיאה', `
      <div class="error">חשבון לא נמצא.</div>
    `));
  }

  const waConnected = whatsappManager.isTenantConnected(tenantId);
  const calConnected = !!tenant.google_refresh_token;
  const hasName = !!tenant.agent_name;
  const qr = whatsappManager.getQrForTenant(tenantId);

  // אם עוד לא התחיל חיבור WhatsApp — מתחיל
  if (!waConnected && !qr) {
    whatsappManager.connectTenant(tenantId, handleIncomingMessage).catch(err => {
      logger.error('שגיאה בחיבור WA ל-onboarding: ' + err.message);
    });
  }

  const allDone = waConnected && calConnected && hasName;

  res.send(customerPage('הגדרת העוזר', `
    <div class="logo">🤖</div>
    <h1>כמעט מוכן, ${esc(tenant.name)}!</h1>
    <p>שלושה שלבים קצרים ואתה מתחיל:</p>

    <div class="step">
      <span class="step-num">1</span>
      ${waConnected
        ? '<span class="check">✅</span> WhatsApp מחובר!'
        : qr
          ? '<strong>סרוק את ה-QR עם WhatsApp:</strong><div class="qr-container"><img src="' + qr + '" alt="QR"></div><p style="font-size:0.85rem">WhatsApp → הגדרות → מכשירים מקושרים → קישור מכשיר</p>'
          : '<span class="pending">⏳</span> מכין QR code... רענן בעוד כמה שניות.'}
    </div>

    <div class="step">
      <span class="step-num">2</span>
      ${calConnected
        ? '<span class="check">✅</span> Google Calendar מחובר!'
        : waConnected
          ? '<a href="/c/onboard/' + tenantId + '/google" class="btn" style="margin:8px 0">🔗 חבר Google Calendar</a>'
          : '<span class="pending">⏳</span> חבר WhatsApp קודם'}
    </div>

    <div class="step">
      <span class="step-num">3</span>
      ${hasName
        ? '<span class="check">✅</span> שם הסוכן: <strong>' + esc(tenant.agent_name) + '</strong>'
        : calConnected
          ? '<span class="pending">⏳</span> הסוכן שלח לך הודעה ב-WhatsApp — ענה עם שם!'
          : '<span class="pending">⏳</span> חבר Calendar קודם'}
    </div>

    ${allDone ? `
      <div class="success">
        🎉 הכל מוכן! שלח הודעה ב-WhatsApp שמתחילה ב-<strong>${esc(tenant.agent_name)}</strong> כדי להתחיל.
      </div>
    ` : `
      <script>setTimeout(function() { location.reload(); }, 5000);</script>
      <p style="text-align:center; color:#666; margin-top:20px;">הדף מתעדכן אוטומטית...</p>
    `}
  `));
});

// Google OAuth for tenant
router.get('/onboard/:tenantId/google', (req, res) => {
  const tenantId = parseInt(req.params.tenantId, 10);
  const tenant = tenantManager.getTenantById(tenantId);
  if (!tenant) return res.status(404).send('לא נמצא');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.send(customerPage('שגיאה', `<div class="error">Google OAuth לא מוגדר. פנה למנהל.</div>`));
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId, clientSecret,
    req.protocol + '://' + req.get('host') + '/c/onboard/' + tenantId + '/google/callback'
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: String(tenantId),
  });

  res.redirect(authUrl);
});

router.get('/onboard/:tenantId/google/callback', async (req, res) => {
  const tenantId = parseInt(req.params.tenantId, 10);
  const { code } = req.query;

  if (!code) {
    return res.redirect('/c/onboard/' + tenantId);
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      req.protocol + '://' + req.get('host') + '/c/onboard/' + tenantId + '/google/callback'
    );

    const { tokens } = await oauth2Client.getToken(code);
    if (tokens.refresh_token) {
      tenantManager.updateTenant(tenantId, { google_refresh_token: tokens.refresh_token }, 'oauth');
    }

    logger.info('Google Calendar מחובר: tenant ' + tenantId);

    // שליחת הודעת onboarding ב-WhatsApp
    if (whatsappManager.isTenantConnected(tenantId)) {
      const tenant = tenantManager.getTenantById(tenantId);
      if (tenant && !tenant.agent_name) {
        await whatsappManager.sendToTenant(tenantId,
          '👋 היי ' + tenant.name + '! היומן מחובר.\n\nאיך תרצה לקרוא לי?'
        );
      }
    }

    res.redirect('/c/onboard/' + tenantId);
  } catch (err) {
    logger.error('Google OAuth error: ' + err.message);
    res.redirect('/c/onboard/' + tenantId);
  }
});

// === Stripe Webhook ===

router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const { constructWebhookEvent, handleWebhookEvent } = require('../services/stripe');
    const sig = req.headers['stripe-signature'];
    const event = constructWebhookEvent(req.body, sig);
    await handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook error: ' + err.message);
    res.status(400).send('Webhook error');
  }
});

module.exports = { customerRouter: router };
