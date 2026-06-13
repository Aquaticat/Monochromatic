//! AAudio output backend (raw ndk::audio). Latency-probe stage: open a silent
//! low-latency output stream, let it run briefly, and report its presentation
//! latency, proving the pure-Rust AAudio path opens and runs on the device
//! before the engine drives real audio. dum-dum-non-ts comments deferred.

use std::os::raw::c_void;
use std::time::Duration;

use ndk::audio::{
    AudioCallbackResult, AudioDirection, AudioFormat, AudioPerformanceMode, AudioStream,
    AudioStreamBuilder, Clockid,
};

const SAMPLE_RATE: i32 = 48_000;
const CHANNELS: i32 = 2;
/// Settle time after start so frames are flowing before the timestamp is read.
const SETTLE: Duration = Duration::from_millis(300);
const MILLIS_PER_SEC: f64 = 1000.0;

/// Open a silent low-latency AAudio output stream, run it briefly, and return its
/// output latency in milliseconds: the frames buffered ahead of the DAC
/// (`frames_written - presented_frame_position`) over the sample rate. Writes
/// only zeros, so it is inaudible. `None` on any failure.
pub fn measure_output_latency_ms() -> Option<f64> {
    let stream = AudioStreamBuilder::new()
        .ok()?
        .direction(AudioDirection::Output)
        .format(AudioFormat::PCM_Float)
        .sample_rate(SAMPLE_RATE)
        .channel_count(CHANNELS)
        .performance_mode(AudioPerformanceMode::LowLatency)
        .data_callback(Box::new(silent_callback))
        .open_stream()
        .ok()?;
    stream.request_start().ok()?;
    std::thread::sleep(SETTLE);
    let rate = stream.sample_rate();
    let latency = read_latency_ms(&stream, rate);
    let _ = stream.request_stop();
    latency
}

/// Data callback (AAudio realtime thread): fill the output buffer with silence
/// (a zeroed f32 is 0.0) and keep the stream running.
fn silent_callback(
    _stream: &AudioStream,
    audio_data: *mut c_void,
    num_frames: i32,
) -> AudioCallbackResult {
    let count = (num_frames.max(0) as usize) * (CHANNELS as usize);
    // SAFETY: for a PCM_Float output stream AAudio guarantees `audio_data` points
    // to `num_frames * channels` writable f32 slots; the byte 0 fills them with 0.0.
    unsafe {
        std::ptr::write_bytes(audio_data as *mut f32, 0, count);
    }
    AudioCallbackResult::Continue
}

/// Output latency in ms from the presentation timestamp: `frame_position` is the
/// frame the hardware has presented, `frames_written` is what the app has pushed,
/// so their difference is the frames buffered ahead of the DAC.
fn read_latency_ms(stream: &AudioStream, rate: i32) -> Option<f64> {
    if rate <= 0 {
        return None;
    }
    let timestamp = stream.timestamp(Clockid::Monotonic).ok()?;
    let buffered = stream.frames_written() - timestamp.frame_position;
    if buffered < 0 {
        return None;
    }
    Some((buffered as f64) / (rate as f64) * MILLIS_PER_SEC)
}
