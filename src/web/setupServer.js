const express = require('express');
const { google } = require('googleapis');
const { config, saveToEnv, isSetupComplete } = require('../config');
const logger = require('../services/logger');

const router = express.Router();

// === Middleware: הגנה בסיסמה ===
function requireAuth(req, res, next) {
  const { password } = req.query;
  if (password === config.setupPassword) {
    return next();
  }
  res.status(401).send(page('🔒 נדרשת סיסמה', `
    <p>הוסף <code>?password=YOUR_PASSWORD</code> לכתובת.</p>
    <p>הסיסמה מופיעה בלוגים של השרת בהפעלה.</p>
  `));
}

// === Helper: עטיפת HTML מותאם לנייד ===
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
    .container {
      max-width: 480px;
      margin: 0 auto;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 20px;
      color: #25D366;
    }
    h2 { font-size: 1.2rem; margin: 20px 0 10px; color: #fff; }
    label {
      display: block;
      margin: 14px 0 6px;
      font-weight: 600;
      font-size: 0.95rem;
    }
    input[type="text"], input[type="password"], input[type="tel"], select {
      width: 100%;
      padding: 14px;
      border: 1px solid #333;
      border-radius: 10px;
      background: #1a2a44;
      color: #fff;
      font-size: 16px; /* מונע zoom באייפון */
    }
    input:focus { outline: 2px solid #25D366; border-color: #25D366; }
    .btn {
      display: block;
      width: 100%;
      padding: 16px;
      margin: 20px 0;
      background: #25D366;
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 1.1rem;
      font-weight: 700;
      cursor: pointer;
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

// === דף ראשי – Setup ===
router.get('/', requireAuth, (req, res) => {
  const pw = req.query.password;
  const complete = isSetupComplete();

  res.send(page('🤖 הגדרת העוזר האישי', `
    ${complete ? '<div class="success">✅ ההגדרות הבסיסיות כבר הושלמו. ניתן לעדכן.</div>' : ''}

    <div class="step">
      <span class="step-num">שלב 1</span> – הזנת פרטים ו-API Keys
    </div>

    <form method="POST" action="/setup/save?password=${pw}">
      <label>📱 מספר טלפון (בפורמט בינלאומי)</label>
      <input type="tel" name="phone" placeholder="972501234567" 
             value="${config.userPhoneNumber}" required>
      <div class="hint">ללא + ולללא מקפים. למשל: 972501234567</div>

      <label>🔑 Anthropic API Key (Claude)</label>
      <input type="password" name="anthropic_key" placeholder="sk-ant-..."
             value="${config.anthropicApiKey ? '••••••••' : ''}" required>

      <label>🔑 OpenAI API Key (Whisper תמלול)</label>
      <input type="password" name="openai_key" placeholder="sk-..."
             value="${config.openaiApiKey ? '••••••••' : ''}" required>

      <label>📅 Google Client ID</label>
      <input type="text" name="google_client_id" placeholder="xxx.apps.googleusercontent.com"
             value="${config.google.clientId}" required>

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
      <span class="step-num">שלב 2</span> – <a href="/setup/google?password=${pw}">חבר Google Calendar</a>
    </div>

    <div class="step">
      <span class="step-num">שלב 3</span> – <a href="/setup/whatsapp?password=${pw}">חבר WhatsApp</a>
    </div>
  `));
});

// === שמירת הגדרות ===
router.post('/save', requireAuth, express.urlencoded({ extended: true }), (req, res) => {
  const pw = req.query.password;
  const { phone, anthropic_key, openai_key, google_client_id, google_client_secret, timezone } = req.body;

  try {
    if (phone) saveToEnv('USER_PHONE_NUMBER', phone);
    if (anthropic_key && !anthropic_key.includes('•')) saveToEnv('ANTHROPIC_API_KEY', anthropic_key);
    if (openai_key && !openai_key.includes('•')) saveToEnv('OPENAI_API_KEY', openai_key);
    if (google_client_id) saveToEnv('GOOGLE_CLIENT_ID', google_client_id);
    if (google_client_secret && !google_client_secret.includes('•')) saveToEnv('GOOGLE_CLIENT_SECRET', google_client_secret);
    if (timezone) saveToEnv('TIMEZONE', timezone);

    // עדכון config ב-runtime
    if (phone) config.userPhoneNumber = phone;
    if (anthropic_key && !anthropic_key.includes('•')) config.anthropicApiKey = anthropic_key;
    if (openai_key && !openai_key.includes('•')) config.openaiApiKey = openai_key;
    if (google_client_id) config.google.clientId = google_client_id;
    if (google_client_secret && !google_client_secret.includes('•')) config.google.clientSecret = google_client_secret;
    if (timezone) config.timezone = timezone;

    logger.info('הגדרות נשמרו מדף ה-Setup.');

    res.send(page('✅ נשמר!', `
      <div class="success">ההגדרות נשמרו בהצלחה!</div>
      <a href="/setup/google?password=${pw}" class="btn">שלב הבא: חבר Google Calendar →</a>
      <a href="/setup?password=${pw}" class="btn btn-secondary">← חזור להגדרות</a>
    `));
  } catch (err) {
    res.send(page('❌ שגיאה', `
      <div class="error">שגיאה בשמירה: ${err.message}</div>
      <a href="/setup?password=${pw}" class="btn">← חזור</a>
    `));
  }
});

// === Google OAuth ===
router.get('/google', requireAuth, (req, res) => {
  const pw = req.query.password;

  if (!config.google.clientId || !config.google.clientSecret) {
    return res.send(page('📅 Google Calendar', `
      <div class="error">חסרים Google Client ID ו-Secret. <a href="/setup?password=${pw}">חזור והזן אותם קודם</a>.</div>
    `));
  }

  const hasToken = !!config.google.refreshToken;

  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    `${req.protocol}://${req.get('host')}/setup/google/callback?password=${pw}`
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
    <a href="/setup?password=${pw}" class="btn btn-secondary">← חזור</a>
  `));
});

router.get('/google/callback', requireAuth, async (req, res) => {
  const pw = req.query.password;
  const { code } = req.query;

  if (!code) {
    return res.send(page('❌ שגיאה', `
      <div class="error">לא התקבל קוד אישור מ-Google.</div>
      <a href="/setup/google?password=${pw}" class="btn">← נסה שוב</a>
    `));
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      `${req.protocol}://${req.get('host')}/setup/google/callback?password=${pw}`
    );

    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (refreshToken) {
      saveToEnv('GOOGLE_REFRESH_TOKEN', refreshToken);
      config.google.refreshToken = refreshToken;
    }

    logger.info('Google Calendar מחובר מדף ה-Setup.');

    res.send(page('✅ Google Calendar מחובר!', `
      <div class="success">Google Calendar חובר בהצלחה! האירועים יופיעו ביומן הטלפון.</div>
      <a href="/setup/whatsapp?password=${pw}" class="btn">שלב הבא: חבר WhatsApp →</a>
      <a href="/setup?password=${pw}" class="btn btn-secondary">← חזור להגדרות</a>
    `));
  } catch (err) {
    res.send(page('❌ שגיאה', `
      <div class="error">שגיאה בחיבור: ${err.message}</div>
      <a href="/setup/google?password=${pw}" class="btn">← נסה שוב</a>
    `));
  }
});

// === WhatsApp QR ===
let qrDataUrl = null;
let whatsappReady = false;

function setQrData(dataUrl) {
  qrDataUrl = dataUrl;
}

function setWhatsAppReady(ready) {
  whatsappReady = ready;
}

router.get('/whatsapp', requireAuth, (req, res) => {
  const pw = req.query.password;

  if (whatsappReady) {
    return res.send(page('✅ WhatsApp מחובר!', `
      <div class="success">
        WhatsApp מחובר בהצלחה!<br>
        ${config.agentName
          ? `שם הסוכן: <strong>${config.agentName}</strong>. שלח לו הודעה ב-WhatsApp!`
          : 'בדוק את ה-WhatsApp – הסוכן שלח לך הודעה לבחירת שם!'}
      </div>
      <a href="/setup?password=${pw}" class="btn btn-secondary">← חזור להגדרות</a>
    `));
  }

  res.send(page('📱 חיבור WhatsApp', `
    <div class="qr-container">
      ${qrDataUrl
        ? `<img src="${qrDataUrl}" alt="QR Code" id="qrImage">`
        : '<p>⏳ ממתין ל-QR code... רענן את הדף בעוד כמה שניות.</p>'}
    </div>

    <div class="step">
      <strong>הוראות:</strong><br>
      1. פתח WhatsApp בטלפון<br>
      2. הגדרות → מכשירים מקושרים → קישור מכשיר<br>
      3. סרוק את ה-QR שלמעלה
    </div>

    <div class="step" style="margin-top: 12px;">
      <strong>⚠️ ה-WhatsApp באותו טלפון?</strong><br>
      פתח את הקישור הזה במחשב או בטלפון אחר, או השתמש ב-
      <a href="/setup/whatsapp/pair?password=${pw}">קוד pairing</a> במקום.
    </div>

    <script>
      // רענון אוטומטי כל 5 שניות עד שמחובר
      setTimeout(() => location.reload(), 5000);
    </script>

    <a href="/setup?password=${pw}" class="btn btn-secondary">← חזור</a>
  `));
});

// === WhatsApp Status API (for polling) ===
router.get('/whatsapp/status', requireAuth, (req, res) => {
  res.json({
    connected: whatsappReady,
    hasQr: !!qrDataUrl,
    agentName: config.agentName || null,
  });
});

module.exports = { setupRouter: router, setQrData, setWhatsAppReady };
