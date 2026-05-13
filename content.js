// This content script runs on YouTube pages.
// It listens for messages from the popup and controls the video playback.
// It also injects and manages a persistent UI panel.

/** @type {number | null} */
let pauseIntervalId = null;
const panelId = "youtube-pause-extension-panel";
const pauseUrl = chrome.runtime.getURL("icons/pause.svg");

// --- HELPER FUNCTIONS ---

/**
 * Formats seconds into a H:M:S or M:S string.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTime(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds === null) return "12:00:00";
  const secs = Math.floor(totalSeconds);
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  } else {
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
}

function isValidHMSFormat(input) {
  const hmsRegex = /^(\d+:\d{2}:\d{2}|\d{1,2}:\d{2})$/;
  return hmsRegex.test(input);
}

function timestampToArray(timestamp) {
  const parts = timestamp.split(":").map(Number);
  while (parts.length < 3) {
    parts.unshift(0);
  }
  return parts;
}

// --- VIDEO PLAYER AND TIMER LOGIC ---

function findVideo() {
  return document.querySelector("video");
}

function stopPauseTimer() {
  if (pauseIntervalId !== null) {
    clearInterval(pauseIntervalId);
    pauseIntervalId = null;
    console.log("Existing pause timer stopped.");
  }
}

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

function startRealTimeTimer(timeStr) {
  stopPauseTimer();
  const [hours, minutes] = timeStr.split(":").map(Number);
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  if (target < new Date()) {
    target.setDate(target.getDate() + 1);
  }

  pauseIntervalId = setInterval(() => {
    if (new Date() >= target) {
      const video = findVideo();
      if (video) video.pause();
      stopPauseTimer();
    }
  }, 1000);
}

function showSetFeedback(labelElement, originalText) {
  if (!labelElement) return;
  labelElement.textContent = "Set!";
  setTimeout(() => {
    labelElement.textContent = originalText;
  }, 1000);
}

// --- UI LOGIC ---

function injectPanel() {
  if (document.getElementById(panelId)) return;

  const video = findVideo();
  // Use the helper to get the initial duration
  const duration = formatTime(video?.duration);

  const panel = document.createElement("div");
  panel.id = panelId;
  panel.innerHTML = `
    <style>
      :root {
        --panel-bg: #111;
        --panel-text: #fff;
        --panel-border: #fff;
        --input-bg: #222;
        --input-border: #fff;
        --white-btn-bg: #fff;
      }
      #panel-controls {
        padding: 12px; background: var(--panel-bg); border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2); font-family: sans-serif;
        display: flex; flex-direction: column; gap: 15px;
        border: 1px solid var(--panel-border); color: var(--panel-text);
        width: 150px;
      }
      .input-group { display: flex; flex-direction: column; gap: 5px; }
      .horizontal-row { display: flex; gap: 8px; align-items: center; }
      #panel-controls input {
        padding: 6px; border: 1px solid var(--input-border);
        border-radius: 4px; background: var(--input-bg); color: var(--panel-text);
        flex: 1; min-width: 0;
        transition: border-color 0.2s ease;
        outline: none;
      }
      #panel-controls input:hover {
        border-color: #ff8080; /* Light red */
        outline: none;         /* Optional: removes the default browser focus ring */
        transition: background 0.2s ease; /* Optional: makes the transition smooth */
      }
      #panel-controls input:focus {
        border-color: #fe0000; / *Standard red */
        outline: none;
      }
      #panel-controls button {
        width: 32px; height: 32px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        background: var(--white-btn-bg); border: none; cursor: pointer;
      }
      #panel-controls button:hover {
        background: #ff8080; /* Light red for the hover state */
        transition: background 0.2s ease; /* Optional: makes the transition smooth */
      }
      #panel-controls button:focus-visible {
        outline: 2px solid #fe0000; /* Standard red shade */
        outline-offset: 2px;       /* Adds a small gap between the button and the ring */
      }
    </style>
    <div id="panel-controls">
        <div class="input-group">
            <label id="timestampLabel" style="font-size: 12px; opacity: 0.8;">Timestamp</label>
            <div class="horizontal-row">
                <input type="text" id="timestampInput" value="${duration}">
                <button id="chosenTimestamp"><img src="${pauseUrl}" width="32" height="32"></button>
            </div>
        </div>
        <div class="input-group">
            <label id="percentageLabel" style="font-size: 12px; opacity: 0.8;">Percentage</label>
            <div class="horizontal-row">
                <input type="number" id="scaleValue" min="0" max="100" value="100">
                <button id="partitionOfVideoLength"><img src="${pauseUrl}" width="32" height="32"></button>
            </div>
        </div>
        <div class="input-group">
            <label id="realTimeLabel" style="font-size: 12px; opacity: 0.8;">Real-Time</label>
            <div class="horizontal-row">
                <input type="time" id="realTimeInput" value="23:59">
                <button id="setRealTime"><img src="${pauseUrl}" width="32" height="32"></button>
            </div>
        </div>
    </div>
  `;

  // Fix 1: Wait for metadata if it's a fresh page load/refresh
  if (video && isNaN(video.duration)) {
    video.addEventListener(
      "loadedmetadata",
      () => {
        const input = panel.querySelector("#timestampInput");
        if (input) input.value = formatTime(video.duration);
      },
      { once: true },
    );
  }

  panel.style.cssText =
    "position: fixed; top: 10px; right: 10px; z-index: 9999;";
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
  const scaleValueInput = panel.querySelector("#scaleValue");
  const partitionBtn = panel.querySelector("#partitionOfVideoLength");

  chosenTimestampBtn?.addEventListener("click", () => {
    const timestamp = timestampInput.value;
    if (isValidHMSFormat(timestamp)) {
      const parts = timestampToArray(timestamp);
      startPauseTimer(parts[0] * 3600 + parts[1] * 60 + parts[2]);
      showSetFeedback(panel.querySelector("#timestampLabel"), "Timestamp");
    }
  });

  partitionBtn?.addEventListener("click", () => {
    const percentage = parseFloat(scaleValueInput.value);
    const video = findVideo();
    if (video && !isNaN(percentage)) {
      startPauseTimer(video.duration * (percentage / 100));
      showSetFeedback(panel.querySelector("#percentageLabel"), "Percentage");
    }
  });

  setRealTimeBtn?.addEventListener("click", () => {
    const timeVal = realTimeInput.value;
    if (timeVal) {
      startRealTimeTimer(timeVal);
      showSetFeedback(panel.querySelector("#realTimeLabel"), "Real-Time");
    }
  });
}

// --- GLOBAL EVENT LISTENERS ---

// Fix 2: Handle YouTube internal navigation (clicking a new video)
window.addEventListener("yt-navigate-finish", () => {
  const video = findVideo();
  const input = document.querySelector("#timestampInput");
  if (video && input) {
    if (!isNaN(video.duration)) {
      input.value = formatTime(video.duration);
    } else {
      video.addEventListener(
        "loadedmetadata",
        () => {
          input.value = formatTime(video.duration);
        },
        { once: true },
      );
    }
  }
});

chrome.storage.local.get(["isPanelVisible"], (res) => {
  if (res.isPanelVisible) injectPanel();
});

chrome.runtime.onMessage.addListener((req) => {
  if (req.action === "togglePanel") {
    const p = document.getElementById(panelId);
    if (p) {
      stopPauseTimer();
      p.remove();
      chrome.storage.local.set({ isPanelVisible: false });
    } else {
      injectPanel();
      chrome.storage.local.set({ isPanelVisible: true });
    }
  }
});
