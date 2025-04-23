# what3words for Google Maps - Chrome Extension

This Chrome extension integrates what3words with Google Maps, allowing you to convert any location on Google Maps to a what3words address with a single click.

## How to Download and Install

### Method 1: Download Individual Files

To download the extension files, navigate to these important files in the Replit file viewer and save each one to a folder on your computer:

1. `/manifest.json` - The extension manifest
2. `/assets/` - Directory with icon files
   - `/assets/icon16.svg`
   - `/assets/icon48.svg`
   - `/assets/icon128.svg`
3. `/background/` - Background script
   - `/background/background.js`
4. `/content/` - Content scripts
   - `/content/content.js`
   - `/content/content.css`
5. `/popup/` - Popup files
   - `/popup/popup.html`
   - `/popup/popup.css`
   - `/popup/popup.js`
6. `/generated-icon.png` - Generated icon

### Method 2: Download Files Through the Server

You can also download individual files by visiting:
- `http://[replit-url]:5000/manifest.json`
- `http://[replit-url]:5000/assets/icon16.svg`
- And so on...

## Installation in Chrome

1. Create a folder on your computer for the extension
2. Save all the downloaded files in the same directory structure as shown above
3. Open Chrome browser
4. Navigate to `chrome://extensions/`
5. Enable "Developer mode" by toggling the switch in the top-right corner
6. Click "Load unpacked"
7. Select the folder where you saved the extension files

## Using the Extension

1. Click on the what3words icon in your browser toolbar
2. Enter your what3words API key (e.g., `Y2DE0YWC`) in the input field
3. Click "Save"
4. Navigate to Google Maps
5. Click anywhere on the map
6. The what3words address will appear in a small overlay

## Features

- Click any location on Google Maps to get its what3words address
- Copy the what3words address to clipboard
- Open the location directly on what3words website
- Customize with your own API key

## Technical Details

- Uses the what3words API to convert coordinates to 3-word addresses
- Integrates seamlessly with Google Maps
- Stores your API key securely in Chrome's storage