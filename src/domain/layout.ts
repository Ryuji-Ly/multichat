import { PLATFORMS, type Platform } from './platform';

/**
 * How the chats are arranged next to the main stream:
 * - columns:        every chat in its own column
 * - main-and-stack: the first chat is a tall column, the others share a column on top of each other
 * - stack:          all chats on top of each other in one column
 */
export const LAYOUT_PRESETS = ['columns', 'main-and-stack', 'stack'] as const;
export type LayoutPreset = (typeof LAYOUT_PRESETS)[number];

export const LAYOUT_PRESET_LABELS: Readonly<Record<LayoutPreset, string>> = {
  columns: 'Side by side',
  'main-and-stack': 'One big, others stacked',
  stack: 'All stacked',
};

/** What the dashboard draws: the main stream, chats, and splits between them. */
export type Pane = StagePane | ChatPane | SplitPane;

export interface StagePane {
  readonly kind: 'stage';
}

export interface ChatPane {
  readonly kind: 'chat';
  readonly platform: Platform;
}

export interface SplitPane {
  readonly kind: 'split';
  /** Identifies this split's saved sizes; differs per preset and number of chats. */
  readonly key: string;
  /** `row` puts children side by side, `column` on top of each other. */
  readonly direction: 'row' | 'column';
  readonly children: readonly Pane[];
  /** Share of the split each child gets; sums to 1. */
  readonly weights: readonly number[];
}

export class InvalidLayoutError extends Error {
  override name = 'InvalidLayoutError';
}

/** No pane can be dragged smaller than this share of its split. */
export const MIN_PANE_SHARE = 0.1;

/** Main stream share when one column of chats sits beside it; more columns take more room. */
const STAGE_WEIGHT_PER_CHAT_COLUMN = 4;

export interface LayoutSnapshot {
  readonly preset: LayoutPreset;
  readonly order: readonly Platform[];
  readonly sizes: Readonly<Record<string, readonly number[]>>;
}

/** The person's chosen arrangement. Immutable: every change returns a new Layout. */
export class Layout {
  private constructor(
    readonly preset: LayoutPreset,
    /** All platforms, in the order their chats fill the slots. */
    readonly order: readonly Platform[],
    private readonly sizes: ReadonlyMap<string, readonly number[]>,
  ) {}

  static default(): Layout {
    return new Layout('columns', PLATFORMS, new Map());
  }

  static restore(snapshot: LayoutSnapshot): Layout {
    if (!LAYOUT_PRESETS.includes(snapshot.preset)) {
      throw new InvalidLayoutError(`Unknown layout preset "${snapshot.preset}".`);
    }
    const isPermutation =
      snapshot.order.length === PLATFORMS.length && PLATFORMS.every((p) => snapshot.order.includes(p));
    if (!isPermutation) throw new InvalidLayoutError(`Chat order must list each platform once.`);

    const sizes = new Map<string, readonly number[]>();
    for (const [key, weights] of Object.entries(snapshot.sizes)) {
      sizes.set(key, normalize(weights));
    }
    return new Layout(snapshot.preset, [...snapshot.order], sizes);
  }

  snapshot(): LayoutSnapshot {
    return { preset: this.preset, order: [...this.order], sizes: Object.fromEntries(this.sizes) };
  }

  withPreset(preset: LayoutPreset): Layout {
    return new Layout(preset, this.order, this.sizes);
  }

  /** Swaps the slots of two chats. */
  swap(a: Platform, b: Platform): Layout {
    const order = this.order.map((platform) => (platform === a ? b : platform === b ? a : platform));
    return new Layout(this.preset, order, this.sizes);
  }

  /**
   * Moves the divider after child `dividerIndex` of `split` by `delta`, a share of the split's length
   * (positive = towards the end). Clamped so neither neighbour drops below MIN_PANE_SHARE.
   */
  resize(split: SplitPane, dividerIndex: number, delta: number): Layout {
    const weights = [...split.weights];
    const before = weights[dividerIndex];
    const after = weights[dividerIndex + 1];
    if (before === undefined || after === undefined) {
      throw new InvalidLayoutError(`Split ${split.key} has no divider ${dividerIndex}.`);
    }
    const pair = before + after;
    const newBefore = Math.min(Math.max(before + delta, MIN_PANE_SHARE), pair - MIN_PANE_SHARE);
    weights[dividerIndex] = newBefore;
    weights[dividerIndex + 1] = pair - newBefore;

    const sizes = new Map(this.sizes);
    sizes.set(split.key, weights);
    return new Layout(this.preset, this.order, sizes);
  }

  /** Builds what to draw for the chats that have a channel, with or without a main stream. */
  arrange(visibleChats: readonly Platform[], withStage: boolean): Pane | undefined {
    const chats = this.order.filter((platform) => visibleChats.includes(platform));
    const chatTree = this.arrangeChats(chats);
    if (!withStage) return chatTree;
    if (!chatTree) return { kind: 'stage' };

    return this.split(`stage/${this.preset}/${chats.length}`, 'row', [{ kind: 'stage' }, chatTree], () => [
      STAGE_WEIGHT_PER_CHAT_COLUMN,
      this.chatColumnCount(chats.length),
    ]);
  }

  private arrangeChats(chats: readonly Platform[]): Pane | undefined {
    const panes: ChatPane[] = chats.map((platform) => ({ kind: 'chat', platform }));
    const [first, ...rest] = panes;
    if (!first) return undefined;
    if (rest.length === 0) return first;

    const key = (name: string) => `${name}/${this.preset}/${panes.length}`;
    switch (this.preset) {
      case 'columns':
        return this.split(key('chats'), 'row', panes);
      case 'stack':
        return this.split(key('chats'), 'column', panes);
      case 'main-and-stack': {
        const side = rest.length === 1 ? rest[0]! : this.split(key('side'), 'column', rest);
        return this.split(key('chats'), 'row', [first, side]);
      }
    }
  }

  private chatColumnCount(chatCount: number): number {
    switch (this.preset) {
      case 'columns':
        return chatCount;
      case 'main-and-stack':
        return Math.min(chatCount, 2);
      case 'stack':
        return 1;
    }
  }

  private split(
    key: string,
    direction: SplitPane['direction'],
    children: readonly Pane[],
    defaultWeights: () => number[] = () => children.map(() => 1),
  ): SplitPane {
    const saved = this.sizes.get(key);
    const weights = saved?.length === children.length ? saved : normalize(defaultWeights());
    return { kind: 'split', key, direction, children, weights };
  }
}

function normalize(weights: readonly number[]): number[] {
  if (weights.length === 0 || weights.some((w) => !Number.isFinite(w) || w <= 0)) {
    throw new InvalidLayoutError(`Pane sizes must be positive numbers, got [${weights.join(', ')}].`);
  }
  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((w) => w / total);
}
