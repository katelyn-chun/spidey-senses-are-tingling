const DEFAULT_SETTINGS = { enabled: true, threshold: 0.8 };

function isValidSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return false;
  const keys = Object.keys(settings);
  if (keys.length !== 2 || !keys.includes('enabled') || !keys.includes('threshold')) return false;
  return typeof settings.enabled === 'boolean'
    && typeof settings.threshold === 'number'
    && Number.isFinite(settings.threshold)
    && settings.threshold >= 0
    && settings.threshold <= 1;
}

function isExactMessage(message, type) {
  return message && message.type === type && Object.keys(message).length === 1;
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  await chrome.storage.local.set({ ...DEFAULT_SETTINGS, ...settings });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return;

  if (message.type === 'get-settings') {
    chrome.storage.local.get(DEFAULT_SETTINGS).then(sendResponse);
    return true;
  }

  if (message.type === 'update-settings' && isValidSettings(message.settings)) {
    chrome.storage.local.set(message.settings).then(() => sendResponse({ accepted: true }));
    return true;
  }

  if (isExactMessage(message, 'report-false-positive') && sender.tab?.id) {
    sendResponse({ accepted: true });
  }
});
