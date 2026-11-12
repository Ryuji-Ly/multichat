// Network rules that let the platforms load inside a dashboard tab. They only apply to frames inside
// that tab (condition.tabIds), never to normal browsing, and are removed when the tab closes.
//
// 1. Twitch, YouTube and TikTok refuse to be framed with `X-Frame-Options: SAMEORIGIN`. None of them uses
//    CSP frame-ancestors (checked 2026-11-12), so removing that one header is enough; their other
//    security headers stay untouched.
// 2. YouTube's embed player shows "Error 153" without a Referer and "Error 152-4" with a youtube.com one
//    (2026-11-12). It plays with the extension's own https identity, the chromiumapp.org origin.
//
// Rule ids are allocated, not derived from the tab id: ids must fit in 32 bits and tab ids can be huge.

type Rule = chrome.declarativeNetRequest.Rule;

/** The slice of chrome.declarativeNetRequest this module uses. */
export interface SessionRules {
  getSessionRules(): Promise<Rule[]>;
  updateSessionRules(options: { removeRuleIds?: number[]; addRules?: Rule[] }): Promise<void>;
}

const FRAMED_DOMAINS = ['tiktok.com', 'twitch.tv', 'youtube.com'];

export class FrameRules {
  constructor(
    private readonly sessionRules: SessionRules,
    private readonly extensionId: string,
  ) {}

  /** Replaces any earlier rules for this tab, so reloading the dashboard is safe. */
  async allowPlatformsIn(tabId: number): Promise<void> {
    const existing = await this.sessionRules.getSessionRules();
    const firstFreeId = Math.max(0, ...existing.map((rule) => rule.id)) + 1;

    await this.sessionRules.updateSessionRules({
      removeRuleIds: ruleIdsFor(existing, tabId),
      addRules: [
        {
          id: firstFreeId,
          priority: 1,
          action: {
            type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
            responseHeaders: [
              {
                header: 'x-frame-options',
                operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation,
              },
            ],
          },
          condition: {
            tabIds: [tabId],
            requestDomains: FRAMED_DOMAINS,
            resourceTypes: ['sub_frame' as chrome.declarativeNetRequest.ResourceType],
          },
        },
        {
          id: firstFreeId + 1,
          priority: 1,
          action: {
            type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
            requestHeaders: [
              {
                header: 'referer',
                operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
                value: `https://${this.extensionId}.chromiumapp.org/`,
              },
            ],
          },
          condition: {
            tabIds: [tabId],
            urlFilter: '||www.youtube.com/embed/',
            resourceTypes: ['sub_frame' as chrome.declarativeNetRequest.ResourceType],
          },
        },
      ],
    });
  }

  async removeFor(tabId: number): Promise<void> {
    const existing = await this.sessionRules.getSessionRules();
    await this.sessionRules.updateSessionRules({ removeRuleIds: ruleIdsFor(existing, tabId) });
  }
}

function ruleIdsFor(rules: readonly Rule[], tabId: number): number[] {
  return rules.filter((rule) => rule.condition.tabIds?.includes(tabId)).map((rule) => rule.id);
}
