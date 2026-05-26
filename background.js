chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.url?.match(/https:\/\/(www|music)\.youtube\.com\/.*/)) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
    } catch (err) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
      }, 100); 
    }
  }
});