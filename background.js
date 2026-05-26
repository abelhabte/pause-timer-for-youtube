chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.url?.match(/https:\/\/(www|music)\.youtube\.com\/.*/)) return;

  try {
    // Attempt to ping the tab to see if content.js is already alive and listening
    await chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
  } catch (err) {
    console.log("Content script not detected. Injecting scripts manually...");

    try {
      // 1. First inject the isolated layout CSS
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["panel.css"]
      });

      // 2. Next, execute the structural content script logic
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      // 3. Give the runtime context an absolute split-second to mount, then send the action
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
        } catch (msgErr) {
          console.error("Failed to trigger panel after execution:", msgErr);
        }
      }, 150);

    } catch (injectionErr) {
      console.error("Script injection failed completely:", injectionErr);
    }
  }
});