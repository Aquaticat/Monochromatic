//! Source tile construction, shared by the UI thread and the tile worker,
//!  and the named worker thread that builds scroll re-centers off the UI thread.

/// Requested and displayed tile bounds travel with each job.
use super::tile::TileBounds;
/// The background measurement of the whole text, its slots, and its walk.
use super::tile_pass::{PassControl, PassJob, PassKey, PassOutbox, PassOutput, PassRun};
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
    panic::{AssertUnwindSafe, catch_unwind},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
        mpsc::{Receiver, SyncSender, TryRecvError, TrySendError, sync_channel},
    },
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
    /// What the visual rows measured while shaping the tile's lines are valid for.
    pub(super) key: PassKey,
    /// Visual rows of each line of the tile, exact for the wrap width of its key.
    pub(super) measured: Vec<(usize, usize)>,
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
    // The lines this tile shaped know their own heights; the window merges them into its table.
    let mut measured = Vec::new();
    if job.viewport.wrap.is_some() {
        for row in &view.rows {
            measured.push((row.row, row.visual_rows()));
        }
    }
    view.matches = rectangles(&view, &job.ranges, job.active);
    // Annotations are positioned after shaping and never change the geometry inside a code row.
    let frame = lay_out(&view, &job.shown, shaper, job.inks);
    view.annotations = Some(frame);
    let pixels = raster.paint(&view, job.colors, 0.0)?;
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
        key: PassKey {
            file: job.file,
            revision: job.document.revision(),
            scale: job.viewport.scale.to_bits(),
            wrap: job.viewport.wrap.map_or(0, f32::to_bits),
        },
        measured,
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
///  Most lines the worker's row cache keeps.
/// Why:
///  The whole-file pass keeps every line it shaped so that a resize breaks them again instead of shaping them again;
///  measured on 2026-10-11, 50,000 kept layouts hold about 158 MB (3.2 KB a line), re-breaking them takes 40 to 80 ms
///  where shaping them takes 1 to 2 s.
///  A file longer than this keeps the lines nearest the view.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const KEPT_LAYOUTS = 50_000;
/// ```
pub(super) const KEPT_LAYOUTS: usize = 50_000;

/// What:
///  The worker's own shaper and raster, plus what the shaper's row cache was built for.
/// Why:
///  The row cache keys on revision and scale and tags each row with its wrap width,
///  so a change of styles or typography must clear or replace it.
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
    fn new(mut shaper: TextShaper) -> Self {
        let typography = shaper.typography().clone();
        shaper.keep_layouts(KEPT_LAYOUTS);
        return Self {
            shaper,
            raster: TextRaster::new(),
            typography,
            styles: None,
        };
    }

    /// Make the shaper match `typography` and the cached rows match `styles`.
    fn adopt(&mut self, typography: &SourceTypography, styles: &SourceStyles) -> Result<()> {
        if !same_typography(&self.typography, typography) {
            self.shaper = TextShaper::with_typography(typography.clone())?;
            self.shaper.keep_layouts(KEPT_LAYOUTS);
            self.typography = typography.clone();
            self.styles = None;
        }
        // A new styles snapshot can change glyph classes without changing the revision, so cached rows are dropped.
        if !self
            .styles
            .as_ref()
            .is_some_and(|known| return Arc::ptr_eq(known, styles))
        {
            self.shaper.forget_rows();
            self.styles = Some(Arc::clone(styles));
        }
        return Ok(());
    }

    /// Build `job`, first making the shaper match its typography and styles.
    fn build(&mut self, job: TileJob) -> Result<TileBuilt> {
        self.adopt(&job.typography, &job.styles)?;
        return build_tile(&mut self.shaper, &mut self.raster, job);
    }
}

/// What a worker sends back: once its shaper is ready, then one result per job.
/// Why: The window thread can tell a warm worker from a cold one without waiting for a job.
enum WorkerReply {
    /// The worker's shaper and raster are ready to build.
    Ready,
    /// The finished tile or its failure.
    Built(Box<Result<TileBuilt>>),
}

/// What the window sends the worker.
/// Why: A tile job carries its inputs; a wake only tells an idle worker to look at the pass slot.
enum Command {
    /// Build this tile.
    Tile(Box<TileJob>),
    /// A newer pass waits in the pass slot.
    Wake,
}

/// Test-only gate: the next build waits for one message before it starts, so a test can hold a job in flight.
#[cfg(test)]
pub(super) static BUILD_GATE: std::sync::Mutex<Option<Receiver<()>>> = std::sync::Mutex::new(None);

/// Test-only gate: each chunk of the pass waits for one message before it starts, so a test can release chunks
/// one at a time. Closing the sender releases the pass for good.
#[cfg(test)]
pub(super) static PASS_GATE: std::sync::Mutex<Option<Receiver<()>>> = std::sync::Mutex::new(None);

/// Wait on the test gate once, if a test installed one; the sender stays with the test.
#[cfg(test)]
fn hold_at_test_gate() {
    let gate = BUILD_GATE
        .lock()
        .ok()
        .and_then(|mut slot| return slot.take());
    if let Some(pending) = gate
        && let Err(error) = pending.recv()
    {
        tracing::debug!(%error, "test build gate closed");
    }
}

/// Wait for one token of the pass gate, if a test installed one; a closed gate lets the pass run freely.
#[cfg(test)]
fn hold_at_pass_gate() {
    let gate = PASS_GATE
        .lock()
        .ok()
        .and_then(|mut slot| return slot.take());
    if let Some(pending) = gate {
        match pending.recv() {
            Ok(()) => {
                if let Ok(mut slot) = PASS_GATE.lock() {
                    *slot = Some(pending);
                }
            }
            Err(error) => tracing::debug!(%error, "test pass gate closed"),
        }
    }
}

/// What:
///  The slots and flags the worker shares with the window thread besides its two channels.
/// Why:
///  The pass is not a stream of messages: the newest wanted pass sits in one slot,
///  and what the worker measured coalesces in another.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shared = { control: PassControl; outbox: PassOutbox; wakePending: boolean };
/// ```
#[derive(Clone, Default)]
struct Shared {
    /// The newest wanted pass.
    control: Arc<PassControl>,
    /// What the worker measured and the window has not taken.
    outbox: Arc<PassOutbox>,
    /// A wake is queued or the channel is full of commands that will make the worker look.
    wake_pending: Arc<AtomicBool>,
}

/// Own the blocking receive loop entirely outside native state.
fn run(
    shaper: TextShaper,
    requests: Receiver<Command>,
    replies: SyncSender<WorkerReply>,
    shared: Shared,
) {
    tracing::debug!("source tile worker started");
    let mut tiler = Tiler::new(shaper);
    if let Err(error) = replies.send(WorkerReply::Ready) {
        tracing::debug!(%error, "source tile reply receiver closed before the worker was ready");
        return;
    }
    let mut seen = 0_u64;
    let mut pass: Option<PassRun> = None;
    loop {
        // What: An idle worker waits for a command; a worker with a pass to carry on only glances at the channel.
        // Why: A waiting tile job always goes first, and the pass fills the time between jobs.
        let received = if pass.is_some() {
            match requests.try_recv() {
                Ok(command) => Some(command),
                Err(TryRecvError::Empty) => None,
                Err(TryRecvError::Disconnected) => {
                    tracing::debug!("source tile request channel closed");
                    return;
                }
            }
        } else {
            match requests.recv() {
                Ok(command) => Some(command),
                Err(error) => {
                    tracing::debug!(%error, "source tile request channel closed");
                    return;
                }
            }
        };
        if received.is_some() {
            shared.wake_pending.store(false, Ordering::SeqCst);
        }
        let waiting = received.is_some();
        if let Some(Command::Tile(job)) = received {
            #[cfg(test)]
            hold_at_test_gate();
            // A tile far from the walk means the reader jumped; the walk goes to the new view next.
            if let Some(run) = pass.as_mut() {
                run.refocus(job.bounds.first);
            }
            let result = tiler.build(*job);
            // A closed receiver means the window is gone; the thread stops instead of retrying.
            if let Err(error) = replies.send(WorkerReply::Built(Box::new(result))) {
                tracing::debug!(%error, "source tile reply receiver closed");
                return;
            }
        }
        if let Some(job) = shared.control.take_newer(&mut seen) {
            match tiler.adopt(&job.typography, &job.styles) {
                Ok(()) => pass = Some(PassRun::new(job)),
                Err(error) => {
                    tracing::error!(%error, "source pass could not adopt its typography");
                    pass = None;
                }
            }
        }
        if waiting {
            // Look for another command before spending time on a chunk.
            continue;
        }
        if let Some(run) = pass.as_mut() {
            #[cfg(test)]
            hold_at_pass_gate();
            let output = run.step(&mut tiler.shaper);
            let finished = output.done;
            shared.outbox.push(output);
            if finished {
                pass = None;
            }
        }
    }
}

/// Compile-time proof that jobs and results may cross to the worker thread.
const _: fn() = || {
    fn assert_send<T: Send>() {}
    assert_send::<TileJob>();
    assert_send::<PassJob>();
    assert_send::<PassOutput>();
    assert_send::<Result<TileBuilt>>();
    assert_send::<TextShaper>();
};

/// What:
///  A worker that builds at most one tile at a time, keeps only the newest waiting job,
///  and measures the whole text between jobs.
/// Why:
///  Scrolling can ask for many tiles; only the newest one still matches the view.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class TileWorker { busy = false; waiting?: TileJob; passOpen = false }
/// ```
pub(super) struct TileWorker {
    /// Taking this sender closes the request channel before joining during Drop.
    requests: Option<SyncSender<Command>>,
    /// The window thread polls this receiver without blocking.
    replies: Receiver<WorkerReply>,
    /// The pass slots shared with the worker thread.
    shared: Shared,
    /// The worker has reported that its shaper is ready.
    #[cfg(test)]
    ready: bool,
    /// A job is running or its reply is unread.
    busy: bool,
    /// A pass was posted and its last output has not been taken.
    pass_open: bool,
    /// Newest job not yet sent; an older waiting job is dropped unbuilt.
    waiting: Option<TileJob>,
    /// Joined on shutdown, never detached.
    thread: Option<JoinHandle<()>>,
}

/// Requests replace each other; polling returns each finished tile in turn.
impl TileWorker {
    /// Start a named worker with a short command queue and one reply slot, building with `shaper`.
    pub(super) fn new(shaper: TextShaper) -> Result<Self> {
        // A tile job and a wake can wait together; the window never queues more of either.
        let (request_sender, request_receiver) = sync_channel(4);
        let (reply_sender, reply_receiver) = sync_channel(1);
        let shared = Shared::default();
        let worker_shared = shared.clone();
        let worker = thread::Builder::new()
            .name("ide-source-tile".to_string())
            .spawn(move || {
                // What: `catch_unwind` (std::panic) stops an unwinding build at the thread boundary.
                // Why: A detached thread has no join to report a panic, so the panic is logged here instead.
                let outcome = catch_unwind(AssertUnwindSafe(|| {
                    run(shaper, request_receiver, reply_sender, worker_shared);
                }));
                if outcome.is_err() {
                    tracing::error!(
                        "source tile worker panicked; the next scroll re-center starts a new worker"
                    );
                }
            })
            .context("Cannot start the source tile worker")?;
        return Ok(Self {
            requests: Some(request_sender),
            replies: reply_receiver,
            shared,
            #[cfg(test)]
            ready: false,
            busy: false,
            pass_open: false,
            waiting: None,
            thread: Some(worker),
        });
    }

    /// Make `job` the only waiting request; a job already running finishes first.
    pub(super) fn request(&mut self, job: TileJob) -> Result<()> {
        self.waiting = Some(job);
        return self.dispatch();
    }

    /// What:
    ///  Make `job` the pass the worker carries on between tiles, and wake an idle worker.
    /// Why:
    ///  A newer pass replaces an older one, so the slot holds only the newest.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// postPass(job: PassJob): void;
    /// ```
    pub(super) fn post_pass(&mut self, job: PassJob) -> Result<()> {
        self.shared.control.set(job);
        self.pass_open = true;
        let sender = self
            .requests
            .as_ref()
            .context("Source tile worker is closed; restart the application")?;
        if self.shared.wake_pending.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        return match sender.try_send(Command::Wake) {
            // A full channel holds commands that make the worker look at the slot anyway.
            Ok(()) | Err(TrySendError::Full(_)) => Ok(()),
            Err(TrySendError::Disconnected(_)) => {
                bail!("Source tile worker is closed; restart the application")
            }
        };
    }

    /// Take what the pass measured since the last take, at most `limit` lines;
    ///  the pass is no longer open once its last output is taken.
    pub(super) fn take_pass(&mut self, limit: usize) -> Option<PassOutput> {
        let output = self.shared.outbox.take(limit)?;
        if output.done {
            self.pass_open = false;
        }
        return Some(output);
    }

    /// Measured lines the window has not taken yet; test-only.
    #[cfg(test)]
    pub(super) fn pending_pass_lines(&self) -> usize {
        return self.shared.outbox.waiting_lines();
    }

    /// True once the worker has reported that its shaper is ready to build.
    #[cfg(test)]
    pub(super) fn is_ready(&self) -> bool {
        return self.ready;
    }

    /// True while a job is running, its reply is unread, a job waits, or the pass is not finished;
    ///  the poll must continue while this holds.
    pub(super) fn is_busy(&self) -> bool {
        return self.busy || self.waiting.is_some() || self.pass_open;
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
            .try_send(Command::Tile(Box::new(job)))
            .map_err(|error| return anyhow::anyhow!("{error}"))
            .context("Cannot send a source tile request; restart the application")?;
        self.busy = true;
        return Ok(());
    }

    /// Poll without blocking; the inner result is the build's own success or failure.
    pub(super) fn poll(&mut self) -> Result<Option<Result<TileBuilt>>> {
        loop {
            match self.replies.try_recv() {
                Ok(WorkerReply::Ready) => {
                    #[cfg(test)]
                    {
                        self.ready = true;
                    }
                }
                Ok(WorkerReply::Built(reply)) => {
                    self.busy = false;
                    self.dispatch()?;
                    return Ok(Some(*reply));
                }
                Err(TryRecvError::Empty) => {
                    return Ok(None);
                }
                Err(TryRecvError::Disconnected) => {
                    self.busy = false;
                    self.waiting = None;
                    self.pass_open = false;
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
