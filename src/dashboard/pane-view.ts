import type { Pane, SplitPane } from '../domain/layout';
import { isPlatform, PLATFORM_LABELS, type Platform } from '../domain/platform';
import { moveFrameInto, type FrameRegistry, type SlotId } from './frames';

export interface PaneActions {
  swap(a: Platform, b: Platform): void;
  /** What the split's shares would be with this divider moved; used while dragging. */
  previewResize(split: SplitPane, dividerIndex: number, delta: number): readonly number[];
  resize(split: SplitPane, dividerIndex: number, delta: number): void;
  reloadChat(platform: Platform): void;
}

const DRAG_TYPE = 'application/x-multichat-platform';

/** Draws the pane tree into `host`, moving the existing frames into their new places. */
export function renderPanes(
  host: HTMLElement,
  tree: Pane | undefined,
  frames: FrameRegistry,
  actions: PaneActions,
): void {
  const slots = new Map<SlotId, HTMLElement>();
  const root = tree ? buildPane(tree, slots, actions) : emptyState();

  // Attach the new tree next to the old one first: frames can only move without reloading between
  // two places that are both in the document.
  host.append(root);
  for (const [slot, placeholder] of slots) moveFrameInto(placeholder, frames.element(slot));
  for (const old of [...host.children]) if (old !== root) old.remove();
  frames.retainOnly(new Set(slots.keys()));
}

export function slotsOf(tree: Pane | undefined): SlotId[] {
  if (!tree) return [];
  if (tree.kind === 'stage') return ['stage'];
  if (tree.kind === 'chat') return [`chat:${tree.platform}`];
  return tree.children.flatMap(slotsOf);
}

function buildPane(pane: Pane, slots: Map<SlotId, HTMLElement>, actions: PaneActions): HTMLElement {
  switch (pane.kind) {
    case 'stage':
      return buildLeaf('stage', slots);
    case 'chat':
      return buildChat(pane.platform, slots, actions);
    case 'split':
      return buildSplit(pane, slots, actions);
  }
}

function buildLeaf(slot: SlotId, slots: Map<SlotId, HTMLElement>): HTMLElement {
  const element = document.createElement('div');
  element.className = 'pane';
  slots.set(slot, element);
  return element;
}

function buildChat(platform: Platform, slots: Map<SlotId, HTMLElement>, actions: PaneActions): HTMLElement {
  const header = document.createElement('div');
  header.className = 'chat-header';
  header.draggable = true;
  header.title = 'Drag onto another chat to swap places';

  const grip = document.createElement('span');
  grip.className = 'grip';
  grip.textContent = '⠿';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = '↻';
  reload.title = `Reload ${PLATFORM_LABELS[platform]} chat`;
  reload.addEventListener('click', () => actions.reloadChat(platform));
  header.append(grip, PLATFORM_LABELS[platform], reload);

  const pane = buildLeaf(`chat:${platform}`, slots);
  pane.prepend(header);
  makeSwappable(pane, header, platform, actions);
  return pane;
}

function makeSwappable(
  pane: HTMLElement,
  handle: HTMLElement,
  platform: Platform,
  actions: PaneActions,
): void {
  handle.addEventListener('dragstart', (event) => {
    event.dataTransfer?.setData(DRAG_TYPE, platform);
    document.body.classList.add('dragging');
  });
  handle.addEventListener('dragend', () => document.body.classList.remove('dragging'));

  const accepts = (event: DragEvent) => event.dataTransfer?.types.includes(DRAG_TYPE) ?? false;
  pane.addEventListener('dragover', (event) => {
    if (!accepts(event)) return;
    event.preventDefault();
    pane.classList.add('drop-target');
  });
  pane.addEventListener('dragleave', () => pane.classList.remove('drop-target'));
  pane.addEventListener('drop', (event) => {
    pane.classList.remove('drop-target');
    document.body.classList.remove('dragging');
    const from = event.dataTransfer?.getData(DRAG_TYPE);
    if (!isPlatform(from) || from === platform) return;
    event.preventDefault();
    actions.swap(from, platform);
  });
}

function buildSplit(split: SplitPane, slots: Map<SlotId, HTMLElement>, actions: PaneActions): HTMLElement {
  const element = document.createElement('div');
  element.className = `split ${split.direction}`;

  const children = split.children.map((child) => buildPane(child, slots, actions));
  applyWeights(children, split.weights);
  children.forEach((child, index) => {
    if (index > 0) element.append(buildDivider(element, children, split, index - 1, actions));
    element.append(child);
  });
  return element;
}

function applyWeights(children: readonly HTMLElement[], weights: readonly number[]): void {
  children.forEach((child, index) => {
    child.style.flex = `${weights[index] ?? 1} 1 0`;
  });
}

function buildDivider(
  splitElement: HTMLElement,
  children: readonly HTMLElement[],
  split: SplitPane,
  dividerIndex: number,
  actions: PaneActions,
): HTMLElement {
  const divider = document.createElement('div');
  divider.className = 'divider';
  const along = (event: PointerEvent) => (split.direction === 'row' ? event.clientX : event.clientY);

  divider.addEventListener('pointerdown', (start) => {
    const rect = splitElement.getBoundingClientRect();
    const length = split.direction === 'row' ? rect.width : rect.height;
    const startPosition = along(start);
    let delta = 0;

    const drag = new AbortController();

    divider.setPointerCapture(start.pointerId);
    divider.classList.add('active');
    document.body.classList.add('dragging');

    const move = (event: PointerEvent) => {
      delta = (along(event) - startPosition) / length;
      applyWeights(children, actions.previewResize(split, dividerIndex, delta));
    };
    const end = () => {
      drag.abort();
      divider.classList.remove('active');
      document.body.classList.remove('dragging');
      if (delta !== 0) actions.resize(split, dividerIndex, delta);
    };
    divider.addEventListener('pointermove', move, { signal: drag.signal });
    divider.addEventListener('pointerup', end, { signal: drag.signal });
    divider.addEventListener('pointercancel', end, { signal: drag.signal });
  });
  return divider;
}

function emptyState(): HTMLElement {
  const element = document.createElement('p');
  element.className = 'empty-state';
  element.textContent = 'Add a streamer with "New" to get started.';
  return element;
}
