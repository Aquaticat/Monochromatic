//! The engine worker thread and the AAudio realtime callback. The worker owns the
//! decode `Source`, the SPSC ring producer, and the AAudio stream, and is the only
//! thread that touches them; the callback (on AAudio's realtime thread) owns the
//! ring consumer and only pops/gates/advances. Load and seek both rebuild the
//! output through `reconfigure_output`, which is how the ring is flushed (the
//! desktop engine's mechanism). dum-dum-non-ts comments deferred to finalization.

use std::os::raw::c_void;
use std::sync::atomic::Ordering;
use std::sync::mpsc::{Receiver, TryRecvError};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use ndk::audio::{
    AudioCallbackResult, AudioDirection, AudioFormat, AudioPerformanceMode, AudioStream,
    AudioStreamBuilder,
};
use ringbuf::traits::{Consumer, Producer, Split};
use ringbuf::{HeapCons, HeapProd, HeapRb};
use symphonia::core::formats::probe::Hint;

use crate::decode::{self, Source};
use crate::engine::{Command, Control, MILLIS_PER_SEC};
use crate::error::PlayerError;

/// Minimum ring capacity in samples, a floor for degenerate low-rate/mono tracks so
/// the buffer always holds enough to ride out scheduling jitter.
const MIN_RING: usize = 8192;
/// Idle nap when the ring is full or nothing is loaded, so the worker tops the ring
/// up promptly (well under the ~1s buffer) without spinning a core.
const IDLE_SLEEP: Duration = Duration::from_millis(5);

/// Worker-owned playback state. None of it crosses to another thread except through
/// the SPSC ring (the consumer half lives in the callback); the AAudio stream is
/// `!Send` and stays on this thread for its whole life.
struct WorkerState {
    /// Decoder for the loaded track (the dup-backed `content://` fd).
    source: Option<Box<dyn Source>>,
    /// Current AAudio output stream; dropping it closes the stream and stops the callback.
    stream: Option<AudioStream>,
    /// Ring producer the pump pushes decoded samples into.
    prod: Option<HeapProd<f32>>,
    /// Samples decoded but not yet accepted by a full ring (backpressure carryover).
    pending: Vec<f32>,
    /// Read cursor into `pending`.
    pending_pos: usize,
}

impl WorkerState {
    /// Empty state with nothing loaded.
    fn new() -> WorkerState {
        WorkerState {
            source: None,
            stream: None,
            prod: None,
            pending: Vec::new(),
            pending_pos: 0,
        }
    }
}

/// Worker entry point: drain commands, pump the ring, nap when idle. Returns (and so
/// drops the AAudio stream, stopping audio) on `Quit` or a dead channel.
pub(crate) fn worker_run(rx: Receiver<Command>, control: Arc<Control>) {
    let mut state = WorkerState::new();
    loop {
        loop {
            match rx.try_recv() {
                Ok(Command::Load(file, play)) => handle_load(&mut state, &control, file, play),
                Ok(Command::Seek(position_sec)) => handle_seek(&mut state, &control, position_sec),
                Ok(Command::Quit) => return,
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => return,
            }
        }
        let did_work = if state.source.is_some() {
            pump(&mut state, &control)
        } else {
            false
        };
        if !did_work {
            thread::sleep(IDLE_SLEEP);
        }
    }
}

/// Open the dup-backed file, reset the control telemetry, build the output, and set
/// the play gate. Any failure leaves the engine idle (no source, silent).
fn handle_load(state: &mut WorkerState, control: &Arc<Control>, file: std::fs::File, play: bool) {
    state.stream = None;
    state.prod = None;
    state.source = None;
    state.pending.clear();
    state.pending_pos = 0;
    let source = match decode::open_media_source(Box::new(file), Hint::new()) {
        Ok(source) => source,
        Err(_) => return,
    };
    let spec = source.spec();
    if spec.rate == 0 || spec.channels == 0 {
        return;
    }
    control.rate.store(spec.rate, Ordering::Release);
    control.channels.store(spec.channels as u32, Ordering::Release);
    control.start_frame.store(0, Ordering::Release);
    control.frames_played.store(0, Ordering::Release);
    control
        .duration_ms
        .store((spec.duration_secs * MILLIS_PER_SEC) as u64, Ordering::Release);
    control.decode_done.store(false, Ordering::Release);
    control.ended.store(false, Ordering::Release);
    // Set the gate before the stream opens, so the new stream's first callback reads the right play
    // state (a load-paused track must not briefly sound at the previous track's state).
    control.playing.store(play, Ordering::Release);
    state.source = Some(source);
    if reconfigure_output(state, control, spec.rate, spec.channels).is_err() {
        control.playing.store(false, Ordering::Release);
        state.source = None;
    }
}

/// Reposition the loaded source and rebuild the output, which flushes the ring (its
/// pre-seek samples are dropped with the old stream). The play gate is untouched.
fn handle_seek(state: &mut WorkerState, control: &Arc<Control>, position_sec: f64) {
    let (rate, channels) = match state.source.as_mut() {
        Some(source) => {
            let _ = source.seek(position_sec);
            let spec = source.spec();
            (spec.rate, spec.channels)
        }
        None => return,
    };
    if rate == 0 || channels == 0 {
        return;
    }
    state.pending.clear();
    state.pending_pos = 0;
    control.decode_done.store(false, Ordering::Release);
    control.ended.store(false, Ordering::Release);
    let clamped = if position_sec > 0.0 { position_sec } else { 0.0 };
    control
        .start_frame
        .store((clamped * rate as f64).round() as u64, Ordering::Release);
    control.frames_played.store(0, Ordering::Release);
    let _ = reconfigure_output(state, control, rate, channels);
}

/// Drop the old output and build a fresh ring + AAudio stream at the track's rate,
/// moving the new consumer into the stream's data callback. Started immediately; the
/// play gate decides whether the callback sounds it.
fn reconfigure_output(
    state: &mut WorkerState,
    control: &Arc<Control>,
    rate: u32,
    channels: u16,
) -> Result<(), PlayerError> {
    state.stream = None;
    state.prod = None;
    let capacity = ((rate as usize) * (channels as usize)).max(MIN_RING);
    let ring = HeapRb::<f32>::new(capacity);
    let (prod, mut cons) = ring.split();
    state.prod = Some(prod);
    let callback_control = Arc::clone(control);
    let callback_channels = channels as usize;
    let stream = AudioStreamBuilder::new()
        .map_err(audio_error)?
        .direction(AudioDirection::Output)
        .format(AudioFormat::PCM_Float)
        .sample_rate(rate as i32)
        .channel_count(channels as i32)
        .performance_mode(AudioPerformanceMode::LowLatency)
        .data_callback(Box::new(
            move |_stream: &AudioStream, data: *mut c_void, frames: i32| {
                audio_callback(&mut cons, data, frames, &callback_control, callback_channels)
            },
        ))
        .open_stream()
        .map_err(audio_error)?;
    stream.request_start().map_err(audio_error)?;
    state.stream = Some(stream);
    Ok(())
}

/// Push one unit of decoded audio: first the stashed backpressure carryover, then one
/// fresh chunk. Returns whether any samples were accepted (false means the ring is
/// full or the track is fully decoded, so the worker should nap).
fn pump(state: &mut WorkerState, control: &Control) -> bool {
    let mut did_work = false;
    if state.pending_pos < state.pending.len() {
        let pushed = match state.prod.as_mut() {
            Some(prod) => prod.push_slice(&state.pending[state.pending_pos..]),
            None => return false,
        };
        state.pending_pos += pushed;
        did_work |= pushed > 0;
        if state.pending_pos < state.pending.len() {
            return did_work;
        }
        state.pending.clear();
        state.pending_pos = 0;
    }
    if control.decode_done.load(Ordering::Acquire) {
        return did_work;
    }
    let chunk = match state.source.as_mut() {
        Some(source) => match source.next_chunk() {
            Ok(chunk) => chunk,
            Err(_) => {
                control.decode_done.store(true, Ordering::Release);
                return did_work;
            }
        },
        None => return false,
    };
    if chunk.is_empty() {
        control.decode_done.store(true, Ordering::Release);
        return did_work;
    }
    let pushed = match state.prod.as_mut() {
        Some(prod) => prod.push_slice(&chunk),
        None => return false,
    };
    did_work |= pushed > 0;
    if pushed < chunk.len() {
        state.pending = chunk;
        state.pending_pos = pushed;
    }
    did_work
}

/// AAudio realtime data callback: fill `data` with the next frames. Silence when
/// paused (buffered audio is kept for resume); otherwise pop from the ring, apply
/// volume, zero-fill any underrun, flag end-of-track when the decoder is done and the
/// ring has drained, and advance the played-frame counter.
fn audio_callback(
    cons: &mut HeapCons<f32>,
    data: *mut c_void,
    frames: i32,
    control: &Control,
    channels: usize,
) -> AudioCallbackResult {
    let total = (frames.max(0) as usize) * channels;
    // SAFETY: for a PCM_Float output stream AAudio guarantees `data` points to
    // `frames * channels` writable f32 slots.
    let out = unsafe { std::slice::from_raw_parts_mut(data as *mut f32, total) };
    if !control.playing.load(Ordering::Acquire) {
        out.fill(0.0);
        return AudioCallbackResult::Continue;
    }
    let popped = cons.pop_slice(out);
    let volume = control.volume();
    if volume != 1.0 {
        for sample in &mut out[..popped] {
            *sample *= volume;
        }
    }
    if popped < total {
        out[popped..].fill(0.0);
        if control.decode_done.load(Ordering::Acquire) {
            control.ended.store(true, Ordering::Release);
        }
    }
    if channels > 0 {
        control
            .frames_played
            .fetch_add((popped / channels) as u64, Ordering::AcqRel);
    }
    AudioCallbackResult::Continue
}

/// Wrap any AAudio builder/stream error in a `PlayerError` so the worker can `?` it.
fn audio_error<E: std::fmt::Debug>(error: E) -> PlayerError {
    PlayerError::Audio(format!("{error:?}"))
}
