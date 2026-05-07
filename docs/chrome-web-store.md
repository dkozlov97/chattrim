# Chrome Web Store Listing Draft

## Product name

ChatTrim

## Category

Productivity

## Language

English

## Short description

Prune older turns from long ChatGPT chats so the latest context stays easier to scan.

## Detailed description

ChatTrim is a lightweight Chrome extension for people who spend a long time inside the same ChatGPT thread.

Instead of leaving the entire conversation mounted in the live page, ChatTrim can prune older turns in `Aggressive` mode and keep the newest part of the chat front and center. If you want the untouched page back, switch to `Safe` mode or use `Restore full chat`.

Why people use it:

- Cleaner view in long conversations
- Less UI noise around the newest prompts and replies
- Local-only behavior with no analytics or remote calls
- Small codebase with a single job

What it does not do:

- It does not collect chat data
- It does not send chat content to any server
- It does not modify your ChatGPT account
- It does not promise a fixed CPU or memory improvement on every device
- It does store local mode and debug preferences in browser storage

ChatTrim runs only on `chatgpt.com` and `chat.openai.com`.

## Single purpose description

ChatTrim keeps long ChatGPT chats easier to scan by pruning older turns from the live page and keeping the newest turns in focus.

## Privacy disclosure

- Data collection: none
- Remote code: none
- Authentication: none
- Local storage: mode and debug preferences only
- Background network requests: none

## Permissions justification

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

These matches are required so the content script can detect supported ChatGPT chat pages and manage older conversation turns locally in the page.

## Suggested screenshots

- Hero graphic from `docs/assets/chattrim-hero.png`
- Product preview from `docs/assets/chattrim-preview.png`

## Store submission notes

- Position it as long-chat UI relief, not as a benchmarked performance claim
- Keep the “unofficial / not affiliated with OpenAI” disclaimer in the listing
- If the visible-turn count becomes configurable later, update the listing copy to match
