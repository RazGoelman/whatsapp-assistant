const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

const ENV_PATH = path.resolve(__dirname, '../../.env');

// טוען משתני סביבה מקובץ .env
dotenv.config({ path: ENV_PATH });

const config = {
  // שם הסוכן – נקבע ב-onboarding דרך WhatsApp
  agentName: process.env.AGENT_NAME || '',

  // Claude API
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  aiModel: 'claude-sonnet-4-20250514',

  // Google Calendar
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
  },

  // OpenAI Whisper (תמלול)
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  // הגדרות משתמש
  userPhoneNumber: process.env.USER_PHONE_NUMBER || '',
  timezone: process.env.TIMEZONE || 'Asia/Jerusalem',

  // הגדרות שרת
  port: parseInt(process.env.PORT, 10) || 3000,
  setupPassword: process.env.SETUP_PASSWORD || crypto.randomBytes(8).toString('hex'),

  // הגדרות מערכת
  reminderIntervalMinutes: 15,
  reminderBeforeMinutes: 60,
  dailySummaryHour: 20,
  dailySummaryMinute: 0,

  // מצב המערכת
  isOnboarding: false, // ייהפך ל-true אחרי חיבור WhatsApp אם אין AGENT_NAME
};

/**
 * בודק שכל משתני הסביבה הקריטיים מוגדרים (לשימוש אחרי setup)
 */
function validateConfig() {
  const required = [
    { key: 'ANTHROPIC_API_KEY', value: config.anthropicApiKey },
    { key: 'GOOGLE_CLIENT_ID', value: config.google.clientId },
    { key: 'GOOGLE_CLIENT_SECRET', value: config.google.clientSecret },
    { key: 'GOOGLE_REFRESH_TOKEN', value: config.google.refreshToken },
    { key: 'OPENAI_API_KEY', value: config.openaiApiKey },
    { key: 'USER_PHONE_NUMBER', value: config.userPhoneNumber },
  ];

  const missing = required.filter((r) => !r.value).map((r) => r.key);

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * בודק האם ההגדרה הראשונית הושלמה
 */
function isSetupComplete() {
  const { valid } = validateConfig();
  return valid;
}

/**
 * שומר ערך ל-.env
 */
function saveToEnv(key, value) {
  const fs = require('fs');
  let content = '';

  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf-8');
  }

  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }

  fs.writeFileSync(ENV_PATH, content, 'utf-8');

  // עדכון ב-runtime
  process.env[key] = value;
}

module.exports = { config, validateConfig, isSetupComplete, saveToEnv, ENV_PATH };
