#!/usr/bin/env node
/**
 * claude-statusline uninstaller
 * Removes the status line and restores the original settings.json.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
const SETTINGS_BACKUP = path.join(CLAUDE_DIR, 'settings.json.claude-statusline-backup');
const SCRIPT_DEST = path.join(CLAUDE_DIR, 'statusline.sh');

// ─── Check if installed ───────────────────────────────────────────────────────
if (!fs.existsSync(SETTINGS_BACKUP) && !fs.existsSync(SETTINGS_FILE)) {
  console.log('ℹ️   claude-statusline is not installed (no backup found).');
  process.exit(0);
}

// ─── Remove statusLine key from current settings (preserves other changes) ───
if (fs.existsSync(SETTINGS_FILE)) {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    delete settings.statusLine;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    console.log('✔  statusLine removed from settings.json (other settings preserved).');
  } catch {
    console.error('❌  Could not parse settings.json — restoring backup.');
    if (fs.existsSync(SETTINGS_BACKUP)) {
      fs.copyFileSync(SETTINGS_BACKUP, SETTINGS_FILE);
      console.log('✔  settings.json restored from backup.');
    }
  }
}

// ─── Clean up backup ─────────────────────────────────────────────────────────
if (fs.existsSync(SETTINGS_BACKUP)) {
  fs.unlinkSync(SETTINGS_BACKUP);
  console.log('✔  Backup removed.');
}

// ─── Remove scripts ───────────────────────────────────────────────────────────
if (fs.existsSync(SCRIPT_DEST)) {
  fs.unlinkSync(SCRIPT_DEST);
  console.log('✔  statusline.sh removed.');
}

console.log('\n✅  Uninstalled. Claude Code restored to default.');
