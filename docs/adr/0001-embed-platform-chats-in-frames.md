# ADR 0001: Embed each platform's own chat in frames

Date: 2026-11-12. Status: accepted.

## Context

The goal is one tab showing a livestream plus the streamer's Twitch, YouTube and TikTok chats, reading all three and occasionally sending as the user's own accounts, with nothing set up on the streamer's side. Existing tools (ModMind, Composi Chat, All-Chat, Multistream, Unified Chat LITE) each lacked something: TikTok sending, or they needed a streamer-owned workspace.

## Decision

The dashboard is an extension page that embeds each platform's real chat page in an iframe: Twitch's and YouTube's popout chats, and TikTok's LIVE page cropped to its chat panel by a content script. The main stream is also a frame: YouTube's embed player, TikTok's LIVE page cropped to its video, or Twitch's channel page.

To allow this, tab-scoped `declarativeNetRequest` session rules:

- remove `X-Frame-Options` from the platforms' frame responses (none of them uses CSP `frame-ancestors`, so their other security headers stay intact);
- send the extension's `https://<id>.chromiumapp.org/` origin as Referer to YouTube's embed player, which refuses to play without a Referer (Error 153) and with a youtube.com one (Error 152-4).

## Rejected alternatives

- **Scrape chat from hidden platform tabs into a custom dashboard** (`spikes/tiktok`). Reading worked in a foreground tab but failed where it mattered: Chrome stops rendering hidden tabs, so TikTok's chat list froze and updated in bursts; muted hidden tabs were frozen entirely; the DOM carries no message IDs, so re-rendered rows came back as duplicates. Sending through a hidden tab was unreliable.
- **Official chat APIs per platform.** Twitch has one, YouTube's is quota-limited, TikTok has none for third parties. It would have meant three auth flows and still no TikTok.
- **Twitch's official player embed for the main stream.** It requires naming a `parent` website, which an extension page isn't. Not tried; the full channel page works.

## Consequences

- Sending, emotes, moderation tools and logins are the platforms' own, so they keep working without code on our side.
- The TikTok crop depends on TikTok's markup (`data-e2e="public-screen-container"` and the `<video>` element) and will need fixing when TikTok changes it.
- The TikTok chat frame also plays the stream (muted) underneath the chat, which costs bandwidth.
- Removing a header and setting a Referer is a deliberate workaround; it applies only to frames inside a dashboard tab.
