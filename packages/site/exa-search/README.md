# Exa Search Interface

A self-contained, single-file HTML search interface for the Exa AI search API, styled after DuckDuckGo's minimalist design philosophy.

## Features

- **Single-file output**: Entire application bundled into one HTML file
- **DuckDuckGo-inspired design**: Clean, minimal interface focused on search
- **Dark/light mode support**: Automatically adapts to system preferences via `prefers-color-scheme`
- **API key management**: Store API key in localStorage with easy management
- **Full results display**: Shows all results (up to Exa's maximum of 100) without pagination
- **Responsive design**: Works well on desktop and mobile devices

## Building

From the workspace root:

```bash
moon run exa-search:js
```

This creates a self-contained HTML file at:
```
packages/site/exa-search/dist/final/js/index.html
```

## Usage

1. Open the generated `index.html` file in any modern web browser
2. Click "Set API Key" and enter your Exa API key (get one at [exa.ai](https://exa.ai))
3. Enter your search query and click "Search"
4. All results (up to 100) will be displayed below the search box

The API key is stored in your browser's localStorage for convenience. You can change it anytime by clicking the "Change API Key" button.

## Technical Details

- **Build system**: Vite with `vite-plugin-singlefile`
- **Language**: TypeScript
- **Styling**: Pure CSS with CSS custom properties for theming
- **No external dependencies**: Everything is bundled into the single HTML file
- **API integration**: Direct fetch calls to Exa's search API

## Configuration

The build uses the `getFrontend` configuration from `@monochromatic-dev/config-vite`, which:
- Bundles all JavaScript and CSS inline
- Includes the `viteSingleFile` plugin for creating self-contained HTML
- Uses the unprefixed frontend configuration to avoid subdirectory nesting in output

## Development

The source files are organized as:
- `index.html` - Main HTML structure (at package root)
- `src/index.ts` - TypeScript logic for API integration and UI updates
- `src/index.css` - Styling with dark/light mode support

When developing, the standard Vite dev server can be used for hot module replacement.