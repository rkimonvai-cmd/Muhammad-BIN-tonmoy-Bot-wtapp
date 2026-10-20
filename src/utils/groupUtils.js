'use strict';

const {
  extractRawId,
  sameUser
} = require('./identity');

async function getChatForMessage(message) {
  if (!message || typeof message.getChat !== 'function') {
    return null;
  }

  try {
    return await message.getChat();
  } catch (error) {
    return null;
  }
}

function findParticipant(chat, userId) {
  if (!chat || !Array.isArray(chat.participants)) {
    return null;
  }

  const targetSerialized = extractRawId(userId);

  return (
    chat.participants.find((participant) => {
      if (!participant || !participant.id) {
        return false;
      }

      const participantSerialized = extractRawId(participant.id);

      if (
        targetSerialized &&
        participantSerialized &&
        targetSerialized === participantSerialized
      ) {
        return true;
      }

      return sameUser(participantSerialized, userId);
    }) || null
  );
}

function isParticipantAdmin(participant) {
  return Boolean(
    participant &&
      (participant.isAdmin || participant.isSuperAdmin)
  );
}

function isSenderGroupAdmin(chat, userId) {
  return isParticipantAdmin(findParticipant(chat, userId));
}

function isBotGroupAdmin(client, chat) {
  const botWid = client && client.info && client.info.wid;

  if (!botWid) {
    return false;
  }

  const botId = botWid._serialized || botWid;
  return isSenderGroupAdmin(chat, botId);
}

function getGroupAdminCount(chat) {
  if (!chat || !Array.isArray(chat.participants)) {
    return 0;
  }

  return chat.participants.filter(isParticipantAdmin).length;
}

module.exports = {
  getChatForMessage,
  findParticipant,
  isParticipantAdmin,
  isSenderGroupAdmin,
  isBotGroupAdmin,
  getGroupAdminCount
};
