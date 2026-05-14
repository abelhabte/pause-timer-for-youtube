chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.url?.match(/https:\/\/(www|music)\.youtube\.com\/.*/)) {
    try {
      // 1. Try sending the message first
      await chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
    } catch (err) {
      // 2. If it fails, the script isn't there. Inject it manually!
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      
      // 3. Now that it's injected, send the message again
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
      }, 100); 
    }
  }
});