//! Two-byte composed Sheng kernel: one permute advances the state by two input bytes.
//!
//! What: for a DFA whose acceptance is position-independent (every state's mask is all-set
//! or all-clear, so no `$`/`\b` makes it depend on the next byte) and with few byte
//! classes, precompute a transition table over class PAIRS: `t2[c0,c1][s]` = the state two
//! bytes on. The per-(two-byte) step is then one `vpermb`, halving the critical chain
//! versus the one-byte Sheng. Why: the one-byte kernel is latency-bound on the transition
//! permute; composing two steps into one table halves that chain. Acceptance over the pair
//! is folded into a second table `a2[c0,c1][s]` (did the state or the in-between state
//! accept), kept off the critical chain. Position-independence lets acceptance be a single
//! bit, so the pair table stays one byte per entry.

/// Imports the AVX-512 permute and bitwise intrinsics for the x86 path.
#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::{
    __m512i, _mm512_loadu_si512, _mm512_or_si512, _mm512_permutexvar_epi8, _mm512_set1_epi8,
    _mm512_setzero_si512, _mm512_test_epi8_mask,
};

/// Imports the NEON table-lookup and reduce intrinsics for the arm64 path.
#[cfg(target_arch = "aarch64")]
use std::arch::aarch64::{vdupq_n_u8, vld1q_u8_x4, vmaxvq_u8, vorrq_u8, vqtbl4q_u8};

/// Imports the DFA table.
use crate::dfa::table::Dfa;

/// Largest state count the permute addresses (one lane per state).
const SHENG2_MAX_STATES: usize = 64;

/// Largest class count whose pair table (`nc * nc` columns) stays cache-friendly.
const SHENG2_MAX_CLASSES: usize = 16;

/// Acceptance mask of a state that accepts in every boundary context.
const ACCEPT_ALL: u8 = 0x0F;

/// Precomputed two-byte composed tables for one position-independent DFA.
///
/// What: a next-state column per ordered class pair, an acceptance column per pair, a
/// one-byte column per class for the trailing odd byte, the per-state accept flags, the
/// byte-to-class map, the class count, and the start state. Why: built once per batch call
/// and reused for every line.
struct Sheng2Tables {
    /// `t2[c0 * nc + c1][s]` = state after consuming class `c0` then `c1` from `s`.
    t2: Vec<[u8; SHENG2_MAX_STATES]>,
    /// `a2[c0 * nc + c1][s]` = 0xFF if `s` or the in-between state accepts, else 0.
    a2: Vec<[u8; SHENG2_MAX_STATES]>,
    /// `trans1[c][s]` = state after one byte of class `c`, for a trailing odd byte.
    trans1: Vec<[u8; SHENG2_MAX_STATES]>,
    /// `accept[s]` = 0xFF if state `s` accepts (position-independent, so one bit).
    accept: [u8; SHENG2_MAX_STATES],
    /// Byte-to-class map copied for the scan.
    class_map: [u8; 256],
    /// Number of byte classes.
    nc: usize,
    /// Start state id.
    start: u8,
}

/// Building the two-byte tables and scanning lines with them.
impl Dfa {
    /// Builds the composed tables, or `None` when the DFA does not qualify.
    ///
    /// What: requires at most 64 states, position-independent acceptance, and at most 16
    /// classes; then fills the pair transition, pair acceptance, single-byte transition,
    /// and accept-flag tables. Why: the composition is only sound when acceptance does not
    /// depend on the byte after the boundary, and the pair table is `nc*nc` wide.
    fn build_sheng2(&self) -> Option<Sheng2Tables> {
        let states = self.num_states as usize;
        let nc = self.nclasses as usize;
        if states > SHENG2_MAX_STATES || nc > SHENG2_MAX_CLASSES {
            return None;
        }
        if self.accept[..states].iter().any(|&mask| mask != 0 && mask != ACCEPT_ALL) {
            return None;
        }
        let mut trans1 = vec![[0u8; SHENG2_MAX_STATES]; nc];
        for (class, column) in trans1.iter_mut().enumerate() {
            for (state, slot) in column.iter_mut().enumerate().take(states) {
                *slot = self.trans[state * nc + class] as u8;
            }
        }
        let mut t2 = vec![[0u8; SHENG2_MAX_STATES]; nc * nc];
        let mut a2 = vec![[0u8; SHENG2_MAX_STATES]; nc * nc];
        for c0 in 0..nc {
            for c1 in 0..nc {
                let pair = c0 * nc + c1;
                for state in 0..states {
                    let mid = self.trans[state * nc + c0] as usize;
                    t2[pair][state] = self.trans[mid * nc + c1] as u8;
                    let accepts = self.accept[state] != 0 || self.accept[mid] != 0;
                    a2[pair][state] = if accepts { 0xFF } else { 0 };
                }
            }
        }
        let mut accept = [0u8; SHENG2_MAX_STATES];
        for (state, slot) in accept.iter_mut().enumerate().take(states) {
            *slot = if self.accept[state] != 0 { 0xFF } else { 0 };
        }
        let mut class_map = [0u8; 256];
        class_map.copy_from_slice(&self.class_map);
        Some(Sheng2Tables { t2, a2, trans1, accept, class_map, nc, start: self.start as u8 })
    }

    /// Fills `out[i]` with whether the DFA matches `lines[i]`, via the two-byte kernel.
    ///
    /// What: builds the composed tables once (scalar fallback when the DFA does not qualify
    /// or the host lacks AVX-512VBMI), then scans each line. Why: the entry the benchmark
    /// hook drives; arm64 and other hosts use the scalar batch until a NEON path is added.
    pub fn is_match_batch_sheng2(&self, lines: &[&[u8]], out: &mut [bool]) {
        let qualifies = self.build_sheng2();
        #[cfg(target_arch = "x86_64")]
        if let Some(tables) = qualifies
            && is_x86_feature_detected!("avx512vbmi")
            && is_x86_feature_detected!("avx512bw")
            && is_x86_feature_detected!("avx512f")
        {
            // Safety: guarded by the matching runtime feature detection above.
            unsafe { sheng2_all_avx512(&tables, lines, out) };
            return;
        }
        #[cfg(target_arch = "aarch64")]
        if let Some(tables) = qualifies {
            for (line, slot) in lines.iter().zip(out.iter_mut()) {
                // Safety: NEON (and vqtbl4q) is baseline on aarch64.
                *slot = unsafe { sheng2_line_neon(&tables, line) };
            }
            return;
        }
        #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
        let _ = qualifies;
        // Did not qualify (position-dependent acceptance, too many classes) or no permute:
        // cascade to the one-byte Sheng, which itself falls back to the scalar scan.
        self.is_match_batch_sheng(lines, out);
    }
}

/// Scans every line with the AVX-512 two-byte composed kernel.
///
/// What: per line consumes two bytes per permute (folding both positions' acceptance into
/// `acc`), then a trailing odd byte and the end-of-input boundary, and tests `acc`. Why:
/// one `vpermb` per two bytes is the halved critical chain; the whole loop is one
/// `#[target_feature]` function so every intrinsic is in scope.
///
/// # Safety
///
/// The caller must have confirmed AVX-512F, AVX-512BW, and AVX-512VBMI at runtime.
#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx512f,avx512bw,avx512vbmi")]
unsafe fn sheng2_all_avx512(tables: &Sheng2Tables, lines: &[&[u8]], out: &mut [bool]) {
    let accept = unsafe { _mm512_loadu_si512(tables.accept.as_ptr().cast::<__m512i>()) };
    let nc = tables.nc;
    for (line, slot) in lines.iter().zip(out.iter_mut()) {
        let bytes: &[u8] = line;
        let mut state = _mm512_set1_epi8(tables.start as i8);
        let mut acc = _mm512_setzero_si512();
        let mut index = 0;
        while index + 1 < bytes.len() {
            let pair = tables.class_map[bytes[index] as usize] as usize * nc
                + tables.class_map[bytes[index + 1] as usize] as usize;
            let accepts =
                unsafe { _mm512_loadu_si512(tables.a2[pair].as_ptr().cast::<__m512i>()) };
            acc = _mm512_or_si512(acc, _mm512_permutexvar_epi8(state, accepts));
            let step = unsafe { _mm512_loadu_si512(tables.t2[pair].as_ptr().cast::<__m512i>()) };
            state = _mm512_permutexvar_epi8(state, step);
            index += 2;
        }
        if index < bytes.len() {
            let class = tables.class_map[bytes[index] as usize] as usize;
            acc = _mm512_or_si512(acc, _mm512_permutexvar_epi8(state, accept));
            let step = unsafe { _mm512_loadu_si512(tables.trans1[class].as_ptr().cast::<__m512i>()) };
            state = _mm512_permutexvar_epi8(state, step);
        }
        acc = _mm512_or_si512(acc, _mm512_permutexvar_epi8(state, accept));
        *slot = _mm512_test_epi8_mask(acc, acc) != 0;
    }
}

/// Scans one line with the NEON two-byte composed kernel.
///
/// What: the same two-bytes-per-permute scan using a 64-byte NEON table lookup, with a
/// trailing odd byte and the end-of-input boundary. Why: the arm64 equivalent of the
/// AVX-512 path; `vqtbl4q_u8` indexes a four-register 64-byte table.
///
/// # Safety
///
/// NEON (and `vqtbl4q`) is baseline on aarch64, so this is always valid there.
#[cfg(target_arch = "aarch64")]
#[inline]
unsafe fn sheng2_line_neon(tables: &Sheng2Tables, line: &[u8]) -> bool {
    unsafe {
        let accept = vld1q_u8_x4(tables.accept.as_ptr());
        let nc = tables.nc;
        let mut state = vdupq_n_u8(tables.start);
        let mut acc = vdupq_n_u8(0);
        let mut index = 0;
        while index + 1 < line.len() {
            let pair = tables.class_map[line[index] as usize] as usize * nc
                + tables.class_map[line[index + 1] as usize] as usize;
            acc = vorrq_u8(acc, vqtbl4q_u8(vld1q_u8_x4(tables.a2[pair].as_ptr()), state));
            state = vqtbl4q_u8(vld1q_u8_x4(tables.t2[pair].as_ptr()), state);
            index += 2;
        }
        if index < line.len() {
            let class = tables.class_map[line[index] as usize] as usize;
            acc = vorrq_u8(acc, vqtbl4q_u8(accept, state));
            state = vqtbl4q_u8(vld1q_u8_x4(tables.trans1[class].as_ptr()), state);
        }
        acc = vorrq_u8(acc, vqtbl4q_u8(accept, state));
        vmaxvq_u8(acc) != 0
    }
}

/// Unit tests for the two-byte composed kernel, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "sheng2_tests.rs"]
mod tests;
