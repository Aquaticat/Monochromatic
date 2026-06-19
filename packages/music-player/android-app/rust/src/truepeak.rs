//! True-peak measurement (the input to per-track loudness normalization).
//!
//! "True peak" (a.k.a. inter-sample peak) is the highest level the analog
//! waveform reaches AFTER a DAC reconstructs it between the stored samples; it
//! can sit above the largest stored sample. We estimate it by oversampling each
//! channel ~4x with a cubic (Catmull-Rom) interpolation and taking the largest
//! magnitude seen. This module ONLY measures: it takes a decoded `Box<dyn
//! Source>` of interleaved `f32` PCM and returns the largest interpolated
//! magnitude. The gain math that turns that measured peak into a normalization
//! gain (scaling each track down to a -1 dBTP ceiling, never up) lives in the
//! Kotlin core (`TruePeak.kt`), NOT here. This file is ported from the desktop
//! crate's `truepeak.rs`, but the desktop version opens its own decoder from a
//! path and also owns the gain function; here the caller hands us an
//! already-open boxed decoder and the gain step happens on the Kotlin side.

// What:     `use crate::decode::Source;`. Pull in the `Source` trait (an
//           interface: a set of method signatures any decoder type promises to
//           implement). `crate::` means "from the root of THIS crate" (this
//           Rust package), `decode` is the sibling module, `Source` is the
//           trait defined inside it. Unlike the desktop file (which imports the
//           whole `decode` module and a `Path`), here we import the trait by
//           name because `measure_true_peak` receives a `Box<dyn Source>` and
//           calls the trait's `.spec()` / `.next_chunk()` methods on it.
// Why:      The function signature below names `Source`, and calling a trait's
//           methods on a `dyn Source` value requires the trait to be in scope.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Source } from "./decode";
// ```
/// Imports.
use crate::decode::Source;

// What:     `use crate::error::PlayerError;`. The single error type every
//           fallible function in this crate returns. `crate::error` is the
//           sibling module, `PlayerError` the enum (sum type) inside it.
// Why:      `measure_true_peak` returns `Result<f32, PlayerError>` and
//           propagates decode errors with the `?` operator, so the name must be
//           in scope.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PlayerError } from "./error";
// ```
/// Imports.
use crate::error::PlayerError;

// What:     `const HALF: f32 = 1.0 / 2.0;`. The fraction one-half. Composed from
//           the always-allowed `-2..=2` range rather than written as a bare
//           `0.5` literal. The type is `f32` (a 32-bit IEEE float); its sibling
//           is `f64` (64-bit, double precision). We pick `f32` to match the PCM
//           sample type these calculations run on.
// Why:      Used as the Catmull-Rom 1/2 scale factor and to build the
//           sub-sample offsets below; the repo bans bare fractional literals, so
//           it is composed from the exempt range.
//
// In TS you'd write (pseudocode):
// ```ts
// const HALF = 1 / 2;
// ```
/// Half.
const HALF: f32 = 1.0 / 2.0;

// What:     `const QUARTER: f32 = HALF / 2.0;`. One-quarter (0.25), built from
//           `HALF`. Type `f32` (sibling `f64`), same reason as `HALF`.
// Why:      The first of three interior sample positions between two samples
//           where we probe the reconstructed curve.
//
// In TS you'd write (pseudocode):
// ```ts
// const QUARTER = HALF / 2;
// ```
/// Quarter.
const QUARTER: f32 = HALF / 2.0;

// What:     `const THREE_QUARTERS: f32 = HALF + QUARTER;`. Three-quarters
//           (0.75), built from the two constants above. Type `f32` (sibling
//           `f64`).
// Why:      The third interior sample position between two stored samples.
//
// In TS you'd write (pseudocode):
// ```ts
// const THREE_QUARTERS = HALF + QUARTER;
// ```
/// Three quarters.
const THREE_QUARTERS: f32 = HALF + QUARTER;

// What:     `const WINDOW: usize = 4;`. The number of consecutive samples the
//           cubic interpolation needs (two on each side of the interval it
//           fills in). The type `usize` is the unsigned integer wide enough to
//           index any array on this platform (32 bits on a 32-bit build, 64 on a
//           64-bit build). Siblings the reader might expect: `u8`, `u16`, `u32`,
//           `u64`.
// Why:      Catmull-Rom evaluates the curve between the 2nd and 3rd of four
//           points; we also use `WINDOW` to size and index the per-channel
//           arrays, and indexing wants `usize`.
//
// In TS you'd write (pseudocode):
// ```ts
// const WINDOW = 4;
// ```
/// Window.
const WINDOW: usize = 4;

// What:     `fn catmull_rom(p0: f32, p1: f32, p2: f32, p3: f32, t: f32) -> f32`.
//           Declares a free function (not a method) named `catmull_rom` that
//           takes five `f32` floats and returns one `f32`. The `-> f32` after
//           the parameter list is the return type. It evaluates the Catmull-Rom
//           cubic through four equally-spaced points at position `t` (0.0..=1.0)
//           on the segment BETWEEN `p1` and `p2`. The parameters are positional
//           (Rust functions have no object-parameter sugar; this matches the
//           surrounding Rust style).
// Why:      Estimates the waveform between two stored samples, which is exactly
//           where inter-sample peaks hide.
//
// In TS you'd write (pseudocode):
// ```ts
// function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number { ... }
// ```
/// Catmull rom.
fn catmull_rom(p0: f32, p1: f32, p2: f32, p3: f32, t: f32) -> f32 {
    // What:     `let t2 = t * t;` and `let t3 = t2 * t;`. Local immutable
    //           bindings (`let` with no `mut`) holding the square and cube of
    //           `t`. These are plain float multiplies, character-identical to
    //           TS.
    // Why:      The cubic polynomial below is written in terms of `t`, `t^2`,
    //           and `t^3`; precomputing them keeps the formula readable.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const t2 = t * t;
    // const t3 = t2 * t;
    // ```
    let t2 = t * t;
    let t3 = t2 * t;
    // What:     The Catmull-Rom basis evaluated for these four points. The
    //           integer-looking literals `2.0`, `3.0`, `4.0`, `5.0` are the
    //           standard spline matrix coefficients; `HALF` is the 1/2
    //           normalization in front. There is NO trailing `;`, so this whole
    //           multi-line arithmetic expression is the function's tail
    //           expression, which Rust uses as the return value.
    // Why:      Standard closed form (Catmull and Rom, 1974); it reproduces `p1`
    //           at t=0 and `p2` at t=1 with a smooth curve that also accounts
    //           for the neighbours `p0`/`p3`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return 0.5 * (2*p1 + (p2-p0)*t + (2*p0-5*p1+4*p2-p3)*t2 + (3*p1-3*p2+p3-p0)*t3);
    // ```
    HALF * (2.0 * p1
        + (p2 - p0) * t
        + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
        + (3.0 * p1 - 3.0 * p2 + p3 - p0) * t3)
}

// What:     `struct TruePeakMeter { ... }`. Declares a record type (a struct,
//           like a plain object shape) holding the running state for the
//           streaming peak scan: how many channels, a 4-sample sliding window
//           PER channel, how many real samples each channel has seen, and the
//           largest magnitude so far. It has no `pub`, so it is private to this
//           module.
// Why:      Lets us scan the file chunk by chunk without ever holding the whole
//           track in memory; the state is just a few floats and counters per
//           channel (constant memory regardless of track length).
//
// In TS you'd write (pseudocode):
// ```ts
// class TruePeakMeter { channels: number; win: number[][]; filled: number[]; peak: number; }
// ```
/// True peak meter.
struct TruePeakMeter {
    // What:     `channels: usize`. A struct field: the channel count (the
    //           interleave width). `usize` (siblings `u16`/`u32`/`u64`) because
    //           it is used to index the per-channel vectors below, and indexing
    //           wants `usize`.
    // Why:      We need it to demultiplex interleaved samples into per-channel
    //           windows.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // channels: number;
    // ```
    /// Channels.
    channels: usize,
    // What:     `win: Vec<[f32; WINDOW]>`. A field holding one fixed-size array
    //           of the last 4 samples per channel. `[f32; 4]` is a fixed-LENGTH
    //           array (the `4` is part of the type; its sibling is `Vec<f32>`, a
    //           growable list, or `&[f32]`, a borrowed view). `Vec<...>` is the
    //           owned, growable outer list (one inner array per channel). We use
    //           a fixed-size inner array because the window never changes size.
    // Why:      Cubic interpolation needs the latest four samples of a channel,
    //           and there is exactly one window per channel.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // win: number[][]; // each inner array length 4
    // ```
    /// Win.
    win: Vec<[f32; WINDOW]>,
    // What:     `filled: Vec<usize>`. A field: per channel, how many real samples
    //           have arrived (capped at `WINDOW`). `Vec<usize>` is an owned,
    //           growable list of unsigned platform-width integers (sibling
    //           element types: `u32`/`u64`); `usize` because these are counts
    //           compared against the `usize` constant `WINDOW`.
    // Why:      We only interpolate once a channel's window holds four REAL
    //           samples (not the zero-padding the window starts with).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // filled: number[];
    // ```
    /// Filled.
    filled: Vec<usize>,
    // What:     `peak: f32`. A field: the largest absolute sample or interpolated
    //           value seen so far. `f32` (sibling `f64`) to match the sample
    //           type.
    // Why:      When the scan ends, this field IS the measured true peak.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // peak: number;
    // ```
    /// Peak.
    peak: f32,
}

// What:     `impl TruePeakMeter { ... }`. An `impl` block attaches methods to
//           the `TruePeakMeter` struct. It is not the struct's data (that is
//           above); it is the struct's behaviour (constructor + the two
//           sample-feeding methods).
// Why:      Rust separates a type's fields (the `struct`) from its methods (the
//           `impl`); this block is where `new`, `feed`, and `push` live.
//
// In TS you'd write (pseudocode):
// ```ts
// class TruePeakMeter { /* methods go here */ }
// ```
/// Implementation block.
impl TruePeakMeter {
    // What:     `fn new(channels: usize) -> TruePeakMeter`. An associated
    //           function (no `self` parameter, so it is called as
    //           `TruePeakMeter::new(...)`, like a static factory) that builds a
    //           meter sized for `channels` channels with all windows zeroed and
    //           returns the new struct.
    // Why:      Produces the starting state for a scan.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // constructor(channels: number) { ... }
    // ```
    /// New.
    fn new(channels: usize) -> TruePeakMeter {
        // What:     `TruePeakMeter { ... }`. A struct literal that constructs the
        //           value. `channels` uses field-init shorthand (the field and
        //           the local variable share the name). `vec![[0.0; WINDOW];
        //           channels]` is the `vec!` macro building `channels` copies of
        //           a zeroed 4-element array; `vec![0; channels]` builds
        //           `channels` zero counts. There is no trailing `;`, so this
        //           literal is the function's tail expression and becomes the
        //           return value.
        // Why:      One window and one counter per channel, with the running peak
        //           starting at 0.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { channels, win: Array.from({length: channels}, () => [0,0,0,0]),
        //          filled: new Array(channels).fill(0), peak: 0 };
        // ```
        TruePeakMeter {
            channels,
            win: vec![[0.0; WINDOW]; channels],
            filled: vec![0; channels],
            peak: 0.0,
        }
    }

    // What:     `fn feed(&mut self, chunk: &[f32])`. A method that pushes one
    //           interleaved chunk of samples through the meter. `&mut self`
    //           borrows the meter MUTABLY (the method may change its fields but
    //           does not consume/own it). `chunk: &[f32]` is a borrowed,
    //           read-only slice (a view into a `Vec<f32>` or array the caller
    //           still owns; sibling: `Vec<f32>`, which would be owned/moved in).
    //           Return type is omitted, which in Rust means it returns `()`, the
    //           empty unit (like TS `void`).
    // Why:      Drives the running peak update for a whole block of audio at
    //           once.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // feed(chunk: number[]): void { ... }
    // ```
    /// Feed.
    fn feed(&mut self, chunk: &[f32]) {
        // What:     `for (index, &sample) in chunk.iter().enumerate() { ... }`.
        //           `chunk.iter()` makes an iterator of references over the
        //           slice; `.enumerate()` pairs each item with its position
        //           index. The pattern `(index, &sample)` destructures the
        //           pair: `index` is the position, and the `&sample` pattern
        //           DEREFERENCES the reference so `sample` is a by-value COPY of
        //           the `f32` (f32 is `Copy`, so this is a cheap value copy, not
        //           a move).
        // Why:      The position index decides which channel a sample belongs to
        //           in the interleaved layout.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // chunk.forEach((sample, index) => { ... });
        // ```
        for (index, &sample) in chunk.iter().enumerate() {
            // What:     `let channel = index % self.channels;`. An immutable
            //           local. `%` is the remainder operator. In interleaved
            //           audio, the sample at position `index` belongs to channel
            //           `index % channels` (positions cycle 0,1,...,channels-1,
            //           0,1,...).
            // Why:      Route each sample to the right channel's window.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const channel = index % this.channels;
            // ```
            let channel = index % self.channels;
            // What:     `self.push(channel, sample);`. Call the `push` method
            //           below on this same meter, handing it one sample and the
            //           channel it belongs to. `self.` is the method receiver
            //           (like TS `this.`).
            // Why:      All the per-channel windowing/interpolation logic lives in
            //           `push`; `feed` just splits the chunk per channel.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.push(channel, sample);
            // ```
            self.push(channel, sample);
        }
    }

    // What:     `fn push(&mut self, channel: usize, sample: f32)`. A method that
    //           slides one sample into one channel's window, updates the raw
    //           peak, and (once the window is full) samples the interpolated
    //           curve between the two middle points. `&mut self` is a mutable
    //           borrow of the meter; `channel: usize` is the channel index
    //           (sibling `u32`; `usize` because it indexes the vectors);
    //           `sample: f32` is the new audio sample by value.
    // Why:      This is the core inter-sample peak step, run once per sample.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // push(channel: number, sample: number): void { ... }
    // ```
    /// Push.
    fn push(&mut self, channel: usize, sample: f32) {
        // What:     `let window = self.win[channel];`. Read the channel's 4-array
        //           out of the vector. Because `[f32; 4]` is made of `Copy`
        //           elements, the array itself is `Copy`, so this binding makes
        //           a by-VALUE copy of the four floats, NOT a reference into
        //           `self.win`.
        // Why:      Copying out first lets us read the old window while we later
        //           write `self.win[channel]` and `self.peak`, avoiding a
        //           borrow-checker conflict (you cannot hold a read borrow of
        //           `self` and a write borrow of `self` at the same time).
        // Gotcha:   This is a VALUE copy of the small array, not a reference;
        //           mutating `window` would NOT touch `self.win`. In TS, arrays
        //           are reference types, so the same code would alias the stored
        //           array instead.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const window = this.win[channel].slice(); // value copy
        // ```
        let window = self.win[channel];
        // What:     `let shifted = [window[1], window[2], window[3], sample];`.
        //           Build a new 4-element array literal: the old window with its
        //           oldest sample (`window[0]`) dropped and the new `sample`
        //           appended at the end.
        // Why:      Keep the last four samples in arrival order so the cubic
        //           always sees the four most recent points.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const shifted = [window[1], window[2], window[3], sample];
        // ```
        let shifted = [window[1], window[2], window[3], sample];
        // What:     `self.win[channel] = shifted;`. Store the advanced window back
        //           into the per-channel vector at index `channel`.
        // Why:      The next call to `push` for this channel builds on this
        //           updated window.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.win[channel] = shifted;
        // ```
        self.win[channel] = shifted;
        // What:     `self.filled[channel] = (self.filled[channel] + 1).min(WINDOW);`.
        //           Increment this channel's real-sample count, then `.min(WINDOW)`
        //           clamps it so it never exceeds 4. `.min(...)` is a method on the
        //           integer that returns the smaller of the two values.
        // Why:      Track when four real samples are available; counting past 4 is
        //           pointless, so we cap it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.filled[channel] = Math.min(this.filled[channel] + 1, WINDOW);
        // ```
        self.filled[channel] = (self.filled[channel] + 1).min(WINDOW);
        // What:     `let mut local_peak = sample.abs();`. A MUTABLE local
        //           (`let mut`) starting from this sample's magnitude. `.abs()`
        //           is the absolute-value method on `f32`. We make it `mut`
        //           because the interpolation loop below may raise it; the
        //           mutation is local to this method only.
        // Why:      The stored sample itself is the first peak candidate before we
        //           look between samples.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let localPeak = Math.abs(sample);
        // ```
        let mut local_peak = sample.abs();
        // What:     `if self.filled[channel] == WINDOW { ... }`. Only run the
        //           interpolation block once this channel's window holds four
        //           REAL samples (the count reached `WINDOW`). `==` is ordinary
        //           equality.
        // Why:      Cubic interpolation needs all four points to be real audio,
        //           not the initial zero padding.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.filled[channel] === WINDOW) { ... }
        // ```
        if self.filled[channel] == WINDOW {
            // What:     `for t in [QUARTER, HALF, THREE_QUARTERS] { ... }`. Loop
            //           over a fixed 3-element array literal, binding `t` to each
            //           in turn. The array holds three interior positions between
            //           `shifted[1]` and `shifted[2]`. Iterating an array of
            //           `f32` yields each `f32` BY VALUE (f32 is `Copy`).
            // Why:      ~4x oversampling: probe three points between the two
            //           middle stored samples to catch peaks that fall between
            //           them.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // for (const t of [QUARTER, HALF, THREE_QUARTERS]) { ... }
            // ```
            for t in [QUARTER, HALF, THREE_QUARTERS] {
                // What:     `let interpolated =
                //           catmull_rom(shifted[0], shifted[1], shifted[2],
                //           shifted[3], t).abs();`. Call the cubic with the four
                //           windowed points and offset `t`, then `.abs()` takes
                //           the magnitude of the result. The binding spans two
                //           physical lines (the `=` is on the first, the
                //           expression on the second) but is a single statement.
                // Why:      Each interior position is a candidate inter-sample
                //           peak; we want its magnitude.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const interpolated = Math.abs(catmullRom(shifted[0], shifted[1], shifted[2], shifted[3], t));
                // ```
                let interpolated =
                    catmull_rom(shifted[0], shifted[1], shifted[2], shifted[3], t).abs();
                // What:     `local_peak = local_peak.max(interpolated);`. Reassign
                //           the already-`mut` local to the larger of itself and
                //           the new candidate. `.max(...)` is the float method
                //           returning the bigger of two values.
                // Why:      Keep the highest interior value seen for this sample.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // localPeak = Math.max(localPeak, interpolated);
                // ```
                local_peak = local_peak.max(interpolated);
            }
        }
        // What:     `self.peak = self.peak.max(local_peak);`. Fold this sample's
        //           best candidate into the meter's running maximum, again via
        //           the `.max(...)` float method.
        // Why:      The overall true peak is the maximum across every sample of
        //           the whole track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.peak = Math.max(this.peak, localPeak);
        // ```
        self.peak = self.peak.max(local_peak);
    }
}

// What:     `pub fn measure_true_peak(mut source: Box<dyn Source>) -> Result<f32, PlayerError>`.
//           A public free function that scans a decoder to the end and returns
//           the estimated true peak (a linear amplitude, typically near 1.0 for
//           full-scale material). `mut source` makes the parameter binding
//           mutable so we can advance the decoder. `Box<dyn Source>` is an
//           OWNING, heap-allocated pointer to some type that implements the
//           `Source` trait, with the concrete type erased at compile time (a
//           "trait object"); siblings: `Rc<dyn Source>` / `Arc<dyn Source>`
//           (shared, reference-counted) or `&dyn Source` (borrowed, not owned).
//           We take `Box` (owned) so the function fully consumes/drives the
//           decoder. `Result<f32, PlayerError>` is the success-or-error return:
//           `Ok(f32)` on success, `Err(PlayerError)` on failure. `pub` makes it
//           callable from outside this module (the JNI/Kotlin bridge invokes
//           it).
// Why:      This is THE measurement the per-track normalization is based on;
//           note the gain calculation itself lives in Kotlin, so this function
//           returns only the raw peak.
// Gotcha:   The desktop sibling takes a `&Path` and opens its own decoder; this
//           Android version receives an already-open `Box<dyn Source>` and MOVES
//           ownership of it in, so the caller cannot use the decoder afterwards.
//
// In TS you'd write (pseudocode):
// ```ts
// function measureTruePeak(source: Source): number { /* throws on decode error */ }
// ```
/// Measure true peak.
pub fn measure_true_peak(mut source: Box<dyn Source>) -> Result<f32, PlayerError> {
    // What:     `let channels = source.spec().channels as usize;`. Call the
    //           trait method `.spec()` (returns an `AudioSpec`), read its
    //           `channels` field (which is a `u16`), and `as usize` widens that
    //           16-bit count to the platform-width index type. `as` is Rust's
    //           explicit numeric cast.
    // Why:      The meter must know the interleave width (how many channels the
    //           samples are interleaved across), and it indexes with `usize`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const channels = source.spec().channels;
    // ```
    let channels = source.spec().channels as usize;
    // What:     `if channels == 0 { return Ok(0.0); }`. Guard against a malformed
    //           zero-channel stream. `Ok(0.0)` is the success variant of
    //           `Result` wrapping a peak of `0.0` (treated as silence); an
    //           explicit `return` here exits the function early.
    // Why:      Avoids a divide-by-zero in the channel routing (`index %
    //           channels`); a peak of 0 maps to a normalization gain of 1.0 on
    //           the Kotlin side anyway.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (channels === 0) return 0;
    // ```
    if channels == 0 {
        return Ok(0.0);
    }
    // What:     `let mut meter = TruePeakMeter::new(channels);`. Construct the
    //           running scanner by calling the associated function `new` via the
    //           `Type::function` path syntax (`::`). `let mut` because we mutate
    //           the meter as we feed it.
    // Why:      The meter accumulates the peak across all chunks.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const meter = new TruePeakMeter(channels);
    // ```
    let mut meter = TruePeakMeter::new(channels);
    // What:     `loop { ... }`. Rust's UNCONDITIONAL infinite loop (equivalent to
    //           `while (true)`); it runs until an explicit `break` inside it
    //           exits.
    // Why:      Scan the entire track until the decoder signals end-of-stream.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (true) { ... }
    // ```
    loop {
        // What:     `let chunk = source.next_chunk()?;`. Call the trait method
        //           `.next_chunk()` (returns `Result<Vec<f32>, PlayerError>`) to
        //           get the next block of interleaved samples. The trailing `?`
        //           is the propagation operator: on `Ok(v)` it unwraps to `v`; on
        //           `Err(e)` it RETURNS that error from `measure_true_peak`
        //           immediately.
        // Why:      We need the next block to feed it to the meter, and any decode
        //           error should bubble up to the caller unchanged.
        // Gotcha:   `?` is early-return-on-error, NOT TS optional chaining (`?.`).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const chunk = source.nextChunk(); // throws on failure
        // ```
        let chunk = source.next_chunk()?;
        // What:     `if chunk.is_empty() { break; }`. `.is_empty()` returns `true`
        //           when the `Vec<f32>` has length 0, which the decoder uses to
        //           signal EOF; `break` then exits the `loop`.
        // Why:      Stop scanning at the end of the track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (chunk.length === 0) break;
        // ```
        if chunk.is_empty() {
            break;
        }
        // What:     `meter.feed(&chunk);`. Push this block through the scanner.
        //           `&chunk` BORROWS the `Vec<f32>` read-only (lends a view) so
        //           `feed` can read it without taking ownership; `chunk` stays
        //           owned by this loop body and is freed at the end of the
        //           iteration.
        // Why:      Update the running peak with this block's samples.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // meter.feed(chunk);
        // ```
        meter.feed(&chunk);
    }
    // What:     `Ok(meter.peak)`. Construct the success variant of `Result`,
    //           wrapping the meter's accumulated `peak` field. No trailing `;`,
    //           so this is the function's tail expression and becomes the return
    //           value.
    // Why:      Hand the measured true peak back to the caller (ultimately the
    //           Kotlin core, which turns it into a normalization gain).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return meter.peak;
    // ```
    Ok(meter.peak)
}

// What:     `pub fn true_peak_interleaved(samples: &[f32], channels: usize) -> f32`.
//           A public free function that runs the SAME streaming meter as
//           `measure_true_peak`, but over an ALREADY-decoded slice of interleaved
//           `f32` PCM instead of a `Box<dyn Source>`. `samples: &[f32]` is a
//           borrowed, read-only view (the caller keeps ownership); `channels` is
//           the interleave width; `-> f32` returns the measured true peak. `pub`
//           so the JNI layer (`lib.rs`) can reach it from the test-only
//           `nativeTruePeakSynthetic` entry.
// Why:      Lets an on-device instrumented test feed a KNOWN synthetic signal
//           straight into the production `TruePeakMeter` and assert the measured
//           inter-sample peak on the real target, with NO decoder and NO golden
//           audio file. It shares the exact meter + `catmull_rom` path that
//           `measure_true_peak` drives, so a green device test proves that path.
// Gotcha:   Feeds the whole slice as ONE chunk; that is equivalent to the decoder
//           feeding many chunks, because the meter's per-channel window/`filled`
//           state persists across samples, so chunk boundaries never move the
//           result. This is why the old Kotlin "chunk boundaries" test does not
//           need a separate device entry.
//
// In TS you'd write (pseudocode):
// ```ts
// function truePeakInterleaved(samples: Float32Array, channels: number): number { ... }
// ```
/// True peak interleaved.
pub fn true_peak_interleaved(samples: &[f32], channels: usize) -> f32 {
    // What:     `if channels == 0 { return 0.0; }`. Guard a zero-channel request,
    //           returning a `0.0` (silence) peak. Mirrors the same guard in
    //           `measure_true_peak`.
    // Why:      Avoids the divide-by-zero `index % channels` routing in `feed`; a
    //           zero peak maps to a unity normalization gain on the Kotlin side.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (channels === 0) return 0;
    // ```
    if channels == 0 {
        return 0.0;
    }
    // What:     `let mut meter = TruePeakMeter::new(channels);`. Build the running
    //           scanner sized for `channels`; `mut` because `feed` mutates it.
    // Why:      The same accumulator `measure_true_peak` uses, so this path stays
    //           byte-for-byte identical to production.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const meter = new TruePeakMeter(channels);
    // ```
    let mut meter = TruePeakMeter::new(channels);
    // What:     `meter.feed(samples);`. Push the whole interleaved slice through the
    //           meter in one call (`feed` borrows it read-only).
    // Why:      Update the running peak across every sample of the synthetic signal.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // meter.feed(samples);
    // ```
    meter.feed(samples);
    // What:     `meter.peak`. The accumulated peak field as the tail expression (no
    //           trailing `;`), so it is the return value.
    // Why:      Hand the measured true peak back to the JNI caller.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return meter.peak;
    // ```
    meter.peak
}
