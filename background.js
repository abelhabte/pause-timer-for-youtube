// background.js
chrome.action.onClicked.addListener((tab) => {
  // Check if tab and tab.url exist before calling startsWith
  if (
    tab?.url?.startsWith("https://www.youtube.com/") ||
    tab?.url?.startsWith("https://music.youtube.com/")
  ) {
    chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
  }
});
