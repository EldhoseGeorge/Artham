


# അർത്ഥം

A Chrome extension for English-to-Malayalam dictionary lookup.

## What it does
- Lets users select a word on any webpage
- Shows Malayalam meanings inline using a tooltip
- Provides a right-click context menu lookup option
- Remembers per-domain enable/disable preferences locally

## Permissions
- `storage`: used to save the user’s per-domain extension preference locally
- `contextMenus`: used to add a selection-based dictionary option in the right-click menu
- `activeTab` and `scripting`: not required by the current implementation

## Privacy
This extension does not collect or transmit personal user data to any external server. It uses local browser storage only for simple preferences.

## Run / Build
Install dependencies:
```bash
npm install
```

Build the extension:
```bash
npm run build
```

Watch for development:
```bash
npm run start
```

