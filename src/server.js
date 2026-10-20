'use strict';

const express = require('express');

function createHealthApp({ getStatus, logger }) {
  if (typeof getStatus !== 'function') {
    throw new Error('createHealthApp requires a getStatus function.');
  }

  const app = express();

  app.disable('x-powered-by');

  app.get('/health', (request, response) => {
    const status = getStatus();

    response.status(200).json({
      ok: true,
      service: 'whatsapp-bot',
      uptimeSeconds: Math.floor(process.uptime()),
      whatsapp: {
        state: status.state,
        ready: Boolean(status.ready),
        authenticated: Boolean(status.authenticated),
        authFailure: Boolean(status.authFailure),
        lastReadyAt: status.lastReadyAt || null
      },
      timestamp: new Date().toISOString()
    });
  });

  app.use((request, response) => {
    response.status(404).json({
      error: 'not_found'
    });
  });

  app.use((error, request, response, next) => {
    logger.error('HTTP request failed.', { error });

    if (response.headersSent) {
      next(error);
      return;
    }

    response.status(500).json({
      error: 'internal_error'
    });
  });

  return app;
}

function startHttpServer(app, config, logger) {
  return new Promise((resolve, reject) => {
    const server = app.listen(
      config.PORT,
      '0.0.0.0',
      () => {
        logger.info('HTTP health server listening.', {
          port: config.PORT
        });
        resolve(server);
      }
    );

    server.on('error', (error) => {
      reject(error);
    });
  });
}

function closeHttpServer(server) {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }

    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve();
    };

    const timer = setTimeout(finish, 5000);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    server.close(finish);

    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
  });
}

module.exports = {
  createHealthApp,
  startHttpServer,
  closeHttpServer
};
