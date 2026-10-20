'use strict';

const { t } = require('../utils/language');
const pkg = require('../../package.json');

module.exports = {
  name: 'info',
  aliases: ['i'],
  descriptionKey: 'cmd.info.desc',
  usage: 'info',
  category: 'general',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,

  async execute({ message, config }) {
    const lang = config.BOT_LANG;

    const text = t('info.body', lang, {
      botName: config.BOT_NAME,
      ownerName: config.OWNER_NAME,
      branding: config.BRANDING_NAME,
      version: pkg.version,
      mode: config.BOT_MODE,
      lang: config.BOT_LANG,
      timezone: config.TIMEZONE,
      prefix: config.PREFIX,
      ai: config.AI_READY
        ? t('common.enabled', lang)
        : t('common.disabled', lang)
    });

    await message.reply(text);
  }
};
