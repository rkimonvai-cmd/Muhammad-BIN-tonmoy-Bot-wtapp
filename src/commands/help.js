'use strict';

const { t } = require('../utils/language');

module.exports = {
  name: 'help',
  aliases: ['h'],
  descriptionKey: 'cmd.help.desc',
  usage: 'help [command]',
  category: 'general',
  ownerOnly: false,
  adminOnly: false,
  groupOnly: false,

  async execute({ message, args, config, commandManager }) {
    const lang = config.BOT_LANG;
    const rawTarget = String(args[0] || '').trim();

    if (rawTarget) {
      const target = rawTarget.startsWith(config.PREFIX)
        ? rawTarget.slice(config.PREFIX.length)
        : rawTarget;

      const command = commandManager.resolve(target);

      if (!command) {
        await message.reply(
          t('help.notFound', lang, {
            command: target,
            prefix: config.PREFIX
          })
        );
        return;
      }

      const permissionLabels = [];

      if (command.ownerOnly) {
        permissionLabels.push(t('permissions.owner', lang));
      }

      if (command.adminOnly) {
        permissionLabels.push(t('permissions.admin', lang));
      }

      if (command.groupOnly) {
        permissionLabels.push(t('permissions.group', lang));
      }

      if (config.BOT_MODE === 'private' && !command.ownerOnly) {
        permissionLabels.push(t('permissions.privateMode', lang));
      }

      if (permissionLabels.length === 0) {
        permissionLabels.push(t('permissions.everyone', lang));
      }

      const aliases = command.aliases.length
        ? command.aliases
            .map((alias) => `${config.PREFIX}${alias}`)
            .join(', ')
        : t('common.none', lang);

      const text = t('help.command', lang, {
        name: command.name,
        description: t(command.descriptionKey, lang),
        usage: commandManager.renderUsage(command),
        aliases,
        category: command.category,
        permissions: permissionLabels.join(', ')
      });

      await message.reply(text);
      return;
    }

    const commandCount = commandManager.getAll().length;

    const text = t('help.body', lang, {
      prefix: config.PREFIX,
      count: commandCount,
      mode: config.BOT_MODE,
      botName: config.BOT_NAME
    });

    await message.reply(text);
  }
};
