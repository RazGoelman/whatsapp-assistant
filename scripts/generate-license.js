#!/usr/bin/env node

/**
 * 🔑 מחולל רישיונות – כלי ניהול למנהל המערכת
 * 
 * שימוש:
 *   node scripts/generate-license.js                  → מייצר מפתח חדש
 *   node scripts/generate-license.js --list            → מציג את כל המפתחות
 *   node scripts/generate-license.js --revoke KEY      → מבטל מפתח
 *   node scripts/generate-license.js --name "שם הלקוח" → מייצר מפתח עם שם
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LICENSES_FILE = path.resolve(__dirname, '../licenses.json');
const SECRET = 'WA-ASSISTANT-LICENSE-2026'; // salt for HMAC

function loadLicenses() {
  if (!fs.existsSync(LICENSES_FILE)) {
    return { licenses: [] };
  }
  return JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf-8'));
}

function saveLicenses(data) {
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * מייצר מפתח רישיון ייחודי
 * פורמט: WA-XXXX-XXXX-XXXX-XXXX
 */
function generateKey() {
  const raw = crypto.randomBytes(16).toString('hex');
  const parts = [
    raw.substring(0, 4),
    raw.substring(4, 8),
    raw.substring(8, 12),
    raw.substring(12, 16),
  ].map(p => p.toUpperCase());
  return 'WA-' + parts.join('-');
}

/**
 * יוצר חתימה למפתח (HMAC) לאימות
 */
function signKey(key) {
  return crypto.createHmac('sha256', SECRET).update(key).digest('hex').substring(0, 16);
}

// === CLI ===
const args = process.argv.slice(2);

if (args.includes('--list')) {
  const data = loadLicenses();
  console.log('\n🔑 רישיונות קיימים:\n');
  if (data.licenses.length === 0) {
    console.log('   אין רישיונות. צור עם: node scripts/generate-license.js --name "שם"');
  }
  data.licenses.forEach((lic, i) => {
    const status = lic.revoked ? '🔴 מבוטל' : (lic.activated ? '🟢 פעיל' : '🟡 ממתין');
    console.log(`   ${i + 1}. ${lic.key}`);
    console.log(`      שם: ${lic.name || 'לא צוין'} | סטטוס: ${status} | נוצר: ${lic.createdAt}`);
    if (lic.activatedAt) console.log(`      הופעל: ${lic.activatedAt} | מכשיר: ${lic.deviceId || '?'}`);
    console.log('');
  });
  process.exit(0);
}

if (args.includes('--revoke')) {
  const keyIndex = args.indexOf('--revoke');
  const keyToRevoke = args[keyIndex + 1];
  if (!keyToRevoke) {
    console.error('❌ ציין מפתח לביטול: --revoke WA-XXXX-XXXX-XXXX-XXXX');
    process.exit(1);
  }
  const data = loadLicenses();
  const lic = data.licenses.find(l => l.key === keyToRevoke);
  if (!lic) {
    console.error('❌ מפתח לא נמצא: ' + keyToRevoke);
    process.exit(1);
  }
  lic.revoked = true;
  lic.revokedAt = new Date().toISOString();
  saveLicenses(data);
  console.log('✅ מפתח בוטל: ' + keyToRevoke);
  process.exit(0);
}

// ברירת מחדל: יצירת מפתח חדש
const nameIndex = args.indexOf('--name');
const name = nameIndex >= 0 ? args[nameIndex + 1] : '';

const key = generateKey();
const signature = signKey(key);

const data = loadLicenses();
data.licenses.push({
  key,
  signature,
  name: name || 'לא צוין',
  createdAt: new Date().toISOString(),
  activated: false,
  activatedAt: null,
  deviceId: null,
  revoked: false,
});
saveLicenses(data);

console.log('\n🔑 מפתח רישיון חדש נוצר:\n');
console.log('   ' + key);
console.log('');
if (name) console.log('   שם: ' + name);
console.log('   שלח את המפתח ללקוח. הוא יזין אותו בדף ה-Setup.');
console.log('   המפתח חד-פעמי – לאחר הפעלה הוא ננעל למכשיר אחד.\n');
