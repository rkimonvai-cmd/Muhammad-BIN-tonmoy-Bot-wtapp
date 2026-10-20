'use strict';

function extractRawId(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && value._serialized) {
    return String(value._serialized);
  }

  return '';
}

function normalizePhoneNumber(value) {
  const raw = extractRawId(value);

  if (!raw) {
    return '';
  }

  return raw
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '');
}

function sameUser(left, right) {
  const leftRaw = extractRawId(left).toLowerCase();
  const rightRaw = extractRawId(right).toLowerCase();

  if (leftRaw && rightRaw && leftRaw === rightRaw) {
    return true;
  }

  const leftNumber = normalizePhoneNumber(left);
  const rightNumber = normalizePhoneNumber(right);

  return Boolean(
    leftNumber &&
      rightNumber &&
      leftNumber === rightNumber
  );
}

function isGroupId(value) {
  return typeof value === 'string' && value.endsWith('@g.us');
}

function getSenderId(message) {
  if (!message) {
    return '';
  }

  return extractRawId(message.author || message.from);
}

function formatMention(value) {
  const raw = extractRawId(value).split('@')[0].split(':')[0];
  return raw ? `@${raw}` : 'user';
}

module.exports = {
  extractRawId,
  normalizePhoneNumber,
  sameUser,
  isGroupId,
  getSenderId,
  formatMention
};
