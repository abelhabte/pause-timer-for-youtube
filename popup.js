// This is the main script for the extension popup.

// Function to send a message to the content script in the active tab.
async function sendMessageToContentScript(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url.startsWith("https://www.youtube.com/")) {
    return chrome.tabs.sendMessage(tab.id, message);
  } else {
    console.error("This extension only works on YouTube.com pages.");
    return { status: "error", message: "Not a YouTube page." };
  }
}

// Immediately trigger the panel to appear on page load.
document.addEventListener("DOMContentLoaded", async () => {
  await sendMessageToContentScript({ action: "togglePanel" });
  // The popup will close automatically after sending the message.
  window.close();
});
