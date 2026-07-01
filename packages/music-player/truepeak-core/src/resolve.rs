//! Resolve a track to a gain decision by driving a decoded source through the policy.
//!
//! This is the shared measurement the platforms call. A short track (or one of unknown
//! length) is scanned in full for an exact peak. A long track is probed at proportional
//! coverage: a per-track number of short windows placed evenly, each measured with its own
//! meter so a seek seam cannot fabricate a spike, and the loudest sampled window is inflated
//! by the fixed margin. The gain math and window placement are the shared crate's own.

/// What:     `use crate::decision::{Decision, DecisionKind};`. The answer type and its tag.
/// Why:      This module builds and returns a `Decision`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Decision, DecisionKind } from "./decision";
/// ```
use crate::decision::{Decision, DecisionKind};

/// What:     `use crate::error::TruePeakError;`. The fallible-source error.
/// Why:      Driving the source propagates decode and seek errors with `?`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { TruePeakError } from "./error";
/// ```
use crate::error::TruePeakError;

/// What:     `use crate::gain::{normalization_gain, probe_estimated_peak};`. The gain from
///           a peak, and the margin inflation.
/// Why:      Both branches turn a peak into a gain; the probe branch inflates first.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { normalizationGain, probeEstimatedPeak } from "./gain";
/// ```
use crate::gain::{normalization_gain, probe_estimated_peak};

/// What:     `use crate::meter::TruePeakMeter;`. The shared streaming meter.
/// Why:      Every scan and every window is measured by it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { TruePeakMeter } from "./meter";
/// ```
use crate::meter::TruePeakMeter;

/// What:     `use crate::policy::Policy;`. The shipped policy parameters.
/// Why:      The short-scan cutoff, coverage, window length, and margin come from it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Policy } from "./policy";
/// ```
use crate::policy::Policy;

/// What:     `use crate::source::{AudioSpec, TruePeakSource};`. The stream descriptor and
///           the decoded-audio contract.
/// Why:      The resolver reads spec, chunks, and seeks through it; the exact-decision
///           helper takes an `AudioSpec` by value (it is `Copy`).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { AudioSpec, TruePeakSource } from "./source";
/// ```
use crate::source::{AudioSpec, TruePeakSource};

/// What:     `use crate::window::window_frame_starts;`. Even window placement in frames.
/// Why:      The probe seeks to each returned start.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { windowFrameStarts } from "./window";
/// ```
use crate::window::window_frame_starts;

/// What:     `fn full_scan(source: &mut dyn TruePeakSource, channels: usize) -> Result<(f32,
///           u64), TruePeakError>`. Scan the whole source, returning the true peak and the
///           decoded frame count. `&mut dyn TruePeakSource` is a mutable borrow of the trait
///           object.
/// Why:      Short and unknown-length tracks are measured exactly, and the frame count gives
///           the decoded duration.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function fullScan(source: TruePeakSource, channels: number): [number, number] { ... }
/// ```
fn full_scan(source: &mut dyn TruePeakSource, channels: usize) -> Result<(f32, u64), TruePeakError> {
    // What:     `let mut meter = TruePeakMeter::new(channels);`. The accumulator.
    // Why:      One meter for the whole track.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const meter = new TruePeakMeter(channels);
    // ```
    let mut meter = TruePeakMeter::new(channels);
    // What:     `let mut samples: u64 = 0;`. Running count of interleaved samples fed.
    // Why:      Divided by channels at the end to report decoded frames.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let samples = 0;
    // ```
    let mut samples: u64 = 0;
    // What:     `loop { ... }`. Read and feed chunks until end of stream.
    // Why:      Cover every sample of the track.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (true) { ... }
    // ```
    loop {
        // What:     `let chunk = source.next_chunk()?;`. Next block; `?` propagates a
        //           decode error.
        // Why:      Feed it to the meter.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const chunk = source.nextChunk();
        // ```
        let chunk = source.next_chunk()?;
        // What:     `if chunk.is_empty() { break; }`. Empty signals EOF.
        // Why:      Stop at the end.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (chunk.length === 0) break;
        // ```
        if chunk.is_empty() {
            break;
        }
        // What:     `samples += chunk.len() as u64;` then `meter.feed(&chunk);`. Count and
        //           feed. `&chunk` lends the block read-only.
        // Why:      Track length and update the peak.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // samples += chunk.length; meter.feed(chunk);
        // ```
        samples += chunk.len() as u64;
        meter.feed(&chunk);
    }
    // What:     `Ok((meter.peak(), samples / channels as u64))`. The peak and the frame
    //           count (samples over channels). Tail -> return.
    // Why:      Both are needed to build the decision.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return [meter.peak(), Math.floor(samples / channels)];
    // ```
    Ok((meter.peak(), samples / channels as u64))
}

/// What:     `fn measure_window(source: &mut dyn TruePeakSource, channels: usize,
///           window_frames: u64) -> Result<f32, TruePeakError>`. Read up to `window_frames`
///           frames from the source's current position and return their true peak, using a
///           fresh meter.
/// Why:      Each probe window is measured on its own so a seek seam between unrelated
///           regions cannot fabricate an inter-sample spike.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function measureWindow(source, channels, windowFrames): number { ... }
/// ```
fn measure_window(
    source: &mut dyn TruePeakSource,
    channels: usize,
    window_frames: u64,
) -> Result<f32, TruePeakError> {
    // What:     `let mut meter = TruePeakMeter::new(channels);`. A window-local meter.
    // Why:      No continuity with other windows.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const meter = new TruePeakMeter(channels);
    // ```
    let mut meter = TruePeakMeter::new(channels);
    // What:     `let mut fed: u64 = 0;`. Frames fed so far this window.
    // Why:      Stop once the window length is reached.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let fed = 0;
    // ```
    let mut fed: u64 = 0;
    // What:     `while fed < window_frames { ... }`. Read until the window is full or EOF.
    // Why:      A window near the end may be short; that is fine.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (fed < windowFrames) { ... }
    // ```
    while fed < window_frames {
        // What:     `let chunk = source.next_chunk()?;`. Next block; `?` propagates.
        // Why:      Feed the window meter.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const chunk = source.nextChunk();
        // ```
        let chunk = source.next_chunk()?;
        // What:     `if chunk.is_empty() { break; }`. EOF ends the window early.
        // Why:      The final window can be short.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (chunk.length === 0) break;
        // ```
        if chunk.is_empty() {
            break;
        }
        // What:     `fed += chunk.len() as u64 / channels as u64;` then `meter.feed(&chunk);`.
        //           Count frames and feed. Integer division drops a partial frame from the
        //           count, which only ends the window a few samples early.
        // Why:      Advance toward the window length and update the peak.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // fed += Math.floor(chunk.length / channels); meter.feed(chunk);
        // ```
        fed += chunk.len() as u64 / channels as u64;
        meter.feed(&chunk);
    }
    // What:     `Ok(meter.peak())`. The window's true peak. Tail -> return.
    // Why:      The probe takes the max across windows.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return meter.peak();
    // ```
    Ok(meter.peak())
}

/// What:     `fn silence_decision(spec: AudioSpec) -> Decision`. The decision for a
///           malformed zero-channel stream: unity gain, exact, zero peak. `AudioSpec` is
///           taken by value because it is `Copy`.
/// Why:      Both entry points (`resolve_decision` and `resolve_full_scan`) treat a
///           zero-channel stream as silence identically; one helper keeps them in step.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function silenceDecision(spec: AudioSpec): Decision {
///   return { gain: 1, kind: "fullScanExact", measuredPeak: 0, durationSecs: spec.durationSecs };
/// }
/// ```
fn silence_decision(spec: AudioSpec) -> Decision {
    // What:     `Decision { gain: 1.0, kind: FullScanExact, measured_peak: 0.0, duration_secs:
    //           spec.duration_secs }`. Unity gain over silence, tagged exact. Tail -> return.
    // Why:      Never amplify a degenerate stream, and never probe it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { gain: 1, kind: "fullScanExact", measuredPeak: 0, durationSecs: spec.durationSecs };
    // ```
    Decision {
        gain: 1.0,
        kind: DecisionKind::FullScanExact,
        measured_peak: 0.0,
        duration_secs: spec.duration_secs,
    }
}

/// What:     `fn exact_decision(policy: &Policy, source: &mut dyn TruePeakSource, spec:
///           AudioSpec, channels: usize) -> Result<Decision, TruePeakError>`. Scan the whole
///           track and build the exact decision, tagging `ShortFullScan` for a known-short
///           track and `FullScanExact` otherwise. `channels` is passed in so the caller's
///           zero-channel guard is not repeated here.
/// Why:      The short branch of `resolve_decision` and the always-exact `resolve_full_scan`
///           build the identical exact decision; sharing it keeps the gain and the kind rule
///           in one place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function exactDecision(policy, source, spec, channels): Decision { ... }
/// ```
fn exact_decision(
    policy: &Policy,
    source: &mut dyn TruePeakSource,
    spec: AudioSpec,
    channels: usize,
) -> Result<Decision, TruePeakError> {
    // What:     `let (peak, frames) = full_scan(source, channels)?;`. Exact peak and decoded
    //           frame count; `?` propagates a decode error.
    // Why:      The gain is exact, and the frames give the decoded duration.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [peak, frames] = fullScan(source, channels);
    // ```
    let (peak, frames) = full_scan(source, channels)?;
    // What:     `let short = spec.duration_known() && spec.duration_secs <=
    //           policy.short_scan_max_secs;`. Whether this counts as a short track.
    // Why:      Tags the decision kind; an unknown-length or long full scan is `FullScanExact`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const short = durationKnown(spec) && spec.durationSecs <= policy.shortScanMaxSecs;
    // ```
    let short = spec.duration_known() && spec.duration_secs <= policy.short_scan_max_secs;
    // What:     `Ok(Decision { ... })`. Build the exact decision; `normalization_gain` turns
    //           the peak into an attenuate-only gain. Tail -> return.
    // Why:      Hand back the exact gain and its evidence.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { gain: normalizationGain(peak), kind: short ? "shortFullScan" : "fullScanExact", measuredPeak: peak, durationSecs: frames / spec.rate };
    // ```
    Ok(Decision {
        gain: normalization_gain(peak),
        kind: if short { DecisionKind::ShortFullScan } else { DecisionKind::FullScanExact },
        measured_peak: peak,
        duration_secs: frames as f64 / f64::from(spec.rate),
    })
}

/// What:     `pub fn resolve_full_scan(policy: &Policy, source: &mut dyn TruePeakSource) ->
///           Result<Decision, TruePeakError>`. Always scan the whole track for an exact gain,
///           regardless of length, tagging `ShortFullScan` or `FullScanExact` by duration.
/// Why:      The warming upgrade path: a long track that `resolve_decision` would probe is
///           heard in full here, so the cache's exact-over-probe precedence can replace a
///           probe estimate with the exact gain over idle time. Desktop warming uses this;
///           the probe estimate never returns once an exact row lands.
/// Gotcha:   This performs a BLOCKING full decode of the whole track; call it on a worker,
///           never on a latency-sensitive path.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function resolveFullScan(policy: Policy, source: TruePeakSource): Decision { ... }
/// ```
pub fn resolve_full_scan(
    policy: &Policy,
    source: &mut dyn TruePeakSource,
) -> Result<Decision, TruePeakError> {
    // What:     `let spec = source.spec();`. Rate, channels, and duration of the stream.
    // Why:      Channels size the meter; duration tags the kind.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const spec = source.spec();
    // ```
    let spec = source.spec();
    // What:     `let channels = spec.channels as usize;`. Interleave width for the meter.
    // Why:      The meter and the frame math need it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const channels = spec.channels;
    // ```
    let channels = spec.channels as usize;
    // What:     `if channels == 0 { return Ok(silence_decision(spec)); }`. Degenerate stream.
    // Why:      Avoid a divide-by-zero and never amplify silence.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (channels === 0) return silenceDecision(spec);
    // ```
    if channels == 0 {
        return Ok(silence_decision(spec));
    }
    // What:     `exact_decision(policy, source, spec, channels)`. The full exact scan.
    //           Tail -> return.
    // Why:      Always exact here, unlike `resolve_decision`'s long-track probe.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return exactDecision(policy, source, spec, channels);
    // ```
    exact_decision(policy, source, spec, channels)
}

/// What:     `pub fn resolve_decision(policy: &Policy, source: &mut dyn TruePeakSource) ->
///           Result<Decision, TruePeakError>`. Turn a track into a gain decision under the
///           policy. `&Policy` borrows the parameters; `&mut dyn TruePeakSource` drives the
///           decoder.
/// Why:      This is the one shared measurement both platforms call to get a track's gain.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function resolveDecision(policy: Policy, source: TruePeakSource): Decision { ... }
/// ```
pub fn resolve_decision(
    policy: &Policy,
    source: &mut dyn TruePeakSource,
) -> Result<Decision, TruePeakError> {
    // What:     `let spec = source.spec();`. Rate, channels, and duration of the stream.
    // Why:      They pick the branch and size the windows.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const spec = source.spec();
    // ```
    let spec = source.spec();
    // What:     `let channels = spec.channels as usize;`. Interleave width for the meter.
    // Why:      The meter and window frame math need it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const channels = spec.channels;
    // ```
    let channels = spec.channels as usize;
    // What:     `if channels == 0 { return Ok(...); }`. A malformed zero-channel stream is
    //           treated as silence: unity gain, exact.
    // Why:      Avoid a divide-by-zero and never amplify silence.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (channels === 0) return silenceDecision(spec);
    // ```
    if channels == 0 {
        return Ok(silence_decision(spec));
    }

    // What:     `if !spec.duration_known() || spec.duration_secs <= policy.short_scan_max_secs`.
    //           Full-scan when the length is unknown or short.
    // Why:      Short and unknown tracks are cheap to measure exactly, so they carry no
    //           probe error.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!durationKnown(spec) || spec.durationSecs <= policy.shortScanMaxSecs) { ... }
    // ```
    if !spec.duration_known() || spec.duration_secs <= policy.short_scan_max_secs {
        // What:     `return exact_decision(policy, source, spec, channels);`. The shared exact
        //           scan, tagging short vs unknown-length; `?`-free because it is the tail.
        // Why:      Short and unknown tracks are measured exactly, identically to
        //           `resolve_full_scan`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return exactDecision(policy, source, spec, channels);
        // ```
        return exact_decision(policy, source, spec, channels);
    }

    // What:     `let window_frames = ((policy.probe_window_secs * f64::from(spec.rate))
    //           .round() as u64).max(1);`. Frames per probe window. `.max(1)` keeps a tiny
    //           window from being zero-length.
    // Why:      Both placement and window measurement need it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const windowFrames = Math.max(1, Math.round(policy.probeWindowSecs * spec.rate));
    // ```
    let window_frames = ((policy.probe_window_secs * f64::from(spec.rate)).round() as u64).max(1);
    // What:     `let total_frames = (spec.duration_secs * f64::from(spec.rate)).round() as
    //           u64;`. The track length in frames.
    // Why:      Window placement spreads starts across it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const totalFrames = Math.round(spec.durationSecs * spec.rate);
    // ```
    let total_frames = (spec.duration_secs * f64::from(spec.rate)).round() as u64;
    // What:     `let count = ((policy.coverage_fraction * spec.duration_secs) /
    //           policy.probe_window_secs).round().max(1.0) as usize;`. Windows scale with
    //           duration so coverage is a fixed fraction, not a fixed span.
    // Why:      Proportional coverage bounds the worst gap-miss across track lengths.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const count = Math.max(1, Math.round((policy.coverageFraction * spec.durationSecs) / policy.probeWindowSecs));
    // ```
    let count = ((policy.coverage_fraction * spec.duration_secs) / policy.probe_window_secs)
        .round()
        .max(1.0) as usize;
    // What:     `let starts = window_frame_starts(total_frames, count, window_frames);`. The
    //           evenly-spaced start frame of each window.
    // Why:      The probe seeks to each in turn.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const starts = windowFrameStarts(totalFrames, count, windowFrames);
    // ```
    let starts = window_frame_starts(total_frames, count, window_frames);
    // What:     `let mut sampled_max = 0.0_f32;`. Loudest window peak seen.
    // Why:      The probe gain is decided from the loudest window.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let sampledMax = 0;
    // ```
    let mut sampled_max = 0.0_f32;
    // What:     `for start in starts { ... }`. Seek to each window and measure it.
    // Why:      Accumulate the loudest sampled peak.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const start of starts) { ... }
    // ```
    for start in starts {
        // What:     `source.seek_to_frame(start)?;`. Land exactly at the window start; `?`
        //           propagates a seek error.
        // Why:      The window must begin where placement says.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // source.seekToFrame(start);
        // ```
        source.seek_to_frame(start)?;
        // What:     `let peak = measure_window(source, channels, window_frames)?;`. This
        //           window's true peak with its own meter.
        // Why:      A window-local measurement, seam-safe.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const peak = measureWindow(source, channels, windowFrames);
        // ```
        let peak = measure_window(source, channels, window_frames)?;
        // What:     `sampled_max = sampled_max.max(peak);`. Keep the loudest.
        // Why:      The probe estimate is built from the loudest window.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // sampledMax = Math.max(sampledMax, peak);
        // ```
        sampled_max = sampled_max.max(peak);
    }
    // What:     `let estimated = probe_estimated_peak(f64::from(sampled_max),
    //           policy.probe_margin_db) as f32;`. Inflate the sampled peak by the margin,
    //           then narrow back to `f32` for the gain.
    // Why:      The margin covers the crest the sparse windows may have missed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const estimated = probeEstimatedPeak(sampledMax, policy.probeMarginDb);
    // ```
    let estimated = probe_estimated_peak(f64::from(sampled_max), policy.probe_margin_db) as f32;
    // What:     `Ok(Decision { ... })`. Build the probe decision; `normalization_gain` on
    //           the inflated peak. Tail -> return.
    // Why:      Hand back the probe estimate and its sampled evidence.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { gain: normalizationGain(estimated), kind: "probeEstimate", measuredPeak: sampledMax, durationSecs: spec.durationSecs };
    // ```
    Ok(Decision {
        gain: normalization_gain(estimated),
        kind: DecisionKind::ProbeEstimate,
        measured_peak: sampled_max,
        duration_secs: spec.duration_secs,
    })
}

/// What:     `#[cfg(test)] #[path = "resolve_tests.rs"] mod tests;`. Test-only submodule in
///           the sibling file, gated to test builds.
/// Why:      Keep this file to production code; sibling `*_tests.rs` is max-lines exempt.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // resolve.integration.test.ts
/// ```
#[cfg(test)]
#[path = "resolve_tests.rs"]
mod tests;
