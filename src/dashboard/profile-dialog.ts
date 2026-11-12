import { TikTokHandle, TwitchChannel, YouTubeSource } from '../domain/channel';
import { isPlatform, PLATFORM_LABELS, PLATFORMS, type Platform } from '../domain/platform';
import type { Channels, ProfileDetails, StreamerProfile } from '../domain/streamer-profile';
import { byId, option } from './toolbar';

export interface ProfileDialogActions {
  /** Saves new details; `editingId` is undefined for a new profile. Throws if the details are refused. */
  save(details: ProfileDetails, editingId: string | undefined): Promise<void>;
  delete(id: string): Promise<void>;
}

const CHANNEL_PARSERS: { [P in Platform]: (input: string) => NonNullable<Channels[P]> } = {
  twitch: TwitchChannel.parse,
  youtube: YouTubeSource.parse,
  tiktok: TikTokHandle.parse,
};

/** Creates or edits one streamer profile. Stays open, showing the reason, until a save succeeds. */
export class ProfileDialog {
  private readonly dialog = byId<HTMLDialogElement>('profile-dialog');
  private readonly form = byId<HTMLFormElement>('profile-form');
  private readonly title = byId('profile-dialog-title');
  private readonly error = byId('profile-error');
  private readonly deleteButton = byId<HTMLButtonElement>('delete-profile');
  private editingId: string | undefined;
  /** A new profile picks the first channel as main stream, until the person chooses themselves. */
  private autoPickMain = false;

  constructor(private readonly actions: ProfileDialogActions) {
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submit();
    });
    byId('cancel-profile').addEventListener('click', () => this.dialog.close());
    this.deleteButton.addEventListener('click', () => void this.deleteEditedProfile());
    this.mainSelect().addEventListener('change', () => (this.autoPickMain = false));
    for (const platform of PLATFORMS) {
      this.input(platform).addEventListener('input', () => this.refreshMainOptions(this.currentMain()));
    }
  }

  openNew(): void {
    this.open(undefined, { name: '', channels: {}, main: undefined });
  }

  openEdit(profile: StreamerProfile): void {
    this.open(profile.id, profile.details());
  }

  private open(editingId: string | undefined, details: ProfileDetails): void {
    this.editingId = editingId;
    this.autoPickMain = !editingId;
    this.title.textContent = editingId ? `Edit ${details.name}` : 'New streamer';
    this.deleteButton.hidden = !editingId;
    this.error.textContent = '';

    this.input('name').value = details.name;
    for (const platform of PLATFORMS)
      this.input(platform).value = details.channels[platform]?.toString() ?? '';
    this.refreshMainOptions(details.main);
    this.dialog.showModal();
  }

  private async submit(): Promise<void> {
    try {
      await this.actions.save(this.readDetails(), this.editingId);
      this.dialog.close();
    } catch (error) {
      this.error.textContent = (error as Error).message;
    }
  }

  private async deleteEditedProfile(): Promise<void> {
    const id = this.editingId;
    if (!id || !confirm(`Delete ${this.input('name').value}? This can't be undone.`)) return;
    try {
      await this.actions.delete(id);
      this.dialog.close();
    } catch (error) {
      this.error.textContent = (error as Error).message;
    }
  }

  /** Reads the form into domain values; a channel that doesn't parse throws with the reason. */
  private readDetails(): ProfileDetails {
    const channels: { -readonly [P in Platform]?: Channels[P] } = {};
    for (const platform of PLATFORMS) {
      const value = this.input(platform).value.trim();
      if (value) (channels as Record<Platform, unknown>)[platform] = CHANNEL_PARSERS[platform](value);
    }
    const main = this.mainSelect().value;
    return { name: this.input('name').value, channels, main: isPlatform(main) ? main : undefined };
  }

  /** Main stream options follow the channels filled in, keeping the choice while it's still possible. */
  private refreshMainOptions(preferred: Platform | undefined): void {
    const filled = PLATFORMS.filter((platform) => this.input(platform).value.trim());
    this.mainSelect().replaceChildren(
      option('', 'None (chats only)'),
      ...filled.map((platform) => option(platform, PLATFORM_LABELS[platform])),
    );
    const keep = preferred && filled.includes(preferred) ? preferred : undefined;
    this.mainSelect().value = keep ?? (this.autoPickMain ? (filled[0] ?? '') : '');
  }

  private currentMain(): Platform | undefined {
    const value = this.mainSelect().value;
    return isPlatform(value) ? value : undefined;
  }

  private input(name: 'name' | Platform): HTMLInputElement {
    return this.form.elements.namedItem(name) as HTMLInputElement;
  }

  private mainSelect(): HTMLSelectElement {
    return this.form.elements.namedItem('main') as HTMLSelectElement;
  }
}
