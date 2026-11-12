import { Layout, type LayoutPreset, type Pane, type SplitPane } from '../domain/layout';
import type { Platform } from '../domain/platform';
import { ProfileBook } from '../domain/profile-book';
import { StreamerProfile, type ProfileDetails } from '../domain/streamer-profile';
import type { LayoutRepository, ProfileBookRepository } from '../extension/persistence';
import type { EmbedUrls } from '../platforms/embed-urls';
import { FrameRegistry, type SlotId } from './frames';
import { renderPanes, slotsOf } from './pane-view';
import { ProfileDialog } from './profile-dialog';
import { Toolbar } from './toolbar';

export interface DashboardDependencies {
  readonly profiles: ProfileBookRepository;
  readonly layouts: LayoutRepository;
  readonly urls: EmbedUrls;
  readonly newId: () => string;
  readonly panesHost: HTMLElement;
}

/**
 * Orchestrates the dashboard: asks the domain for every change, saves the result, and redraws.
 * Holds no rules of its own; refusals come from the domain and are shown to the person.
 */
export class DashboardApp {
  private book = ProfileBook.empty();
  private layout = Layout.default();
  private readonly frames = new FrameRegistry();
  /** Resolved page per slot and channel, so layout changes don't repeat YouTube lookups. */
  private readonly urlCache = new Map<string, Promise<string>>();

  private readonly toolbar = new Toolbar({
    selectProfile: (id) => this.commitBook(() => this.book.activate(id)),
    newProfile: () => this.dialog.openNew(),
    editProfile: () => {
      const active = this.book.active();
      if (active) this.dialog.openEdit(active);
    },
    choosePreset: (preset: LayoutPreset) => this.commitLayout(() => this.layout.withPreset(preset)),
    chooseMain: (main) =>
      this.commitBook(() => {
        const active = this.requireActive();
        return this.book.update(active.withDetails({ ...active.details(), main }));
      }),
  });

  private readonly dialog = new ProfileDialog({
    save: (details, editingId) => this.saveProfile(details, editingId),
    delete: (id) => this.commitBook(() => this.book.remove(id), { rethrow: true }),
  });

  constructor(private readonly deps: DashboardDependencies) {}

  async start(): Promise<void> {
    const problems: string[] = [];
    try {
      this.book = await this.deps.profiles.load();
    } catch (error) {
      problems.push(`${(error as Error).message} Starting without profiles; saving one replaces them.`);
    }
    try {
      this.layout = await this.deps.layouts.load();
    } catch (error) {
      problems.push(`${(error as Error).message} Using the default layout.`);
    }
    this.render();
    if (problems.length > 0) this.toolbar.showError(problems.join(' '));
  }

  showWarning(message: string): void {
    this.toolbar.showError(message);
  }

  // Pane actions -------------------------------------------------------------------------------------

  private readonly paneActions = {
    swap: (a: Platform, b: Platform) => this.commitLayout(() => this.layout.swap(a, b)),
    previewResize: (split: SplitPane, index: number, delta: number) =>
      findSplit(this.arrange(this.layout.resize(split, index, delta)), split.key)?.weights ?? split.weights,
    resize: (split: SplitPane, index: number, delta: number) =>
      this.commitLayout(() => this.layout.resize(split, index, delta)),
    reloadChat: (platform: Platform) => {
      this.forgetUrls(`chat:${platform}`);
      this.frames.reload(`chat:${platform}`);
      void this.loadSlots();
    },
  };

  // Commands -----------------------------------------------------------------------------------------

  private async saveProfile(details: ProfileDetails, editingId: string | undefined): Promise<void> {
    await this.commitBook(
      () => {
        if (!editingId) return this.book.add(StreamerProfile.create(this.deps.newId(), details));
        const existing = this.book.profiles().find((profile) => profile.id === editingId);
        if (!existing) throw new Error('That profile no longer exists.');
        return this.book.update(existing.withDetails(details));
      },
      { rethrow: true },
    );
  }

  /** Applies a change to the profiles; a refused change leaves everything as it was. */
  private async commitBook(change: () => ProfileBook, { rethrow = false } = {}): Promise<void> {
    try {
      const next = change();
      await this.deps.profiles.save(next);
      this.book = next;
      this.urlCache.clear();
      this.toolbar.clearError();
      this.render();
    } catch (error) {
      if (rethrow) throw error;
      this.toolbar.showError((error as Error).message);
      this.render();
    }
  }

  private async commitLayout(change: () => Layout): Promise<void> {
    try {
      const next = change();
      await this.deps.layouts.save(next);
      this.layout = next;
      this.render();
    } catch (error) {
      this.toolbar.showError((error as Error).message);
    }
  }

  // Rendering ----------------------------------------------------------------------------------------

  private render(): void {
    this.toolbar.render(this.book, this.layout);
    renderPanes(this.deps.panesHost, this.arrange(), this.frames, this.paneActions);
    void this.loadSlots();
  }

  private arrange(layout: Layout = this.layout): Pane | undefined {
    const active = this.book.active();
    return active ? layout.arrange(active.platforms(), active.main !== undefined) : undefined;
  }

  /** Points every visible slot at its page; a page that can't be found shows why instead. */
  private async loadSlots(): Promise<void> {
    const profile = this.book.active();
    if (!profile) return;
    await Promise.all(
      slotsOf(this.arrange()).map(async (slot) => {
        try {
          this.frames.show(slot, { url: await this.urlFor(profile, slot) });
        } catch (error) {
          this.frames.show(slot, { message: (error as Error).message });
        }
      }),
    );
  }

  private urlFor(profile: StreamerProfile, slot: SlotId): Promise<string> {
    const key = `${slot}|${profile.id}`;
    let url = this.urlCache.get(key);
    if (!url) {
      url =
        slot === 'stage'
          ? this.deps.urls.stream(profile, profile.main!)
          : this.deps.urls.chat(profile, slot.slice('chat:'.length) as Platform);
      url.catch(() => this.urlCache.delete(key)); // retry failed lookups next time
      this.urlCache.set(key, url);
    }
    return url;
  }

  private forgetUrls(slot: SlotId): void {
    for (const key of this.urlCache.keys()) if (key.startsWith(`${slot}|`)) this.urlCache.delete(key);
  }

  private requireActive(): StreamerProfile {
    const active = this.book.active();
    if (!active) throw new Error('Pick a streamer first.');
    return active;
  }
}

function findSplit(pane: Pane | undefined, key: string): SplitPane | undefined {
  if (pane?.kind !== 'split') return undefined;
  if (pane.key === key) return pane;
  for (const child of pane.children) {
    const found = findSplit(child, key);
    if (found) return found;
  }
  return undefined;
}
