# editord TODO

## Search (resolved)

- ~~**scoping search to last focused directory**~~:
  fixed by tracking `#lastFocused` via `focusin` on the shadow root
  instead of relying on `activeElement` (which goes null when the overlay steals focus)
- ~~**Escape requires two presses to close search overlay**~~:
  the browser swallows the first Escape keydown entirely (no JS event fires,
  not even a capture-phase listener on the `<dialog>`) and only blurs the `<input>`.
  Fixed by closing the overlay on input `blur` when `relatedTarget` is null
  or outside the dialog.
  **Approaches that did not work:**
  - Manual `keydown` Escape handler on the input; first Escape never reaches JS
  - `event.preventDefault()` on the dialog's `cancel` event; cancel doesn't fire on first press
  - Capture-phase `keydown` listener on the `<dialog>` element; not fired on first press
  - Capture-phase `keydown` listener on `document`: not fired on first press
  - `autocomplete="off"` on the input; already set, not the cause

## Performance

### File tree

- **Debounce rapid expand/collapse**: fast toggling fires concurrent fetches
  with no cancellation; `AbortController` per directory would prevent wasted work

### WebSocket protocol

- **No heartbeat**: automatic reconnect exists, but there is no ping/pong or explicit liveness check;
  half-open connections may remain silent until the browser reports close
- **No backpressure**: rapid `listDir` requests from preloading
  can saturate the server with no queuing or throttling

## Observability

- **No request tracing**: WS messages have `id` for correlation
  but no timing, no server-side request logs, no latency metrics

## Missing features

- **No visual feedback on save**: save confirmation is logged
  but no toast or status bar indicator is shown to the user
- **No theme toggle keybinding**: light theme exists via `data-theme="light"`
  but there is no keybinding to switch themes at runtime
- **No favicon or PWA manifest**: the app is not installable as a PWA yet
