//! Batched multi-line match kernels for one DFA: a scalar reference, an interleaved-scalar
//! kernel, and a branchless equal-length kernel.
//!
//! What: a per-line scalar baseline, an interleaved kernel advancing `N` lines in lockstep
//! with independent scalar transition reads, and a branchless kernel for exact-length
//! buckets. Why: a consumer scanning a whole file calls one DFA against many lines;
//! advancing several at once exposes the memory-level parallelism the per-line loop's
//! serial state dependency hides. The faster across-lines win is the Sheng permute kernel
//! (see `dfa::sheng`/`dfa::sheng2`); the interleaved and tight kernels here reach parity to
//! a small win and back the `is_match_batch_bucketed` opt-in for over-64-state DFAs. A
//! vertical SIMD gather across lines was measured and removed: it lost on both arches
//! (x86 has no 16-bit gather, even native u32 `vpgatherdd` and NEON lose to scalar loads).

/// Imports the DFA table and its per-boundary acceptance-bit helper.
use crate::dfa::table::{Dfa, accept_bit};

/// Lines advanced together by the interleaved kernel at the default width.
///
/// What: the default lane count, eight. Why: eight independent transition reads give the
/// out-of-order core plenty to overlap; the bucketed opt-in sweeps wider widths.
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
/// Why: plain arrays keep the interleaved kernel's per-lane bookkeeping in registers so
/// the `N` independent transition reads overlap.
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
    /// `byte`, then returns that byte's class for the transition step. Why: the interleaved
    /// kernel runs this per-(lane, position) acceptance test for each lane in a chunk.
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
    /// scalar table reads, and runs the leftover lines scalar. Why: overlapping `N`
    /// independent transition loads exposes the memory-level parallelism the per-line
    /// loop's serial dependency hides; `N` is the bucket width so the benchmark can sweep it.
    #[inline(always)]
    fn interleaved_width<const N: usize>(&self, lines: &[&[u8]], out: &mut [bool]) {
        let nc = self.nclasses as usize;
        let dead = self.dead as usize;
        let start = self.start as usize;
        let mut chunks = lines.chunks_exact(N);
        let mut base = 0;
        for chunk in &mut chunks {
            let lens: [usize; N] = std::array::from_fn(|lane| chunk[lane].len());
            let max_len = lens.iter().copied().max().unwrap_or(0);
            let mut lanes = Lanes::<N>::new(start);
            // Column-major scan: `pos` indexes each lane's own line (`chunk[lane][pos]`),
            // not `chunk` itself, so there is no single collection to iterate; clippy's
            // enumerate hint would walk the wrong axis.
            #[allow(clippy::needless_range_loop)]
            for pos in 0..max_len {
                for lane in 0..N {
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
            out[base..base + N].copy_from_slice(&lanes.hit);
            base += N;
        }
        for (offset, line) in chunks.remainder().iter().enumerate() {
            out[base + offset] = self.is_match(line);
        }
    }

    /// Fills `out` with the interleaved kernel at the default bucket width.
    ///
    /// What: [`Dfa::interleaved_width`] at [`LANES`] lanes. Why: the production-shaped
    /// entry; the width sweep uses [`Dfa::is_match_batch_interleaved_w`].
    pub fn is_match_batch_interleaved(&self, lines: &[&[u8]], out: &mut [bool]) {
        self.interleaved_width::<LANES>(lines, out);
    }

    /// Benchmark hook: interleaved kernel at an explicit bucket width `N`.
    ///
    /// What: [`Dfa::interleaved_width`] at the caller-chosen `N`. Why: lets the bench
    /// sweep how bucket size trades memory-level parallelism against per-chunk overhead.
    pub fn is_match_batch_interleaved_w<const N: usize>(&self, lines: &[&[u8]], out: &mut [bool]) {
        self.interleaved_width::<N>(lines, out);
    }

    /// Advances `N` equal-length lines branchlessly, accumulating a match per lane.
    ///
    /// What: every line in `chunk` must be exactly `len` bytes; per column it folds the
    /// acceptance test into `hit` with `|=` and always takes the transition, with no
    /// per-lane early-exit branch. Why: the per-lane `done`/length branches are what
    /// capped the interleaved kernel at parity; dropping them (sound, since the verdict
    /// only accumulates) lets the `N` independent transition chains pipeline fully. The
    /// rare matched lane scans a few extra bytes, negligible at a scanner's match rate.
    #[inline(always)]
    fn tight_chunk<const N: usize>(&self, chunk: &[&[u8]], len: usize, out: &mut [bool]) {
        let nc = self.nclasses as usize;
        let mut state = [self.start as usize; N];
        let mut hit = [false; N];
        // `pos` indexes each lane's own line (`chunk[lane][pos]`), not `chunk`; the loop
        // is the column walk, so clippy's enumerate hint targets the wrong axis.
        #[allow(clippy::needless_range_loop)]
        for pos in 0..len {
            for lane in 0..N {
                let class = self.class_map[chunk[lane][pos] as usize] as usize;
                let mask = accept_bit(self.class_word[class], self.class_newline[class]);
                hit[lane] |= self.accept[state[lane]] & mask != 0;
                state[lane] = self.trans[state[lane] * nc + class] as usize;
            }
        }
        let end = end_bit();
        for lane in 0..N {
            hit[lane] |= self.accept[state[lane]] & end != 0;
        }
        out.copy_from_slice(&hit);
    }

    /// Benchmark hook: branchless equal-length kernel at bucket width `N`.
    ///
    /// What: runs [`Dfa::tight_chunk`] over `lines`, which must all share one byte length
    /// (an exact-length bucket), with the leftover lines scanned scalar. Why: measures
    /// the memory-level-parallelism ceiling once the per-lane branches are gone.
    pub fn is_match_batch_tight_w<const N: usize>(&self, lines: &[&[u8]], out: &mut [bool]) {
        let len = lines.first().map_or(0, |line| line.len());
        let mut chunks = lines.chunks_exact(N);
        let mut base = 0;
        for chunk in &mut chunks {
            self.tight_chunk::<N>(chunk, len, &mut out[base..base + N]);
            base += N;
        }
        for (offset, line) in chunks.remainder().iter().enumerate() {
            out[base + offset] = self.is_match(line);
        }
    }

}

/// Unit tests for the batch kernels, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "batch_tests.rs"]
mod tests;
