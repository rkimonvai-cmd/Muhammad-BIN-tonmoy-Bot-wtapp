/* SIMPLE-v3 — auto pairing code, single file */
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');

// ================= শুধু এই লাইনটা বদলাও =================
const MY_PHONE = '8801712345678'; // দেশের কোড + নম্বর, শুধু সংখ্যা
// =======================================================

const VERSION = 'SIMPLE-v3';
const PREFIX = '.';
const TZ = 'Asia/Dhaka';
const BOT_NAME = '𒁂 𝘼𝙇𝙄𝙔𝘼 𝘽𝘼𝘽𝙔__༊⫸';
const OWNER_NAME = '𒁂【 𝘼𝘾𝙎 𝘾𝙔𝘽𝙀𝙍 𝙇𝙀𝘼𝘿𝙀𝙍 ☻ 𝙑𝘼𝙐 】𒁂⫸';
const BRAND = 'ACS TONMOY';

const PORT = process.env.PORT || 3000;
const BOOT = Date.now();

const S = {
  ready: false, authenticated: false, authFail: false,
  code: null, codeAt: null, lastError: null, connectedAt: null, wid: null
};

let client = null;
let requesting = false;

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtCode(raw) {
  if (!raw) return null;
  const t = String(raw).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (t.length !== 8) return String(raw).toUpperCase();
  return t.slice(0, 4) + '-' + t.slice(4);
}

function setCode(raw) {
  const code = fmtCode(raw);
  if (!code) return;
  if (S.code !== code) {
    S.code = code;
    S.codeAt = Date.now();
    console.log('PAIRING CODE: ' + code);
  }
  S.lastError = null;
}

async function requestCode(c) {
  if (!c || c !== client || requesting || S.ready) return;
  requesting = true;
  try {
    await delay(1500);
    const raw = await c.requestPairingCode(MY_PHONE);
    setCode(raw);
    if (!S.code) S.lastError = 'empty code (will retry)';
  } catch (e) {
    S.lastError = 'pair: ' + ((e && e.message) || e);
    console.error('PAIR ERROR:', S.lastError);
    requesting = false;
    setTimeout(() => requestCode(c), 8000);
    return;
  }
  requesting = false;
}

async function onMessage(msg) {
  try {
    if (!msg || msg.from === 'status@broadcast') return;
    const body = (msg.body || '').trim();
    if (!body) return;

    let cmd = '';
    if (body.startsWith(PREFIX)) {
      const parts = body.slice(PREFIX.length).trim().split(/\s+/);
      cmd = (parts.shift() || '').toLowerCase();
    } else {
      const one = body.toLowerCase();
      if (['menu', 'help', 'ping', 'alive', 'info', 'owner', 'time', 'date'].includes(one)) cmd = one;
    }
    if (!cmd) return;

    const reply = (t) => msg.reply(t);
    const uptime = () => {
      const s = Math.floor((Date.now() - BOOT) / 1000);
      const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      return (d ? d + 'd ' : '') + (h ? h + 'h ' : '') + (m ? m + 'm ' : '') + sec + 's';
    };
    const nowT = () => new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour12: true });

    switch (cmd) {
      case 'ping': {
        const t0 = Date.now();
        await reply('🏓 *Pong!*\n⚡ ' + (Date.now() - t0) + ' ms');
        break;
      }
      case 'alive':
        await reply('✅ *' + BOT_NAME + '* is alive!\n⏱ Uptime: ' + uptime() + '\n🕒 ' + nowT() + ' (' + TZ + ')');
        break;
      case 'menu':
      case 'help':
        await reply(
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
        await reply('🤖 *Bot:* ' + BOT_NAME + '\n👑 *Owner:* ' + OWNER_NAME + '\n🏷 *Brand:* ' + BRAND + '\n⚙️ *Prefix:* ' + PREFIX + '\n🌐 *Mode:* public\n🕒 *TZ:* ' + TZ + '\n📦 *Ver:* ' + VERSION);
        break;
      case 'owner':
        await reply('👑 *Owner*\n' + OWNER_NAME + '\n\n📞 wa.me/' + MY_PHONE + '\n🏷 ' + BRAND);
        break;
      case 'time':
        await reply('🕒 *Time (' + TZ + ')*\n' + nowT());
        break;
      case 'date':
        await reply('📅 *Date (' + TZ + ')*\n' + new Date().toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }));
        break;
      default:
        await reply('❓ Unknown command. Send ' + PREFIX + 'menu');
    }
  } catch (e) {
    console.error('[cmd error]', e);
  }
}

function newClient() {
  const c = new Client({
    authStrategy: new LocalAuth({ clientId: 'aliya-baby-bot', dataPath: './data' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
  });

  const mine = () => c === client;

  c.on('qr', () => {
    if (!mine()) return;
    console.log('[qr] received — asking WhatsApp for pairing code…');
    requestCode(c);
  });
  c.on('code', (code) => { if (mine()) setCode(code); });
  c.on('authenticated', () => { if (!mine()) return; S.authenticated = true; console.log('[auth] authenticated'); });
  c.on('ready', () => {
    if (!mine()) return;
    S.ready = true; S.authenticated = true; S.connectedAt = Date.now(); S.lastError = null;
    try { S.wid = c.info && c.info.wid && c.info.wid.user; } catch (e) {}
    console.log('[ready] bot online as', S.wid);
  });
  c.on('auth_failure', (m) => { if (!mine()) return; S.authFail = true; S.lastError = 'auth_failure: ' + m; console.error('[auth_failure]', m); });
  c.on('disconnected', (r) => { if (!mine()) return; S.ready = false; S.authenticated = false; S.lastError = 'disconnected: ' + r; console.error('[disconnected]', r); });
  c.on('message', onMessage);

  c.initialize().catch((e) => {
    if (!mine()) return;
    S.lastError = 'init: ' + ((e && e.message) || e);
    console.error('[init error]', e);
  });

  return c;
}

const app = express();

app.get('/', (req, res) => res.redirect('/pair'));

app.get('/health', (req, res) => {
  res.json({
    ok: true, version: VERSION, phone: MY_PHONE,
    ready: S.ready, authenticated: S.authenticated, authFail: S.authFail,
    codeReady: !!S.code, code: S.code,
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
  const old = client;
  client = null;
  requesting = false;
  S.code = null; S.codeAt = null; S.ready = false; S.authenticated = false;
  S.authFail = false; S.lastError = null; S.connectedAt = null; S.wid = null;
  client = newClient();
  if (old) { try { await Promise.race([old.destroy(), delay(5000)]); } catch (e) {} }
  res.json({ ok: true, message: 'New code in ~15s. Open /pair' });
});

function pairPage() {
  const connected = S.ready;
  const code = S.code;
  const age = S.codeAt ? Math.round((Date.now() - S.codeAt) / 1000) : null;
  const refresh = connected ? '' : '<meta http-equiv="refresh" content="6">';

  let box;
  if (connected) {
    box = '<div class="ok">✅ Connected</div>' +
          '<p class="muted">Bot online' + (S.wid ? ' as +' + esc(S.wid) : '') + '। WhatsApp-এ <b>.menu</b> পাঠাও।</p>';
  } else if (code) {
    box = '<div class="muted">Your pairing code</div>' +
          '<div class="code" id="c">' + esc(code) + '</div>' +
          '<button onclick="cp()">📋 Copy Code</button>' +
          '<div class="muted small">code age: ' + age + 's · page auto-refreshes</div>';
  } else {
    box = '<div class="wait">⏳ Generating pairing code…</div>' +
          '<div class="muted small">১০–২০ সেকেন্ড অপেক্ষা করো। পেজ নিজেই refresh হবে।</div>';
  }

  return '<!doctype html><html lang="bn"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    refresh + '<title>Pair Code</title><style>' +
    'body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;justify-content:center;padding:18px}' +
    '.card{max-width:420px;width:100%;background:#1e293b;border-radius:16px;padding:20px;box-shadow:0 8px 24px #0006}' +
    'h1{font-size:16px;margin:0 0 14px;text-align:center;color:#38bdf8;word-break:break-word}' +
    '.code{font-size:34px;font-weight:800;letter-spacing:4px;text-align:center;padding:14px;margin:10px 0;background:#0f172a;border:2px dashed #38bdf8;border-radius:12px;color:#fbbf24}' +
    'button{width:100%;padding:14px;font-size:17px;font-weight:700;border:0;border-radius:12px;background:#22c55e;color:#04210f}' +
    '.ok{font-size:22px;font-weight:800;text-align:center;color:#22c55e;padding:14px;background:#052e16;border-radius:12px}' +
    '.wait{font-size:18px;text-align:center;color:#38bdf8;padding:16px}' +
    '.muted{color:#94a3b8;font-size:14px;text-align:center;margin:8px 0}.small{font-size:12px}' +
    'ol{font-size:14px;line-height:1.7;color:#cbd5e1;padding-left:20px}' +
    'hr{border:0;border-top:1px solid #334155;margin:16px 0}.err{color:#f87171;font-size:12px;word-break:break-word}' +
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

client = newClient();
