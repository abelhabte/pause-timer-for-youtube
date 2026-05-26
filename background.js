chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.url?.match(/https:\/\/(www|music)\.youtube\.com\/.*/)) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
  } catch (err) {
    console.log("Content script not detected. Injecting scripts manually...");

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

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