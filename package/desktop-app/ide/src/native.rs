//! Source-view binding gate; filesystem and language integration follow separately.

/// What: Slint's procedural macro imports the actual UI while retaining generated-code provenance.
/// Why: Clippy can distinguish compiler output from app bindings without relaxing source lint rules.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as Ui from '../ui/app.slint';
/// ```
mod ui {
    // Use the toolkit's supported re-export syntax rather than editing generated Rust.
    slint::slint! {
        export { AppWindow, SourceSelection } from "../ui/app.slint";
    }
}

/// Shared shaping replaces terminal-column assumptions in native hit testing.
use ide_app::shaped_text::{ShapedView, TextShaper};
/// Paint identity prevents caret movement from rebuilding source pixels.
use ide_app::source_frame::FrameStamp;
/// Raster output retains the exact glyph positions used by selection.
use ide_app::text_raster::TextRaster;
/// Source and display geometry use the same library interface tested headlessly.
use ide_app::{document::Document, source_style::SourceStyles};
/// Explicit startup paths retain one canonical project boundary.
use ide_app::{cli::Options, workspace::Workspace};
/// Source-open errors identify their input instead of exposing an unlabelled I/O failure.
use anyhow::{Context, bail};
/// Toolkit handles and models bridge owned Rust state to the window.
use slint::{ComponentHandle, SharedString};
/// What: Rc shares one UI-thread owner; RefCell permits checked mutable borrowing.
/// Why: Callbacks need the same document without cross-thread Arc/Mutex overhead.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const shared = { current: state };
/// ```
use std::{cell::RefCell, path::PathBuf, rc::Rc};
/// Native window and model row generated from the UI declaration.
use ui::AppWindow;

/// Native font instance changes must repaint rather than reuse stale glyphs.
#[cfg(test)]
mod font_tests;
/// Source selection and keyboard callbacks.
mod input;
/// Project tree and asynchronous successful-file navigation.
mod navigation;
/// Native project callbacks exercise actual reader/timer and source replacement boundaries.
#[cfg(test)]
mod navigation_tests;
/// Background source reads apply correspondence to the latest UI reading state.
mod reload;
/// Native rendering and input are split by their invalidation boundary.
mod render;
/// Source typography reaches the actual image and selection bindings.
#[cfg(test)]
mod source_font_tests;
/// Consumer window events exercise the actual markup and source-image bindings.
#[cfg(test)]
mod tests;
/// Fractional viewport movement and bounded tile materialization.
mod viewport;
/// Bind caret and selection callbacks.
use input::{bind_keys, bind_pointer};
/// Shared rendering entry point.
use render::{bind_appearance, render};
/// Bind viewport changes without line-snapping native scrolling.
use viewport::bind_viewport;

/// Shared UI-thread state; there is no project-writing operation.
struct State {
    /// Canonical source and current reading position.
    document: Document,
    /// Optional authoritative disk file; absent only for the explicit in-memory fixture.
    file_path: Option<PathBuf>,
    /// File-open identity rejects worker replies after future navigation.
    file_generation: u64,
    /// A failed refresh retains source and displays an actionable error only while needed.
    file_error: Option<String>,
    /// New-file open failures remain visible independently of the displayed file's refresh result.
    navigation_error: Option<String>,
    /// Last revision whose highlighting result was accepted, including plain-text or failed results.
    syntax_revision: Option<u64>,
    /// Highlight failures remain distinct from file-read failures.
    syntax_error: Option<String>,
    /// Highlight ranges, populated by the syntax integration.
    styles: SourceStyles,
    /// First materialized source line, including viewport overscan.
    first: usize,
    /// Bounded number of materialized source lines.
    count: usize,
    /// Logical width of the visible code area.
    width: f32,
    /// Horizontal tile origin; native Flickable supplies fractional movement.
    horizontal: f32,
    /// Widest measured line of the current document.
    document_width: f32,
    /// Reusable paragraph/font resources.
    shaper: TextShaper,
    /// Reusable outline raster resources.
    raster: TextRaster,
    /// Exact displayed geometry used by pointer input.
    shaped: Option<ShapedView>,
    /// Avoid cloning whole source for accessibility on each selection change.
    presented_revision: Option<u64>,
    /// Last materialized image inputs; reset when changing the displayed file.
    frame_stamp: Option<FrameStamp>,
}

/// Construct the same reading state for the application and headless native event tests.
impl State {
    /// Retain source ownership and initialize viewport resources without changing the filesystem.
    fn new(source: &str, file_path: Option<PathBuf>) -> Self {
        return Self {
            document: Document::new(source),
            file_path,
            file_generation: 1,
            file_error: None,
            navigation_error: None,
            syntax_revision: None,
            syntax_error: None,
            styles: SourceStyles::from([]),
            first: 0,
            count: 32,
            width: 1044.0,
            horizontal: 0.0,
            document_width: 0.0,
            shaper: TextShaper::new(),
            raster: TextRaster::new(),
            shaped: None,
            presented_revision: None,
            frame_stamp: None,
        };
    }
}

/// Run one project window after display-independent argument parsing has completed.
pub fn run(options: Options) -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("ide_app=debug,monochromatic_ide=debug")
        .init();
    let workspace = Workspace::new(&options.project)?;
    // Resolve initial-file paths relative to the explicit root, never the caller's ambient cwd.
    let file_path = if let Some(file) = options.file {
        Some(workspace.resolve(&file)?)
    } else {
        None
    };
    // What: if let extracts a present command-line argument without unwrap.
    // Why: A project without an initial file starts empty rather than displaying fabricated source.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (path !== undefined) { source = readFile(path); }
    // ```
    let (source, label) = if let Some(path) = &file_path {
        // What: ? returns an I/O failure to main, preserving its diagnostic.
        // Why: A failed open must not silently substitute the fixture.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // source = await readFile(path, 'utf8');
        // ```
        let metadata = std::fs::metadata(path)
            .with_context(|| return format!("Cannot inspect source file {}", path.display()))?;
        if !metadata.is_file() {
            bail!("Cannot open source {}: it is not a regular file", path.display());
        }
        let text = std::fs::read_to_string(path)
            .with_context(|| return format!("Cannot read UTF-8 source file {}", path.display()))?;
        (text, path.display().to_string())
    } else {
        (String::new(), String::new())
    };
    let window = AppWindow::new()?;
    window.set_source_available(file_path.is_some());
    let state = Rc::new(RefCell::new(State::new(&source, file_path)));
    window.set_file_label(SharedString::from(label));
    bind_pointer(&window, &state);
    bind_viewport(&window, &state);
    bind_keys(&window, &state);
    // Retain the timer until window shutdown; its Drop also closes and joins the worker.
    let _reload_timer = reload::bind(&window, &state)?;
    bind_appearance(&window, &state);
    let _navigation_timer = navigation::bind(&window, &state, workspace)?;
    render(&window, &state);
    if state.borrow().file_path.is_none() {
        window.invoke_focus_tree();
    }
    window.run()?;
    // What: Ok(()) reports success without a payload; Err would carry a failure.
    // Why: Clean window closure is not a process error.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return;
    // ```
    return Ok(());
}
