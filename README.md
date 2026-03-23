# UTC Converter

A browser extension for instant UTC and local time conversion with intelligent parsing and format support. Works on Firefox, Chrome, and Edge.

## Features

- **Bidirectional Conversion**: Convert seamlessly between UTC and local time
- **Multiple Format Support**:
  - ISO 8601 format
  - Unix timestamps
  - Readable date/time format
- **Smart Parsing**: Automatically detect and parse various time input formats
- **Timezone Management**:
  - Automatic system timezone detection
  - Manual UTC offset configuration for all major timezones
- **Conversion History**: Track and access recent conversions
- **Quick Actions**: One-click buttons to insert current UTC or local time
- **Copy to Clipboard**: Easy copying of converted times
- **Customizable Display**:
  - 24-hour or 12-hour format toggle
  - Optional milliseconds display
  - Auto-convert on input option

## Installation

### Firefox
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file from this directory

### Chrome
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this directory

### Edge
1. Navigate to `edge://extensions/`
2. Enable "Developer mode" (left sidebar)
3. Click "Load unpacked"
4. Select this directory

## Usage

1. Click the extension icon in the Firefox toolbar
2. Enter a time in either the UTC or Local Time input field
3. The converter automatically displays the equivalent time in the other field
4. Use the format displays to view the time in ISO 8601, Unix timestamp, or readable format
5. Use the clock icon button to insert the current time
6. Use the copy icon button to copy the result to your clipboard

### Settings

Access the settings panel by clicking the "Settings" button:

**Display Preferences**
- Toggle 24-hour format (default: enabled)
- Toggle milliseconds display
- Toggle auto-convert on input (default: enabled)

**Timezone**
- Enable automatic system timezone detection (default: enabled)
- Manually select a timezone offset when auto-detection is disabled

**History**
- Toggle conversion history tracking
- Configure the number of recent conversions to keep (5, 10, 20, or 50)

## File Structure

```
extension-utcconverter-firefox/
├── manifest.json       # Extension manifest (Manifest v3)
├── popup.html          # Main UI markup
├── popup.css           # Styling
├── popup.js            # Core functionality and state management
├── README.md           # This file
└── icon*.png           # Extension icons (16px, 48px, 128px)
```

## Browser Compatibility

- Firefox 140.0 and later
- Chrome and Chromium-based browsers (latest versions)
- Microsoft Edge (latest versions)
- Manifest Version 3

## Permissions

- **storage**: Save user preferences and conversion history
- **clipboardWrite**: Copy converted times to clipboard

## Development

### Requirements
- Firefox, Chrome, or Edge browser
- Text editor or IDE

### Building

No build step required. The extension is ready to use as-is.

### Testing

1. Load the extension as a temporary add-on
2. Test time conversions with various formats
3. Verify timezone calculations
4. Test all settings and features

## Architecture

The extension uses a popup-based UI with real-time conversion logic. All state is managed in `popup.js` and persisted to browser storage for settings and history.

### Key Components

- **Time Parsing**: Flexible input parsing supporting multiple time formats
- **Format Conversion**: Display the same time in ISO 8601, Unix, and readable formats
- **Timezone Management**: System timezone detection with manual override capability
- **History Storage**: Persistent storage of recent conversions using browser storage API

## License

See LICENSE file for details.

## Support

For issues or feature requests, please create an issue in the repository.
