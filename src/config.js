'use strict';

require('dotenv').config();

const path = require('path');

function envValue(name) {
  if (Object.prototype.hasOwnProperty.call(process.env, name)) {
    return process.env[name];
  }

  return undefined;
}

function envString(name, fallback = '') {
  const value = envValue(name);

  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function envNonEmpty(name, fallback) {
  const value = envString(name, '');
  return value === '' ? fallback : value;
}

function envList(name, fallback = []) {
  const raw = envString(name, '');

  if (!raw) {
    return fallback;
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function envBoolean(name, fallback) {
  const raw = envString(name, '');

  if (raw === '') {
    return fallback;
  }

  const normalized = raw.toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`${name} must be true or false.`);
}

function envInteger(name, fallback, min, max) {
  const raw = envString(name, '');

  if (raw === '') {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }

  return value;
}

function envFloat(name, fallback, min, max) {
  const raw = envString(name, '');

  if (raw === '') {
    return fallback;
  }

  const value = Number.parseFloat(raw);

  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}.`);
  }

  return value;
}

const BOT_NAME = envNonEmpty(
  'BOT_NAME',
  '𒁂 𝘼𝙇𝙄𝙔𝘼 𝘽𝘼𝘽𝙔__༊⫸'
);

const OWNER_NAME = envNonEmpty(
  'OWNER_NAME',
  '𒁂【 𝘼𝘾𝙎 𝘾𝙔𝘽𝙀𝙍 𝙇𝙀𝘼𝘿𝙀𝙍 ☻ 𝙑𝘼𝙐 】𒁂⫸'
);

const BRANDING_NAME = envNonEmpty('BRANDING_NAME', 'ACS TONMOY');

const BOT_LANG = envNonEmpty('BOT_LANG', 'en').toLowerCase();

if (!['en', 'bn'].includes(BOT_LANG)) {
  throw new Error('BOT_LANG must be either "en" or "bn".');
}

const BOT_MODE = envNonEmpty('BOT_MODE', 'public').toLowerCase();

if (!['public', 'private'].includes(BOT_MODE)) {
  throw new Error('BOT_MODE must be either "public" or "private".');
}

const TIMEZONE = envNonEmpty('TIMEZONE', 'Asia/Dhaka');

try {
  new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE }).format(new Date());
} catch (error) {
  throw new Error(`Invalid TIMEZONE value: ${TIMEZONE}`);
}

const PREFIX = envNonEmpty('PREFIX', '.');
const OWNER_NUMBER = envString('OWNER_NUMBER', '');
const ALLOWED_USERS = envList('ALLOWED_USERS', []);

const LOG_LEVEL = envNonEmpty('LOG_LEVEL', 'info').toLowerCase();

if (!['debug', 'info', 'warn', 'error', 'silent'].includes(LOG_LEVEL)) {
  throw new Error(
    'LOG_LEVEL must be one of: debug, info, warn, error, silent.'
  );
}

const SESSION_CLIENT_ID = envNonEmpty(
  'SESSION_CLIENT_ID',
  'aliya-baby-bot'
);

if (!/^[A-Za-z0-9_-]+$/.test(SESSION_CLIENT_ID)) {
  throw new Error(
    'SESSION_CLIENT_ID may contain only letters, numbers, underscore and hyphen.'
  );
}

const sessionPathInput = envNonEmpty(
  'SESSION_DATA_PATH',
  path.join('data', 'session')
);

const SESSION_DATA_PATH = path.isAbsolute(sessionPathInput)
  ? sessionPathInput
  : path.resolve(process.cwd(), sessionPathInput);

const AI_ENABLED = envBoolean('AI_ENABLED', false);
const AI_API_KEY = envString('AI_API_KEY', '');
const AI_MODEL = envString('AI_MODEL', '');
const AI_READY = AI_ENABLED && Boolean(AI_API_KEY) && Boolean(AI_MODEL);

const RECONNECT_BASE_DELAY_MS = envInteger(
  'RECONNECT_BASE_DELAY_MS',
  5000,
  1000,
  600000
);

const RECONNECT_MAX_DELAY_MS = envInteger(
  'RECONNECT_MAX_DELAY_MS',
  60000,
  1000,
  3600000
);

if (RECONNECT_MAX_DELAY_MS < RECONNECT_BASE_DELAY_MS) {
  throw new Error(
    'RECONNECT_MAX_DELAY_MS must be greater than or equal to RECONNECT_BASE_DELAY_MS.'
  );
}

const config = Object.freeze({
  NODE_ENV: envNonEmpty('NODE_ENV', 'development'),
  BOT_NAME,
  OWNER_NAME,
  BRANDING_NAME,
  OWNER_NUMBER,
  ALLOWED_USERS,
  PREFIX,
  BOT_LANG,
  BOT_MODE,
  TIMEZONE,
  SHOW_OWNER_NUMBER: envBoolean('SHOW_OWNER_NUMBER', true),

  PORT: envInteger('PORT', 3000, 1, 65535),
  LOG_LEVEL,

  SESSION_CLIENT_ID,
  SESSION_DATA_PATH,
  PUPPETEER_EXECUTABLE_PATH: envString(
    'PUPPETEER_EXECUTABLE_PATH',
    ''
  ),

  AUTO_RECONNECT: envBoolean('AUTO_RECONNECT', true),
  RECONNECT_MAX_ATTEMPTS: envInteger(
    'RECONNECT_MAX_ATTEMPTS',
    5,
    0,
    100
  ),
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,

  MAX_MESSAGE_LENGTH: envInteger(
    'MAX_MESSAGE_LENGTH',
    4096,
    100,
    65536
  ),
  COMMAND_RATE_LIMIT_MAX: envInteger(
    'COMMAND_RATE_LIMIT_MAX',
    12,
    1,
    10000
  ),
  COMMAND_RATE_LIMIT_WINDOW_MS: envInteger(
    'COMMAND_RATE_LIMIT_WINDOW_MS',
    60000,
    1000,
    86400000
  ),
  RATE_LIMIT_MAX_ENTRIES: envInteger(
    'RATE_LIMIT_MAX_ENTRIES',
    5000,
    100,
    1000000
  ),

  AUTO_WELCOME: envBoolean('AUTO_WELCOME', false),
  AUTO_GOODBYE: envBoolean('AUTO_GOODBYE', false),
  WELCOME_MESSAGE: envString('WELCOME_MESSAGE', ''),
  GOODBYE_MESSAGE: envString('GOODBYE_MESSAGE', ''),

  ANTI_LINK: envBoolean('ANTI_LINK', false),
  ANTI_LINK_ALLOWED_DOMAINS: envList(
    'ANTI_LINK_ALLOWED_DOMAINS',
    []
  ),
  ANTI_LINK_EXEMPT_ADMINS: envBoolean(
    'ANTI_LINK_EXEMPT_ADMINS',
    true
  ),
  ANTI_LINK_WARN: envBoolean('ANTI_LINK_WARN', true),

  ANTI_SPAM: envBoolean('ANTI_SPAM', false),
  ANTI_SPAM_WINDOW_MS: envInteger(
    'ANTI_SPAM_WINDOW_MS',
    15000,
    1000,
    86400000
  ),
  ANTI_SPAM_MAX_MESSAGES: envInteger(
    'ANTI_SPAM_MAX_MESSAGES',
    8,
    1,
    100000
  ),
  ANTI_SPAM_EXEMPT_ADMINS: envBoolean(
    'ANTI_SPAM_EXEMPT_ADMINS',
    true
  ),
  ANTI_SPAM_WARN: envBoolean('ANTI_SPAM_WARN', true),

  AI_ENABLED,
  AI_READY,
  AI_API_KEY,
  AI_MODEL,
  AI_BASE_URL: envNonEmpty(
    'AI_BASE_URL',
    'https://api.openai.com/v1'
  ),
  AI_TIMEOUT_MS: envInteger(
    'AI_TIMEOUT_MS',
    15000,
    1000,
    120000
  ),
  AI_MAX_INPUT_CHARS: envInteger(
    'AI_MAX_INPUT_CHARS',
    2000,
    1,
    20000
  ),
  AI_MAX_OUTPUT_CHARS: envInteger(
    'AI_MAX_OUTPUT_CHARS',
    1200,
    1,
    20000
  ),
  AI_MAX_OUTPUT_TOKENS: envInteger(
    'AI_MAX_OUTPUT_TOKENS',
    300,
    1,
    4096
  ),
  AI_TEMPERATURE: envFloat('AI_TEMPERATURE', 0.4, 0, 2),
  AI_RATE_LIMIT_MAX: envInteger(
    'AI_RATE_LIMIT_MAX',
    5,
    1,
    1000
  ),
  AI_RATE_LIMIT_WINDOW_MS: envInteger(
    'AI_RATE_LIMIT_WINDOW_MS',
    60000,
    1000,
    86400000
  ),
  AI_REPLY_IN_GROUPS: envBoolean(
    'AI_REPLY_IN_GROUPS',
    false
  ),
  AI_SYSTEM_PROMPT: envNonEmpty(
    'AI_SYSTEM_PROMPT',
    'You are a helpful WhatsApp assistant. Keep replies concise, safe, and polite. Do not reveal secrets.'
  )
});

module.exports = config;
