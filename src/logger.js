'use strict';

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99
};

const REDACT_KEY_PATTERN =
  /(api[_-]?key|authorization|secret|token|password|session|qr|credential|private[_-]?key)/i;

function sanitizeString(value) {
  const stringValue = String(value);

  if (stringValue.length <= 2000) {
    return stringValue;
  }

  return `${stringValue.slice(0, 2000)}...`;
}

function sanitize(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined
    };
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  if (typeof value !== 'object') {
    return sanitizeString(value);
  }

  if (depth > 4) {
    return '[MaxDepth]';
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .slice(0, 30)
      .map((item) => sanitize(item, depth + 1, seen));
  }

  const output = {};

  for (const [key, item] of Object.entries(value)) {
    if (REDACT_KEY_PATTERN.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = sanitize(item, depth + 1, seen);
    }
  }

  return output;
}

function createLogger(options = {}) {
  const configuredLevel = String(
    options.level || 'info'
  ).toLowerCase();

  const threshold = LEVELS[configuredLevel] || LEVELS.info;

  function write(level, message, meta) {
    if (LEVELS[level] < threshold) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `${timestamp} ${level.toUpperCase()}`;
    let serializedMeta = '';

    if (meta !== undefined) {
      try {
        serializedMeta = ` ${JSON.stringify(sanitize(meta))}`;
      } catch (error) {
        serializedMeta = ' {"meta":"serialization_failed"}';
      }
    }

    const line = `${prefix} ${message}${serializedMeta}`;

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  return {
    debug(message, meta) {
      write('debug', message, meta);
    },
    info(message, meta) {
      write('info', message, meta);
    },
    warn(message, meta) {
      write('warn', message, meta);
    },
    error(message, meta) {
      write('error', message, meta);
    }
  };
}

module.exports = {
  createLogger
};
