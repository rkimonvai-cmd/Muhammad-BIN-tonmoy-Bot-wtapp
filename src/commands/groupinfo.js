'use strict';

const { t } = require('../utils/language');
const { truncate, formatDateTime } = require('../utils/formatting');
const {
  getChatForMessage,
  getGroupAdminCount
} = require('../utils/groupUtils');

module.exports = {
  name: 'groupinfo',
  aliases: ['ginfo'],
  descriptionKey: 'cmd.groupinfo.desc',
  usage: 'groupinfo',
  category: 'group',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: true,

  async execute({ message, config }) {
    const lang = config.BOT_LANG;
    const chat = await getChatForMessage(message);

    if (!chat || !chat.isGroup) {
      await message.reply(t('errors.groupOnly', lang));
      return;
    }

    const locale = lang === 'bn' ? 'bn-BD' : 'en-GB';
    const participants = Array.isArray(chat.participants)
      ? chat.participants
      : [];

    const createdAt =
      chat.createdAt && Number(chat.createdAt) > 0
        ? formatDateTime(
            new Date(Number(chat.createdAt) * 1000),
            config.TIMEZONE,
            locale,
            {
              dateStyle: 'medium',
              timeStyle: 'short'
            }
          )
        : t('common.unknown', lang);

    const description = truncate(
      chat.description || t('common.none', lang),
      300
    );

    const text = t('groupinfo.body', lang, {
      name: chat.name || t('common.unknown', lang),
      members: participants.length,
      admins: getGroupAdminCount(chat),
      created: createdAt,
      description
    });

    await message.reply(text);
  }
};
