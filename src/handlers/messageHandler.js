'use strict';

const { t } = require('../utils/language');
const { getSenderId, isGroupId } = require('../utils/identity');
const { safeReply } = require('../utils/formatting');
const {
  checkCommandPermission
} = require('../middleware/permissions');
const { handleAntiLink } = require('../middleware/antiLink');
const { handleAntiSpam } = require('../middleware/antiSpam');
const { handleAiReply } = require('../utils/ai');

async function processCommand({
  client,
  message,
  parsedCommand,
  config,
  logger,
  commandManager,
  limiters,
  senderId
}) {
  const lang = config.BOT_LANG;
  const command = commandManager.resolve(parsedCommand.name);

  if (!command) {
    const unknownRate = limiters.command.consume(
      `command:${message.from}:${senderId}`
    );

    if (!unknownRate.allowed) {
      const seconds = Math.max(
        1,
        Math.ceil(unknownRate.retryAfterMs / 1000)
      );

      await safeReply(
        message,
        t('errors.rateLimited', lang, { seconds })
      );

      logger.warn('Unknown command rate limit triggered.', {
        scope: isGroupId(message.from) ? 'group' : 'private'
      });
      return;
    }

    await safeReply(
      message,
      t('errors.unknownCommand', lang, {
        command: parsedCommand.name,
        prefix: config.PREFIX
      })
    );
    return;
  }

  const permission = await checkCommandPermission({
    command,
    message,
    client,
    config
  });

  if (!permission.allowed) {
    await safeReply(
      message,
      t(permission.messageKey, lang)
    );
    return;
  }

  const rate = limiters.command.consume(
    `command:${message.from}:${senderId}`
  );

  if (!rate.allowed) {
    const seconds = Math.max(1, Math.ceil(rate.retryAfterMs / 1000));

    await safeReply(
      message,
      t('errors.rateLimited', lang, { seconds })
    );

    logger.warn('Command rate limit triggered.', {
      command: command.name,
      scope: isGroupId(message.from) ? 'group' : 'private'
    });
    return;
  }

  try {
    await command.execute({
      client,
      message,
      args: parsedCommand.args,
      config,
      logger,
      commandManager,
      limiters,
      t
    });
  } catch (error) {
    logger.error('Command execution failed.', {
      command: command.name,
      error
    });

    await safeReply(
      message,
      t('errors.commandFailed', lang)
    );
  }
}

async function handleIncomingMessage({
  client,
  message,
  config,
  logger,
  commandManager,
  limiters
}) {
  if (!message || message.fromMe) {
    return;
  }

  if (message.from === 'status@broadcast') {
    return;
  }

  const body = typeof message.body === 'string' ? message.body : '';

  if (!body) {
    return;
  }

  if (body.length > config.MAX_MESSAGE_LENGTH) {
    logger.warn('Ignored oversized message.', {
      scope: isGroupId(message.from) ? 'group' : 'private'
    });
    return;
  }

  const senderId = getSenderId(message);

  if (!senderId) {
    return;
  }

  const spamHandled = await handleAntiSpam({
    message,
    client,
    config,
    logger,
    limiters,
    t
  });

  if (spamHandled) {
    return;
  }

  const linkHandled = await handleAntiLink({
    message,
    client,
    config,
    logger,
    t
  });

  if (linkHandled) {
    return;
  }

  const parsedCommand = commandManager.parseCommand(
    body,
    config.PREFIX
  );

  if (parsedCommand) {
    await processCommand({
      client,
      message,
      parsedCommand,
      config,
      logger,
      commandManager,
      limiters,
      senderId
    });
    return;
  }

  if (config.AI_ENABLED) {
    try {
      await handleAiReply({
        message,
        client,
        config,
        logger,
        limiters,
        t
      });
    } catch (error) {
      logger.error('AI reply handler failed.', { error });
    }
  }
}

module.exports = {
  handleIncomingMessage
};
