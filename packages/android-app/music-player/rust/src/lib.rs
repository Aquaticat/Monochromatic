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
