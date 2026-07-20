//! Line-based file scan against the forbidden-regex engine's batch API.
//!
//! Stage two of the engine swap (#384) replaces the aho-corasick/resharp per-file
//! scan with the engine's buffer-batch face. A file's bytes are split into lines and
//! handed to `RegexSet::line_matches(buf, starts)`, which resolves per-line rule ids
//! in one SIMD prefilter sweep. Findings emit as `PATH:LINE rule=N`, one per
//! line-and-rule pair, with no column segment (the engine reports per-line rule
//! indices, not spans).
//!
//! Line mechanics mirror the engine's contract: split on `\n`, one trailing `\r` and
//! the terminator excluded by the matcher, empty lines skipped. The batch call runs
//! under a `catch_unwind` boundary so an engine panic fails closed as a synthetic
//! finding rather than aborting the scan, preserving the scanner's fail-closed
//! guarantee against a secret-scanning gate exiting clean on an engine fault.

/// Imports the SIMD newline scan used to build the line-start offsets.
use memchr::memchr_iter;

/// Imports the unwind boundary that turns an engine panic into a fail-closed finding.
use std::panic::{catch_unwind, AssertUnwindSafe};

/// Imports the loaded rule sets scanned against each file.
use crate::frx_load::LoadedRules;

/// Builds the line-start offsets `RegexSet::line_matches` requires for `buf`.
///
/// The engine's precondition is that `starts` ascends, begins at 0, and every offset
/// indexes within `buf`. This returns 0 followed by the offset just past each `\n`,
/// dropping a final offset equal to `buf.len()` (the empty line after a trailing
/// newline): the matcher would skip it anyway, and omitting it keeps every offset a
/// valid in-bounds index. Interior empty lines keep their offset and the matcher
/// skips them, so line numbering stays aligned with the file.
fn line_starts(buf: &[u8]) -> Vec<usize> {
    let mut starts: Vec<usize> = Vec::with_capacity(buf.len() / 32 + 1);
    starts.push(0);
    for newline in memchr_iter(b'\n', buf) {
        let next = newline + 1;
        // A start equal to buf.len() is the empty line past a trailing newline; the
        // matcher skips it, and omitting it keeps every offset in bounds.
        if next < buf.len() {
            starts.push(next);
        }
    }
    return starts
}

/// Runs one set's batch matcher under a fail-closed unwind boundary.
///
/// On a normal return the `(line index, rule id)` pairs become findings: a named
/// rule renders as `PATH:LINE rule=<name>` (its section name), an unnamed rule as
/// `PATH:LINE rule=N` with `base` added for cross-set disambiguation, and the
/// 0-based line index rendered 1-based. On a panic the boundary catches it and emits
/// a single synthetic diagnostic so the file cannot exit clean, matching the
/// read-error diagnostic precedent; the panic never escapes the scan.
fn scan_one_set<Match>(
    path: &str,
    base: usize,
    names: &[Option<String>],
    matcher: Match,
) -> Vec<String>
where
    Match: FnOnce() -> Vec<(usize, usize)> + std::panic::UnwindSafe,
{
    match catch_unwind(matcher) {
        Ok(pairs) => {
            return pairs
                .into_iter()
                .map(|(line_index, rule_id)| {
                    return match names.get(rule_id).and_then(|name| return name.as_deref()) {
                        Some(name) => format!("{}:{} rule={}", path, line_index + 1, name),
                        None => format!("{}:{} rule={}", path, line_index + 1, base + rule_id),
                    }
                })
                .collect()
        }
        Err(_) => {
            // Fail closed: a caught engine panic becomes a redacted synthetic finding
            // so the run reports the file and exits non-zero instead of clean.
            return vec![format!("{}: engine error", path)]
        }
    }
}

/// Scans one file's bytes against every loaded set, returning redacted findings.
///
/// Splits `buf` into lines once, then runs each set's `line_matches` under the
/// fail-closed boundary and collects findings in set order (runtime rules before
/// the builtin baseline): `PATH:LINE rule=<name>` for named rules, `PATH:LINE
/// rule=N` with the set's base offset for unnamed ones. An empty file yields no
/// findings. A match on line 2 of `a.txt` from an unnamed runtime rule renders as
/// `a.txt:2 rule=0`; the same match from a section named `qqq-token` renders as
/// `a.txt:2 rule=qqq-token`.
pub fn scan_file(path: &str, buf: &[u8], loaded: &LoadedRules) -> Vec<String> {
    if buf.is_empty() {
        return Vec::new();
    }
    let starts = line_starts(buf);
    let mut hits: Vec<String> = Vec::new();
    for scan_set in loaded.iter_sets() {
        // AssertUnwindSafe: the borrows captured here (the set, `buf`, `starts`) are
        // read-only, so a caught unwind leaves no observable broken invariant.
        let matcher = AssertUnwindSafe(|| return scan_set.set.line_matches(buf, &starts));
        hits.extend(scan_one_set(path, scan_set.base, &scan_set.names, matcher));
    }
    return hits
}

/// Registers the line-splitting edge-case and fail-closed tests (sidecar, lint-exempt).
#[cfg(test)]
#[path = "frx_scan_tests.rs"]
mod tests;
