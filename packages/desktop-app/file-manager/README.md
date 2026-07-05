# File manager

A Slint plus Rust desktop file-manager prototype.

This package currently holds the first spike from the file-manager plan
(`docs/planning/file-manager.md`):
 the column-strip virtualization spike.
It is function-named and stack-agnostic,
 like its sibling `packages/desktop-app/terminal`,
so a product name and the remaining milestones can layer on without moving anything.

## What the spike proves

The interaction model is Niri-like:
 a horizontal strip of columns,
 each column stacking one or more panes vertically.
Slint has no built-in two-dimensional strip virtualization,
 so Rust does the windowing:
 it keeps the full strip as cheap identity but publishes only a bounded window to Slint.

The bounded window is,
 at each of three nesting levels:

- columns virtualize horizontally (visible columns plus one prefetch column each side),
- panes within a column virtualize vertically (visible panes plus one prefetch pane each side),
- each directory pane's rows virtualize through a Slint `ListView` over a custom lazy row model.

Preview panes decode their image with the memory-safe `image` crate on window entry,
 drop the decoded bitmap on window exit,
 and re-decode on scroll-back.
The compressed identity stays resident;
 only the decoded bitmap is evicted.

## Measured results

The synthetic strip is 1200 columns,
 about 14400 panes,
 and about 121 million addressable rows.
Driven headless through the embedded MCP server on a release build,
 the instrumentation HUD reported:

- columns instantiated:
   5 to 7 of 1200,
- panes instantiated:
   17 to 28 of about 14400,
- distinct rows materialized:
   under 2000 of about 121 million,
- decoded image memory resident:
   1.5 to 4.2 MiB,
 bounded by the viewport,
- decode count rising on scroll-back,
 confirming re-decode after eviction,
- column build churn:
   about a dozen column builds across a whole scroll session,
 because only the delta columns are built as the window slides,
 not the whole model on every event,
- preview decode runs off the UI thread on a background worker,
 so publish never includes decode time and a hard jump across many preview panes stays under one frame.

Vertical scrolling moves every column at once through one shared vertical offset:
 the tallest column sets the scroll range,
 and shorter columns scroll off the top when the shared offset passes their content.

Keyboard focus on the active pane survives pane recycling:
 the active pane re-asserts focus from Rust-held identity when it is re-instantiated after scrolling out and back.

## Smooth horizontal scrolling: one persistent model, mutated incrementally

The columns are one persistent Slint `VecModel` that is set on the window once and
never replaced.
Every change mutates it through `Repeater`/`ModelNotify` instead of rebuilding it:

- a horizontal scroll slides only the delta columns in and out (`insert`/`remove`),
 so staying columns and their `ListView`s are never rebuilt;
- vertical scroll and active changes rewrite the in-window rows in place (`set_row_data`);
- a landed decode refreshes only its owning column, flushed once scrolling settles.

Because the model is never replaced, the `Flickable`'s scroll position is never
disturbed, so mousewheel and drag scroll the full strip freely and hold far
positions.
Replacing the whole model on each scroll event (the first attempt) both churned
the `Repeater` and fought the `Flickable`'s own scroll, capping the gesture.

## Preview decode is off the UI thread

Preview decode is the one per-scroll cost heavy enough to drop a frame,
 so it runs on a dedicated worker thread (`src/decode_worker.rs`).
When a preview enters the window the cache sends a decode request and shows a "decoding" placeholder;
 a 30 ms timer drains finished RGBA bytes and wraps them into Slint images on the UI thread (a cheap copy);
 previews that scroll out before their decode lands stop being tracked.
The result:
 publish is pure windowing (single-digit microseconds),
 and the earlier synchronous-decode frame is gone.

The remaining spike simplifications are the synthetic pixel data and the single worker thread;
 a real build would read files from disk and could widen the worker pool.

## Architecture

- `src/strip.rs`:
   the full strip identity (columns of panes) and the deterministic synthetic builder.
- `src/window.rs`:
   the pure bounded-window computation shared by columns and panes,
 with unit tests in `src/window_tests.rs`.
- `src/instrument.rs`:
   the shared instrumentation counters the HUD mirrors.
- `src/rowmodel.rs`:
   the custom Slint `Model` that generates rows lazily and records access,
 so `ListView` virtualization is measured.
- `src/preview.rs`:
   the async decode/eviction cache with resident-byte accounting,
 with unit tests in `src/preview_tests.rs`.
- `src/decode_worker.rs`:
   the background decode thread and its request/result message types.
- `src/view.rs`:
   the per-column view builder (one `ColumnView` with its own panes model).
- `src/controller.rs`:
   the mutable app state, the persistent columns model, and the scroll/keyboard handlers.
- `src/model_sync.rs`:
   the incremental model-mutation mechanics (slide columns in/out, refresh rows in place, count residents),
 split from `controller.rs` for the line budget.
- `src/app.rs`:
   the backend install,
 callback wiring,
 and HUD-mirror timer.
- `src/launcher.rs`:
   the Wayland app-id hook.
- `src/main.rs`:
   the thin binary that calls `file_manager::app::run`.
- `ui/app.slint`:
   the strip UI,
 the instrumentation HUD,
 and the MCP-drivable sliders and buttons.

## Commands

Cargo work runs on the host;
 the Slint renderer needs only fontconfig and freetype,
 which are present,
 so there is no build container.

Compile-check,
 lint,
 and test:

```bash
# packages/desktop-app/file-manager
mise run //packages/desktop-app/file-manager:lint
mise run //packages/desktop-app/file-manager:lint:rust
mise run //packages/desktop-app/file-manager:lint:clippy
mise run //packages/desktop-app/file-manager:test
```

Static markup check and a default-state snapshot:

```bash
# packages/desktop-app/file-manager
mise run //packages/desktop-app/file-manager:lint:slint
mise run //packages/desktop-app/file-manager:screenshot
```

Run the GUI on the host Wayland or X session:

```bash
# packages/desktop-app/file-manager
mise run //packages/desktop-app/file-manager:run
```

Drive and inspect the running app headless through the embedded Slint MCP server
(see `docs/handover/slint-app-testing.md`):

```bash
# packages/desktop-app/file-manager
mise run //packages/desktop-app/file-manager:mcp
```

The MCP server binds `127.0.0.1:9317`.
The HUD strings are readable with `get_element_properties` on the `AppWindow::hud-a`,
 `AppWindow::hud-b`,
 and `AppWindow::hud-c` elements
(the text arrives in the `accessibleLabel` field);
 the `h-slider`,
 `v-slider`,
 and `btn-*` elements drive scrolling and navigation.

## Testing seams

This package wires the same Slint testing seams as the sibling desktop apps:

- in-process behavior tests under `cargo nextest` (the `test` task),
- the embedded MCP server for live headless driving (the `mcp` task),
- `slint-viewer --check` and `--screenshot` (the `lint:slint` and `screenshot` tasks),
- the nested-niri live-GPU render path for a real GPU pass off the main workspace.
