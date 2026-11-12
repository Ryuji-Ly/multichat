# Multichat: project-specific notes

- **Language / framework:** TypeScript (strict) Chrome MV3 extension, built with Vite. No UI framework.
- **Style guide + formatter:** Prettier (`.prettierrc.json`): `npm run format`, check with `npm run format:check`.
- **Build / run / test:** `npm run build` builds into `dist/` (load unpacked in Chrome). `npm test` runs Vitest. `npm run typecheck`.
- **Structure:** `src/domain` is pure (no `chrome.*`, no DOM, no fetch). `src/platforms` knows platform URLs. `src/extension` is the Chrome edge (adapters behind small interfaces). `src/dashboard/main.ts` is the only composition root that wires real Chrome APIs.
- **Glossary:** _profile_ = one streamer and their channels; _main stream_ / _stage_ = the big video area; _chat pane_ = one platform's chat; _preset_ = a layout arrangement; _slot_ = a place a frame is shown.
- **ADR location:** `docs/adr/`.
- **Can't be checked in tests:** anything that depends on the real platform pages (frame loading, TikTok crop, logins, sending). Verify those by loading `dist/` in Chrome.
- **Content script:** `src/extension/content/tiktok-crop.ts` is built separately as a single IIFE (`vite.content.config.ts`); it may import shared code, which gets bundled in.
