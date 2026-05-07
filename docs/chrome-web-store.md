# Chrome Web Store Listing Draft

## Product name

ChatTrim

## Category

Productivity

## Language

English

## Short description

Keep long ChatGPT chats lighter by hiding older messages and keeping the latest turns easy to scan.

## Detailed description

ChatTrim is a lightweight Chrome extension for people who live in long ChatGPT threads.

Instead of making you scroll through a wall of older messages every time, ChatTrim keeps the latest conversation turns visible and hides older ones until you need them. When you want the full thread, click `Show hidden messages`.

Why users like it:

- Cleaner view in long conversations
- Faster scanning of the most recent context
- Local-only behavior with no analytics or remote calls
- Tiny codebase with a single purpose

What it does not do:

- It does not collect chat data
- It does not send chat content to any server
- It does not modify your ChatGPT account
- It does not remove old messages from the DOM

ChatTrim runs only on `chatgpt.com` and `chat.openai.com`.

## Single purpose description

ChatTrim improves readability in long ChatGPT conversations by hiding older message turns and keeping the latest turns visible.

## Privacy disclosure

- Data collection: none
- Remote code: none
- Authentication: none
- Local storage: none
- Background network requests: none

## Permissions justification

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

These matches are required so the content script can read the current chat page structure and hide older conversation turns on supported ChatGPT pages.

## Suggested screenshots

- Hero graphic from `docs/assets/chattrim-hero.png`
- Product preview from `docs/assets/chattrim-preview.png`

## Store submission notes

- Position as a focused utility, not a performance benchmark claim.
- Keep the “unofficial / not affiliated with OpenAI” disclaimer in the listing.
- If the visible-turn count becomes configurable later, update the listing copy to reflect that.
