// Finds the video a YouTube channel is streaming right now. youtube.com/@handle/live serves the live
// video's watch page, whose canonical link names the video; when the channel is offline it serves the
// channel page instead, which has no watch link.

export class NotLiveError extends Error {
  override name = 'NotLiveError';
}

export class YouTubeLookupError extends Error {
  override name = 'YouTubeLookupError';
}

export type FetchText = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

const CANONICAL_WATCH_LINK =
  /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/;

export class YouTubeLiveLookup {
  constructor(private readonly fetchText: FetchText) {}

  /** @param handle a channel handle including the `@`, e.g. `@somestreamer` */
  async currentLiveVideoId(handle: string): Promise<string> {
    const url = `https://www.youtube.com/${encodeURIComponent(handle).replace('%40', '@')}/live`;
    const response = await this.fetchText(url);
    if (!response.ok) {
      throw new YouTubeLookupError(`Looking up ${handle} on YouTube failed (HTTP ${response.status}).`);
    }
    const videoId = (await response.text()).match(CANONICAL_WATCH_LINK)?.[1];
    if (!videoId) throw new NotLiveError(`${handle} isn't live on YouTube right now.`);
    return videoId;
  }
}
