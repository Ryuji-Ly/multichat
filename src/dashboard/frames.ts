import type { Platform } from '../domain/platform';

/** A place in the dashboard that shows one embedded page: the main stream or one platform's chat. */
export type SlotId = 'stage' | `chat:${Platform}`;

export type SlotContent = { readonly url: string } | { readonly message: string };

interface Frame {
  readonly element: HTMLElement;
  shown?: SlotContent;
}

/**
 * Owns one element per slot for the dashboard's lifetime. Layout changes move these elements around
 * instead of recreating them, so the chats inside don't reload (see `moveFrameInto`).
 */
export class FrameRegistry {
  private readonly frames = new Map<SlotId, Frame>();

  element(slot: SlotId): HTMLElement {
    return this.frame(slot).element;
  }

  /** Shows a page or a message in the slot; showing the same page again does nothing. */
  show(slot: SlotId, content: SlotContent): void {
    const frame = this.frame(slot);
    if (frame.shown && sameContent(frame.shown, content)) return;
    frame.shown = content;

    if ('message' in content) {
      const message = document.createElement('p');
      message.className = 'frame-message';
      message.textContent = content.message;
      frame.element.replaceChildren(message);
      return;
    }
    const iframe = document.createElement('iframe');
    iframe.allow = 'autoplay; fullscreen; clipboard-write';
    iframe.src = content.url;
    frame.element.replaceChildren(iframe);
  }

  /** Loads the slot's page again from scratch. */
  reload(slot: SlotId): void {
    const iframe = this.frames.get(slot)?.element.querySelector('iframe');
    if (iframe) iframe.src = iframe.src;
  }

  /** Discards every slot not listed, so hidden streams stop playing. */
  retainOnly(slots: ReadonlySet<SlotId>): void {
    for (const [slot, frame] of this.frames) {
      if (slots.has(slot)) continue;
      frame.element.remove();
      this.frames.delete(slot);
    }
  }

  private frame(slot: SlotId): Frame {
    let frame = this.frames.get(slot);
    if (!frame) {
      const element = document.createElement('div');
      element.className = 'frame';
      frame = { element };
      this.frames.set(slot, frame);
    }
    return frame;
  }
}

/**
 * Moves a frame into a new container. `moveBefore` keeps an iframe's page alive across the move;
 * a plain append would reload it. Both nodes must already be in the document for that to work.
 */
export function moveFrameInto(container: HTMLElement, frame: HTMLElement): void {
  if (frame.isConnected && container.isConnected && 'moveBefore' in container) {
    container.moveBefore(frame, null);
  } else {
    container.append(frame);
  }
}

function sameContent(a: SlotContent, b: SlotContent): boolean {
  return 'url' in a && 'url' in b
    ? a.url === b.url
    : 'message' in a && 'message' in b && a.message === b.message;
}
