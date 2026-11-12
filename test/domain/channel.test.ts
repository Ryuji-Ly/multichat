import { describe, expect, it } from 'vitest';
import { InvalidChannelError, TikTokHandle, TwitchChannel, YouTubeSource } from '../../src/domain/channel';

describe('TwitchChannel', () => {
  it.each([
    ['shroud', 'shroud'],
    ['@Shroud', 'shroud'],
    ['  shroud  ', 'shroud'],
    ['https://www.twitch.tv/Shroud', 'shroud'],
    ['twitch.tv/shroud/videos', 'shroud'],
  ])('reads %j as %j', (input, login) => {
    expect(TwitchChannel.parse(input).login).toBe(login);
  });

  it.each(['', 'ab', 'has space', 'a'.repeat(26), 'https://youtube.com/@x'])('rejects %j', (input) => {
    expect(() => TwitchChannel.parse(input)).toThrow(InvalidChannelError);
  });

  it('compares by login', () => {
    expect(TwitchChannel.parse('Shroud').equals(TwitchChannel.parse('twitch.tv/shroud'))).toBe(true);
  });
});

describe('TikTokHandle', () => {
  it.each([
    ['slayermob1le', 'slayermob1le'],
    ['@SlayerMob1le', 'slayermob1le'],
    ['https://www.tiktok.com/@slayermob1le/live', 'slayermob1le'],
    ['user.name_1', 'user.name_1'],
  ])('reads %j as %j', (input, handle) => {
    expect(TikTokHandle.parse(input).handle).toBe(handle);
  });

  it.each(['', '@', 'a', 'no spaces', 'a'.repeat(25)])('rejects %j', (input) => {
    expect(() => TikTokHandle.parse(input)).toThrow(InvalidChannelError);
  });

  it('shows itself with an @', () => {
    expect(TikTokHandle.parse('slayermob1le').toString()).toBe('@slayermob1le');
  });
});

describe('YouTubeSource', () => {
  it.each([
    ['7chzVV6ddmQ', '7chzVV6ddmQ'],
    ['https://www.youtube.com/watch?v=7chzVV6ddmQ', '7chzVV6ddmQ'],
    ['https://www.youtube.com/watch?feature=share&v=7chzVV6ddmQ', '7chzVV6ddmQ'],
    ['https://youtu.be/7chzVV6ddmQ?t=3', '7chzVV6ddmQ'],
    ['https://www.youtube.com/live/7chzVV6ddmQ', '7chzVV6ddmQ'],
  ])('reads %j as video %j', (input, videoId) => {
    const source = YouTubeSource.parse(input);

    expect(source.kind).toBe('video');
    expect(source.value).toBe(videoId);
  });

  it.each([
    ['@SomeStreamer', '@somestreamer'],
    ['https://www.youtube.com/@SomeStreamer', '@somestreamer'],
    ['https://www.youtube.com/@SomeStreamer/live', '@somestreamer'],
  ])('reads %j as channel %j', (input, handle) => {
    const source = YouTubeSource.parse(input);

    expect(source.kind).toBe('channel');
    expect(source.value).toBe(handle);
  });

  it.each(['', 'somestreamer', '@ab', 'tooShortId', 'https://youtube.com/watch?v=short'])(
    'rejects %j',
    (input) => {
      expect(() => YouTubeSource.parse(input)).toThrow(InvalidChannelError);
    },
  );

  it('round-trips through its string form', () => {
    for (const input of ['7chzVV6ddmQ', '@somestreamer']) {
      const source = YouTubeSource.parse(input);
      expect(YouTubeSource.parse(source.toString()).equals(source)).toBe(true);
    }
  });
});
