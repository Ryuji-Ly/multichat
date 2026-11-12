/** The streaming platforms Multichat shows, in their default display order. */
export const PLATFORMS = ['twitch', 'youtube', 'tiktok'] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Readonly<Record<Platform, string>> = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

export function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value);
}
