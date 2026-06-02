//! Thin Slint binary for the libghostty-vt terminal prototype.

// What:     `slint::include_modules!()` is a macro call. The `!` means Rust runs
//           generated code at compile time, importing types built from app.slint.
// Why:      `AppWindow` and the generated `TerminalCell` struct come from Slint.
// TS map:   `import { AppWindow, TerminalCell } from "./app.slint.generated"`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AppWindow, TerminalCell } from "./app.slint.generated";
// ```
slint::include_modules!();

// What:     `use std::cell::RefCell;` imports a single-thread interior-mutability
//           wrapper. Sibling `Cell` handles `Copy` values only; `Mutex` is for
//           cross-thread mutation.
// Why:      Slint callbacks share one engine and mutate it on the UI thread.
// TS map:   Objects are mutable through shared references by default.
//
// In TS you'd write (pseudocode):
// ```ts
// const engineRef = { current: engine };
// ```
use std::cell::RefCell;

// What:     `use std::rc::Rc;` imports single-thread reference counting. Sibling
//           `Arc` is atomic and thread-safe but unnecessary on the UI thread.
// Why:      Multiple Slint callbacks need to share the same `RefCell` engine.
// TS map:   JavaScript closures share object references automatically.
//
// In TS you'd write (pseudocode):
// ```ts
// const sharedEngine = engine;
// ```
use std::rc::Rc;

// What:     `use i_slint_backend_winit::Backend;` imports Slint's winit backend
//           builder type.
// Why:      The app installs a window-attributes hook for the Wayland app id.
// TS map:   `import { Backend } from "slint-winit"`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Backend } from "slint-winit";
// ```
use i_slint_backend_winit::Backend;

// What:     `use slint::{Color, ComponentHandle, SharedString, VecModel};` imports
//           Slint runtime helpers. `Color` maps to `.slint color`; `VecModel`
//           backs array properties.
// Why:      Rust converts engine snapshots into Slint properties.
// TS map:   `import { Color, VecModel } from "slint"`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Color, VecModel } from "slint";
// ```
use slint::{Color, ComponentHandle, SharedString, VecModel};

// What:     `use terminal_app::{...};` imports this package's library modules.
//           Cargo package `terminal` exposes the lib crate as `terminal_app`.
// Why:      The binary stays thin and delegates VT/render logic to the library.
// TS map:   `import { demo, TerminalEngine } from "terminal-app"`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { demo, TerminalEngine, ViewportGeometry } from "terminal-app";
// ```
use terminal_app::{
    demo,
    engine::{TerminalEngine, ViewportGeometry},
    launcher,
    render::{Rgb, TerminalSnapshot},
    scroll::{DEFAULT_CELL_HEIGHT_PX, DEFAULT_CELL_WIDTH_PX},
};

// What:     `const MAX_SCROLLBACK_ROWS: usize = 10_000;` declares a row-count
//           constant. `usize` is chosen over `u32` because Ghostty returns `usize`.
// Why:      Demo content can keep history while avoiding unbounded scrollback.
// TS map:   `const MAX_SCROLLBACK_ROWS = 10000`.
const MAX_SCROLLBACK_ROWS: usize = 10_000;

// What:     `fn install_backend() -> Result<(), slint::PlatformError>` builds and
//           installs the explicit Slint platform backend.
// Why:      The Wayland app id must be stamped before the window is created.
// TS map:   `function installBackend(): void` that throws on platform failure.
fn install_backend() -> Result<(), slint::PlatformError> {
    // What:     `let mut builder = Backend::builder().with_window_attributes_hook(...)`
    //           creates a mutable backend builder with the app-id hook installed.
    // Why:      The hook runs at native window creation time.
    // TS map:   `let builder = Backend.builder().withWindowAttributesHook(setWindowAppId)`.
    let mut builder = Backend::builder().with_window_attributes_hook(launcher::set_window_app_id);
    // What:     `std::env::var("SLINT_BACKEND")` reads an environment variable and
    //           returns `Result<String, VarError>`. `.map(...).unwrap_or(false)`
    //           converts missing env to `false`.
    // Why:      Preserve the sibling app's software-renderer escape hatch.
    // TS map:   `(process.env.SLINT_BACKEND ?? "").includes("software")`.
    let force_software = std::env::var("SLINT_BACKEND")
        .map(|value| value.contains("software"))
        .unwrap_or(false);
    // What:     `if force_software { ... }` conditionally changes the builder.
    // Why:      Headless or no-GPU sessions can force Slint's software renderer.
    // TS map:   `if (forceSoftware) builder = builder.withRendererName(...)`.
    if force_software {
        builder = builder.with_renderer_name("renderer-software");
    }
    // What:     `let backend = builder.build()?` finishes backend construction and
    //           propagates platform errors with `?`.
    // Why:      Backend creation can fail without a display server.
    // TS map:   `const backend = builder.build()`.
    let backend = builder.build()?;
    // What:     `slint::platform::set_platform(Box::new(backend)).expect(...)`
    //           boxes the backend trait object and installs it globally.
    // Why:      The next `AppWindow::new()` must use this backend and hook.
    // TS map:   `slint.setPlatform(backend)`.
    slint::platform::set_platform(Box::new(backend))
        .expect("no Slint platform should already be set");
    // What:     `Ok(())` returns success from a unit-returning `Result`.
    // Why:      The platform is installed.
    // TS map:   `return`.
    Ok(())
}

// What:     `fn color_from_rgb(rgb: Rgb) -> Color` converts this crate's color
//           record into Slint's runtime color value.
// Why:      Generated Slint structs expect `slint::Color` fields.
// TS map:   `function colorFromRgb(rgb): Color`.
fn color_from_rgb(rgb: Rgb) -> Color {
    // What:     `Color::from_rgb_u8(...)` constructs a Slint color from 8-bit
    //           channels. `::` calls an associated function.
    // Why:      Both Ghostty and Slint use byte RGB for this path.
    // TS map:   `Color.rgb(rgb.red, rgb.green, rgb.blue)`.
    Color::from_rgb_u8(rgb.red, rgb.green, rgb.blue)
}

// What:     `fn to_slint_cell(cell: &terminal_app::render::TerminalCell) -> TerminalCell`
//           borrows one engine cell and returns one generated Slint cell.
// Why:      Keep generated-type construction in one place.
// TS map:   `function toSlintCell(cell): TerminalCell`.
fn to_slint_cell(cell: &terminal_app::render::TerminalCell) -> TerminalCell {
    // What:     `TerminalCell { ... }` constructs the Slint-generated struct.
    //           `as i32` narrows `usize` indexes to Slint `int`; `.as_str().into()`
    //           converts owned `String` to `SharedString`.
    // Why:      Slint model values must use Slint's generated field types.
    // TS map:   `return { row: cell.row, col: cell.col, ... }`.
    TerminalCell {
        row: cell.row as i32,
        col: cell.col as i32,
        text: SharedString::from(cell.text.as_str()),
        foreground: color_from_rgb(cell.foreground),
        background: color_from_rgb(cell.background),
        bold: cell.bold,
        italic: cell.italic,
        inverse: cell.inverse,
        underline: cell.underline,
    }
}

// What:     `fn apply_snapshot(app: &AppWindow, snapshot: TerminalSnapshot)` borrows
//           the Slint window and consumes one owned engine snapshot.
// Why:      One function updates every UI property derived from a render frame.
// TS map:   `function applySnapshot(app, snapshot): void`.
fn apply_snapshot(app: &AppWindow, snapshot: TerminalSnapshot) {
    // What:     `let cells: Vec<TerminalCell> = ...collect()` maps engine cells to
    //           generated Slint cells and gathers them into a vector.
    // Why:      Slint array properties are backed by Rust models.
    // TS map:   `const cells = snapshot.cells.map(toSlintCell)`.
    let cells: Vec<TerminalCell> = snapshot.cells.iter().map(to_slint_cell).collect();
    // What:     `Rc::new(VecModel::from(cells)).into()` wraps the vector in a Slint
    //           model. `Rc` is required by Slint's `ModelRc` conversion.
    // Why:      Generated setters expect model-backed arrays, not raw `Vec`s.
    // TS map:   `app.cells = cells`.
    app.set_cells(Rc::new(VecModel::from(cells)).into());
    app.set_total_rows(snapshot.total_rows as i32);
    app.set_scrollback_rows(snapshot.scrollback_rows as i32);
    app.set_viewport_rows(snapshot.viewport_rows as i32);
    app.set_viewport_cols(snapshot.viewport_cols as i32);
    app.set_whole_row_offset(snapshot.whole_row_offset as i32);
    app.set_content_height(snapshot.total_rows as f32 * snapshot.cell_height_px);
    // What:     `format!(...)` builds a status string with row, pixel, and title
    //           data. The title falls back to a demo label when no OSC title exists.
    // Why:      The prototype visibly documents the row/fraction bridge.
    // TS map:   Template string assigned to `app.status`.
    let status = format!(
        "libghostty-vt  {}x{}  scrollback={}  row={}  fractional={:.1}px  {}",
        snapshot.viewport_cols,
        snapshot.viewport_rows,
        snapshot.scrollback_rows,
        snapshot.whole_row_offset,
        snapshot.fractional_px,
        if snapshot.title.is_empty() {
            "demo VT feed, PTY not wired yet"
        } else {
            snapshot.title.as_str()
        },
    );
    app.set_status(SharedString::from(status.as_str()));
}

// What:     `fn refresh_from_scroll(...) -> Result<(), Box<dyn std::error::Error>>`
//           handles one Slint pixel-scroll notification.
// Why:      It keeps callback bodies short and testable by inspection.
// TS map:   `function refreshFromScroll(app, engine, pixelScroll): void`.
fn refresh_from_scroll(
    app: &AppWindow,
    engine: &Rc<RefCell<TerminalEngine>>,
    pixel_scroll: f32,
) -> Result<(), Box<dyn std::error::Error>> {
    // What:     `engine.borrow_mut()` takes a checked mutable borrow from `RefCell`.
    // Why:      The shared `Rc` engine can still be mutated inside callbacks.
    // TS map:   `const engineValue = engineRef.current`.
    let mut engine = engine.borrow_mut();
    // What:     `let mapping = engine.set_pixel_scroll(pixel_scroll)?` maps Slint
    //           pixels and scrolls Ghostty's whole-row viewport.
    // Why:      This is the bridge required by the prototype.
    // TS map:   `const mapping = engine.setPixelScroll(pixelScroll)`.
    let mapping = engine.set_pixel_scroll(pixel_scroll)?;
    // What:     `let snapshot = engine.snapshot(mapping)?` extracts visible cells.
    // Why:      Slint redraws from owned snapshot data.
    // TS map:   `const snapshot = engine.snapshot(mapping)`.
    let snapshot = engine.snapshot(mapping)?;
    // What:     `drop(engine)` releases the `RefCell` mutable borrow before setting
    //           UI properties that could trigger callbacks.
    // Why:      Avoid nested mutable borrows if Slint emits another notification.
    // TS map:   No equivalent; JS has no borrow checker.
    drop(engine);
    apply_snapshot(app, snapshot);
    Ok(())
}

// What:     `fn refresh_from_resize(...) -> Result<(), Box<dyn Error>>` handles
//           Slint viewport-size notifications.
// Why:      Resize support lives at the app boundary with the same cell metrics.
// TS map:   `function refreshFromResize(app, engine, width, height): void`.
fn refresh_from_resize(
    app: &AppWindow,
    engine: &Rc<RefCell<TerminalEngine>>,
    width_px: f32,
    height_px: f32,
) -> Result<(), Box<dyn std::error::Error>> {
    let geometry = ViewportGeometry::from_pixels(
        width_px,
        height_px,
        DEFAULT_CELL_WIDTH_PX,
        DEFAULT_CELL_HEIGHT_PX,
    );
    let mut engine = engine.borrow_mut();
    engine.resize(geometry)?;
    let pixel_scroll = 0.0 - app.get_scroll_y();
    let mapping = engine.set_pixel_scroll(pixel_scroll)?;
    let snapshot = engine.snapshot(mapping)?;
    drop(engine);
    apply_snapshot(app, snapshot);
    Ok(())
}

// What:     `fn log_callback_error(context: &str, error: Box<dyn std::error::Error>)`
//           logs fallible callback work to stderr.
// Why:      Slint callbacks cannot return errors to the event loop.
// TS map:   `console.error(context, error)`.
fn log_callback_error(context: &str, error: Box<dyn std::error::Error>) {
    // What:     `eprintln!(...)` writes a user-visible diagnostic to stderr.
    // Why:      Prototype failures should be visible when launched from a terminal.
    // TS map:   `console.error(...)`.
    eprintln!("monochromatic-terminal: {context}: {error}");
}

// What:     `fn main() -> Result<(), Box<dyn std::error::Error>>` is the binary
//           entry point. Returning `Result` lets failures become process errors.
// Why:      No manual `process.exit` style path is needed.
// TS map:   `async function main(): Promise<void>`.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    install_backend()?;
    let app = AppWindow::new()?;
    let initial_geometry = ViewportGeometry {
        cols: 80,
        rows: 24,
        cell_width_px: DEFAULT_CELL_WIDTH_PX,
        cell_height_px: DEFAULT_CELL_HEIGHT_PX,
    };
    let mut engine = TerminalEngine::new(initial_geometry, MAX_SCROLLBACK_ROWS)?;
    let demo_bytes = demo::demo_vt();
    engine.feed(demo_bytes.as_slice())?;
    let initial_scroll_px = engine.scrollback_rows()? as f32 * DEFAULT_CELL_HEIGHT_PX;
    let initial_mapping = engine.set_pixel_scroll(initial_scroll_px)?;
    let initial_snapshot = engine.snapshot(initial_mapping)?;
    apply_snapshot(&app, initial_snapshot);
    app.set_scroll_y(0.0 - initial_scroll_px);
    let engine = Rc::new(RefCell::new(engine));

    let weak_for_scroll = app.as_weak();
    app.on_scroll_changed({
        let engine = Rc::clone(&engine);
        move |pixel_scroll| {
            if let Some(app) = weak_for_scroll.upgrade() {
                if let Err(error) = refresh_from_scroll(&app, &engine, pixel_scroll) {
                    log_callback_error("scroll refresh failed", error);
                }
            }
        }
    });

    let weak_for_resize = app.as_weak();
    app.on_viewport_resized({
        let engine = Rc::clone(&engine);
        move |width_px, height_px| {
            if let Some(app) = weak_for_resize.upgrade() {
                if let Err(error) = refresh_from_resize(&app, &engine, width_px, height_px) {
                    log_callback_error("resize refresh failed", error);
                }
            }
        }
    });

    app.run()?;
    Ok(())
}
