//! Library root for the Slint file-manager column-strip virtualization spike.
//!
//! The binary owns only process setup. This library owns the full strip state,
//! the bounded-window computation, the instrumentation, the custom row model,
//! the preview decode/eviction cache, the view-publish step, and the controller
//! that wires user actions to republishes. Keeping this in the library lets the
//! windowing math and preview accounting be unit-tested without opening a window.

// What:     `slint::include_modules!()` is a macro call (the `!` marks a macro,
//           not a function). At compile time it pastes in the Rust code Slint's
//           build script generated from `ui/app.slint`: the `AppWindow`
//           component plus the generated structs `ColumnView`, `PaneView`, and
//           `RowView`. Placing it in the library root (not the binary, unlike
//           the sibling terminal app) makes those generated types reachable as
//           `crate::ColumnView` from the view-builder module below.
// Why:      The view-builder constructs `ColumnView`/`PaneView`/`RowView` values
//           in library code, so the generated types must live in the library.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AppWindow, ColumnView, PaneView, RowView } from "./app.slint.generated";
// ```
slint::include_modules!();

/// What:     `pub mod strip;` declares the `strip` module from `src/strip.rs`
///           and makes it public to the binary and tests.
/// Why:      It holds the full strip identity (columns of panes) and the
///           synthetic strip builder the spike renders.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as strip from "./strip";
/// ```
pub mod strip;

/// What:     `pub mod window;` exposes the bounded-window computation.
/// Why:      Turning a scroll offset into a visible-plus-prefetch index range is
///           pure logic with unit tests, shared by columns and panes.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as window from "./window";
/// ```
pub mod window;

/// What:     `pub mod instrument;` exposes the shared instrumentation counters.
/// Why:      The whole spike is a measurement, so the counters are a first-class
///           module read by the HUD.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as instrument from "./instrument";
/// ```
pub mod instrument;

/// What:     `pub mod rowmodel;` exposes the custom Slint row model.
/// Why:      A lazy model that counts `row_data` access is what proves the
///           `ListView` only materializes visible rows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as rowmodel from "./rowmodel";
/// ```
pub mod rowmodel;

/// What:     `pub mod preview;` exposes the preview decode/eviction cache.
/// Why:      Decoding on window entry and dropping on exit, with byte
///           accounting, is the memory-bound half of the spike.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as preview from "./preview";
/// ```
pub mod preview;

/// What:     `pub mod decode_worker;` exposes the background preview-decode worker
///           thread and its request/result message types.
/// Why:      Decoding runs off the UI thread so a burst of newly-visible previews
///           never drops a frame.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as decodeWorker from "./decode_worker";
/// ```
pub mod decode_worker;

/// What:     `pub mod view;` exposes the publish step that builds the bounded
///           `ColumnView`/`PaneView`/`RowView` models Slint renders.
/// Why:      It is the seam between Rust identity state and Slint's models.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as view from "./view";
/// ```
pub mod view;

/// What:     `pub mod controller;` exposes the mutable app state plus the
///           handlers for scroll, keyboard navigation, and republish.
/// Why:      It owns the strip, scroll offsets, active identity, preview cache,
///           and instrumentation between user actions.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as controller from "./controller";
/// ```
pub mod controller;

/// What:     `pub mod model_sync;` exposes the second `impl Controller` block that
///           mutates the persistent columns model (slide, refresh, count).
/// Why:      Split from `controller.rs` to keep each file under the line budget.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as modelSync from "./model_sync";
/// ```
pub mod model_sync;

/// What:     `pub mod menu;` exposes the third `impl Controller` block: the row
///           context-menu handlers (activate a row, keyboard menu key, run a menu
///           command) added for the context-menu spike.
/// Why:      Split from `controller.rs` to keep each file under the line budget,
///           and to keep the #12354 workaround plumbing in one place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as menu from "./menu";
/// ```
pub mod menu;

/// What:     `pub mod drag_drop;` exposes the fourth `impl Controller` block plus
///           the two stateless drag callbacks: the internal pane-to-pane
///           drag-and-drop handlers added for the drag-and-drop spike.
/// Why:      Split from `controller.rs` to keep each file under the line budget,
///           and to keep the in-window `DragArea`/`DropArea` plumbing in one place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as dragDrop from "./drag_drop";
/// ```
pub mod drag_drop;

/// What:     `pub mod launcher;` exposes the Wayland app-id hook.
/// Why:      The window must carry a stable app id for shell integration, like
///           the sibling desktop apps.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as launcher from "./launcher";
/// ```
pub mod launcher;

/// What:     `pub mod app;` exposes `run()`, the whole-program entry the binary
///           calls.
/// Why:      Keeping the Slint wiring in the library keeps the binary thin and
///           lets in-process UI tests construct the window.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as app from "./app";
/// ```
pub mod app;
