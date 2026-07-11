'use strict';

// Capture the text currently selected in whatever app the user is using.
// Strategy: on Linux, read the primary selection directly (no clipboard touch).
// Elsewhere, snapshot the clipboard, simulate the OS copy keystroke, read the
// clipboard, then restore what was there before. If the clipboard holds
// something we cannot round-trip (copied files, app-specific formats), the
// capture is skipped rather than destroy it.

const { clipboard } = require('electron');
const { execFile } = require('child_process');

const COPY_SETTLE_MS = 160;

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 3000 }, (err, stdout) => {
      resolve(err ? null : stdout);
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// On Windows the simulated ^c goes to the foreground window; if that is a
// console, it sends SIGINT and can kill whatever is running. Same story for
// xdotool's ctrl+c on X11 (where terminals never copy on Ctrl+C anyway).
// macOS is safe: copy is Cmd+C, which terminals treat as plain copy.
const WIN_TERMINALS = /^(windowsterminal|cmd|powershell|pwsh|conhost|openconsole|alacritty|wezterm(-gui)?|mintty|hyper|tabby|terminus)$/i;
const X11_TERMINALS = /(terminal|konsole|xterm|urxvt|rxvt|alacritty|kitty|wezterm|tilix|terminator|st-256color|foot)/i;

async function foregroundIsTerminal() {
  if (process.platform === 'win32') {
    const out = await run('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      'Add-Type \'using System;using System.Runtime.InteropServices;public class FG{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);}\';' +
      '$p=0;[void][FG]::GetWindowThreadProcessId([FG]::GetForegroundWindow(),[ref]$p);(Get-Process -Id $p).ProcessName'
    ]);
    return !!(out && WIN_TERMINALS.test(out.trim()));
  }
  if (process.platform === 'linux') {
    const out = await run('sh', ['-c', 'xdotool getactivewindow getwindowclassname 2>/dev/null']);
    return !!(out && X11_TERMINALS.test(out.trim()));
  }
  return false;
}

async function simulateCopy() {
  if (process.platform === 'darwin') {
    await run('osascript', ['-e', 'tell application "System Events" to keystroke "c" using {command down}']);
  } else if (process.platform === 'win32') {
    await run('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      "$w = New-Object -ComObject wscript.shell; $w.SendKeys('^c')"
    ]);
  } else {
    // X11; on Wayland we rely on the primary-selection path instead.
    await run('xdotool', ['key', '--clearmodifiers', 'ctrl+c']);
  }
}

async function linuxPrimarySelection() {
  if (process.env.WAYLAND_DISPLAY) {
    const out = await run('wl-paste', ['--primary', '--no-newline']);
    if (out) return out;
  }
  const out = await run('xclip', ['-o', '-selection', 'primary'])
    || await run('xsel', ['-o', '--primary']);
  return out;
}

// Everything Electron's clipboard API can read AND write back. Anything else
// on the clipboard (copied files show as text/uri-list, app-private types)
// would be lost.
const RESTORABLE = /^(text\/(plain|html|rtf)|image\/)/;

function snapshotClipboard() {
  const formats = clipboard.availableFormats();
  if (formats.some(f => !RESTORABLE.test(f))) return null; // can't round-trip
  const image = clipboard.readImage();
  return {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    rtf: clipboard.readRTF(),
    image: image.isEmpty() ? null : image
  };
}

function restoreClipboard(snap) {
  const data = {};
  if (snap.text) data.text = snap.text;
  if (snap.html) data.html = snap.html;
  if (snap.rtf) data.rtf = snap.rtf;
  if (snap.image) data.image = snap.image;
  if (Object.keys(data).length) clipboard.write(data);
  else clipboard.clear();
}

async function captureSelection() {
  if (process.platform === 'linux') {
    const primary = await linuxPrimarySelection();
    if (primary && primary.trim()) return primary;
  }

  if (await foregroundIsTerminal()) return '';

  const before = snapshotClipboard();
  if (!before) return ''; // clipboard content we couldn't put back — leave it alone
  // Clear so we can tell whether the copy actually produced anything.
  clipboard.clear();
  await simulateCopy();
  await sleep(COPY_SETTLE_MS);
  let text = clipboard.readText();
  if (!text) {
    // Some apps are slow to publish the clipboard.
    await sleep(COPY_SETTLE_MS);
    text = clipboard.readText();
  }
  // Put the user's clipboard back.
  restoreClipboard(before);
  return text && text.trim() ? text : '';
}

module.exports = { captureSelection };
