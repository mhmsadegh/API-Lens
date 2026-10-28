# API Lens 🔍

Chrome extension that shows every `fetch` / `XMLHttpRequest` call a page makes:
method, URL, status, timing, request body, response body, headers and a ready-to-copy **cURL**.

## Install
1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select this `api-lens` folder
4. Pin the extension, open any site, then click the icon

## Features
- Captures fetch and XHR (including iframes) from page start
- Per-tab log with badge counter; resets on full page navigation
- Filter by URL / method / status, and by type
- Pretty-printed JSON bodies, copy buttons, cURL generation
- Export the log as JSON

## Limitations
- Cookies and browser-managed headers (e.g. `User-Agent`) are not visible to page scripts, so they're not included in the cURL.
- Bodies over 200 KB are truncated; up to 300 requests are kept per tab.
- WebSocket and requests made by service workers aren't captured.
