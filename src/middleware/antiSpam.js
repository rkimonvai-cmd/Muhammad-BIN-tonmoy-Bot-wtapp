'use strict';

const {
  getSenderId,
  isGroupId,
  formatMention
} = require('../utils/identity');
const {
  getChatForMessage,
  isSenderGroupAdmin,
  isBotGroupAdmin
} = require('../utils/groupUtils');

async function handleAntiSpam({
  message,
  client,
  config,
  logger,
  limiters,
  t
}) {
  if (
    !config.ANTI_SPAM ||
    !isGroupId(message.from) ||
    !limiters ||
    !limiters.antiSpam
  ) {
    return false;
  }

  const chat = await getChatForMessage(message);

  if (!chat || !chat.isGroup) {
    return false;
  }

  const senderId = getSenderId(message);

  if (
    config.ANTI_SPAM_EXEMPT_ADMINS &&
    isSenderGroupAdmin(chat, senderId)
  ) {
    return false;
  }

  const key = `${chat.id ? chat.id._serialized : message.from}:${senderId}`;
  const result = limiters.antiSpam.consume(key);

  if (result.allowed) {
    return false;
  }

  const firstThresholdBreach =
    result.count === limiters.antiSpam.max + 1;

  if (!isBotGroupAdmin(client, chat)) {
    if (firstThresholdBreach) {
      logger.warn(
        'Anti-spam threshold exceeded, but the bot is not a group admin. No moderation action was taken.',
        { scope: 'group' }
      );
    }

    return false;
  }

  try {
    await message.delete(true);
  } catch (error) {
    logger.error('Anti-spam message deletion failed.', { error });
    return false;
  }

  if (config.ANTI_SPAM_WARN && firstThresholdBreach) {
    const mention = formatMention(senderId);

    try {
      await chat.sendMessage(
        t('antiSpam.warning', config.BOT_LANG, {
          user: mention
        }),
        {
          mentions: senderId ? [senderId] : []
        }
      );
    } catch (error) {
      logger.warn('Anti-spam warning message failed.', { error });
    }
  }

  logger.info('Anti-spam message deleted.', {
    scope: 'group'
  });

  return true;
}

module.exports = {
  handleAntiSpam
};
