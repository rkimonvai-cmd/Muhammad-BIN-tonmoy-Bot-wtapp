'use strict';

const { t } = require('../utils/language');
const { formatDuration } = require('../utils/formatting');

module.exports = {
  name: 'alive',
  aliases: ['a'],
  descriptionKey: 'cmd.alive.desc',
  usage: 'alive',
  category: 'general',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,

  async execute({ client, message, config }) {
    const lang = config.BOT_LANG;

    const text = t('alive.body', lang, {
      botName: config.BOT_NAME,
      uptime: formatDuration(process.uptime()),
      mode: config.BOT_MODE,
      timezone: config.TIMEZONE,
      connection: client.info ? 'connected' : 'initializing'
    });

    await message.reply(text);
  }
};
