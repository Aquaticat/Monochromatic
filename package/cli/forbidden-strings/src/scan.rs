//! scan support for the forbidden-strings scanner.
/// Imports dependencies used by this module.
// What:     `use rayon::prelude::*;` brings rayon's parallel-iterator
//           traits into scope. We use it for the per-rule parallel
//           `find_all` pass on the violation slow path.
// Why:      Each regex rule has its own `Mutex<RegexInner>`, so
//           parallelizing across rules (different mutexes) is genuine
//           multi-core work, not contention.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent.
// ```
use rayon::prelude::*;

/// Imports dependencies used by this module.
// What:     `use std::collections::BTreeSet;` imports an ordered set
//           backed by a balanced binary tree. Insertions and lookups
//           are O(log n). `BTreeSet<usize>` here holds rule positions
//           that need full `find_all` after the AC pass.
// Why:      `BTreeSet` deduplicates rule positions encountered via
//           multiple AC hits AND iterates in sorted order, giving
//           deterministic per-file output ordering.
//
// In TS you'd write (pseudocode):
// ```ts
// const seenRulePositions = new Set<number>();
// ```
use std::collections::BTreeSet;

/// Imports dependencies used by this module.
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

/// Imports dependencies used by this module.
// What:     `use crate::rule::{is_word_byte, AcMeta, RuleSet};` imports
//           the top-level rules container, the per-AC-pattern metadata
//           tag, and the word-character classifier from the sibling
//           `rule.rs` module. `{...}` is a list import.
// Why:      `scan_content` dispatches on `AcMeta` to decide whether an
//           AC hit emits a literal-rule violation directly or queues a
//           regex rule for full evaluation; `is_word_byte` is the
//           file-side half of the conditional word-boundary check
//           (literal-side half is precomputed into `AcMeta::Literal`).
//
// In TS you'd write (pseudocode):
// ```ts
// import { isWordByte, AcMeta, type RuleSet } from "./rules";
// ```
use crate::rule::{is_word_byte, AcMeta, ResidualShard, RuleSet};
/// Imports dependencies used by this module.
use crate::scan_format::{build_line_index, emit_hit};

/// Implements `scan_content`.
// What:     `pub fn scan_content(path: &str, content: &[u8], rs: &RuleSet) -> Vec<String>`
//           scans one file's contents against the full ruleset and
//           returns an owned `Vec` of redacted hit strings. Empty Vec
//           means clean.
// Why:      Pure function (no side effects, no I/O), one file in -> one
//           Vec out. Pure shape lets callers compose it under any
//           parallel iterator without sharing mutable state.
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
    // What:     The previous binary-skip heuristic (`is_likely_binary`
    //           short-circuit on a NUL byte in the first 8 KiB) has been
    //           removed. Aho-Corasick scans raw bytes content-agnostic,
    //           and the redacted output format means "binary blob leaks
    //           secret" is a useful signal -- exactly the shape a CI
    //           deny-list scanner should catch (lockfile sidecars,
    //           bundled artifacts, accidentally-committed images).
    // Why:      Closes BUG 5. Pre-fix, a file whose content was
    //           `SECRET_NEEDLE\0...` exited the scanner with zero hits
    //           even though the literal appeared BEFORE the NUL byte;
    //           the heuristic produced silent false negatives.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // (no binary-skip; scan all files unconditionally)
    // ```
    let mut hits: Vec<String> = Vec::new();

    // What:     `let mut prefix_matched: BTreeSet<usize> = BTreeSet::new();`
    //           accumulates indices into `rs.regex_rules` whose
    //           required-literal prefix was hit by the unified AC pass.
    //           BTreeSet dedupes (a prefix may appear many times in one
    //           file) and iterates in sorted order.
    // Why:      In the 99%-clean case this set stays empty and no
    //           resharp `find_all` runs. When the AC pass DOES fire a
    //           prefix hit, we run `find_all` exactly once per matching
    //           rule -- not once per AC hit position.
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
                    //           negligible (math in `rule.rs`).
                    // Why:      The original "any AC hit fires" semantics
                    //           false-positived on coincidental
                    //           substrings inside base64 blobs and
                    //           similar high-entropy noise.
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
                    hits.push(emit_hit(li, path, m.start(), m.end(), *idx));
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
                // What:     `match rr.re.find_all(content) { Ok(...) =>
                //           ..., Err(()) => synthetic-hit }`. BUG 7 fix:
                //           the engine layer returns `Result<_, ()>` so
                //           callers can detect refusal. On `Err` push a
                //           per-rule synthetic hit (`rule=N engine
                //           error`) into the local hits so the file
                //           cannot exit clean when the engine refused
                //           to evaluate.
                // Why:      Pre-fix `if let Ok(...)` silently dropped the
                //           `Err` arm, so a rule that hit a resharp
                //           runtime limit reported zero hits -- fail-
                //           open against a secret-scanning tool.
                match rr.re.find_all(content) {
                    Ok(matches) => {
                        let li = line_index.get_or_init(|| build_line_index(content));
                        for m in matches {
                            if m.start == m.end {
                                continue;
                            }
                            local.push(emit_hit(li, path, m.start, m.end, rr.idx));
                        }
                    }
                    Err(()) => {
                        local.push(format!(
                            "{}: rule={} engine error",
                            path, rr.idx
                        ));
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
    // `rule.rs::build_residual_shards`). The shard variants:
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
                // What:     Same Result-pattern as the prefix-matched
                //           loop above. On `Err` emit a synthetic hit so
                //           the file cannot exit clean when the engine
                //           refused to evaluate this rule.
                // Why:      BUG 7: a Single shard whose rule errored out
                //           silently produced zero hits under the
                //           pre-fix `if let Ok(...)` arm.
                match rr.re.find_all(content) {
                    Ok(matches) => {
                        if !matches.is_empty() {
                            let li = line_index.get_or_init(|| build_line_index(content));
                            for m in matches {
                                if m.start == m.end {
                                    continue;
                                }
                                hits.push(emit_hit(li, path, m.start, m.end, rr.idx));
                            }
                        }
                    }
                    Err(()) => {
                        hits.push(format!(
                            "{}: rule={} engine error",
                            path, rr.idx
                        ));
                    }
                }
            }
            ResidualShard::Combined { gate, positions } => {
                // What:     The Combined-shard gate's `is_match` now
                //           returns `Result<bool, ()>`. `Ok(true)` fans
                //           out to per-member `find_all`; `Ok(false)`
                //           short-circuits the shard (no member can
                //           match if the union does not). `Err(())` is
                //           the new BUG 7 fallback: if the gate refused
                //           to evaluate, we cannot trust the short-
                //           circuit, so run every member's `find_all`
                //           individually. The synthetic-hit path inside
                //           the per-member loop already handles any
                //           per-member errors.
                // Why:      Without the fallback, an errored gate would
                //           silently skip the entire shard -- exactly
                //           the fail-open shape the bug describes.
                let gate_result = gate.is_match(content);
                let should_evaluate = matches!(gate_result, Ok(true) | Err(()));
                if should_evaluate {
                    let regex_hits: Vec<String> = positions
                        .par_iter()
                        .flat_map_iter(|&pos| {
                            let rr = &rs.regex_rules[pos];
                            let mut local: Vec<String> = Vec::new();
                            match rr.re.find_all(content) {
                                Ok(matches) => {
                                    let li = line_index.get_or_init(|| build_line_index(content));
                                    for m in matches {
                                        if m.start == m.end {
                                            continue;
                                        }
                                        local.push(emit_hit(li, path, m.start, m.end, rr.idx));
                                    }
                                }
                                Err(()) => {
                                    local.push(format!(
                                        "{}: rule={} engine error",
                                        path, rr.idx
                                    ));
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
