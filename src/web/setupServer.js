const express = require('express');
const crypto = require('crypto');
const { google } = require('googleapis');
const { config, saveToEnv, isSetupComplete } = require('../config');
const { validateLicense, activateLicense, isLicensed } = require('../services/license');
const logger = require('../services/logger');

const router = express.Router();

// 🔒 Session token — נוצר פעם אחת בזמן ריצה
const SESSION_TOKEN = crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE = 'setup_session';
const MAX_LOGIN_ATTEMPTS = 5;
let loginAttempts = new Map(); // IP -> { count, lastAttempt }

// === Middleware: Security Headers ===
router.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// === Rate Limiting ===
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return true;
  // ניקוי אחרי 15 דקות
  if (now - entry.lastAttempt > 15 * 60 * 1000) {
    loginAttempts.delete(ip);
    return true;
  }
  return entry.count < MAX_LOGIN_ATTEMPTS;
}

function recordLoginAttempt(ip) {
  const entry = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  entry.count++;
  entry.lastAttempt = Date.now();
  loginAttempts.set(ip, entry);
}

// === Middleware: Cookie-based Auth ===
function requireAuth(req, res, next) {
  const cookie = parseCookies(req)[SESSION_COOKIE];
  if (cookie === SESSION_TOKEN) {
    return next();
  }
  res.redirect('/setup/login');
}

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach(c => {
    const [key, val] = c.trim().split('=');
    if (key && val) cookies[key] = val;
  });
  return cookies;
}

// === Helper: HTML מותאם לנייד ===
function page(title, body) {
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
      background: #0a1628;
      color: #e0e0e0;
      padding: 20px;
      min-height: 100vh;
    }
    .container { max-width: 480px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 20px; color: #25D366; }
    h2 { font-size: 1.2rem; margin: 20px 0 10px; color: #fff; }
    label { display: block; margin: 14px 0 6px; font-weight: 600; font-size: 0.95rem; }
    input[type="text"], input[type="password"], input[type="tel"], select {
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
    .btn-secondary { background: #2a3f5f; }
    .success { background: #0d3320; border: 1px solid #25D366; border-radius: 12px; padding: 16px; margin: 16px 0; }
    .error { background: #3d1111; border: 1px solid #e74c3c; border-radius: 12px; padding: 16px; margin: 16px 0; }
    .hint { color: #888; font-size: 0.85rem; margin-top: 4px; }
    .step { background: #1a2a44; border-radius: 12px; padding: 16px; margin: 12px 0; }
    .step-num { color: #25D366; font-weight: 700; }
    .qr-container { text-align: center; margin: 20px 0; }
    .qr-container img { max-width: 280px; border-radius: 12px; background: white; padding: 12px; }
    code { background: #1a2a44; padding: 2px 6px; border-radius: 4px; font-size: 0.9rem; }
    a { color: #25D366; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    ${body}
  </div>
</body>
</html>`;
}

// === דף Login ===
router.get('/login', (req, res) => {
  res.send(page('🔒 כניסה לדף ההגדרות', `
    <p>הזן את הסיסמה שמופיעה בלוגים של השרת:</p>
    <form method="POST" action="/setup/login">
      <label>סיסמה</label>
      <input type="password" name="password" placeholder="הזן סיסמה" required autofocus>
      <button type="submit" class="btn">🔓 כניסה</button>
    </form>
  `));
});

router.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  if (!checkRateLimit(ip)) {
    return res.status(429).send(page('🚫 חסימה זמנית', `
      <div class="error">יותר מדי ניסיונות. נסה שוב בעוד 15 דקות.</div>
    `));
  }

  const { password } = req.body;
  if (password === config.setupPassword) {
    // מנקה ניסיונות
    loginAttempts.delete(ip);
    // שומר cookie מאובטח
    res.setHeader('Set-Cookie',
      `${SESSION_COOKIE}=${SESSION_TOKEN}; Path=/setup; HttpOnly; SameSite=Strict; Max-Age=3600`
    );
    return res.redirect('/setup');
  }

  recordLoginAttempt(ip);
  const remaining = MAX_LOGIN_ATTEMPTS - (loginAttempts.get(ip)?.count || 0);
  res.status(401).send(page('🔒 סיסמה שגויה', `
    <div class="error">סיסמה לא נכונה. נותרו ${remaining} ניסיונות.</div>
    <a href="/setup/login" class="btn">← נסה שוב</a>
  `));
});

// === דף ראשי – Setup ===
router.get('/', requireAuth, (req, res) => {
  const complete = isSetupComplete();
  const licensed = isLicensed();

  res.send(page('🤖 הגדרת העוזר האישי', `
    ${complete ? '<div class="success">✅ ההגדרות הבסיסיות הושלמו. ניתן לעדכן.</div>' : ''}

    <div class="step">
      <span class="step-num">שלב 0</span> – מפתח רישיון
      ${licensed ? ' ✅' : ' (חובה)'}
    </div>

    ${licensed ? `
      <div class="success">🔑 רישיון פעיל: ${sanitizeForHtml(config.licenseKey.substring(0, 7))}...</div>
    ` : `
      <form method="POST" action="/setup/license">
        <label>🔑 מפתח רישיון</label>
        <input type="text" name="license_key" placeholder="WA-XXXX-XXXX-XXXX-XXXX" 
               required pattern="WA-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}"
               style="text-transform: uppercase; letter-spacing: 2px; text-align: center; font-size: 18px;">
        <div class="hint">קיבלת מפתח מהמנהל? הזן אותו כאן.</div>
        <button type="submit" class="btn">🔓 הפעל רישיון</button>
      </form>
    `}

    <div class="step">
      <span class="step-num">שלב 1</span> – הזנת פרטים ו-API Keys
    </div>

    <form method="POST" action="/setup/save">
      <label>📱 מספר טלפון (בפורמט בינלאומי)</label>
      <input type="tel" name="phone" placeholder="972501234567" 
             value="${config.userPhoneNumber}" required pattern="[0-9]{10,15}">
      <div class="hint">ללא + וללא מקפים. למשל: 972501234567</div>

      <label>🔑 Anthropic API Key (Claude)</label>
      <input type="password" name="anthropic_key" placeholder="sk-ant-..."
             value="${config.anthropicApiKey ? '••••••••' : ''}" required>

      <label>🔑 OpenAI API Key (Whisper תמלול)</label>
      <input type="password" name="openai_key" placeholder="sk-..."
             value="${config.openaiApiKey ? '••••••••' : ''}" required>

      <label>📅 Google Client ID</label>
      <input type="text" name="google_client_id" placeholder="xxx.apps.googleusercontent.com"
             value="${sanitizeForHtml(config.google.clientId)}" required>

      <label>📅 Google Client Secret</label>
      <input type="password" name="google_client_secret" 
             value="${config.google.clientSecret ? '••••••••' : ''}" required>

      <label>🌍 אזור זמן</label>
      <select name="timezone">
        <option value="Asia/Jerusalem" ${config.timezone === 'Asia/Jerusalem' ? 'selected' : ''}>ישראל</option>
        <option value="Europe/London" ${config.timezone === 'Europe/London' ? 'selected' : ''}>לונדון</option>
        <option value="America/New_York" ${config.timezone === 'America/New_York' ? 'selected' : ''}>ניו יורק</option>
        <option value="America/Los_Angeles" ${config.timezone === 'America/Los_Angeles' ? 'selected' : ''}>לוס אנג׳לס</option>
      </select>

      <button type="submit" class="btn">💾 שמור הגדרות</button>
    </form>

    <div class="step">
      <span class="step-num">שלב 2</span> – <a href="/setup/google">חבר Google Calendar</a>
    </div>

    <div class="step">
      <span class="step-num">שלב 3</span> – <a href="/setup/whatsapp">חבר WhatsApp</a>
    </div>
  `));
});

// === הפעלת רישיון ===
router.post('/license', requireAuth, express.urlencoded({ extended: true }), (req, res) => {
  const key = (req.body.license_key || '').trim().toUpperCase();

  const { valid, error } = validateLicense(key);
  if (!valid) {
    return res.send(page('❌ רישיון לא תקין', `
      <div class="error">${sanitizeForHtml(error)}</div>
      <a href="/setup" class="btn">← חזור</a>
    `));
  }

  const activated = activateLicense(key);
  if (!activated) {
    return res.send(page('❌ שגיאה', `
      <div class="error">לא הצלחתי להפעיל את הרישיון. נסה שוב.</div>
      <a href="/setup" class="btn">← חזור</a>
    `));
  }

  logger.info('רישיון הופעל מדף ה-Setup: ' + key.substring(0, 7) + '...');
  res.send(page('✅ רישיון הופעל!', `
    <div class="success">🔑 הרישיון הופעל בהצלחה! המפתח ננעל למכשיר הזה.</div>
    <a href="/setup" class="btn">המשך להגדרות →</a>
  `));
});

// === שמירת הגדרות ===
router.post('/save', requireAuth, express.urlencoded({ extended: true }), (req, res) => {
  const { phone, anthropic_key, openai_key, google_client_id, google_client_secret, timezone } = req.body;

  try {
    // 🔒 Input validation
    if (phone && !/^[0-9]{10,15}$/.test(phone)) {
      throw new Error('מספר טלפון לא תקין');
    }
    const allowedTimezones = ['Asia/Jerusalem', 'Europe/London', 'America/New_York', 'America/Los_Angeles'];
    if (timezone && !allowedTimezones.includes(timezone)) {
      throw new Error('אזור זמן לא תקין');
    }

    if (phone) { saveToEnv('USER_PHONE_NUMBER', phone); config.userPhoneNumber = phone; }
    if (anthropic_key && !anthropic_key.includes('•')) { saveToEnv('ANTHROPIC_API_KEY', anthropic_key); config.anthropicApiKey = anthropic_key; }
    if (openai_key && !openai_key.includes('•')) { saveToEnv('OPENAI_API_KEY', openai_key); config.openaiApiKey = openai_key; }
    if (google_client_id) { saveToEnv('GOOGLE_CLIENT_ID', google_client_id); config.google.clientId = google_client_id; }
    if (google_client_secret && !google_client_secret.includes('•')) { saveToEnv('GOOGLE_CLIENT_SECRET', google_client_secret); config.google.clientSecret = google_client_secret; }
    if (timezone) { saveToEnv('TIMEZONE', timezone); config.timezone = timezone; }

    logger.info('הגדרות נשמרו מדף ה-Setup.');

    res.send(page('✅ נשמר!', `
      <div class="success">ההגדרות נשמרו בהצלחה!</div>
      <a href="/setup/google" class="btn">שלב הבא: חבר Google Calendar →</a>
      <a href="/setup" class="btn btn-secondary">← חזור להגדרות</a>
    `));
  } catch (err) {
    logger.error('שגיאה בשמירת הגדרות: ' + err.message);
    res.send(page('❌ שגיאה', `
      <div class="error">שגיאה בשמירה. בדוק את הנתונים ונסה שוב.</div>
      <a href="/setup" class="btn">← חזור</a>
    `));
  }
});

// === Google OAuth ===
router.get('/google', requireAuth, (req, res) => {
  if (!config.google.clientId || !config.google.clientSecret) {
    return res.send(page('📅 Google Calendar', `
      <div class="error">חסרים Google Client ID ו-Secret. <a href="/setup">חזור והזן אותם קודם</a>.</div>
    `));
  }

  const hasToken = !!config.google.refreshToken;
  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    `${req.protocol}://${req.get('host')}/setup/google/callback`
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });

  res.send(page('📅 חיבור Google Calendar', `
    ${hasToken ? '<div class="success">✅ Google Calendar כבר מחובר! אפשר לחבר מחדש.</div>' : ''}
    <p>לחץ על הכפתור כדי לאשר גישה ליומן Google שלך:</p>
    <a href="${authUrl}" class="btn">🔗 חבר Google Calendar</a>
    <a href="/setup" class="btn btn-secondary">← חזור</a>
  `));
});

router.get('/google/callback', requireAuth, async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.send(page('❌ שגיאה', `
      <div class="error">לא התקבל קוד אישור מ-Google.</div>
      <a href="/setup/google" class="btn">← נסה שוב</a>
    `));
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      `${req.protocol}://${req.get('host')}/setup/google/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    if (tokens.refresh_token) {
      saveToEnv('GOOGLE_REFRESH_TOKEN', tokens.refresh_token);
      config.google.refreshToken = tokens.refresh_token;
    }

    logger.info('Google Calendar מחובר מדף ה-Setup.');
    res.send(page('✅ Google Calendar מחובר!', `
      <div class="success">Google Calendar חובר בהצלחה!</div>
      <a href="/setup/whatsapp" class="btn">שלב הבא: חבר WhatsApp →</a>
      <a href="/setup" class="btn btn-secondary">← חזור להגדרות</a>
    `));
  } catch (err) {
    logger.error('שגיאה בחיבור Google: ' + err.message);
    res.send(page('❌ שגיאה', `
      <div class="error">שגיאה בחיבור ל-Google. נסה שוב.</div>
      <a href="/setup/google" class="btn">← נסה שוב</a>
    `));
  }
});

// === WhatsApp QR ===
let qrDataUrl = null;
let whatsappReady = false;

function setQrData(dataUrl) { qrDataUrl = dataUrl; }
function setWhatsAppReady(ready) { whatsappReady = ready; }

router.get('/whatsapp', requireAuth, (req, res) => {
  if (whatsappReady) {
    return res.send(page('✅ WhatsApp מחובר!', `
      <div class="success">
        WhatsApp מחובר בהצלחה!<br>
        ${config.agentName
          ? 'שם הסוכן: <strong>' + sanitizeForHtml(config.agentName) + '</strong>. שלח לו הודעה!'
          : 'בדוק את ה-WhatsApp – הסוכן שלח לך הודעה לבחירת שם!'}
      </div>
      <a href="/setup" class="btn btn-secondary">← חזור להגדרות</a>
    `));
  }

  res.send(page('📱 חיבור WhatsApp', `
    <div class="qr-container">
      ${qrDataUrl
        ? '<img src="' + qrDataUrl + '" alt="QR Code" id="qrImage">'
        : '<p>ממתין ל-QR code... רענן את הדף בעוד כמה שניות.</p>'}
    </div>

    <div class="step">
      <strong>הוראות:</strong><br>
      1. פתח WhatsApp בטלפון<br>
      2. הגדרות → מכשירים מקושרים → קישור מכשיר<br>
      3. סרוק את ה-QR שלמעלה
    </div>

    <div class="step" style="margin-top: 12px;">
      <strong>ה-WhatsApp באותו טלפון?</strong><br>
      פתח את הקישור הזה ממכשיר אחר כדי לסרוק.
    </div>

    <script>setTimeout(function() { location.reload(); }, 5000);</script>
    <a href="/setup" class="btn btn-secondary">← חזור</a>
  `));
});

router.get('/whatsapp/status', requireAuth, (req, res) => {
  res.json({
    connected: whatsappReady,
    hasQr: !!qrDataUrl,
    agentName: config.agentName || null,
  });
});

// 🔒 Sanitize output to prevent XSS
function sanitizeForHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { setupRouter: router, setQrData, setWhatsAppReady };
