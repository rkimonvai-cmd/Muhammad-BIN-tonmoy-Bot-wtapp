'use strict';

const { t } = require('../utils/language');
const { formatDateTime } = require('../utils/formatting');

module.exports = {
  name: 'date',
  aliases: ['dt'],
  descriptionKey: 'cmd.date.desc',
  usage: 'date',
  category: 'general',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,

  async execute({ message, config }) {
    const lang = config.BOT_LANG;
    const locale = lang === 'bn' ? 'bn-BD' : 'en-GB';

    const currentDate = formatDateTime(
      new Date(),
      config.TIMEZONE,
      locale,
      {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }
    );

    const text = t('date.body', lang, {
      timezone: config.TIMEZONE,
      date: currentDate
    });

    await message.reply(text);
  }
};
