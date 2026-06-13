//! Native playback engine: the per-track primitive behind Kotlin's `AudioEngine`.
//! A single worker thread owns the decode `Source`, the SPSC ring producer, and
//! the AAudio output stream, and processes `Command`s; the realtime AAudio callback
//! only pops samples, gates on the play flag, applies volume, and advances the
//! played-frame counter. Kotlin drives it over JNI and POLLS state from `Control`'s
//! atomics (no native-to-JVM callbacks). Ports the desktop engine's ringbuf + worker
//! model to AAudio; the queue/advance/shuffle stay in Kotlin's PlayerController.
//! dum-dum-non-ts comments deferred to finalization.

use std::os::fd::{BorrowedFd, RawFd};
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::Arc;
use std::thread::{self, JoinHandle};

use crate::engine_worker;
use crate::error::PlayerError;

/// Milliseconds per second, for the duration/position unit Kotlin reads.
pub(crate) const MILLIS_PER_SEC: f64 = 1000.0;

/// Shared, lock-free control + telemetry across the main (JNI) thread, the decode
/// worker, and the AAudio callback. Every field is atomic; the realtime callback
/// path never locks. The worker writes `rate`/`channels`/`duration_ms`/`decode_done`
/// on load+seek; the callback writes `frames_played`/`ended`; the main thread writes
/// `playing`/`volume_bits`; everyone reads.
pub(crate) struct Control {
    /// Play gate: true drains the ring to the device, false outputs silence.
    pub(crate) playing: AtomicBool,
    /// User volume as `f32` bits, applied per-sample in the callback for instant response.
    pub(crate) volume_bits: AtomicU32,
    /// Output sample rate of the loaded track, 0 when nothing is loaded.
    pub(crate) rate: AtomicU32,
    /// Channel count of the loaded track.
    pub(crate) channels: AtomicU32,
    /// Frame the current stream started at (the seek target), added to `frames_played`.
    pub(crate) start_frame: AtomicU64,
    /// Frames the callback has actually played since the last load/seek.
    pub(crate) frames_played: AtomicU64,
    /// Loaded track duration in milliseconds, 0 when unknown.
    pub(crate) duration_ms: AtomicU64,
    /// Set by the worker when the decoder reaches EOF or errors.
    pub(crate) decode_done: AtomicBool,
    /// Set by the callback when `decode_done` and the ring has drained: the track ended.
    pub(crate) ended: AtomicBool,
    /// Per-track true-peak normalization gain as `f32` bits, applied with the volume in the callback.
    pub(crate) norm_gain_bits: AtomicU32,
}

impl Control {
    /// Fresh control with unity volume and nothing loaded.
    pub(crate) fn new() -> Control {
        Control {
            playing: AtomicBool::new(false),
            volume_bits: AtomicU32::new(1.0f32.to_bits()),
            rate: AtomicU32::new(0),
            channels: AtomicU32::new(0),
            start_frame: AtomicU64::new(0),
            frames_played: AtomicU64::new(0),
            duration_ms: AtomicU64::new(0),
            decode_done: AtomicBool::new(false),
            ended: AtomicBool::new(false),
            norm_gain_bits: AtomicU32::new(1.0f32.to_bits()),
        }
    }

    /// Current user volume as a linear gain.
    pub(crate) fn volume(&self) -> f32 {
        f32::from_bits(self.volume_bits.load(Ordering::Relaxed))
    }

    /// Current per-track true-peak normalization gain.
    pub(crate) fn norm_gain(&self) -> f32 {
        f32::from_bits(self.norm_gain_bits.load(Ordering::Relaxed))
    }
}

/// Worker inputs that need the worker's owned state (the source and the output
/// stream). Play/pause/volume bypass this channel and write `Control` atomics
/// directly, so they take effect on the next callback with no round trip.
pub(crate) enum Command {
    /// Open the dup-backed file (a `content://` fd duplicate), build the output, and
    /// optionally start playing.
    Load(std::fs::File, bool),
    /// Reposition the loaded source to the given second and flush the ring.
    Seek(f64),
    /// Stop the worker; dropping its state closes the AAudio stream.
    Quit,
}

/// Main-thread handle to the engine (the value behind the JNI `jlong`). Holds the
/// command channel, the worker join handle, and the shared control; the AAudio
/// stream lives in the worker, so this is `Send`. All methods are called from the
/// one Kotlin thread that owns the handle.
pub struct Engine {
    /// Send end of the command channel to the worker.
    tx: Sender<Command>,
    /// Worker join handle, taken in `Drop` to join after `Quit`.
    worker: Option<JoinHandle<()>>,
    /// Shared control read by `position`/`duration`/`is_playing`/`is_ended`.
    control: Arc<Control>,
    /// Play intent (`playWhenReady`): what Kotlin last asked for, distinct from the
    /// actual sounding state.
    play_intent: bool,
}

impl Engine {
    /// Spawn the worker and return the handle. Errs only if the OS refuses the thread.
    pub fn new() -> Result<Engine, std::io::Error> {
        let control = Arc::new(Control::new());
        let (tx, rx) = mpsc::channel::<Command>();
        let worker_control = Arc::clone(&control);
        let worker = thread::Builder::new()
            .name("mp-engine".to_string())
            .spawn(move || engine_worker::worker_run(rx, worker_control))?;
        Ok(Engine {
            tx,
            worker: Some(worker),
            control,
            play_intent: false,
        })
    }

    /// Duplicate the borrowed fd (the JVM keeps the original) and hand the dup-backed
    /// file to the worker to open and play. The caller guarantees `fd >= 0` and that
    /// the fd is alive for this synchronous call (Kotlin is inside the PFD's `use {}`).
    pub fn load(&mut self, fd: RawFd, play: bool) -> Result<(), PlayerError> {
        // SAFETY: `fd` is a valid, open descriptor for this synchronous call; only
        // borrowed here, the dup below is what the worker keeps.
        let borrowed = unsafe { BorrowedFd::borrow_raw(fd) };
        let file = std::fs::File::from(borrowed.try_clone_to_owned()?);
        self.play_intent = play;
        self.tx
            .send(Command::Load(file, play))
            .map_err(|_| PlayerError::Unsupported("engine worker gone".to_string()))?;
        Ok(())
    }

    /// Resume the loaded track: the callback un-gates on the next buffer.
    pub fn play(&mut self) {
        self.play_intent = true;
        self.control.playing.store(true, Ordering::Release);
    }

    /// Pause: the callback outputs silence on the next buffer, keeping buffered audio.
    pub fn pause(&mut self) {
        self.play_intent = false;
        self.control.playing.store(false, Ordering::Release);
    }

    /// Seek the loaded track to `position_sec`; the worker reflushes the ring.
    pub fn seek_to(&self, position_sec: f64) {
        let _ = self.tx.send(Command::Seek(position_sec));
    }

    /// Set the user volume (linear gain), applied per-sample in the callback.
    pub fn set_volume(&self, volume: f32) {
        self.control
            .volume_bits
            .store(volume.to_bits(), Ordering::Relaxed);
    }

    /// Set the per-track true-peak normalization gain (linear), applied with the volume.
    pub fn set_normalization_gain(&self, gain: f32) {
        self.control
            .norm_gain_bits
            .store(gain.to_bits(), Ordering::Relaxed);
    }

    /// Current playback position in seconds: the seek base plus frames played, over
    /// the sample rate; 0 when nothing is loaded.
    pub fn position_sec(&self) -> f64 {
        let rate = self.control.rate.load(Ordering::Acquire);
        if rate == 0 {
            return 0.0;
        }
        let frames =
            self.control.start_frame.load(Ordering::Acquire) + self.control.frames_played.load(Ordering::Acquire);
        frames as f64 / rate as f64
    }

    /// Loaded track duration in seconds, 0 when unknown.
    pub fn duration_sec(&self) -> f64 {
        self.control.duration_ms.load(Ordering::Acquire) as f64 / MILLIS_PER_SEC
    }

    /// Whether the engine is actually sounding (playing and not yet ended).
    pub fn is_playing(&self) -> bool {
        self.control.playing.load(Ordering::Acquire) && !self.control.ended.load(Ordering::Acquire)
    }

    /// Whether the loaded track has played through to its end; Kotlin's poller
    /// de-duplicates this into a single `onTrackEnded`.
    pub fn is_ended(&self) -> bool {
        self.control.ended.load(Ordering::Acquire)
    }

    /// Play intent (true from a play/load-and-play request until a pause).
    pub fn play_when_ready(&self) -> bool {
        self.play_intent
    }
}

impl Drop for Engine {
    fn drop(&mut self) {
        let _ = self.tx.send(Command::Quit);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}
