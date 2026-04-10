const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { config, saveToEnv } = require('../config');
const logger = require('./logger');

const LICENSES_FILE = path.resolve(__dirname, '../../licenses.json');
const SECRET = 'WA-ASSISTANT-LICENSE-2026';

/**
 * בודק אם מפתח רישיון תקין
 * @param {string} key - מפתח בפורמט WA-XXXX-XXXX-XXXX-XXXX
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateLicense(key) {
  if (!key) {
    return { valid: false, error: 'לא הוזן מפתח רישיון.' };
  }

  // בדיקת פורמט
  if (!/^WA-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(key)) {
    return { valid: false, error: 'פורמט מפתח לא תקין.' };
  }

  // טעינת קובץ רישיונות
  if (!fs.existsSync(LICENSES_FILE)) {
    return { valid: false, error: 'קובץ רישיונות לא נמצא.' };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf-8'));
  } catch {
    return { valid: false, error: 'שגיאה בקריאת קובץ רישיונות.' };
  }

  // חיפוש המפתח
  const license = data.licenses.find(l => l.key === key);
  if (!license) {
    return { valid: false, error: 'מפתח רישיון לא קיים.' };
  }

  // בדיקה אם מבוטל
  if (license.revoked) {
    return { valid: false, error: 'מפתח רישיון בוטל.' };
  }

  // אימות חתימה
  const expectedSig = crypto.createHmac('sha256', SECRET).update(key).digest('hex').substring(0, 16);
  if (license.signature !== expectedSig) {
    return { valid: false, error: 'חתימת מפתח לא תקינה.' };
  }

  // בדיקה אם כבר הופעל על מכשיר אחר
  const currentDeviceId = generateDeviceId();
  if (license.activated && license.deviceId && license.deviceId !== currentDeviceId) {
    return { valid: false, error: 'מפתח זה כבר בשימוש על מכשיר אחר.' };
  }

  return { valid: true, error: null };
}

/**
 * מפעיל רישיון – נועל אותו למכשיר הנוכחי
 * @param {string} key
 * @returns {boolean}
 */
function activateLicense(key) {
  const { valid, error } = validateLicense(key);
  if (!valid) {
    logger.error('הפעלת רישיון נכשלה: ' + error);
    return false;
  }

  try {
    const data = JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf-8'));
    const license = data.licenses.find(l => l.key === key);

    if (!license.activated) {
      license.activated = true;
      license.activatedAt = new Date().toISOString();
      license.deviceId = generateDeviceId();
      fs.writeFileSync(LICENSES_FILE, JSON.stringify(data, null, 2), 'utf-8');
      logger.info('רישיון הופעל: ' + key.substring(0, 7) + '...');
    }

    // שמירת המפתח ב-.env
    saveToEnv('LICENSE_KEY', key);
    config.licenseKey = key;

    return true;
  } catch (err) {
    logger.error('שגיאה בהפעלת רישיון: ' + err.message);
    return false;
  }
}

/**
 * מייצר מזהה ייחודי למכשיר/שרת הנוכחי
 * מבוסס על hostname + platform + זמן יצירה ראשונה
 */
function generateDeviceId() {
  const os = require('os');
  const raw = os.hostname() + '|' + os.platform() + '|' + os.arch() + '|' + (config.userPhoneNumber || 'unknown');
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 12);
}

/**
 * בודק אם יש רישיון תקין (לבדיקה בהפעלה)
 */
function isLicensed() {
  const key = config.licenseKey;
  if (!key) return false;
  const { valid } = validateLicense(key);
  return valid;
}

module.exports = { validateLicense, activateLicense, isLicensed, generateDeviceId };
