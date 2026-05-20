<img src="icons/logo_512.png" alt="logo" width="200" height="200">

# pause-timer-for-youtube

Pause Timer for YouTube is a browser extension designed for efficiently consuming long-form content. Whether if it's a lecture/tutorial, documentary, or three-hour podcast, this tool allows you to schedule pauses based on video progress or actual real-time.

## Gallery

<img src="screenshots/screenshot_1.png" alt="Interface">
<img src="screenshots/screenshot_2.png" alt="Interface in Context">


## Key Features

* Timestamp Precision: Set the video to pause at a specific point
* Percentage-Based Pausing: Automatically calculate the pause point based on a percentage of the video duration (e.g., pause at 50% through)
* Real-Time Scheduler: Set a specific wall-clock time (e.g., 11:30 PM) for the video to pause, perfect for those who fall asleep watching videos
* Cross-Platform: Full support for both YouTube and YouTube Music

## Installation

### Extension Store

* Install on [Chrome](https://chromewebstore.google.com/detail/pause-timer-for-youtube/magjipjiapiklggpnfmkdmfdiadonlnh)
* Install on [Firefox](https://addons.mozilla.org/en-CA/firefox/addon/pause-timer-for-youtube/)

### Local Install

If you want to run the extension locally:
1. Clone the Repository: `git clone https://github.com/abelhabte/pause-timer-for-youtube.git`
2. Switch Manifest: `node switch.js chrome # or firefox`
3. Open Extension Management:
    * Chrome: Navigate to `chrome://extensions/` and turn on Developer mode
    * Firefox: Navigate to `about:debugging#/runtime/this-firefox`
4. Load the Extension:
    * Chrome: Click Load unpacked and select the project folder
    * Firefox: Click Load Temporary Add-on and select the manifest.json file

## Technical Stack

* **HTML**
* **CSS**
* **JavaScript**
* **Manifest V3**
