'use strict';

const qrcode = require('qrcode-terminal');
const { t } = require('../utils/language');
const { getSenderId, isGroupId } = require('../utils/identity');
const { handleIncomingMessage } = require('./messageHandler');

function renderTemplate(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return String(values[key]);
    }

    return match;
  });
}

function collectRecipientIds(notification) {
  const collected = new Set();

  if (notification && Array.isArray(notification.recipientIds)) {
    for (const id of notification.recipientIds) {
      if (id) {
        collected.add(id);
      }
    }
  }

  if (notification && notification.recipientId) {
    collected.add(notification.recipientId);
  }

  if (notification && notification.id && notification.id.participant) {
    collected.add(notification.id.participant);
  }

  return Array.from(collected)
    .map((id) => {
      if (typeof id === 'string') {
        return id;
      }

      if (id && typeof id === 'object' && id._serialized) {
        return id._serialized;
      }

      return '';
    })
    .filter(Boolean);
}

function makeMentionLabel(id) {
  const base = String(id).split('@')[0].split(':')[0];
  return base ? `@${base}` : '';
}

async function sendGroupNotification({
  client,
  notification,
  template,
  config,
  logger,
  kind
}) {
  const chatId = notification && notification.chatId;

  if (!chatId || !isGroupId(chatId)) {
    return;
  }

  const chat = await client.getChatById(chatId);

  if (!chat || !chat.isGroup) {
    return;
  }

  const recipientIds = collectRecipientIds(notification);
  const mentionIds = recipientIds.filter(
    (id) => id.endsWith('@c.us') || id.endsWith('@lid')
  );

  const mentionText = mentionIds.length
    ? ` ${mentionIds.map(makeMentionLabel).filter(Boolean).join(', ')}`
    : '';

  const text = renderTemplate(template, {
    group: chat.name || t('common.unknown', config.BOT_LANG),
    mention: mentionText,
    botName: config.BOT_NAME,
    branding: config.BRANDING_NAME
  }).trim();

  if (!text) {
    return;
  }

  const options = mentionIds.length
    ? { mentions: mentionIds }
    : {};

  await chat.sendMessage(text, options);

  logger.info('Group notification message sent.', {
    kind
  });
}

function registerEventHandlers({
  client,
  config,
  logger,
  status,
  commandManager,
  limiters
}) {
  client.on('qr', (qr) => {
    status.state = 'qr_pending';
    status.ready = false;
    status.authenticated = false;
    status.authFailure = false;
    status.qrIssuedAt = new Date().toISOString();

    logger.info(
      'QR code generated. Scan it from WhatsApp > Linked Devices. The QR code is printed only in server logs and is not exposed over HTTP.'
    );

    qrcode.generate(qr, { small: true });
  });

  client.on('loading_screen', (percent, message) => {
    logger.debug('WhatsApp loading screen.', {
      percent,
      message
    });
  });

  client.on('authenticated', () => {
    status.state = 'authenticated';
    status.authenticated = true;
    status.authFailure = false;
    logger.info('WhatsApp authentication succeeded.');
  });

  client.on('auth_failure', (message) => {
    status.state = 'auth_failure';
    status.ready = false;
    status.authenticated = false;
    status.authFailure = true;

    logger.error(
      'WhatsApp authentication failed. The session may be invalid. Restart the service and scan a new QR code if required.',
      { error: message }
    );
  });

  client.on('ready', () => {
    status.state = 'ready';
    status.ready = true;
    status.authenticated = true;
    status.authFailure = false;
    status.lastReadyAt = new Date().toISOString();

    logger.info('WhatsApp client is ready.', {
      botName: config.BOT_NAME
    });
  });

  client.on('disconnected', (reason) => {
    status.state = 'disconnected';
    status.ready = false;
    status.authenticated = false;

    logger.warn('WhatsApp client disconnected.', {
      reason: String(reason || 'UNKNOWN')
    });
  });

  client.on('change_state', (state) => {
    logger.info('WhatsApp state changed.', { state });
  });

  client.on('remote_session_saved', () => {
    logger.debug('WhatsApp remote session saved.');
  });

  client.on('message', (message) => {
    handleIncomingMessage({
      client,
      message,
      config,
      logger,
      commandManager,
      limiters
    }).catch((error) => {
      logger.error('Message handler failed.', { error });
    });
  });

  client.on('group_join', (notification) => {
    if (!config.AUTO_WELCOME) {
      return;
    }

    const template =
      config.WELCOME_MESSAGE ||
      t('welcome.default', config.BOT_LANG);

    sendGroupNotification({
      client,
      notification,
      template,
      config,
      logger,
      kind: 'welcome'
    }).catch((error) => {
      logger.error('Welcome message failed.', { error });
    });
  });

  client.on('group_leave', (notification) => {
    if (!config.AUTO_GOODBYE) {
      return;
    }

    const template =
      config.GOODBYE_MESSAGE ||
      t('goodbye.default', config.BOT_LANG);

    sendGroupNotification({
      client,
      notification,
      template,
      config,
      logger,
      kind: 'goodbye'
    }).catch((error) => {
      logger.error('Goodbye message failed.', { error });
    });
  });
}

module.exports = {
  registerEventHandlers
};
