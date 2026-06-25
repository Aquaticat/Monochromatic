//! Batched, many-lines-at-once matching for the public matcher types.
//!
//! What: `is_match_batch` on [`Regex`] and [`RegexSet`], plus hidden per-kernel entry
//! points the benchmark uses to race the scalar, interleaved, and SIMD layouts. Why: a
//! consumer scanning a whole file hands every line at once; one call lets the engine
//! pick the fastest layout (and, for a seedless single pattern, the vertical SIMD
//! kernel) instead of paying per-line call overhead.

/// Imports the public matcher types this module extends.
use super::{Regex, RegexSet};

/// Many-lines matching for a single compiled pattern.
impl Regex {
    /// Reports, per line, whether the pattern matches a substring of that line.
    ///
    /// What: returns one verdict per input line. Why: the batch face of
    /// [`Regex::is_match`]; a seedless table pattern runs the vertical SIMD kernel,
    /// every other shape loops the per-line match.
    ///
    /// # Example
    ///
    /// ```
    /// let re = forbidden_regex::compile("AKIA[A-Z2-7]{4}").unwrap();
    /// let lines: &[&[u8]] = &[b"AKIA2345", b"nope"];
    /// assert_eq!(re.is_match_batch(lines), vec![true, false]);
    /// ```
    pub fn is_match_batch(&self, lines: &[&[u8]]) -> Vec<bool> {
        let mut out = vec![false; lines.len()];
        self.engine.is_match_batch(lines, &mut out);
        out
    }

    /// Benchmark hook: forces the scalar per-line kernel.
    ///
    /// What: runs the scalar batch on the table back-end, else the ordinary per-line
    /// loop. Why: the baseline the SIMD and interleaved kernels are timed against.
    #[doc(hidden)]
    pub fn is_match_batch_scalar(&self, lines: &[&[u8]]) -> Vec<bool> {
        let mut out = vec![false; lines.len()];
        match self.engine.table_dfa() {
            Some(dfa) => dfa.is_match_batch_scalar(lines, &mut out),
            None => self.engine.is_match_batch(lines, &mut out),
        }
        out
    }

    /// Benchmark hook: forces the vertical SIMD kernel.
    ///
    /// What: runs the runtime-dispatched SIMD batch on the table back-end, else the
    /// per-line loop. Why: measures the gather/lockstep layout against the baseline.
    #[doc(hidden)]
    pub fn is_match_batch_simd(&self, lines: &[&[u8]]) -> Vec<bool> {
        let mut out = vec![false; lines.len()];
        match self.engine.table_dfa() {
            Some(dfa) => dfa.is_match_batch_simd(lines, &mut out),
            None => self.engine.is_match_batch(lines, &mut out),
        }
        out
    }

    /// Benchmark hook: forces the interleaved-scalar kernel.
    ///
    /// What: runs the interleaved batch on the table back-end, else the per-line loop.
    /// Why: isolates memory-level parallelism from the SIMD gather instruction.
    #[doc(hidden)]
    pub fn is_match_batch_interleaved(&self, lines: &[&[u8]]) -> Vec<bool> {
        let mut out = vec![false; lines.len()];
        match self.engine.table_dfa() {
            Some(dfa) => dfa.is_match_batch_interleaved(lines, &mut out),
            None => self.engine.is_match_batch(lines, &mut out),
        }
        out
    }
}

/// Many-lines matching for a whole ruleset.
impl RegexSet {
    /// Reports, per line, whether any rule matches a substring of that line.
    ///
    /// What: one verdict per input line, equal to calling [`RegexSet::is_match`] on
    /// each. Why: the batch face of the set matcher; the consumer scans a file by
    /// handing every line at once.
    ///
    /// # Example
    ///
    /// ```
    /// let set = forbidden_regex::RegexSet::new(&["AKIA[A-Z2-7]{4}", "secret"]).unwrap();
    /// let lines: &[&[u8]] = &[b"AKIA2345", b"all clear", b"a secret here"];
    /// assert_eq!(set.is_match_batch(lines), vec![true, false, true]);
    /// ```
    pub fn is_match_batch(&self, lines: &[&[u8]]) -> Vec<bool> {
        lines.iter().map(|line| self.is_match(line)).collect()
    }
}

/// Unit tests for the batch API, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "batch_tests.rs"]
mod tests;
