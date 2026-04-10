const { config } = require('../config');

/**
 * בודק אם ההודעה מתחילה בשם הסוכן.
 * תומך ב-multi-tenant: אם agentName מסופק, משתמש בו. אחרת משתמש ב-config.
 *
 * @param {string} messageBody - תוכן ההודעה
 * @param {string} [agentName] - שם הסוכן (per-tenant)
 * @returns {string|null} - התוכן ללא שם הסוכן, או null
 */
function extractAgentCommand(messageBody, agentName) {
  if (!messageBody) return null;

  const name = (agentName || config.agentName || '').trim();
  if (!name) return null;

  const body = messageBody.trim();

  if (!name) return null;

  // בדיקה case-insensitive (עובד גם עם עברית)
  const bodyLower = body.toLowerCase();
  const nameLower = name.toLowerCase();

  if (!bodyLower.startsWith(nameLower)) {
    return null;
  }

  // הסרת שם הסוכן מתחילת ההודעה
  let content = body.substring(name.length).trim();

  // הסרת תווים מפרידים אחרי השם (פסיק, נקודה, מקף וכו')
  content = content.replace(/^[,،.\-:!؟?\s]+/, '').trim();

  // אם אחרי הסרת השם לא נשאר תוכן
  if (!content) {
    return null;
  }

  return content;
}

module.exports = { extractAgentCommand };
