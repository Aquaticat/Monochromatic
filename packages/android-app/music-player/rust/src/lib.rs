//! Native bridge for the full-Rust engine flavor.
//!
//! Smoke-test stage: a single JNI entry point that returns a constant, proving
//! the cargo-ndk -> .so -> System.loadLibrary -> JNI-call path works on the
//! device (notably under GrapheneOS, which blocks dynamic code loading and broke
//! Slint) before the symphonia/opus engine is ported in. The verbose
//! dum-dum-non-ts comment blocks are deferred to the finalization pass.

use jni::objects::JClass;
use jni::sys::jint;
use jni::JNIEnv;

/// JNI entry for `dev.monochromatic.musicplayer.NativeBridge.nativePing`.
/// Returns a fixed sentinel (42) so the Kotlin side can confirm the native
/// library loaded and a value crossed the boundary intact. Replaced by the real
/// engine surface once the toolchain is proven.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativePing<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jint {
    42
}

/// Self-test for the bundled libopus C library: construct a 48 kHz stereo opus
/// decoder on-device. Returning 1 proves opusic-sys's cmake-built libopus
/// cross-compiled for arm64 and actually runs on the device; 0 means decoder
/// creation failed.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeOpusSelfTest<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jint {
    match opus::Decoder::new(48_000, opus::Channels::Stereo) {
        Ok(_decoder) => 1,
        Err(_error) => 0,
    }
}

/// Self-test for symphonia: force its pure-Rust format prober and codec registry
/// to initialize on-device, proving symphonia cross-compiled and links into the
/// .so. `black_box` stops the optimizer from eliding the registry calls. Returns 1.
#[no_mangle]
pub extern "system" fn Java_dev_monochromatic_musicplayer_NativeBridge_nativeSymphoniaSelfTest<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> jint {
    std::hint::black_box(symphonia::default::get_probe());
    std::hint::black_box(symphonia::default::get_codecs());
    1
}
