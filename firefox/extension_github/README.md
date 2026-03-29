# GitHub PR Comment Copy for AI (Firefox)

A lightweight Manifest V2 Firefox add-on that injects copy helpers on GitHub pull requests. It builds AI-friendly prompts for individual inline review comments or an entire review so you can hand context to an AI quickly.

## Features
- Adds a **Copy for AI** button to each inline review thread that copies file path, line range, comment text, and the diff snippet into one prompt.
- Adds a **Copy review** button to top-level review comments to collect all review text, including hidden inline comments belonging to that review.
- Uses the clipboard API with small status feedback on the buttons.
- Runs only on GitHub PR pages (`https://github.com/*/*/pull/*`).
- Adds a toolbar icon with a compact popup to edit the prompt templates used for inline comments and full reviews.

## Install (temporary load, Firefox)
1) Open `about:debugging#/runtime/this-firefox` in Firefox.  
2) Click **Load Temporary Add-on…** and select `manifest.json` in this folder. (Manifest v2 is used so background scripts run without prefs.)  
3) Firefox will load the extension; leave the tab open while developing (temporary add-ons unload on restart).

## Usage
- Navigate to a GitHub pull request (Files or Conversation tab).  
- For each inline review thread, click **Copy for AI** to send a prebuilt prompt to your clipboard.  
- In a review summary comment, click **Copy review** to grab the full review text (and associated inline comments if available).  
- Paste into your AI tool of choice.
- Click the toolbar icon to open settings and adjust templates. Placeholders: `{{filePath}}`, `{{lineStart}}`, `{{lineEnd}}`, `{{commentText}}`, `{{codeText}}`, `{{reviewText}}`.

## Development notes
- `shared.js` holds the prompt templates plus storage/logging helpers used by the background, popup, and content scripts.  
- Main logic lives in `contentScript.js`; it is injected via `manifest.json`.  
- Toolbar icon and template editor live in `popup.html` / `popup.js`; defaults are seeded by `background.js`.  
- Edits require reloading the temporary add-on from `about:debugging` after saving changes.  
- No build step or external permissions are required beyond default clipboard access on the page.
