//! rules engine lookaround_nested_quant support for the forbidden-strings scanner.
/// Imports dependencies used by this module.
// What:     `use super::constants::TROUBLESHOOT_REF;` imports the shared
//           troubleshooting-doc suffix from the parent engine module.
// Why:      Every rejection message should point at the same long-form
//           resharp workaround document without duplicating the path.
//
// In TS you'd write (pseudocode):
// ```ts
// import { TROUBLESHOOT_REF } from "./constants";
// ```
use super::constants::TROUBLESHOOT_REF;

/// Implements `nested_lookahead_in_quantified_group`.
// What:     `pub fn nested_lookahead_in_quantified_group(src: &str) -> Option<String>`
//           detects rule shapes that trigger a `attempt to add with
//           overflow` panic at `resharp-algebra/src/lib.rs:2479`
//           during `Regex::new`. The panicked addition is
//           `tail_rel + la_rel` where both operands are `u32`; the
//           inner `tail_rel` saturates to `u32::MAX` on the previous
//           lookahead-chain step, and the next add overflows under
//           debug assertions. cargo-fuzz keeps debug-assertions on
//           even in `--release`, so the fuzz target observes the
//           panic that production (built with debug-assertions OFF)
//           would silently wrap to 0.
//
//           Shapes confirmed to PANIC (bisected via probe binaries
//           in `/tmp/probe-slow-unit/src/bin/bisect_f*.rs`):
//             - `(?:(?:(?!\?)){1,5}){2,4}` (base case)
//             - `(?:(?:(?!\?)){1,5}){2,2}` (outer min=max=2)
//             - `(?:(?!\?){1,2}){3}` (single wrap, outer min=3)
//             - `(?:(?:(?:(?!\?)){1,5}){1,3}){2,4}` (triple nest)
//             - `(?:(?:(?:(?!\?)){1,5}){2,3}){1,4}` (middle min=2)
//             - `(?:(?=a)(?:(?!\?)){1,5}){2,4}` (sibling lookahead)
//             - positive lookahead `(?=...)` also panics
//
//           Shapes that compile OK (no panic):
//             - `(?:(?:(?!\?)){1,5}){1,5}` (outer min=1)
//             - `(?:(?!\?)){2,4}` (single wrap, no inner quant)
//             - `(?:a(?:(?!\?)){1,5}){2,4}` (literal sibling content)
//             - `(?:(?:(?!\?)){1,5}a){2,4}` (literal trailing)
//             - `(?:(?:(?!\?)){1,5}|a){2,4}` (alternation sibling)
//             - lookbehinds `(?<=...)`/`(?<!...)` -- resharp returns
//               UnsupportedPattern before reaching the overflow path
//
//           Detection criterion (single-pass byte walker with a
//           paren-frame stack):
//             - At each `)`, parse the following quantifier (if any)
//               and read its minimum repetition count. For `{n,m}` /
//               `{n}` use `n`; for `*` use 0; for `+` use 1; for `?`
//               use 0.
//             - Maintain a Frame per open group tracking:
//               (a) is_lookahead_self -- this group opened with `(?!`
//                   or `(?=`;
//               (b) has_lookahead_subtree -- a descendant frame was a
//                   lookahead (propagated up on close);
//               (c) has_inner_quant_group -- a child group was
//                   quantified (propagated up on close);
//               (d) has_non_group_atom -- a literal / escape / class /
//                   anchor byte appeared AT THIS DEPTH;
//               (e) has_alternation -- a `|` appeared at this depth.
//             - On close, fire if ALL hold:
//                 quantifier present AND min >= 2 AND
//                 (is_lookahead_self OR has_lookahead_subtree) AND
//                 has_inner_quant_group AND
//                 !has_non_group_atom AND !has_alternation.
//             - The `!has_non_group_atom` and `!has_alternation`
//               clauses prevent false positives on the literal-sibling
//               and alternation shapes that resharp handles fine: a
//               concrete sibling breaks the lookahead derivative
//               chain so the `rel` never saturates.
// Why:      Without this pre-validator the panic propagates through
//           `catch_unwind` (libfuzzer's panic hook calls `abort`
//           before our catch_unwind can intercept), libFuzzer
//           records a deadly-signal crash, and the fuzz run halts
//           before reaching the soundness-by-revert phase 11. The
//           fuzz target ran into two such crashes in the worktree:
//           `crash-06d9dd9fa1abfeec72a8154c09434b237dfc7f38` and
//           `crash-df95fcd52de76d952ee3db291f59434ece2c0b81`. Both
//           decode to a quantified group containing a lookahead
//           inside another quantified group, with the outer
//           quantifier's min >= 2. Documented as Bug F in
//           doc/troubleshooting/resharp.md; prototyped (shared saturating_add
//           with Bug C) and folded into the merged upstream issue
//           (`resharp-merged-issue.local.md`), filed upstream as ieviev/resharp#5.
//
// In TS you'd write (pseudocode):
// ```ts
// function nestedLookaheadInQuantifiedGroup(src: string): string | null {
//   // walk bytes; maintain a stack of frames per open paren;
//   // mark is_lookahead_self when the open is `(?!` / `(?=`;
//   // on close, parse the trailing quantifier's min;
//   // fire if quant min >= 2 and the frame had a lookahead in subtree
//   // and a quantified child group and no atoms / alternations at depth.
// }
// ```
pub fn nested_lookahead_in_quantified_group(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
/// Groups fields for `Frame`.
    // What:     `struct Frame { ... }`. One per open group; pushed at
    //           `(`, popped at `)`. Tracks the structural facts needed
    //           to decide whether the group's quantifier completes a
    //           Bug F shape.
    // Why:      Bug F requires a SPECIFIC nested structure -- a
    //           single-element body that is itself a quantified group
    //           containing a lookahead. Per-frame flags let us reject
    //           shapes that look superficially similar but have
    //           sibling literals / alternations that break the chain.
    #[derive(Default, Clone)]
    struct Frame {
/// Stores `is_lookahead_self`.
        is_lookahead_self: bool,
/// Stores `has_lookahead_subtree`.
        has_lookahead_subtree: bool,
/// Stores `has_inner_quant_group`.
        has_inner_quant_group: bool,
/// Stores `has_non_group_atom`.
        has_non_group_atom: bool,
/// Stores `has_alternation`.
        has_alternation: bool,
    }
    let mut stack: Vec<Frame> = Vec::new();
    while i < bytes.len() {
        let c = bytes[i];
        // What:     Escape `\X`: skip both bytes; the escape is one atom
        //           AT THIS DEPTH so the parent frame records "has
        //           non-group atom" -- this rules out the sibling-
        //           literal false positive `(?:\a(?:(?!\?)){1,5}){2,4}`.
        // Why:      `\)` would otherwise be misread as a close;
        //           `\(` would be misread as an open; either would
        //           corrupt the frame stack.
        if c == b'\\' {
            if let Some(top) = stack.last_mut() {
                top.has_non_group_atom = true;
            }
            i += 2;
            continue;
        }
        // What:     `[`: enter character class. The class is an atom at
        //           this depth.
        // Why:      `[)]` shouldn't pop a frame; bytes inside `[...]`
        //           are literal.
        if !in_class && c == b'[' {
            if let Some(top) = stack.last_mut() {
                top.has_non_group_atom = true;
            }
            in_class = true;
            i += 1;
            continue;
        }
        if in_class {
            if c == b']' {
                in_class = false;
            }
            i += 1;
            continue;
        }
        // What:     `(`: open a new frame. Detect `(?!` or `(?=` lookahead
        //           openers (lookbehind `(?<!` / `(?<=` are also detected
        //           but do not set is_lookahead_self -- they don't reach
        //           the overflow path; resharp returns UnsupportedPattern
        //           on lookbehind plus a quantifier). The group prefix
        //           bytes `?...` are skipped here so the body walk
        //           doesn't misread `?` as a quantifier or `:` / `=` /
        //           `!` as alternation / atom.
        if c == b'(' {
            let is_lookahead = i + 2 < bytes.len()
                && bytes[i + 1] == b'?'
                && (bytes[i + 2] == b'!' || bytes[i + 2] == b'=');
            let frame = Frame {
                is_lookahead_self: is_lookahead,
                ..Frame::default()
            };
            stack.push(frame);
            i += 1;
            if i < bytes.len() && bytes[i] == b'?' {
                i += 1;
                if i < bytes.len()
                    && matches!(bytes[i], b':' | b'!' | b'=' | b'<' | b'P' | b'i' | b'x' | b'u' | b'-' | b's' | b'm' | b'a' | b'R')
                {
                    // What:     Consume the group prefix character (e.g.
                    //           `:` in `(?:`, `!` in `(?!`, `=` in
                    //           `(?=`, `<` in `(?<!` / `(?<=` / `(?<name>`,
                    //           flag chars in `(?i)`/`(?x:`/etc., `-`
                    //           in `(?-i:`).
                    // Why:      Without this skip the body walk would
                    //           interpret these bytes as literals,
                    //           incorrectly setting has_non_group_atom.
                    i += 1;
                    // What:     Lookbehind `(?<=` / `(?<!` needs one
                    //           more byte consumed.
                    if bytes[i - 1] == b'<'
                        && i < bytes.len()
                        && (bytes[i] == b'=' || bytes[i] == b'!')
                    {
                        i += 1;
                    }
                }
            }
            continue;
        }
        // What:     `)`: close the current frame. Parse the trailing
        //           quantifier (if any); decide whether to fire; then
        //           propagate transient flags to the parent.
        // Why:      The fire check sees the COMPLETE subtree state for
        //           this group, before propagation collapses it into
        //           the parent.
        if c == b')' {
            i += 1;
            let frame = stack.pop().unwrap_or_default();
            let mut quant_min: u32 = 0;
            let mut is_quantified = false;
            if i < bytes.len() {
                match bytes[i] {
                    b'*' => {
                        quant_min = 0;
                        is_quantified = true;
                        i += 1;
                    }
                    b'+' => {
                        quant_min = 1;
                        is_quantified = true;
                        i += 1;
                    }
                    b'?' => {
                        quant_min = 0;
                        is_quantified = true;
                        i += 1;
                    }
                    b'{' => {
                        let mut j = i + 1;
                        let num_start = j;
                        while j < bytes.len() && bytes[j].is_ascii_digit() {
                            j += 1;
                        }
                        if j > num_start {
                            let num_str = std::str::from_utf8(&bytes[num_start..j]).unwrap_or("0");
                            quant_min = num_str.parse().unwrap_or(0);
                            while j < bytes.len() && bytes[j] != b'}' {
                                j += 1;
                            }
                            if j < bytes.len() {
                                is_quantified = true;
                                j += 1;
                            }
                        }
                        i = j;
                    }
                    _ => {}
                }
                if is_quantified && i < bytes.len() && bytes[i] == b'?' {
                    i += 1;
                }
            }

            let has_la_in_subtree = frame.is_lookahead_self || frame.has_lookahead_subtree;

            if is_quantified
                && quant_min >= 2
                && has_la_in_subtree
                && frame.has_inner_quant_group
                && !frame.has_non_group_atom
                && !frame.has_alternation
            {
                return Some(format!(
                    "nested lookahead inside a quantified group with outer quantifier min >= 2 (e.g. `(?:(?:(?!X)){{1,5}}){{2,4}}`) triggers a known resharp 0.5.x through 0.6.x algebra-overflow panic during `Regex::new` (see doc/troubleshooting/resharp.md Bug F -- `attempt to add with overflow` at `resharp-algebra/src/lib.rs:2479`; the lookahead-chain `rel` length saturates to u32::MAX and the next add overflows under debug assertions). Production builds without debug-assertions silently wrap to 0 (likely producing wrong matches). Reproducers: `(?:(?:(?!\\?)){{1,5}}){{2,4}}` and `(?:(?!\\?){{1,2}}){{3}}`. Either lower the outer quantifier's min below 2, drop the inner quantifier wrap, or insert a literal / alt sibling alongside the lookahead-bearing inner group. {}",
                    TROUBLESHOOT_REF
                ));
            }

            if let Some(parent) = stack.last_mut() {
                if has_la_in_subtree {
                    parent.has_lookahead_subtree = true;
                }
                if is_quantified || frame.has_inner_quant_group {
                    parent.has_inner_quant_group = true;
                }
            }
            continue;
        }
        // What:     `|` at this depth: top-level alternation. Marks the
        //           frame so the fire condition can rule out sibling-
        //           alt false positives like
        //           `(?:(?:(?!\?)){1,5}|a){2,4}`.
        if c == b'|' {
            if let Some(top) = stack.last_mut() {
                top.has_alternation = true;
            }
            i += 1;
            continue;
        }
        // What:     Any other byte (literal, anchor, dot, etc.) is an
        //           atom at the current depth. The flag rules out the
        //           sibling-literal false positives.
        if let Some(top) = stack.last_mut() {
            top.has_non_group_atom = true;
        }
        i += 1;
    }
    None
}
