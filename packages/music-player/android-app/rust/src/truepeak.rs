//! True-peak measurement (the input to per-track loudness normalization).
//!
//! "True peak" (a.k.a. inter-sample peak) is the highest level the analog waveform
//! reaches AFTER a DAC reconstructs it between the stored samples; it can sit above the
//! largest stored sample. The Catmull-Rom oversampling meter that estimates it now lives
//! once in the shared `truepeak-core` crate (`TruePeakMeter`, `true_peak_interleaved`);
//! this module keeps only Android's own measurement POLICY on top of that shared meter: a
//! full scan for short tracks and a windowed estimate for long ones. The gain math that
//! turns a measured peak into a normalization gain still lives in the Kotlin core
//! (`TruePeak.kt`), NOT here. The windowed policy and its safety factor are a later stage's
//! target for replacement by the shared adaptive classifier; see
//! ../../../docs/handover/music-player-truepeak-core-integration.md.

/// What:     `use crate::decode::Source;`. Pull in the `Source` trait (an interface: a set
///           of method signatures any decoder type promises to implement). `crate::` means
///           "from the root of THIS crate", `decode` is the sibling module, `Source` is the
///           trait inside it. `measure_true_peak` receives a `Box<dyn Source>` and calls
///           the trait's `.spec()` / `.next_chunk()` / `.seek()` methods on it.
/// Why:      The function signatures below name `Source`, and calling a trait's methods on a
///           `dyn Source` value requires the trait to be in scope.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Source } from "./decode";
/// ```
use crate::decode::Source;

/// What:     `use crate::error::PlayerError;`. The single error type every fallible function
///           in this crate returns. `crate::error` is the sibling module, `PlayerError` the
///           enum (sum type) inside it.
/// Why:      The measurement functions return `Result<_, PlayerError>` and propagate decode
///           errors with the `?` operator, so the name must be in scope.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { PlayerError } from "./error";
/// ```
use crate::error::PlayerError;

/// What:     `use truepeak_core::TruePeakMeter;`. Pull in the shared streaming meter type
///           from the sibling in-repo crate `truepeak-core` (kebab-case on disk, but the
///           Rust crate path uses the underscore identifier form `truepeak_core`). This is
///           a cross-crate import, unlike the `crate::` imports above.
/// Why:      Android no longer defines its own meter; both its full-scan and windowed
///           policies feed decoded chunks into the ONE shared meter, so its measured peaks
///           match the desktop's exactly.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { TruePeakMeter } from "truepeak-core";
/// ```
use truepeak_core::TruePeakMeter;

/// What:     `pub use truepeak_core::true_peak_interleaved;`. Re-export the shared crate's
///           whole-buffer meter helper under this module's path, so the JNI layer's
///           `truepeak::true_peak_interleaved(...)` call site (the test-only
///           `nativeTruePeakSynthetic` entry in `lib.rs`) keeps resolving unchanged.
///           `pub use` both imports and re-exports (like `export { ... } from "..."`).
/// Why:      The one-shot meter path is shared logic; re-exporting keeps the synthetic
///           on-device test driving the exact shared meter, with no Android-local copy.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export { truePeakInterleaved } from "truepeak-core";
/// ```
pub use truepeak_core::true_peak_interleaved;

/// Windows sampled across a long track to estimate the true peak without decoding the
/// whole file: brickwalled (hot) masters hit their ceiling throughout, so a few spread
/// windows capture it, while dynamic tracks read low and normalize to unity gain.
/// See `HANDOVER.peak-sweep-optimization.md` for the validation.
const WINDOW_COUNT: usize = 4;

/// Seconds of audio decoded per sampled window.
const WINDOW_SECS: f64 = 15.0;

/// Tracks at or below this length are scanned in full; windowing saves nothing and the
/// seeks would cost more than a straight decode.
const FULL_SCAN_MAX_SECS: f64 = 90.0;

/// Linear safety factor (about +2 dB) applied to a windowed peak. Windowing can slightly
/// underestimate a hot track's true peak when the loudest instant falls between windows;
/// inflating the estimate keeps attenuate-only normalization from under-attenuating into
/// inter-sample clipping.
const WINDOW_SAFETY_FACTOR: f32 = 1.26;

/// What:     `pub fn measure_true_peak(mut source: Box<dyn Source>) -> Result<f32, PlayerError>`.
///           A public free function that scans a decoder to the end and returns the
///           estimated true peak (a linear amplitude, typically near 1.0 for full-scale
///           material). `mut source` makes the parameter binding mutable so we can advance
///           the decoder. `Box<dyn Source>` is an OWNING, heap-allocated pointer to some
///           type that implements the `Source` trait, with the concrete type erased at
///           compile time (a "trait object"); siblings: `Rc<dyn Source>` / `Arc<dyn Source>`
///           (shared, reference-counted) or `&dyn Source` (borrowed, not owned). We take
///           `Box` (owned) so the function fully consumes/drives the decoder.
///           `Result<f32, PlayerError>` is the success-or-error return. `pub` makes it
///           callable from outside this module (the JNI/Kotlin bridge invokes it).
/// Why:      This is THE measurement the per-track normalization is based on; the gain
///           calculation itself lives in Kotlin, so this function returns only the raw peak.
/// Gotcha:   The desktop sibling takes a `&Path` and opens its own decoder; this Android
///           version receives an already-open `Box<dyn Source>` and MOVES ownership of it
///           in, so the caller cannot use the decoder afterwards.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function measureTruePeak(source: Source): number { /* throws on decode error */ }
/// ```
pub fn measure_true_peak(mut source: Box<dyn Source>) -> Result<f32, PlayerError> {
    // What:     `let spec = source.spec();`. Call the trait method `.spec()` (returns an
    //           `AudioSpec`) and bind the whole descriptor so we can read channels, rate,
    //           and duration below.
    // Why:      The meter and the windowing math need the interleave width, sample rate,
    //           and track length.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const spec = source.spec();
    // ```
    let spec = source.spec();
    // What:     `let channels = spec.channels as usize;`. Read the `channels` field (a
    //           `u16`) and `as usize` widens that 16-bit count to the platform-width index
    //           type. `as` is Rust's explicit numeric cast. `usize` (siblings `u16`/`u32`)
    //           is what the meter indexes with.
    // Why:      The meter must know the interleave width.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const channels = spec.channels;
    // ```
    let channels = spec.channels as usize;
    // What:     `if channels == 0 { return Ok(0.0); }`. Guard against a malformed
    //           zero-channel stream. `Ok(0.0)` is the success variant of `Result` wrapping
    //           a peak of `0.0` (treated as silence); an explicit `return` exits early.
    // Why:      Avoids a divide-by-zero in the channel routing; a peak of 0 maps to a
    //           normalization gain of 1.0 on the Kotlin side anyway.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (channels === 0) return 0;
    // ```
    if channels == 0 {
        return Ok(0.0);
    }
    // Long tracks: sample a few spread windows instead of decoding the whole file. Hot
    // masters hit their ceiling in every window; dynamic tracks read low and fall to
    // unity gain. Short or unknown-length tracks use the full scan below.
    if spec.duration_secs > FULL_SCAN_MAX_SECS {
        // What:     `return measure_windowed_peak(source, ...);`. Hand the owned decoder to
        //           the windowed helper and return its `Result` directly. `source` is
        //           MOVED into the helper (ownership transfers), so it is unusable here
        //           afterwards, which is fine because we return immediately.
        // Why:      A full decode of a long track wastes work; the windowed estimate is
        //           Android's policy for long content.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return measureWindowedPeak(source, spec.durationSecs, spec.rate, channels);
        // ```
        return measure_windowed_peak(source, spec.duration_secs, spec.rate, channels);
    }
    // What:     `let mut meter = TruePeakMeter::new(channels);`. Construct the SHARED
    //           streaming scanner via the `Type::function` path syntax (`::`). `let mut`
    //           because we mutate the meter as we feed it.
    // Why:      The meter accumulates the peak across all chunks, using the one shared
    //           implementation.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const meter = new TruePeakMeter(channels);
    // ```
    let mut meter = TruePeakMeter::new(channels);
    // What:     `loop { ... }`. Rust's UNCONDITIONAL infinite loop (equivalent to
    //           `while (true)`); it runs until an explicit `break` inside it exits.
    // Why:      Scan the entire track until the decoder signals end-of-stream.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (true) { ... }
    // ```
    loop {
        // What:     `let chunk = source.next_chunk()?;`. Call the trait method
        //           `.next_chunk()` (returns `Result<Vec<f32>, PlayerError>`) to get the
        //           next block of interleaved samples. The trailing `?` is the propagation
        //           operator: on `Ok(v)` it unwraps to `v`; on `Err(e)` it RETURNS that
        //           error from `measure_true_peak` immediately.
        // Why:      We need the next block to feed it to the meter, and any decode error
        //           should bubble up to the caller unchanged.
        // Gotcha:   `?` is early-return-on-error, NOT TS optional chaining (`?.`).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const chunk = source.nextChunk(); // throws on failure
        // ```
        let chunk = source.next_chunk()?;
        // What:     `if chunk.is_empty() { break; }`. `.is_empty()` returns `true` when the
        //           `Vec<f32>` has length 0, which the decoder uses to signal EOF; `break`
        //           then exits the `loop`.
        // Why:      Stop scanning at the end of the track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (chunk.length === 0) break;
        // ```
        if chunk.is_empty() {
            break;
        }
        // What:     `meter.feed(&chunk);`. Push this block through the shared scanner.
        //           `&chunk` BORROWS the `Vec<f32>` read-only (lends a view) so `feed` can
        //           read it without taking ownership; `chunk` stays owned by this loop body
        //           and is freed at the end of the iteration.
        // Why:      Update the running peak with this block's samples.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // meter.feed(chunk);
        // ```
        meter.feed(&chunk);
    }
    // What:     `Ok(meter.peak())`. `meter.peak()` reads the meter's accumulated true peak
    //           (a method on the shared meter, since the field is private to
    //           `truepeak-core`). `Ok(...)` wraps it as the success variant of `Result`;
    //           no trailing `;`, so this is the function's tail expression and the return
    //           value.
    // Why:      Hand the measured true peak back to the caller (ultimately the Kotlin core,
    //           which turns it into a normalization gain).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return meter.peak;
    // ```
    Ok(meter.peak())
}

/// Estimate the true peak of a long track by sampling [`WINDOW_COUNT`] short windows
/// spread across it, seeking between them and taking the loudest. Each window gets its
/// own meter so the discontinuity between two non-adjacent windows cannot fabricate an
/// inter-sample spike at the seam. The result is inflated by [`WINDOW_SAFETY_FACTOR`].
fn measure_windowed_peak(
    mut source: Box<dyn Source>,
    duration_secs: f64,
    rate: u32,
    channels: usize,
) -> Result<f32, PlayerError> {
    let frames_per_window = (WINDOW_SECS * f64::from(rate)) as u64 * channels as u64;
    let last_start = (duration_secs - WINDOW_SECS).max(0.0);
    let mut peak = 0.0_f32;
    for window in 0..WINDOW_COUNT {
        let fraction = window as f64 / (WINDOW_COUNT - 1) as f64;
        source.seek(fraction * last_start)?;
        let mut meter = TruePeakMeter::new(channels);
        feed_window(source.as_mut(), &mut meter, frames_per_window)?;
        // What:     `peak = peak.max(meter.peak());`. `meter.peak()` reads this window's
        //           accumulated peak via the shared meter's method (the field is private to
        //           `truepeak-core`); `.max(...)` keeps the loudest window so far.
        // Why:      The windowed estimate is the maximum peak across the sampled windows.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // peak = Math.max(peak, meter.peak);
        // ```
        peak = peak.max(meter.peak());
    }
    Ok(peak * WINDOW_SAFETY_FACTOR)
}

/// Feed up to `frames` interleaved samples (one window) from `source` into `meter`,
/// stopping early at end of stream.
fn feed_window(
    source: &mut dyn Source,
    meter: &mut TruePeakMeter,
    frames: u64,
) -> Result<(), PlayerError> {
    let mut fed: u64 = 0;
    while fed < frames {
        let chunk = source.next_chunk()?;
        if chunk.is_empty() {
            break;
        }
        fed += chunk.len() as u64;
        meter.feed(&chunk);
    }
    Ok(())
}
