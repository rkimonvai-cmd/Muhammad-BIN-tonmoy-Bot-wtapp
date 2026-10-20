'use strict';

// ═══════════════════════════════════════════════════════════
// ✏️ এখানে আপনার WhatsApp নম্বর দিন (একটি লাইনই বদলাতে হবে)
// ═══════════════════════════════════════════════════════════
// নিয়ম:  + ছাড়া, space ছাড়া, দেশের কোডসহ, শুধু ডিজিট
// উদাহরণ: 01712345678 → 8801712345678
// ভুল:   +8801712345678, 01712345678, 880 1712-345678
// ঠিক:   8801712345678
const MY_WHATSAPP_NUMBER = '8801333250762'; // ← এই লাইনটি বদলান
// ═══════════════════════════════════════════════════════════

try { require('dotenv').config(); } catch (e) {}

const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');

const PORT = parseInt(process.env.PORT || '3000', 10) || 3000;
const PREFIX = process.env.PREFIX || '.';
const BOT_NAME = process.env.BOT_NAME || '𒁂 𝘼𝙇𝙄𝙔𝘼 𝘽𝘼𝘽𝙔__༊⫸';
const OWNER_NAME = process.env.OWNER_NAME || '𒁂【 𝘼𝘾𝙎 𝘾𝙔𝘽𝙀𝙍 𝙇𝙀𝘼𝘿𝙀𝙍 ☻ 𝙑𝘼𝙐 】𒁂⫸';
const BRANDING = process.env.BRANDING_NAME || 'ACS TONMOY';
const TIMEZONE = process.env.TIMEZONE || 'Asia/Dhaka';
const BOT_MODE = (process.env.BOT_MODE || 'public').toLowerCase();
const OWNER_NUMBER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const SESSION_PATH = process.env.SESSION_DATA_PATH || path.join(process.cwd(), 'data', 'session');

const STATE = {
  code: null, codeAt: 0,
  ready: false, authenticated: false, authFailure: false,
  lastReady: null, client: null, requesting: false
};

function log(msg, extra) {
  const ts = new Date().toISOString();
  console.log('[' + ts + '] ' + msg + (extra ? ' ' + JSON.stringify(extra) : ''));
}

function fmtCode(raw) {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 8 ? (c.slice(0, 4) + '-' + c.slice(4)) : c;
}

async function requestPairingCode() {
  if (!STATE.client || STATE.ready || STATE.requesting) return;
  if (!MY_WHATSAPP_NUMBER || MY_WHATSAPP_NUMBER.length < 8) {
    log('❌ MY_WHATSAPP_NUMBER not set (line 12 of index.js)');
    return;
  }
  if (STATE.code && (Date.now() - STATE.codeAt) < 40000) return;

  STATE.requesting = true;
  try {
    log('Requesting pairing code for ' + MY_WHATSAPP_NUMBER + '...');
    const raw = await STATE.client.requestPairingCode(MY_WHATSAPP_NUMBER);
    const code = fmtCode(raw);
    if (code.length >= 6) {
      STATE.code = code;
      STATE.codeAt = Date.now();
      log('');
      log('════════════════════════════════════════');
      log('   🔑 PAIRING CODE:  ' + code);
      log('════════════════════════════════════════');
      log('   এই কোড ৬০ সেকেন্ডের মধ্যে WhatsApp-এ দিন');
      log('   অথবা /pair URL খুলুন');
      log('════════════════════════════════════════');
      log('');
    }
  } catch (e) {
    log('❌ Pairing failed: ' + (e && e.message || e));
  } finally {
    STATE.requesting = false;
  }
}

function createClient() {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'aliya-baby-bot', dataPath: SESSION_PATH }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote']
    }
  });

  client.on('qr', () => {
    log('📱 QR event — requesting pairing code instead...');
    setTimeout(() => requestPairingCode().catch(() => {}), 800);
  });
  client.on('authenticated', () => {
    STATE.authenticated = true;
    STATE.authFailure = false;
    log('✅ AUTHENTICATED — WhatsApp accepted the code!');
  });
  client.on('auth_failure', (m) => {
    STATE.authFailure = true; STATE.ready = false;
    log('❌ AUTH FAILED: ' + m);
  });
  client.on('ready', () => {
    STATE.ready = true; STATE.authenticated = true; STATE.authFailure = false;
    STATE.lastReady = new Date().toISOString();
    STATE.code = null;
    log('');
    log('🎉🎉🎉 BOT READY! WhatsApp connected! 🎉🎉🎉');
    log('Now message yourself: ' + PREFIX + 'ping');
    log('');
  });
  client.on('disconnected', (r) => {
    STATE.ready = false;
    log('⚠️ Disconnected: ' + r);
  });
  client.on('message', (m) => { handleMessage(m).catch(e => log('msg err: ' + e.message)); });

  return client;
}

const cmds = {};
function cmd(name, fn) { cmds[name] = fn; }

cmd('ping', async (m) => { await m.reply('🏓 Pong!'); });
cmd('menu', async (m) => {
  await m.reply(
    '╭━━━〔 ' + BOT_NAME + ' 〕━━━╮\n' +
    '┃ 📋 Menu\n' +
    '┣━━━━━━━━━━━━━━━\n' +
    '1. ' + PREFIX + 'ping\n' +
    '2. ' + PREFIX + 'alive\n' +
    '3. ' + PREFIX + 'info\n' +
    '4. ' + PREFIX + 'owner\n' +
    '5. ' + PREFIX + 'time\n' +
    '6. ' + PREFIX + 'date\n' +
    '7. ' + PREFIX + 'help\n' +
    '╰━━━━━━━━━━━━━━━╯\n\n' + BRANDING
  );
});
cmd('alive', async (m) => {
  const u = Math.floor(process.uptime());
  await m.reply('🤖 Alive\nBot: ' + BOT_NAME + '\nUptime: ' + u + 's\nMode: ' + BOT_MODE);
});
cmd('info', async (m) => {
  await m.reply('ℹ️ Bot Info\nBot: ' + BOT_NAME + '\nOwner: ' + OWNER_NAME + '\nBranding: ' + BRANDING + '\nMode: ' + BOT_MODE);
});
cmd('owner', async (m) => {
  const c = OWNER_NUMBER ? '+' + OWNER_NUMBER : 'not set';
  await m.reply('👑 Owner\n' + OWNER_NAME + '\n' + c);
});
cmd('time', async (m) => {
  try {
    const t = new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(new Date());
    await m.reply('🕒 ' + TIMEZONE + ': ' + t);
  } catch (e) { await m.reply('Time error'); }
});
cmd('date', async (m) => {
  try {
    const d = new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    }).format(new Date());
    await m.reply('📅 ' + d);
  } catch (e) { await m.reply('Date error'); }
});
cmd('help', async (m) => { await m.reply('📖 Use ' + PREFIX + 'menu to see all commands'); });

async function handleMessage(msg) {
  try {
    if (!msg || msg.fromMe) return;
    if (msg.from === 'status@broadcast') return;
    const body = msg.body || '';
    if (!body.startsWith(PREFIX)) return;
    const withoutPrefix = body.slice(PREFIX.length).trim();
    if (!withoutPrefix) return;
    const [name] = withoutPrefix.split(/\s+/);
    const fn = cmds[name.toLowerCase()];
    if (!fn) return;
    if (BOT_MODE === 'private' && OWNER_NUMBER) {
      const raw = (msg.author || msg.from) || '';
      const num = String(raw._serialized || raw).split('@')[0].split(':')[0].replace(/\D/g, '');
      if (num !== OWNER_NUMBER) {
        await msg.reply('❌ Private mode.');
        return;
      }
    }
    await fn(msg);
  } catch (e) {
    log('handler error: ' + (e && e.message || e));
  }
}

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    botRunning: true,
    phone: MY_WHATSAPP_NUMBER,
    whatsapp: {
      ready: STATE.ready,
      authenticated: STATE.authenticated,
      authFailure: STATE.authFailure
    },
    codeReady: Boolean(STATE.code),
    codeAgeSeconds: STATE.codeAt ? Math.floor((Date.now() - STATE.codeAt) / 1000) : null,
    timestamp: new Date().toISOString()
  });
});

app.get('/code', async (req, res) => {
  if (STATE.ready) {
    res.type('text').send('ALREADY CONNECTED — no code needed');
    return;
  }
  if (!STATE.code || (Date.now() - STATE.codeAt) > 50000) {
    await requestPairingCode();
  }
  res.type('text').send(STATE.code || 'Please wait 15 seconds and refresh');
});

app.get('/pair', async (req, res) => {
  if (STATE.ready) {
    res.type('html').send(
      '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '</head><body style="font-family:system-ui;background:#064e3b;color:#fff;' +
      'text-align:center;padding:40px;min-height:100vh;display:flex;' +
      'align-items:center;justify-content:center;flex-direction:column;margin:0">' +
      '<h1 style="font-size:90px;margin:0">✅</h1>' +
      '<h2>Already Connected!</h2>' +
      '<p>Bot is linked to WhatsApp.</p>' +
      '<p>Send ' + PREFIX + 'ping to yourself to test.</p>' +
      '</body></html>'
    );
    return;
  }

  if (!STATE.code || (Date.now() - STATE.codeAt) > 50000) {
    await requestPairingCode();
  }

  const code = STATE.code;
  if (!code) {
    res.type('html').send(
      '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Wait</title><meta http-equiv="refresh" content="5"></head>' +
      '<body style="font-family:system-ui;background:#0f172a;color:#fff;' +
      'text-align:center;padding:40px;min-height:100vh;display:flex;' +
      'align-items:center;justify-content:center;flex-direction:column;margin:0">' +
      '<h1 style="font-size:72px;margin:0">⏳</h1>' +
      '<h2>Getting Pairing Code...</h2>' +
      '<p>Auto-refresh every 5 seconds</p>' +
      '<p style="color:#fbbf24;max-width:420px;line-height:1.8;font-size:14px">' +
      'If stuck for more than 60 seconds:<br>' +
      '1. Check phone number on line 12 of index.js<br>' +
      '2. Must be like: 8801712345678<br>' +
      '3. No +, no space, no dash<br>' +
      '4. Then Redeploy on Render</p>' +
      '</body></html>'
    );
    return;
  }

  const age = STATE.codeAt ? Math.floor((Date.now() - STATE.codeAt) / 1000) : 0;
  const fresh = age <= 60;
  const borderColor = fresh ? '#38bdf8' : '#fbbf24';
  const codeClean = code.replace(/-/g, '');

  res.type('html').send(
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Pair Code</title><meta http-equiv="refresh" content="45">' +
    '<style>*{box-sizing:border-box}' +
    'body{font-family:system-ui;background:#0f172a;color:#fff;padding:16px;margin:0;' +
    'min-height:100vh;display:flex;align-items:center;justify-content:center}' +
    '.w{max-width:480px;width:100%;background:#1e293b;padding:22px;border-radius:16px}' +
    '.code{font-family:monospace;font-size:52px;letter-spacing:8px;font-weight:900;' +
    'padding:26px 8px;margin:20px 0;background:#0f172a;border:3px solid ' + borderColor + ';' +
    'border-radius:12px;text-align:center;color:' + borderColor + ';cursor:pointer;' +
    'word-break:break-all;user-select:all}' +
    '.b{display:block;width:100%;padding:16px;border:0;border-radius:10px;' +
    'background:#38bdf8;color:#0f172a;font-size:17px;font-weight:800;margin:8px 0;cursor:pointer}' +
    '.h{color:#94a3b8;font-size:13px;text-align:center;margin:12px 0}' +
    'ol{padding-left:22px;color:#cbd5e1;line-height:1.9;font-size:15px}' +
    '.ph{background:#064e3b;color:#6ee7b7;padding:10px;border-radius:8px;' +
    'text-align:center;font-size:13px;margin-bottom:12px}' +
    '.n{background:' + (fresh ? '#064e3b' : '#78350f') + ';' +
    'color:' + (fresh ? '#6ee7b7' : '#fcd34d') + ';padding:10px;' +
    'border-radius:8px;text-align:center;font-size:13px;margin-top:14px}' +
    '</style></head><body><div class="w">' +
    '<h2 style="text-align:center;margin:0 0 4px">🔑 Pair Code</h2>' +
    '<div class="ph">📱 ' + MY_WHATSAPP_NUMBER + '</div>' +
    '<div class="code" onclick="c()">' + code + '</div>' +
    '<button class="b" onclick="c()">📋 Copy Code</button>' +
    '<p class="h" id="m"></p>' +
    '<ol>' +
    '<li>Open <b>WhatsApp</b></li>' +
    '<li><b>⚙️ Settings → Linked Devices</b></li>' +
    '<li><b>Link a Device</b></li>' +
    '<li>Tap <b>「Link with phone number instead」</b></li>' +
    '<li>Paste the 8-character code</li>' +
    '</ol>' +
    '<div class="n">' + (fresh ? '⏱️ Expires ~60 sec — act fast!' : '⚠️ Possibly expired — refresh page') + '</div>' +
    '<p class="h">Auto-refresh every 45s</p>' +
    '</div><script>' +
    'function c(){var t="' + codeClean + '";var m=document.getElementById("m");' +
    'if(navigator.clipboard){navigator.clipboard.writeText(t).then(function(){' +
    'm.textContent="✅ Copied! Now paste in WhatsApp.";m.style.color="#10b981"' +
    '}).catch(function(){f(t,m)})}else{f(t,m)}}' +
    'function f(t,m){var a=document.createElement("textarea");a.value=t;' +
    'a.style.position="fixed";a.style.opacity="0";document.body.appendChild(a);' +
    'a.focus();a.select();try{document.execCommand("copy");m.textContent="✅ Copied!";' +
    'm.style.color="#10b981"}catch(e){m.textContent="⚠️ Copy manually";' +
    'm.style.color="#fbbf24"}document.body.removeChild(a)}' +
    '</script></body></html>'
  );
});

app.use((req, res) => res.status(404).type('text').send('Try /health /pair /code'));

async function main() {
  log('════════════════════════════════════════');
  log('  ' + BOT_NAME);
  log('════════════════════════════════════════');
  log('  Phone: ' + MY_WHATSAPP_NUMBER);
  log('  Port: ' + PORT);
  log('════════════════════════════════════════');

  if (MY_WHATSAPP_NUMBER === '8801712345678') {
    log('');
    log('⚠️⚠️⚠️  WARNING');
    log('You MUST edit line 12 — change MY_WHATSAPP_NUMBER');
    log('Currently using placeholder: 8801712345678');
    log('Replace with YOUR number like: 8801712345678');
    log('');
  }

  app.listen(PORT, '0.0.0.0', () => {
    log('HTTP listening on :' + PORT);
    log('URLs: /health  /pair  /code');
  });

  STATE.client = createClient();
  try {
    await STATE.client.initialize();
    log('WhatsApp client initializing...');
  } catch (e) {
    log('Init error: ' + (e && e.message || e));
  }
}

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('uncaughtException', (e) => log('UNCAUGHT: ' + (e && e.message || e)));
process.on('unhandledRejection', (e) => log('UNHANDLED: ' + (e && e.message || e)));

main().catch(e => { log('Fatal: ' + (e && e.message || e)); process.exit(1); });
