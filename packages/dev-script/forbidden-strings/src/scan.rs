// What:     `use rayon::prelude::*;` brings rayon's parallel-iterator
//           traits into scope. We use it for the per-rule parallel
//           `find_all` pass on the violation slow path.
// Why:      Each regex rule has its own `Mutex<RegexInner>`, so
//           parallelizing across rules (different mutexes) is genuine
//           multi-core work, not contention.
// TS map:   No equivalent.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent.
// ```
use rayon::prelude::*;

// What:     `use std::collections::BTreeSet;` imports an ordered set
//           backed by a balanced binary tree. Insertions and lookups
//           are O(log n). `BTreeSet<usize>` here holds rule positions
//           that need full `find_all` after the AC pass.
// Why:      `BTreeSet` deduplicates rule positions encountered via
//           multiple AC hits AND iterates in sorted order, giving
//           deterministic per-file output ordering.
// TS map:   `new Set<number>()` -- TS sets keep insertion order; the
//           Rust BTreeSet equivalent in TS would sort manually.
//
// In TS you'd write (pseudocode):
// ```ts
// const seenRulePositions = new Set<number>();
// ```
use std::collections::BTreeSet;

// What:     `use crate::rules::{AcMeta, RuleSet};` imports both the
//           top-level rules container and the per-AC-pattern metadata
//           tag from the sibling `rules.rs` module. `{...}` is a list
//           import.
// Why:      `scan_content` dispatches on `AcMeta` to decide whether an
//           AC hit emits a literal-rule violation directly or queues a
//           regex rule for full evaluation.
// TS map:   `import { AcMeta, type RuleSet } from "./rules";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AcMeta, type RuleSet } from "./rules";
// ```
use crate::rules::{AcMeta, RuleSet};

// What:     `pub fn is_likely_binary(content: &[u8]) -> bool` takes a
//           borrowed byte slice and returns `true` if a NUL byte appears
//           in the first 8KB.
// Why:      Plain-text source code never contains NUL; binaries
//           commonly do near the start. Skipping these files avoids
//           regex cost on content with no meaningful "line:col" output
//           and prevents accidentally-tracked blobs (qcow2 fragments,
//           bundled images, lockfile-with-blob) from blowing up scan
//           time.
// TS map:   `function isLikelyBinary(content: Uint8Array): boolean`.
//
// In TS you'd write (pseudocode):
// ```ts
// function isLikelyBinary(content: Uint8Array): boolean {
//   const probeLen = Math.min(content.length, 8192);
//   for (let i = 0; i < probeLen; i++) if (content[i] === 0) return true;
//   return false;
// }
// ```
pub fn is_likely_binary(content: &[u8]) -> bool {
    let probe_len = content.len().min(8192);
    content[..probe_len].contains(&0u8)
}

// What:     `pub fn line_and_col(content: &[u8], offset: usize) -> (usize, usize)`
//           returns a TUPLE of two `usize`s: 1-based line number and
//           1-based column number for the byte position `offset`.
// Why:      The regex engines return byte offsets; user-facing output
//           uses `line:col` ranges. This is the bridge.
// TS map:   `function lineAndCol(content: Uint8Array, offset: number): [number, number]`.
//
// In TS you'd write (pseudocode):
// ```ts
// function lineAndCol(content: Uint8Array, offset: number): [number, number] {
//   let line = 1, lineStart = 0, i = 0;
//   while (i < offset && i < content.length) {
//     if (content[i] === 0x0a) { line++; lineStart = i + 1; }
//     i++;
//   }
//   return [line, offset - lineStart + 1];
// }
// ```
pub fn line_and_col(content: &[u8], offset: usize) -> (usize, usize) {
    let mut line: usize = 1;
    let mut line_start: usize = 0;
    let mut i: usize = 0;
    while i < offset && i < content.len() {
        if content[i] == b'\n' {
            line += 1;
            line_start = i + 1;
        }
        i += 1;
    }
    let col = offset - line_start + 1;
    (line, col)
}

// What:     `fn end_in_line(content: &[u8], start: usize, end: usize) -> usize`
//           clamps a match's end offset to the first newline within the
//           range; if no newline is present, returns `end` unchanged.
//           Private (no `pub`) -- used only by `scan_content`.
// Why:      Matches can span multiple lines (especially regex matches
//           with `.` and `_*`). Reporting `line:14..520` on a multi-
//           line hit is unhelpful; `line:14..end_of_line_14` is.
// TS map:   `function endInLine(content: Uint8Array, start: number, end: number): number`.
//
// In TS you'd write (pseudocode):
// ```ts
// function endInLine(content: Uint8Array, start: number, end: number): number {
//   for (let i = start; i < end; i++) if (content[i] === 0x0a) return i;
//   return end;
// }
// ```
fn end_in_line(content: &[u8], start: usize, end: usize) -> usize {
    let mut j = start;
    while j < end {
        if content[j] == b'\n' {
            return j;
        }
        j += 1;
    }
    end
}

// What:     `fn format_hit(path, line, col_start, col_end, rule_idx) -> String`
//           builds the redacted `path:line:col_start..col_end rule=N`
//           output string. Private helper.
// Why:      Output format must NEVER include the matched substring --
//           the failing CI log itself is a leak surface. Centralizing
//           the format string here ensures every hit is redacted the
//           same way.
// TS map:   `function formatHit(path: string, line: number, colStart: number, colEnd: number, ruleIdx: number): string`.
//
// In TS you'd write (pseudocode):
// ```ts
// function formatHit(path, line, colStart, colEnd, ruleIdx) {
//   return `${path}:${line}:${colStart}..${colEnd} rule=${ruleIdx}`;
// }
// ```
fn format_hit(
    path: &str,
    line: usize,
    col_start: usize,
    col_end: usize,
    rule_idx: usize,
) -> String {
    format!("{}:{}:{}..{} rule={}", path, line, col_start, col_end, rule_idx)
}

// What:     `pub fn scan_content(path: &str, content: &[u8], rs: &RuleSet) -> Vec<String>`
//           scans one file's contents against the full ruleset and
//           returns an owned `Vec` of redacted hit strings. Empty Vec
//           means clean.
// Why:      Pure function (no side effects, no I/O), one file in -> one
//           Vec out. Pure shape lets callers compose it under any
//           parallel iterator without sharing mutable state.
// TS map:   `function scanContent(path: string, content: Uint8Array, rs: RuleSet): string[]`.
//
// In TS you'd write (pseudocode):
// ```ts
// function scanContent(path: string, content: Uint8Array, rs: RuleSet): string[] {
//   const hits: string[] = [];
//   if (isLikelyBinary(content)) return hits;
//   ...
//   return hits;
// }
// ```
pub fn scan_content(path: &str, content: &[u8], rs: &RuleSet) -> Vec<String> {
    let mut hits: Vec<String> = Vec::new();
    if is_likely_binary(content) {
        return hits;
    }

    // What:     `let mut prefix_matched: BTreeSet<usize> = BTreeSet::new();`
    //           accumulates indices into `rs.regex_rules` whose
    //           required-literal prefix was hit by the unified AC pass.
    //           BTreeSet dedupes (a prefix may appear many times in one
    //           file) and iterates in sorted order.
    // Why:      In the 99%-clean case this set stays empty and no
    //           resharp `find_all` runs. When the AC pass DOES fire a
    //           prefix hit, we run `find_all` exactly once per matching
    //           rule -- not once per AC hit position.
    // TS map:   `const prefixMatched = new Set<number>();`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const prefixMatched = new Set<number>();
    // ```
    let mut prefix_matched: BTreeSet<usize> = BTreeSet::new();

    // Unified AC: scans for literal rules AND required-literal prefixes
    // of regex rules in a single linear pass. AC's Standard match kind
    // exposes `find_overlapping_iter` so a longer literal at the same
    // position as a shorter regex-prefix doesn't suppress the prefix
    // hit -- without overlapping, a regex rule whose prefix coincides
    // with a literal rule's full text would never trigger.
    if let Some(ac) = &rs.ac {
        // What:     `for m in ac.find_overlapping_iter(content) { ... }`
        //           iterates EVERY (pattern, position) pair in the
        //           content where a pattern matches, regardless of
        //           overlap. `m.pattern().as_usize()` is the AC-internal
        //           id assigned at build time, used here to index
        //           `rs.ac_meta`.
        // Why:      We need both literal-rule emissions AND regex-prefix
        //           queueing to fire from the same scan pass.
        // TS map:   `for (const m of ac.findOverlappingIter(content)) { ... }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const m of ac.findOverlappingIter(content)) {
        //   const meta = rs.acMeta[m.pattern];
        //   if (meta.kind === "literal") {
        //     hits.push(formatHit(path, ..., meta.idx));
        //   } else {
        //     prefixMatched.add(meta.rulePos);
        //   }
        // }
        // ```
        for m in ac.find_overlapping_iter(content) {
            let pid = m.pattern().as_usize();
            match &rs.ac_meta[pid] {
                AcMeta::Literal { idx } => {
                    let (line, col_start) = line_and_col(content, m.start());
                    let end = end_in_line(content, m.start(), m.end());
                    let (_, col_end) =
                        line_and_col(content, if end > 0 { end - 1 } else { 0 });
                    hits.push(format_hit(path, line, col_start, col_end, *idx));
                }
                AcMeta::RegexPrefix { rule_pos } => {
                    prefix_matched.insert(*rule_pos);
                }
            }
        }
    }

    // For each regex rule whose prefix fired, run its full `find_all`.
    // `prefix_matched` is small (typically 0 in 99% of files; on a
    // matching file, just the few rules whose literal prefix appeared).
    if !prefix_matched.is_empty() {
        // What:     `prefix_matched.iter().copied().collect::<Vec<usize>>()`
        //           materializes the BTreeSet into a Vec so we can
        //           parallelize over it with rayon. `copied()` turns
        //           the iterator of `&usize` into one of `usize`.
        // Why:      `BTreeSet::par_iter` exists but emits `&usize`
        //           which is harder to thread through closures than
        //           owned values; the materialize-and-par_iter pattern
        //           keeps the closure simple.
        // TS map:   `[...prefixMatched]` -- arrays parallelize via
        //           Promise.all.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const positions = [...prefixMatched];
        // const regexHits = (await Promise.all(
        //   positions.map((pos) => scanOneRule(rs.regexRules[pos], content, path))
        // )).flat();
        // ```
        let positions: Vec<usize> = prefix_matched.iter().copied().collect();
        let regex_hits: Vec<String> = positions
            .par_iter()
            .flat_map_iter(|&pos| {
                let rr = &rs.regex_rules[pos];
                let mut local: Vec<String> = Vec::new();
                if let Ok(matches) = rr.re.find_all(content) {
                    for m in matches {
                        if m.start == m.end {
                            continue;
                        }
                        let (line, col_start) = line_and_col(content, m.start);
                        let end = end_in_line(content, m.start, m.end);
                        let (_, col_end) =
                            line_and_col(content, if end > 0 { end - 1 } else { 0 });
                        local.push(format_hit(path, line, col_start, col_end, rr.idx));
                    }
                }
                local
            })
            .collect();
        hits.extend(regex_hits);
    }

    // Residual bucket: regex rules whose required-literal could NOT be
    // extracted (pure character classes, alternations starting with
    // operators, etc.). They use the old combined-regex gate -- but
    // only over their own small subset, so the combined regex is much
    // smaller than the historic "all regex rules" gate. When every
    // regex rule has an extractable prefix, `residual_combined` is
    // `None` and the resharp lazy-DFA never runs on the hot path.
    if let Some(residual) = &rs.residual_combined {
        if residual.is_match(content).unwrap_or(false) {
            let regex_hits: Vec<String> = rs
                .residual_positions
                .par_iter()
                .flat_map_iter(|&pos| {
                    let rr = &rs.regex_rules[pos];
                    let mut local: Vec<String> = Vec::new();
                    if let Ok(matches) = rr.re.find_all(content) {
                        for m in matches {
                            if m.start == m.end {
                                continue;
                            }
                            let (line, col_start) = line_and_col(content, m.start);
                            let end = end_in_line(content, m.start, m.end);
                            let (_, col_end) = line_and_col(
                                content,
                                if end > 0 { end - 1 } else { 0 },
                            );
                            local.push(format_hit(path, line, col_start, col_end, rr.idx));
                        }
                    }
                    local
                })
                .collect();
            hits.extend(regex_hits);
        }
    }

    hits
}
