// Runs in every TikTok frame (content script), but only crops a frame the dashboard opened with a crop
// hash (see platforms/tiktok-crop-mode.ts):
//   chat  → only the chat panel; the video keeps playing underneath, muted
//   video → only the video player
// Both crops verified on live pages, logged in and out, at 1240x939 and 340x909 (2026-11-12).

import { tiktokCropModeFromHash, type TikTokCropMode } from '../../platforms/tiktok-crop-mode';

interface Crop {
  findPanel(): Element | null;
  /** The chat frame's video plays under the chat; it must not be heard. */
  silenceVideo: boolean;
  /**
   * Hide everything but the panel. Not for chat: TikTok's emoji picker and user menus may open outside
   * the chat panel and would disappear.
   */
  hideRest: boolean;
}

const CROPS: Record<TikTokCropMode, Crop> = {
  chat: {
    findPanel: () => document.querySelector('[data-e2e="public-screen-container"]'),
    silenceVideo: true,
    hideRest: false,
  },
  video: { findPanel: findVideoPlayer, silenceVideo: false, hideRest: true },
};

const MARKER = 'data-multichat-crop';
const CHECK_INTERVAL_MS = 1000;

// Two things keep a fixed panel from covering the frame, both caused by its ancestors:
// - a transform, filter, contain, will-change or perspective makes `fixed` relative to that ancestor;
// - a z-index or isolation caps how high the panel can stack (TikTok's player sits under z-[1]/z-[2]).
const ANCESTOR_RESETS: Record<string, string> = {
  transform: 'none',
  filter: 'none',
  contain: 'none',
  'will-change': 'auto',
  perspective: 'none',
  'z-index': 'auto',
  isolation: 'auto',
};

const mode = tiktokCropModeFromHash(location.hash);
if (window !== window.top && mode) startCropping(CROPS[mode]);

function startCropping(crop: Crop): void {
  const style = document.createElement('style');
  style.textContent = cropCss(crop.hideRest);

  // Re-applied every second: TikTok may rebuild <head> (dropping the style) or re-render the panel
  // (dropping the marker).
  const apply = () => {
    if (!style.isConnected) (document.head ?? document.documentElement).append(style);
    markPanel(crop.findPanel());
    if (crop.silenceVideo) muteVideos();
  };
  apply();
  setInterval(apply, CHECK_INTERVAL_MS);
}

/** Anchored on the <video> itself: the logged-in page lacks the `player-area` marker the logged-out one has. */
function findVideoPlayer(): Element | null {
  const videos = [...document.querySelectorAll('video')];
  const largest = videos.reduce<HTMLVideoElement | undefined>(
    (best, video) => (!best || area(video) > area(best) ? video : best),
    undefined,
  );
  return largest ? (largest.closest('.xgplayer') ?? largest.parentElement) : null;
}

function area(element: HTMLElement): number {
  return element.clientWidth * element.clientHeight;
}

function markPanel(panel: Element | null): void {
  if (!panel) return;
  if (!panel.hasAttribute(MARKER)) {
    document.querySelectorAll(`[${MARKER}]`).forEach((stale) => stale.removeAttribute(MARKER));
    panel.setAttribute(MARKER, '');
  }
  for (
    let ancestor = panel.parentElement;
    ancestor && ancestor !== document.documentElement;
    ancestor = ancestor.parentElement
  ) {
    for (const [property, value] of Object.entries(ANCESTOR_RESETS)) {
      ancestor.style.setProperty(property, value, 'important');
    }
  }
}

function muteVideos(): void {
  for (const video of document.querySelectorAll('video')) video.muted = true;
}

function cropCss(hideRest: boolean): string {
  const pinPanel = `
    [${MARKER}] {
      position: fixed !important;
      inset: 0 !important;
      width: auto !important;
      height: auto !important;
      min-height: 0 !important;
      margin: 0 !important;
      border-radius: 0 !important;
      transform: none !important;
      z-index: 2147483647 !important;
      --live-chat-width: 100vw;
    }`;
  const hideEverythingElse = `
    body * { visibility: hidden !important; }
    [${MARKER}], [${MARKER}] * { visibility: visible !important; }
    html, body { background: #000 !important; }`;
  return hideRest ? pinPanel + hideEverythingElse : pinPanel;
}
