import { LAYOUT_PRESET_LABELS, LAYOUT_PRESETS, type Layout, type LayoutPreset } from '../domain/layout';
import { isPlatform, PLATFORM_LABELS, type Platform } from '../domain/platform';
import type { ProfileBook } from '../domain/profile-book';

export interface ToolbarActions {
  selectProfile(id: string): void;
  newProfile(): void;
  editProfile(): void;
  choosePreset(preset: LayoutPreset): void;
  chooseMain(platform: Platform | undefined): void;
}

const NO_MAIN = '';

export class Toolbar {
  private readonly profileSelect = byId<HTMLSelectElement>('profile-select');
  private readonly editButton = byId<HTMLButtonElement>('edit-profile');
  private readonly presetSelect = byId<HTMLSelectElement>('preset-select');
  private readonly mainSelect = byId<HTMLSelectElement>('main-select');
  private readonly messages = byId<HTMLElement>('messages');

  constructor(actions: ToolbarActions) {
    this.profileSelect.addEventListener('change', () => actions.selectProfile(this.profileSelect.value));
    byId('new-profile').addEventListener('click', () => actions.newProfile());
    this.editButton.addEventListener('click', () => actions.editProfile());
    this.presetSelect.addEventListener('change', () =>
      actions.choosePreset(this.presetSelect.value as LayoutPreset),
    );
    this.mainSelect.addEventListener('change', () => {
      const value = this.mainSelect.value;
      actions.chooseMain(isPlatform(value) ? value : undefined);
    });
  }

  render(book: ProfileBook, layout: Layout): void {
    const active = book.active();

    this.profileSelect.replaceChildren(...book.profiles().map((profile) => option(profile.id, profile.name)));
    this.profileSelect.value = active?.id ?? '';
    this.profileSelect.disabled = !active;
    this.editButton.disabled = !active;

    this.presetSelect.replaceChildren(
      ...LAYOUT_PRESETS.map((preset) => option(preset, LAYOUT_PRESET_LABELS[preset])),
    );
    this.presetSelect.value = layout.preset;

    const platforms = active?.platforms() ?? [];
    this.mainSelect.replaceChildren(
      option(NO_MAIN, 'None (chats only)'),
      ...platforms.map((platform) => option(platform, PLATFORM_LABELS[platform])),
    );
    this.mainSelect.value = active?.main ?? NO_MAIN;
    this.mainSelect.disabled = !active;
  }

  showError(message: string): void {
    this.messages.textContent = message;
  }

  clearError(): void {
    this.messages.textContent = '';
  }
}

export function option(value: string, label: string): HTMLOptionElement {
  const element = document.createElement('option');
  element.value = value;
  element.textContent = label;
  return element;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`The dashboard page is missing #${id}.`);
  return element as T;
}
