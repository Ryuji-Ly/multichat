import { describe, expect, it } from 'vitest';
import {
  NotLiveError,
  YouTubeLiveLookup,
  YouTubeLookupError,
  type FetchText,
} from '../../src/platforms/youtube-live-lookup';

function serving(status: number, body: string): FetchText & { requested: string[] } {
  const requested: string[] = [];
  const fetchText = async (url: string) => {
    requested.push(url);
    return { ok: status < 400, status, text: async () => body };
  };
  return Object.assign(fetchText, { requested });
}

describe('YouTubeLiveLookup', () => {
  it("reads the live video from the channel's /live page", async () => {
    const fetchText = serving(
      200,
      '<head><link rel="canonical" href="https://www.youtube.com/watch?v=7chzVV6ddmQ"></head>',
    );

    expect(await new YouTubeLiveLookup(fetchText).currentLiveVideoId('@somestreamer')).toBe('7chzVV6ddmQ');
    expect(fetchText.requested).toEqual(['https://www.youtube.com/@somestreamer/live']);
  });

  it('reports a channel that is offline', async () => {
    const channelPage = '<link rel="canonical" href="https://www.youtube.com/channel/UC123">';

    await expect(new YouTubeLiveLookup(serving(200, channelPage)).currentLiveVideoId('@x_y')).rejects.toThrow(
      new NotLiveError("@x_y isn't live on YouTube right now."),
    );
  });

  it('reports a failed request', async () => {
    await expect(new YouTubeLiveLookup(serving(503, '')).currentLiveVideoId('@x_y')).rejects.toThrow(
      new YouTubeLookupError('Looking up @x_y on YouTube failed (HTTP 503).'),
    );
  });
});
