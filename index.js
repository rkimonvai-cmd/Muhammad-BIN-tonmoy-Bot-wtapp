'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const CONFIG = {
  BOT_NAME: process.env.BOT_NAME || '𒁂 𝘼𝙇𝙄𝙔𝘼 𝘽𝘼𝘽𝙔__༊⫸',
  OWNER_NAME: process.env.OWNER_NAME || '𒁂【 𝘼𝘾𝙎 𝘾𝙔𝘽𝙀𝙍 𝙇𝙀𝘼𝘿𝙀𝙍 ☻ 𝙑𝘼𝙐 】𒁂⫸',
  BRANDING: process.env.BRANDING_NAME || 'ACS TONMOY',
  PREFIX: process.env.PREFIX || '.',
  OWNER_NUMBER: (process.env.OWNER_NUMBER || '').replace(/\D/g, ''),
  BOT_MODE: (process.env.BOT_MODE || 'public').toLowerCase(),
  TIMEZONE: process.env.TIMEZONE || 'Asia/Dhaka',
  PORT: (() => {
    const p = parseInt(process.env.PORT || '3000', 10);
    return Number.isInteger(p) && p > 0 && p < 65536 ? p : 3000;
  })(),
  AUTH_METHOD: (process.env.AUTH_METHOD || 'qr').toLowerCase(),
  PAIRING_SECRET: process.env.PAIRING_SECRET || '',
  PAIRING_PHONE: (process.env.PAIRING_PHONE || process.env.OWNER_NUMBER || '').replace(/\D/g, ''),
  SESSION_DATA_PATH: process.env.SESSION_DATA_PATH || path.join(process.cwd(), 'data', 'session'),
};

function log(level, msg, extra) {
  const ts = new Date().toISOString();
  const line = extra ? ` ${JSON.stringify(extra)}` : '';
  console.log(`[${ts}] ${level.toUpperCase()} ${msg}${line}`);
}

const STATE = {
  client: null, qr: null, qrAt: 0, pairingCode: null, pairingAt: 0,
  ready: false, authenticated: false, authFailure: false, lastReady: null,
};

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatPairingCode(raw) {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length === 8) return `${c.slice(0, 4)}-${c.slice(4)}`;
  return c;
}

function senderIdOf(message) {
  const raw = (message && (message.author || message.from)) || '';
  return String(raw._serialized || raw);
}

function isOwnerMessage(message) {
  if (!CONFIG.OWNER_NUMBER) return false;
  const num = senderIdOf(message).split('@')[0].split(':')[0].replace(/\D/g, '');
  return num === CONFIG.OWNER_NUMBER;
}

function timeInTz(opts) {
  try { return new Intl.DateTimeFormat('en-GB', { timeZone: CONFIG.TIMEZONE, ...opts }).format(new Date()); }
  catch (e) { return new Date().toISOString(); }
}

function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const parts = [];
  if (d) parts.push(`${d}d`); if (h) parts.push(`${h}h`); if (m) parts.push(`${m}m`);
  if (r || !parts.length) parts.push(`${r}s`);
  return parts.join(' ');
}

const commands = new Map();
function registerCommand(name, aliases, handler) {
  commands.set(name.toLowerCase(), { name, handler });
  for (const a of (aliases || [])) commands.set(a.toLowerCase(), { name, handler });
}

registerCommand('menu', ['list', 'commands'], async (ctx) => {
  const names = Array.from(new Set(Array.from(commands.values()).map(c => c.name))).sort();
  const list = names.map((n, i) => `${i + 1}. ${CONFIG.PREFIX}${n} — ${describe(n)}`).join('\n');
  await ctx.reply(`╭━━━〔 ${CONFIG.BOT_NAME} 〕━━━╮\n┃ 📋 *Menu* (${names.length})\n┣━━━━━━━━━━━━━━━\n${list}\n╰━━━━━━━━━━━━━━━╯\n\nUse ${CONFIG.PREFIX}help <command>\nPowered by ${CONFIG.BRANDING}`);
});

function describe(name) {
  const d = {
    menu: 'All commands', help: 'Help', ping: 'Latency', alive: 'Uptime & status',
    info: 'Bot info', owner: 'Owner contact', time: 'Current time', date: 'Current date',
    groupinfo: 'Group info'
  };
  return d[name] || '';
}

registerCommand('help', ['h'], async (ctx) => {
  if (ctx.args[0]) {
    const name = ctx.args[0].replace(CONFIG.PREFIX, '').toLowerCase();
    const cmd = commands.get(name);
    if (!cmd) { await ctx.reply(`❌ Unknown: ${name}\n${CONFIG.PREFIX}menu for list.`); return; }
    await ctx.reply(`📖 *${cmd.name}*\n\nUse: ${CONFIG.PREFIX}${cmd.name}\n${describe(cmd.name)}`);
    return;
  }
  await ctx.reply(`📖 *Help*\n\n${CONFIG.PREFIX}menu — All commands\n${CONFIG.PREFIX}help <cmd> — Detail\n\nBot: *${CONFIG.BOT_NAME}*\nMode: *${CONFIG.BOT_MODE}*\nPrefix: *${CONFIG.PREFIX}*`);
});

registerCommand('ping', ['p'], async (ctx) => {
  await ctx.reply(`🏓 Pong!\nLatency: *${Date.now() - ctx.startMs} ms*`);
});

registerCommand('alive', ['a'], async (ctx) => {
  await ctx.reply(`🤖 *Alive*\nBot: *${CONFIG.BOT_NAME}*\nUptime: *${formatDuration(process.uptime())}*\nMode: *${CONFIG.BOT_MODE}*\nTimezone: *${CONFIG.TIMEZONE}*\nConnected: *${STATE.ready}*`);
});

registerCommand('info', [], async (ctx) => {
  await ctx.reply(`ℹ️ *Bot Info*\nBot: *${CONFIG.BOT_NAME}*\nOwner: *${CONFIG.OWNER_NAME}*\nBranding: *${CONFIG.BRANDING}*\nMode: *${CONFIG.BOT_MODE}*\nPrefix: *${CONFIG.PREFIX}*`);
});

registerCommand('owner', ['creator'], async (ctx) => {
  const c = CONFIG.OWNER_NUMBER ? `+${CONFIG.OWNER_NUMBER}` : 'not configured';
  await ctx.reply(`👑 *Owner*\nName: *${CONFIG.OWNER_NAME}*\nContact: *${c}*\nBranding: *${CONFIG.BRANDING}*`);
});

registerCommand('time', ['tm'], async (ctx) => {
  const t = timeInTz({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' });
  await ctx.reply(`🕒 ${CONFIG.TIMEZONE}: *${t}*`);
});

registerCommand('date', ['dt'], async (ctx) => {
  const d = timeInTz({ weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  await ctx.reply(`📅 ${CONFIG.TIMEZONE}: *${d}*`);
});

registerCommand('groupinfo', ['ginfo'], async (ctx) => {
  if (!String(ctx.message.from).endsWith('@g.us')) { await ctx.reply('❌ Only in groups.'); return; }
  const chat = await ctx.message.getChat();
  if (!chat || !chat.isGroup) { await ctx.reply('❌ Not a group.'); return; }
  const mem = Array.isArray(chat.participants) ? chat.participants.length : 0;
  const adm = Array.isArray(chat.participants) ? chat.participants.filter(p => p.isAdmin || p.isSuperAdmin).length : 0;
  await ctx.reply(`👥 *Group Info*\nName: *${chat.name || '?'}*\nMembers: *${mem}*\nAdmins: *${adm}*`);
});

async function handleMessage(message) {
  try {
    if (!message || message.fromMe || message.from === 'status@broadcast') return;
    const body = typeof message.body === 'string' ? message.body : '';
    if (!body || body.length > 4096) return;
    if (!body.startsWith(CONFIG.PREFIX)) return;

    const withoutPrefix = body.slice(CONFIG.PREFIX.length).trim();
    if (!withoutPrefix) return;
    const [cmdName, ...args] = withoutPrefix.split(/\s+/);
    const cmd = commands.get(cmdName.toLowerCase());
    const reply = (t) => message.reply(t).catch(e => log('warn', 'Reply failed', { error: String(e) }));

    if (!cmd) { await reply(`❓ Unknown: ${cmdName}\n${CONFIG.PREFIX}menu`); return; }
    if (CONFIG.BOT_MODE === 'private' && !isOwnerMessage(message)) { await reply(`❌ Private mode.`); return; }

    const startMs = Date.now();
    await cmd.handler({ message, args, startMs, reply });
  } catch (err) {
    log('error', 'Handle error', { error: String(err && err.message || err) });
  }
}

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex'); next(); });

app.get('/health', (req, res) => {
  res.json({
    ok: true, uptime: Math.floor(process.uptime()),
    whatsapp: { ready: STATE.ready, authenticated: STATE.authenticated, authFailure: STATE.authFailure, lastReadyAt: STATE.lastReady },
    pairing: { enabled: CONFIG.AUTH_METHOD === 'pairing_code', codeReady: Boolean(STATE.pairingCode) },
    timestamp: new Date().toISOString(),
  });
});

app.get('/qr', async (req, res) => {
  if (STATE.ready) {
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connected</title></head><body style="font-family:system-ui;background:#064e3b;color:#fff;text-align:center;padding:40px;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:0"><h1 style="font-size:80px;margin:0">✅</h1><h2>Already Connected</h2></body></html>`);
    return;
  }
  if (!STATE.qr) {
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loading</title><meta http-equiv="refresh" content="3"></head><body style="font-family:system-ui;background:#0f172a;color:#fff;text-align:center;padding:40px;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:0"><h1 style="font-size:60px">⏳</h1><h2>Waiting for QR...</h2><p>Auto-refreshes every 3s</p></body></html>`);
    return;
  }
  const ascii = await new Promise((resolve) => qrcode.generate(STATE.qr, { small: true }, (q) => resolve(q)));
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QR</title><meta http-equiv="refresh" content="20"></head><body style="font-family:system-ui;background:#0f172a;color:#fff;text-align:center;padding:16px;margin:0"><h2>📷 Scan with WhatsApp</h2><div style="background:#fff;color:#000;display:inline-block;padding:20px;border-radius:12px;margin:20px auto"><pre style="margin:0;font-family:monospace;line-height:1;font-size:6px;white-space:pre">${escapeHtml(ascii)}</pre></div><p>WhatsApp → Linked Devices → Link a Device</p><p style="color:#fbbf24;font-size:13px">⏱️ Refreshes every 20s</p></body></html>`);
});

let pairingInFlight = false;
async function requestPairingCode() {
  if (CONFIG.AUTH_METHOD !== 'pairing_code') return;
  if (!CONFIG.PAIRING_PHONE || CONFIG.PAIRING_PHONE.length < 8) { log('warn', 'PAIRING_PHONE missing'); return; }
  if (!STATE.client || typeof STATE.client.requestPairingCode !== 'function') { return; }
  if (STATE.ready) return;
  if (STATE.pairingCode && STATE.pairingAt && (Date.now() - STATE.pairingAt < 40000)) return;
  if (pairingInFlight) return;
  pairingInFlight = true;
  try {
    const raw = await STATE.client.requestPairingCode(CONFIG.PAIRING_PHONE);
    const code = formatPairingCode(raw);
    if (code && code.length >= 6) {
      STATE.pairingCode = code;
      STATE.pairingAt = Date.now();
      log('info', '====== PAIRING CODE READY ======', { code });
    } else {
      log('warn', 'Empty code');
    }
  } catch (err) {
    log('error', 'Pairing request failed', { error: String(err && err.message || err) });
  } finally {
    pairingInFlight = false;
  }
}

app.get('/pair.json', async (req, res) => {
  if (CONFIG.AUTH_METHOD !== 'pairing_code') { res.status(404).json({ error: 'not_enabled' }); return; }
  if (!CONFIG.PAIRING_SECRET || req.query.secret !== CONFIG.PAIRING_SECRET) { res.status(401).json({ error: 'unauthorized' }); return; }
  await requestPairingCode();
  res.json({
    ready: STATE.ready, authenticated: STATE.authenticated,
    code: STATE.pairingCode,
    ageSeconds: STATE.pairingAt ? Math.floor((Date.now() - STATE.pairingAt) / 1000) : null,
  });
});

app.get('/pair', async (req, res) => {
  if (CONFIG.AUTH_METHOD !== 'pairing_code') { res.status(404).type('text/plain').send('Set AUTH_METHOD=pairing_code in env.'); return; }
  if (!CONFIG.PAIRING_SECRET) { res.status(500).type('text/plain').send('PAIRING_SECRET not set.'); return; }
  if (req.query.secret !== CONFIG.PAIRING_SECRET) { res.status(401).type('text/plain').send('Wrong secret.'); return; }

  await requestPairingCode();

  if (STATE.ready) {
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connected</title></head><body style="font-family:system-ui;background:#064e3b;color:#fff;text-align:center;padding:40px;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:0"><h1 style="font-size:80px;margin:0">✅</h1><h2>Already Connected</h2></body></html>`);
    return;
  }

  const code = STATE.pairingCode;
  const ageSec = STATE.pairingAt ? Math.floor((Date.now() - STATE.pairingAt) / 1000) : null;
  const fresh = ageSec !== null && ageSec <= 60;

  if (!code) {
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loading</title><meta http-equiv="refresh" content="5"></head><body style="font-family:system-ui;background:#0f172a;color:#fff;text-align:center;padding:40px;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:0"><h1 style="font-size:60px">⏳</h1><h2>Getting Pairing Code...</h2><p>Auto-refresh every 5s</p><p style="color:#94a3b8;font-size:13px;max-width:400px;line-height:1.7">If stuck 60s+, check env:<br>✓ AUTH_METHOD = pairing_code<br>✓ PAIRING_SECRET set<br>✓ PAIRING_PHONE = digits only</p></body></html>`);
    return;
  }

  const border = fresh ? '#38bdf8' : '#fbbf24';
  const noteBg = fresh ? '#064e3b' : '#78350f';
  const noteFg = fresh ? '#6ee7b7' : '#fcd34d';
  const note = fresh ? '⏱️ Expires ~60 seconds' : '⚠️ Expired. Refresh.';
  const codeNoDash = code.replace(/-/g, '');

  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pair</title><meta http-equiv="refresh" content="45"><style>*{box-sizing:border-box}body{font-family:system-ui;background:#0f172a;color:#fff;margin:0;padding:16px;min-height:100vh;display:flex;align-items:center;justify-content:center}.w{max-width:480px;width:100%;background:#1e293b;padding:22px;border-radius:16px}.code{font-family:monospace;font-size:48px;letter-spacing:6px;font-weight:900;padding:26px 8px;margin:20px 0;background:#0f172a;border:3px solid ${border};border-radius:12px;text-align:center;color:${border};cursor:pointer;word-break:break-all}.b{display:block;width:100%;padding:14px;border:0;border-radius:10px;background:#38bdf8;color:#0f172a;font-size:16px;font-weight:800;margin:8px 0;cursor:pointer}.h{color:#94a3b8;font-size:13px;text-align:center;margin:12px 0}.n{background:${noteBg};color:${noteFg};padding:10px;border-radius:8px;text-align:center;font-size:13px;margin-top:14px}ol{padding-left:22px;color:#cbd5e1;line-height:1.8;font-size:15px}</style></head><body><div class="w"><h2 style="text-align:center">🔗 WhatsApp Pair Code</h2><div class="code" onclick="c()">${escapeHtml(code)}</div><button class="b" onclick="c()">📋 Copy Code</button><p class="h" id="m"></p><div style="background:#0f172a;padding:14px 18px;border-radius:10px;margin-top:18px"><ol><li>Open <b>WhatsApp</b></li><li><b>Settings → Linked Devices</b></li><li><b>Link a Device</b></li><li><b>"Link with phone number instead"</b></li><li>Paste 8-char code</li></ol></div><div class="n">${note}</div></div><script>function c(){var t="${codeNoDash}";var m=document.getElementById("m");if(navigator.clipboard){navigator.clipboard.writeText(t).then(function(){m.textContent="✅ Copied!";m.style.color="#10b981"}).catch(function(){f(t,m)})}else{f(t,m)}}function f(t,m){var a=document.createElement("textarea");a.value=t;a.style.position="fixed";a.style.opacity="0";document.body.appendChild(a);a.focus();a.select();try{document.execCommand("copy");m.textContent="✅ Copied!";m.style.color="#10b981"}catch(e){m.textContent="⚠️ Copy manually";m.style.color="#fbbf24"}document.body.removeChild(a)}</script></body></html>`);
});

app.use((req, res) => res.status(404).json({ error: 'not_found', hint: 'Try /health /qr /pair' }));

function createClient() {
  fs.mkdirSync(CONFIG.SESSION_DATA_PATH, { recursive: true });
  const opts = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote'] };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) opts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'aliya-baby-bot', dataPath: CONFIG.SESSION_DATA_PATH }),
    puppeteer: opts,
  });

  client.on('qr', (qr) => {
    STATE.qr = qr; STATE.qrAt = Date.now(); STATE.ready = false;
    log('info', 'QR generated. For pairing-code visit /pair?secret=YOUR_SECRET');
    if (CONFIG.AUTH_METHOD === 'pairing_code') {
      setTimeout(() => requestPairingCode().catch(() => {}), 1000);
    } else {
      qrcode.generate(qr, { small: true });
    }
  });
  client.on('loading_screen', (p) => log('debug', `Loading ${p}%`));
  client.on('authenticated', () => { STATE.authenticated = true; STATE.authFailure = false; log('info', 'Authenticated'); });
  client.on('auth_failure', (m) => { STATE.authFailure = true; STATE.ready = false; log('error', 'Auth failed', { error: String(m) }); });
  client.on('ready', () => { STATE.ready = true; STATE.authenticated = true; STATE.authFailure = false; STATE.lastReady = new Date().toISOString(); STATE.pairingCode = null; log('info', `READY. Bot: ${CONFIG.BOT_NAME}`); });
  client.on('disconnected', (r) => { STATE.ready = false; STATE.authenticated = false; log('warn', 'Disconnected', { reason: String(r) }); });
  client.on('message', (m) => { handleMessage(m).catch(e => log('error', 'Handler failed', { error: String(e && e.message || e) })); });
  return client;
}

async function main() {
  log('info', '=====================================');
  log('info', `Bot: ${CONFIG.BOT_NAME}`);
  log('info', `Mode: ${CONFIG.BOT_MODE} | Auth: ${CONFIG.AUTH_METHOD}`);
  log('info', `Phone set: ${CONFIG.PAIRING_PHONE ? 'yes' : 'no'} | Secret set: ${CONFIG.PAIRING_SECRET ? 'yes' : 'no'}`);
  log('info', '=====================================');

  app.listen(CONFIG.PORT, '0.0.0.0', () => {
    log('info', `HTTP listening on :${CONFIG.PORT}`);
    log('info', `Health: /health | QR: /qr | Pair: /pair?secret=YOUR_SECRET`);
  });

  STATE.client = createClient();
  try {
    await STATE.client.initialize();
  } catch (err) {
    log('error', 'Init failed', { error: String(err && err.message || err) });
    setTimeout(() => process.exit(1), 5000);
  }
}

process.on('SIGTERM', async () => { log('info', 'SIGTERM'); try { if (STATE.client) await STATE.client.destroy(); } catch (e) {} process.exit(0); });
process.on('SIGINT', async () => { log('info', 'SIGINT'); try { if (STATE.client) await STATE.client.destroy(); } catch (e) {} process.exit(0); });
process.on('unhandledRejection', (e) => log('error', 'Unhandled', { error: String(e && e.message || e) }));
process.on('uncaughtException', (e) => log('error', 'Uncaught', { error: String(e && e.message || e) }));

main().catch((e) => { log('error', 'Fatal', { error: String(e && e.message || e) }); process.exit(1); });
