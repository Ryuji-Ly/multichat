import { describe, expect, it } from 'vitest';
import { TikTokHandle } from '../../src/domain/channel';
import { InvalidProfileError } from '../../src/domain/streamer-profile';
import { aProfile } from './builders';

describe('StreamerProfile', () => {
  it('lists its platforms in display order', () => {
    expect(aProfile().platforms()).toEqual(['twitch', 'youtube', 'tiktok']);
  });

  it('can be on a single platform without a main stream', () => {
    const profile = aProfile({ channels: { tiktok: TikTokHandle.parse('slayermob1le') }, main: undefined });

    expect(profile.platforms()).toEqual(['tiktok']);
    expect(profile.main).toBeUndefined();
  });

  it('trims its name', () => {
    expect(aProfile({ name: '  SlayeR  ' }).name).toBe('SlayeR');
  });

  it.each([
    ['an empty name', { name: '   ' }, 'Give the streamer a name.'],
    ['a long name', { name: 'x'.repeat(41) }, 'Keep the name under 40 characters.'],
    ['no channels', { channels: {} }, 'Add at least one channel.'],
    [
      'a main stream without a channel',
      { channels: { tiktok: TikTokHandle.parse('x_x') }, main: 'twitch' as const },
      "The main stream can't be twitch: no channel is set for it.",
    ],
  ])('rejects %s', (_, details, message) => {
    expect(() => aProfile(details)).toThrow(new InvalidProfileError(message));
  });

  it('keeps its id when its details change', () => {
    const edited = aProfile({ id: 'abc' }).withDetails({ ...aProfile().details(), name: 'New name' });

    expect(edited.id).toBe('abc');
    expect(edited.name).toBe('New name');
  });

  it('leaves itself unchanged when an edit is rejected', () => {
    const profile = aProfile();

    expect(() => profile.withDetails({ ...profile.details(), name: '' })).toThrow(InvalidProfileError);
    expect(profile.name).toBe('SlayeR');
  });

  it('matches names case-insensitively', () => {
    expect(aProfile({ name: 'SlayeR' }).hasName(' slayer ')).toBe(true);
  });
});
