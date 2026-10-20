# 𒁂 𝘼𝙇𝙄𝙔𝘼 𝘽𝘼𝘽𝙔__༊⫸

Node.js, `whatsapp-web.js` এবং Express দিয়ে তৈরি একটি মডুলার WhatsApp Chatbot।

> গুরুত্বপূর্ণ: এই README-এর কোড ও Deployment নির্দেশনা প্রস্তাবিত। Render, WhatsApp Web, Chromium, Puppeteer এবং কোনো External AI Provider-এর আচরণ ভবিষ্যতে বদলাতে পারে। এখানে বাস্তবে Render ডিপ্লয় করে পরীক্ষা করা হয়েছে বলে দাবি করা হচ্ছে না।

## Features

- WhatsApp QR Login
- LocalAuth session persistence
- Express `/health` endpoint
- Dynamic command loader
- Commands: `.menu`, `.help`, `.ping`, `.alive`, `.info`, `.owner`, `.time`, `.date`, `.groupinfo`
- `public` এবং `private` bot mode
- Owner and allowed-user authorization
- Group admin metadata checks
- Command rate limiting
- Optional welcome/goodbye
- Optional anti-link
- Optional anti-spam
- Optional OpenAI-compatible AI reply
- Graceful shutdown
- Reconnect loop protection
- No public dashboard, no QR endpoint, no session endpoint

## Requirements

- Node.js 20 LTS
- WhatsApp account
- GitHub account
- Render account
- Docker deployment method for Render because `whatsapp-web.js` needs Chromium system libraries

## Local Run

```bash
cp .env.example .env
npm install
npm run check
npm start
```

`npm start` চালু করার পরে Terminal-এ QR Code আসবে। নিজের WhatsApp থেকে:

1. WhatsApp খুলুন
2. Settings / Linked Devices
3. Link a Device
4. Terminal-এ থাকা QR Code স্ক্যান করুন

QR Code কোথাও পাবলিকভাবে শেয়ার করবেন না। QR Code দিয়ে আপনার WhatsApp অ্যাকাউন্টে লগইন করা যায়।

## Render Deployment: Docker Web Service

এই প্রজেক্টে Render-এর জন্য একটি নির্দিষ্ট পদ্ধতি ব্যবহার করা হয়েছে: **Docker Web Service**। Node Native Web Service ব্যবহার করার নির্দেশনা এখানে দেওয়া হয়নি, কারণ `whatsapp-web.js`-এর জন্য Chromium shared libraries প্রয়োজন এবং Docker এগুলো নির্ভরযোগ্যভাবে সরবরাহ করতে পারে।

### Render Settings

- Repository: আপনার GitHub repository
- Branch: `main`
- Service Type: `Web Service`
- Environment: `Docker`
- Root Directory: ফাঁকা রাখুন
- Dockerfile Path: `./Dockerfile`
- Build Command: প্রযোজ্য নয়, Dockerfile ব্যবহার হবে
- Start Command: প্রযোজ্য নয়, Dockerfile-এর `CMD ["npm", "start"]` ব্যবহার হবে
- Health Check Path: `/health`
- Auto Deploy: আপনার পছন্দ অনুযায়ী
- Instance Type: Render-এর বর্তমান Plan অনুযায়ী

Render `PORT` environment variable নিজে দিয়ে থাকে। কোড `process.env.PORT` ব্যবহার করে। 

### Render Environment Variables

Render Dashboard > Environment-এ কমপক্ষে এগুলো সেট করুন:

```env
BOT_NAME=𒁂 𝘼𝙇𝙄𝙔𝘼 𝘽𝘼𝘽𝙔__༊⫸
OWNER_NAME=𒁂【 𝘼𝘾𝙎 𝘾𝙔𝘽𝙀𝙍 𝙇𝙀𝘼𝘿𝙀𝙍 ☻ 𝙑𝘼𝙐 】𒁂⫸
BRANDING_NAME=ACS TONMOY
OWNER_NUMBER=আপনার_নম্বর_দেশের_কোডসহ_উদাহরণ_8801XXXXXXXXX
PREFIX=.
BOT_LANG=en
BOT_MODE=public
TIMEZONE=Asia/Dhaka
SESSION_CLIENT_ID=aliya-baby-bot
SESSION_DATA_PATH=/app/data/session
AUTO_WELCOME=false
AUTO_GOODBYE=false
ANTI_LINK=false
ANTI_SPAM=false
AI_ENABLED=false
```

`OWNER_NUMBER`-এ `+`, স্পেস বা `@c.us` দেওয়া যাবে না—শুধু দেশের কোডসহ নম্বর দেওয়াই ভালো। `ALLOWED_USERS` প্রয়োজন হলে কমা দিয়ে একাধিক নম্বর দিন।

### Session Persistence

Render-এর Ephemeral Filesystem-এ পুনরায় deploy, restart বা spin down হলে `data/session` হারিয়ে যেতে পারে। তখন আবার QR স্ক্যান করতে হবে। Persistent Disk সুবিধা Render-এর বর্তমান Plan ও Documentation অনুযায়ী যাচাই করুন। Disk পাওয়া গেলে:

- Mount Path: `/app/data`
- Environment Variable: `SESSION_DATA_PATH=/app/data/session`

Disk না থাকলে session হারানো স্বাভাবিক। QR Code বা session ফাইল কখনো GitHub, পাবলিক লিংক বা অপরিচিত ব্যক্তির সঙ্গে শেয়ার করবেন না।

## Commands

| Command | কাজ |
|---|---|
| `.menu` | সব command-এর তালিকা |
| `.help` | ব্যবহারবিধি |
| `.ping` | response latency |
| `.alive` | bot status, uptime, bot name |
| `.info` | bot ও project information |
| `.owner` | owner display name ও contact |
| `.time` | Asia/Dhaka timezone অনুযায়ী সময় |
| `.date` | Asia/Dhaka timezone অনুযায়ী তারিখ |
| `.groupinfo` | group name, member count, description, creation date |

`PREFIX` পরিবর্তন করলে `.`-এর বদলে নতুন prefix ব্যবহার করতে হবে।

## Bot Modes

- `BOT_MODE=public`: সাধারণ অনুমোদিত command সবাই চালাতে পারবে।
- `BOT_MODE=private`: শুধু `OWNER_NUMBER` এবং `ALLOWED_USERS` command চালাতে পারবে।

## Optional Anti-Link

```env
ANTI_LINK=true
ANTI_LINK_ALLOWED_DOMAINS=youtube.com,youtu.be,example.com
ANTI_LINK_EXEMPT_ADMINS=true
ANTI_LINK_WARN=true
```

Bot-এর অবশ্যই group admin থাকতে হবে। Bot admin না হলে কোনো message delete করা হবে না।

## Optional Anti-Spam

```env
ANTI_SPAM=true
ANTI_SPAM_WINDOW_MS=15000
ANTI_SPAM_MAX_MESSAGES=8
ANTI_SPAM_EXEMPT_ADMINS=true
ANTI_SPAM_WARN=true
```

এটা group message flood limit। Bot admin না হলে কোনো moderation action নেওয়া হবে না।

## Optional AI

```env
AI_ENABLED=true
AI_API_KEY=your_secret_key
AI_MODEL=your_model_name
AI_BASE_URL=https://api.openai.com/v1
AI_REPLY_IN_GROUPS=false
```

`AI_BASE_URL` OpenAI-compatible `/v1` base path হবে। Provider অনুযায়ী authentication ও endpoint আলাদা হতে পারে; সেসব ক্ষেত্রে provider-এর documentation দেখুন।

AI চালু থাকলে direct message-এ AI উত্তর দিতে পারে। Group-এ ডিফল্টভাবে উত্তর দেয় না। `AI_REPLY_IN_GROUPS=true` করলে group-এ bot-কে mention করলে বা bot-এর message reply করলে উত্তর দিতে পারে। API key কখনো GitHub-এ commit করবেন না।

## Security Notes

- `.env` GitHub-এ upload করবেন না
- `data/session` বা `.wwebjs_auth` GitHub-এ upload করবেন না
- QR Code পাবলিকভাবে শেয়ার করবেন না
- AI API key কোথাও পাবলিক করবেন না
- Command rate limit কমানো/বাড়ানো যাবে
- Health endpoint-এ কোনো session বা QR প্রকাশ করা হয় না

## Troubleshooting

### Cannot find module

`npm install` চালান। ফাইল ও folder name হুবহু tree অনুযায়ী আছে কি না দেখুন।

### Invalid package.json

`package.json` JSON হিসেবে বৈধ কি না যাচাই করুন। `npm install` চালালে invalid JSON ধরতে সাহায্য করবে।

### Start Command Failed

Render-এ Docker Environment নির্বাচন করেছেন কি না দেখুন। Dockerfile Path `./Dockerfile` রাখুন।

### Wrong Root Directory

Repository-র root-এ `package.json` এবং `Dockerfile` থাকলে Root Directory ফাঁকা রাখুন। Subfolder হলে সেই subfolder দিন।

### QR Code আসছে না

- Render Logs খুলুন
- `WhatsApp client configured` বা `Starting WhatsApp client` log আছে কি না দেখুন
- Container build সফল হয়েছে কি না দেখুন
- Render Logs-এ QR ASCII ঠিকভাবে দেখা না গেলে full screen, monospace font ব্যবহার করুন
- QR কোথাও পাবলিকভাবে শেয়ার করবেন না

### QR Scan-এর পর Authentication Failed

Session corrupt হতে পারে। Render-এ disk ব্যবহার করলে session folder সরানো/নতুন করা ছাড়া সহজ সমাধান নেই। Disk না থাকলে redeploy করে নতুন QR নিন।

### Chromium / Puppeteer Error

Dockerfile ব্যবহার করুন। Node Native Web Service-এ Chromium library missing হতে পারে। Dockerfile-এর system packages সঠিক আছে কি না দেখুন।

### Health Check Failed

- `/health` endpoint আছে কি না দেখুন
- Render Health Check Path `/health` দিন
- Container `PORT` environment variable ব্যবহার করছে কি না দেখুন
- Logs-এ HTTP server listen error আছে কি না দেখুন

### Bot Online কিন্তু Command কাজ করছে না

- `PREFIX` ঠিক আছে কি না দেখুন
- `BOT_MODE=private` হলে user authorized কি না দেখুন
- `OWNER_NUMBER` সঠিক international format-এ আছে কি না দেখুন

### Group Admin Permission Error

Bot-কে group admin করুন। WhatsApp metadata থেকে admin status যাচাই করা হয়; শুধু message text দেখে admin ধরা হয় না।

### Render Free Spin Down

Free instance spin down হলে session ও in-memory rate limiter হারাতে পারে। Bot unpaused হলে আবার reconnect/QR প্রয়োজন হতে পারে। Persistent Disk ও paid instance option Render-এর বর্তমান Plan অনুযায়ী যাচাই করুন।
