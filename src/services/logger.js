/**
 * מערכת לוגים מרכזית עם רמות: info, warn, error
 */

function getTimestamp() {
  return new Date().toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function info(message, ...args) {
  console.log(`[${getTimestamp()}] ℹ️  ${message}`, ...args);
}

function warn(message, ...args) {
  console.warn(`[${getTimestamp()}] ⚠️  ${message}`, ...args);
}

function error(message, ...args) {
  console.error(`[${getTimestamp()}] ❌ ${message}`, ...args);
}

module.exports = { info, warn, error };
