//! Source tile construction, shared by the UI thread and the tile worker,
//!  and the named worker thread that builds scroll re-centers off the UI thread.

/// Requested and displayed tile bounds travel with each job.
use super::tile::TileBounds;
/// Worker-start and build failures stay visible diagnostics.
use anyhow::{Context, Result, bail};
/// Visible hints and diagnostic marks are paint inputs of the tile.
use ide_app::annotation::Visible;
/// Hint and diagnostic inks, and the lay-out that places them beside the rows.
use ide_app::annotation_layout::{AnnotationColors, lay_out};
/// Canonical source text, cloned as a rope snapshot.
use ide_app::document::Document;
/// In-file find ranges and the active match, painted from the same rows as selection.
use ide_app::find::{FindRange, FindRanges};
/// Match rectangles of the materialized rows.
use ide_app::find_paint::rectangles;
/// The one vertical mapping, copied into each job.
use ide_app::row_map::RowMap;
/// Shared shaping, the viewport description, and the frame's rows.
use ide_app::shaped_text::{ShapedView, TextShaper, Viewport};
/// Paint identity of a tile, compared again when its result arrives.
use ide_app::source_frame::FrameStamp;
/// Syntax classifications, compared by shared identity.
use ide_app::source_style::SourceStyles;
/// Shaping choices a worker shaper must match.
use ide_app::source_typography::SourceTypography;
/// Glyph rasterizer and palette of one tile.
use ide_app::text_raster::{CodeColors, TextRaster};
/// Pixel buffers that cross to the window thread.
use slint::{Rgba8Pixel, SharedPixelBuffer};
/// Owned snapshots are shared between the UI and worker threads.
use std::{
    sync::{
        Arc,
        mpsc::{Receiver, SyncSender, TryRecvError, sync_channel},
    },
    panic::{AssertUnwindSafe, catch_unwind},
    thread::{self, JoinHandle},
};

/// What:
///  `struct` groups named fields into one owned value;
///  every field here is owned, so the whole job moves to another thread.
/// Why:
///  The worker must not borrow native state, which lives on the window thread.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type TileJob = { bounds: Bounds; document: Document; styles: Styles; /* paint inputs */ };
/// ```
pub(super) struct TileJob {
    /// Tile bounds this job builds, echoed back in the result.
    pub(super) bounds: TileBounds,
    /// File-open generation the snapshot belongs to.
    pub(super) file: u64,
    /// Rope snapshot at the revision the job was taken from.
    pub(super) document: Document,
    /// Syntax classifications, shared by identity.
    pub(super) styles: SourceStyles,
    /// Shaping choices the worker shaper must match.
    pub(super) typography: SourceTypography,
    /// Materialized lines, width, and scale.
    pub(super) viewport: Viewport,
    /// Horizontal tile origin.
    pub(super) horizontal: f32,
    /// Vertical mapping the rows are placed by.
    pub(super) map: RowMap,
    /// Palette of the source glyphs and selection.
    pub(super) colors: CodeColors,
    /// Hint and diagnostic inks.
    pub(super) inks: AnnotationColors,
    /// Visible annotations of the tile's lines.
    pub(super) shown: std::sync::Arc<Visible>,
    /// Find ranges to paint as matches.
    pub(super) ranges: FindRanges,
    /// The match the find bar selects.
    pub(super) active: Option<FindRange>,
    /// Paint identity the result must still match.
    pub(super) stamp: FrameStamp,
}

/// What:
///  A finished tile: the shaped rows and rectangles, and the pixels to show.
/// Why:
///  The window thread swaps all of them in together, so the image and its offset always belong to one tile.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type TileBuilt = { bounds: Bounds; view: ShapedView; pixels: RGBA8[]; stamp: Stamp };
/// ```
pub(super) struct TileBuilt {
    /// Tile bounds that were built.
    pub(super) bounds: TileBounds,
    /// File-open generation the tile was built for.
    pub(super) file: u64,
    /// Shaped rows, rectangles, and annotation positions.
    pub(super) view: ShapedView,
    /// Premultiplied pixels of the tile.
    pub(super) pixels: SharedPixelBuffer<Rgba8Pixel>,
    /// Paint identity the tile was built for.
    pub(super) stamp: FrameStamp,
    /// Active match used for the match rectangles.
    pub(super) active: Option<FindRange>,
    /// Source rows shaped while building this tile, counted in debug builds for the structural tests.
    #[cfg(debug_assertions)]
    pub(super) rows_shaped: u64,
}

/// What:
///  `fn` declares a function; `&mut` lends the shaper and raster for this call only;
///  `Result<TileBuilt>` is the built tile or the reason it could not be built.
/// Why:
///  The same code paints a tile on the window thread and on the worker, so both produce the same pixels.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function buildTile(shaper: TextShaper, raster: TextRaster, job: TileJob): TileBuilt;
/// ```
pub(super) fn build_tile(
    shaper: &mut TextShaper,
    raster: &mut TextRaster,
    job: TileJob,
) -> Result<TileBuilt> {
    #[cfg(debug_assertions)]
    let before = shaper.shaped_rows();
    let mut view = shaper.prepare_rows(&job.document, job.viewport, &job.styles, &job.map);
    view.matches = rectangles(
        &view,
        &job.ranges,
        job.active,
        job.horizontal,
        job.horizontal + job.viewport.width,
    );
    // Annotations are positioned after shaping and never change the geometry inside a code row.
    let frame = lay_out(&view, &job.shown, shaper, job.inks);
    view.annotations = Some(frame);
    let pixels = raster.paint(&view, job.colors, job.horizontal)?;
    // Premultiplied pixels share the font engine's baseline and advances.
    let buffer = SharedPixelBuffer::<Rgba8Pixel>::clone_from_slice(
        &pixels.bytes,
        pixels.width,
        pixels.height,
    );
    return Ok(TileBuilt {
        bounds: job.bounds,
        file: job.file,
        view,
        pixels: buffer,
        stamp: job.stamp,
        active: job.active,
        #[cfg(debug_assertions)]
        rows_shaped: shaper.shaped_rows() - before,
    });
}

/// Whether two typographies make the same glyphs.
fn same_typography(left: &SourceTypography, right: &SourceTypography) -> bool {
    return left.weight == right.weight
        && left.italic == right.italic
        && left.features == right.features;
}

/// What:
///  The worker's own shaper and raster, plus what the shaper's row cache was built for.
/// Why:
///  The row cache keys on revision and scale only, so a change of styles or typography must clear or replace it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Tiler { shaper: TextShaper; raster: TextRaster; styles?: Styles }
/// ```
struct Tiler {
    /// Font and layout resources owned by the worker thread.
    shaper: TextShaper,
    /// Glyph rasterizer owned by the worker thread.
    raster: TextRaster,
    /// Typography the shaper was built with.
    typography: SourceTypography,
    /// Syntax classifications the cached rows were shaped with, by identity.
    styles: Option<SourceStyles>,
}

/// Build one job with the worker's resources, clearing its row cache when styles or typography changed.
impl Tiler {
    /// Start from a shaper forked from the window's own, so the worker shares its fonts and typography.
    fn new(shaper: TextShaper) -> Self {
        let typography = shaper.typography().clone();
        return Self {
            shaper,
            raster: TextRaster::new(),
            typography,
            styles: None,
        };
    }

    /// Build `job`, first making the shaper match its typography and styles.
    fn build(&mut self, job: TileJob) -> Result<TileBuilt> {
        if !same_typography(&self.typography, &job.typography) {
            self.shaper = TextShaper::with_typography(job.typography.clone())?;
            self.typography = job.typography.clone();
            self.styles = None;
        }
        // A new styles snapshot can change glyph classes without changing the revision, so cached rows are dropped.
        if !self
            .styles
            .as_ref()
            .is_some_and(|styles| return Arc::ptr_eq(styles, &job.styles))
        {
            self.shaper.forget_rows();
            self.styles = Some(Arc::clone(&job.styles));
        }
        return build_tile(&mut self.shaper, &mut self.raster, job);
    }
}

/// What a worker sends back: once its shaper is ready, then one result per job.
/// Why: The window thread can tell a warm worker from a cold one without waiting for a job.
enum WorkerReply {
    /// The worker's shaper and raster are ready to build.
    Ready,
    /// The finished tile or its failure.
    Built(Result<TileBuilt>),
}

/// Test-only gate: the next build waits for one message before it starts, so a test can hold a job in flight.
#[cfg(test)]
pub(super) static BUILD_GATE: std::sync::Mutex<Option<Receiver<()>>> = std::sync::Mutex::new(None);

/// Wait on the test gate once, if a test installed one; the sender stays with the test.
#[cfg(test)]
fn hold_at_test_gate() {
    let gate = BUILD_GATE.lock().ok().and_then(|mut slot| return slot.take());
    if let Some(gate) = gate
        && let Err(error) = gate.recv()
    {
        tracing::debug!(%error, "test build gate closed");
    }
}

/// Own the blocking receive loop entirely outside native state.
fn run(shaper: TextShaper, requests: Receiver<TileJob>, replies: SyncSender<WorkerReply>) {
    tracing::debug!("source tile worker started");
    let mut tiler = Tiler::new(shaper);
    if let Err(error) = replies.send(WorkerReply::Ready) {
        tracing::debug!(%error, "source tile reply receiver closed before the worker was ready");
        return;
    }
    loop {
        // What: `match` extracts either an owned job or the closed-channel condition.
        // Why: Closing the owner ends this thread without an unhandled channel error.
        let job = match requests.recv() {
            Ok(job) => job,
            Err(error) => {
                tracing::debug!(%error, "source tile request channel closed");
                return;
            }
        };
        #[cfg(test)]
        hold_at_test_gate();
        let result = tiler.build(job);
        // A closed receiver means the window is gone; the thread stops instead of retrying.
        if let Err(error) = replies.send(WorkerReply::Built(result)) {
            tracing::debug!(%error, "source tile reply receiver closed");
            return;
        }
    }
}

/// Compile-time proof that jobs and results may cross to the worker thread.
const _: fn() = || {
    fn assert_send<T: Send>() {}
    assert_send::<TileJob>();
    assert_send::<Result<TileBuilt>>();
    assert_send::<TextShaper>();
};

/// What:
///  A worker that builds at most one tile at a time and keeps only the newest waiting job.
/// Why:
///  Scrolling can ask for many tiles; only the newest one still matches the view.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class TileWorker { busy = false; waiting?: TileJob }
/// ```
pub(super) struct TileWorker {
    /// Taking this sender closes the request channel before joining during Drop.
    requests: Option<SyncSender<TileJob>>,
    /// The window thread polls this receiver without blocking.
    replies: Receiver<WorkerReply>,
    /// The worker has reported that its shaper is ready.
    ready: bool,
    /// A job is running or its reply is unread.
    busy: bool,
    /// Newest job not yet sent; an older waiting job is dropped unbuilt.
    waiting: Option<TileJob>,
    /// Joined on shutdown, never detached.
    thread: Option<JoinHandle<()>>,
}

/// Requests replace each other; polling returns each finished tile in turn.
impl TileWorker {
    /// Start a named worker with one request slot and one reply slot, building with `shaper`.
    pub(super) fn new(shaper: TextShaper) -> Result<Self> {
        let (request_sender, request_receiver) = sync_channel(1);
        let (reply_sender, reply_receiver) = sync_channel(1);
        let worker = thread::Builder::new()
            .name("ide-source-tile".to_string())
            .spawn(move || {
                // What: `catch_unwind` (std::panic) stops an unwinding build at the thread boundary.
                // Why: A detached thread has no join to report a panic, so the panic is logged here instead.
                let outcome = catch_unwind(AssertUnwindSafe(|| {
                    run(shaper, request_receiver, reply_sender);
                }));
                if outcome.is_err() {
                    tracing::error!("source tile worker panicked; the next scroll re-center starts a new worker");
                }
            })
            .context("Cannot start the source tile worker")?;
        return Ok(Self {
            requests: Some(request_sender),
            replies: reply_receiver,
            ready: false,
            busy: false,
            waiting: None,
            thread: Some(worker),
        });
    }

    /// Make `job` the only waiting request; a job already running finishes first.
    pub(super) fn request(&mut self, job: TileJob) -> Result<()> {
        self.waiting = Some(job);
        return self.dispatch();
    }

    /// True once the worker has reported that its shaper is ready to build.
    pub(super) fn is_ready(&self) -> bool {
        return self.ready;
    }

    /// True while a job is running, its reply is unread, or a job waits; the poll must continue while this holds.
    pub(super) fn is_busy(&self) -> bool {
        return self.busy || self.waiting.is_some();
    }

    /// Close the request channel so the idle worker thread ends, as a crashed worker would; test-only.
    #[cfg(test)]
    pub(super) fn close_for_test(&mut self) {
        self.requests.take();
    }

    /// Drop the waiting job; a running job finishes and its reply is left for the caller to discard.
    pub(super) fn cancel(&mut self) {
        self.waiting = None;
    }

    /// Send the waiting job when the single build slot is free.
    fn dispatch(&mut self) -> Result<()> {
        if self.busy {
            return Ok(());
        }
        let Some(job) = self.waiting.take() else {
            return Ok(());
        };
        let sender = self
            .requests
            .as_ref()
            .context("Source tile worker is closed; restart the application")?;
        sender
            .try_send(job)
            .context("Cannot send a source tile request; restart the application")?;
        self.busy = true;
        return Ok(());
    }

    /// Poll without blocking; the inner result is the build's own success or failure.
    pub(super) fn poll(&mut self) -> Result<Option<Result<TileBuilt>>> {
        loop {
            match self.replies.try_recv() {
                Ok(WorkerReply::Ready) => {
                    self.ready = true;
                }
                Ok(WorkerReply::Built(reply)) => {
                    self.busy = false;
                    self.dispatch()?;
                    return Ok(Some(reply));
                }
                Err(TryRecvError::Empty) => {
                    return Ok(None);
                }
                Err(TryRecvError::Disconnected) => {
                    self.busy = false;
                    self.waiting = None;
                    self.requests.take();
                    bail!(
                        "The source tile worker stopped unexpectedly; restart the application to scroll the source"
                    );
                }
            }
        }
    }
}

/// Close input before joining so the last bounded reply can complete.
impl Drop for TileWorker {
    /// Close the request channel and detach the thread, so closing the window never waits for a build in flight.
    /// The detached thread ends after its current build, when the closed channel ends its loop.
    fn drop(&mut self) {
        self.requests.take();
        // Dropping the join handle detaches the thread; there is no cancellation point inside a build to stop it earlier.
        if self.thread.take().is_some() {
            tracing::debug!("source tile worker detached");
        }
    }
}
