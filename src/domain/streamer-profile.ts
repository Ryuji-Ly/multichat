import { TikTokHandle, TwitchChannel, YouTubeSource } from './channel';
import { PLATFORMS, type Platform } from './platform';

export interface ChannelTypes {
  twitch: TwitchChannel;
  youtube: YouTubeSource;
  tiktok: TikTokHandle;
}

export type Channels = { readonly [P in Platform]?: ChannelTypes[P] };

export class InvalidProfileError extends Error {
  override name = 'InvalidProfileError';
}

export interface ProfileDetails {
  readonly name: string;
  readonly channels: Channels;
  /** The platform whose stream fills the main area; none means chats only. */
  readonly main?: Platform | undefined;
}

const MAX_NAME_LENGTH = 40;

/** One streamer: what they're called here, where they stream, and which stream to watch. */
export class StreamerProfile {
  private constructor(
    readonly id: string,
    readonly name: string,
    private readonly channelMap: Channels,
    readonly main: Platform | undefined,
  ) {}

  static create(id: string, details: ProfileDetails): StreamerProfile {
    const name = details.name.trim();
    if (!id) throw new InvalidProfileError('A profile needs an id.');
    if (!name) throw new InvalidProfileError('Give the streamer a name.');
    if (name.length > MAX_NAME_LENGTH) {
      throw new InvalidProfileError(`Keep the name under ${MAX_NAME_LENGTH} characters.`);
    }

    const channels: Channels = { ...details.channels };
    if (!PLATFORMS.some((platform) => channels[platform])) {
      throw new InvalidProfileError('Add at least one channel.');
    }
    if (details.main && !channels[details.main]) {
      throw new InvalidProfileError(`The main stream can't be ${details.main}: no channel is set for it.`);
    }
    return new StreamerProfile(id, name, Object.freeze(channels), details.main);
  }

  /** Same profile (same id) with new details; validated like `create`. */
  withDetails(details: ProfileDetails): StreamerProfile {
    return StreamerProfile.create(this.id, details);
  }

  channel<P extends Platform>(platform: P): ChannelTypes[P] | undefined {
    return this.channelMap[platform] as ChannelTypes[P] | undefined;
  }

  /** Platforms that have a channel, in display order. */
  platforms(): Platform[] {
    return PLATFORMS.filter((platform) => this.channelMap[platform]);
  }

  details(): ProfileDetails {
    return { name: this.name, channels: this.channelMap, main: this.main };
  }

  hasName(name: string): boolean {
    return this.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase();
  }
}
