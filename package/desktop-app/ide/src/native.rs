//! Source-view binding gate;
//!  filesystem and language integration follow separately.

/// What:
///  Slint's procedural macro imports the actual UI while retaining generated-code provenance.
/// Why:
///  Clippy can distinguish compiler output from app bindings without relaxing source lint rules.
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

/// Source-open errors identify their input instead of exposing an unlabelled I/O failure.
use anyhow::{Context, bail};
/// Hint and diagnostic snapshots with their position index.
use ide_app::annotation::Annotations;
/// Accepted in-file matches carry the file generation and revision they describe.
use ide_app::find_navigation::FindResults;
/// The stamp naming a displayed text.
use ide_app::language::identity::DocumentStamp;
/// The Language module's handle,
///  its startup rule,
///  and the reload record.
use ide_app::language::{LanguageWorker, enter_project_directory, sync::DocumentReload};
/// Visual rows of every line, as far as measured.
use ide_app::line_rows::LineRows;
/// The log filter,
///  the subscriber with the helix-lsp bridge,
///  and the writer thread.
use ide_app::logging::{self, background};
/// The displayed file is reread on change notifications,
///  or on the old timer while unwatched.
use ide_app::refresh_policy::SourceRefresh;
/// The one vertical mapping between pixels and source lines.
use ide_app::row_map::RowMap;
/// Shared shaping replaces terminal-column assumptions in native hit testing.
use ide_app::shaped_text::{Clip, ShapedView, TextShaper};
/// Paint identity prevents caret movement from rebuilding source pixels.
use ide_app::source_frame::FrameStamp;
/// Raster output retains the exact glyph positions used by selection.
use ide_app::text_raster::TextRaster;
/// One line's block of virtual rows.
use ide_app::virtual_row::Block;
/// Explicit startup paths retain one canonical project boundary.
use ide_app::{cli::Options, workspace::Workspace};
/// Source and display geometry use the same library interface tested headlessly.
use ide_app::{document::Document, source_style::SourceStyles};
/// Toolkit handles and models bridge owned Rust state to the window.
use slint::{ComponentHandle, SharedString, Timer, VecModel};
/// What:
///  Rc shares one UI-thread owner;
///  RefCell permits checked mutable borrowing.
/// Why:
///  Callbacks need the same document without cross-thread Arc/Mutex overhead.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const shared = { current: state };
/// ```
use std::{cell::RefCell, path::PathBuf, rc::Rc, sync::Arc, time::Instant};
/// Native window and model row generated from the UI declaration.
use ui::AppWindow;

/// The find and search boxes and their clear controls through Slint's element handles,
///  as assistive tools see them.
#[cfg(test)]
mod accessible_box_tests;
/// The sidebar divider through Slint's element handles:
///  slider role,
///  value,
///  bounds,
///  step,
///  actions,
///  and keys.
#[cfg(test)]
mod accessible_divider_tests;
/// Tree rows,
///  search results,
///  and the location list through element handles:
///  roles and selected states.
#[cfg(test)]
mod accessible_list_tests;
/// Inlay hints and diagnostics:
///  the snapshot setter,
///  the visible subset,
///  and the problems at the caret.
mod annotate;
/// The gutter's severity letters in front of line numbers,
///  in both schemes,
///  with measured contrast.
#[cfg(test)]
mod annotation_gutter_tests;
/// Rendered annotation pixels in both schemes,
///  visible-only repaints,
///  the scroll range,
///  and display scale.
#[cfg(test)]
mod annotation_paint_tests;
/// Which rendered pixels may move when virtual rows arrive,
///  change,
///  or vanish,
///  and which may not.
#[cfg(test)]
mod annotation_stability_tests;
/// Injected hint and diagnostic snapshots through real key and pointer events.
#[cfg(test)]
mod annotation_tests;
/// Real key events drive caret movement,
///  Shift selection,
///  paging,
///  and caret-following scroll.
#[cfg(test)]
mod caret_tests;
/// In-file find bar,
///  worker polling,
///  and selection-based match navigation.
mod find;
/// The find box's 48px clear cell:
///  every corner clears,
///  its edges end it,
///  and it follows focus and text.
#[cfg(test)]
mod find_clear_tests;
/// File switching and the modal search overlay must coexist with an open find bar.
#[cfg(test)]
mod find_interplay_tests;
/// Real key events drive the find bar,
///  reloads,
///  file switches,
///  and the search overlay together.
#[cfg(test)]
mod find_tests;
/// Tab traversal between tree,
///  source,
///  and find bar;
///  typing never edits the read-only source.
#[cfg(test)]
mod focus_tests;
/// Native font instance changes must repaint rather than reuse stale glyphs.
#[cfg(test)]
mod font_tests;
/// Source selection and keyboard callbacks.
mod input;
/// Inspection-only hint and diagnostic injection from a JSON file;
///  debug builds only.
#[cfg(debug_assertions)]
mod inspect;
/// Go to definition,
///  references,
///  and hover through the Language module.
mod language;
/// Project tree and asynchronous successful-file navigation.
mod navigation;
/// Missing targets and canonical aliases exercise reveal liveness and model identity.
#[cfg(test)]
mod navigation_reveal_tests;
/// Native project callbacks exercise actual reader/timer and source replacement boundaries.
#[cfg(test)]
mod navigation_tests;
/// Scrolling inside the overscan tile does no source work, and leaving it re-centers the tile once.
#[cfg(test)]
mod overscan_tile_tests;
/// Real pointer events select by character,
///  word,
///  and line,
///  extend with Shift,
///  and drag without panning.
#[cfg(test)]
mod pointer_tests;
/// Rendered search box in both schemes:
///  placeholder,
///  focus mark,
///  selection colors,
///  and clear states.
#[cfg(test)]
mod query_input_paint_tests;
/// The find box keeps the toolkit box's editing keys,
///  context menu,
///  and scrolling of long text.
#[cfg(test)]
mod query_input_tests;
/// Reads no write notification asked for do not show a save in progress.
#[cfg(test)]
mod quiet_read_tests;
/// External-write-to-window timings for the tree and the displayed source;
///  ignored by default.
#[cfg(test)]
mod refresh_latency_tests;
/// Background source reads apply correspondence to the latest UI reading state.
mod reload;
/// Native rendering and input are split by their invalidation boundary.
mod render;
/// The window's side of the vertical mapping between pixels and source lines.
mod rows;
/// The search box's 48px clear cell empties the query and the results and keeps focus.
#[cfg(test)]
mod search_clear_tests;
/// Replacement search queries cannot redirect an in-progress result click.
#[cfg(test)]
mod search_pointer_tests;
/// Combined search exercises native key capture,
///  real ripgrep,
///  scope,
///  and source-line navigation.
#[cfg(test)]
mod search_tests;
/// Selected rows of the tree and both lists use the ink chosen from the selection fill.
#[cfg(test)]
mod selected_row_tests;
/// Tree rows and source text beside the sidebar divider keep their own clicks at every width.
#[cfg(test)]
mod sidebar_adjacent_tests;
/// The sidebar divider is a Tab stop adjusted by keys,
///  and absent without a project.
#[cfg(test)]
mod sidebar_keyboard_tests;
/// Source repaint,
///  window resizing,
///  the find bar,
///  and the search overlay beside a resized sidebar.
#[cfg(test)]
mod sidebar_layout_tests;
/// Rendered divider states and tree painting inside the narrowest sidebar.
#[cfg(test)]
mod sidebar_paint_tests;
/// Real pointer drags on the sidebar divider resize within both bounds.
#[cfg(test)]
mod sidebar_tests;
/// Source typography reaches the actual image and selection bindings.
#[cfg(test)]
mod source_font_tests;
/// Consumer window events exercise the actual markup and source-image bindings.
#[cfg(test)]
mod tests;
/// A live system color-scheme change repaints source ink,
///  find overlays,
///  and window chrome.
#[cfg(test)]
mod theme_tests;
/// Scroll re-center bounds and the window-thread step that swaps a finished tile in.
mod tile;
/// Source tile construction and the worker thread that runs it.
mod tile_build;
/// The background measurement of every line at the wrap width.
mod tile_pass;
/// Windowed rows must not redirect an in-progress click after scrolling.
#[cfg(test)]
mod tree_pointer_tests;
/// Long-distance tree reveal must show the whole target row after native layout.
#[cfg(test)]
mod tree_scroll_tests;
/// Fractional viewport movement and bounded tile materialization.
mod viewport;
/// An ignored measurement of watch counts and staleness when a changed folder is scrolled into view.
#[cfg(test)]
mod watch_scope_tests;
/// External changes reach the tree and source through inotify notifications,
///  faster than polling could.
#[cfg(test)]
mod watch_tests;
/// Hints and message rows on wrapped lines:
///  their place above the first visual row,
///  their width,
///  presses on them,
///  and new window widths.
#[cfg(test)]
mod wrap_annotation_tests;
/// A line wrapped to more rows than one raster holds is painted in a clip,
///  and scrolling inside a built tile of a wrapped file does no source work.
#[cfg(test)]
mod wrap_clip_tests;
/// Home, End, Up, Down, paging, word motion, drags, and multi-clicks on wrapped lines.
#[cfg(test)]
mod wrap_keys_tests;
/// Always-on soft wrap in the window:
///  the wrap width,
///  the gutter's indicator,
///  the worker's measurement of every line,
///  resizes,
///  and clicks on continuation rows.
#[cfg(test)]
mod wrap_tests;
/// A save in progress is not shown before it finishes;
///  an ignored measurement finds the pause that is.
#[cfg(test)]
mod write_wait_tests;
/// An ignored measurement of saves that begin when the safety sweep comes due.
#[cfg(test)]
mod write_wait_timer_tests;
/// The wrap indicator's symbol.
use ide_app::wrap_sign::Sign;
/// Bind caret and selection callbacks.
use input::{bind_keys, bind_pointer};
/// Shared rendering entry point.
use render::{bind_appearance, render};
/// Tile bounds of the displayed and requested windows.
use tile::TileBounds;
/// The worker thread that builds scroll re-centers, held by the state.
use tile_build::TileWorker;
/// What a background measurement is valid for.
use tile_pass::PassKey;
/// Bind viewport changes without line-snapping native scrolling.
use viewport::bind_viewport;

/// Shared UI-thread state;
///  there is no project-writing operation.
struct State {
    /// Canonical source and current reading position.
    document: Document,
    /// Optional authoritative disk file;
    ///  absent only for the explicit in-memory fixture.
    file_path: Option<PathBuf>,
    /// File-open identity rejects worker replies after future navigation.
    file_generation: u64,
    /// A failed refresh retains source and displays an actionable error only while needed.
    file_error: Option<String>,
    /// New-file open failures remain visible independently of the displayed file's refresh result.
    navigation_error: Option<String>,
    /// Last revision whose highlighting result was accepted,
    ///  including plain-text or failed results.
    syntax_revision: Option<u64>,
    /// Highlight failures remain distinct from file-read failures.
    syntax_error: Option<String>,
    /// Highlight ranges,
    ///  populated by the syntax integration.
    styles: SourceStyles,
    /// First materialized source line,
    ///  including viewport overscan.
    first: usize,
    /// Bounded number of materialized source lines.
    count: usize,
    /// The part of those lines the next tile holds, when they are too tall for one raster.
    clip: Option<Clip>,
    /// Physical pixels per logical pixel as of the last render or viewport report, which the tile's size limit uses.
    scale: f32,
    /// What:
    ///  The wrap width in logical pixels every line is broken at, or zero before the window reported one.
    /// Why:
    ///  The text area's width minus the caret room; a width of zero or less keeps the last width.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// width: number; // 0 until the view has a width
    /// ```
    width: f32,
    /// How many visual rows every line takes, as far as it is known:
    ///  exact for lines measured at `width`, the last known count for the rest, one for a line never measured.
    wrap_rows: LineRows,
    /// The text `wrap_rows` describes.
    wrap_text: Option<DocumentStamp>,
    /// Counter of changes to `wrap_rows`, part of the row key.
    wrap_version: u64,
    /// What the pass last posted to the worker was for, and the syntax snapshot it used.
    pass_posted: Option<(PassKey, usize)>,
    /// The symbol the gutter shows on a continuation row, chosen once from the fonts.
    sign: Option<Sign>,
    /// The display scale the gutter's sign image was painted for.
    sign_scale: Option<u32>,
    /// Reusable paragraph/font resources.
    shaper: TextShaper,
    /// Reusable outline raster resources.
    raster: TextRaster,
    /// Exact displayed geometry used by pointer input.
    shaped: Option<ShapedView>,
    /// Avoid cloning whole source for accessibility on each selection change.
    presented_revision: Option<u64>,
    /// Last materialized image inputs;
    ///  reset when changing the displayed file.
    frame_stamp: Option<FrameStamp>,
    /// Where every line of the displayed text is vertically;
    ///  kept current by `rows::refresh`.
    row_map: RowMap,
    /// What:
    ///  The blocks of virtual rows of every annotated line,
    ///  in line order;
    ///  `Arc` shares each block
    ///       with the frames that paint it (siblings:
    ///  single-thread `Rc`,
    ///  owning `Box`).
    /// Why:
    ///  The map takes its block heights from these,
    ///  and a frame takes the blocks of its lines.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// blocks: Readonly<Block>[];
    /// ```
    blocks: Vec<Arc<Block>>,
    /// What:
    ///  What `blocks` and `row_map` were built from:
    ///  the displayed text's stamp,
    ///  the annotation store's
    ///       change counter,
    ///  and the display scale as exact bits;
    ///  `Option<...>` is nothing before the first build.
    /// Why:
    ///  Blocks are assembled again only when one of the three changed.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// rowKey?: [stamp: DocumentStamp, version: number, scale: number];
    /// ```
    row_key: Option<rows::RowKey>,
    /// Vertical scroll offset the materialized lines were last chosen for.
    offset: f32,
    /// What:
    ///  When the reader last scrolled vertically;
    ///  `Option<Instant>` is that moment or nothing.
    /// Why:
    ///  A change of rows that would move the scroll offset waits until the toolkit's scroll animation,
    ///      which runs through a binding on that offset,
    ///  has had time to finish.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// scrolledAt?: number;
    /// ```
    scrolled_at: Option<Instant>,
    /// What:
    ///  `Rc<VecModel<f32>>` is a shared,
    ///  growable toolkit list of floats.
    /// Why:
    ///  The window draws one gutter entry per visual row of the frame at that vertical position;
    ///  the list is updated in place while scrolling.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// rowTops: ArrayModel<number>;
    /// ```
    row_tops: Rc<VecModel<f32>>,
    /// What:
    ///  `Rc<VecModel<i32>>` is a shared toolkit list of 32-bit integers.
    /// Why:
    ///  Per gutter entry,
    ///  the one-based line number on the first visual row of a line and zero on a continuation row,
    ///  where the wrap indicator stands instead.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// rowNumbers: ArrayModel<number>;
    /// ```
    row_numbers: Rc<VecModel<i32>>,
    /// What:
    ///  `Rc<VecModel<i32>>` is a shared toolkit list of 32-bit integers.
    /// Why:
    ///  Per gutter entry,
    ///  the severity letter:
    ///  0 for none,
    ///  otherwise one more than the rank of
    ///      the worst diagnostic starting on the line;
    ///  only the first visual row of a line carries one.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// rowMarks: ArrayModel<number>;
    /// ```
    row_marks: Rc<VecModel<i32>>,
    /// Accepted in-file matches;
    ///  painted only while they describe the displayed file and revision.
    find: Option<FindResults>,
    /// The latest accepted external reload the Language module has not been told about yet.
    language_reload: Option<DocumentReload>,
    /// Latest accepted hint and diagnostic snapshots,
    ///  stored by the language poll;
    /// painted and handed out only while they describe the displayed file and revision.
    annotations: Annotations,
    /// The displayed file lies outside the project;
    ///  it was opened read-only from a language target.
    outside_project: bool,
    /// Where the caret goes once the file of a language target is installed.
    pending_jump: Option<language::Jump>,
    /// When to reread the displayed file:
    ///  on change notifications,
    ///  or on a timer while unwatched.
    refresh: SourceRefresh,
    /// Bounds of the tile on screen: the frame, its gutter, and its line numbers.
    /// It stays on screen while a scroll re-center is built, so it can differ from the requested window.
    shown: TileBounds,
    /// Scroll re-center the reader's last viewport change asked for, until it is shown or superseded.
    scroll_wanted: Option<TileBounds>,
    /// Bounds of the tile last queued for the worker and not cancelled; its result is accepted only while set.
    tile_job: Option<TileBounds>,
    /// The tile worker thread, started on the first scroll re-center.
    tile_worker: Option<TileWorker>,
    /// Polls the tile worker's replies on the window thread while a re-center is queued.
    tile_poll: Timer,
    /// What:
    ///  Calls of `render`, counted in debug builds for the structural tests of the overscan tile.
    /// Why:
    ///  A scroll inside the tile must not even enter `render`, which would still update models.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// renders?: number;
    /// ```
    #[cfg(debug_assertions)]
    renders: u64,
    /// Source tiles rasterized, counted in debug builds: one per re-center.
    #[cfg(debug_assertions)]
    tiles_painted: u64,
    /// Source rows shaped, counted in debug builds: a row taken from the cache is not counted.
    #[cfg(debug_assertions)]
    rows_shaped: u64,
    /// Source images set on the window, counted in debug builds.
    #[cfg(debug_assertions)]
    images_set: u64,
    /// Scroll re-center tiles completed by the tile worker, counted in debug builds when their result arrives.
    #[cfg(debug_assertions)]
    worker_tiles: u64,
    /// Source rows shaped by the tile worker, counted in debug builds from its results.
    #[cfg(debug_assertions)]
    worker_rows_shaped: u64,
    /// Worker tiles swapped in, counted in debug builds.
    #[cfg(debug_assertions)]
    tiles_applied: u64,
    /// Worker tiles discarded as stale, counted in debug builds.
    #[cfg(debug_assertions)]
    tiles_discarded: u64,
    /// Outputs of the background pass applied on the window thread, counted in debug builds.
    #[cfg(debug_assertions)]
    pass_applied: u64,
    /// Most lines of the pass's output applied in one window-thread callback, counted in debug builds.
    #[cfg(debug_assertions)]
    pass_most_lines: usize,
    /// Lines of the pass's output applied on the window thread, counted in debug builds.
    #[cfg(debug_assertions)]
    pass_lines: u64,
    /// Lines the worker shaped for the pass, counted in debug builds from its outputs.
    #[cfg(debug_assertions)]
    pass_shaped: u64,
    /// Kept rows the worker broke again for the pass, counted in debug builds from its outputs.
    #[cfg(debug_assertions)]
    pass_rebroken: u64,
}

/// Construct the same reading state for the application and headless native event tests.
impl State {
    /// Retain source ownership and initialize viewport resources without changing the filesystem.
    fn new(source: &str, file_path: Option<PathBuf>) -> Self {
        let document = Document::new(source);
        // A new text has no virtual rows yet: every line starts at its number times one code row.
        let lines = document.text().len_lines();
        let row_map = RowMap::plain(lines);
        return Self {
            document,
            file_path,
            file_generation: 1,
            file_error: None,
            navigation_error: None,
            syntax_revision: None,
            syntax_error: None,
            styles: SourceStyles::from([]),
            first: 0,
            count: 32,
            clip: None,
            scale: 1.0,
            width: 0.0,
            wrap_rows: LineRows::plain(lines),
            wrap_text: None,
            wrap_version: 0,
            pass_posted: None,
            sign: None,
            sign_scale: None,
            shaper: TextShaper::new(),
            raster: TextRaster::new(),
            shaped: None,
            presented_revision: None,
            frame_stamp: None,
            row_map,
            blocks: Vec::new(),
            row_key: None,
            offset: 0.0,
            scrolled_at: None,
            row_tops: rows::top_model(),
            row_numbers: rows::mark_model(),
            row_marks: rows::mark_model(),
            find: None,
            language_reload: None,
            annotations: Annotations::default(),
            outside_project: false,
            pending_jump: None,
            refresh: SourceRefresh::default(),
            shown: TileBounds {
                first: 0,
                count: 32,
                width: 0.0,
                clip: None,
            },
            scroll_wanted: None,
            tile_job: None,
            tile_worker: None,
            tile_poll: Timer::default(),
            #[cfg(debug_assertions)]
            renders: 0,
            #[cfg(debug_assertions)]
            tiles_painted: 0,
            #[cfg(debug_assertions)]
            rows_shaped: 0,
            #[cfg(debug_assertions)]
            images_set: 0,
            #[cfg(debug_assertions)]
            worker_tiles: 0,
            #[cfg(debug_assertions)]
            worker_rows_shaped: 0,
            #[cfg(debug_assertions)]
            tiles_applied: 0,
            #[cfg(debug_assertions)]
            tiles_discarded: 0,
            #[cfg(debug_assertions)]
            pass_applied: 0,
            #[cfg(debug_assertions)]
            pass_most_lines: 0,
            #[cfg(debug_assertions)]
            pass_lines: 0,
            #[cfg(debug_assertions)]
            pass_shaped: 0,
            #[cfg(debug_assertions)]
            pass_rebroken: 0,
        };
    }
}

/// What:
///  Success when this window may start language servers,
///  otherwise the reason it starts none.
///       `anyhow::Result<()>` is success without a value,
///  or an error.
/// Why:
///  A debug build started with `IDE_INSPECT_ANNOTATIONS` shows that file's hints and diagnostics.
///  A worker
///      without servers still publishes "no problems" for the displayed text,
///  which would replace the file's
///      diagnostics,
///  so such a window runs without the worker;
///  asking for a language feature explains why.
///      Release builds do not read the variable.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function serversWanted(): void { if (DEBUG && process.env.IDE_INSPECT_ANNOTATIONS) throw new Error('...'); }
/// ```
fn servers_wanted() -> anyhow::Result<()> {
    // `var_os` reads the variable without requiring UTF-8; `is_some` asks whether it is set.
    #[cfg(debug_assertions)]
    if std::env::var_os("IDE_INSPECT_ANNOTATIONS").is_some() {
        bail!(
            "this window shows the annotations of IDE_INSPECT_ANNOTATIONS and starts no language server"
        );
    }
    // `Ok(())` reports success without a payload.
    return Ok(());
}

/// Run one project window after display-independent argument parsing has completed.
pub fn run(options: Options) -> anyhow::Result<()> {
    // What: The writer thread owns standard output, where the log has always gone. `_log_flush` is
    //       bound first, so it is dropped last, after every other value of this function, and waits
    //       briefly for the queued records.
    // Why: The window must never wait for a slow reader of its log, and the shutdown records written
    //      after the window closed must still reach the output (`src/logging/background.rs`).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // using logFlush = startLogWriter(process.stdout); installLog(filterFromEnv(''), logFlush.writer);
    // ```
    let (log_writer, _log_flush) =
        background::background(std::io::stdout()).context("Cannot start the log writer thread")?;
    // Warnings and errors unless `RUST_LOG` asks for more; helix-lsp's healthy-server records are re-labelled.
    logging::install(logging::filter(""), log_writer, None)?;
    let workspace = Workspace::new(&options.project)?;
    // Helix roots every server at the working directory it reads first, so the project root
    // becomes the working directory before any thread starts or any Helix call is made.
    // What: `and_then` starts the worker only when entering the directory succeeded.
    // Why: Either failure leaves the window usable; language features then explain the reason.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let worker: LanguageWorker | Error;
    // try { process.chdir(root); worker = new LanguageWorker(root); } catch (error) { worker = error; }
    // ```
    let language_worker = enter_project_directory(workspace.root())
        .and_then(|()| return servers_wanted())
        .and_then(|()| return LanguageWorker::new(workspace.root()));
    let project_root = workspace.root().to_path_buf();
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
            bail!(
                "Cannot open source {}: it is not a regular file",
                path.display()
            );
        }
        let text = std::fs::read_to_string(path)
            .with_context(|| return format!("Cannot read UTF-8 source file {}", path.display()))?;
        (text, path.display().to_string())
    } else {
        (String::new(), String::new())
    };
    // What: `RuntimeSource::Embedded(&...)` lends the table compiled into this executable to the
    //       process-wide language runtime; `&` borrows it, and it lives as long as the program.
    // Why: Highlighting reads only these files, never Helix's runtime directories, and it must be
    //      chosen before the reload worker (bound below) prepares the first file. Both calls come
    //      after logging starts so their records are kept.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runtime.install({ kind: 'embedded', runtime: EMBEDDED_RUNTIME });
    // ```
    ide_app::runtime::install(ide_app::runtime::RuntimeSource::Embedded(
        &crate::embedded_runtime::EMBEDDED_RUNTIME,
    ));
    // Renew this build's parser cache folder, then remove other builds' folders unused for 30 days.
    ide_app::runtime::tidy_cache(&crate::embedded_runtime::EMBEDDED_RUNTIME);
    // The app id must be stamped by the backend before the window below exists.
    crate::launcher::install_backend()?;
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
    // Retain the timer until window shutdown; its Drop also closes and joins the find worker.
    let _find_timer = find::bind(&window, &state)?;
    let (_navigation_timer, navigation_state) =
        navigation::bind_shared(&window, &state, workspace)?;
    let language_binding = language::bind(
        &window,
        &state,
        &navigation_state,
        &project_root,
        language_worker,
    );
    render(&window, &state);
    // Debug builds started with `IDE_INSPECT_ANNOTATIONS` show that file's hints and diagnostics; see `inspect`.
    // The timer of delayed arrivals, when the file asks for any, lives until the window closes.
    #[cfg(debug_assertions)]
    let _inspection = inspect::inject(&window, &state)?;
    if state.borrow().file_path.is_none() {
        window.invoke_focus_tree();
    }
    window.run()?;
    // The window is gone; stopping servers may take up to about a second without freezing it.
    language_binding.close();
    // What: Ok(()) reports success without a payload; Err would carry a failure.
    // Why: Clean window closure is not a process error.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return;
    // ```
    return Ok(());
}
