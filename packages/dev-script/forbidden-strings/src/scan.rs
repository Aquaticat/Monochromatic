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

// What:     `use std::sync::OnceLock;` brings the thread-safe "set
//           exactly once" cell into scope. `OnceLock<T: Send + Sync>`
//           is itself `Sync`, so a single instance can be shared by
//           reference across rayon worker threads. Concurrent callers
//           of `get_or_init` race only on the first init; the loser's
//           closure is dropped, every caller observes the same `&T`
//           afterward.
// Why:      The line-start index is built only when the first hit
//           fires (most files have zero hits and pay nothing). Once
//           built, it must be visible to AC literal-hit emission,
//           prefix-matched par_iter, and residual-shard par_iter --
//           all on the same file. OnceLock holds the index for the
//           whole `scan_content` call without making any caller pay
//           if no hit ever fires.
// TS map:   No direct equivalent. Closest pattern in TS is a lazy
//           getter that memoises into a closure variable -- TS has
//           no shared-mutable-state-with-races primitive because
//           there are no real threads.
//
// In TS you'd write (pseudocode):
// ```ts
// // Lazy memo; in single-threaded TS no synchronisation needed.
// let lineIndex: number[] | null = null;
// function getLineIndex(): number[] {
//   if (!lineIndex) lineIndex = buildLineIndex(content);
//   return lineIndex;
// }
// ```
use std::sync::OnceLock;

// What:     `use memchr::memchr_iter;` imports a SIMD-accelerated
//           "find every occurrence of byte B in slice S" iterator.
//           memchr is the foundation that aho-corasick is also built
//           on, so this dep is essentially free in our build.
// Why:      `build_line_index` walks every byte of one file and
//           records the offset of each `\n`. memchr_iter does that
//           with AVX2/NEON (when available) instead of byte-at-a-time
//           scalar code, so a 1M-line file builds the index in
//           milliseconds instead of tens of milliseconds.
// TS map:   No 1:1 equivalent. Closest is `String.prototype.matchAll`
//           with a `/\n/g` regex, but that is slower than SIMD memchr.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Imagine:
// // for (const m of content.matchAll(/\n/g)) starts.push(m.index + 1);
// ```
use memchr::memchr_iter;

// What:     `use crate::rules::{is_word_byte, AcMeta, RuleSet};` imports
//           the top-level rules container, the per-AC-pattern metadata
//           tag, and the word-character classifier from the sibling
//           `rules.rs` module. `{...}` is a list import.
// Why:      `scan_content` dispatches on `AcMeta` to decide whether an
//           AC hit emits a literal-rule violation directly or queues a
//           regex rule for full evaluation; `is_word_byte` is the
//           file-side half of the conditional word-boundary check
//           (literal-side half is precomputed into `AcMeta::Literal`).
// TS map:   `import { isWordByte, AcMeta, type RuleSet } from "./rules";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { isWordByte, AcMeta, type RuleSet } from "./rules";
// ```
use crate::rules::{is_word_byte, AcMeta, ResidualShard, RuleSet};

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

// What:     `fn build_line_index(content: &[u8]) -> Vec<usize>` produces
//           a sorted `Vec<usize>` of byte offsets where each line
//           starts. The first entry is always `0` (line 1's start);
//           subsequent entries are the offset of the byte JUST AFTER
//           each `\n`. So a file `"abc\ndef"` yields `[0, 4]` --
//           line 1 begins at 0, line 2 begins at 4.
// Why:      Replacing the old per-hit byte walk with an O(n)-once index
//           plus O(log L) lookups (L = line count). The win matters
//           when a single file has many hits -- e.g. an agent that
//           wrote a forbidden literal a million times: 2M walks of
//           average length n/2 collapse to one O(n) build plus 2M
//           binary searches. Building only happens lazily on the
//           first hit, so 99%-clean files never pay this cost.
// TS map:   `function buildLineIndex(content: Uint8Array): number[]`.
// Gotcha:   The returned vec's length is `1 + count(\\n in content)`,
//           NOT the visible line count when the file ends without a
//           trailing newline. The last entry can equal `content.len()`
//           when the file ends with `\n`; lookups must tolerate that.
//
// In TS you'd write (pseudocode):
// ```ts
// function buildLineIndex(content: Uint8Array): number[] {
//   const starts = [0];
//   for (let i = 0; i < content.length; i++) {
//     if (content[i] === 0x0a) starts.push(i + 1);
//   }
//   return starts;
// }
// ```
fn build_line_index(content: &[u8]) -> Vec<usize> {
    // What:     `Vec::with_capacity(n)` pre-allocates n slots so push
    //           does not have to grow the buffer for the first n
    //           entries. We estimate n from average line length ~32.
    // Why:      Avoid quadratic copy cost on grow for very long files.
    // TS map:   No equivalent; JS arrays auto-grow with amortised O(1).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const starts: number[] = [];
    // ```
    let mut starts: Vec<usize> = Vec::with_capacity(content.len() / 32 + 1);
    starts.push(0);
    // What:     `memchr_iter(b'\n', content)` returns a SIMD-accelerated
    //           iterator over every byte position of `\n` in `content`.
    //           `b'\n'` is a byte literal (`u8` value 10).
    // Why:      Hot loop; SIMD beats scalar by 4-8x on long inputs.
    // TS map:   No 1:1; mentally `[...content].flatMap((b, i) => b===10 ? [i] : [])`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (let i = 0; i < content.length; i++) {
    //   if (content[i] === 0x0a) starts.push(i + 1);
    // }
    // ```
    for nl in memchr_iter(b'\n', content) {
        starts.push(nl + 1);
    }
    starts
}

// What:     `fn line_and_col_indexed(line_starts: &[usize], offset: usize) -> (usize, usize)`
//           is the indexed replacement for the old `line_and_col`. It
//           does an O(log L) binary search instead of an O(offset)
//           walk to find which line owns `offset`.
// Why:      Same `(line, col)` output as before; faster when called
//           many times on one file because the index is shared.
// TS map:   `function lineAndColIndexed(lineStarts: number[], offset: number): [number, number]`.
//
// In TS you'd write (pseudocode):
// ```ts
// function lineAndColIndexed(lineStarts: number[], offset: number): [number, number] {
//   // partition_point: first index whose value is > offset
//   let lo = 0, hi = lineStarts.length;
//   while (lo < hi) {
//     const mid = (lo + hi) >> 1;
//     if (lineStarts[mid] <= offset) lo = mid + 1; else hi = mid;
//   }
//   const lineIdx = Math.max(0, lo - 1);
//   return [lineIdx + 1, offset - lineStarts[lineIdx] + 1];
// }
// ```
fn line_and_col_indexed(line_starts: &[usize], offset: usize) -> (usize, usize) {
    // What:     `slice.partition_point(pred)` returns the first index
    //           where `pred` becomes false (assuming the slice is
    //           "false-then-true" partitioned by `pred`). For a sorted
    //           ascending slice and the predicate `|s| s <= offset`,
    //           this gives one past the last index whose value is
    //           `<= offset`. `saturating_sub(1)` is "subtract 1 but
    //           don't underflow `usize`" -- when the predicate is
    //           false at index 0 the result is 0 instead of wrapping.
    // Why:      Find the largest line-start that is <= offset; that
    //           line owns the byte at `offset`.
    // TS map:   See pseudocode above; TS has no `partition_point`,
    //           hand-rolled binary search needed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const lineIdx = Math.max(0, (lo) - 1);
    // ```
    let line_idx = line_starts
        .partition_point(|&s| s <= offset)
        .saturating_sub(1);
    let line = line_idx + 1;
    let col = offset - line_starts[line_idx] + 1;
    (line, col)
}

// What:     `fn end_in_line_indexed(line_starts: &[usize], start: usize, end: usize) -> usize`
//           returns the byte offset of the first `\n` in `[start, end)`
//           if one exists, else returns `end` unchanged. Indexed
//           replacement for the old `end_in_line`.
// Why:      Same semantics as before -- clamping multi-line matches
//           to one line for the report. Now O(log L) instead of
//           O(end - start).
// TS map:   `function endInLineIndexed(lineStarts: number[], start: number, end: number): number`.
//
// In TS you'd write (pseudocode):
// ```ts
// function endInLineIndexed(lineStarts: number[], start: number, end: number): number {
//   const lineIdx = Math.max(0, partitionPoint(lineStarts, s => s <= start) - 1);
//   if (lineIdx + 1 < lineStarts.length) {
//     const nextLineStart = lineStarts[lineIdx + 1];
//     if (nextLineStart > 0 && nextLineStart - 1 < end) return nextLineStart - 1;
//   }
//   return end;
// }
// ```
fn end_in_line_indexed(line_starts: &[usize], start: usize, end: usize) -> usize {
    let line_idx = line_starts
        .partition_point(|&s| s <= start)
        .saturating_sub(1);
    if line_idx + 1 < line_starts.len() {
        let next_line_start = line_starts[line_idx + 1];
        if next_line_start > 0 && next_line_start - 1 < end {
            return next_line_start - 1;
        }
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

    // What:     `let line_index: OnceLock<Vec<usize>> = OnceLock::new();`
    //           creates an empty thread-safe one-shot cell. Calling
    //           `line_index.get_or_init(closure)` initialises the cell
    //           on first call (running `closure`), and on every later
    //           call returns the stored `&Vec<usize>` without rerunning.
    //           Concurrent racing get_or_init's on multiple rayon
    //           workers all observe the same `&Vec<usize>` afterward.
    // Why:      Build-line-index is O(file size); pay it at most once
    //           per file, only on the first hit, and share across the
    //           AC literal-emit path, the prefix-matched par_iter, and
    //           every residual-shard par_iter.
    // TS map:   No 1:1; closest is a memoised lazy getter.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let lineIndex: number[] | null = null;
    // const getLineIndex = () => lineIndex ??= buildLineIndex(content);
    // ```
    let line_index: OnceLock<Vec<usize>> = OnceLock::new();

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
                AcMeta::Literal { idx, bound_left, bound_right } => {
                    // What:     Conditional word-boundary check (mirrors
                    //           `grep -w`). Each side is enforced ONLY
                    //           when the literal's edge byte is itself a
                    //           word character. The check passes when
                    //           the file context on that side is either
                    //           absent (start/end of file) or non-word.
                    //           So a short alpha-only acronym rejects a
                    //           hit when both surrounding chars are
                    //           also word chars, but a path-shaped
                    //           literal like `/etc/passwd` still matches
                    //           inside `cat /etc/passwd` because the
                    //           literal's left edge is `/` (non-word)
                    //           so no left-side boundary is enforced;
                    //           the trailing space/EOF satisfies the
                    //           right-side boundary against the `d`
                    //           edge byte.
                    //           Boundaries are pre-computed at load
                    //           time and ALSO disabled entirely when
                    //           the literal is at least
                    //           `SUBSTRING_THRESHOLD` bytes long --
                    //           long literals are distinctive enough
                    //           that coincidental substring match is
                    //           negligible (math in `rules.rs`).
                    // Why:      The original "any AC hit fires" semantics
                    //           false-positived on coincidental
                    //           substrings inside base64 blobs and
                    //           similar high-entropy noise.
                    // TS map:   `if (boundLeft && start > 0 && isWordByte(content[start - 1])) continue;` etc.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // if (boundLeft && m.start > 0 && isWordByte(content[m.start - 1])) continue;
                    // if (boundRight && m.end < content.length && isWordByte(content[m.end])) continue;
                    // ```
                    if *bound_left
                        && m.start() > 0
                        && is_word_byte(content[m.start() - 1])
                    {
                        continue;
                    }
                    if *bound_right
                        && m.end() < content.len()
                        && is_word_byte(content[m.end()])
                    {
                        continue;
                    }
                    let li = line_index.get_or_init(|| build_line_index(content));
                    let (line, col_start) = line_and_col_indexed(li, m.start());
                    let end = end_in_line_indexed(li, m.start(), m.end());
                    let (_, col_end) =
                        line_and_col_indexed(li, if end > 0 { end - 1 } else { 0 });
                    hits.push(format_hit(path, line, col_start, col_end, *idx));
                }
                AcMeta::RegexPrefix { rule_pos } => {
                    prefix_matched.insert(*rule_pos);
                }
            }
        }
    }

    // What:     `if let Some(ac_ci) = &rs.ac_ci { ... }` runs the
    //           parallel case-insensitive AC pass. Each hit is a regex-
    //           rule prefix (literal rules never live here), so we only
    //           queue rule positions; no direct literal emission.
    // Why:      Case-insensitive prefixes from `(?i)`-flagged regex
    //           rules ride this AC. Without it, those rules would fall
    //           into the residual sharded gate and serialize through
    //           a shared `Mutex<RegexInner>` per shard on every file.
    //           See PERF.md: 145 leading-(?i) betterleaks rules
    //           dominate the residual cost on this corpus.
    // TS map:   `for (const m of ac_ci.findOverlappingIter(content)) { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (rs.acCi) {
    //   for (const m of rs.acCi.findOverlappingIter(content)) {
    //     const meta = rs.acMetaCi[m.pattern];
    //     prefixMatched.add(meta.rulePos);
    //   }
    // }
    // ```
    if let Some(ac_ci) = &rs.ac_ci {
        for m in ac_ci.find_overlapping_iter(content) {
            let pid = m.pattern().as_usize();
            match &rs.ac_meta_ci[pid] {
                AcMeta::Literal { .. } => {
                    // unreachable: literal rules never enter the ci AC.
                    // Conservative no-op rather than panic.
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
                    let li = line_index.get_or_init(|| build_line_index(content));
                    for m in matches {
                        if m.start == m.end {
                            continue;
                        }
                        let (line, col_start) = line_and_col_indexed(li, m.start);
                        let end = end_in_line_indexed(li, m.start, m.end);
                        let (_, col_end) =
                            line_and_col_indexed(li, if end > 0 { end - 1 } else { 0 });
                        local.push(format_hit(path, line, col_start, col_end, rr.idx));
                    }
                }
                local
            })
            .collect();
        hits.extend(regex_hits);
    }

    // Residual bucket: regex rules whose gating substrings could NOT be
    // extracted. Sharded so each shard's combined-alternation Regex
    // stays under resharp's parse/algebra cliff (see
    // `rules.rs::build_residual_shards`). The shard variants:
    //
    // - `Single { rule_pos }`: the rule's own Regex IS the gate -- skip
    //   the redundant gate.is_match and call find_all directly on the
    //   rule's compiled Regex from `regex_rules`. find_all on a clean
    //   file is similar cost to is_match; on a matching file it's the
    //   work we'd do anyway. Net: ~half the per-file scan cost vs the
    //   original "gate.is_match then rule.find_all" pair.
    //
    // - `Combined { gate, positions }`: keep the gate.is_match short-
    //   circuit so a multi-rule shard fans out to find_all only when
    //   the gate fires, saving N-1 is_match probes.
    for shard in &rs.residual_shards {
        match shard {
            ResidualShard::Single { rule_pos } => {
                let rr = &rs.regex_rules[*rule_pos];
                if let Ok(matches) = rr.re.find_all(content) {
                    if !matches.is_empty() {
                        let li = line_index.get_or_init(|| build_line_index(content));
                        for m in matches {
                            if m.start == m.end {
                                continue;
                            }
                            let (line, col_start) = line_and_col_indexed(li, m.start);
                            let end = end_in_line_indexed(li, m.start, m.end);
                            let (_, col_end) = line_and_col_indexed(
                                li,
                                if end > 0 { end - 1 } else { 0 },
                            );
                            hits.push(format_hit(path, line, col_start, col_end, rr.idx));
                        }
                    }
                }
            }
            ResidualShard::Combined { gate, positions } => {
                if gate.is_match(content).unwrap_or(false) {
                    let regex_hits: Vec<String> = positions
                        .par_iter()
                        .flat_map_iter(|&pos| {
                            let rr = &rs.regex_rules[pos];
                            let mut local: Vec<String> = Vec::new();
                            if let Ok(matches) = rr.re.find_all(content) {
                                let li = line_index.get_or_init(|| build_line_index(content));
                                for m in matches {
                                    if m.start == m.end {
                                        continue;
                                    }
                                    let (line, col_start) = line_and_col_indexed(li, m.start);
                                    let end = end_in_line_indexed(li, m.start, m.end);
                                    let (_, col_end) = line_and_col_indexed(
                                        li,
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
        }
    }

    hits
}
