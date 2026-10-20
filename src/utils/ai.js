'use strict';

const { getSenderId } = require('./identity');

function buildChatCompletionsUrl(baseUrl) {
  const normalized = String(baseUrl || '').replace(/\/+$/, '');

  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }

  return `${normalized}/chat/completions`;
}

function extractProviderText(data) {
  const content = data
    && data.choices
    && data.choices[0]
    && data.choices[0].message
    && data.choices[0].message.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join('');
  }

  return '';
}

function sanitizeAiOutput(value, maxLength) {
  const cleaned = String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();

  if (!cleaned) {
    return '';
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, Math.max(0, maxLength - 1))}…`;
}

async function requestAiCompletion(input, config) {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available in this Node.js runtime.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, config.AI_TIMEOUT_MS);

  if (typeof timeout.unref === 'function') {
    timeout.unref();
  }

  try {
    const response = await fetch(
      buildChatCompletionsUrl(config.AI_BASE_URL),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.AI_API_KEY}`
        },
        body: JSON.stringify({
          model: config.AI_MODEL,
          messages: [
            {
              role: 'system',
              content: config.AI_SYSTEM_PROMPT
            },
            {
              role: 'user',
              content: input
            }
          ],
          max_tokens: config.AI_MAX_OUTPUT_TOKENS,
          temperature: config.AI_TEMPERATURE
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(
        `AI provider returned HTTP ${response.status}.`
      );
    }

    const data = await response.json();
    const text = extractProviderText(data);

    if (!text) {
      throw new Error('AI provider response did not contain text.');
    }

    return sanitizeAiOutput(text, config.AI_MAX_OUTPUT_CHARS);
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error('AI request timed out.');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function isBotMentioned(message, client) {
  const botWid = client && client.info && client.info.wid;
  const botSerialized =
    botWid && (botWid._serialized || String(botWid));
  const botUser = botWid && botWid.user ? String(botWid.user) : '';

  const mentionedIds = Array.isArray(message.mentionedIds)
    ? message.mentionedIds
    : [];

  if (
    botSerialized &&
    mentionedIds.some(
      (id) => String(id) === String(botSerialized)
    )
  ) {
    return true;
  }

  if (
    botUser &&
    mentionedIds.some((id) => String(id).includes(botUser))
  ) {
    return true;
  }

  if (
    botUser &&
    typeof message.body === 'string' &&
    message.body.includes(`@${botUser}`)
  ) {
    return true;
  }

  if (message.hasQuotedMsg) {
    try {
      const quotedMessage = await message.getQuotedMessage();

      if (quotedMessage && quotedMessage.fromMe) {
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  return false;
}

async function handleAiReply({
  message,
  client,
  config,
  logger,
  limiters
}) {
  if (
    !config.AI_READY ||
    !limiters ||
    !limiters.ai
  ) {
    return false;
  }

  const input =
    typeof message.body === 'string'
      ? message.body.trim()
      : '';

  if (!input) {
    return false;
  }

  if (input.length > config.AI_MAX_INPUT_CHARS) {
    return false;
  }

  const chat = await message.getChat();

  if (!chat) {
    return false;
  }

  if (chat.isGroup) {
    if (!config.AI_REPLY_IN_GROUPS) {
      return false;
    }

    const mentioned = await isBotMentioned(message, client);

    if (!mentioned) {
      return false;
    }
  }

  const senderId = getSenderId(message);
  const chatId = chat.id && chat.id._serialized
    ? chat.id._serialized
    : message.from;

  const rate = limiters.ai.consume(`${chatId}:${senderId}`);

  if (!rate.allowed) {
    logger.debug('AI rate limit reached; reply skipped.');
    return false;
  }

  try {
    const answer = await requestAiCompletion(input, config);

    if (!answer) {
      return false;
    }

    await message.reply(answer);

    logger.info('AI reply sent.', {
      scope: chat.isGroup ? 'group' : 'private'
    });

    return true;
  } catch (error) {
    logger.error('AI request failed.', { error });
    return false;
  }
}

module.exports = {
  handleAiReply,
  requestAiCompletion,
  isBotMentioned
};
