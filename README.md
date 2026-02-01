# Thymer Table Plugin

Render pipe-separated tables in Thymer code blocks as HTML tables


## Installation

1. Copy `plugin.js`
2. In Thymer: `Cmd/Ctrl + P` → "Plugins" → "Create Plugin" → "App Plugin"
3. Paste code and save

## Usage

Create a code block (`Ctrl+P` → "code block") and type:

```
Name | Age | City
Alice | 30 | NYC
Bob | 25 | LA
```

Click outside → table renders. Click table → edit mode.

## Syntax

```
Header1 | Header2 | Header3
Value1 | Value2 | Value3
```

Optional separator:
```
Header1 | Header2
--- | ---
Value1 | Value2
```

## Features

- Auto-detects pipe-separated data
- Click to edit
- Hover effects
- Responsive scrolling


## Limitations

- Arrow key navigation has quirks (use the mouse to position the cursor)
- No column alignment
- No cell formatting
- Plain text only in cells

## Preview

<img width="500" height="394" alt="image" src="https://github.com/user-attachments/assets/f18adeb1-be41-4911-a456-7c93e793d8ca" /> <img width="500" height="394" alt="image" src="https://github.com/user-attachments/assets/76623c0b-ffd9-4193-9dd0-9ef1b517f73c" />
<img width="500" height="394" alt="image" src="https://github.com/user-attachments/assets/1d4e654c-3042-4ac6-a3d1-cb0a4a3f089e" /> <img width="500" height="394" alt="image" src="https://github.com/user-attachments/assets/d9e2b9af-6531-4654-b0e8-bdfdb8c683b1" />
<img width="500" height="394" alt="image" src="https://github.com/user-attachments/assets/5d3fd342-993b-4000-9f4b-b84ada9ae972" /> <img width="500" height="394" alt="image" src="https://github.com/user-attachments/assets/bbcc8601-c7cc-492e-9696-3cff1081734d" />
