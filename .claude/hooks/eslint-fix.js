#!/usr/bin/env node
// PostToolUse hook: auto-fixes ESLint errors after Edit/Write on JS files.
// Receives tool input as JSON via stdin. Skips vendor/ and node_modules/.
'use strict';

const chunks = [];
process.stdin.on('data', chunk => chunks.push(chunk));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    const file = data.tool_input?.file_path || '';

    const isJs = /\.m?js$/.test(file);
    const isVendored = /[/\\](vendor|node_modules)[/\\]/.test(file);
    if (!isJs || isVendored) return;

    const { spawnSync } = require('child_process');
    // Use the locally installed eslint binary
    spawnSync(
      'node_modules/.bin/eslint',
      ['--fix', file],
      { stdio: 'pipe' }
    );
  } catch (_) {
    // Never block Claude on hook errors — silently continue
  }
});
