// This content script runs on YouTube pages.
// It listens for messages from the popup and controls the video playback.
// It also injects and manages a persistent UI panel.

/** @type {number | null} */
let pauseIntervalId = null;
const panelId = "youtube-pause-extension-panel";

// --- HELPER FUNCTIONS FOR TIMESTAMP/PERCENTAGE LOGIC ---

/**
 * Checks if a string is in h:m:s or m:s format.
 * @param {string} input
 * @returns {boolean}
 */
function isValidHMSFormat(input) {
  // Corrected regex to properly validate h:m:s or m:s format.
  const hmsRegex = /^(\d+:\d{2}:\d{2}|\d{1,2}:\d{2})$/;
  return hmsRegex.test(input);
}

/**
 * Turns a timestamp string into an array of numbers [hours, minutes, seconds].
 * @param {string} timestamp
 * @returns {number[]}
 */
function timestampToArray(timestamp) {
  const parts = timestamp.split(":").map(Number);
  // Prepend zeros to ensure [hours, minutes, seconds]
  while (parts.length < 3) {
    parts.unshift(0);
  }
  return parts;
}

/**
 * Turns an array of numbers into a timestamp string.
 * @param {number[]} timeArray
 * @returns {string}
 */
function arrayToTimestamp(timeArray) {
  while (timeArray.length < 3) {
    timeArray.unshift(0);
  }
  const [hours, minutes, seconds] = timeArray;

  // Conditionally format the timestamp.
  let formattedTime = "";
  if (hours > 0) {
    formattedTime = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    // Only show minutes and seconds if the video is less than 1 hour.
    formattedTime = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  return formattedTime;
}

/**
 * Returns a timestamp string for a percentage of a total duration.
 * @param {number} totalSeconds
 * @param {number} n
 * @returns {string}
 */
function percentageOfTimestamp(totalSeconds, n) {
  if (n < 0 || n > 100) {
    return "number not valid";
  }
  const dividedSeconds = totalSeconds * (n / 100);
  const newHours = Math.floor(dividedSeconds / 3600);
  const remainderAfterHours = dividedSeconds % 3600;
  const newMinutes = Math.floor(remainderAfterHours / 60);
  const newSeconds = Math.round(remainderAfterHours % 60);
  return arrayToTimestamp([newHours, newMinutes, newSeconds]);
}

// --- VIDEO PLAYER AND UI LOGIC ---

/**
 * Finds the main YouTube video element on the page.
 * @returns {HTMLVideoElement | null} The video element or null if not found.
 */
function findVideo() {
  return document.querySelector('video');
}

/**
 * Stops any existing pause timer.
 */
function stopPauseTimer() {
  if (pauseIntervalId !== null) {
    clearInterval(pauseIntervalId);
    pauseIntervalId = null;
    console.log("Existing pause timer stopped.");
  }
}

/**
 * Starts a new pause timer to check for the target time.
 * @param {number} targetTime The time in seconds to pause the video.
 */
function startPauseTimer(targetTime) {
  stopPauseTimer(); // Always clear any previous timers first.
  const video = findVideo();
  if (!video) {
    console.error("No video element found to set a timer.");
    return;
  }

  console.log(`Setting timer to pause at ${targetTime} seconds.`);

  // Set an interval to check the video time every 250ms.
  pauseIntervalId = setInterval(() => {
    // We check if currentTime is greater than or equal to the targetTime
    // to handle cases where the video might skip past the exact timestamp.
    if (video.currentTime >= targetTime) {
      video.pause();
      stopPauseTimer();
      console.log(`Video paused at ${video.currentTime} seconds.`);
    }
  }, 250); // Check every quarter of a second.
}

/**
 * Injects the floating UI panel into the page.
 */
function injectPanel() {
  if (document.getElementById(panelId)) {
    console.log("Panel already exists, not injecting again.");
    return;
  }

  const panel = document.createElement("div");
  panel.id = panelId;
  panel.innerHTML = `
    <style>
      :root {
        --panel-bg: #fff;
        --panel-text: #000;
        --panel-border: #ccc;
        --input-bg: #f9f9f9;
        --input-border: #ddd;
        --button-text: #fff;
        --blue-btn-bg: #007bff;
        --green-btn-bg: #28a745;
        --red-btn-bg: #dc3545;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --panel-bg: #333;
          --panel-text: #eee;
          --panel-border: #555;
          --input-bg: #444;
          --input-border: #666;
          --button-text: #fff;
          --blue-btn-bg: #0d6efd;
          --green-btn-bg: #198754;
          --red-btn-bg: #dc3545;
        }
      }

      #panel-controls {
        padding: 10px;
        background: var(--panel-bg);
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        font-family: sans-serif;
        display: flex;
        flex-direction: column;
        gap: 10px;
        border: 1px solid var(--panel-border);
        color: var(--panel-text);
      }

      #panel-controls input[type="text"],
      #panel-controls input[type="number"] {
        padding: 5px;
        border: 1px solid var(--input-border);
        border-radius: 4px;
        background: var(--input-bg);
        color: var(--panel-text);
      }

      #panel-controls button {
        padding: 8px 12px;
        color: var(--button-text);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }

      #chosenTimestamp { background: var(--blue-btn-bg); }
      #partitionOfVideoLength { background: var(--green-btn-bg); }
      #closePanel { background: var(--red-btn-bg); }
    </style>
    <div id="panel-controls">
        <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="timestampInput" style="font-size: 12px;">Pause at Timestamp</label>
            <input type="text" id="timestampInput" placeholder="h:m:s or m:s">
            <button id="chosenTimestamp">Set Timestamp</button>
        </div>
        <div class="scale-container" style="display: flex; flex-direction: column; gap: 5px;">
            <label for="scaleSlider" style="font-size: 12px;">Pause at Percentage</label>
            <input type="range" id="scaleSlider" min="0" max="100" value="100">
            <input type="number" id="scaleValue" min="0" max="100" value="100">
            <button id="partitionOfVideoLength">Set Percentage</button>
        </div>
        <button id="closePanel">Close Panel</button>
    </div>
  `;
  // Style the panel to float on the page.
  panel.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 9999;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

  document.body.appendChild(panel);

  // Re-attach event listeners to the new elements inside the panel.
  attachPanelListeners();
}

/**
 * Attaches all event listeners to the elements within the injected panel.
 */
function attachPanelListeners() {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const timestampInput = panel.querySelector("#timestampInput");
  const chosenTimestampBtn = panel.querySelector("#chosenTimestamp");
  const scaleSlider = panel.querySelector("#scaleSlider");
  const scaleValueInput = panel.querySelector("#scaleValue");
  const partitionBtn = panel.querySelector("#partitionOfVideoLength");
  const closeBtn = panel.querySelector("#closePanel");

  // Sync slider and number input
  if (scaleSlider && scaleValueInput) {
    scaleSlider.addEventListener("input", () => {
      scaleValueInput.value = scaleSlider.value;
    });
    scaleValueInput.addEventListener("input", () => {
      scaleSlider.value = scaleValueInput.value;
    });
  }

  // Handle timestamp button click
  if (chosenTimestampBtn) {
    chosenTimestampBtn.addEventListener("click", () => {
      const timestamp = timestampInput.value;
      if (!isValidHMSFormat(timestamp)) {
        console.error("Invalid timestamp format. Please use h:m:s or m:s.");
        return;
      }
      const parts = timestampToArray(timestamp);
      const totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      startPauseTimer(totalSeconds);
    });
  }

  // Handle percentage button click
  if (partitionBtn) {
    partitionBtn.addEventListener("click", async () => {
      const percentage = parseFloat(scaleValueInput.value);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        console.error("Invalid percentage value.");
        return;
      }
      const video = findVideo();
      if (video) {
        const seekTime = video.duration * (percentage / 100);
        startPauseTimer(seekTime);
      }
    });
  }

  // Handle close button click
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      panel.remove();
      // Also save the state to local storage so it doesn't reappear on refresh.
      chrome.storage.local.set({ isPanelVisible: false });
    });
  }

  // Set the default value of the timestamp input to the video's duration
  const video = findVideo();
  if (video) {
    const totalSeconds = video.duration;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.round(totalSeconds % 60);
    const formattedTime = arrayToTimestamp([hours, minutes, seconds]);
    timestampInput.value = formattedTime;
  }
}

// Check if the panel was previously visible and re-inject it on page load
chrome.storage.local.get(["isPanelVisible"], (result) => {
  if (result.isPanelVisible) {
    injectPanel();
  }
});

// --- MESSAGE LISTENER FOR POPUP/PANEL COMMUNICATION ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "togglePanel") {
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.remove();
      chrome.storage.local.set({ isPanelVisible: false });
    } else {
      injectPanel();
      chrome.storage.local.set({ isPanelVisible: true });
    }
  }
});
