'use strict';

const { t } = require('../utils/language');
const { formatDateTime } = require('../utils/formatting');

module.exports = {
  name: 'time',
  aliases: ['tm'],
  descriptionKey: 'cmd.time.desc',
  usage: 'time',
  category: 'general',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,

  async execute({ message, config }) {
    const lang = config.BOT_LANG;
    const locale = lang === 'bn' ? 'bn-BD' : 'en-GB';

    const currentTime = formatDateTime(
      new Date(),
      config.TIMEZONE,
      locale,
      {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'short'
      }
    );

    const text = t('time.body', lang, {
      timezone: config.TIMEZONE,
      time: currentTime
    });

    await message.reply(text);
  }
};
