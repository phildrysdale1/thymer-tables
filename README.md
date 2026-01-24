# Thymer Table Plugin

Render pipe-separated tables in Thymer code blocks as HTML tables

<img width="650" height="520" alt="image" src="https://github.com/user-attachments/assets/23c8e02a-403f-497d-8244-fbfb7eca47b1" />

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

- Dark mode only - Sorry, I tried but couldn't get it to render differently based on the theme. (If someone could take a stab at this, it would be amazing)
- Arrow key navigation has quirks (use the mouse to position the cursor)
- No column alignment
- No cell formatting
- Plain text only in cells

## License

MIT
