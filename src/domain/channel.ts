// Where a streamer can be found on each platform. Each type accepts what a person would naturally paste
// (a name, an @handle or a URL), rejects anything else at construction, and normalizes what it keeps.

export class InvalidChannelError extends Error {
  override name = 'InvalidChannelError';
}

/** A Twitch login name, e.g. `shroud`. */
export class TwitchChannel {
  private static readonly LOGIN = /^[a-z0-9_]{3,25}$/;

  private constructor(readonly login: string) {}

  /** Accepts `name`, `@name` or `twitch.tv/name` URLs. */
  static parse(input: string): TwitchChannel {
    const value = input.trim();
    const fromUrl = value.match(/twitch\.tv\/([A-Za-z0-9_]+)/i)?.[1];
    const login = (fromUrl ?? value.replace(/^@/, '')).toLowerCase();
    if (!TwitchChannel.LOGIN.test(login)) {
      throw new InvalidChannelError(`"${input}" is not a Twitch channel name or link.`);
    }
    return new TwitchChannel(login);
  }

  equals(other: TwitchChannel): boolean {
    return this.login === other.login;
  }

  toString(): string {
    return this.login;
  }
}

/** A TikTok account handle, stored without the `@`. */
export class TikTokHandle {
  private static readonly HANDLE = /^[a-z0-9_.]{2,24}$/;

  private constructor(readonly handle: string) {}

  /** Accepts `name`, `@name` or `tiktok.com/@name` URLs. */
  static parse(input: string): TikTokHandle {
    const value = input.trim();
    const fromUrl = value.match(/tiktok\.com\/@([A-Za-z0-9_.]+)/i)?.[1];
    const handle = (fromUrl ?? value.replace(/^@/, '')).toLowerCase();
    if (!TikTokHandle.HANDLE.test(handle)) {
      throw new InvalidChannelError(`"${input}" is not a TikTok handle or link.`);
    }
    return new TikTokHandle(handle);
  }

  equals(other: TikTokHandle): boolean {
    return this.handle === other.handle;
  }

  toString(): string {
    return `@${this.handle}`;
  }
}

/**
 * Either one specific YouTube video (a fixed stream) or a channel @handle (whatever that channel is
 * streaming right now, looked up when the dashboard loads).
 */
export class YouTubeSource {
  private static readonly VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
  private static readonly HANDLE = /^@[A-Za-z0-9._-]{3,30}$/;

  private constructor(
    readonly kind: 'video' | 'channel',
    readonly value: string,
  ) {}

  /** Accepts a video ID, a watch / youtu.be / live URL, an @handle, or a youtube.com/@handle URL. */
  static parse(input: string): YouTubeSource {
    const value = input.trim();

    const videoId =
      value.match(/(?:[?&]v=|youtu\.be\/|\/live\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/)?.[1] ??
      (YouTubeSource.VIDEO_ID.test(value) ? value : undefined);
    if (videoId) return new YouTubeSource('video', videoId);

    const handle = value.match(/youtube\.com\/(@[A-Za-z0-9._-]+)/i)?.[1] ?? value;
    if (YouTubeSource.HANDLE.test(handle)) return new YouTubeSource('channel', handle.toLowerCase());

    throw new InvalidChannelError(`"${input}" is not a YouTube @handle, video link or video ID.`);
  }

  equals(other: YouTubeSource): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  /** Round-trips through `parse`. */
  toString(): string {
    return this.value;
  }
}
