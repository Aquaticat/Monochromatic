//! True-peak measurement and the normalization gain it feeds.
//!
//! "True peak" (a.k.a. inter-sample peak) is the highest level the analog
//! waveform reaches AFTER a DAC reconstructs it between the stored samples; it
//! can sit above the largest stored sample. We estimate it by oversampling each
//! channel ~4x with a cubic (Catmull-Rom) interpolation and taking the largest
//! magnitude seen. `normalization_gain` turns a measured true peak into a single
//! constant gain that brings the track down to a -1 dBTP ceiling (never up), so
//! playback cannot overflow the converter.

// What:     `use std::path::Path;`. Borrowed filesystem-path type (sibling: the
//           owned `PathBuf`, like `&str` vs `String`).
// Why:      `measure_true_peak` only reads the path, so it borrows it.
// TS map:   `Path` is just `string` in TS.
use std::path::Path;

// What:     `use crate::decode;`. The decode module, for `decode::open`. The `Source`
//           trait is NOT imported: its `spec`/`next_chunk` methods are callable on the
//           `Box<dyn Source>` value through the trait object itself, with no import.
// Why:      Measurement decodes the whole file through the same path playback uses.
// TS map:   `import * as decode from "./decode";`
use crate::decode;

// What:     `use crate::error::PlayerError;`. The single error type all fallible
//           functions in this crate return.
// Why:      `measure_true_peak` propagates decode errors with `?`.
// TS map:   `import { PlayerError } from "./error";`
use crate::error::PlayerError;

// What:     `const HALF: f32 = 1.0 / 2.0;`. The fraction one-half. Composed from
//           the always-allowed range rather than written as a bare `0.5` literal.
// Why:      Used as the Catmull-Rom 1/2 scale factor and to build the sample
//           offsets below.
// TS map:   `const HALF = 1 / 2;`
const HALF: f32 = 1.0 / 2.0;

// What:     `const QUARTER: f32 = HALF / 2.0;`. One-quarter (0.25), built from HALF.
// Why:      The first of three interior sample positions between two samples.
// TS map:   `const QUARTER = HALF / 2;`
const QUARTER: f32 = HALF / 2.0;

// What:     `const THREE_QUARTERS: f32 = HALF + QUARTER;`. Three-quarters (0.75).
// Why:      The third interior sample position.
// TS map:   `const THREE_QUARTERS = HALF + QUARTER;`
const THREE_QUARTERS: f32 = HALF + QUARTER;

// What:     `const CEILING: f32 = 0.891_250_9;`. The true-peak target, 10^(-1/20),
//           i.e. -1 dBTP. `f32` (sibling: `f64`) to match the PCM sample type.
//           `10f32.powf` is not a `const fn`, so the precomputed value is written.
// Why:      The level we normalize each track's true peak down to; -1 dBTP is the
//           EBU R128 / ATSC A/85 ceiling that leaves room for the DAC's reconstruction.
// TS map:   `const CEILING = 10 ** (-1 / 20); // -1 dBTP`
const CEILING: f32 = 0.891_250_9;

// What:     `const WINDOW: usize = 4;`. Number of consecutive samples the cubic
//           interpolation needs (two on each side of the interval it fills).
// Why:      Catmull-Rom evaluates the curve between the 2nd and 3rd of four points.
// TS map:   `const WINDOW = 4;`
const WINDOW: usize = 4;

// What:     `fn catmull_rom(p0: f32, p1: f32, p2: f32, p3: f32, t: f32) -> f32`.
//           Evaluate the Catmull-Rom cubic through four equally-spaced points at
//           position `t` (0.0..=1.0) on the segment BETWEEN `p1` and `p2`. Positional
//           params match the existing Rust style here (Rust has no object params).
// Why:      Estimates the waveform between two samples, where inter-sample peaks live.
// TS map:   `function catmullRom(p0,p1,p2,p3,t: number): number`
fn catmull_rom(p0: f32, p1: f32, p2: f32, p3: f32, t: f32) -> f32 {
    // What:     `let t2 = t * t;` and `let t3 = t2 * t;`. The square and cube of `t`.
    //           Plain float multiplies (TS-identical).
    // Why:      The cubic polynomial below uses t, t^2, t^3.
    // TS map:   `const t2 = t * t; const t3 = t2 * t;`
    let t2 = t * t;
    let t3 = t2 * t;
    // What:     The Catmull-Rom basis evaluated for these four points. The literal
    //           coefficients (2, 3, 4, 5) are the standard spline matrix entries;
    //           `HALF` is the 1/2 normalization. Tail expression -> return value.
    // Why:      Standard closed form (Catmull & Rom, 1974); reproduces p1 at t=0 and
    //           p2 at t=1 with a smooth curve through the neighbours p0/p3.
    // TS map:   `return 0.5 * (2*p1 + (p2-p0)*t + (2*p0-5*p1+4*p2-p3)*t2 + (3*p1-3*p2+p3-p0)*t3);`
    HALF * (2.0 * p1
        + (p2 - p0) * t
        + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
        + (3.0 * p1 - 3.0 * p2 + p3 - p0) * t3)
}

// What:     `struct TruePeakMeter { ... }`. Running state for the streaming peak
//           scan: how many channels, a 4-sample sliding window PER channel, how
//           many real samples each channel has seen, and the largest magnitude so far.
// Why:      Lets us scan the file chunk by chunk without holding the whole track
//           in memory (constant memory: a few floats per channel).
// TS map:   `class TruePeakMeter { channels; win; filled; peak; }`
struct TruePeakMeter {
    // What:     `channels: usize`. Channel count (interleave width). `usize`
    //           (siblings: `u16`/`u32`) because it indexes the per-channel vectors.
    // Why:      Demultiplex interleaved samples into per-channel windows.
    // TS map:   `channels: number;`
    channels: usize,
    // What:     `win: Vec<[f32; WINDOW]>`. One fixed-size array of the last 4 samples
    //           per channel. `[f32; 4]` is a fixed-length array (sibling: `Vec<f32>`,
    //           a growable one); fixed because the window never changes size.
    // Why:      Cubic interpolation needs the latest four samples of a channel.
    // TS map:   `win: number[][];  // each inner array length 4`
    win: Vec<[f32; WINDOW]>,
    // What:     `filled: Vec<usize>`. Per channel, how many real samples have arrived
    //           (capped at WINDOW). `usize` counts.
    // Why:      Only interpolate once a channel's window holds four real samples.
    // TS map:   `filled: number[];`
    filled: Vec<usize>,
    // What:     `peak: f32`. Largest absolute sample/interpolated value seen so far.
    // Why:      This is the measured true peak when the scan ends.
    // TS map:   `peak: number;`
    peak: f32,
}

// What:     `impl TruePeakMeter { ... }`. The meter's behaviour.
// Why:      Construction and feeding samples.
// TS map:   the class body.
impl TruePeakMeter {
    // What:     `fn new(channels: usize) -> TruePeakMeter`. Build a meter sized for
    //           `channels` channels, all windows zeroed.
    // Why:      Starting state for a scan.
    // TS map:   `constructor(channels)`
    fn new(channels: usize) -> TruePeakMeter {
        // What:     `TruePeakMeter { ... }`. Struct literal. `vec![[0.0; WINDOW]; channels]`
        //           builds `channels` copies of a zeroed 4-array; `vec![0; channels]`
        //           builds `channels` zero counts. Tail -> return.
        // Why:      One window and one counter per channel, peak starts at 0.
        // TS map:   `return { channels, win: ..., filled: ..., peak: 0 };`
        TruePeakMeter {
            channels,
            win: vec![[0.0; WINDOW]; channels],
            filled: vec![0; channels],
            peak: 0.0,
        }
    }

    // What:     `fn feed(&mut self, chunk: &[f32])`. Push one interleaved chunk of
    //           samples through the meter. `&[f32]` is a borrowed read-only slice.
    // Why:      Update the running peak with this block of audio.
    // TS map:   `feed(chunk: number[]): void`
    fn feed(&mut self, chunk: &[f32]) {
        // What:     `for (i, &s) in chunk.iter().enumerate() { ... }`. Iterate the
        //           slice with indices. `&s` pattern copies each `f32` out by value.
        // Why:      The index decides which channel a sample belongs to.
        // TS map:   `chunk.forEach((s, i) => { ... })`
        for (i, &s) in chunk.iter().enumerate() {
            // What:     `let channel = i % self.channels;`. Interleaved layout puts
            //           channel `i % channels` at index `i` (`%` is remainder).
            // Why:      Route the sample to its channel window.
            // TS map:   `const channel = i % this.channels;`
            let channel = i % self.channels;
            // What:     `self.push(channel, s);`. Feed one sample to one channel.
            // Why:      Per-channel processing.
            // TS map:   `this.push(channel, s);`
            self.push(channel, s);
        }
    }

    // What:     `fn push(&mut self, channel: usize, s: f32)`. Slide one sample into a
    //           channel's window, update the raw peak, and (once the window is full)
    //           sample the interpolated curve between the two middle points.
    // Why:      The core inter-sample peak step.
    // TS map:   `push(channel: number, s: number): void`
    fn push(&mut self, channel: usize, s: f32) {
        // What:     `let w = self.win[channel];`. COPY the 4-array out (arrays of
        //           `Copy` types are `Copy`), so we can read it without holding a
        //           borrow of `self` while we also write `self.peak` below.
        // Why:      Avoids a borrow-checker conflict between the window and the peak.
        // TS map:   `const w = this.win[channel];`
        let w = self.win[channel];
        // What:     `let shifted = [w[1], w[2], w[3], s];`. The window with the oldest
        //           sample dropped and the new sample `s` appended at the end.
        // Why:      Maintain the last four samples in order.
        // TS map:   `const shifted = [w[1], w[2], w[3], s];`
        let shifted = [w[1], w[2], w[3], s];
        // What:     `self.win[channel] = shifted;`. Store the advanced window.
        // Why:      Next push builds on it.
        // TS map:   `this.win[channel] = shifted;`
        self.win[channel] = shifted;
        // What:     `self.filled[channel] = (self.filled[channel] + 1).min(WINDOW);`.
        //           Count real samples, capping at 4. `.min(WINDOW)` clamps the count.
        // Why:      Know when four real samples are available to interpolate.
        // TS map:   `this.filled[channel] = Math.min(this.filled[channel] + 1, WINDOW);`
        self.filled[channel] = (self.filled[channel] + 1).min(WINDOW);
        // What:     `let mut local_peak = s.abs();`. Start from this sample's magnitude.
        //           `.abs()` is the absolute value. `let mut` because the interior
        //           points below may raise it (mutation is local to this function).
        // Why:      The stored sample itself is a peak candidate.
        // TS map:   `let localPeak = Math.abs(s);`
        let mut local_peak = s.abs();
        // What:     `if self.filled[channel] == WINDOW { ... }`. Only interpolate once
        //           the window holds four real samples.
        // Why:      Cubic interpolation needs all four points.
        // TS map:   `if (this.filled[channel] === WINDOW) { ... }`
        if self.filled[channel] == WINDOW {
            // What:     `for t in [QUARTER, HALF, THREE_QUARTERS] { ... }`. Evaluate the
            //           curve at three interior positions between `shifted[1]` and
            //           `shifted[2]`. Iterating an array literal by value (f32 is Copy).
            // Why:      ~4x oversampling: catch peaks that fall between stored samples.
            // TS map:   `for (const t of [QUARTER, HALF, THREE_QUARTERS]) { ... }`
            for t in [QUARTER, HALF, THREE_QUARTERS] {
                // What:     `let v = catmull_rom(shifted[0], shifted[1], shifted[2], shifted[3], t).abs();`.
                //           Interpolated magnitude at offset `t` on the middle segment.
                // Why:      A candidate inter-sample peak.
                // TS map:   `const v = Math.abs(catmullRom(...shifted, t));`
                let v = catmull_rom(shifted[0], shifted[1], shifted[2], shifted[3], t).abs();
                // What:     `local_peak = local_peak.max(v);`. Keep the larger.
                // Why:      Track the highest interior value.
                // TS map:   `localPeak = Math.max(localPeak, v);`
                local_peak = local_peak.max(v);
            }
        }
        // What:     `self.peak = self.peak.max(local_peak);`. Fold this sample's best
        //           candidate into the running maximum.
        // Why:      The overall true peak is the max across the whole track.
        // TS map:   `this.peak = Math.max(this.peak, localPeak);`
        self.peak = self.peak.max(local_peak);
    }
}

// What:     `pub(crate) fn measure_true_peak(path: &Path) -> Result<f32, PlayerError>`.
//           Decode the whole file once and return its estimated true peak (linear,
//           typically near 1.0 for full-scale material). `pub(crate)` so the cache
//           and background worker can call it, but it is not crate-public API.
// Why:      The measurement that per-track normalization is based on.
// TS map:   `function measureTruePeak(path: string): number  // throws on decode error`
pub(crate) fn measure_true_peak(path: &Path) -> Result<f32, PlayerError> {
    // What:     `let mut source = decode::open(path)?;`. Open a decoder for the file.
    //           `?` PROPAGATES a decode error (returns it from this function). `mut`
    //           because decoding advances the source.
    // Why:      We need our own decoder, separate from the one playback uses.
    // TS map:   `const source = decode.open(path); // throws on failure`
    let mut source = decode::open(path)?;
    // What:     `let channels = source.spec().channels as usize;`. Read the channel
    //           count and widen it to `usize` for indexing.
    // Why:      The meter must know the interleave width.
    // TS map:   `const channels = source.spec().channels;`
    let channels = source.spec().channels as usize;
    // What:     `if channels == 0 { return Ok(0.0); }`. Guard against a malformed
    //           zero-channel stream. `Ok(0.0)` wraps a peak of 0 (treated as silence).
    // Why:      Avoid a divide-by-zero in the channel routing; 0 peak -> gain 1.0.
    // TS map:   `if (channels === 0) return 0;`
    if channels == 0 {
        return Ok(0.0);
    }
    // What:     `let mut meter = TruePeakMeter::new(channels);`. The running scanner.
    // Why:      Accumulates the peak across all chunks.
    // TS map:   `const meter = new TruePeakMeter(channels);`
    let mut meter = TruePeakMeter::new(channels);
    // What:     `loop { ... }`. Pull chunks until end-of-stream.
    // Why:      Scan the entire track.
    // TS map:   `while (true) { ... }`
    loop {
        // What:     `let chunk = source.next_chunk()?;`. Next block of interleaved
        //           samples; `?` propagates a decode error.
        // Why:      Feed it to the meter.
        // TS map:   `const chunk = source.nextChunk();`
        let chunk = source.next_chunk()?;
        // What:     `if chunk.is_empty() { break; }`. An empty chunk signals EOF.
        // Why:      Stop at the end of the track.
        // TS map:   `if (chunk.length === 0) break;`
        if chunk.is_empty() {
            break;
        }
        // What:     `meter.feed(&chunk);`. Push this block through the scanner. `&chunk`
        //           lends it read-only.
        // Why:      Update the running peak.
        // TS map:   `meter.feed(chunk);`
        meter.feed(&chunk);
    }
    // What:     `Ok(meter.peak)`. Wrap the measured peak as the success result. Tail
    //           expression -> return.
    // Why:      Hand the true peak back to the caller.
    // TS map:   `return meter.peak;`
    Ok(meter.peak)
}

// What:     `pub(crate) fn normalization_gain(true_peak: f32) -> f32`. Turn a measured
//           true peak into the constant gain that brings it down to the ceiling,
//           never amplifying (gain is capped at 1.0).
// Why:      Attenuate-only normalization: prevents inter-sample overflow without ever
//           boosting a quiet track (which would risk a sudden loud, possibly harmful,
//           level and is outside the clipping-prevention intent).
// TS map:   `function normalizationGain(truePeak: number): number`
pub(crate) fn normalization_gain(true_peak: f32) -> f32 {
    // What:     `if true_peak <= 0.0 { return 1.0; }`. A silent or invalid measurement
    //           leaves the signal unchanged.
    // Why:      Avoid dividing by zero and avoid amplifying silence.
    // TS map:   `if (truePeak <= 0) return 1;`
    if true_peak <= 0.0 {
        return 1.0;
    }
    // What:     `(CEILING / true_peak).min(1.0)`. The gain that scales the peak to the
    //           ceiling, clamped so it never exceeds 1.0 (no boost). Tail -> return.
    // Why:      Louder-than-ceiling tracks get attenuated to the ceiling; quieter
    //           tracks are left as-is (gain 1.0).
    // TS map:   `return Math.min(CEILING / truePeak, 1);`
    (CEILING / true_peak).min(1.0)
}

// What:     `#[cfg(test)] #[path = "truepeak_tests.rs"] mod tests;`
//           declares a test-only submodule whose code lives in the sibling
//           file `truepeak_tests.rs`. `#[cfg(test)]` gates it to test
//           builds only; `#[path = "..."]` aims the module at a flat sibling
//           file instead of the default `truepeak/tests.rs`
//           subdirectory lookup. The file stays the `tests` CHILD of
//           truepeak, so its `use super::*` reaches the module items
//           (including private ones) unchanged.
// Why:      Keep `truepeak.rs` to production code; the tests live
//           beside it without inflating this file or its max-lines budget
//           (sibling `*_tests.rs` files are exempt from the linter).
// TS map:   the `truepeak.unit.test.ts` file beside
//           `truepeak.ts`, excluded from the production bundle.
//
// In TS you'd write (pseudocode):
// ```ts
// // truepeak.unit.test.ts, run only by the test runner
// ```
#[cfg(test)]
#[path = "truepeak_tests.rs"]
mod tests;
