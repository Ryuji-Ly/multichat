// Composition root: the only place the dashboard touches Chrome's APIs directly.

import { FrameRules } from '../extension/frame-rules';
import { LayoutRepository, ProfileBookRepository, type KeyValueStore } from '../extension/persistence';
import { EmbedUrls } from '../platforms/embed-urls';
import { YouTubeLiveLookup } from '../platforms/youtube-live-lookup';
import { DashboardApp } from './app';
import { byId } from './toolbar';

const chromeStorage: KeyValueStore = {
  get: async (key) => (await chrome.storage.local.get(key))[key],
  set: (key, value) => chrome.storage.local.set({ [key]: value }),
};

const app = new DashboardApp({
  profiles: new ProfileBookRepository(chromeStorage),
  layouts: new LayoutRepository(chromeStorage),
  urls: new EmbedUrls(new YouTubeLiveLookup((url) => fetch(url))),
  newId: () => crypto.randomUUID(),
  panesHost: byId('panes'),
});

// The rules must be in place before any platform frame starts loading. If they can't be installed the
// frames will be refused, but the dashboard still starts so profiles can be managed and the reason shown.
const rulesProblem = await allowPlatformFrames().then(
  () => undefined,
  (error: Error) => `Platforms can't load in this tab: ${error.message}`,
);
await app.start();
if (rulesProblem) app.showWarning(rulesProblem);
await warnIfExtensionNotReloaded();

async function allowPlatformFrames(): Promise<void> {
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id === undefined) throw new Error('the dashboard must run in its own tab.');
  await new FrameRules(chrome.declarativeNetRequest, chrome.runtime.id).allowPlatformsIn(tab.id);
}

/**
 * Chrome serves this page fresh from dist/ but keeps running the content script from the last time
 * the extension was reloaded. Each build stamps the manifest, so differing stamps mean a stale script.
 */
async function warnIfExtensionNotReloaded(): Promise<void> {
  const onDisk = await (await fetch('/manifest.json', { cache: 'no-store' })).json();
  const loaded = chrome.runtime.getManifest();
  if (onDisk.version_name !== loaded.version_name) {
    app.showWarning('A newer build is on disk: press reload on this extension in chrome://extensions.');
  }
}
