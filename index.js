'use strict';

let config;

try {
  config = require('./src/config');
} catch (error) {
  console.error('Fatal configuration error:', error.message);
  process.exit(1);
}

const fs = require('fs');
const { createLogger } = require('./src/logger');
const { createWhatsAppClient } = require('./src/client');
const { registerEventHandlers } = require('./src/handlers/eventHandler');
const { CommandManager } = require('./src/commandManager');
const { FixedWindowRateLimiter } = require('./src/middleware/rateLimit');
const {
  createHealthApp,
  startHttpServer,
  closeHttpServer
} = require('./src/server');

const logger = createLogger({ level: config.LOG_LEVEL });

const runtimeStatus = {
  server: 'starting',
  state: 'starting',
  ready: false,
  authenticated: false,
  authFailure: false,
  qrIssuedAt: null,
  lastReadyAt: null,
  nextReconnectAt: null,
  reconnectAttempts: 0,
  commandsLoaded: 0,
  startedAt: new Date().toISOString()
};

let client = null;
let httpServer = null;
let shuttingDown = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let reconnecting = false;

function scheduleReconnect(reason) {
  if (shuttingDown || !config.AUTO_RECONNECT || !client || reconnecting) {
    return;
  }

  const normalizedReason = String(reason || 'UNKNOWN').toUpperCase();

  if (normalizedReason.includes('LOGOUT')) {
    runtimeStatus.state = 'logged_out';
    runtimeStatus.ready = false;
    runtimeStatus.authenticated = false;
    logger.error(
      'WhatsApp session was logged out. Automatic reconnect is disabled for LOGOUT because a new QR scan is required.'
    );
    return;
  }

  if (reconnectTimer) {
    return;
  }

  if (reconnectAttempts >= config.RECONNECT_MAX_ATTEMPTS) {
    runtimeStatus.state = 'reconnect_failed';
    logger.error('Maximum WhatsApp reconnect attempts reached.', {
      attempts: reconnectAttempts
    });
    return;
  }

  reconnectAttempts += 1;
  runtimeStatus.reconnectAttempts = reconnectAttempts;

  const delayMs = Math.min(
    config.RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempts - 1),
    config.RECONNECT_MAX_DELAY_MS
  );

  runtimeStatus.state = 'reconnecting';
  runtimeStatus.nextReconnectAt = new Date(Date.now() + delayMs).toISOString();

  logger.warn('Scheduling WhatsApp reconnect.', {
    attempt: reconnectAttempts,
    delayMs,
    reason: normalizedReason
  });

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;

    if (shuttingDown) {
      return;
    }

    reconnecting = true;

    try {
      logger.info('Reinitializing WhatsApp client.');

      try {
        await client.destroy();
      } catch (destroyError) {
        logger.debug('Client destroy during reconnect failed.', {
          error: destroyError
        });
      }

      await client.initialize();
      runtimeStatus.nextReconnectAt = null;
    } catch (error) {
      runtimeStatus.nextReconnectAt = null;
      logger.error('WhatsApp reconnect attempt failed.', { error });
      reconnecting = false;
      scheduleReconnect('RECONNECT_FAILED');
      return;
    }

    reconnecting = false;
  }, delayMs);

  if (typeof reconnectTimer.unref === 'function') {
    reconnectTimer.unref();
  }
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info('Shutdown requested.', { signal });

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const forceExitTimer = setTimeout(() => {
    logger.warn('Graceful shutdown timed out; forcing exit.');
    process.exit(1);
  }, 15000);

  if (typeof forceExitTimer.unref === 'function') {
    forceExitTimer.unref();
  }

  try {
    if (client) {
      try {
        await client.destroy();
      } catch (error) {
        logger.warn('WhatsApp client destroy failed during shutdown.', {
          error
        });
      }
    }

    await closeHttpServer(httpServer);
  } catch (error) {
    logger.warn('Shutdown encountered an error.', { error });
  } finally {
    clearTimeout(forceExitTimer);
    logger.info('Shutdown complete.');
    process.exit(0);
  }
}

async function main() {
  fs.mkdirSync(config.SESSION_DATA_PATH, { recursive: true, mode: 0o700 });

  try {
    fs.chmodSync(config.SESSION_DATA_PATH, 0o700);
  } catch (error) {
    logger.debug('Could not set session directory permissions.', { error });
  }

  const commandManager = new CommandManager({ config, logger });
  commandManager.load();

  runtimeStatus.commandsLoaded = commandManager.getAll().length;

  const limiters = {
    command: new FixedWindowRateLimiter({
      windowMs: config.COMMAND_RATE_LIMIT_WINDOW_MS,
      max: config.COMMAND_RATE_LIMIT_MAX,
      maxEntries: config.RATE_LIMIT_MAX_ENTRIES
    }),
    ai: new FixedWindowRateLimiter({
      windowMs: config.AI_RATE_LIMIT_WINDOW_MS,
      max: config.AI_RATE_LIMIT_MAX,
      maxEntries: config.RATE_LIMIT_MAX_ENTRIES
    }),
    antiSpam: new FixedWindowRateLimiter({
      windowMs: config.ANTI_SPAM_WINDOW_MS,
      max: config.ANTI_SPAM_MAX_MESSAGES,
      maxEntries: config.RATE_LIMIT_MAX_ENTRIES
    })
  };

  const healthApp = createHealthApp({
    getStatus: () => runtimeStatus,
    logger
  });

  httpServer = await startHttpServer(healthApp, config, logger);

  runtimeStatus.server = 'up';

  client = createWhatsAppClient(config, logger);

  registerEventHandlers({
    client,
    config,
    logger,
    status: runtimeStatus,
    commandManager,
    limiters
  });

  client.on('ready', () => {
    reconnectAttempts = 0;
    runtimeStatus.reconnectAttempts = 0;
  });

  client.on('disconnected', (reason) => {
    scheduleReconnect(reason);
  });

  if (!config.OWNER_NUMBER) {
    logger.warn(
      'OWNER_NUMBER is not set. Owner-only commands and private-mode authorization will not work.'
    );
  }

  if (config.AI_ENABLED && !config.AI_READY) {
    logger.warn(
      'AI_ENABLED is true, but AI_API_KEY or AI_MODEL is missing. AI replies are disabled.'
    );
  }

  logger.info('Bot startup sequence initiated.', {
    botName: config.BOT_NAME,
    mode: config.BOT_MODE,
    timezone: config.TIMEZONE,
    aiReady: config.AI_READY
  });

  logger.info(
    'Starting WhatsApp client. If no saved session exists, a QR code will be printed in server logs.'
  );

  try {
    await client.initialize();
  } catch (error) {
    logger.error('WhatsApp client initialization failed.', { error });
    scheduleReconnect('INITIALIZE_FAILED');
  }
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection.', { error });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception.', { error });
  shutdown('uncaughtException');
});

main().catch((error) => {
  logger.error('Fatal startup error.', { error });
  shutdown('startup_error');
});
