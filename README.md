<img src="assets/logo-badge.svg" width="72" alt="Rexplain logo — a pixel T-Rex" />

# Rexplain 🦖

**Select text anywhere. Tap `Ctrl`. A little dino fetches you the answer.**

You're reading an article, an AI answer, code, or a scary error message, and one word / line / paragraph needs explaining. Instead of opening a new chat and losing your thread: select it and tap `Ctrl` — a small glass popup opens right where you are, a pixel dino jogs across the panel while your model thinks, and a short answer streams in. `Esc`, and you're back to work.

- 🖱️ **Select text, then tap `Ctrl`** (on its own) → a minimal popup opens with your selection as context
- 🦖 While the answer generates, the resident T-Rex runs and hops cacti in the panel — the wait is the fun part
- 💬 Answers are short and summarized by default; ask follow-ups in the same popup — markdown and code blocks included
- ⌨️ Also available: hold `Ctrl` while selecting (enable in Settings), or press `Ctrl/Cmd+Shift+Space`
- 🔑 **Bring your own API key** — Anthropic (Claude), OpenAI, Google (Gemini), or any OpenAI-compatible endpoint (Ollama, Groq, OpenRouter, LM Studio…)
- 🔒 Keys are stored **only on your device**; requests go **directly to your provider**. No server, no account, no telemetry.
- 🖥️ macOS, Windows, Linux · MIT licensed

---

## Install (prebuilt)

Download from the **[latest release](https://github.com/MoustafaTech/rexplain/releases/latest)**.

### macOS

1. Download `Rexplain-x.y.z-mac-arm64.dmg` (Apple Silicon) or `Rexplain-x.y.z-mac-x64.dmg` (Intel).
2. Open the dmg and drag **Rexplain** into **Applications**.
3. First launch: the app is unsigned, so **right-click the app → Open → Open** (a plain double-click gets blocked by Gatekeeper).
4. Grant **Accessibility** access when asked (System Settings → Privacy & Security → Accessibility → enable Rexplain), then quit and reopen. This is what lets the dino hear your `Ctrl` tap and copy your selection.
5. Find the dino in the **menu bar** (there is no Dock icon) → **Settings…** → pick a provider, paste your API key, set a model. Done.

### Windows

1. Download `Rexplain-x.y.z-win-x64.exe`.
2. Run it. SmartScreen will warn because the binary is unsigned — click **More info → Run anyway**.
3. The installer launches Rexplain automatically; the dino lives in the **system tray** (bottom-right, near the clock).
4. Tray icon → **Settings…** → provider, API key, model. Done.

### Linux

**AppImage (any distro):**

```bash
chmod +x Rexplain-x.y.z-linux-x86_64.AppImage
./Rexplain-x.y.z-linux-x86_64.AppImage
```

**Debian / Ubuntu (.deb):**

```bash
sudo dpkg -i Rexplain-x.y.z-linux-amd64.deb
rexplain
```

For the smoothest selection capture install the clipboard helpers:

```bash
# X11
sudo apt install xclip xdotool
# Wayland
sudo apt install wl-clipboard
```

The dino sits in your **system tray**. Tray icon → **Settings…** → provider, API key, model. Done.

---

## Run from source

Requirements: [Node.js](https://nodejs.org) 20+ and git — that's it on every OS (native input hooks ship as prebuilt binaries, no compiler needed).

```bash
git clone https://github.com/MoustafaTech/rexplain.git
cd rexplain
npm install
npm start
```

Per-OS notes:

- **macOS**: on first `npm start`, grant Accessibility access to the app that launched it (System Settings → Privacy & Security → Accessibility), then restart it. Without this the `Ctrl` gestures can't be detected.
- **Windows**: no extra steps. If the popup doesn't appear, check the tray for the dino.
- **Linux**: install `xclip` + `xdotool` (X11) or `wl-clipboard` (Wayland) as above. On Wayland, selection capture uses the primary selection.

Debug mode (prints every trigger and capture to the terminal):

```bash
REXPLAIN_DEBUG=1 npm start
```

Build installers for your current OS into `release/`:

```bash
npm run dist
```

---

## Usage

1. **Select** any text in any app — browser, editor, PDF, terminal.
2. **Tap `Ctrl`** once, on its own. (A tap "spoils" if you press any other key or use the mouse while `Ctrl` is down, so `Ctrl+C` / `Ctrl+click` never open the popup.)
3. The popup opens at your cursor. **Type your question**, press `Enter`, and watch the dino run while the answer streams in.
4. Press **`Esc`** (or click elsewhere) to dismiss and get back to what you were doing.

Other triggers: `Ctrl/Cmd+Shift+Space` grabs the current selection from anywhere; hold-`Ctrl`-while-selecting can be enabled in Settings.

## Configuration

Open **Settings** from the popup's gear icon or the tray menu.

| Provider | Example models | Base URL |
|---|---|---|
| Anthropic | `claude-sonnet-5`, `claude-haiku-4-5-20251001` | — |
| OpenAI | `gpt-5.2`, `gpt-5-mini` | — |
| Google | `gemini-2.5-flash`, `gemini-2.5-pro` | — |
| OpenAI-compatible | Ollama `llama3.3`, Groq, OpenRouter, LM Studio, vLLM… | e.g. `http://localhost:11434/v1` |

**Base URL** is only needed for the OpenAI-compatible option — leave it empty otherwise. If you mistype a model name the popup shows the provider's error inline; fix it in Settings and re-ask.

Config lives in the standard per-user app-data dir (`~/Library/Application Support/Rexplain` on macOS, `%APPDATA%/Rexplain` on Windows, `~/.config/Rexplain` on Linux), permissions `0600`. Upgrading from the app's earlier life as *SelectAsk*? Your config is migrated automatically on first launch.

## How it works

1. A global input listener (`uiohook-napi`) watches for a clean `Ctrl` tap — no other key or mouse activity during the hold.
2. Your selection is captured via the primary selection on Linux, or a simulated copy elsewhere (your clipboard is restored immediately after).
3. A frameless always-on-top popup opens next to your cursor; on macOS it uses native vibrancy for real glass.
4. Your question + selection go **straight from your machine to your AI provider**, streamed back into the popup. There is no middleman server.

The runner dino is original pixel art drawn for this project — a homage to everyone's favorite offline companion, not a copy of it.

## Privacy

- API keys never leave your device (local config file, `0600`).
- The only network calls are the ones you trigger, directly to the provider you configured.
- The clipboard is used momentarily during capture and restored right away.
- No analytics, no telemetry, no accounts.

## License

[MIT](LICENSE)
