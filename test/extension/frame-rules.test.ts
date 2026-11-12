import { beforeEach, describe, expect, it } from 'vitest';
import { FrameRules, type SessionRules } from '../../src/extension/frame-rules';

type Rule = chrome.declarativeNetRequest.Rule;

/** In-memory stand-in for Chrome's session rules, enforcing the same id constraints Chrome does. */
class FakeSessionRules implements SessionRules {
  rules: Rule[] = [];

  async getSessionRules(): Promise<Rule[]> {
    return [...this.rules];
  }

  async updateSessionRules({
    removeRuleIds = [],
    addRules = [],
  }: {
    removeRuleIds?: number[];
    addRules?: Rule[];
  }) {
    for (const id of [...removeRuleIds, ...addRules.map((rule) => rule.id)]) {
      if (!Number.isInteger(id) || id < 1 || id > 2 ** 31 - 1) throw new Error(`Invalid rule id ${id}`);
    }
    const kept = this.rules.filter((rule) => !removeRuleIds.includes(rule.id));
    for (const rule of addRules) {
      if (kept.some((existing) => existing.id === rule.id)) throw new Error(`Duplicate rule id ${rule.id}`);
      kept.push(rule);
    }
    this.rules = kept;
  }

  tabsWithRules(): number[] {
    return this.rules.flatMap((rule) => rule.condition.tabIds ?? []);
  }
}

const HUGE_TAB_ID = 1_900_000_001; // Tab ids like this broke rule ids derived from them.

describe('FrameRules', () => {
  let sessionRules: FakeSessionRules;
  let frameRules: FrameRules;

  beforeEach(() => {
    sessionRules = new FakeSessionRules();
    frameRules = new FrameRules(sessionRules, 'extensionid');
  });

  it('adds a framing rule and a YouTube referer rule scoped to the tab', async () => {
    await frameRules.allowPlatformsIn(HUGE_TAB_ID);

    expect(sessionRules.tabsWithRules()).toEqual([HUGE_TAB_ID, HUGE_TAB_ID]);
    expect(sessionRules.rules[0]?.action.responseHeaders?.[0]?.header).toBe('x-frame-options');
    expect(sessionRules.rules[1]?.action.requestHeaders?.[0]?.value).toBe(
      'https://extensionid.chromiumapp.org/',
    );
  });

  it('replaces its rules when the same tab asks again', async () => {
    await frameRules.allowPlatformsIn(HUGE_TAB_ID);
    await frameRules.allowPlatformsIn(HUGE_TAB_ID);

    expect(sessionRules.rules).toHaveLength(2);
  });

  it('keeps other tabs’ rules apart', async () => {
    await frameRules.allowPlatformsIn(1);
    await frameRules.allowPlatformsIn(2);
    await frameRules.removeFor(1);

    expect(sessionRules.tabsWithRules()).toEqual([2, 2]);
  });
});
