//! Batched multi-line match kernels for one DFA.
//!
//! What: a scalar reference, an interleaved-scalar kernel, and a lane-generic vertical
//! SIMD kernel dispatched at runtime to the widest instruction set the CPU actually
//! has (AVX-512, then AVX2, then NEON, then scalar). Why: a consumer scanning a whole
//! file calls one DFA against many short lines; advancing several lines at once exposes
//! the memory-level parallelism the per-line loop's serial state dependency hides. The
//! kernels are built so the benchmark can decide which layout wins on each machine, and
//! the SIMD path lights up AVX-512 at runtime without pinning the whole crate to it.

/// Imports the portable SIMD vector for the lockstep transition gather.
use std::simd::Simd;

/// Imports the DFA table and its per-boundary acceptance-bit helper.
use crate::dfa::table::{Dfa, accept_bit};

/// Lines advanced together by the interleaved kernel and the SIMD fallback.
///
/// What: the default lane count, eight. Why: eight independent transition reads give
/// the out-of-order core plenty to overlap, and eight 16-bit lanes fit one 128-bit
/// register, so it is the natural width when no wider runtime path is chosen.
pub const LANES: usize = 8;

/// Acceptance-bit for the end-of-input boundary (no next byte, at line end).
///
/// What: the mask bit tested once a line's bytes are exhausted. Why: `$` and `\b` can
/// accept at end of input, where `word_after` is false and `line_end` is true.
fn end_bit() -> u8 {
    accept_bit(false, true)
}

/// One chunk's per-lane cursors, generic over the lane count.
///
/// What: parallel arrays of current DFA state, finished flag, and verdict per lane.
/// Why: plain arrays keep the hot loop's bookkeeping in registers and let the SIMD
/// kernel lift `state` straight into a gather index vector.
struct Lanes<const N: usize> {
    /// Current DFA state id per lane.
    state: [usize; N],
    /// Whether a lane has reached a verdict (matched, or fell into the dead sink).
    done: [bool; N],
    /// Whether a lane's pattern matched.
    hit: [bool; N],
}

/// Construction of a fresh chunk cursor.
impl<const N: usize> Lanes<N> {
    /// Builds a cursor with every lane at `start` and no verdict yet.
    ///
    /// What: all lanes start at the DFA start state, unfinished, not hit. Why: each
    /// chunk begins a fresh independent scan per line.
    fn new(start: usize) -> Lanes<N> {
        Lanes {
            state: [start; N],
            done: [false; N],
            hit: [false; N],
        }
    }
}

/// Batch matching over many lines through one DFA.
impl Dfa {
    /// Fills `out[i]` with whether the DFA matches `lines[i]`, line by line.
    ///
    /// What: the scalar reference, one [`Dfa::is_match`] per line. Why: the correctness
    /// oracle every batch kernel must match, and the baseline the others are timed
    /// against.
    pub fn is_match_batch_scalar(&self, lines: &[&[u8]], out: &mut [bool]) {
        for (line, slot) in lines.iter().zip(out.iter_mut()) {
            *slot = self.is_match(line);
        }
    }

    /// Tests acceptance at one position for one lane, returning the byte's class.
    ///
    /// What: flips the lane's `hit`/`done` when its state accepts at the boundary before
    /// `byte`, then returns that byte's class for the transition step. Why: the scalar,
    /// interleaved, and SIMD kernels share this per-(lane, position) acceptance test.
    fn step_accept<const N: usize>(&self, lanes: &mut Lanes<N>, lane: usize, byte: u8) -> usize {
        let class = self.class_map[byte as usize] as usize;
        let mask = accept_bit(self.class_word[class], self.class_newline[class]);
        if self.accept[lanes.state[lane]] & mask != 0 {
            lanes.hit[lane] = true;
            lanes.done[lane] = true;
        }
        class
    }

    /// Applies the end-of-input acceptance test to every unfinished lane.
    ///
    /// What: marks `hit` on any lane whose state accepts at end of input. Why: a line
    /// whose bytes ran out without matching can still match at `$`/`\b`, exactly as the
    /// scalar loop's post-loop check.
    fn finish_chunk<const N: usize>(&self, lanes: &mut Lanes<N>) {
        let end = end_bit();
        for lane in 0..N {
            if !lanes.done[lane] && self.accept[lanes.state[lane]] & end != 0 {
                lanes.hit[lane] = true;
            }
        }
    }

    /// Fills `out` advancing `N` lines in lockstep with plain scalar transition reads.
    ///
    /// What: chunks by `N`, advances each chunk one column at a time with independent
    /// scalar table reads, and runs the leftover lines scalar. Why: this isolates the
    /// benefit of overlapping `N` independent loads (memory-level parallelism the core
    /// finds on its own) from the benefit of the SIMD gather instruction itself.
    pub fn is_match_batch_interleaved(&self, lines: &[&[u8]], out: &mut [bool]) {
        let nc = self.nclasses as usize;
        let dead = self.dead as usize;
        let start = self.start as usize;
        let mut chunks = lines.chunks_exact(LANES);
        let mut base = 0;
        for chunk in &mut chunks {
            let lens: [usize; LANES] = std::array::from_fn(|lane| chunk[lane].len());
            let max_len = lens.iter().copied().max().unwrap_or(0);
            let mut lanes = Lanes::<LANES>::new(start);
            // Column-major scan: `pos` indexes each lane's own line (`chunk[lane][pos]`),
            // not `chunk` itself, so there is no single collection to iterate; clippy's
            // enumerate hint would walk the wrong axis.
            #[allow(clippy::needless_range_loop)]
            for pos in 0..max_len {
                for lane in 0..LANES {
                    if lanes.done[lane] || pos >= lens[lane] {
                        continue;
                    }
                    let class = self.step_accept(&mut lanes, lane, chunk[lane][pos]);
                    if !lanes.done[lane] {
                        lanes.state[lane] = self.trans[lanes.state[lane] * nc + class] as usize;
                        if lanes.state[lane] == dead {
                            lanes.done[lane] = true;
                        }
                    }
                }
            }
            self.finish_chunk(&mut lanes);
            out[base..base + LANES].copy_from_slice(&lanes.hit);
            base += LANES;
        }
        for (offset, line) in chunks.remainder().iter().enumerate() {
            out[base + offset] = self.is_match(line);
        }
    }

    /// Advances one full chunk of `N` lines through the vertical SIMD kernel.
    ///
    /// What: per column, tests acceptance and computes each lane's class scalar, then
    /// gathers all `N` next-states in one SIMD op and retires lanes that reached the
    /// dead sink. Why: the gather issues every lane's transition read together; marked
    /// always-inline so it picks up the dispatching wrapper's target features.
    #[inline(always)]
    fn simd_chunk<const N: usize>(&self, chunk: &[&[u8]], out: &mut [bool]) {
        let nc = self.nclasses as usize;
        let dead = self.dead as usize;
        let lens: [usize; N] = std::array::from_fn(|lane| chunk[lane].len());
        let max_len = lens.iter().copied().max().unwrap_or(0);
        let mut lanes = Lanes::<N>::new(self.start as usize);
        // Column-major scan: `pos` indexes each lane's own line (`chunk[lane][pos]`),
        // not `chunk` itself, so there is no single collection to iterate; clippy's
        // enumerate hint would walk the wrong axis.
        #[allow(clippy::needless_range_loop)]
        for pos in 0..max_len {
            let mut class = [0usize; N];
            for lane in 0..N {
                if lanes.done[lane] || pos >= lens[lane] {
                    continue;
                }
                class[lane] = self.step_accept(&mut lanes, lane, chunk[lane][pos]);
            }
            let index = Simd::<usize, N>::from_array(lanes.state) * Simd::splat(nc)
                + Simd::<usize, N>::from_array(class);
            let next = Simd::<u16, N>::gather_or(&self.trans, index, Simd::splat(0)).to_array();
            for lane in 0..N {
                if lanes.done[lane] || pos >= lens[lane] {
                    continue;
                }
                lanes.state[lane] = next[lane] as usize;
                if lanes.state[lane] == dead {
                    lanes.done[lane] = true;
                }
            }
        }
        self.finish_chunk(&mut lanes);
        out.copy_from_slice(&lanes.hit);
    }

    /// Fills `out` with the vertical SIMD kernel at lane width `N`.
    ///
    /// What: chunks the lines by `N`, runs each chunk through [`Dfa::simd_chunk`], and
    /// scans the leftover lines scalar. Why: the shared driver behind every runtime
    /// width, inlined into the feature-gated wrappers so each gets the right ISA.
    #[inline(always)]
    fn simd_width<const N: usize>(&self, lines: &[&[u8]], out: &mut [bool]) {
        let mut chunks = lines.chunks_exact(N);
        let mut base = 0;
        for chunk in &mut chunks {
            self.simd_chunk::<N>(chunk, &mut out[base..base + N]);
            base += N;
        }
        for (offset, line) in chunks.remainder().iter().enumerate() {
            out[base + offset] = self.is_match(line);
        }
    }

    /// Fills `out` with the vertical SIMD kernel, dispatched to the widest available ISA.
    ///
    /// What: picks AVX-512 (16 lanes), then AVX2 (8 lanes), then NEON (8 lanes), then a
    /// scalar-width SIMD pass, by runtime feature detection. Why: lets the one matcher
    /// use AVX-512 on a capable host yet still run anywhere, with no crate-wide
    /// target-cpu pin; each gate is a real `is_..._detected!` check so the wide path
    /// only runs where its instructions exist.
    pub fn is_match_batch_simd(&self, lines: &[&[u8]], out: &mut [bool]) {
        #[cfg(target_arch = "x86_64")]
        {
            if is_x86_feature_detected!("avx512f")
                && is_x86_feature_detected!("avx512bw")
                && is_x86_feature_detected!("avx512vl")
            {
                // Safety: guarded by the matching runtime feature detection above.
                unsafe { self.simd_avx512(lines, out) };
                return;
            }
            if is_x86_feature_detected!("avx2") {
                // Safety: guarded by the AVX2 runtime feature detection above.
                unsafe { self.simd_avx2(lines, out) };
                return;
            }
        }
        #[cfg(target_arch = "aarch64")]
        {
            // NEON is baseline on aarch64, so portable SIMD already targets it.
            self.simd_width::<LANES>(lines, out);
            return;
        }
        #[cfg(not(target_arch = "aarch64"))]
        self.simd_width::<LANES>(lines, out);
    }

    /// AVX-512 vertical kernel at sixteen lanes.
    ///
    /// What: the 16-lane SIMD pass compiled with AVX-512. Why: sixteen independent
    /// transition reads per column, the widest gather/mask path on this machine class.
    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "avx512f,avx512bw,avx512vl")]
    unsafe fn simd_avx512(&self, lines: &[&[u8]], out: &mut [bool]) {
        self.simd_width::<16>(lines, out);
    }

    /// AVX2 vertical kernel at eight lanes.
    ///
    /// What: the 8-lane SIMD pass compiled with AVX2. Why: the widest path on hosts
    /// without AVX-512, still issuing eight transition reads per column together.
    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "avx2")]
    unsafe fn simd_avx2(&self, lines: &[&[u8]], out: &mut [bool]) {
        self.simd_width::<LANES>(lines, out);
    }
}

/// Unit tests for the batch kernels, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "batch_tests.rs"]
mod tests;
