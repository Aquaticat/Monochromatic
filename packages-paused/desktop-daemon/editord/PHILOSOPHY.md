# editord design philosophy

## Scope and constraints

editord is a local-only editor daemon.
It serves a single user on `localhost` over WebSocket.

### Deliberate non-goals

Certain scenarios are considered **user error** and are not optimized for:

- **Directories with 1000+ entries**: the file tree renders every entry into the DOM
  without virtualization. Flat directories at that scale indicate
  a missing `.gitignore` or an unconventional project layout.
- **Multiple projects in one tab**: editord serves one project root per instance.
  Opening unrelated project trees in the same session is unsupported.
- **Text files over 1 MB**: `contenteditable` with CSS counter line numbers
  degrades on very large files. Generated output, minified bundles,
  and binary-disguised-as-text fall outside the intended use case.

### Localhost assumptions

Because editord runs locally, certain optimizations that matter
for networked editors are unnecessary:

- **Full-file saves are acceptable**: Ctrl+S sends the entire file over WebSocket.
  On loopback, even large files transfer in under a millisecond.
  Incremental diffing or operational transforms add complexity
  without meaningful latency improvement.
- **DOM rebuild on expand is fine**: `replaceChildren` replacing a subtree
  on directory expand is a single synchronous paint.
  Layout thrashing is a non-issue at local directory sizes.
- **Prefetch cache needs no eviction**: each cache entry is a small array
  of `{ name, isDirectory }` objects. Even with hundreds of directories
  preloaded, total memory is negligible.

### No editor framework

editord will never adopt CodeMirror, Monaco, or any other editor framework.
The entire point is that raw `contenteditable` delegates scrolling to the browser's compositor thread.
Editor frameworks reimplement scrolling in JavaScript (typically for line virtualization),
which defeats the compositor optimization that motivates editord's existence.

### Browser as the platform

Running in real Chrome (not Electron) means editord inherits every browser capability for free:

- **Zoom**: Ctrl+Plus/Minus scales the entire UI without any custom implementation
- **Find in page**: Ctrl+F works natively because content is in the DOM
- **Accessibility**: screen readers, high contrast, reduced motion all work out of the box
- **DevTools**: full Chrome DevTools for debugging the editor itself
- **Smooth scrolling**: `chrome://flags/#smooth-scrolling` controls compositor-driven scroll
- **Print**: Ctrl+P prints the file via the browser's native print dialog
- **Spell check**: available natively on contenteditable elements

Features that other editors must reimplement from scratch are already present.

### Syntax highlighting approach

Syntax highlighting uses the **CSS Custom Highlight API** to style token ranges
without mutating the DOM.
`Range` objects point to text nodes inside per-line `<div>`s;
the browser applies `::highlight()` styles without injecting `<span>` elements,
preserving native undo/redo, IME, and selection.

Files over 100KB are not highlighted.
At that size, full re-tokenization on every keystroke completes in well under a frame budget,
so incremental parsing provides no benefit.
Tree-sitter's main advantage (incremental reparsing via WASM) is therefore unnecessary,
and its cost (~400KB+ WASM payload, async initialization, per-grammar `.wasm` hosting)
is not justified.

The tokenizer/parser must be pure JavaScript with no WASM dependency
to keep the client bundle small and initialization synchronous.

### Path containment

All filesystem operations (`openFile`, `saveFile`, `listDir`, `deleteEntry`,
`copyEntry`, `moveEntry`, `newEntry`) validate
that the resolved path falls within the server's root directory.
The root is the highest writable ancestor of the working directory,
determined at startup by `resolveRoot`.
Even with a valid auth token, a client cannot read or write outside this boundary.

### Binary file handling

Non-text files are detected by extension and displayed using native browser elements:
images in `<img>`, audio in `<audio>`, video in `<video>`.
Unknown binary files show a hex dump (xxd format, truncated at 16KB).
SVG is intentionally classified as text because it is editable source.
The `FileKind` discriminant in the `fileContent` response drives viewer routing
so the client never attempts to render binary content as text.

### Context menu via Popover API

File tree context menus use the browser's Popover API (`popover="auto"`)
with CSS anchor positioning for placement and `position-try-fallbacks`
for viewport edge detection.
This avoids reimplementing dropdown positioning, z-index management,
and click-outside dismissal; the browser handles all three natively.
Inline input items (for rename, copy, move) embed a text input
directly in the popover, confirmed with Enter.

### Filesystem volume ID

The `connected` handshake includes a filesystem volume identifier (`fsId`)
derived from the OS-level filesystem UUID (Linux `stat -f`, macOS `stat -f %v`).
This ensures localStorage keys are stable per physical volume,
not per mount path: remounting the same disk at a different path
preserves session state, while two different volumes mounted at the same path
do not collide.
