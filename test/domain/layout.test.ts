import { describe, expect, it } from 'vitest';
import {
  InvalidLayoutError,
  Layout,
  MIN_PANE_SHARE,
  type Pane,
  type SplitPane,
} from '../../src/domain/layout';
import type { Platform } from '../../src/domain/platform';

const ALL: Platform[] = ['twitch', 'youtube', 'tiktok'];

/** A compact picture of a pane tree: `row[stage, column[twitch, youtube]]`. */
function shape(pane: Pane | undefined): string {
  if (!pane) return 'nothing';
  if (pane.kind === 'stage') return 'stage';
  if (pane.kind === 'chat') return pane.platform;
  return `${pane.direction}[${pane.children.map(shape).join(', ')}]`;
}

function asSplit(pane: Pane | undefined): SplitPane {
  if (pane?.kind !== 'split') throw new Error(`expected a split, got ${shape(pane)}`);
  return pane;
}

describe('Layout.arrange', () => {
  it.each([
    ['columns', 'row[stage, row[twitch, youtube, tiktok]]'],
    ['main-and-stack', 'row[stage, row[twitch, column[youtube, tiktok]]]'],
    ['stack', 'row[stage, column[twitch, youtube, tiktok]]'],
  ] as const)('arranges three chats as %s', (preset, expected) => {
    expect(shape(Layout.default().withPreset(preset).arrange(ALL, true))).toBe(expected);
  });

  it('puts two chats side by side in main-and-stack', () => {
    const tree = Layout.default().withPreset('main-and-stack').arrange(['twitch', 'tiktok'], true);

    expect(shape(tree)).toBe('row[stage, row[twitch, tiktok]]');
  });

  it('shows a single chat on its own, whatever the preset', () => {
    expect(shape(Layout.default().withPreset('stack').arrange(['tiktok'], true))).toBe('row[stage, tiktok]');
  });

  it('shows only chats when there is no main stream', () => {
    expect(shape(Layout.default().arrange(['twitch', 'tiktok'], false))).toBe('row[twitch, tiktok]');
  });

  it('shows only the stage when there are no chats', () => {
    expect(shape(Layout.default().arrange([], true))).toBe('stage');
    expect(shape(Layout.default().arrange([], false))).toBe('nothing');
  });

  it('gives the main stream more room the fewer chat columns there are', () => {
    const stageShare = (preset: 'columns' | 'stack') =>
      asSplit(Layout.default().withPreset(preset).arrange(ALL, true)).weights[0]!;

    expect(stageShare('columns')).toBeCloseTo(4 / 7);
    expect(stageShare('stack')).toBeCloseTo(4 / 5);
  });

  it('splits chats evenly by default', () => {
    const chats = asSplit(asSplit(Layout.default().arrange(ALL, true)).children[1]);

    expect(chats.weights).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });
});

describe('Layout.swap', () => {
  it('swaps two chats and leaves the third in place', () => {
    const layout = Layout.default().swap('twitch', 'tiktok');

    expect(layout.order).toEqual(['tiktok', 'youtube', 'twitch']);
    expect(shape(layout.arrange(ALL, false))).toBe('row[tiktok, youtube, twitch]');
  });

  it('makes the swapped-in chat the big one in main-and-stack', () => {
    const tree = Layout.default().withPreset('main-and-stack').swap('twitch', 'youtube').arrange(ALL, false);

    expect(shape(tree)).toBe('row[youtube, column[twitch, tiktok]]');
  });

  it('leaves the original layout unchanged', () => {
    const layout = Layout.default();
    layout.swap('twitch', 'tiktok');

    expect(layout.order).toEqual(ALL);
  });
});

describe('Layout.resize', () => {
  const chatsOf = (layout: Layout) => asSplit(layout.arrange(ALL, false));

  it('moves a divider and keeps the shares summing to 1', () => {
    const layout = Layout.default();
    const resized = chatsOf(layout.resize(chatsOf(layout), 0, 0.1));

    expect(resized.weights[0]).toBeCloseTo(1 / 3 + 0.1);
    expect(resized.weights[1]).toBeCloseTo(1 / 3 - 0.1);
    expect(resized.weights[2]).toBeCloseTo(1 / 3);
  });

  it('never shrinks a pane below the minimum share', () => {
    const layout = Layout.default();
    const resized = chatsOf(layout.resize(chatsOf(layout), 0, 0.9));

    expect(resized.weights[1]).toBeCloseTo(MIN_PANE_SHARE);
    expect(resized.weights[0]).toBeCloseTo(2 / 3 - MIN_PANE_SHARE);
  });

  it('remembers sizes per preset', () => {
    const layout = Layout.default();
    const resized = layout.resize(chatsOf(layout), 0, 0.1).withPreset('stack').withPreset('columns');

    expect(chatsOf(resized).weights[0]).toBeCloseTo(1 / 3 + 0.1);
    expect(chatsOf(resized.withPreset('stack')).weights[0]).toBeCloseTo(1 / 3);
  });

  it('rejects a divider the split does not have', () => {
    const layout = Layout.default();

    expect(() => layout.resize(chatsOf(layout), 2, 0.1)).toThrow(InvalidLayoutError);
  });
});

describe('Layout snapshots', () => {
  it('round-trips preset, order and sizes', () => {
    const layout = Layout.default().withPreset('stack').swap('twitch', 'youtube');
    const resized = layout.resize(asSplit(layout.arrange(ALL, false)), 1, -0.05);

    const restored = Layout.restore(JSON.parse(JSON.stringify(resized.snapshot())));

    expect(restored.snapshot()).toEqual(resized.snapshot());
  });

  it.each([
    ['an unknown preset', { preset: 'grid', order: ALL, sizes: {} }],
    ['a missing platform', { preset: 'columns', order: ['twitch', 'twitch', 'tiktok'], sizes: {} }],
    ['a negative size', { preset: 'columns', order: ALL, sizes: { x: [1, -1] } }],
  ])('rejects %s', (_, snapshot) => {
    expect(() => Layout.restore(snapshot as never)).toThrow(InvalidLayoutError);
  });
});
