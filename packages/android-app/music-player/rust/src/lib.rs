//! Native bridge for the full-Rust engine flavor.
//!
//! JNI entry points plus the ported decode path (symphonia + libopus). The
//! self-tests prove the toolchain and decoders cross-compile and run on the
//! GrapheneOS device; `nativeDecodeBenchmark` times native decode-to-PCM so it
//! can be compared head to head against the Media3 MediaCodec baseline. The
//! verbose dum-dum-non-ts comment blocks are deferred to the finalization pass.

mod decode;
mod engine;
mod engine_worker;
mod error;
mod opus;
mod output;
mod truepeak;

use std::os::fd::RawFd;
use std::path::Path;
use std::time::Instant;

use jni::objects::{JClass, JString};
use jni::sys::{jboolean, jdouble, jfloat, jint, jlong};
use jni::JNIEnv;

/// JNI smoke test: returns a fixed sentinel so the Kotlin side can confirm the
/// native library loaded and a value crossed the boundary intact.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativePing<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jint {
    42
}

/// Self-test for the bundled libopus C library: construct a 48 kHz stereo opus
/// decoder on-device. 1 = success, 0 = failure. `::opus` is the extern crate
/// (the sibling `opus` module would otherwise shadow it at the crate root).
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeOpusSelfTest<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jint {
    match ::opus::Decoder::new(48_000, ::opus::Channels::Stereo) {
        Ok(_decoder) => 1,
        Err(_error) => 0,
    }
}

/// Self-test for symphonia: force its pure-Rust prober + codec registry to
/// initialize on-device. `black_box` stops the optimizer eliding the calls. 1 = ok.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeSymphoniaSelfTest<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jint {
    std::hint::black_box(symphonia::default::get_probe());
    std::hint::black_box(symphonia::default::get_codecs());
    1
}

/// Decode `source` fully to interleaved f32 PCM, timing only the decode loop, and
/// return microseconds per interleaved sample (directly comparable to the Media3
/// MediaCodec ~0.33 baseline). Exercises seek once untimed so the seek path is
/// covered on-device too. Shared by the path and fd benchmarks. Negative returns:
/// -3 decode error, -4 zero samples.
fn benchmark_decode(mut source: Box<dyn decode::Source>) -> jdouble {
    let spec = source.spec();
    std::hint::black_box((spec.rate, spec.channels, spec.duration_secs));
    let start = Instant::now();
    let mut total_samples: u64 = 0;
    loop {
        match source.next_chunk() {
            Ok(chunk) if chunk.is_empty() => break,
            Ok(chunk) => {
                total_samples += chunk.len() as u64;
                std::hint::black_box(&chunk);
            }
            Err(_) => return -3.0,
        }
    }
    let elapsed = start.elapsed();
    // Exercise seek once (untimed) so the seek path is covered on-device too; the
    // engine (task #12) drives it for real.
    let _ = source.seek(0.0);
    if total_samples == 0 {
        return -4.0;
    }
    (elapsed.as_nanos() as f64) / 1000.0 / (total_samples as f64)
}

/// Decode the file at `path` fully to interleaved f32 PCM and return decode
/// throughput in microseconds per interleaved sample. Times the decode loop only,
/// not the open/probe. Negative returns: -1 bad path string, -2 open failed, plus
/// the shared codes from `benchmark_decode`.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeDecodeBenchmark<'local>(
    env: JNIEnv<'local>,
    _class: JClass<'local>,
    path: JString<'local>,
) -> jdouble {
    let mut env = env;
    let path_str: String = match env.get_string(&path) {
        Ok(value) => value.into(),
        Err(_) => return -1.0,
    };
    let source = match decode::open(Path::new(&path_str)) {
        Ok(source) => source,
        Err(_) => return -2.0,
    };
    benchmark_decode(source)
}

/// Decode the `content://` file descriptor `fd` fully to interleaved f32 PCM and
/// return decode throughput in microseconds per interleaved sample, proving the fd
/// path (symphonia over a borrowed Android ParcelFileDescriptor, the way the engine
/// loads tracks) decodes and seeks on-device. `fd` is the borrowed
/// `ParcelFileDescriptor.getFd()`; `open_borrowed_fd` dups it synchronously so the
/// JVM keeps and closes the original. Negative returns: -1 bad fd, -2 dup/open
/// failed, plus the shared codes from `benchmark_decode`.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeDecodeFdBenchmark<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    fd: jint,
) -> jdouble {
    // BorrowedFd::borrow_raw panics on -1, and that panic across extern "system"
    // would abort, so reject a negative fd here in the error-code convention.
    if fd < 0 {
        return -1.0;
    }
    let source = match decode::open_borrowed_fd(fd as RawFd) {
        Ok(source) => source,
        Err(_) => return -2.0,
    };
    benchmark_decode(source)
}

/// Decode the `content://` file descriptor `fd` fully and return its true peak (4x
/// Catmull-Rom oversampled, the loudness-normalization input the Kotlin core turns into
/// a gain). `fd` is the borrowed `ParcelFileDescriptor.getFd()`; `open_borrowed_fd` dups
/// it synchronously. Negative returns: -1 bad fd, -2 dup/open failed, -3 decode error.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeMeasureTruePeak<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    fd: jint,
) -> jfloat {
    if fd < 0 {
        return -1.0;
    }
    let source = match decode::open_borrowed_fd(fd as RawFd) {
        Ok(source) => source,
        Err(_) => return -2.0,
    };
    match truepeak::measure_true_peak(source) {
        Ok(peak) => peak,
        Err(_) => -3.0,
    }
}

/// Open a silent low-latency AAudio output stream (raw ndk::audio) and return its
/// measured output latency in milliseconds, proving the pure-Rust AAudio path
/// opens and runs on the device. Inaudible (writes zeros). -1.0 on failure.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeOutputLatencyProbe<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jdouble {
    match output::measure_output_latency_ms() {
        Some(ms) => ms,
        None => -1.0,
    }
}

/// Create the native playback engine and return an opaque handle (a boxed `Engine`
/// pointer as a jlong), or 0 if the worker thread could not be spawned. The handle
/// must be released exactly once with `nativeEngineRelease` and only used from the
/// one Kotlin thread that owns it.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineCreate<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jlong {
    match engine::Engine::new() {
        Ok(engine_value) => Box::into_raw(Box::new(engine_value)) as jlong,
        Err(_) => 0,
    }
}

/// Load a `content://` fd into the engine and optionally start playing. `fd` is the
/// borrowed `ParcelFileDescriptor.getFd()`, duplicated synchronously. Returns 0 on
/// success, -1 bad fd, -2 dup/dispatch failed, -3 null handle.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineLoad<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
    fd: jint,
    play: jboolean,
) -> jint {
    if handle == 0 {
        return -3;
    }
    if fd < 0 {
        return -1;
    }
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    match engine_ref.load(fd as RawFd, play != 0) {
        Ok(()) => 0,
        Err(_) => -2,
    }
}

/// Resume playback of the loaded track.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEnginePlay<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) {
    if handle == 0 {
        return;
    }
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    engine_ref.play();
}

/// Pause playback, keeping the loaded track and buffered audio.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEnginePause<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) {
    if handle == 0 {
        return;
    }
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    engine_ref.pause();
}

/// Seek the loaded track to `position_sec`.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineSeek<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
    position_sec: jdouble,
) {
    if handle == 0 {
        return;
    }
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    engine_ref.seek_to(position_sec);
}

/// Set the user volume (linear gain in 0.0..1.0).
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineSetVolume<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
    volume: jfloat,
) {
    if handle == 0 {
        return;
    }
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    engine_ref.set_volume(volume);
}

/// Set the per-track true-peak normalization gain (linear, 0.0..1.0), applied with the volume.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineSetNormalizationGain<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
    gain: jfloat,
) {
    if handle == 0 {
        return;
    }
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    engine_ref.set_normalization_gain(gain);
}

/// Current playback position in seconds (0.0 when nothing is loaded).
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEnginePositionSec<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) -> jdouble {
    if handle == 0 {
        return 0.0;
    }
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    engine_ref.position_sec()
}

/// Loaded track duration in seconds (0.0 when unknown).
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineDurationSec<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) -> jdouble {
    if handle == 0 {
        return 0.0;
    }
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    engine_ref.duration_sec()
}

/// Whether the engine is actually sounding (playing and not yet ended).
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineIsPlaying<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) -> jboolean {
    if handle == 0 {
        return jboolean::from(false);
    }
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    jboolean::from(engine_ref.is_playing())
}

/// Whether the loaded track has played through to its end.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineIsEnded<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) -> jboolean {
    if handle == 0 {
        return jboolean::from(false);
    }
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    jboolean::from(engine_ref.is_ended())
}

/// Play intent (true from a play/load-and-play request until a pause).
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEnginePlayWhenReady<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) -> jboolean {
    if handle == 0 {
        return jboolean::from(false);
    }
    let engine_ref = unsafe { &mut *(handle as *mut engine::Engine) };
    jboolean::from(engine_ref.play_when_ready())
}

/// Release the engine: stop the worker, close the AAudio stream, and free the handle.
/// The handle must not be used afterwards.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeEngineRelease<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) {
    if handle == 0 {
        return;
    }
    // SAFETY: `handle` came from a single `nativeEngineCreate` Box::into_raw and is
    // released exactly once; reclaiming the Box drops the Engine (joining the worker).
    unsafe {
        drop(Box::from_raw(handle as *mut engine::Engine));
    }
}
