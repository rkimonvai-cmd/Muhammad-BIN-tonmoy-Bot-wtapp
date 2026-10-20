'use strict';

const { getSenderId, isGroupId, formatMention } = require('../utils/identity');
const {
  getChatForMessage,
  isSenderGroupAdmin,
  isBotGroupAdmin
} = require('../utils/groupUtils');

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const MAX_URLS_PER_MESSAGE = 20;

function cleanUrl(value) {
  let cleaned = String(value).trim();

  while (cleaned.length > 0 && /[)\].,!?;:]$/.test(cleaned)) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned;
}

function extractUrls(text) {
  const matches = String(text).match(URL_PATTERN) || [];

  return matches
    .slice(0, MAX_URLS_PER_MESSAGE)
    .map(cleanUrl)
    .filter(Boolean);
}

function getHostname(value) {
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
      ? value
      : `http://${value}`;

    return new URL(candidate).hostname
      .toLowerCase()
      .replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}

function normalizeDomain(value) {
  let domain = String(value || '').trim().toLowerCase();

  if (!domain) {
    return '';
  }

  if (domain.includes('://')) {
    try {
      domain = new URL(domain).hostname;
    } catch (error) {
      return '';
    }
  }

  return domain.replace(/^www\./, '').replace(/\.$/, '');
}

function isHostAllowed(hostname, allowedDomains) {
  for (const rawDomain of allowedDomains) {
    const domain = normalizeDomain(rawDomain);

    if (!domain) {
      continue;
    }

    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return true;
    }
  }

  return false;
}

function hasDisallowedLink(text, allowedDomains) {
  const urls = extractUrls(text);

  for (const url of urls) {
    const hostname = getHostname(url);

    if (!hostname) {
      continue;
    }

    if (!isHostAllowed(hostname, allowedDomains)) {
      return true;
    }
  }

  return false;
}

async function handleAntiLink({
  message,
  client,
  config,
  logger,
  t
}) {
  if (!config.ANTI_LINK || !isGroupId(message.from)) {
    return false;
  }

  const body = typeof message.body === 'string' ? message.body : '';

  if (!body) {
    return false;
  }

  const allowedDomains = Array.isArray(
    config.ANTI_LINK_ALLOWED_DOMAINS
  )
    ? config.ANTI_LINK_ALLOWED_DOMAINS
    : [];

  if (!hasDisallowedLink(body, allowedDomains)) {
    return false;
  }

  const chat = await getChatForMessage(message);

  if (!chat || !chat.isGroup) {
    return false;
  }

  const senderId = getSenderId(message);

  if (
    config.ANTI_LINK_EXEMPT_ADMINS &&
    isSenderGroupAdmin(chat, senderId)
  ) {
    return false;
  }

  if (!isBotGroupAdmin(client, chat)) {
    logger.warn(
      'Anti-link detected a link, but the bot is not a group admin. No moderation action was taken.',
      { scope: 'group' }
    );
    return false;
  }

  try {
    await message.delete(true);
  } catch (error) {
    logger.error('Anti-link message deletion failed.', { error });
    return false;
  }

  if (config.ANTI_LINK_WARN) {
    const mention = formatMention(senderId);

    try {
      await chat.sendMessage(
        t('antiLink.warning', config.BOT_LANG, {
          user: mention
        }),
        {
          mentions: senderId ? [senderId] : []
        }
      );
    } catch (error) {
      logger.warn('Anti-link warning message failed.', { error });
    }
  }

  logger.info('Anti-link message deleted.', {
    scope: 'group'
  });

  return true;
}

module.exports = {
  handleAntiLink,
  hasDisallowedLink,
  extractUrls
};
