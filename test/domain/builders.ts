import { TikTokHandle, TwitchChannel, YouTubeSource } from '../../src/domain/channel';
import { StreamerProfile, type ProfileDetails } from '../../src/domain/streamer-profile';

/** A valid profile on all three platforms; override only what the test is about. */
export function aProfile(overrides: Partial<ProfileDetails> & { id?: string } = {}): StreamerProfile {
  const { id = 'p1', ...details } = overrides;
  return StreamerProfile.create(id, {
    name: 'SlayeR',
    channels: {
      twitch: TwitchChannel.parse('slayer'),
      youtube: YouTubeSource.parse('@slayer'),
      tiktok: TikTokHandle.parse('slayermob1le'),
    },
    main: 'tiktok',
    ...details,
  });
}
