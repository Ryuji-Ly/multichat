import { FrameRules } from './frame-rules';

const DASHBOARD_PATH = 'dashboard/dashboard.html';

const frameRules = new FrameRules(chrome.declarativeNetRequest, chrome.runtime.id);

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL(DASHBOARD_PATH) });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void frameRules.removeFor(tabId);
});
