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

// ============================================================
// PAIRING CODE MODE (controlled by environment variables)
// ============================================================
const AUTH_METHOD = String(process.env.AUTH_METHOD || 'qr').toLowerCase();
const PAIRING_SECRET = String(process.env.PAIRING_SECRET || '');
const PAIRING_PHONE = String(
  process.env.PAIRING_PHONE || process.env.OWNER_NUMBER || ''
).replace(/\D/g, '');

const pairingState = {
  code: null,
  generatedAt: 0,
  lastRequestAt: 0,
  lastError: null
};

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
  startedAt: new Date().toISOString(),
  pairingCode: null,
  pairingCodeGeneratedAt: null,
  pairingState: 'idle',
  pairingError: null
};

let client = null;
let httpServer = null;
let shuttingDown = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let reconnecting = false;

function formatPairingCode(raw) {
  const cleaned = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  return cleaned;
}

async function requestPairingCode() {
  if (AUTH_METHOD !== 'pairing_code') {
    return;
  }

  if (!client || typeof client.requestPairingCode !== 'function') {
    return;
  }

  if (!PAIRING_PHONE || PAIRING_PHONE.length < 8) {
    logger.warn(
      'PAIRING_PHONE/OWNER_NUMBER not set. Cannot request pairing code.'
    );
    return;
  }

  if (
    pairingState.code &&
    Date.now() - pairingState.generatedAt < 40000
  ) {
    return;
  }

  if (Date.now() - pairingState.lastRequestAt < 5000) {
    return;
  }

  pairingState.lastRequestAt = Date.now();
  runtimeStatus.pairingState = 'requesting';

  try {
    const code = await client.requestPairingCode(PAIRING_PHONE);
    const formatted = formatPairingCode(code);

    if (!formatted || formatted.length < 6) {
      pairingState.lastError = 'empty_code';
      runtimeStatus.pairingState = 'failed';
      runtimeStatus.pairingError = 'empty_code';
      logger.warn('Pairing code request returned empty result.');
      return;
    }

    pairingState.code = formatted;
    pairingState.generatedAt = Date.now();
    pairingState.lastError = null;

    runtimeStatus.pairingCode = formatted;
    runtimeStatus.pairingCodeGeneratedAt = new Date().toISOString();
    runtimeStatus.pairingState = 'ready';
    runtimeStatus.pairingError = null;

    logger.info('=========================================');
    logger.info('  PAIRING CODE READY: ' + formatted);
    logger.info('  View at: /pair?secret=YOUR_SECRET');
    logger.info('=========================================');
  } catch (error) {
    pairingState.lastError = 'request_failed';
    runtimeStatus.pairingState = 'failed';
    runtimeStatus.pairingError = 'request_failed';
    logger.warn('Pairing code request failed.', { error });
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPairingPageHtml() {
  const code = pairingState.code;
  const ageMs = pairingState.generatedAt
    ? Date.now() - pairingState.generatedAt
    : null;
  const ageSec = ageMs !== null ? Math.floor(ageMs / 1000) : null;
  const isFresh = ageSec !== null && ageSec <= 60;

  if (runtimeStatus.ready) {
    return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connected</title>
<style>body{font-family:system-ui;background:#064e3b;color:#fff;padding:40px;text-align:center;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:0}.icon{font-size:80px;margin:20px}p{font-size:18px;line-height:1.7}</style>
</head><body><div class="icon">✅</div><h1>Bot Already Connected</h1>
<p>WhatsApp is linked to this bot.</p><p>You can close this page.</p></body></html>`;
  }

  if (runtimeStatus.authFailure) {
    return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Auth Failed</title>
<style>body{font-family:system-ui;background:#7f1d1d;color:#fff;padding:40px;text-align:center;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:0}.icon{font-size:80px;margin:20px}p{font-size:18px;line-height:1.7}</style>
</head><body><div class="icon">❌</div><h1>Authentication Failed</h1>
<p>Please restart the Render service.</p><p>Then open this page again.</p></body></html>`;
  }

  if (!code || !isFresh) {
    return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Getting Code...</title>
<style>*{box-sizing:border-box}body{font-family:system-ui;background:#1e293b;color:#fff;padding:20px;text-align:center;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:0}.icon{font-size:80px;margin:20px;animation:spin 2s linear infinite;display:inline-block}@keyframes spin{to{transform:rotate(360deg)}}.hint{color:#94a3b8;font-size:14px;margin-top:20px;line-height:1.9;max-width:400px}p{font-size:18px}</style>
</head><body><div class="icon">⏳</div><h1>Getting Pairing Code...</h1>
<p>This page auto-refreshes every 6 seconds.</p>
<p class="hint">If nothing appears in 60 seconds:<br>
• Check Render env: AUTH_METHOD=pairing_code<br>
• Check PAIRING_PHONE has country code<br>
• Check Render Logs</p>
<script>setTimeout(function(){location.reload();},6000);</script>
</body></html>`;
  }

  const codeNoDash = code.replace(/-/g, '');

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pairing Code</title>
<meta http-equiv="refresh" content="45">
<style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#fff;margin:0;padding:16px;min-height:100vh;display:flex;align-items:center;justify-content:center}
.wrap{max-width:480px;width:100%;background:#1e293b;padding:22px;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
h1{font-size:17px;margin:0 0 14px;color:#94a3b8;text-align:center;font-weight:600;letter-spacing:.5px}
.code{font-family:ui-monospace,Menlo,monospace;font-size:52px;letter-spacing:8px;font-weight:900;padding:26px 8px;margin:20px 0;background:#0f172a;border:3px solid #38bdf8;border-radius:12px;word-break:break-all;text-align:center;color:#38bdf8;cursor:pointer;user-select:all;transition:all .2s}
.code:active{background:#064e3b;border-color:#10b981}
.hint{color:#94a3b8;font-size:13px;text-align:center;margin:12px 0}
ol{padding-left:22px;color:#cbd5e1;line-height:1.8;font-size:15px;margin:8px 0}
li{margin:6px 0}
.steps{background:#0f172a;padding:14px 18px;border-radius:10px;margin-top:18px}
.note{background:#78350f;color:#fcd34d;padding:10px;border-radius:8px;text-align:center;font-size:13px;margin-top:14px}
.copy-btn{display:block;width:100%;padding:14px;border:0;border-radius:10px;background:#38bdf8;color:#0f172a;font-size:16px;font-weight:800;margin:8px 0 4px;cursor:pointer}
.copy-btn:active{background:#10b981;color:#fff}
</style>
</head><body>
<div class="wrap">
<h1>🔗 WhatsApp Pairing Code</h1>
<div class="code" id="codeBox">${escapeHtml(code)}</div>
<button class="copy-btn" onclick="copyCode()">📋 Copy Code</button>
<p class="hint" id="copyMsg" style="margin-top:4px"></p>
<div class="steps">
<ol>
<li>Open <b>WhatsApp</b> on your phone</li>
<li><b>Settings → Linked Devices</b></li>
<li>Tap <b>Link a Device</b></li>
<li>Tap <b>"Link with phone number instead"</b></li>
<li>Paste the 8-character code</li>
</ol>
</div>
<div class="note">⏱️ Code expires ~60 seconds after generation</div>
<p class="hint" style="margin-top:14px">Page auto-refreshes every 45s</p>
</div>
<script>
function copyCode() {
  const text = '${codeNoDash}';
  const msg = document.getElementById('copyMsg');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      msg.textContent = '✅ Copied! Now paste in WhatsApp.';
      msg.style.color = '#10b981';
    }).catch(function() {
      fallbackCopy(text, msg);
    });
  } else {
    fallbackCopy(text, msg);
  }
}
function fallbackCopy(text, msg) {
  const t = document.createElement('textarea');
  t.value = text;
  t.style.position = 'fixed';
  t.style.opacity = '0';
  document.body.appendChild(t);
  t.focus();
  t.select();
  try {
    document.execCommand('copy');
    msg.textContent = '✅ Copied! Now paste in WhatsApp.';
    msg.style.color = '#10b981';
  } catch (e) {
    msg.textContent = '⚠️ Copy failed. Manually select the code.';
    msg.style.color = '#fbbf24';
  }
  document.body.removeChild(t);
}
</script>
</body></html>`;
}

function addPairingRoutes(app) {
  app.get('/pair', (req, res) => {
    if (AUTH_METHOD !== 'pairing_code') {
      res
        .status(404)
        .type('text/plain')
        .send(
          'Pairing mode is disabled. Add AUTH_METHOD=pairing_code in Render Environment.'
        );
      return;
    }

    if (!PAIRING_SECRET || PAIRING_SECRET.length < 8) {
      res
        .status(500)
        .type('text/plain')
        .send('PAIRING_SECRET env var not set (must be 8+ characters).');
      return;
    }

    const provided =
      typeof req.query.secret === 'string' ? req.query.secret : '';

    if (provided !== PAIRING_SECRET) {
      res
        .status(401)
        .type('text/plain')
        .send(
          'Wrong secret. Use: /pair?secret=YOUR_PAIRING_SECRET'
        );
      return;
    }

    if (
      !pairingState.code ||
      Date.now() - pairingState.generatedAt > 40000
    ) {
      requestPairingCode().catch(function () {});
    }

    res.type('html').send(buildPairingPageHtml());
  });

  app.get('/pair.json', (req, res) => {
    if (AUTH_METHOD !== 'pairing_code') {
      res.status(404).json({ error: 'not_enabled' });
      return;
    }

    if (!PAIRING_SECRET || PAIRING_SECRET.length < 8) {
      res.status(500).json({ error: 'secret_not_set' });
      return;
    }

    const provided =
      typeof req.query.secret === 'string' ? req.query.secret : '';

    if (provided !== PAIRING_SECRET) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const ageMs = pairingState.generatedAt
      ? Date.now() - pairingState.generatedAt
      : null;

    res.json({
      ready: runtimeStatus.ready,
      authenticated: runtimeStatus.authenticated,
      authFailure: runtimeStatus.authFailure,
      code: pairingState.code,
      generatedAt: pairingState.generatedAt
        ? new Date(pairingState.generatedAt).toISOString()
        : null,
      ageSeconds:
        ageMs !== null ? Math.floor(ageMs / 1000) : null,
      pairingState: runtimeStatus.pairingState,
      error: runtimeStatus.pairingError
    });
  });
}

function scheduleReconnect(reason) {
  if (shuttingDown || !config.AUTO_RECONNECT || !client || reconnecting) {
    return;
  }

  const normalized = String(reason || 'UNKNOWN').toUpperCase();

  if (normalized.includes('LOGOUT')) {
    runtimeStatus.state = 'logged_out';
    runtimeStatus.ready = false;
    runtimeStatus.authenticated = false;
    logger.error('Session logged out. New pairing required.');
    return;
  }

  if (reconnectTimer) {
    return;
  }

  if (reconnectAttempts >= config.RECONNECT_MAX_ATTEMPTS) {
    runtimeStatus.state = 'reconnect_failed';
    logger.error('Max reconnect attempts reached.', {
      attempts: reconnectAttempts
    });
    return;
  }

  reconnectAttempts += 1;
  runtimeStatus.reconnectAttempts = reconnectAttempts;

  const delayMs = Math.min(
    config.RECONNECT_BASE_DELAY_MS *
      Math.pow(2, reconnectAttempts - 1),
    config.RECONNECT_MAX_DELAY_MS
  );

  runtimeStatus.state = 'reconnecting';
  runtimeStatus.nextReconnectAt = new Date(
    Date.now() + delayMs
  ).toISOString();

  logger.warn('Scheduling reconnect.', {
    attempt: reconnectAttempts,
    delayMs,
    reason: normalized
  });

  reconnectTimer = setTimeout(async function () {
    reconnectTimer = null;
    if (shuttingDown) {
      return;
    }
    reconnecting = true;
    try {
      try {
        await client.destroy();
      } catch (e) {
        logger.debug('destroy failed', { error: e });
      }
      await client.initialize();
      runtimeStatus.nextReconnectAt = null;
    } catch (e) {
      runtimeStatus.nextReconnectAt = null;
      logger.error('Reconnect failed.', { error: e });
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

  const forceTimer = setTimeout(function () {
    logger.warn('Forced exit.');
    process.exit(1);
  }, 15000);

  if (typeof forceTimer.unref === 'function') {
    forceTimer.unref();
  }

  try {
    if (client) {
      try {
        await client.destroy();
      } catch (e) {
        logger.warn('client.destroy failed', { error: e });
      }
    }
    await closeHttpServer(httpServer);
  } catch (e) {
    logger.warn('Shutdown error.', { error: e });
  } finally {
    clearTimeout(forceTimer);
    logger.info('Shutdown complete.');
    process.exit(0);
  }
}

async function main() {
  fs.mkdirSync(config.SESSION_DATA_PATH, {
    recursive: true,
    mode: 0o700
  });

  try {
    fs.chmodSync(config.SESSION_DATA_PATH, 0o700);
  } catch (e) {
    logger.debug('chmod failed', { error: e });
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
    getStatus: function () {
      return runtimeStatus;
    },
    logger: logger
  });

  addPairingRoutes(healthApp);

  httpServer = await startHttpServer(healthApp, config, logger);
  runtimeStatus.server = 'up';

  if (AUTH_METHOD === 'pairing_code') {
    logger.info('==============================================');
    logger.info('PAIRING CODE MODE ENABLED');
    if (!PAIRING_SECRET || PAIRING_SECRET.length < 8) {
      logger.error(
        'PAIRING_SECRET missing or too short (min 8 chars).'
      );
    } else if (!PAIRING_PHONE || PAIRING_PHONE.length < 8) {
      logger.error(
        'PAIRING_PHONE / OWNER_NUMBER missing or invalid.'
      );
    } else {
      logger.info(
        'Open on phone: https://YOUR-APP.onrender.com/pair?secret=YOUR_SECRET'
      );
    }
    logger.info('==============================================');
  }

  client = createWhatsAppClient(config, logger);

  registerEventHandlers({
    client: client,
    config: config,
    logger: logger,
    status: runtimeStatus,
    commandManager: commandManager,
    limiters: limiters
  });

  if (AUTH_METHOD === 'pairing_code') {
    client.on('qr', function () {
      logger.info(
        'QR event received. Requesting pairing code...'
      );
      requestPairingCode().catch(function (error) {
        logger.error('Pairing code request failed.', {
          error: error
        });
      });
    });
  }

  client.on('ready', function () {
    reconnectAttempts = 0;
    runtimeStatus.reconnectAttempts = 0;
    pairingState.code = null;
    runtimeStatus.pairingCode = null;
  });

  client.on('disconnected', function (reason) {
    pairingState.code = null;
    runtimeStatus.pairingCode = null;
    scheduleReconnect(reason);
  });

  if (AUTH_METHOD !== 'pairing_code') {
    logger.info(
      'Starting WhatsApp client. QR will print in logs.'
    );
  }

  try {
    await client.initialize();
  } catch (error) {
    logger.error('Initialization failed.', { error: error });
    scheduleReconnect('INITIALIZE_FAILED');
  }
}

process.on('SIGTERM', function () {
  shutdown('SIGTERM');
});

process.on('SIGINT', function () {
  shutdown('SIGINT');
});

process.on('unhandledRejection', function (error) {
  logger.error('Unhandled rejection.', { error: error });
});

process.on('uncaughtException', function (error) {
  logger.error('Uncaught exception.', { error: error });
  shutdown('uncaughtException');
});

main().catch(function (error) {
  logger.error('Fatal startup error.', { error: error });
  shutdown('startup_error');
});
