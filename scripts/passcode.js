#!/usr/bin/env node
// Set the passcode hash in .env. Generates SESSION_SECRET if missing.
// Usage:  node scripts/passcode.js "your passcode"

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const passcode = process.argv[2];
if (!passcode) {
  console.error('Usage: node scripts/passcode.js "your passcode"');
  process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env');
const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split('\n') : [];
const env = new Map();
for (const line of lines) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) env.set(m[1], m[2]);
}

const hash = bcrypt.hashSync(passcode, 10);
env.set('PASSCODE_HASH', hash);
if (!env.get('SESSION_SECRET') || env.get('SESSION_SECRET') === 'change-me-to-a-long-random-string') {
  env.set('SESSION_SECRET', crypto.randomBytes(32).toString('base64url'));
}
if (!env.get('PORT')) env.set('PORT', '3000');

const out = [...env.entries()].map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
fs.writeFileSync(envPath, out, { mode: 0o600 });

console.log(`Wrote ${envPath}`);
console.log(`PASSCODE_HASH set. SESSION_SECRET ${env.get('SESSION_SECRET').slice(0, 8)}…`);
console.log('Restart the server to pick up changes.');
