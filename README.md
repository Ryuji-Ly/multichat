# Multichat

A personal Chrome extension: one livestream plus its Twitch, YouTube and TikTok chats side by side, in a single tab, using your own logged-in accounts. Nothing is set up on the streamer's side.

Each chat is the platform's own chat page embedded in a frame, so reading, sending, emotes and mod tools all work exactly as on the platform. See [ADR 0001](docs/adr/0001-embed-platform-chats-in-frames.md) for why.

## Use it

```bash
npm install
npm run build
```

1. Open `chrome://extensions`, turn on **Developer mode**, **Load unpacked** → pick the `dist/` folder.
2. Click the extension's toolbar icon. The dashboard opens in a new tab.
3. **New** → name the streamer, fill in the channels they use, pick the main stream.

- **Layout** picks how the chats are arranged: side by side, one big with the others stacked, or all stacked.
- Drag a chat by its header onto another chat to swap them. Drag the bars between panes to resize. Layout and sizes are remembered.
- **Main** switches which platform's stream fills the big area, or none for chats only.
- YouTube accepts an `@handle` (follows whatever the channel is streaming now), a video link, or a video ID.

After rebuilding, press reload on the extension in `chrome://extensions`; the dashboard warns you if you forget.

## Develop

| Command             | Does                                                      |
| ------------------- | --------------------------------------------------------- |
| `npm run build`     | Type-check, then build the extension into `dist/`         |
| `npm test`          | Run all tests once (`npm run test:watch` to keep running) |
| `npm run typecheck` | Type-check only                                           |
| `npm run format`    | Format with Prettier (`format:check` to verify)           |

Style: Prettier with the settings in `.prettierrc.json`; TypeScript in strict mode.

## Layout of the code

```txt
src/
  domain/      Pure rules, no browser APIs: channels, streamer profiles, the profile book, layouts
  platforms/   Where each platform's chat and stream live (URLs), YouTube live lookup, TikTok crop modes
  extension/   Chrome edge: frame network rules, storage, background worker, manifest
    content/   TikTok content script that crops the LIVE page to its chat or its video
  dashboard/   The dashboard page: composition root (main.ts), app controller, views
test/          Mirrors src/; DOM tests run in jsdom
spikes/        Throwaway experiments that led to the current design; not built or tested
```

## Known limits

- **Twitch main stream** shows Twitch's full channel page; set Twitch's own layout (theatre mode, hide chat) once and it sticks.
- **TikTok** comments from some accounts aren't shown to other viewers. This is TikTok's filtering and happens on TikTok's own site too, not just in Multichat.
- **YouTube @handle** lookups happen when the dashboard loads; if the streamer goes live later, press the chat's ↻ button.
- Platform page changes can break the TikTok crop (it relies on TikTok's `data-e2e` attributes and its `<video>` element).
