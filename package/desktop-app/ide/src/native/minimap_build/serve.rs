//! The serving loop of the minimap worker:
//!  it takes the newest request,
//! builds its picture in the quick and the full pass,
//!  and keeps the rendered units between requests.

/// The job,
/// the key,
/// the reply,
/// and the thread name.
use super::{Job, Reply};
/// Typography comparison shared with the tile worker.
use crate::native::tile_build::same_typography;
/// The picture build,
/// its budgets,
/// its cache,
/// and its inputs.
use ide_app::minimap::{
    Built, Cache, Cancel, FULL_WORK, Identity, Input, Pass, QUICK_WORK, Scene, build, prepare,
};
/// Shaping finds where wrapped lines break.
use ide_app::shaped_text::TextShaper;
/// The painter whose glyph cache the worker keeps.
use ide_app::text_raster::TextRaster;
/// Pixel buffers that cross to the window thread.
use slint::{Rgba8Pixel, SharedPixelBuffer};
/// The newest-request flag and the channels.
use std::{
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
        mpsc::{Receiver, Sender, TryRecvError},
    },
    time::Instant,
};

/// Test-only gate:
/// the next request waits for one message before it starts,
/// so a test can hold the worker.
#[cfg(test)]
pub(in crate::native) static MINIMAP_GATE: std::sync::Mutex<Option<Receiver<()>>> =
    std::sync::Mutex::new(None);

/// Wait on the test gate once,
/// if a test installed one;
/// the sender stays with the test.
#[cfg(test)]
fn hold_at_test_gate() {
    let gate = match MINIMAP_GATE.lock() {
        Ok(mut slot) => slot.take(),
        Err(_poisoned) => None,
    };
    if let Some(pending) = gate
        && let Err(error) = pending.recv()
    {
        tracing::debug!(%error, "test minimap gate closed");
    }
}

/// A build is cancelled once a newer request than its own was posted.
struct Superseded<'a> {
    /// The number of the newest request.
    newest: &'a AtomicU64,
    /// The number of the request being built.
    id: u64,
}

/// A build asks whether a newer request replaced it.
impl Cancel for Superseded<'_> {
    /// Whether a newer request was posted since this build began.
    fn is_cancelled(&self) -> bool {
        return self.newest.load(Ordering::Relaxed) != self.id;
    }
}

/// Where a build hands each finished picture.
trait ReplySink {
    /// Take one finished picture;
    ///  false once nobody receives pictures any more.
    fn deliver(&mut self, reply: Reply) -> bool;
}

/// Pictures go to the window thread through the reply channel.
struct ChannelSink<'a> {
    /// The reply channel of the worker.
    replies: &'a Sender<Reply>,
}

/// The reply channel is where the window thread reads pictures.
impl ReplySink for ChannelSink<'_> {
    /// Send the picture;
    ///  false when the receiving side is gone.
    fn deliver(&mut self, reply: Reply) -> bool {
        return self.replies.send(reply).is_ok();
    }
}

/// What:
///  The shaper and the painter of the worker,
///  what they were made for,
///  and the units of the last picture.
/// Why:
///  A change of typography replaces the shaper and empties the cache;
///  another file or other classes empty the shaper's rows,
/// which carry the classes' inks.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Builder { shaper: TextShaper; raster: TextRaster; cache: Cache }
/// ```
struct Builder {
    /// Font and layout resources owned by the worker thread.
    shaper: TextShaper,
    /// Glyph images and scalers owned by the worker thread.
    raster: TextRaster,
    /// The units of the last picture.
    cache: Cache,
    /// The file generation and the address of the classes the shaper's rows were shaped for.
    shaped_for: Option<(u64, usize)>,
}

/// Build the replies of one job.
impl Builder {
    /// Make the shaper match the job's typography and the text it shapes.
    fn adopt(&mut self, job: &Job) -> anyhow::Result<()> {
        if !same_typography(self.shaper.typography(), &job.typography) {
            self.shaper = TextShaper::with_typography(job.typography.clone())?;
            self.cache.clear();
            self.shaped_for = None;
        }
        let now = (job.key.stamp.file, job.key.styles);
        if self.shaped_for != Some(now) {
            self.shaper.forget_rows();
            self.shaped_for = Some(now);
        }
        return Ok(());
    }

    /// Hand one finished picture to `send`;
    ///  false when nobody receives it any more.
    fn reply(
        &self,
        job: &Job,
        built: Built,
        last: bool,
        started: Instant,
        send: &mut dyn ReplySink,
    ) -> bool {
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
            units = reply.stats.units,
            rendered = reply.stats.rendered,
            reused = reply.stats.reused,
            skipped = reply.stats.skipped,
            failed = reply.stats.failed,
            "minimap worker built a picture"
        );
        return send.deliver(reply);
    }

    /// Build `job`'s picture:
    ///  a coarse one first when the full one would cost more than the quick budget,
    ///  then the full one,
    ///  which renders only the units the cache does not hold.
    ///  `send` takes each finished picture.
    ///  A newer request stops the build between units.
    fn run(&mut self, job: &Job, newest: &AtomicU64, send: &mut dyn ReplySink) {
        let started = Instant::now();
        #[cfg(debug_assertions)]
        if std::thread::current().name() != Some(super::THREAD_NAME) {
            super::OFF_WORKER_BUILDS.fetch_add(1, Ordering::SeqCst);
        }
        if let Err(error) = self.adopt(job) {
            tracing::error!(%error, "minimap worker could not adopt its typography");
            return;
        }
        let cancelled = Superseded { newest, id: job.id };
        let scene = Scene {
            document: &job.document,
            styles: &job.styles,
            map: &job.map,
            colors: job.colors,
            inks: job.inks,
            fills: job.fills,
            blocks: &job.blocks,
            marks: &job.marks,
            ranges: &job.ranges,
            active: job.active,
            wrap: job.wrap,
            width: ide_app::shaped_text::raster_width(job.wrap),
            scale: job.scale,
        };
        let input = Input {
            scene,
            identity: Identity {
                stamp: job.key.stamp,
                styles: job.key.styles,
            },
            view: job.size.1,
            width: job.size.0,
        };
        let full = prepare(&input, Pass::Full);
        if full.pending_work(&scene, &self.cache) > QUICK_WORK {
            let quick = prepare(&input, Pass::Quick);
            let Some(coarse) = build(
                &mut self.shaper,
                &mut self.raster,
                &input,
                &quick,
                None,
                FULL_WORK,
                &cancelled,
            ) else {
                tracing::debug!(id = job.id, "a newer minimap request stopped the build");
                return;
            };
            if !self.reply(job, coarse, false, started, send) {
                return;
            }
        }
        let Some(done) = build(
            &mut self.shaper,
            &mut self.raster,
            &input,
            &full,
            Some(&mut self.cache),
            FULL_WORK,
            &cancelled,
        ) else {
            tracing::debug!(id = job.id, "a newer minimap request stopped the build");
            return;
        };
        self.reply(job, done, true, started, send);
    }
}

/// Own the blocking receive loop entirely outside native state.
pub(super) fn serve(
    shaper: TextShaper,
    jobs: &Receiver<Job>,
    replies: &Sender<Reply>,
    newest: &Arc<AtomicU64>,
) {
    tracing::debug!("minimap worker started");
    let mut builder = Builder {
        shaper,
        raster: TextRaster::new(),
        cache: Cache::new(),
        shaped_for: None,
    };
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
        let mut send = ChannelSink { replies };
        builder.run(&job, newest, &mut send);
    }
    tracing::debug!("minimap request channel closed");
}
