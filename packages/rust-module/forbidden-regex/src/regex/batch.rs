//! Batched, many-lines-at-once matching for the public matcher types.
//!
//! What: `is_match_batch` on [`Regex`] and [`RegexSet`], plus hidden per-kernel entry
//! points the benchmark uses to race the scalar, interleaved, tight, and Sheng layouts.
//! Why: a consumer scanning a whole file hands every line at once; one call lets the engine
//! pick the fastest layout (and, for a seedless single pattern, the Sheng permute kernel)
//! instead of paying per-line call overhead.

/// Imports the public matcher types this module extends.
use super::{CheckedFull, Regex, RegexSet};

/// Imports the anchored line-start match used by the per-line resolution.
use crate::build::line_start_match;

/// Lines advanced together per exact-length bucket in [`Regex::is_match_batch_bucketed`].
///
/// What: the bucket width, thirty-two. Why: the cross-arch sweep found 32 the sweet
/// spot, enough independent transition chains to saturate memory-level parallelism while
/// the per-column bookkeeping stays small; 16 is slightly behind and 64 regresses.
const BATCH_BUCKET: usize = 32;

/// Many-lines matching for a single compiled pattern.
impl Regex {
    /// Reports, per line, whether the pattern matches a substring of that line.
    ///
    /// What: returns one verdict per input line. Why: the batch face of
    /// [`Regex::is_match`]; a seedless table pattern over a large batch runs the Sheng
    /// permute kernel, every other shape loops the per-line match.
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

    /// Reports per line, grouping equal-length lines so the DFA advances many at once.
    ///
    /// What: for a table-backed pattern, sorts the line indices by length, runs the
    /// branchless equal-length kernel over each exact-length bucket [`BATCH_BUCKET`] lines
    /// at a time, and scatters verdicts back to input order; other back-ends fall through
    /// to the per-line loop. Why: a single full-scan DFA is latency-bound per line, but a
    /// bucket of equal-length lines exposes independent transition chains the core
    /// overlaps. Measured 1.04x-1.09x on x86 and 1.32x-1.37x on arm64 over the per-line
    /// loop in the low-match regime a secret scanner sees; it does not help when most
    /// lines match (the per-line loop early-exits) so it is opt-in, not the default. The
    /// internal sort is near-linear on already length-sorted input, so a caller that
    /// pre-buckets pays almost nothing for it.
    ///
    /// # Example
    ///
    /// ```
    /// let re = forbidden_regex::compile("[0-9a-f]{32}").unwrap();
    /// let lines: &[&[u8]] = &[b"deadbeefdeadbeefdeadbeefdeadbeef", b"short", b"nope"];
    /// assert_eq!(re.is_match_batch_bucketed(lines), re.is_match_batch(lines));
    /// ```
    pub fn is_match_batch_bucketed(&self, lines: &[&[u8]]) -> Vec<bool> {
        let mut out = vec![false; lines.len()];
        let Some(dfa) = self.engine.table_dfa() else {
            self.engine.is_match_batch(lines, &mut out);
            return out;
        };
        let mut order: Vec<usize> = (0..lines.len()).collect();
        order.sort_by_key(|&index| lines[index].len());
        let mut start = 0;
        while start < order.len() {
            let len = lines[order[start]].len();
            let mut end = start + 1;
            while end < order.len() && lines[order[end]].len() == len {
                end += 1;
            }
            let bucket: Vec<&[u8]> = order[start..end].iter().map(|&index| lines[index]).collect();
            let mut verdicts = vec![false; bucket.len()];
            dfa.is_match_batch_tight_w::<BATCH_BUCKET>(&bucket, &mut verdicts);
            for (slot, &index) in order[start..end].iter().enumerate() {
                out[index] = verdicts[slot];
            }
            start = end;
        }
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

    /// Benchmark hook: forces the interleaved-scalar kernel.
    ///
    /// What: runs the interleaved batch on the table back-end, else the per-line loop.
    /// Why: measures the memory-level parallelism of N independent scalar transition chains
    /// against the scalar baseline.
    #[doc(hidden)]
    pub fn is_match_batch_interleaved(&self, lines: &[&[u8]]) -> Vec<bool> {
        let mut out = vec![false; lines.len()];
        match self.engine.table_dfa() {
            Some(dfa) => dfa.is_match_batch_interleaved(lines, &mut out),
            None => self.engine.is_match_batch(lines, &mut out),
        }
        out
    }

    /// Benchmark hook: reports whether this pattern compiled to the table DFA back-end.
    ///
    /// What: true when the engine is `EngineKind::Table`. Why: the batch kernels only
    /// diverge on a table back-end, so the benchmark confirms a microbench pattern is
    /// one before trusting its kernel-versus-kernel numbers.
    #[doc(hidden)]
    pub fn is_table(&self) -> bool {
        self.engine.table_dfa().is_some()
    }

    /// Benchmark hook: interleaved-scalar kernel at an explicit bucket width `N`.
    ///
    /// What: forces the interleaved batch at `N` lanes on the table back-end, else the
    /// per-line loop. Why: sweeps how bucket size trades memory-level parallelism against
    /// per-chunk overhead.
    #[doc(hidden)]
    pub fn batch_inter_w<const N: usize>(&self, lines: &[&[u8]]) -> Vec<bool> {
        let mut out = vec![false; lines.len()];
        match self.engine.table_dfa() {
            Some(dfa) => dfa.is_match_batch_interleaved_w::<N>(lines, &mut out),
            None => self.engine.is_match_batch(lines, &mut out),
        }
        out
    }

    /// Benchmark hook: branchless equal-length kernel at bucket width `N`.
    ///
    /// What: forces the tight batch at `N` lanes on the table back-end; `lines` must all
    /// share one byte length (an exact-length bucket). Why: measures the MLP ceiling once
    /// the per-lane early-exit branches are removed.
    #[doc(hidden)]
    pub fn batch_tight_w<const N: usize>(&self, lines: &[&[u8]]) -> Vec<bool> {
        let mut out = vec![false; lines.len()];
        match self.engine.table_dfa() {
            Some(dfa) => dfa.is_match_batch_tight_w::<N>(lines, &mut out),
            None => self.engine.is_match_batch(lines, &mut out),
        }
        out
    }

    /// Benchmark hook: Sheng in-register transition kernel (no bucketing needed).
    ///
    /// What: forces the Sheng per-line scan on a table back-end of at most 64 states, else
    /// the per-line loop. Why: measures the permute-transition path that attacks per-byte
    /// latency directly, a different axis from the across-lines bucketed kernels.
    #[doc(hidden)]
    pub fn batch_sheng(&self, lines: &[&[u8]]) -> Vec<bool> {
        let mut out = vec![false; lines.len()];
        match self.engine.table_dfa() {
            Some(dfa) => dfa.is_match_batch_sheng(lines, &mut out),
            None => self.engine.is_match_batch(lines, &mut out),
        }
        out
    }

    /// Benchmark hook: two-byte composed Sheng kernel.
    ///
    /// What: forces the two-byte Sheng scan on a qualifying table back-end (position-
    /// independent acceptance, at most 64 states and 16 classes), else the scalar batch.
    /// Why: measures whether one permute per two bytes beats the one-byte Sheng.
    #[doc(hidden)]
    pub fn batch_sheng2(&self, lines: &[&[u8]]) -> Vec<bool> {
        let mut out = vec![false; lines.len()];
        match self.engine.table_dfa() {
            Some(dfa) => dfa.is_match_batch_sheng2(lines, &mut out),
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

    /// Benchmark hook: batch via one concatenated-buffer gate sweep.
    ///
    /// What: joins the lines with `\n` separators, sweeps the SIMD prefilter once over
    /// the whole buffer to mark which lines hold a seed, then resolves each line. Why:
    /// the negative-line cost is the per-line prefilter, and short lines starve Teddy's
    /// SIMD; one long-buffer sweep runs it at full width and skips the per-line gate on
    /// every line with no seed. Equivalent to [`RegexSet::is_match_batch`] line for line.
    #[doc(hidden)]
    pub fn is_match_batch_concat(&self, lines: &[&[u8]]) -> Vec<bool> {
        let count = lines.len();
        if count == 0 {
            return Vec::new();
        }
        let total: usize = lines.iter().map(|line| line.len() + 1).sum();
        let mut buf = Vec::with_capacity(total);
        let mut starts = Vec::with_capacity(count);
        for line in lines {
            starts.push(buf.len());
            buf.extend_from_slice(line);
            buf.push(b'\n');
        }
        let candidate = self.sweep_candidates(&buf, &starts);
        (0..count)
            .map(|index| {
                let end = starts.get(index + 1).copied().unwrap_or(buf.len()) - 1;
                self.resolve_line(&buf[starts[index]..end], candidate[index])
            })
            .collect()
    }

    /// Marks, by one prefilter sweep over `buf`, which lines contain a seeded literal.
    ///
    /// What: walks the prefilter from hit to hit, attributing each to its line and
    /// jumping to the next line start. Why: one SIMD pass replaces a per-line prefilter
    /// call, and jumping past a flagged line keeps the sweep over the negative gaps.
    fn sweep_candidates(&self, buf: &[u8], starts: &[usize]) -> Vec<bool> {
        let mut candidate = vec![false; starts.len()];
        let mut at = 0;
        while let Some(hit) = self.gate.prefilter_find_from(buf, at) {
            let line = starts.partition_point(|&start| start <= hit) - 1;
            candidate[line] = true;
            at = starts.get(line + 1).copied().unwrap_or(buf.len());
            if at >= buf.len() {
                break;
            }
        }
        candidate
    }

    /// Resolves one line's verdict given whether the sweep found a seed in it.
    ///
    /// What: runs the seeded-rule gate only when a seed is present, then the line-start
    /// rules and the literal-free groups, mirroring [`RegexSet::is_match`]. Why: skipping
    /// the gate on a seedless line is exactly what the prefilter would have done per
    /// line, so the verdict is unchanged.
    fn resolve_line(&self, line: &[u8], has_seed: bool) -> bool {
        if has_seed {
            let mut checked = CheckedFull::new();
            if self
                .gate
                .any_candidate(line, |rule, pos| self.matches_rule(line, rule, pos, &mut checked))
            {
                return true;
            }
        }
        if self.line_start_candidate(line)
            && self.line_start.iter().any(|engine| line_start_match(engine, line))
        {
            return true;
        }
        self.seedless_groups.iter().any(|group| group.is_match(line))
    }
}

/// Unit tests for the batch API, in a sidecar (max-lines exempt).
#[cfg(test)]
#[path = "batch_tests.rs"]
mod tests;
