'use strict';

const { t } = require('../utils/language');
const { normalizePhoneNumber } = require('../utils/identity');

module.exports = {
  name: 'owner',
  aliases: ['creator'],
  descriptionKey: 'cmd.owner.desc',
  usage: 'owner',
  category: 'general',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,

  async execute({ message, config }) {
    const lang = config.BOT_LANG;
    const normalizedOwnerNumber = config.OWNER_NUMBER
      ? normalizePhoneNumber(config.OWNER_NUMBER)
      : '';

    let contact = t('owner.notConfigured', lang);

    if (normalizedOwnerNumber) {
      if (config.SHOW_OWNER_NUMBER) {
        contact = `+${normalizedOwnerNumber} (https://wa.me/${normalizedOwnerNumber})`;
      } else {
        contact = t('owner.hidden', lang);
      }
    }

    const text = t('owner.body', lang, {
      name: config.OWNER_NAME,
      contact,
      branding: config.BRANDING_NAME
    });

    await message.reply(text);
  }
};
