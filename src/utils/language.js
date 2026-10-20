'use strict';

const messages = {
  en: {
    common: {
      none: 'None',
      unknown: 'Unknown',
      enabled: 'enabled',
      disabled: 'disabled'
    },
    errors: {
      groupOnly: '❌ This command can only be used in a group.',
      ownerOnly: '❌ This command is only for the bot owner.',
      adminOnly: '❌ You must be a group admin to use this command.',
      privateOnly: '❌ This bot is in private mode. You are not authorized.',
      rateLimited: '⏳ Too many commands. Please wait {seconds} seconds and try again.',
      unknownCommand: '❓ Unknown command: {command}\nUse {prefix}help to see available commands.',
      commandFailed: '⚠️ Command failed. Please try again later.'
    },
    antiLink: {
      warning: '🔗 Links are not allowed here, {user}. The message was removed.'
    },
    antiSpam: {
      warning: '🚫 Please slow down, {user}. Too many messages in a short time.'
    },
    welcome: {
      default: '👋 Welcome{mention} to *{group}*!\n\nBranding: {branding}'
    },
    goodbye: {
      default: '👋 Goodbye{mention} from *{group}*.'
    },
    permissions: {
      everyone: 'everyone',
      owner: 'owner only',
      admin: 'group admin only',
      group: 'group only',
      privateMode: 'authorized users only in private mode'
    },
    menu: {
      body: `╭━━━〔 {botName} 〕━━━╮
┃ 📋 *Commands* ({count})
┣━━━━━━━━━━━━━━━
{commands}
╰━━━━━━━━━━━━━━━╯

Use: {prefix}help
Powered by {branding}`
    },
    help: {
      body: `📖 *Help*\n\nUse *{prefix}<command>* format.\nExample: *{prefix}menu*\nFor command details: *{prefix}help menu*\n\nCommands available: {count}\nBot mode: {mode}\nBot name: {botName}`,
      command: `📖 *{name}*\n\nDescription: {description}\nUsage: *{usage}*\nAliases: {aliases}\nCategory: {category}\nPermissions: {permissions}`,
      notFound: '❌ Command not found: {command}\nUse {prefix}menu to see available commands.'
    },
    ping: {
      result: '🏓 Pong!\nApproximate latency: *{latency} ms*'
    },
    alive: {
      body: '🤖 *Bot is alive*\nName: *{botName}*\nUptime: *{uptime}*\nMode: *{mode}*\nTimezone: *{timezone}*\nConnection: *{connection}*'
    },
    info: {
      body: 'ℹ️ *Bot Information*\n\nBot: *{botName}*\nOwner: *{ownerName}*\nBranding: *{branding}*\nVersion: *{version}*\nMode: *{mode}*\nLanguage: *{lang}*\nTimezone: *{timezone}*\nPrefix: *{prefix}*\nAI: *{ai}*'
    },
    owner: {
      body: '👑 *Owner*\n\nName: *{name}*\nContact: {contact}\nBranding: *{branding}*',
      hidden: 'hidden by configuration',
      notConfigured: 'not configured'
    },
    time: {
      body: '🕒 Time in {timezone}: *{time}*'
    },
    date: {
      body: '📅 Date in {timezone}: *{date}*'
    },
    groupinfo: {
      body: '👥 *Group Information*\n\nName: *{name}*\nMembers: *{members}*\nAdmins: *{admins}*\nCreated: *{created}*\nDescription: {description}'
    },
    cmd: {
      menu: {
        desc: 'Show all available commands'
      },
      help: {
        desc: 'Show help instructions'
      },
      ping: {
        desc: 'Show approximate response latency'
      },
      alive: {
        desc: 'Show bot status and uptime'
      },
      info: {
        desc: 'Show bot and project information'
      },
      owner: {
        desc: 'Show owner display name and configured contact'
      },
      time: {
        desc: 'Show current time in configured timezone'
      },
      date: {
        desc: 'Show current date in configured timezone'
      },
      groupinfo: {
        desc: 'Show basic group information'
      }
    }
  },
  bn: {
    common: {
      none: 'নেই',
      unknown: 'অজানা',
      enabled: 'চালু',
      disabled: 'বন্ধ'
    },
    errors: {
      groupOnly: '❌ এই কমান্ডটি শুধু গ্রুপে ব্যবহার করা যাবে।',
      ownerOnly: '❌ এই কমান্ডটি শুধু বট Owner ব্যবহার করতে পারবেন।',
      adminOnly: '❌ এই কমান্ডটি ব্যবহার করতে হলে আপনাকে গ্রুপ Admin হতে হবে।',
      privateOnly: '❌ বটটি Private Mode-এ আছে। আপনি অনুমোদিত নন।',
      rateLimited: '⏳ অনেকগুলো কমান্ড পাঠানো হয়েছে। {seconds} সেকেন্ড পর আবার চেষ্টা করুন।',
      unknownCommand: '❓ অজানা কমান্ড: {command}\nসব কমান্ড দেখতে {prefix}help ব্যবহার করুন।',
      commandFailed: '⚠️ কমান্ডটি ব্যর্থ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
    },
    antiLink: {
      warning: '🔗 এখানে লিংক অনুমোদিত নয়, {user}। মেসেজটি সরানো হয়েছে।'
    },
    antiSpam: {
      warning: '🚫 অনুগ্রহ করে ধীরে পাঠান, {user}। খুব বেশি মেসেজ পাঠানো হয়েছে।'
    },
    welcome: {
      default: '👋 স্বাগতম{mention}! *{group}* গ্রুপে আপনাকে স্বাগতম।\n\nব্র্যান্ডিং: {branding}'
    },
    goodbye: {
      default: '👋 বিদায়{mention}! *{group}* থেকে আপনি চলে গেছেন।'
    },
    permissions: {
      everyone: 'সবাই',
      owner: 'শুধু Owner',
      admin: 'শুধু গ্রুপ Admin',
      group: 'শুধু গ্রুপে',
      privateMode: 'Private Mode-এ শুধু অনুমোদিত ব্যবহারকারী'
    },
    menu: {
      body: `╭━━━〔 {botName} 〕━━━╮
┃ 📋 *কমান্ড তালিকা* ({count})
┣━━━━━━━━━━━━━━━
{commands}
╰━━━━━━━━━━━━━━━╯

ব্যবহার: {prefix}help
Powered by {branding}`
    },
    help: {
      body: `📖 *সহায়তা*\n\nব্যবহারের নিয়ম: *{prefix}<command>*\nউদাহরণ: *{prefix}menu*\nকোনো কমান্ডের বিস্তারিত: *{prefix}help menu*\n\nবর্তমান কমান্ড সংখ্যা: {count}\nBot Mode: {mode}\nBot Name: {botName}`,
      command: `📖 *{name}*\n\nবর্ণনা: {description}\nব্যবহার: *{usage}*\nAliases: {aliases}\nCategory: {category}\nPermissions: {permissions}`,
      notFound: '❌ কমান্ডটি 찾া যায়নি: {command}\nসব কমান্ড দেখতে {prefix}menu ব্যবহার করুন।'
    },
    ping: {
      result: '🏓 Pong!\nআনুমানিক latency: *{latency} ms*'
    },
    alive: {
      body: '🤖 *বট সক্রিয় আছে*\nনাম: *{botName}*\nUptime: *{uptime}*\nMode: *{mode}*\nTimezone: *{timezone}*\nConnection: *{connection}*'
    },
    info: {
      body: 'ℹ️ *বট তথ্য*\n\nBot: *{botName}*\nOwner: *{ownerName}*\nBranding: *{branding}*\nVersion: *{version}*\nMode: *{mode}*\nLanguage: *{lang}*\nTimezone: *{timezone}*\nPrefix: *{prefix}*\nAI: *{ai}*'
    },
    owner: {
      body: '👑 *Owner*\n\nনাম: *{name}*\nযোগাযোগ: {contact}\nBranding: *{branding}*',
      hidden: 'কনফিগারেশন অনুযায়ী লুকানো আছে',
      notConfigured: 'কনফিগার করা নেই'
    },
    time: {
      body: '🕒 {timezone} অনুযায়ী সময়: *{time}*'
    },
    date: {
      body: '📅 {timezone} অনুযায়ী তারিখ: *{date}*'
    },
    groupinfo: {
      body: '👥 *গ্রুপ তথ্য*\n\nনাম: *{name}*\nসদস্য: *{members}*\nAdmin: *{admins}*\nতৈরি: *{created}*\nবর্ণনা: {description}'
    },
    cmd: {
      menu: {
        desc: 'সব কমান্ডের তালিকা দেখুন'
      },
      help: {
        desc: 'সহায়তা নির্দেশনা দেখুন'
      },
      ping: {
        desc: 'আনুমানিক response latency দেখুন'
      },
      alive: {
        desc: 'বটের অবস্থা ও uptime দেখুন'
      },
      info: {
        desc: 'বট ও প্রজেক্টের তথ্য দেখুন'
      },
      owner: {
        desc: 'Owner নাম ও কনফিগার করা যোগাযোগ দেখুন'
      },
      time: {
        desc: 'কনফিগার করা Timezone অনুযায়ী সময় দেখুন'
      },
      date: {
        desc: 'কনফিগার করা Timezone অনুযায়ী তারিখ দেখুন'
      },
      groupinfo: {
        desc: 'গ্রুপের মৌলিক তথ্য দেখুন'
      }
    }
  }
};

function getPath(object, key) {
  return String(key)
    .split('.')
    .reduce((current, part) => {
      if (
        current &&
        typeof current === 'object' &&
        Object.prototype.hasOwnProperty.call(current, part)
      ) {
        return current[part];
      }

      return undefined;
    }, object);
}

function t(key, lang = 'en', variables = {}) {
  const selectedLanguage = messages[lang] ? lang : 'en';

  let value = getPath(messages[selectedLanguage], key);

  if (value === undefined && selectedLanguage !== 'en') {
    value = getPath(messages.en, key);
  }

  if (value === undefined) {
    return String(key);
  }

  return String(value).replace(/\{(\w+)\}/g, (match, variableName) => {
    if (
      Object.prototype.hasOwnProperty.call(
        variables,
        variableName
      )
    ) {
      return String(variables[variableName]);
    }

    return match;
  });
}

module.exports = {
  t
};
