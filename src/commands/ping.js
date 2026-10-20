'use strict';

const { t } = require('../utils/language');

module.exports = {
  name: 'ping',
  aliases: ['p'],
  descriptionKey: 'cmd.ping.desc',
  usage: 'ping',
  category: 'general',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,

  async execute({ message, config }) {
    const timestamp = Number(message.timestamp);
    const approximateLatency = Number.isFinite(timestamp)
      ? Math.max(0, Date.now() - timestamp * 1000)
      : 0;

    const text = t('ping.result', config.BOT_LANG, {
      latency: Math.round(approximateLatency)
    });

    await message.reply(text);
  }
};
