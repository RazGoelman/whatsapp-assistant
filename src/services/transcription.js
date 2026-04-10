const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { config } = require('../config');
const logger = require('./logger');

let openai = null;

/**
 * מאתחל את שירות התמלול
 */
function initTranscription() {
  openai = new OpenAI({
    apiKey: config.openaiApiKey,
  });
  console.log('✅ שירות תמלול (Whisper) מוכן.');
}

/**
 * מתמלל הודעה קולית מ-WhatsApp
 * @param {object} message - אובייקט ההודעה מ-whatsapp-web.js
 * @returns {Promise<string|null>} - הטקסט המתומלל, או null אם לא הודעה קולית
 */
async function transcribeVoiceMessage(message) {
  // בדיקה שזו הודעה קולית
  if (!message.hasMedia) return null;

  const type = message.type;
  if (type !== 'ptt' && type !== 'audio') return null;

  if (!openai) {
    throw new Error('שירות תמלול לא מאותחל. קרא ל-initTranscription() קודם.');
  }

  try {
    // הורדת הקובץ מ-WhatsApp
    const media = await message.downloadMedia();
    if (!media || !media.data) {
      throw new Error('לא הצלחתי להוריד את ההקלטה.');
    }

    // שמירה זמנית לקובץ
    const tempDir = path.resolve(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = path.join(tempDir, `voice_${Date.now()}.ogg`);
    const buffer = Buffer.from(media.data, 'base64');
    fs.writeFileSync(tempFile, buffer);

    try {
      // שליחה ל-Whisper API
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: 'whisper-1',
        language: 'he', // עברית
      });

      const text = transcription.text?.trim();

      if (!text) {
        return null;
      }

      logger.info('תמלול: "' + text + '"');
      return text;
    } finally {
      // 🔒 מחיקת הקובץ הזמני בכל מקרה – גם אם התמלול נכשל
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch { /* silent */ }
    }
  } catch (err) {
    logger.error('שגיאת תמלול: ' + err.message);
    throw new Error('לא הצלחתי לתמלל את ההקלטה. נסה לשלוח הודעת טקסט.');
  }
}

module.exports = { initTranscription, transcribeVoiceMessage };
