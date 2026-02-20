#!/usr/bin/env node
// PreToolUse hook: blocks edits to firebase-config.js (contains production credentials).
// Exit code 2 tells Claude Code to block the tool call and show the reason.
'use strict';

const chunks = [];
process.stdin.on('data', chunk => chunks.push(chunk));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    const file = data.tool_input?.file_path || '';

    // Block edits to firebase-config.js but allow firebase-config.example.js
    if (/firebase-config\.js$/.test(file) && !/firebase-config\.example\.js$/.test(file)) {
      process.stdout.write(
        'BLOCKED: firebase-config.js contains production credentials and must not be edited directly.\n' +
        'Edit firebase-config.example.js to update the template instead.\n'
      );
      process.exit(2);
    }
  } catch (_) {
    // Never block Claude on hook errors — silently continue
  }
});
