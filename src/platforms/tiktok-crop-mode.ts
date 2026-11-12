// Shared by the URL builder (which asks for a crop) and the TikTok content script (which applies it).
// The request travels as the URL hash, the one thing the dashboard can set on a cross-site frame.

export type TikTokCropMode = 'chat' | 'video';

const HASH_PREFIX = '#multichat-';

export function tiktokCropHash(mode: TikTokCropMode): string {
  return `${HASH_PREFIX}${mode}`;
}

export function tiktokCropModeFromHash(hash: string): TikTokCropMode | undefined {
  if (hash === tiktokCropHash('chat')) return 'chat';
  if (hash === tiktokCropHash('video')) return 'video';
  return undefined;
}
