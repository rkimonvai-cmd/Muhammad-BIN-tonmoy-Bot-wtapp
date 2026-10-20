'use strict';

const {
  getSenderId,
  isGroupId,
  sameUser
} = require('../utils/identity');
const {
  getChatForMessage,
  isSenderGroupAdmin
} = require('../utils/groupUtils');

function isOwner(userId, config) {
  if (!config.OWNER_NUMBER) {
    return false;
  }

  return sameUser(userId, config.OWNER_NUMBER);
}

function isAllowedUser(userId, config) {
  if (isOwner(userId, config)) {
    return true;
  }

  return config.ALLOWED_USERS.some((allowedUser) => {
    return allowedUser && sameUser(userId, allowedUser);
  });
}

async function checkCommandPermission({
  command,
  message,
  client,
  config
}) {
  const senderId = getSenderId(message);
  const groupMessage = isGroupId(message.from);

  if (command.groupOnly && !groupMessage) {
    return {
      allowed: false,
      messageKey: 'errors.groupOnly'
    };
  }

  if (command.ownerOnly && !isOwner(senderId, config)) {
    return {
      allowed: false,
      messageKey: 'errors.ownerOnly'
    };
  }

  if (command.adminOnly) {
    if (!groupMessage) {
      return {
        allowed: false,
        messageKey: 'errors.adminOnly'
      };
    }

    const chat = await getChatForMessage(message);

    if (!chat || !chat.isGroup) {
      return {
        allowed: false,
        messageKey: 'errors.groupOnly'
      };
    }

    if (!isSenderGroupAdmin(chat, senderId)) {
      return {
        allowed: false,
        messageKey: 'errors.adminOnly'
      };
    }
  }

  if (
    config.BOT_MODE === 'private' &&
    !isAllowedUser(senderId, config)
  ) {
    return {
      allowed: false,
      messageKey: 'errors.privateOnly'
    };
  }

  return {
    allowed: true,
    messageKey: null
  };
}

module.exports = {
  isOwner,
  isAllowedUser,
  checkCommandPermission
};
