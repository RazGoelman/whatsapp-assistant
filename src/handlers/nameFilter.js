const { config } = require('../config');

/**
 * בודק אם ההודעה מתחילה בשם הסוכן.
 * אם כן – מחזיר את תוכן ההודעה ללא השם.
 * אם לא – מחזיר null (מתעלמים מההודעה).
 *
 * @param {string} messageBody - תוכן ההודעה
 * @returns {string|null} - התוכן ללא שם הסוכן, או null
 */
function extractAgentCommand(messageBody) {
  if (!messageBody || !config.agentName) return null;

  const body = messageBody.trim();
  const name = config.agentName.trim();

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
