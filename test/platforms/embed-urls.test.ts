import { describe, expect, it } from 'vitest';
import { YouTubeSource } from '../../src/domain/channel';
import { EmbedUrls } from '../../src/platforms/embed-urls';
import { YouTubeLiveLookup } from '../../src/platforms/youtube-live-lookup';
import { aProfile } from '../domain/builders';

/** A YouTube lookup that knows one live channel. */
const liveLookup = new YouTubeLiveLookup(async () => ({
  ok: true,
  status: 200,
  text: async () => '<link rel="canonical" href="https://www.youtube.com/watch?v=LIVEvideo01">',
}));
const urls = new EmbedUrls(liveLookup);

describe('EmbedUrls', () => {
  const profile = aProfile();

  it('uses popout chats for Twitch and YouTube', async () => {
    expect(await urls.chat(profile, 'twitch')).toBe('https://www.twitch.tv/popout/slayer/chat?popout=');
    expect(await urls.chat(profile, 'youtube')).toBe(
      'https://www.youtube.com/live_chat?is_popout=1&v=LIVEvideo01',
    );
  });

  it("asks for TikTok's LIVE page cropped to the chat or the video", async () => {
    expect(await urls.chat(profile, 'tiktok')).toBe(
      'https://www.tiktok.com/@slayermob1le/live#multichat-chat',
    );
    expect(await urls.stream(profile, 'tiktok')).toBe(
      'https://www.tiktok.com/@slayermob1le/live#multichat-video',
    );
  });

  it("uses YouTube's embed player for the main stream", async () => {
    expect(await urls.stream(profile, 'youtube')).toBe(
      'https://www.youtube.com/embed/LIVEvideo01?autoplay=1',
    );
  });

  it('uses a fixed YouTube video without looking anything up', async () => {
    const failingLookup = new YouTubeLiveLookup(() => Promise.reject(new Error('should not be called')));
    const fixed = aProfile({
      channels: { youtube: YouTubeSource.parse('https://youtu.be/7chzVV6ddmQ') },
      main: undefined,
    });

    expect(await new EmbedUrls(failingLookup).chat(fixed, 'youtube')).toContain('v=7chzVV6ddmQ');
  });

  it('refuses a platform the profile has no channel for', async () => {
    const tiktokOnly = aProfile({ channels: { tiktok: profile.channel('tiktok')! }, main: undefined });

    await expect(urls.chat(tiktokOnly, 'twitch')).rejects.toThrow('This profile has no twitch channel.');
  });
});
