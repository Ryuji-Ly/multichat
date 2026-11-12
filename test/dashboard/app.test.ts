// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import dashboardHtml from '../../src/dashboard/dashboard.html?raw';
import { DashboardApp } from '../../src/dashboard/app';
import { LayoutRepository, ProfileBookRepository, type KeyValueStore } from '../../src/extension/persistence';
import { EmbedUrls } from '../../src/platforms/embed-urls';
import { YouTubeLiveLookup } from '../../src/platforms/youtube-live-lookup';

class FakeStore implements KeyValueStore {
  readonly data = new Map<string, unknown>();
  async get(key: string) {
    const value = this.data.get(key);
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }
  async set(key: string, value: unknown) {
    this.data.set(key, JSON.parse(JSON.stringify(value)));
  }
}

const dashboardBody = dashboardHtml
  .match(/<body>([\s\S]*)<\/body>/)![1]!
  .replace(/<script[\s\S]*?<\/script>/, '');

const youtubeLive = new YouTubeLiveLookup(async () => ({
  ok: true,
  status: 200,
  text: async () => '<link rel="canonical" href="https://www.youtube.com/watch?v=LIVEvideo01">',
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

function fill(name: string, value: string) {
  const input = $<HTMLInputElement>(`#profile-form [name="${name}"]`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

/** Platform labels of the chat panes, in on-screen order. */
const chatOrder = () =>
  [...document.querySelectorAll('.chat-header')].map((h) => h.textContent?.replace(/[⠿↻]/g, ''));
const frameSources = () => [...document.querySelectorAll('#panes iframe')].map((f) => f.getAttribute('src'));

describe('DashboardApp', () => {
  let store: FakeStore;
  let ids: number;

  const startApp = async () => {
    const app = new DashboardApp({
      profiles: new ProfileBookRepository(store),
      layouts: new LayoutRepository(store),
      urls: new EmbedUrls(youtubeLive),
      newId: () => `id-${++ids}`,
      panesHost: $('#panes'),
    });
    await app.start();
    await settle();
    return app;
  };

  const createSlayer = async () => {
    $<HTMLButtonElement>('#new-profile').click();
    fill('name', 'SlayeR');
    fill('twitch', 'slayer');
    fill('youtube', '@slayer');
    fill('tiktok', '@slayermob1le');
    $<HTMLFormElement>('#profile-form').requestSubmit();
    await settle();
    await settle();
  };

  beforeEach(() => {
    document.body.innerHTML = dashboardBody;
    // jsdom lacks <dialog> modality; these are enough for the dialog's open/close.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    store = new FakeStore();
    ids = 0;
  });

  it('asks for a first streamer when there are none', async () => {
    await startApp();

    expect($('#panes').textContent).toContain('Add a streamer with "New"');
  });

  it('shows the main stream and all three chats for a new profile', async () => {
    await startApp();
    await createSlayer();

    expect(chatOrder()).toEqual(['Twitch', 'YouTube', 'TikTok']);
    expect(frameSources().sort()).toEqual(
      [
        'https://www.twitch.tv/popout/slayer/chat?popout=',
        'https://www.youtube.com/live_chat?is_popout=1&v=LIVEvideo01',
        'https://www.tiktok.com/@slayermob1le/live#multichat-chat',
        'https://www.twitch.tv/slayer',
      ].sort(),
    );
    expect($('#panes > .split > .pane:first-child iframe').getAttribute('src')).toBe(
      'https://www.twitch.tv/slayer',
    );
  });

  it('keeps the profile after a restart', async () => {
    await startApp();
    await createSlayer();

    document.body.innerHTML = dashboardBody;
    await startApp();

    expect($<HTMLSelectElement>('#profile-select').selectedOptions[0]?.textContent).toBe('SlayeR');
    expect(chatOrder()).toEqual(['Twitch', 'YouTube', 'TikTok']);
  });

  it('shows why a profile was refused and keeps the dialog open', async () => {
    await startApp();
    $<HTMLButtonElement>('#new-profile').click();
    fill('name', 'Nobody');
    $<HTMLFormElement>('#profile-form').requestSubmit();
    await settle();

    expect($('#profile-error').textContent).toBe('Add at least one channel.');
    expect($<HTMLDialogElement>('#profile-dialog').open).toBe(true);
  });

  // Reusing the element is what lets Chrome's moveBefore keep the page alive; jsdom has no
  // moveBefore, so whether the page survives the move is only checkable in Chrome.
  it('swaps two chats, moving the existing frames rather than creating new ones', async () => {
    await startApp();
    await createSlayer();
    const twitchFrame = $('#panes iframe[src*="popout/slayer"]');

    const drag = new Event('drop', { bubbles: true }) as DragEvent;
    Object.defineProperty(drag, 'dataTransfer', {
      value: { getData: () => 'twitch', types: ['application/x-multichat-platform'] },
    });
    [...document.querySelectorAll('.chat-header')]
      .find((h) => h.textContent?.includes('TikTok'))!
      .closest('.pane')!
      .dispatchEvent(drag);
    await settle();

    expect(chatOrder()).toEqual(['TikTok', 'YouTube', 'Twitch']);
    expect($('#panes iframe[src*="popout/slayer"]')).toBe(twitchFrame);
  });

  it('rearranges the chats when the preset changes', async () => {
    await startApp();
    await createSlayer();

    const preset = $<HTMLSelectElement>('#preset-select');
    preset.value = 'main-and-stack';
    preset.dispatchEvent(new Event('change'));
    await settle();

    expect(document.querySelectorAll('#panes .split.column .chat-header')).toHaveLength(2);
  });

  it('shows chats only when the main stream is set to none', async () => {
    await startApp();
    await createSlayer();

    const main = $<HTMLSelectElement>('#main-select');
    main.value = '';
    main.dispatchEvent(new Event('change'));
    await settle();
    await settle();

    expect(document.querySelectorAll('#panes iframe')).toHaveLength(3);
    expect($('#panes iframe[src="https://www.twitch.tv/slayer"]')).toBeNull();
  });
});
