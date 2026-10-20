'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const ignoredDirectories = new Set([
  'node_modules',
  '.git',
  '.cache',
  'data',
  '.wwebjs_auth',
  '.wwebjs_cache'
]);

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }

      files.push(...walk(path.join(directory, entry.name)));
      continue;
    }

    if (entry.isFile()) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
}

let failed = false;
const javascriptFiles = walk(rootDir)
  .filter((file) => file.endsWith('.js'))
  .sort();

for (const file of javascriptFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], {
      stdio: 'inherit'
    });
  } catch (error) {
    failed = true;
    console.error(`Syntax check failed: ${file}`);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`Syntax check passed for ${javascriptFiles.length} file(s).`);
}
