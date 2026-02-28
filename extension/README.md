# Seal Chrome Extension

Injects an "Encrypt with Seal" button into Gmail compose windows.

## Setup

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select this `/extension` folder
4. Open Gmail and compose an email

## Configuration

Before loading, update these values in `content.js`:

```js
const SEAL_APP_URL = 'https://your-seal-app.vercel.app'
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key'
```

## Icons

Place PNG icons at:
- `icons/icon16.png` (16×16)
- `icons/icon48.png` (48×48)
- `icons/icon128.png` (128×128)

## How it works

1. Extension reads the Supabase session from the Seal web app (shared via `chrome.storage.local`)
2. When you click "Encrypt with Seal" in a compose window, it prompts for a file
3. Fetches the recipient's public key from Supabase
4. Encrypts the file locally using AES-256-GCM + RSA-OAEP (same as the web app)
5. Triggers Gmail's attachment mechanism with the `.seal` encrypted file
