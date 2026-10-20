'use strict';

const { t } = require('../utils/language');

module.exports = {
  name: 'menu',
  aliases: ['list', 'commands'],
  descriptionKey: 'cmd.menu.desc',
  usage: 'menu',
  category: 'general',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,

  async execute({ message, config, commandManager }) {
    const lang = config.BOT_LANG;
    const commands = commandManager.getAll();

    const commandLines = commands
      .map((command, index) => {
        return `${index + 1}. ${config.PREFIX}${command.usage} — ${t(
          command.descriptionKey,
          lang
        )}`;
      })
      .join('\n');

    const text = t('menu.body', lang, {
      botName: config.BOT_NAME,
      count: commands.length,
      commands: commandLines,
      prefix: config.PREFIX,
      branding: config.BRANDING_NAME
    });

    await message.reply(text);
  }
};
