<img src="assets/logo-badge.svg" width="72" alt="SelectAsk logo" />

# SelectAsk

**Select text anywhere. Tap `Ctrl`. Ask AI about it — without losing your focus.**

You're reading an AI answer, an article, or code, and one word / line / paragraph needs explaining. Instead of opening a new chat and losing your thread, just select it and tap `Ctrl`: a small glass popup appears right where you are, you ask, you get a short streamed answer, you press `Esc`, and you're back to work.

- 🖱️ **Select text, then tap `Ctrl`** (on its own) → popup opens with the selection as context
- ⌨️ Also available: hold `Ctrl` while selecting (enable in Settings), or press **`Ctrl/Cmd+Shift+Space`**
- 💬 Answers are short and summarized by default; ask follow-ups in the same popup — markdown and code blocks included
- 🔑 **Bring your own API key** — Anthropic (Claude), OpenAI, Google (Gemini), or any OpenAI-compatible endpoint (Ollama, Groq, OpenRouter, LM Studio…)
- 🔒 Keys are stored **only on your device**, requests go **directly to your provider**. No server, no telemetry.
- 🖥️ macOS, Windows, Linux · open source (MIT)

**Website:** https://moustafatech.github.io/selectask · **Download:** [latest release](https://github.com/MoustafaTech/selectask/releases/latest)

## Install

Grab the installer for your OS from the [latest release](https://github.com/MoustafaTech/selectask/releases/latest):

| OS | File |
|---|---|
| macOS (Apple Silicon / Intel) | `SelectAsk-x.y.z-mac-arm64.dmg` / `SelectAsk-x.y.z-mac-x64.dmg` |
| Windows | `SelectAsk-x.y.z-win-x64.exe` |
| Linux | `SelectAsk-x.y.z-linux-x86_64.AppImage` / `.deb` |

Then open the tray icon → **Settings…** → pick your provider, paste your API key, set a model. Done.

### First-run notes

- **macOS**: the app is unsigned, so on first open right-click the app → **Open**. It will also ask for **Accessibility** access (System Settings → Privacy & Security → Accessibility) — this is what lets it see the `Ctrl`+select gesture and copy your selection. Relaunch after granting.
- **Windows**: SmartScreen may warn because the binary is unsigned — choose *More info → Run anyway*.
- **Linux**: the `Ctrl`+select gesture works out of the box on X11. Reading selections uses `xclip`/`xdotool` (X11) or `wl-paste` (Wayland) if available: `sudo apt install xclip xdotool wl-clipboard`.

## How it works

1. A tiny global listener watches for a clean `Ctrl` tap — no other key or mouse press during the hold (`uiohook-napi`).
2. On trigger, your selection is captured (via the primary selection on Linux, or a simulated copy elsewhere — your clipboard is restored right after).
3. A frameless always-on-top popup opens next to your cursor with the selection as context.
4. Your question + selection go **straight from your machine to your AI provider**, streamed back into the popup.

## Providers

| Provider | Example models |
|---|---|
| Anthropic | `claude-sonnet-5`, `claude-haiku-4-5-20251001` |
| OpenAI | `gpt-5.2`, `gpt-5-mini` |
| Google | `gemini-2.5-flash`, `gemini-2.5-pro` |
| OpenAI-compatible | Ollama (`http://localhost:11434/v1`), Groq, OpenRouter, LM Studio, vLLM… |

## Build from source

```bash
git clone https://github.com/MoustafaTech/selectask.git
cd selectask
npm install
npm start          # run in dev
npm run dist       # build installers for your current OS into release/
```

Config lives in the standard per-user app-data dir (`~/Library/Application Support/SelectAsk` on macOS, `%APPDATA%/SelectAsk` on Windows, `~/.config/SelectAsk` on Linux).

## Privacy

- Your API keys never leave your device (saved in a local config file, `0600`).
- The only network calls are the ones you trigger, directly to the provider you configured.
- Clipboard is used momentarily to capture the selection and is restored immediately.

## License

[MIT](LICENSE)
