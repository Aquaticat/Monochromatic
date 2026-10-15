//! The minimap's worker thread: it builds the picture of the whole text off the window thread,
//!  newest request first, and hands the finished pixels back.

/// The row key of the vertical mapping a picture is built from.
use super::rows::RowKey;
/// A worker that cannot start or has stopped is a visible diagnostic.
use anyhow::{Context, Result, bail};
/// Canonical source, cloned as a rope snapshot.
use ide_app::document::Document;
/// Which text a picture is for.
use ide_app::language::identity::DocumentStamp;
/// The picture build and its two work budgets.
use ide_app::minimap::{FULL_WORK, Input, QUICK_WORK, Stats, build};
/// The vertical mapping the picture is built from, copied into each job.
use ide_app::row_map::RowMap;
/// Shaping finds where wrapped lines break.
use ide_app::shaped_text::TextShaper;
/// Syntax classes, compared by shared identity.
use ide_app::source_style::SourceStyles;
/// Shaping choices a worker shaper must match.
use ide_app::source_typography::SourceTypography;
/// The palette whose inks the picture uses.
use ide_app::text_raster::CodeColors;
/// Pixel buffers that cross to the window thread.
use slint::{Rgba8Pixel, SharedPixelBuffer};
/// Owned snapshots and the newest-request flag are shared between the window thread and the worker.
use std::{
    panic::{AssertUnwindSafe, catch_unwind},
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
        mpsc::{Receiver, Sender, TryRecvError, channel},
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

/// What:
///  The name of the worker thread.
/// Why:
///  A debug build counts pictures built on any other thread, so a build that moves onto the window thread is seen.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const THREAD_NAME = 'ide-minimap';
/// ```
pub(super) const THREAD_NAME: &str = "ide-minimap";

/// What:
///  Pictures built on a thread other than the worker, counted in debug builds.
/// Why:
///  The structural tests assert that the window thread never builds a picture.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// let offWorkerBuilds = 0;
/// ```
#[cfg(debug_assertions)]
pub(super) static OFF_WORKER_BUILDS: AtomicU64 = AtomicU64::new(0);

/// What:
///  What a picture is valid for: the text, its syntax classes, the vertical mapping, the wrap width, the palette,
///  the display scale, and the minimap's size.
/// Why:
///  A request is posted only when this changes, and a finished picture is shown only while it still describes
///  the displayed text; the accept rule compares its stamp with the window's.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Key = { stamp: Stamp; styles: number; rows: RowKey | undefined; wrap: number; colors: Colors; scale: number;
///   size: [number, number] };
/// ```
#[derive(Clone, Copy, PartialEq)]
pub(super) struct Key {
    /// File generation and text revision.
    pub(super) stamp: DocumentStamp,
    /// Address of the syntax snapshot.
    pub(super) styles: usize,
    /// The row key of the vertical mapping that was installed.
    pub(super) rows: Option<RowKey>,
    /// Exact bits of the wrap width, zero while the view has none.
    pub(super) wrap: u32,
    /// The palette and the scheme.
    pub(super) colors: CodeColors,
    /// Exact bits of the display scale.
    pub(super) scale: u32,
    /// Exact bits of the minimap's width and height.
    pub(super) size: (u32, u32),
}

/// What:
///  One request: the owned inputs of a picture.
/// Why:
///  The worker must not borrow native state, which lives on the window thread.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Job = { id: number; key: Key; document: Document; styles: Styles; map: RowMap; /* paint inputs */ };
/// ```
pub(super) struct Job {
    /// Request number; a finished picture of an older request is never shown over a newer one.
    pub(super) id: u64,
    /// What the picture is valid for, echoed back.
    pub(super) key: Key,
    /// Rope snapshot at the revision the job was taken from.
    pub(super) document: Document,
    /// Syntax classes, shared by identity.
    pub(super) styles: SourceStyles,
    /// Shaping choices the worker shaper must match.
    pub(super) typography: SourceTypography,
    /// The vertical mapping the picture is built from.
    pub(super) map: RowMap,
    /// The palette of the source glyphs.
    pub(super) colors: CodeColors,
    /// Wrap width in logical pixels, or nothing while the view has none.
    pub(super) wrap: Option<f32>,
    /// Physical pixels per logical pixel.
    pub(super) scale: f32,
    /// Logical width and height of the minimap.
    pub(super) size: (f32, f32),
}

/// What:
///  A finished picture of a request, with what it cost.
/// Why:
///  A text whose lines cannot all be shaped within the quick budget gets two replies: the quick one, then the full.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Reply = { id: number; key: Key; last: boolean; pixels: Pixels; stats: Stats; elapsed: number };
/// ```
pub(super) struct Reply {
    /// The request this answers.
    pub(super) id: u64,
    /// What the picture is valid for.
    pub(super) key: Key,
    /// Whether this is the request's final picture.
    pub(super) last: bool,
    /// Premultiplied pixels of the picture.
    pub(super) pixels: SharedPixelBuffer<Rgba8Pixel>,
    /// What the build cost and left rough.
    pub(super) stats: Stats,
    /// Time from the start of the request to the end of this build.
    pub(super) elapsed: Duration,
}

/// Test-only gate: the next request waits for one message before it starts, so a test can hold the worker.
#[cfg(test)]
pub(super) static MINIMAP_GATE: std::sync::Mutex<Option<Receiver<()>>> =
    std::sync::Mutex::new(None);

/// Wait on the test gate once, if a test installed one; the sender stays with the test.
#[cfg(test)]
fn hold_at_test_gate() {
    let gate = MINIMAP_GATE
        .lock()
        .ok()
        .and_then(|mut slot| return slot.take());
    if let Some(pending) = gate
        && let Err(error) = pending.recv()
    {
        tracing::debug!(%error, "test minimap gate closed");
    }
}

/// What:
///  The shaper of the worker and what it was made for.
/// Why:
///  A change of typography replaces the shaper; the build itself shapes no styled rows, so no cache needs clearing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Builder { shaper: TextShaper; typography: Typography }
/// ```
struct Builder {
    /// Font and layout resources owned by the worker thread.
    shaper: TextShaper,
    /// Typography the shaper was built with.
    typography: SourceTypography,
}

/// Build the replies of one job.
impl Builder {
    /// Make the shaper match the job's typography.
    fn adopt(&mut self, typography: &SourceTypography) -> Result<()> {
        if !super::tile_build::same_typography(&self.typography, typography) {
            self.shaper = TextShaper::with_typography(typography.clone())?;
            self.typography = typography.clone();
        }
        return Ok(());
    }

    /// Build `job`'s picture with the quick budget, and with the full one when the quick one left lines rough;
    ///  `send` takes each finished picture. A newer request stops the build between pixel rows.
    fn run(&mut self, job: &Job, newest: &AtomicU64, send: &mut dyn FnMut(Reply) -> bool) {
        let started = Instant::now();
        #[cfg(debug_assertions)]
        if thread::current().name() != Some(THREAD_NAME) {
            OFF_WORKER_BUILDS.fetch_add(1, Ordering::SeqCst);
        }
        if let Err(error) = self.adopt(&job.typography) {
            tracing::error!(%error, "minimap worker could not adopt its typography");
            return;
        }
        let cancelled = || return newest.load(Ordering::Relaxed) != job.id;
        for work in [QUICK_WORK, FULL_WORK] {
            let input = Input {
                document: &job.document,
                styles: &job.styles,
                map: &job.map,
                colors: job.colors,
                wrap: job.wrap,
                scale: job.scale,
                view: job.size.1,
                width: job.size.0,
            };
            let Some(built) = build(&mut self.shaper, &input, work, &cancelled) else {
                tracing::debug!(id = job.id, "a newer minimap request stopped the build");
                return;
            };
            let last = built.stats.rough_lines == 0 || work == FULL_WORK;
            let pixels = SharedPixelBuffer::<Rgba8Pixel>::clone_from_slice(
                &built.bytes,
                built.width,
                built.height,
            );
            let reply = Reply {
                id: job.id,
                key: job.key,
                last,
                pixels,
                stats: built.stats,
                elapsed: started.elapsed(),
            };
            tracing::debug!(
                id = job.id,
                elapsed_us = reply.elapsed.as_micros() as u64,
                last,
                pixel_rows = reply.stats.pixel_rows,
                lines = reply.stats.lines,
                shaped = reply.stats.shaped_lines,
                rough = reply.stats.rough_lines,
                "minimap worker built a picture"
            );
            if !send(reply) || last {
                return;
            }
        }
    }
}

/// Own the blocking receive loop entirely outside native state.
fn serve(
    shaper: TextShaper,
    jobs: &Receiver<Job>,
    replies: &Sender<Reply>,
    newest: &Arc<AtomicU64>,
) {
    tracing::debug!("minimap worker started");
    let typography = shaper.typography().clone();
    let mut builder = Builder { shaper, typography };
    while let Ok(mut job) = jobs.recv() {
        // Only the newest waiting request is built; an older one is dropped unbuilt.
        loop {
            match jobs.try_recv() {
                Ok(next) => job = next,
                Err(TryRecvError::Empty | TryRecvError::Disconnected) => break,
            }
        }
        #[cfg(test)]
        hold_at_test_gate();
        if newest.load(Ordering::Relaxed) != job.id {
            tracing::debug!(
                id = job.id,
                "a minimap request was superseded before it started"
            );
            continue;
        }
        let mut send = |reply: Reply| {
            return replies.send(reply).is_ok();
        };
        builder.run(&job, newest, &mut send);
    }
    tracing::debug!("minimap request channel closed");
}

/// What:
///  The handle the window thread holds: the request channel, the reply channel, and the newest request's number.
/// Why:
///  Requests replace each other; polling returns each finished picture in turn.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class MinimapWorker { post(job: Job): void; poll(): Reply[] }
/// ```
pub(super) struct MinimapWorker {
    /// Taking this sender closes the request channel, which ends the worker.
    jobs: Option<Sender<Job>>,
    /// The window thread polls this receiver without blocking.
    replies: Receiver<Reply>,
    /// Number of the newest request; the build of an older one stops at its next check.
    newest: Arc<AtomicU64>,
    /// Detached on drop, never joined: closing the window does not wait for a build.
    thread: Option<JoinHandle<()>>,
}

/// Start, feed, and poll the worker.
impl MinimapWorker {
    /// Start a named worker that builds with `shaper`.
    pub(super) fn new(shaper: TextShaper) -> Result<Self> {
        let (job_sender, job_receiver) = channel::<Job>();
        let (reply_sender, reply_receiver) = channel::<Reply>();
        let newest = Arc::new(AtomicU64::new(0));
        let worker_newest = Arc::clone(&newest);
        let thread = thread::Builder::new()
            .name(THREAD_NAME.to_string())
            .spawn(move || {
                // `catch_unwind` stops an unwinding build at the thread boundary: a detached thread has no join to
                // report a panic, so it is logged here, and the next request starts a new worker.
                let outcome = catch_unwind(AssertUnwindSafe(|| {
                    serve(shaper, &job_receiver, &reply_sender, &worker_newest);
                }));
                if outcome.is_err() {
                    tracing::error!(
                        "minimap worker panicked; the next picture starts a new worker"
                    );
                }
            })
            .context("Cannot start the minimap worker")?;
        return Ok(Self {
            jobs: Some(job_sender),
            replies: reply_receiver,
            newest,
            thread: Some(thread),
        });
    }

    /// Make `job` the request the worker builds next, stopping the build of an older one.
    pub(super) fn post(&mut self, job: Job) -> Result<()> {
        self.newest.store(job.id, Ordering::SeqCst);
        let sender = self
            .jobs
            .as_ref()
            .context("The minimap worker is closed; a new one starts with the next picture")?;
        sender
            .send(job)
            .map_err(|error| return anyhow::anyhow!("{error}"))
            .context("Cannot send a minimap request")?;
        return Ok(());
    }

    /// Every finished picture waiting, oldest first; an error when the worker has stopped.
    pub(super) fn poll(&mut self) -> Result<Vec<Reply>> {
        let mut found = Vec::new();
        loop {
            match self.replies.try_recv() {
                Ok(reply) => found.push(reply),
                Err(TryRecvError::Empty) => return Ok(found),
                Err(TryRecvError::Disconnected) => {
                    self.jobs.take();
                    bail!(
                        "The minimap worker stopped unexpectedly; a new one starts with the next picture"
                    );
                }
            }
        }
    }
}

/// Close input and detach the thread, so closing the window never waits for a build in flight.
impl Drop for MinimapWorker {
    /// The detached thread ends after its current build, when the closed channel ends its loop.
    fn drop(&mut self) {
        self.jobs.take();
        if self.thread.take().is_some() {
            tracing::debug!("minimap worker detached");
        }
    }
}

/// Compile-time proof that jobs and replies may cross to the worker thread.
const _: fn() = || {
    /// Fails to compile when `T` cannot cross to another thread.
    fn assert_send<T: Send>() {}
    assert_send::<Job>();
    assert_send::<Reply>();
    assert_send::<TextShaper>();
};
