// Stores captured calls per tab in chrome.storage.session (survives worker restarts).
const MAX_PER_TAB = 300;
const key = (tabId) => `tab_${tabId}`;

// Serialize writes so concurrent messages don't overwrite each other.
let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn).catch(() => {}));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.kind === "apiLens:entry" && sender.tab) {
    const tabId = sender.tab.id;
    enqueue(async () => {
      const k = key(tabId);
      const list = (await chrome.storage.session.get(k))[k] || [];
      list.push(msg.entry);
      if (list.length > MAX_PER_TAB) list.splice(0, list.length - MAX_PER_TAB);
      await chrome.storage.session.set({ [k]: list });
      chrome.action.setBadgeText({ tabId, text: String(list.length) });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#4f46e5" });
    });
  } else if (msg.kind === "apiLens:clear") {
    enqueue(async () => {
      await chrome.storage.session.remove(key(msg.tabId));
      chrome.action.setBadgeText({ tabId: msg.tabId, text: "" });
    }).then(() => sendResponse(true));
    return true;
  }
});

// Clear the log when a tab navigates to a new page (not on SPA route changes).
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading" && info.url) {
    enqueue(() => chrome.storage.session.remove(key(tabId)));
    chrome.action.setBadgeText({ tabId, text: "" });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => enqueue(() => chrome.storage.session.remove(key(tabId))));

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.session.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
});
