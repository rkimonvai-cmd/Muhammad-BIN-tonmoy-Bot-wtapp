'use strict';

function truncate(value, maxLength = 300) {
  const text = String(value || '');
  const limit =
    Number.isFinite(maxLength) && maxLength > 0
      ? Math.floor(maxLength)
      : 300;

  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, Math.max(0, limit - 1))}…`;
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(
    0,
    Math.floor(Number(seconds) || 0)
  );

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds}s`);
  }

  return parts.join(' ');
}

function formatDateTime(date, timeZone, locale = 'en-GB', options = {}) {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      ...options
    }).format(date);
  } catch (error) {
    return new Date(date).toISOString();
  }
}

async function safeReply(message, text) {
  if (!message || typeof message.reply !== 'function') {
    return false;
  }

  try {
    await message.reply(text);
    return true;
  } catch (error) {
    try {
      const chat = await message.getChat();

      if (chat && typeof chat.sendMessage === 'function') {
        await chat.sendMessage(text);
        return true;
      }
    } catch (fallbackError) {
      return false;
    }
  }

  return false;
}

module.exports = {
  truncate,
  formatDuration,
  formatDateTime,
  safeReply
};
