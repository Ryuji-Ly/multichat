import { beforeEach, describe, expect, it } from 'vitest';
import { TikTokHandle } from '../../src/domain/channel';
import { Layout } from '../../src/domain/layout';
import { ProfileBook } from '../../src/domain/profile-book';
import {
  LayoutRepository,
  ProfileBookRepository,
  StoredDataError,
  type KeyValueStore,
} from '../../src/extension/persistence';
import { aProfile } from '../domain/builders';

/** Stores values the way chrome.storage does: as JSON copies. */
class FakeStore implements KeyValueStore {
  readonly data = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    const value = this.data.get(key);
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, JSON.parse(JSON.stringify(value)));
  }
}

describe('ProfileBookRepository', () => {
  let store: FakeStore;
  let repository: ProfileBookRepository;

  beforeEach(() => {
    store = new FakeStore();
    repository = new ProfileBookRepository(store);
  });

  it('loads an empty book when nothing is saved', async () => {
    expect((await repository.load()).profiles()).toEqual([]);
  });

  it('round-trips profiles, channels, main stream and the active profile', async () => {
    const tiktokOnly = aProfile({
      id: 'b',
      name: 'Other',
      channels: { tiktok: TikTokHandle.parse('other_one') },
      main: undefined,
    });
    const book = ProfileBook.empty()
      .add(aProfile({ id: 'a' }))
      .add(tiktokOnly)
      .activate('a');

    await repository.save(book);
    const loaded = await repository.load();

    expect(loaded.profiles().map((p) => p.details())).toEqual(book.profiles().map((p) => p.details()));
    expect(loaded.active()?.id).toBe('a');
  });

  it('reports damaged data instead of loading part of it', async () => {
    await store.set('profiles', {
      version: 1,
      profiles: [{ id: 'a', name: 'X', channels: { twitch: '!!' } }],
    });

    await expect(repository.load()).rejects.toThrow(StoredDataError);
  });

  it('reports data from an unknown format version', async () => {
    await store.set('profiles', { version: 99, profiles: [] });

    await expect(repository.load()).rejects.toThrow('format version 99, expected 1');
  });
});

describe('LayoutRepository', () => {
  it('loads the default layout when nothing is saved', async () => {
    expect((await new LayoutRepository(new FakeStore()).load()).snapshot()).toEqual(
      Layout.default().snapshot(),
    );
  });

  it('round-trips a layout', async () => {
    const repository = new LayoutRepository(new FakeStore());
    const layout = Layout.default().withPreset('main-and-stack').swap('youtube', 'tiktok');

    await repository.save(layout);

    expect((await repository.load()).snapshot()).toEqual(layout.snapshot());
  });
});
