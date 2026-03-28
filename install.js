#!/usr/bin/env node
/**
 * claude-statusline installer
 * Installs the custom status line into Claude Code globally.
 * To undo: node uninstall.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
const SETTINGS_BACKUP = path.join(CLAUDE_DIR, 'settings.json.claude-statusline-backup');
const SCRIPT_DEST = path.join(CLAUDE_DIR, 'statusline.sh');
const SCRIPT_SRC = path.join(__dirname, '.claude', 'statusline.sh');
const COMMANDS_DIR = path.join(CLAUDE_DIR, 'commands');
const LIMITE_SRC = path.join(__dirname, '.claude', 'commands', 'limite.md');
const LIMITE_DEST = path.join(COMMANDS_DIR, 'limite.md');

// ─── Ensure ~/.claude exists ─────────────────────────────────────────────────
if (!fs.existsSync(CLAUDE_DIR)) {
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
}

// ─── Check if already installed ──────────────────────────────────────────────
if (fs.existsSync(SETTINGS_BACKUP)) {
  console.log('⚠️   claude-statusline is already installed.');
  console.log('    Run  node uninstall.js  to remove it before reinstalling.');
  process.exit(1);
}

// ─── Copy scripts ─────────────────────────────────────────────────────────────
fs.copyFileSync(SCRIPT_SRC, SCRIPT_DEST);
fs.chmodSync(SCRIPT_DEST, 0o755);
console.log(`✔  Script installed at: ${SCRIPT_DEST}`);

// ─── Copy /limite command ────────────────────────────────────────────────────
if (fs.existsSync(LIMITE_SRC)) {
  if (!fs.existsSync(COMMANDS_DIR)) {
    fs.mkdirSync(COMMANDS_DIR, { recursive: true });
  }
  fs.copyFileSync(LIMITE_SRC, LIMITE_DEST);
  console.log(`✔  Command /limite installed at: ${LIMITE_DEST}`);
}


// ─── Read existing settings.json (or start empty) ────────────────────────────
let settings = {};
if (fs.existsSync(SETTINGS_FILE)) {
  fs.copyFileSync(SETTINGS_FILE, SETTINGS_BACKUP);
  console.log(`✔  Backup created: ${SETTINGS_BACKUP}`);
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    console.error('❌  Existing settings.json is invalid (malformed JSON).');
    process.exit(1);
  }
} else {
  console.log('ℹ️   No settings.json found — a new one will be created.');
}

// ─── Inject statusLine ───────────────────────────────────────────────────────
settings.statusLine = {
  type: 'command',
  command: `bash ${SCRIPT_DEST}`
};

fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
console.log(`✔  statusLine added to: ${SETTINGS_FILE}`);

console.log('\n✅  Installation complete!');
console.log('   → Open any project in Claude Code and the status line will appear.');
console.log('   → To uninstall: node uninstall.js');
