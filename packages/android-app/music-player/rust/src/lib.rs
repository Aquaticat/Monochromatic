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

/// Decode the file at `path` fully to interleaved f32 PCM and return decode
/// throughput in microseconds per interleaved sample (directly comparable to the
/// Media3 MediaCodec ~0.33 us/sample baseline). Times the decode loop only, not
/// the open/probe. Negative returns are error codes: -1 bad path string, -2 open
/// failed, -3 decode error, -4 zero samples.
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
    let mut source = match decode::open(Path::new(&path_str)) {
        Ok(source) => source,
        Err(_) => return -2.0,
    };
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
