//! Native bridge for the full-Rust engine flavor.
//!
//! JNI entry points plus the ported decode path (symphonia + libopus). The
//! self-tests prove the toolchain and decoders cross-compile and run on the
//! GrapheneOS device; `nativeDecodeBenchmark` times native decode-to-PCM so it
//! can be compared head to head against the Media3 MediaCodec baseline. The
//! verbose dum-dum-non-ts comment blocks are deferred to the finalization pass.

mod decode;
mod error;
mod opus;
mod output;

use std::os::fd::RawFd;
use std::path::Path;
use std::time::Instant;

use jni::objects::{JClass, JString};
use jni::sys::{jdouble, jint};
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
