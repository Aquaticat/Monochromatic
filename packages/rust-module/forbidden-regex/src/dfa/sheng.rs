//! Sheng-style in-register transition kernel: a faster single-line DFA scan.
//!
//! What: for a DFA of at most 64 states, fold each input byte's whole transition column
//! into one 64-byte permute table, so the per-byte step is a register permute (`vpermb`
//! on AVX-512VBMI, `vqtbl4q` on NEON) instead of a dependent table load. Why: a per-line
//! scan's critical chain is the dependent transition load (~5 cycles); a permute shortens
//! it to ~3, and needs no length sorting (a different axis from the across-lines batch).
//! The whole DFA state stays in a SIMD vector: every lane starts at the same state and
//! every step applies the same permute, so all lanes stay equal and lane 0 is the state.
//! Position-dependent acceptance folds in branchlessly: each byte accumulates
//! `acc |= accept_mask[state] & ctx_bit[byte]` in-register, read once at the end.

/// Imports the portable SIMD vector used as the permute table and the running state.
use std::simd::Simd;

/// Imports the DFA table and its per-boundary acceptance-bit helper.
use crate::dfa::table::{Dfa, accept_bit};

/// Lanes in the Sheng permute (also the largest state count it supports).
///
/// What: sixty-four, the width of `vpermb` / `vqtbl4q` and the lane cap of portable SIMD.
/// Why: the state index addresses one lane, so a DFA with more states cannot use this
/// kernel and falls back to the scalar scan.
const SHENG_LANES: usize = 64;

/// Precomputed permute tables for one DFA's Sheng scan.
///
/// What: per input byte a 64-byte next-state column, the per-state acceptance masks, the
/// per-byte acceptance context bit, the start state, and the end-of-input bit. Why: built
/// once per batch call and reused for every line, so the 16 KiB of `trans` columns amortizes.
struct ShengTables {
    /// `trans[byte][state]` = next state after `byte` from `state` (other lanes unused).
    trans: Vec<Simd<u8, SHENG_LANES>>,
    /// `accept[state]` = the state's 4-bit acceptance mask.
    accept: Simd<u8, SHENG_LANES>,
    /// `ctx[byte]` = the acceptance-bit a match would need given that byte follows.
    ctx: [u8; 256],
    /// Start state id.
    start: u8,
    /// Acceptance bit for the end-of-input boundary.
    end_bit: u8,
}

/// Building the Sheng tables and scanning a line with them.
impl Dfa {
    /// Builds the Sheng permute tables, or `None` when the DFA has over 64 states.
    ///
    /// What: fills a 64-byte next-state column per byte value (folding the byte class in),
    /// the per-state accept masks, and the per-byte context bits. Why: the scan then needs
    /// only `trans[byte]` and a permute per step, no class or transition memory load on the
    /// critical chain.
    fn build_sheng(&self) -> Option<ShengTables> {
        let states = self.num_states as usize;
        if states > SHENG_LANES {
            return None;
        }
        let nc = self.nclasses as usize;
        let mut trans = vec![Simd::splat(0u8); 256];
        let mut ctx = [0u8; 256];
        for byte in 0..256usize {
            let class = self.class_map[byte] as usize;
            ctx[byte] = accept_bit(self.class_word[class], self.class_newline[class]);
            let mut column = [0u8; SHENG_LANES];
            // `state` indexes both `column` and `self.trans` at a stride (`state*nc+class`),
            // so there is no single slice to iterate; clippy's enumerate hint cannot apply.
            #[allow(clippy::needless_range_loop)]
            for state in 0..states {
                column[state] = self.trans[state * nc + class] as u8;
            }
            trans[byte] = Simd::from_array(column);
        }
        let mut accept = [0u8; SHENG_LANES];
        accept[..states].copy_from_slice(&self.accept[..states]);
        Some(ShengTables {
            trans,
            accept: Simd::from_array(accept),
            ctx,
            start: self.start as u8,
            end_bit: accept_bit(false, true),
        })
    }

    /// Fills `out[i]` with whether the DFA matches `lines[i]`, via the Sheng kernel.
    ///
    /// What: builds the permute tables once (falling back to the scalar batch when the DFA
    /// is too large or the host lacks the permute), then scans each line. Why: the entry
    /// the benchmark and the public hook drive; runtime-gated so the wide permute only runs
    /// where its instruction exists.
    pub fn is_match_batch_sheng(&self, lines: &[&[u8]], out: &mut [bool]) {
        let Some(tables) = self.build_sheng() else {
            self.is_match_batch_scalar(lines, out);
            return;
        };
        #[cfg(target_arch = "x86_64")]
        {
            if is_x86_feature_detected!("avx512vbmi")
                && is_x86_feature_detected!("avx512bw")
                && is_x86_feature_detected!("avx512vl")
                && is_x86_feature_detected!("avx512f")
            {
                // Safety: guarded by the matching runtime feature detection above.
                unsafe { sheng_scan_all_avx512(&tables, lines, out) };
            } else {
                self.is_match_batch_scalar(lines, out);
            }
        }
        #[cfg(target_arch = "aarch64")]
        {
            // NEON's vqtbl4q is baseline on aarch64, so the permute is always available.
            for (line, slot) in lines.iter().zip(out.iter_mut()) {
                *slot = sheng_run(&tables, line);
            }
        }
        #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
        self.is_match_batch_scalar(lines, out);
    }
}

/// Scans one line through the Sheng tables, returning whether it matches.
///
/// What: keeps the state in a vector, per byte folds the masked acceptance into `acc` and
/// permutes to the next state, then tests the end-of-input boundary. Why: the permute is
/// the only step on the critical chain; marked always-inline so it picks up the dispatching
/// wrapper's target features.
#[inline(always)]
fn sheng_run(tables: &ShengTables, line: &[u8]) -> bool {
    let mut state = Simd::<u8, SHENG_LANES>::splat(tables.start);
    let mut acc = Simd::<u8, SHENG_LANES>::splat(0);
    for &byte in line {
        acc |= tables.accept.swizzle_dyn(state) & Simd::splat(tables.ctx[byte as usize]);
        state = tables.trans[byte as usize].swizzle_dyn(state);
    }
    acc |= tables.accept.swizzle_dyn(state) & Simd::splat(tables.end_bit);
    acc.to_array()[0] != 0
}

/// Scans every line with the Sheng kernel under AVX-512VBMI.
///
/// What: the per-line loop compiled with AVX-512VBMI so the inlined permute lowers to
/// `vpermb`. Why: the dispatcher calls this only after confirming the features at runtime.
#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx512f,avx512bw,avx512vl,avx512vbmi")]
unsafe fn sheng_scan_all_avx512(tables: &ShengTables, lines: &[&[u8]], out: &mut [bool]) {
    for (line, slot) in lines.iter().zip(out.iter_mut()) {
        *slot = sheng_run(tables, line);
    }
}

/// Unit tests for the Sheng kernel, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "sheng_tests.rs"]
mod tests;
