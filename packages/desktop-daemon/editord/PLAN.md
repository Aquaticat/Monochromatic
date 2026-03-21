# editord implementation plan

## Phase 1 -- Edit and save a file (done)

- [x] h3 server on port 4400 with token auth
- [x] Static file serving for index.html and dist/client/
- [x] WebSocket via crossws with `open` and `save` operations
- [x] `<editor-pane>` web component: contenteditable, per-line `<div>`s, paste-as-plain-text
- [x] Client app: connect WS, open file from `?file=` param, Ctrl+S saves
- [x] Client bundle via tsdown (fully self-contained, ~15KB)
- [x] Dark theme (#ccc on #000) in index.html

### Known rough edges from phase 1

- ~~`--editor-padding` CSS variable not defined~~ (fixed: defined as `0.5rem`)
- ~~Errors from WS operations surface as uncaught promise rejections~~ (fixed: try/catch with tagged logging)
- ~~`setText`/`getText` on `<editor-pane>` require runtime cast~~ (fixed: `EditorPane` class exported, typed cast in app.ts)
- ~~File paths resolve relative to server cwd, which may differ from user expectation~~ (fixed: path containment via `assertWithinRoot` against `rootDir`)
- No visual feedback on save (logged via tagged logger, no UI indicator)
- No favicon, no PWA manifest yet

## Phase 2 -- File tree and navigation (done)

- [x] `resolveRoot` server operation: walk up to highest writable ancestor directory
- [x] `listDir` server operation: `fs.readdir` with `{ withFileTypes: true }`, sorted entries
- [x] `<file-tree>` web component: native `<details><summary>` expand/collapse, lazy-loading, click to open
- [x] Layout: file tree as a left sidebar, editor pane fills remaining space
- [x] Root directory sent to client on WebSocket connection
- [x] One-level-ahead preloading of subdirectory contents

## Phase 2.5 -- Hardening (done)

- [x] Path containment: `assertWithinRoot` validates all file operations against `rootDir`
- [x] Shared protocol types: `src/protocol.ts` eliminates type duplication between server and client
- [x] Tagged loggers: all server and client modules use `tagged()` from `@monochromatic-dev/module-es`
- [x] Named parameters: all functions with 2+ params use destructured object parameters
- [x] WebSocket close handling: pending requests rejected on disconnect (prevents promise leaks)
- [x] Error propagation: fire-and-forget async calls wrapped with try/catch and tagged logging
- [x] Cross-runtime: `Bun.file()` replaced with `readFile` from `node:fs/promises`
- [x] Static serving: silent catch narrowed to ENOENT only; unexpected errors rethrow

## Phase 3 -- Search

- [x] `search` server operation: spawn `rg` subprocess, return `SearchResult[]` (file-path + content matches)
- [x] Double-shift detection: track Shift keyup timestamps, trigger on <400ms gap with no intervening keys
- [x] `<search-overlay>` web component: `<dialog>` modal with input, scrollable results, keyboard navigation
- [x] File-path results listed before content results; `%` prefix for content-only mode
- [x] `EditorPane.scrollToLine`: content search results open the file at the matching line

## Phase 4 -- File watching, themes, PWA

- [ ] `fs.watch` wrapper on open file paths, push `fileChanged` events over WebSocket
- [ ] Frontend handles `fileChanged`: reload file content (MVP: always reload, no conflict UI)
- [ ] Light theme (#444 on #fff) + toggle keybinding
- [ ] PWA manifest (`manifest.json`) + service worker (`sw.ts`) for installability
- [ ] `--editor-padding` CSS variable with a sensible default

## Phase 5 -- Syntax highlighting (done)

- [x] Lezer parser integration: `@lezer/javascript` with TypeScript/JSX dialect configuration
- [x] `getParserForPath` extension-to-parser mapping: JS/TS, JSON/JSONL, CSS, HTML, Markdown, YAML, TOML
- [x] CSS Custom Highlight API: token ranges applied via `CSS.highlights` without DOM mutation
- [x] `::highlight()` CSS rules in shadow DOM stylesheet, colors via CSS custom properties
- [x] Dark theme colors (One Dark inspired) and light theme colors in `index.html`
- [x] `requestAnimationFrame` batching: coalesces rapid edits into one parse-and-highlight pass
- [x] 100KB file size limit: files over 10KB skip highlighting entirely
- [x] Tag groups: keyword, string, comment, number, type, function, property, heading, link, emphasis

## Phase 6 -- LSP integration (done)

- [x] JSON-RPC framing over stdio for LSP communication
- [x] `LspClient` class: spawn, initialize, request/response, notification routing
- [x] `LspManager` coordinator: oxlint (linting), tsgo (types/hover/completions), dprint (formatting)
- [x] Document sync: `didOpen`, `didChange` (debounced full-text), `didSave`, `didClose`
- [x] Diagnostic aggregation: merge diagnostics from oxlint + tsgo, push to client
- [x] Diagnostic underlines via CSS Custom Highlight API (`::highlight(diag-error)`, etc.)
- [x] Hover info from tsgo: debounced mouse tracking, `<hover-popup>` tooltip
- [x] Completions from tsgo: Ctrl+Space / dot trigger, `<completion-popup>` dropdown
- [x] Formatting from dprint: Ctrl+Shift+F / Ctrl+Alt+L (JetBrains parity)
- [x] Go-to-definition from tsgo: Ctrl+Click navigates to definition location
- [x] Graceful degradation: servers that fail to start are skipped; features degrade
- [x] Late-init recovery: documents opened before LSP ready are re-opened after init

## Phase 7 -- Inlay hints (done)

- [x] Wire protocol: `inlayHint` request with range, `inlayHintResult` response with hints
- [x] Server: `requestInlayHints` via `textDocument/inlayHint` to tsgo
- [x] Server: `initializationOptions.userPreferences.inlayHints` enables all hint categories in tsgo
- [x] Client: `inlay-layer.ts` groups hints + diagnostics by line, sets `data-inlay` attributes
- [x] Client: `::before` pseudo-element renders hints above code lines with pill background
- [x] Client: line numbers moved from `::before` to `::after` to free `::before` for hints
- [x] Client: `--line-num-offset` measured via `getComputedStyle(div, '::before').height`
  in a follow-up rAF so line numbers align with code even when hints wrap
- [x] Client: `--inlay-indent` CSS custom property for column-aligned hint positioning
- [x] Client: parameter hints strip trailing colon for cleaner display
- [x] Client: severity-colored backgrounds for diagnostic messages in annotations
- [x] Client: hints soft-wrap via `white-space: pre-wrap`
- [x] Debounced refresh on content changes (750ms), immediate on file open

## Future (post-MVP)

- Completion item kind icons
- Signature help on function calls
- Code actions (quick fixes from oxlint/tsgo)
- Workspace diagnostics (diagnostics for files not currently open)

## Technical notes

### contenteditable behavior with per-line divs

- **Enter** creates a new `<div>` (browser-native, correct behavior)
- **Backspace at line start** merges current div into previous (correct)
- **Delete at line end** merges next div into current (correct)
- **Paste** intercepted: `event.preventDefault()` + `document.execCommand('insertText', false, text)`
  to force plain text and preserve undo stack
- **Undo/redo** browser-native; undo stack clears on programmatic `replaceChildren` (acceptable for MVP)
- **IME** (CJK input) works natively
- **Ctrl+F** browser-native find works because content is in the DOM
  (shadow DOM requires `delegatesFocus` or the search to target the shadow root)

### Buffer ownership

Frontend (DOM) owns the canonical buffer.
editord is stateless for buffer content -- it only reads/writes files on disk.
No operational transform, no CRDT, no diff protocol.
Full text sent on `open` (server to client) and `save` (client to server).

### Security model

Per-session random token via `crypto.randomUUID()`.
Token passed as `?token=` query parameter on both the page URL and the WebSocket URL.
WebSocket upgrade rejects connections without a valid token.
Localhost-only by default.
All filesystem operations validate paths against a root directory
to prevent traversal attacks even with a valid token.
