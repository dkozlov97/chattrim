# ChatTrim

![ChatTrim hero](docs/assets/chattrim-hero.png)

[![Validate](https://github.com/dkozlov97/chattrim/actions/workflows/validate.yml/badge.svg)](https://github.com/dkozlov97/chattrim/actions/workflows/validate.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-10a37f.svg?labelColor=111315)](LICENSE)
[![Release](https://img.shields.io/github/v/release/dkozlov97/chattrim?label=release&color=10a37f&labelColor=111315)](https://github.com/dkozlov97/chattrim/releases)

ChatTrim is a small Chrome extension that prunes older turns from long ChatGPT chats so the latest context stays easier to scan.

It is intentionally narrow in scope: one content script, no backend, no account, no analytics, and no extra UI outside the chat itself.

## Why This Exists

Long ChatGPT threads can slowly turn into a wall of interface. ChatTrim is a pragmatic attempt to reduce that pressure by keeping the newest part of the conversation front and center while older turns stop weighing on the live page.

## Best For

- People who keep the same ChatGPT thread open for hours or days
- Prompt-heavy workflows where the newest context matters more than the full visible history
- Users who want a local-only helper they can load unpacked and inspect themselves

![ChatTrim preview](docs/assets/chattrim-preview.png)

## Key Benefits

- `Aggressive` mode prunes older conversation turns from the live DOM instead of only hiding them
- The latest `10` turns stay visible by default, so recent context is easier to read and scroll
- A compact in-chat control lets you switch modes without a popup or separate settings page
- `Safe` mode gives you a quick fallback if ChatGPT behaves oddly after a UI change
- Everything stays local to the page, with no remote calls and no data collection

## Modes

### Aggressive

Aggressive mode is the default. ChatTrim keeps the newest turns live in the page and prunes older ones from the active DOM. This is the mode aimed at long-chat relief.

### Safe

Safe mode leaves the chat untouched. It is the low-risk fallback when you want the full page exactly as ChatGPT rendered it.

### Restore Full Chat

`Restore full chat` switches ChatTrim to `Safe` mode and reloads the page, letting ChatGPT rebuild the whole thread normally.

## Install

### Load unpacked from source

1. Clone this repository or download the project as a ZIP and extract it.
2. Open `chrome://extensions`.
3. Turn on `Developer mode`.
4. Click `Load unpacked`.
5. Select this project folder.

### Install from a GitHub release

1. Download the latest release from the [Releases page](https://github.com/dkozlov97/chattrim/releases).
2. Extract the downloaded `chattrim-v<version>.zip` archive.
3. Open `chrome://extensions`.
4. Turn on `Developer mode`.
5. Click `Load unpacked`.
6. Select the extracted folder.

## How It Works

- ChatTrim runs as a content script on `chatgpt.com` and `chat.openai.com`
- It watches the active chat area, not the whole browser session
- In `Aggressive` mode it prunes older turn nodes and keeps only the latest window visible
- In `Safe` mode it stays out of the way and leaves the chat intact
- The compact in-chat control appears when it is useful, instead of living in a permanent toolbar or popup

## Privacy

- No analytics
- No external API calls
- No account access
- No background service worker
- Local storage is used only for mode and debug preferences

## Limitations

- ChatGPT is a fast-moving React app, so DOM selectors may need updates if the site markup changes
- Aggressive mode intentionally removes nodes from a page ChatTrim does not own, so occasional UI regressions are possible after upstream ChatGPT changes
- This extension is designed to reduce long-thread UI pressure, not to promise a fixed CPU or memory number on every machine
- The visible window size is currently fixed in [content.js](content.js) as `VISIBLE_COUNT = 10`

## Troubleshooting

- If the extension appears to do nothing, reload the ChatGPT tab after loading or reloading the extension
- If the control does not appear, open a longer chat and scroll near the latest visible turns
- If ChatGPT starts acting strangely in `Aggressive` mode, switch to `Safe` mode or use `Restore full chat`
- If a new ChatGPT UI rollout breaks selectors, ChatTrim may need a small update

## Debug Mode

Enable the built-in profiler from the ChatGPT tab console:

```js
localStorage.CHATTRIM_DEBUG = "1";
localStorage.CHATTRIM_DEBUG_CONSOLE = "1";
location.reload();
```

With debug mode enabled, ChatTrim shows a small metrics panel and periodically logs `[ChatTrim][debug:*]` snapshots to the console. The panel reports the current mode, observer target, relevant mutation batches, prune passes, live turn count, pruned turn count, long tasks, heap size, and DOM size.

Turn it off with:

```js
delete localStorage.CHATTRIM_DEBUG;
delete localStorage.CHATTRIM_DEBUG_CONSOLE;
location.reload();
```

## Development

```bash
python3 scripts/generate_assets.py
bash scripts/build-release.sh
```

The release script creates `dist/chattrim-v<version>.zip` with only the files needed to load the extension.

## Chrome Web Store Prep

Store-ready listing copy lives in [docs/chrome-web-store.md](docs/chrome-web-store.md).

## Disclaimer

ChatTrim is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by OpenAI.
