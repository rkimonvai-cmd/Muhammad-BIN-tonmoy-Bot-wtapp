'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');

function createWhatsAppClient(config, logger) {
  const puppeteerOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote'
    ]
  };

  if (config.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOptions.executablePath = config.PUPPETEER_EXECUTABLE_PATH;
  }

  const authStrategy = new LocalAuth({
    clientId: config.SESSION_CLIENT_ID,
    dataPath: config.SESSION_DATA_PATH
  });

  const client = new Client({
    authStrategy,
    puppeteer: puppeteerOptions
  });

  logger.info('WhatsApp client configured with LocalAuth session storage.');

  return client;
}

module.exports = {
  createWhatsAppClient
};
