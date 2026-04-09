/**
 * מטפל בניסוח הודעות חכמות.
 * המשתמש מבקש "תנסח לי הודעה ל..." וה-AI מחזיר טקסט מוכן.
 *
 * @param {object} params - פרמטרים מה-AI
 * @param {string} aiResponse - תשובת ה-AI
 * @returns {Promise<string>}
 */
async function handleComposeMessage(params, aiResponse) {
  const { draft } = params;

  if (draft) {
    return `✉️ הנה ההודעה:\n\n${draft}\n\n📋 העתק ושלח.`;
  }

  // fallback לתשובת ה-AI
  return aiResponse || 'לא הצלחתי לנסח את ההודעה. נסה שוב עם יותר פרטים.';
}

module.exports = { handleComposeMessage };
