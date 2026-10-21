/* BAILEYS-v1 — pairing code, no Chromium */
const express = require('express');
const fs = require('fs');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require('@whiskeysockets/baileys');

// ============ শুধু এই লাইন ============
const MY_PHONE = '8801333250762';
// =====================================

const VERSION = 'BAILEYS-v1';
const PREFIX = '.';
const TZ = 'Asia/Dhaka';
const BOT_NAME = '𒁂 𝘼𝙇𝙄𝙔𝘼 𝘽𝘼𝘽𝙔__༊⫸';
const OWNER_NAME = '𒁂【 𝘼𝘾𝙎 𝘾𝙔𝘽𝙀𝙍 𝙇𝙀𝘼𝘿𝙀𝙍 ☻ 𝙑𝘼𝙐 】𒁂⫸';
const BRAND = 'ACS TONMOY';
const PORT = process.env.PORT || 3000;
const BOOT = Date.now();
const SESSION = './data/session';

const S = { ready: false, code: null, codeAt: null, lastError: null, wid: null };
let sock = null;
let starting = false;

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (p) => String(p).replace(/[^0-9]/g, '');

async function pairNow() {
  if (!sock) { S.lastError = 'socket not ready'; return; }
  try {
    const raw = await sock.requestPairingCode(clean(MY_PHONE));
    S.code = raw;
    S.codeAt = Date.now();
    S.lastError = null;
    console.log('PAIR CODE:', raw);
  } catch (e) {
    S.lastError = 'pair: ' + ((e && e.message) || e);
    console.error(S.lastError);
  }
}

function textOf(m) {
  const x = (m && m.message) || {};
  if (x.conversation) return x.conversation;
  if (x.extendedTextMessage && x.extendedTextMessage.text) return x.extendedTextMessage.text;
  if (x.imageMessage && x.imageMessage.caption) return x.imageMessage.caption;
  if (x.videoMessage && x.videoMessage.caption) return x.videoMessage.caption;
  return '';
}

function uptimeStr() {
  const s = Math.floor((Date.now() - BOOT) / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (d ? d + 'd ' : '') + (h ? h + 'h ' : '') + (m ? m + 'm ' : '') + sec + 's';
}

async function handle(m) {
  const body = (textOf(m) || '').trim();
  if (!body) return;

  let cmd = '';
  if (body.startsWith(PREFIX)) {
    cmd = (body.slice(PREFIX.length).trim().split(/\s+/)[0] || '').toLowerCase();
  } else {
    const one = body.toLowerCase();
    if (['menu', 'help', 'ping', 'alive', 'info', 'owner', 'time', 'date'].includes(one)) cmd = one;
  }
  if (!cmd) return;

  const jid = m.key.remoteJid;
  const send = (t) => sock.sendMessage(jid, { text: t }, { quoted: m });

  switch (cmd) {
    case 'ping': {
      const t0 = Date.now();
      await send('🏓 *Pong!*\n⚡ ' + (Date.now() - t0) + ' ms');
      break;
    }
    case 'alive':
      await send('✅ *' + BOT_NAME + '* is alive!\n⏱ Uptime: ' + uptimeStr() +
        '\n🕒 ' + new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour12: true }) + ' (' + TZ + ')');
      break;
    case 'menu':
    case 'help':
      await send(
        '╭─「 *' + BOT_NAME + '* 」\n' +
        '│ ' + PREFIX + 'ping — speed test\n' +
        '│ ' + PREFIX + 'alive — bot status\n' +
        '│ ' + PREFIX + 'menu — this menu\n' +
        '│ ' + PREFIX + 'info — bot info\n' +
        '│ ' + PREFIX + 'owner — owner info\n' +
        '│ ' + PREFIX + 'time — Dhaka time\n' +
        '│ ' + PREFIX + 'date — Dhaka date\n' +
        '╰─『 ' + BRAND + ' 』'
      );
      break;
    case 'info':
      await send('🤖 *Bot:* ' + BOT_NAME + '\n👑 *Owner:* ' + OWNER_NAME +
        '\n🏷 *Brand:* ' + BRAND + '\n⚙️ *Prefix:* ' + PREFIX +
        '\n🌐 *Mode:* public\n🕒 *TZ:* ' + TZ + '\n📦 *Ver:* ' + VERSION);
      break;
    case 'owner':
      await send('👑 *Owner*\n' + OWNER_NAME + '\n\n📞 wa.me/' + clean(MY_PHONE) + '\n🏷 ' + BRAND);
      break;
    case 'time':
      await send('🕒 *Time (' + TZ + ')*\n' + new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour12: true }));
      break;
    case 'date':
      await send('📅 *Date (' + TZ + ')*\n' + new Date().toLocaleDateString('en-GB',
        { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }));
      break;
    default:
      await send('❓ Unknown command. Send ' + PREFIX + 'menu');
  }
}

async function start() {
  if (starting) return;
  starting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION);

    let version;
    try {
      const v = await fetchLatestBaileysVersion();
      version = v.version;
    } catch (e) { version = undefined; }

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['ACS TONMOY', 'Chrome', '120.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
      const { connection, lastDisconnect, qr } = u;

      if (qr && sock && sock.authState && !sock.authState.creds.registered) {
        if (!S.code) await pairNow();
      }

      if (connection === 'open') {
        S.ready = true; S.code = null; S.lastError = null;
        try { S.wid = (sock.user.id || '').split(':')[0]; } catch (e) {}
        console.log('CONNECTED as', S.wid);
      }

      if (connection === 'close') {
        S.ready = false;
        const sc = (lastDisconnect && lastDisconnect.error && lastDisconnect.error.output &&
                    lastDisconnect.error.output.statusCode) || 0;
        S.lastError = 'closed(' + sc + ')';
        starting = false;
        if (sc === DisconnectReason.loggedOut) {
          try { fs.rmSync(SESSION, { recursive: true, force: true }); } catch (e) {}
          S.code = null;
        }
        setTimeout(start, 4000);
      }
    });

    sock.ev.on('messages.upsert', async (ev) => {
      if (ev.type !== 'notify') return;
      for (const m of ev.messages) {
        try {
          if (m.message && !m.key.fromMe) await handle(m);
        } catch (e) { console.error('[msg]', e); }
      }
    });

  } catch (e) {
    S.lastError = 'start: ' + ((e && e.message) || e);
    console.error(e);
    starting = false;
    setTimeout(start, 5000);
    return;
  }
  starting = false;
}

const app = express();
app.get('/', (req, res) => res.redirect('/pair'));

app.get('/health', (req, res) => {
  res.json({
    ok: true, version: VERSION, phone: clean(MY_PHONE),
    ready: S.ready, codeReady: !!S.code, code: S.code,
    codeAge: S.codeAt ? Math.round((Date.now() - S.codeAt) / 1000) : null,
    wid: S.wid, lastError: S.lastError,
    uptimeSeconds: Math.round((Date.now() - BOOT) / 1000),
    timestamp: new Date().toISOString()
  });
});

app.get('/code', (req, res) => {
  res.type('text/plain; charset=utf-8');
  if (S.ready) return res.send('ALREADY_CONNECTED');
  if (!S.code) return res.send('WAITING');
  res.send(S.code);
});

app.get('/newcode', async (req, res) => {
  if (S.ready) return res.send('ALREADY_CONNECTED');
  S.code = null;
  if (!sock) { start(); await delay(4000); }
  await pairNow();
  res.json({ ok: true, code: S.code, lastError: S.lastError });
});

function pairPage() {
  const age = S.codeAt ? Math.round((Date.now() - S.codeAt) / 1000) : null;
  let box;

  if (S.ready) {
    box = '<div class="ok">✅ Connected</div>' +
          '<p class="muted">Bot online' + (S.wid ? ' as +' + esc(S.wid) : '') +
          ' । WhatsApp-এ <b>.menu</b> পাঠাও।</p>';
  } else if (S.code) {
    box = '<div class="muted">Your pairing code</div>' +
          '<div class="code" id="c">' + esc(S.code) + '</div>' +
          '<button onclick="cp()">📋 Copy Code</button>' +
          '<div class="muted small">age: ' + age + 's · page auto-refresh</div>';
  } else {
    box = '<div class="wait">⏳ Generating pairing code…</div>' +
          '<div class="muted small">১০ সেকেন্ড অপেক্ষা করো। পেজ নিজেই refresh হয়।</div>' +
          (S.lastError ? '<div class="err">' + esc(S.lastError) + '</div>' : '');
  }

  return '<!doctype html><html lang="bn"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    (S.ready ? '' : '<meta http-equiv="refresh" content="5">') +
    '<title>Pair Code</title><style>' +
    'body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;justify-content:center;padding:18px}' +
    '.card{max-width:420px;width:100%;background:#1e293b;border-radius:16px;padding:20px;box-shadow:0 8px 24px #0006}' +
    'h1{font-size:16px;margin:0 0 14px;text-align:center;color:#38bdf8;word-break:break-word}' +
    '.code{font-size:32px;font-weight:800;letter-spacing:3px;text-align:center;padding:14px;margin:10px 0;background:#0f172a;border:2px dashed #38bdf8;border-radius:12px;color:#fbbf24}' +
    'button{width:100%;padding:14px;font-size:17px;font-weight:700;border:0;border-radius:12px;background:#22c55e;color:#04210f}' +
    '.ok{font-size:22px;font-weight:800;text-align:center;color:#22c55e;padding:14px;background:#052e16;border-radius:12px}' +
    '.wait{font-size:18px;text-align:center;color:#38bdf8;padding:16px}' +
    '.muted{color:#94a3b8;font-size:14px;text-align:center;margin:8px 0}.small{font-size:12px}' +
    'ol{font-size:14px;line-height:1.7;color:#cbd5e1;padding-left:20px}' +
    'hr{border:0;border-top:1px solid #334155;margin:16px 0}.err{color:#f87171;font-size:12px;word-break:break-word;text-align:center}' +
    '</style></head><body><div class="card"><h1>𒁂 ALIYA BABY__༊⫸</h1>' + box +
    '<hr><ol><li>উপরের কোড কপি করো</li>' +
    '<li>WhatsApp → Settings → <b>Linked Devices</b> → <b>Link a Device</b></li>' +
    '<li><b>“Link with phone number instead”</b> চাপো</li>' +
    '<li>কোড paste → Next</li></ol>' +
    '<p class="err">' + (S.lastError ? 'Last error: ' + esc(S.lastError) : '') + '</p>' +
    '</div><script>function cp(){var e=document.getElementById("c");if(!e)return;var t=e.textContent.trim();' +
    'if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){alert("Copied: "+t);},function(){alert(t);});}' +
    'else{var a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove();alert("Copied: "+t);}}' +
    '</script></body></html>';
}

app.get('/pair', (req, res) => { res.type('html').send(pairPage()); });

app.listen(PORT, '0.0.0.0', () => console.log('HTTP on ' + PORT));

process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
process.on('uncaughtException', (e) => console.error('uncaughtException', e));

start();
