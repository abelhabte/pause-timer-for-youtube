let pauseIntervalId = null;
const panelId = "youtube-pause-extension-panel";
const pauseUrl = chrome.runtime.getURL("icons/pause.svg");

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

function injectPanel() {
  if (document.getElementById(panelId)) return;

  const video = findVideo();
  const duration = formatTime(video?.duration);
  const panel = document.createElement("div");

  panel.id = panelId;
  panel.innerHTML = `
    <div id="panel-controls">
        <div class="input-group">
            <label id="timestampLabel" style="font-size: 12px; opacity: 0.8;">Timestamp</label>
            <div class="horizontal-row">
                <input type="text" id="timestampInput" value="${duration}" autocomplete="off">
                <button id="chosenTimestamp"><img src="${pauseUrl}" width="32" height="32"></button>
            </div>
        </div>
        <div class="input-group">
            <label id="percentageLabel" style="font-size: 12px; opacity: 0.8;">Percentage</label>
            <div class="horizontal-row">
                <input type="number" id="scaleValue" min="0" max="100" value="100" autocomplete="off">
                <button id="partitionOfVideoLength"><img src="${pauseUrl}" width="32" height="32"></button>
            </div>
        </div>
        <div class="input-group">
            <label id="realTimeLabel" style="font-size: 12px; opacity: 0.8;">Real-Time</label>
            <div class="horizontal-row">
                <input type="time" id="realTimeInput" value="23:59" autocomplete="off">
                <button id="setRealTime"><img src="${pauseUrl}" width="32" height="32"></button>
            </div>
        </div>
    </div>
  `;

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

  chrome.storage.local.get(["panelPositionData"], (res) => {
    let positionStyles = "";
    const margin = 10;
    const approxWidth = 176;
    const approxHeight = 220;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const effectiveMarginRight = margin + scrollbarWidth;

    if (res.panelPositionData) {
      const { xRatio, yRatio, corner } = res.panelPositionData;
      let targetLeft, targetTop;

      if (corner === "top-left") {
        targetTop = margin;
        targetLeft = margin;
      } else if (corner === "top-right") {
        targetTop = margin;
        targetLeft = window.innerWidth - approxWidth - effectiveMarginRight;
      } else if (corner === "bottom-left") {
        targetTop = window.innerHeight - approxHeight - margin;
        targetLeft = margin;
      } else if (corner === "bottom-right") {
        targetTop = window.innerHeight - approxHeight - margin;
        targetLeft = window.innerWidth - approxWidth - effectiveMarginRight;
      } else {
        targetLeft = window.innerWidth * xRatio;
        targetTop = window.innerHeight * yRatio;
        const maxLeft = window.innerWidth - approxWidth - margin;
        const maxTop = window.innerHeight - approxHeight - margin;
        targetLeft = Math.max(margin, Math.min(targetLeft, maxLeft));
        targetTop = Math.max(margin, Math.min(targetTop, maxTop));
      }

      positionStyles = `top: ${targetTop}px; left: ${targetLeft}px;`;
    } else {
      const defaultTop = margin;
      const defaultLeft =
        window.innerWidth - approxWidth - effectiveMarginRight;
      positionStyles = `top: ${defaultTop}px; left: ${defaultLeft}px;`;
    }

    panel.style.cssText = `position: fixed; ${positionStyles} z-index: 9999; opacity: 1; transition: top 0.2s ease, left 0.2s ease, opacity 0.1s ease;`;
  });

  document.body.appendChild(panel);

  attachPanelListeners();
  makePanelDraggableAndSnappable(panel);
}

function makePanelDraggableAndSnappable(panel) {
  const controls = panel.querySelector("#panel-controls");
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;
  const margin = 10;

  controls.addEventListener("mousedown", (e) => {
    if (e.target.closest("input") || e.target.closest("button")) return;

    e.preventDefault();
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    isDragging = true;
    panel.style.transition = "none";

    const rect = panel.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    startX = e.clientX;
    startY = e.clientY;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  function onMouseMove(e) {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    panel.style.left = `${initialLeft + deltaX}px`;
    panel.style.top = `${initialTop + deltaY}px`;
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;

    document.body.style.userSelect = "";
    document.body.style.webkitUserSelect = "";

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    panel.style.transition = "top 0.2s ease, left 0.2s ease";

    const rect = panel.getBoundingClientRect();
    const panelWidth = rect.width;
    const panelHeight = rect.height;

    const midX = window.innerWidth / 2;
    const midY = window.innerHeight / 2;

    const currentCenterX = rect.left + panelWidth / 2;
    const currentCenterY = rect.top + panelHeight / 2;

    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const effectiveMarginRight = margin + scrollbarWidth;

    let targetCorner = "top-right";

    if (currentCenterX < midX && currentCenterY < midY) {
      panel.style.top = `${margin}px`;
      panel.style.left = `${margin}px`;
      targetCorner = "top-left";
    } else if (currentCenterX >= midX && currentCenterY < midY) {
      panel.style.top = `${margin}px`;
      panel.style.left = `${window.innerWidth - panelWidth - effectiveMarginRight}px`;
      targetCorner = "top-right";
    } else if (currentCenterX < midX && currentCenterY >= midY) {
      panel.style.top = `${window.innerHeight - panelHeight - margin}px`;
      panel.style.left = `${margin}px`;
      targetCorner = "bottom-left";
    } else {
      panel.style.top = `${window.innerHeight - panelHeight - margin}px`;
      panel.style.left = `${window.innerWidth - panelWidth - effectiveMarginRight}px`;
      targetCorner = "bottom-right";
    }

    const finalRect = panel.getBoundingClientRect();
    const positionData = {
      xRatio: finalRect.left / window.innerWidth,
      yRatio: finalRect.top / window.innerHeight,
      corner: targetCorner,
    };

    chrome.storage.local.set({ panelPositionData: positionData });
  }
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

document.addEventListener("fullscreenchange", () => {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  if (document.fullscreenElement) {
    panel.classList.add("fullscreen-hidden");
  } else {
    panel.classList.remove("fullscreen-hidden");
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

window.addEventListener("resize", () => {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const rect = panel.getBoundingClientRect();
  const margin = 10;
  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;
  const effectiveMarginRight = margin + scrollbarWidth;

  panel.style.transition = "none";

  chrome.storage.local.get(["panelPositionData"], (res) => {
    const corner = res.panelPositionData?.corner || "top-right";

    if (corner === "top-left") {
      panel.style.top = `${margin}px`;
      panel.style.left = `${margin}px`;
    } else if (corner === "top-right") {
      panel.style.top = `${margin}px`;
      panel.style.left = `${window.innerWidth - rect.width - effectiveMarginRight}px`;
    } else if (corner === "bottom-left") {
      panel.style.top = `${window.innerHeight - rect.height - margin}px`;
      panel.style.left = `${margin}px`;
    } else if (corner === "bottom-right") {
      panel.style.top = `${window.innerHeight - rect.height - margin}px`;
      panel.style.left = `${window.innerWidth - rect.width - effectiveMarginRight}px`;
    }
  });
});