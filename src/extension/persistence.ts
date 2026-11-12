// Saves and restores the domain through a key-value store (chrome.storage.local in the extension).
// Stored shapes are plain JSON with a version, translated to and from domain types only here.

import { TikTokHandle, TwitchChannel, YouTubeSource } from '../domain/channel';
import { Layout, type LayoutSnapshot } from '../domain/layout';
import { isPlatform, PLATFORMS } from '../domain/platform';
import { ProfileBook } from '../domain/profile-book';
import { StreamerProfile, type Channels } from '../domain/streamer-profile';

export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export class StoredDataError extends Error {
  override name = 'StoredDataError';
}

const PROFILES_KEY = 'profiles';
const LAYOUT_KEY = 'layout';
const FORMAT_VERSION = 1;

interface StoredProfile {
  id: string;
  name: string;
  channels: { twitch?: string; youtube?: string; tiktok?: string };
  main?: string;
}

interface StoredProfiles {
  version: number;
  activeId?: string;
  profiles: StoredProfile[];
}

interface StoredLayout extends LayoutSnapshot {
  version: number;
}

export class ProfileBookRepository {
  constructor(private readonly store: KeyValueStore) {}

  async load(): Promise<ProfileBook> {
    const stored = (await this.store.get(PROFILES_KEY)) as StoredProfiles | undefined;
    if (stored === undefined) return ProfileBook.empty();
    ensureVersion(stored, 'profiles');
    try {
      return ProfileBook.restore(stored.profiles.map(toProfile), stored.activeId);
    } catch (error) {
      throw new StoredDataError(`Saved profiles are damaged: ${(error as Error).message}`);
    }
  }

  async save(book: ProfileBook): Promise<void> {
    const stored: StoredProfiles = {
      version: FORMAT_VERSION,
      profiles: book.profiles().map(fromProfile),
      ...(book.active() ? { activeId: book.active()!.id } : {}),
    };
    await this.store.set(PROFILES_KEY, stored);
  }
}

export class LayoutRepository {
  constructor(private readonly store: KeyValueStore) {}

  async load(): Promise<Layout> {
    const stored = (await this.store.get(LAYOUT_KEY)) as StoredLayout | undefined;
    if (stored === undefined) return Layout.default();
    ensureVersion(stored, 'layout');
    try {
      return Layout.restore(stored);
    } catch (error) {
      throw new StoredDataError(`Saved layout is damaged: ${(error as Error).message}`);
    }
  }

  async save(layout: Layout): Promise<void> {
    const stored: StoredLayout = { version: FORMAT_VERSION, ...layout.snapshot() };
    await this.store.set(LAYOUT_KEY, stored);
  }
}

function ensureVersion(stored: { version?: unknown }, what: string): void {
  if (stored.version !== FORMAT_VERSION) {
    throw new StoredDataError(
      `Saved ${what} have format version ${String(stored.version)}, expected ${FORMAT_VERSION}.`,
    );
  }
}

function toProfile(stored: StoredProfile): StreamerProfile {
  const channels: { -readonly [P in keyof Channels]: Channels[P] } = {};
  if (stored.channels.twitch) channels.twitch = TwitchChannel.parse(stored.channels.twitch);
  if (stored.channels.youtube) channels.youtube = YouTubeSource.parse(stored.channels.youtube);
  if (stored.channels.tiktok) channels.tiktok = TikTokHandle.parse(stored.channels.tiktok);
  if (stored.main !== undefined && !isPlatform(stored.main)) {
    throw new StoredDataError(`Unknown main platform "${stored.main}".`);
  }
  return StreamerProfile.create(stored.id, { name: stored.name, channels, main: stored.main });
}

function fromProfile(profile: StreamerProfile): StoredProfile {
  const channels: StoredProfile['channels'] = {};
  for (const platform of PLATFORMS) {
    const channel = profile.channel(platform);
    if (channel) channels[platform] = channel.toString();
  }
  return { id: profile.id, name: profile.name, channels, ...(profile.main ? { main: profile.main } : {}) };
}
