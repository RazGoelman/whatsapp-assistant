const Anthropic = require('@anthropic-ai/sdk');
const { config } = require('../config');

let anthropic = null;

/**
 * מאתחל את חיבור Claude API
 */
function initAI() {
  anthropic = new Anthropic({
    apiKey: config.anthropicApiKey,
  });
  console.log('✅ Claude API מוכן.');
}

/**
 * בונה את ה-System Prompt בזמן ריצה (לא ב-load time)
 * כדי שישתמש בשם הסוכן העדכני (שנקבע ב-onboarding)
 */
function buildSystemPrompt() {
  const now = new Date().toLocaleString('he-IL', { timeZone: config.timezone });
  const today = new Date().toLocaleDateString('he-IL', {
    timeZone: config.timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `אתה עוזר אישי חכם בשם "${config.agentName}". 
אתה מקבל הודעות מהמשתמש דרך WhatsApp ומבצע פעולות עבורו.
אזור הזמן של המשתמש: ${config.timezone}.
היום: ${today}.
השעה הנוכחית: ${now}.

עליך לנתח כל הודעה ולהחזיר תשובה **אך ורק** בפורמט JSON הבא (ללא טקסט נוסף, ללא markdown):

{
  "intent": "create_event" | "create_meeting" | "update_event" | "delete_event" | "set_reminder" | "compose_message" | "daily_summary" | "general",
  "response": "תשובה ידידותית בעברית למשתמש",
  "params": {
    // פרמטרים רלוונטיים לפי סוג הכוונה:
    // create_event / create_meeting:
    //   "title": "כותרת האירוע",
    //   "date": "YYYY-MM-DD",
    //   "time": "HH:MM",
    //   "duration_minutes": 60,
    //   "attendees": ["שם"],
    //   "email": "כתובת מייל (רק ל-create_meeting)"
    //
    // update_event:
    //   "search_query": "מילות חיפוש לאירוע",
    //   "updates": { "date": "...", "time": "...", "title": "..." }
    //
    // delete_event:
    //   "search_query": "מילות חיפוש לאירוע"
    //
    // set_reminder:
    //   "title": "תוכן התזכורת",
    //   "date": "YYYY-MM-DD",
    //   "time": "HH:MM"
    //
    // compose_message:
    //   "draft": "טקסט ההודעה המנוסחת"
  }
}

כללים חשובים:
1. תמיד החזר JSON תקין בלבד – ללא backticks, ללא הסברים.
2. אם חסר מידע (כמו תאריך או שעה) – שאל את המשתמש ב-response והשתמש ב-intent: "general".
3. ל-create_meeting: אם לא צוין מייל, בקש אותו ב-response.
4. תרגם תאריכים יחסיים ("מחר", "ביום ראשון", "בעוד שעתיים") לתאריכים ושעות מדויקים על בסיס התאריך והשעה הנוכחיים.
5. ברירת מחדל למשך אירוע: 60 דקות.
6. דבר בעברית, בטון ידידותי וקצר.`; 
}

/**
 * שולח הודעה ל-Claude ומקבל תשובה מובנית
 * @param {string} userMessage - ההודעה מהמשתמש
 * @returns {Promise<{intent: string, response: string, params: object}>}
 */
async function processMessage(userMessage) {
  if (!anthropic) {
    throw new Error('Claude API לא מאותחל. קרא ל-initAI() קודם.');
  }

  try {
    const systemPrompt = buildSystemPrompt();

    const message = await anthropic.messages.create({
      model: config.aiModel,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const responseText = message.content[0].text.trim();

    // ניסיון לפרסר JSON
    let parsed;
    try {
      // הסרת backticks אם קיימים
      const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // אם Claude לא החזיר JSON תקין – מחזירים כתשובה כללית
      return {
        intent: 'general',
        response: responseText,
        params: {},
      };
    }

    return {
      intent: parsed.intent || 'general',
      response: parsed.response || '',
      params: parsed.params || {},
    };
  } catch (err) {
    if (err.status === 429) {
      throw new Error('⏳ יותר מדי בקשות. נסה שוב בעוד דקה.');
    }
    if (err.status === 401) {
      throw new Error('🔑 מפתח API לא תקין. בדוק את ANTHROPIC_API_KEY.');
    }
    throw new Error(`שגיאת AI: ${err.message}`);
  }
}

module.exports = { initAI, processMessage };
