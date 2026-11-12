import type { TikTokHandle, TwitchChannel, YouTubeSource } from '../domain/channel';
import type { Platform } from '../domain/platform';
import type { StreamerProfile } from '../domain/streamer-profile';
import { tiktokCropHash } from './tiktok-crop-mode';
import type { YouTubeLiveLookup } from './youtube-live-lookup';

/** The pages a dashboard frame loads for each platform: its chat, and its stream for the main area. */
export class EmbedUrls {
  constructor(private readonly youtubeLive: YouTubeLiveLookup) {}

  async chat(profile: StreamerProfile, platform: Platform): Promise<string> {
    switch (platform) {
      case 'twitch':
        return twitchChat(required(profile.channel('twitch'), platform));
      case 'youtube':
        return youtubeChat(await this.youtubeVideoId(required(profile.channel('youtube'), platform)));
      case 'tiktok':
        return tiktokLive(required(profile.channel('tiktok'), platform)) + tiktokCropHash('chat');
    }
  }

  async stream(profile: StreamerProfile, platform: Platform): Promise<string> {
    switch (platform) {
      case 'twitch':
        // The full channel page (verified 2026-11-12). Twitch's player embed requires a `parent` website
        // to be named, which an extension page isn't; not tried yet.
        return `https://www.twitch.tv/${required(profile.channel('twitch'), platform).login}`;
      case 'youtube':
        return youtubePlayer(await this.youtubeVideoId(required(profile.channel('youtube'), platform)));
      case 'tiktok':
        return tiktokLive(required(profile.channel('tiktok'), platform)) + tiktokCropHash('video');
    }
  }

  private youtubeVideoId(source: YouTubeSource): Promise<string> {
    return source.kind === 'video'
      ? Promise.resolve(source.value)
      : this.youtubeLive.currentLiveVideoId(source.value);
  }
}

function required<T>(channel: T | undefined, platform: Platform): T {
  if (channel === undefined) throw new Error(`This profile has no ${platform} channel.`);
  return channel;
}

const twitchChat = (channel: TwitchChannel) => `https://www.twitch.tv/popout/${channel.login}/chat?popout=`;
const youtubeChat = (videoId: string) => `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;
const youtubePlayer = (videoId: string) => `https://www.youtube.com/embed/${videoId}?autoplay=1`;
const tiktokLive = (handle: TikTokHandle) => `https://www.tiktok.com/@${handle.handle}/live`;
