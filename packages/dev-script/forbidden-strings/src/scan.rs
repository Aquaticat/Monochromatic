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

// What:     `use crate::rules::RuleSet;` imports the `RuleSet` type from
//           the sibling `rules.rs` module. `crate::` is the absolute-
//           import root within this crate (similar to a TS path-alias
//           pointing at the project root).
// Why:      `scan_content` takes `&RuleSet` to know what to scan for.
// TS map:   `import type { RuleSet } from "./rules";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { RuleSet } from "./rules";
// ```
use crate::rules::RuleSet;

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

    // Literal bucket via Aho-Corasick. AC's `find_iter` returns matches
    // tagged with the matching pattern's id, so we get the rule index
    // for free without a per-rule second pass.
    if let Some(ac) = &rs.ac {
        // What:     `for m in ac.find_iter(content) { ... }` consumes
        //           the iterator yielded by `find_iter`. `m` is a
        //           `Match` value with `.pattern()`, `.start()`,
        //           `.end()` accessors.
        // Why:      One linear scan of `content` finds every literal-
        //           rule hit at SIMD speed (Teddy on x86).
        // TS map:   `for (const m of ac.findIter(content)) { ... }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const m of ac.findIter(content)) {
        //   const ruleIdx = rs.literalIndices[m.pattern];
        //   ...
        // }
        // ```
        for m in ac.find_iter(content) {
            let pid = m.pattern().as_usize();
            let rule_idx = rs.literal_indices[pid];
            let (line, col_start) = line_and_col(content, m.start());
            let end = end_in_line(content, m.start(), m.end());
            let (_, col_end) =
                line_and_col(content, if end > 0 { end - 1 } else { 0 });
            hits.push(format_hit(path, line, col_start, col_end, rule_idx));
        }
    }

    // Regex bucket. The combined-over-regex-bucket Regex acts as a
    // fast gate; only when SOMETHING in the regex bucket might match
    // do we fan out per-rule. The fan-out itself is parallel because
    // each rule has its own mutex (different locks => real concurrency).
    if let Some(combined) = &rs.regex_combined {
        if combined.is_match(content).unwrap_or(false) {
            // What:     `rs.regex_rules.par_iter().flat_map_iter(|rr| { ... }).collect::<Vec<String>>()`
            //           parallelizes per-rule scans. `flat_map_iter`
            //           takes a closure returning a sequential
            //           iterator (an owned `Vec` here) and concatenates
            //           the sequences across threads. `collect()`
            //           materializes into a flat `Vec`.
            // Why:      Each `find_all` is independent and CPU-bound.
            //           After P1 (literals -> AC) the regex bucket is
            //           usually small, so this is a minor multiplier
            //           rather than a primary win -- but free given
            //           rayon is already a dep.
            // TS map:   `(await Promise.all(rs.regexRules.map(async (rr) => { ... }))).flat()`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const regexHits = (await Promise.all(
            //   rs.regexRules.map((rr) => scanOneRule(rr, content, path))
            // )).flat();
            // ```
            let regex_hits: Vec<String> = rs
                .regex_rules
                .par_iter()
                .flat_map_iter(|rr| {
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
