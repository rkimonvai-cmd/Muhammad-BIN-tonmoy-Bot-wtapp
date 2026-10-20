'use strict';

const fs = require('fs');
const path = require('path');

class CommandManager {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.commandsByName = new Map();
    this.aliases = new Map();
  }

  load() {
    this.commandsByName.clear();
    this.aliases.clear();

    const commandsDirectory = path.join(__dirname, 'commands');
    const files = fs
      .readdirSync(commandsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
      .map((entry) => entry.name)
      .sort();

    for (const file of files) {
      const filePath = path.join(commandsDirectory, file);
      const commandModule = require(filePath);
      this.register(commandModule, file);
    }

    const count = this.getAll().length;
    this.logger.info('Commands loaded.', { count });
  }

  register(commandModule, filename) {
    if (!commandModule || typeof commandModule !== 'object') {
      throw new Error(`Invalid command module: ${filename}`);
    }

    const rawName = String(commandModule.name || '')
      .trim()
      .toLowerCase();

    if (!/^[a-z0-9_-]+$/.test(rawName)) {
      throw new Error(
        `Command name in ${filename} must contain only lowercase letters, numbers, underscore and hyphen.`
      );
    }

    if (this.commandsByName.has(rawName)) {
      throw new Error(`Duplicate command name: ${rawName}`);
    }

    if (typeof commandModule.execute !== 'function') {
      throw new Error(`Command ${rawName} must export an execute function.`);
    }

    if (!commandModule.descriptionKey) {
      throw new Error(
        `Command ${rawName} must define descriptionKey.`
      );
    }

    const aliases = Array.isArray(commandModule.aliases)
      ? commandModule.aliases
          .map((alias) => String(alias).trim().toLowerCase())
          .filter(Boolean)
      : [];

    for (const alias of aliases) {
      if (!/^[a-z0-9_-]+$/.test(alias)) {
        throw new Error(
          `Invalid alias "${alias}" in command ${rawName}.`
        );
      }

      if (
        alias === rawName ||
        this.commandsByName.has(alias) ||
        this.aliases.has(alias)
      ) {
        throw new Error(
          `Duplicate or invalid alias "${alias}" in command ${rawName}.`
        );
      }
    }

    const normalizedCommand = {
      name: rawName,
      aliases,
      descriptionKey: String(commandModule.descriptionKey),
      usage: String(commandModule.usage || rawName),
      category: String(commandModule.category || 'general').toLowerCase(),
      ownerOnly: Boolean(commandModule.ownerOnly),
      adminOnly: Boolean(commandModule.adminOnly),
      groupOnly: Boolean(commandModule.groupOnly),
      execute: commandModule.execute
    };

    this.commandsByName.set(rawName, normalizedCommand);

    for (const alias of aliases) {
      this.aliases.set(alias, normalizedCommand);
    }
  }

  resolve(name) {
    const normalizedName = String(name || '')
      .trim()
      .toLowerCase();

    return (
      this.commandsByName.get(normalizedName) ||
      this.aliases.get(normalizedName) ||
      null
    );
  }

  getAll() {
    return Array.from(new Set(this.commandsByName.values())).sort(
      (left, right) => left.name.localeCompare(right.name)
    );
  }

  parseCommand(body, prefix) {
    if (
      typeof body !== 'string' ||
      typeof prefix !== 'string' ||
      prefix.length === 0
    ) {
      return null;
    }

    if (!body.startsWith(prefix)) {
      return null;
    }

    const content = body.slice(prefix.length).trim();

    if (!content) {
      return null;
    }

    const parts = content.split(/\s+/);
    const rawName = parts.shift();

    if (!rawName) {
      return null;
    }

    return {
      name: rawName.toLowerCase(),
      args: parts
    };
  }

  renderUsage(command) {
    const usage = command.usage || command.name;

    if (usage.startsWith(this.config.PREFIX)) {
      return usage;
    }

    return `${this.config.PREFIX}${usage}`;
  }
}

module.exports = {
  CommandManager
};
