<p align="center"><img src="assets/logo-badge.svg" width="80" alt="Rex logo" /></p>
<h1 align="center">Rex 🦖</h1>
<p align="center"><b>The quick answer, without losing your thread.</b></p>

<p align="center"><img src="assets/demo.gif" width="760" alt="Deep in a long AI chat, a code line gets selected and Rex explains it in place" /></p>

You're deep in a long AI chat, a dense article, or someone else's code — and one line stops you. A snippet you don't recognize, a term, an error. Opening another chat means losing your place, re-explaining context, and twenty minutes of drift for a ten-second question.

**Rex is the ten-second path**: select the thing, tap `Ctrl`, ask. A small popup answers right where you are — short and to the point — and your main chat, your article, your flow stay exactly where you left them. It's especially good at quick snippets: highlight one line of code out of a wall of output and ask *"what does this do?"* without pasting anything anywhere.

Open source, your own API key, straight to your provider. No server, no account, no telemetry — just a dinosaur that fetches answers.

## Install

**[⬇ Download the latest release](https://github.com/MoustafaTech/rex/releases/latest)**, then follow your OS:

<details>
<summary><b>🍎 macOS</b></summary>

1. Download `Rex-…-mac-arm64.dmg` (Apple Silicon) or `Rex-…-mac-x64.dmg` (Intel) and drag **Rex** to Applications.
2. First open: **right-click the app → Open → Open** (it's unsigned, a double-click gets blocked).
3. Grant **Accessibility** when asked (System Settings → Privacy & Security → Accessibility → enable Rex), then quit and reopen — this lets Rex hear the `Ctrl` tap and read your selection.
4. Rex appears in the **menu bar** (no Dock icon).
</details>

<details>
<summary><b>🪟 Windows</b></summary>

1. Download and run `Rex-…-win-x64.exe`.
2. SmartScreen will warn (unsigned) — click **More info → Run anyway**.
3. Rex appears in the **system tray**, near the clock.
</details>

<details>
<summary><b>🐧 Linux</b></summary>

```bash
# AppImage (any distro)
chmod +x Rex-…-linux-x86_64.AppImage && ./Rex-…-linux-x86_64.AppImage
# or Debian/Ubuntu
sudo dpkg -i Rex-…-linux-amd64.deb && rex
```

For the smoothest capture: `sudo apt install xclip xdotool` (X11) or `sudo apt install wl-clipboard` (Wayland). Rex appears in the **system tray**.
</details>

### Add your API key

Tray/menu-bar icon → **Settings** → pick a provider, paste a key, set a model:

| Provider | Example models | Base URL |
|---|---|---|
| Anthropic | `claude-sonnet-5`, `claude-haiku-4-5-20251001` | — |
| OpenAI | `gpt-5.2`, `gpt-5-mini` | — |
| Google | `gemini-2.5-flash`, `gemini-2.5-pro` | — |
| OpenAI-compatible | Ollama `llama3.3`, Groq, OpenRouter, LM Studio… | e.g. `http://localhost:11434/v1` |

Base URL is only for the OpenAI-compatible option. A mistyped model shows the provider's error right in the popup — fix it in Settings and re-ask.

## Use

1. **Select text** anywhere → **tap `Ctrl`** on its own (`Ctrl+C`, `Ctrl+click`… never trigger it).
2. **Ask.** Answers stream in short and summarized; follow up in the same chat.
3. **Change or add context without retapping**: while Rex is open, just select different text — the pending context updates live. Tap `Ctrl` to pin it and stack another selection into the same conversation.
4. `Esc` or ✕ closes (it never closes on its own). Drag any edge to resize.

**Extras**: light/dark theme follows your system (or pick in Settings — light is the dino's day run ☀️, dark is the night run 🌙) · the dino sprints while answers stream · `Space` makes him jump · your high score persists.

## Run from source

```bash
git clone https://github.com/MoustafaTech/rex.git
cd rex && npm install && npm start        # Node 20+, nothing else to install
```

- **macOS**: grant Accessibility to the launching app on first run, then restart it.
- **Linux**: install the clipboard helpers listed above.
- Debug logs: `REX_DEBUG=1 npm start` · Build installers: `npm run dist`

## How it works

1. A global listener (`uiohook-napi`) watches for a clean `Ctrl` tap — any other key or mouse activity during the hold cancels it.
2. Your selection is captured via the primary selection on Linux, or a momentary simulated copy elsewhere (your clipboard is restored immediately).
3. A frameless, resizable, always-on-top popup opens at your cursor and stays until you close it.
4. Questions + selections go **directly from your machine to your provider**, streamed back into the popup.

Config lives in your OS's app-data dir (`~/Library/Application Support/Rex`, `%APPDATA%/Rex`, or `~/.config/Rex`); upgrades from the app's earlier names migrate automatically. The dino is original pixel art — a homage to everyone's favorite offline companion, not a copy.

## Privacy

- API keys live only on your device (config file, `0600`).
- The only network calls are the ones you trigger, straight to your configured provider.
- No analytics, no telemetry, no accounts.

## License

[MIT](LICENSE)
