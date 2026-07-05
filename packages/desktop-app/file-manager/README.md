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
- pure windowing cost per scroll step:
   11 to 36 microseconds,
 constant regardless of strip size,
- worst-case single publish:
   14.2 milliseconds,
 entirely synchronous preview decode on a hard jump that revealed a full screen of previews.

Keyboard focus on the active pane survives pane recycling:
 the active pane re-asserts focus from Rust-held identity when it is re-instantiated after scrolling out and back.

## Known limitation

Preview decode runs synchronously on the UI thread in this spike.
The plan moves it to a cancellable background job in the file-watching-and-async milestone;
 until then a hard jump across many preview panes at once can cost one long frame.
The windowing itself is never the bottleneck.

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
   the decode/eviction cache with resident-byte accounting,
 with unit tests in `src/preview_tests.rs`.
- `src/view.rs`:
   the publish step that turns the strip plus scroll state into the bounded `ColumnView` models.
- `src/controller.rs`:
   the mutable app state and the scroll/keyboard handlers.
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
