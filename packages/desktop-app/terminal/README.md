# Terminal

A Slint desktop terminal prototype backed by Ghostty's `libghostty-vt` terminal core.

The first checkpoint demonstrates smooth Slint-owned pixel scrolling over `libghostty-vt` scrollback.
It feeds deterministic demo VT bytes instead of spawning a PTY.
The engine is structured so a PTY reader can replace the demo feeder without changing the renderer or scroll bridge.

## Scope

- Terminal core: `libghostty-vt` 0.1.1, not `alacritty_terminal`, `termwiz`, or raw `vte`.
- UI: Slint `Flickable` owns pixel scroll state and smooth wheel or touch motion.
- Rendering: Rust extracts rows, cells, resolved colors, and style flags from `RenderState`.
- Resize: Slint reports viewport pixels to Rust. Rust computes terminal columns and rows from fixed cell metrics and calls
  `Terminal::resize`.
- Input: demo VT content only for this checkpoint.

## Scroll bridge

Slint stores the pixel scroll offset in the `Flickable` viewport.
Rust maps that offset to the row-aligned `libghostty-vt` viewport with this formula:

```text
whole_row_offset = floor(pixel_scroll / cell_height)
fractional_px = pixel_scroll - whole_row_offset * cell_height
```

`TerminalEngine::set_pixel_scroll` clamps the pixel offset to Ghostty's current scrollback length,
uses `Terminal::scroll_viewport` with `Top`, `Bottom`, or `Delta` to move the whole-row viewport,
and then `TerminalEngine::snapshot` extracts visible cells from `RenderState`.

The Slint content places each visible cell at:

```text
y = (whole_row_offset + viewport_row) * cell_height
```

The `Flickable` then translates the content by the original pixel offset.
When the pixel offset changes inside the same row, Slint moves the content smoothly without asking Ghostty for new rows.
When it crosses a row boundary, Rust asks Ghostty for the next whole-row viewport.

## libghostty-vt research notes

The current Rust binding was verified from `Uzaaft/libghostty-rs`, cloned under `/tmp/agent/libghostty-rs-20260601`.
The crate README and `crates/libghostty-vt/src/terminal.rs` document:

- `Terminal::new(TerminalOptions { cols, rows, max_scrollback })` creates the VT state.
- `Terminal::vt_write(&[u8])` feeds VT bytes.
- `Terminal::resize(cols, rows, cell_width_px, cell_height_px)` updates grid and pixel dimensions.
- `Terminal::scroll_viewport(ScrollViewport::{Top, Bottom, Delta})` moves the viewport by rows.
- `Terminal::total_rows()` and `Terminal::scrollback_rows()` expose scrollback size.

`crates/libghostty-vt/src/render.rs` documents the render path used here:

- `RenderState::new()` allocates reusable render state.
- `RenderState::update(&terminal)` returns a snapshot.
- `RowIterator` iterates visible rows.
- `CellIterator` iterates cells within each row.
- `CellIteration::graphemes`, `style`, `fg_color`, and `bg_color` expose text and resolved style data.

`crates/libghostty-vt-sys/src/bindings.rs` confirms the C ABI row-scroll tags:
`TOP`, `BOTTOM`, and `DELTA`, where delta up is negative.
It also confirms `TerminalScrollbar { total, offset, len }`, `TOTAL_ROWS`, and `SCROLLBACK_ROWS` type definitions.

`lib.rs` notes all handles are `!Send + !Sync`.
This prototype keeps `TerminalEngine` on the Slint UI thread inside `Rc<RefCell<_>>`.
A future PTY reader should send byte chunks to the UI thread or to a dedicated terminal thread that owns all Ghostty handles.

## Runtime library staging

`libghostty-vt-sys` links the vendored Ghostty core as `libghostty-vt.so.0`.
The package build script adds an rpath of `$ORIGIN/../lib/monochromatic-terminal` to `monochromatic-terminal`.
The `build`, `build:debug`, and `run` mise tasks copy `libghostty-vt.so*` from Cargo's build output into
`target/lib/monochromatic-terminal` so `target/release/monochromatic-terminal` can run from the package directory.
The `run` task also copies those shared libraries to `~/.local/lib/monochromatic-terminal` before installing the binary in
`~/.local/bin`.

## Layout

- `src/lib.rs`: module root.
- `src/scroll.rs`: pure pixel-to-row mapping and unit tests.
- `src/render.rs`: renderer-neutral RGB, cell, and snapshot models.
- `src/engine.rs`: `TerminalEngine`, VT feeding, resize, viewport mapping, and render extraction.
- `src/demo.rs`: deterministic demo VT stream for the first checkpoint.
- `src/launcher.rs`: Wayland app-id hook, matching `monochromatic.terminal.desktop`.
- `src/main.rs`: Slint window wiring and conversion from engine snapshots to Slint models.
- `ui/app.slint`: terminal viewport, `Flickable`, cell renderer, and resize or scroll callbacks.
- `Containerfile`: Fedora build environment with Rust, Slint runtime libraries, and Zig 0.15.2.
- `mise.toml`: package-local build, lint, test, runtime-library staging, and run tasks.

## Known remaining work

- Spawn a PTY and connect process output to `TerminalEngine::feed`.
- Encode keyboard and mouse input back to the PTY with libghostty-vt key and mouse helpers.
- Add cursor rendering and selection rendering.
- Replace fixed cell metrics with measured monospace font metrics.
- Move terminal ownership to a dedicated thread once PTY throughput matters.

## Commands

Build the container image after editing `Containerfile`:

```bash
# packages/desktop-app/terminal
mise run //packages/desktop-app/terminal:image
```

Run compile checks, max-lines linting, clippy, and tests:

```bash
# packages/desktop-app/terminal
mise run //packages/desktop-app/terminal:lint
mise run //packages/desktop-app/terminal:lint:max-lines
mise run //packages/desktop-app/terminal:lint:clippy
mise run //packages/desktop-app/terminal:test
```

Build a release binary:

```bash
# packages/desktop-app/terminal
mise run //packages/desktop-app/terminal:build
```

Build in the container, install the `.desktop` file plus binary into the host user profile,
and run the GUI on the host session:

```bash
# packages/desktop-app/terminal
mise run //packages/desktop-app/terminal:run
```
