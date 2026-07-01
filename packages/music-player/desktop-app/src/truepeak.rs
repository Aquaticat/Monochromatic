//! Desktop true-peak measurement: a thin opener that feeds the shared meter.
//!
//! "True peak" (a.k.a. inter-sample peak) is the highest level the analog waveform
//! reaches AFTER a DAC reconstructs it between the stored samples; it can sit above the
//! largest stored sample. The measurement (the Catmull-Rom oversampling meter) and the
//! attenuate-only normalization gain used to live here in a private desktop copy; they now
//! live once in the shared `truepeak-core` crate. This module keeps only the
//! desktop-specific decode loop that feeds decoded chunks into that shared meter, plus a
//! re-export of the shared gain so existing call sites keep working. See
//! ../../../docs/handover/music-player-truepeak-core-integration.md.

/// What:     `use std::path::Path;`. Borrowed filesystem-path type (sibling: the owned
///           `PathBuf`, like `&str` vs `String`).
/// Why:      `measure_true_peak` only reads the path, so it borrows it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // a path is just a string in TS
/// ```
use std::path::Path;

/// What:     `use crate::decode;`. The decode module, for `decode::open`. The `Source`
///           trait is NOT imported: its `spec`/`next_chunk` methods are callable on the
///           `Box<dyn Source>` value through the trait object itself, with no import.
/// Why:      Measurement decodes the whole file through the same path playback uses.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as decode from "./decode";
/// ```
use crate::decode;

/// What:     `use crate::error::PlayerError;`. The single error type all fallible
///           functions in this crate return.
/// Why:      `measure_true_peak` propagates decode errors with `?`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { PlayerError } from "./error";
/// ```
use crate::error::PlayerError;

/// What:     `use truepeak_core::TruePeakMeter;`. The shared streaming meter type, pulled
///           from the sibling in-repo crate `truepeak-core` (kebab-case on disk, but Rust
///           crate paths use the underscore identifier form `truepeak_core`). This is a
///           cross-crate import, not a `crate::`/`super::` in-crate one.
/// Why:      The desktop no longer defines its own meter; it feeds decoded chunks into the
///           one shared meter so its measured peaks match Android's exactly.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { TruePeakMeter } from "truepeak-core";
/// ```
use truepeak_core::TruePeakMeter;

/// What:     `pub use truepeak_core::normalization_gain;`. Re-export the shared crate's
///           attenuate-only gain function under this module's path. `pub use` both imports
///           the item AND re-exports it, so existing callers writing
///           `crate::truepeak::normalization_gain` keep resolving unchanged.
/// Why:      The gain math is now owned by `truepeak-core`; re-exporting from here keeps
///           the desktop call sites (`src/peak_swap.rs`) pointed at the one shared
///           implementation without editing each of them, and keeps the desktop's former
///           `normalization_gain(peak)` behaviour byte-for-byte (same `CEILING`, same
///           attenuate-only clamp).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export { normalizationGain } from "truepeak-core";
/// ```
pub use truepeak_core::normalization_gain;

/// What:     `pub(crate) fn measure_true_peak(path: &Path) -> Result<f32, PlayerError>`.
///           Decode the whole file once and return its estimated true peak (linear,
///           typically near 1.0 for full-scale material). The return `Result<f32, E>` is
///           success-or-error. `pub(crate)` so the cache and background worker can call it,
///           but it is not crate-public API.
/// Why:      The desktop-specific opener: it owns the decode loop (which uses the desktop
///           `decode` module) and hands each decoded chunk to the SHARED meter, keeping
///           the platform-agnostic measurement in `truepeak-core`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function measureTruePeak(path: string): number { /* throws on decode error */ }
/// ```
pub(crate) fn measure_true_peak(path: &Path) -> Result<f32, PlayerError> {
    // What:     `let mut source = decode::open(path)?;`. Open a decoder for the file. `?`
    //           PROPAGATES a decode error (returns it from this function). `mut` because
    //           decoding advances the source.
    // Why:      We need our own decoder, separate from the one playback uses.
    // Gotcha:   `?` is early return on `Err`, not optional chaining.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const source = decode.open(path); // throws on failure
    // ```
    let mut source = decode::open(path)?;
    // What:     `let channels = source.spec().channels as usize;`. Read the channel count
    //           and `as usize` widens it for the meter's interleave width. `usize`
    //           (siblings `u16`/`u32`) is what `TruePeakMeter::new` expects.
    // Why:      The shared meter must know how many interleaved channels each frame has.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const channels = source.spec().channels;
    // ```
    let channels = source.spec().channels as usize;
    // What:     `if channels == 0 { return Ok(0.0); }`. Guard against a malformed
    //           zero-channel stream. `Ok(0.0)` wraps a peak of 0 (treated as silence) as
    //           the success variant of `Result`, and returns early.
    // Why:      Avoid the divide-by-zero in the meter's channel routing; a 0 peak maps to
    //           unity gain in `normalization_gain`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (channels === 0) return 0;
    // ```
    if channels == 0 {
        return Ok(0.0);
    }
    // What:     `let mut meter = TruePeakMeter::new(channels);`. Construct the SHARED
    //           streaming scanner sized for this many channels. `mut` because `feed`
    //           mutates its running state.
    // Why:      Accumulates the true peak across all chunks, using the one shared meter.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const meter = new TruePeakMeter(channels);
    // ```
    let mut meter = TruePeakMeter::new(channels);
    // What:     `loop { ... }`. An UNCONDITIONAL loop (Rust's `while (true)`); exited with
    //           `break` below.
    // Why:      Scan the entire track until end-of-stream.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (true) { ... }
    // ```
    loop {
        // What:     `let chunk = source.next_chunk()?;`. Next block of interleaved samples;
        //           `?` propagates a decode error.
        // Why:      Feed it to the meter.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const chunk = source.nextChunk();
        // ```
        let chunk = source.next_chunk()?;
        // What:     `if chunk.is_empty() { break; }`. An empty chunk signals EOF; `break`
        //           exits the `loop`.
        // Why:      Stop at the end of the track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (chunk.length === 0) break;
        // ```
        if chunk.is_empty() {
            break;
        }
        // What:     `meter.feed(&chunk);`. Push this block through the shared scanner.
        //           `&chunk` lends the slice read-only (we are not giving the meter
        //           ownership of the decoded buffer).
        // Why:      Update the running peak; the meter keeps its channel cursor across
        //           feeds, so chunk boundaries never move the result.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // meter.feed(chunk);
        // ```
        meter.feed(&chunk);
    }
    // What:     `Ok(meter.peak())`. `meter.peak()` reads the accumulated true peak (a
    //           method on the shared meter, since the field is private to `truepeak-core`).
    //           `Ok(...)` wraps it as the success result; tail expression -> return.
    // Why:      Hand the measured true peak back to the caller.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return meter.peak;
    // ```
    Ok(meter.peak())
}

/// What:     `#[cfg(test)] #[path = "truepeak_tests.rs"] mod tests;` declares a test-only
///           submodule whose code lives in the sibling file `truepeak_tests.rs`.
///           `#[cfg(test)]` gates it to test builds only; `#[path = "..."]` aims the module
///           at a flat sibling file instead of the default `truepeak/tests.rs` lookup. The
///           file stays the `tests` CHILD of truepeak, so its `use super::*` reaches the
///           module items unchanged.
/// Why:      Keep `truepeak.rs` to production code; the test lives beside it without
///           inflating this file or its max-lines budget (sibling `*_tests.rs` files are
///           exempt from the linter).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // truepeak.unit.test.ts, run only by the test runner
/// ```
#[cfg(test)]
#[path = "truepeak_tests.rs"]
mod tests;
