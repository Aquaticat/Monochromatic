//! True-peak measurement (4x Catmull-Rom oversampling, -1 dBTP ceiling). Ported from
//! the desktop crate: feed decoded interleaved f32 PCM and track the largest
//! interpolated magnitude, the per-track loudness-normalization input. The gain math
//! (peak -> gain) lives in the Kotlin core (`TruePeak.kt`); this is only the measure.
//! dum-dum-non-ts comments deferred to finalization.

use crate::decode::Source;
use crate::error::PlayerError;

/// One-half, the Catmull-Rom normalization factor.
const HALF: f32 = 1.0 / 2.0;
/// One-quarter, a sub-sample interpolation position.
const QUARTER: f32 = HALF / 2.0;
/// Three-quarters, a sub-sample interpolation position.
const THREE_QUARTERS: f32 = HALF + QUARTER;
/// Sliding-window width the cubic needs (four consecutive samples per channel).
const WINDOW: usize = 4;

/// Catmull-Rom cubic through four equally-spaced points, evaluated at `t` in `0..=1` on
/// the segment between `p1` and `p2`, estimating the waveform where inter-sample peaks
/// live. Coefficients are the standard spline matrix (Catmull and Rom, 1974).
fn catmull_rom(p0: f32, p1: f32, p2: f32, p3: f32, t: f32) -> f32 {
    let t2 = t * t;
    let t3 = t2 * t;
    HALF * (2.0 * p1
        + (p2 - p0) * t
        + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
        + (3.0 * p1 - 3.0 * p2 + p3 - p0) * t3)
}

/// Streaming true-peak meter: a four-sample sliding window per channel, scanning chunk
/// by chunk in constant memory and tracking the largest interpolated magnitude.
struct TruePeakMeter {
    /// Channel count (interleave width).
    channels: usize,
    /// Latest four samples per channel.
    win: Vec<[f32; WINDOW]>,
    /// Real samples seen per channel, capped at `WINDOW`.
    filled: Vec<usize>,
    /// Largest absolute sample/interpolated value so far.
    peak: f32,
}

impl TruePeakMeter {
    /// Build a meter for `channels` channels, windows zeroed.
    fn new(channels: usize) -> TruePeakMeter {
        TruePeakMeter {
            channels,
            win: vec![[0.0; WINDOW]; channels],
            filled: vec![0; channels],
            peak: 0.0,
        }
    }

    /// Push one interleaved chunk through the meter, routing each sample to its channel.
    fn feed(&mut self, chunk: &[f32]) {
        for (index, &sample) in chunk.iter().enumerate() {
            let channel = index % self.channels;
            self.push(channel, sample);
        }
    }

    /// Advance one channel's window with `sample`, oversample once the window is full,
    /// and fold the local maximum into the running peak.
    fn push(&mut self, channel: usize, sample: f32) {
        let window = self.win[channel];
        let shifted = [window[1], window[2], window[3], sample];
        self.win[channel] = shifted;
        self.filled[channel] = (self.filled[channel] + 1).min(WINDOW);
        let mut local_peak = sample.abs();
        if self.filled[channel] == WINDOW {
            for t in [QUARTER, HALF, THREE_QUARTERS] {
                let interpolated =
                    catmull_rom(shifted[0], shifted[1], shifted[2], shifted[3], t).abs();
                local_peak = local_peak.max(interpolated);
            }
        }
        self.peak = self.peak.max(local_peak);
    }
}

/// Scan `source` to the end and return its true peak (the largest oversampled sample
/// magnitude), 0.0 for a zero-channel source.
pub fn measure_true_peak(mut source: Box<dyn Source>) -> Result<f32, PlayerError> {
    let channels = source.spec().channels as usize;
    if channels == 0 {
        return Ok(0.0);
    }
    let mut meter = TruePeakMeter::new(channels);
    loop {
        let chunk = source.next_chunk()?;
        if chunk.is_empty() {
            break;
        }
        meter.feed(&chunk);
    }
    Ok(meter.peak)
}
