# editord

Local editor daemon that serves a contenteditable PWA frontend over WebSocket.

## Browser baseline

Chromium desktop latest.
editord runs as a PWA in real Chrome, not Electron,
so it targets only the latest stable Chromium release.

## Motivation

Smooth scrolling in existing editors is significantly worse than Neovide:

- **WebStorm**: JVM/Swing rendering with GC-induced frame drops and poor GPU utilization
- **VSCode**: Monaco calls `preventDefault()` on wheel events, opting out of Chromium's compositor-driven scrolling.
  Reimplements scrolling in JS due to line virtualization.
  Electron does not expose Chrome's smooth scrolling flag, so the compositor optimization is unavailable even in theory.
- **Neovide**: Purpose-built Rust render loop using Skia, physics-based scroll animation, runs at vsync with no GC

editord sidesteps these issues by running the editor UI as a PWA in real Chromium (not Electron),
using raw `contenteditable` with per-line `<div>` elements and native CSS overflow scrolling.
The browser's compositor thread owns scroll entirely -- no `preventDefault`, no JS scroll reimplementation.

## Architecture

```
editord (Bun + h3)              Chromium PWA
+-----------------------+       +---------------------------+
| HTTP: serve index.html|       | <editor-pane>             |
|       serve dist/     |       |   contenteditable         |
|                       |       |   one <div> per line      |
| WebSocket:            | <---> |   browser-native:         |
|   open(path) -> text  |       |     undo/redo, selection, |
|   save(path, text)    |       |     IME, copy/paste       |
|   listDir(path)       |       |                           |
|   search(query)       |       | <file-tree>               |
|   fileChanged (push)  |       |   <details><summary>      |
|                       |       |   lazy-load on expand     |
| fs.watch (inotify)    |       | <search-overlay>          |
+-----------------------+       +---------------------------+
```

**Frontend owns the canonical buffer.**
The DOM contenteditable element is the text state.
editord is a file I/O and search service -- no OT, no CRDT, no sync protocol.
Full text round-trips on open/save.

## Key design decisions

- **Real Chrome, not Electron** -- access to `chrome://flags/#smooth-scrolling` and all compositor optimizations;
  Chrome updates independently
- **Raw contenteditable** -- browser handles keystroke-to-render natively;
  editord is notified asynchronously for persistence
- **No virtualization** -- entire file rendered in DOM.
  Loading a huge file is a user error.
  This means normal scrolls are pure GPU layer translations on the compositor thread.
- **Per-line `<div>` elements** -- natural for contenteditable (Enter creates new divs, Backspace merges them);
  enables `children[n]` indexing for go-to-line
- **Native `<details><summary>`** -- file tree directories use browser-native expand/collapse;
  JS only handles lazy-loading on first expand and one-level-ahead preloading
- **Web components with shadow DOM** -- encapsulated styling via h-css, DOM construction via h-dom
- **Shared protocol types** -- `src/protocol.ts` defines all wire types once;
  both server and client import from the same module
- **Path containment** -- all filesystem operations validate paths against the root directory
  via `assertWithinRoot`, preventing traversal even with a valid auth token
- **Tagged loggers** -- all server and client modules use structured tagged logging
  from `@monochromatic-dev/module-es`
- **WebSocket with token auth** -- token generated per-session via `crypto.randomUUID()`,
  passed as URL query param
- **JetBrains keymap** -- double-shift for Search Everywhere (replaces command palette)
- **Two themes** -- dark (#ccc on #000), light (#444 on #fff), no syntax highlighting

## Running

```sh
mise run //packages/desktop-daemon/editord:start:server
```

Open the printed URL in Chrome.
Add `&file=path/to/file` to open a specific file.

For development with watch mode:

```sh
mise run //packages/desktop-daemon/editord:dev
```

## Project structure

```
src/
  protocol.ts                  -- shared wire types (ClientMessage, ServerMessage, DirEntry)
  server/
    index.ts                   -- entry point: h3 app, static serving, WebSocket, token auth
    log.ts                     -- root tagged logger for server subsystems
    ws.ts                      -- WebSocket handler: auth, message dispatch
    operations/
      assert-within-root.ts    -- path containment guard against traversal
      list-dir.ts              -- list directory entries, sorted dirs-first
      open.ts                  -- read file from disk
      resolve-root.ts          -- find highest writable ancestor directory
      save.ts                  -- write file to disk
  client/
    index.html                 -- PWA shell with dark/light theme custom properties
    app.ts                     -- entry: connect WS, mount components, Ctrl+S save
    log.ts                     -- root tagged logger for client subsystems
    editor-pane.ts             -- <editor-pane> web component: contenteditable, paste handler, highlight scheduling
    editor-pane.styles.ts      -- shadow DOM styles for editor pane, ::highlight() rules
    file-tree.ts               -- <file-tree> web component: <details> expand, lazy-load, preload
    file-tree.styles.ts        -- shadow DOM styles for file tree
    highlighter.ts             -- syntax highlighting: Lezer parse, offset-to-Range mapping, CSS.highlights
    highlight-tags.ts          -- Lezer tag-to-highlight-group mapping (keyword, string, comment, etc.)
    languages.ts               -- file extension to Lezer parser mapping (JS/TS dialects)
    ws-client.ts               -- typed WebSocket client with request/response correlation
```

## WebSocket protocol

All messages are JSON with a `type` discriminant.
Client requests include a client-generated `id` for response correlation.

**Client to server:**

- `{ type: "open", id, path }` -- read file, responds with `fileContent`
- `{ type: "save", id, path, content }` -- write file, responds with `saved`
- `{ type: "listDir", id, path }` -- list directory, responds with `dirListing`
- `{ type: "search", id, query }` -- ripgrep search (not yet implemented)

**Server to client:**

- `{ type: "connected", rootDir }` -- handshake confirmation with root directory path
- `{ type: "fileContent", id, path, content }` -- file read result
- `{ type: "saved", id, path }` -- write confirmation
- `{ type: "dirListing", id, path, entries }` -- directory listing with `{ name, isDirectory }` entries
- `{ type: "fileChanged", path }` -- push notification for external file changes (not yet implemented)
- `{ type: "error", id?, message }` -- error response

## Not in MVP

- Syntax highlighting, minimap, split panes
- LSP, completions, diagnostics, hover
- Terminal, git, extensions, settings UI
- Command palette (double-shift replaces it)
- Multi-window, multi-project, remote development
- Large file handling, virtualization, over-rendering
- Auto-launching Chrome
