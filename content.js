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

  let formattedTime = "";
  if (hours > 0) {
    formattedTime = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    formattedTime = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  return formattedTime;
}

// --- VIDEO PLAYER AND UI LOGIC ---

function findVideo() {
  return document.querySelector('video');
}

/**
 * Stops any existing pause timer (both video-based and real-time).
 */
function stopPauseTimer() {
  if (pauseIntervalId !== null) {
    clearInterval(pauseIntervalId);
    pauseIntervalId = null;
    console.log("Existing pause timer stopped.");
  }
}

/**
 * Starts a timer to pause at a specific video timestamp.
 */
function startPauseTimer(targetTime) {
  stopPauseTimer(); 
  const video = findVideo();
  if (!video) return;

  console.log(`Setting timer to pause at video timestamp: ${targetTime}s`);
  pauseIntervalId = setInterval(() => {
    if (video.currentTime >= targetTime) {
      video.pause();
      stopPauseTimer();
    }
  }, 250);
}

/**
 * NEW: Starts a timer to pause at a specific real-world wall-clock time.
 * @param {string} timeStr Format "HH:mm" (24h)
 */
function startRealTimeTimer(timeStr) {
  stopPauseTimer();
  const [hours, minutes] = timeStr.split(":").map(Number);
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // If the chosen time has already passed today, set it for tomorrow.
  if (target < new Date()) {
    target.setDate(target.getDate() + 1);
  }

  console.log(`Setting real-time pause for: ${target.toLocaleTimeString()}`);

  pauseIntervalId = setInterval(() => {
    if (new Date() >= target) {
      const video = findVideo();
      if (video) {
        video.pause();
        console.log("Video paused at scheduled wall-clock time.");
      }
      stopPauseTimer();
    }
  }, 1000); // Check every second
}

function injectPanel() {
  if (document.getElementById(panelId)) return;

  const panel = document.createElement("div");
  panel.id = panelId;
  panel.innerHTML = `
    <style>
      :root {
        --panel-bg: #fff; --panel-text: #000; --panel-border: #ccc;
        --input-bg: #f9f9f9; --input-border: #ddd; --button-text: #fff;
        --blue-btn-bg: #007bff; --green-btn-bg: #28a745; --red-btn-bg: #dc3545;
        --orange-btn-bg: #fd7e14;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --panel-bg: #333; --panel-text: #eee; --panel-border: #555;
          --input-bg: #444; --input-border: #666;
          --blue-btn-bg: #0d6efd; --green-btn-bg: #198754;
        }
      }
      #panel-controls {
        padding: 12px; background: var(--panel-bg); border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2); font-family: sans-serif;
        display: flex; flex-direction: column; gap: 15px;
        border: 1px solid var(--panel-border); color: var(--panel-text);
        width: 200px; /* Increased width to accommodate horizontal layout */
      }
      .input-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .horizontal-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      #panel-controls input {
        padding: 6px; border: 1px solid var(--input-border);
        border-radius: 4px; background: var(--input-bg); color: var(--panel-text);
        flex: 1; /* Makes input take up remaining space */
        min-width: 0; /* Prevents overflow in flexbox */
      }
      #panel-controls button {
        padding: 6px 10px; color: var(--button-text); border: none;
        border-radius: 4px; cursor: pointer; transition: opacity 0.2s;
        font-weight: bold;
        white-space: nowrap; /* Keeps button text on one line */
      }
      #chosenTimestamp { background: var(--blue-btn-bg); }
      #partitionOfVideoLength { background: var(--green-btn-bg); }
      #setRealTime { background: var(--orange-btn-bg); }
      #closePanel { background: var(--red-btn-bg); margin-top: 5px; width: 100%; }
    </style>
    <div id="panel-controls">
        <div class="input-group">
            <label style="font-size: 11px; opacity: 0.8;">Timestamp</label>
            <div class="horizontal-row">
                <input type="text" id="timestampInput" placeholder="h:m:s">
                <button id="chosenTimestamp">Set</button>
            </div>
        </div>

        <div class="input-group">
            <label style="font-size: 11px; opacity: 0.8;">Percentage</label>
            <div class="horizontal-row">
                <input type="number" id="scaleValue" min="0" max="100" value="100" style="width: 50px; flex: none;">
                
                <input type="range" id="scaleSlider" min="0" max="100" value="100" style="flex: 1;">
                
                <button id="partitionOfVideoLength">Set</button>
            </div>
        </div>

        <div class="input-group">
            <label style="font-size: 11px; opacity: 0.8;">Real-Time</label>
            <div class="horizontal-row">
                <input type="time" id="realTimeInput">
                <button id="setRealTime">Set</button>
            </div>
        </div>

        <button id="closePanel">Close Panel</button>
    </div>
  `;
  panel.style.cssText = "position: fixed; top: 10px; right: 10px; z-index: 9999;";
  document.body.appendChild(panel);
  attachPanelListeners();
}

function attachPanelListeners() {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const timestampInput = panel.querySelector("#timestampInput");
  const chosenTimestampBtn = panel.querySelector("#chosenTimestamp");
  const realTimeInput = panel.querySelector("#realTimeInput");
  const setRealTimeBtn = panel.querySelector("#setRealTime");
  const scaleSlider = panel.querySelector("#scaleSlider");
  const scaleValueInput = panel.querySelector("#scaleValue");
  const partitionBtn = panel.querySelector("#partitionOfVideoLength");
  const closeBtn = panel.querySelector("#closePanel");

  // Sync slider and number
  scaleSlider?.addEventListener("input", () => scaleValueInput.value = scaleSlider.value);
  scaleValueInput?.addEventListener("input", () => scaleSlider.value = scaleValueInput.value);

  // Video Timestamp Button
  chosenTimestampBtn?.addEventListener("click", () => {
    const timestamp = timestampInput.value;
    if (isValidHMSFormat(timestamp)) {
      const parts = timestampToArray(timestamp);
      startPauseTimer(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
  });

  // NEW: Real-World Clock Button
  setRealTimeBtn?.addEventListener("click", () => {
    const timeVal = realTimeInput.value;
    if (timeVal) startRealTimeTimer(timeVal);
  });

  // Percentage Button
  partitionBtn?.addEventListener("click", () => {
    const percentage = parseFloat(scaleValueInput.value);
    const video = findVideo();
    if (video && !isNaN(percentage)) startPauseTimer(video.duration * (percentage / 100));
  });

  closeBtn?.addEventListener("click", () => {
    panel.remove();
    chrome.storage.local.set({ isPanelVisible: false });
  });
}

chrome.storage.local.get(["isPanelVisible"], (res) => res.isPanelVisible && injectPanel());

chrome.runtime.onMessage.addListener((req) => {
  if (req.action === "togglePanel") {
    const p = document.getElementById(panelId);
    p ? (p.remove(), chrome.storage.local.set({ isPanelVisible: false })) : injectPanel();
  }
});