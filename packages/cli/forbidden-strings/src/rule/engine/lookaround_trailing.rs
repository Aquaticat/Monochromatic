//! rules engine lookaround_trailing support for the forbidden-strings scanner.
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

/// Implements `quantified_lookahead_with_sibling_content`.
// What:     `pub fn quantified_lookahead_with_sibling_content(src: &str) -> Option<String>`
//           detects a second Bug F shape that the narrower
//           `nested_lookahead_in_quantified_group` misses: a
//           variable-bound-quantified lookahead-bearing group
//           followed by exactly 1 or 2 trailing atoms at parent
//           depth. Bisected from a fuzz crash where
//           `crash-a219859099426658d70e90bc97f560b85f2cf256` decoded
//           to `... (?:(?!ñññAtsöéaañ)){4,12}~(ññM aaaaaaaa)aaaaaa`
//           and minimised to `(?:(?!abc)){4,12}a`.
//
//           PANIC shapes (probes in
//           `/tmp/probe-slow-unit/src/bin/bisect_f{7,8}.rs`):
//             - `(?:(?!abc)){4,12}a` (variable quant + 1 trailing atom)
//             - `(?:(?!abc)){4,12}aa` (variable quant + 2 trailing atoms)
//             - `(?:(?!abc)){4,12}\?` (escape trail counts as 1 atom)
//             - `(?:(?!abc)){4,12}(?:d)` (group trail counts as 1 atom)
//             - `(?:(?!abc)){4,12}[d]` (class trail counts as 1 atom)
//             - `(?:(?!abc)){2,3}a` / `{4,5}a` / `{1,4}a` (any variable bound)
//             - `(?!abc){4,12}a` (bare lookahead, no `(?:)` wrap)
//             - `a(?:(?!abc)){4,12}a` (leading content does not save it)
//
//           OK shapes (validator does NOT fire -- they compile cleanly
//           upstream):
//             - `(?:(?!abc)){4,12}` alone (no trailing)
//             - `a(?:(?!abc)){4,12}` (leading only, no trailing)
//             - `(?:(?!abc)){4,12}aaa` and longer (3+ trailing atoms
//               break the upstream chain -- the derivative builder
//               consumes them before reaching the saturating add)
//             - `(?:(?!abc)){2}a` / `{3}a` / `{4}a` (EXACT quant `{n}`
//               -- no variable bound, no overflow accumulation)
//             - `(?:(?!abc)){4,12}\d{3,5}` (the 3+ trailing rule
//               applies if the count >= 3; trailing groups count as
//               1 atom each regardless of inner repetition)
//
//           Detection rule (precise, derived from bisect data, no
//           accepted false positives):
//             - On `)` close, parse the trailing quantifier and
//               record whether the bound is VARIABLE (`{m,n}` with m
//               < n, including `*`/`+`/`?` which are `{0,inf}` /
//               `{1,inf}` / `{0,1}`). EXACT `{n}` quants do not arm.
//             - If the closing frame had a lookahead in its subtree
//               AND the quantifier is variable, set the parent's
//               `pending_trailing_count` to 0 (armed, counting).
//             - Each subsequent atom at parent depth (literal byte,
//               escape `\X`, char class `[...]`, group `(...)`,
//               anchor) increments `pending_trailing_count`.
//             - Fire when the count is 1 or 2 AND we reach a
//               structural boundary that confirms the trailing
//               window is closed (end-of-regex, `|`, or the parent
//               `)`).
//             - If the count reaches 3 before any boundary, disarm
//               (the upstream chain breaks at 3+ atoms).
//             - `|` and the parent close also disarm if we hadn't
//               fired yet, OR fire if the trailing count is 1-2 at
//               that boundary.
//
//           This precise rule has no accepted false positives:
//           rejecting only shapes that actually panic upstream.
//           Earlier broader widening (which also rejected
//           `(?:(?!X)){n}<atom>` exact-quant and
//           `(?:(?!X)){m,n}aaa` long-trail shapes) was tightened
//           after the user flagged that production rules might
//           legitimately use those shapes. See
//           doc/handover/forbidden-strings-fuzzing.md.
// Why:      `nested_lookahead_in_quantified_group` only catches the
//           DOUBLE-quantified nesting (`(?:(?:(?!X)){m,n}){p,q}`). The
//           SINGLE-quantified-with-1-or-2-trailing shape reaches the
//           same overflow path in `resharp-algebra/src/lib.rs:2479`
//           but through a different upstream code path -- the
//           trailing content feeds into the lookahead-chain
//           derivative without an intermediate `Quant` wrap, and the
//           `tail_rel` saturates identically. Without this
//           pre-validator the fuzz target catches the panic via
//           `catch_unwind` only on lucky builds; libfuzzer's panic
//           hook calls `abort` first on most, halting the run.
//
// In TS you'd write (pseudocode):
// ```ts
// function quantifiedLookaheadWithSiblingContent(src: string): string | null {
//   // walk bytes; per-frame `pendingTrailingCount` -1 = unarmed,
//   // 0+ = counting; arm on close of a quantified-LA group iff the
//   // quant is variable-bound; increment per atom at parent depth;
//   // fire on boundary (eof / `|` / parent `)`) if count is 1 or 2;
//   // disarm if count reaches 3.
// }
// ```
pub fn quantified_lookahead_with_sibling_content(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
/// Groups fields for `Frame`.
    // What:     `struct Frame { ... }`. One per open group; pushed at
    //           `(`, popped at `)`. The top entry represents the
    //           implicit top-level frame so trailing content at the
    //           regex root also fires.
    // Why:      `pending_trailing_count` is the per-frame "armed and
    //           counting" cursor. `-1` means unarmed; `0+` means
    //           counting trailing atoms after a quantified-LA close.
    //           Tracking it per-frame supports nested usage like
    //           `((?:(?!X)){4,12}a)` (the outer frame counts the
    //           trailing `a` if the parent itself is armed).
    #[derive(Default, Clone)]
    struct Frame {
/// Stores `is_lookahead_self`.
        is_lookahead_self: bool,
/// Stores `has_lookahead_subtree`.
        has_lookahead_subtree: bool,
/// Stores `pending_trailing_count`.
        pending_trailing_count: i32,
    }
    let mut stack: Vec<Frame> = vec![Frame {
        is_lookahead_self: false,
        has_lookahead_subtree: false,
        pending_trailing_count: -1,
    }];
/// Implements `fire_reason`.
    // What:     `fire_reason()` returns the diagnostic string. Wrapped
    //           in a helper because three call sites (escape, class,
    //           group-open, alternation-boundary, eof-boundary,
    //           parent-close-boundary, literal-byte) all emit the
    //           same payload.
    // Why:      Keep the rejection message centralised so a future
    //           tweak doesn't drift across call sites.
    fn fire_reason() -> String {
        format!(
            "quantified lookahead-bearing group with variable bound `{{m,n}}` and 1-2 trailing atoms at parent depth (e.g. `(?:(?!X)){{m,n}}<atom>` or `(?:(?!X)){{m,n}}<atom><atom>`) triggers a resharp 0.5.x through 0.6.x `attempt to add with overflow` panic at `resharp-algebra/src/lib.rs:2479` (see doc/troubleshooting/resharp.md Bug F). The lookahead-chain `rel` saturates to u32::MAX and the next add overflows under debug assertions; production builds without debug-assertions silently wrap to 0 (likely producing wrong matches). Reproducer: `(?:(?!abc)){{4,12}}a`. Workarounds: (a) extend the trailing content to 3 or more atoms (`...{{4,12}}aaa`), (b) use an EXACT quantifier `(?:(?!X)){{n}}<atom>` (single-bound), or (c) split the regex. {}",
            TROUBLESHOOT_REF
        )
    }
    while i < bytes.len() {
        let c = bytes[i];
        // What:     Inside a character class: consume literally until
        //           `]`. The class as a whole was already counted as
        //           one atom when `[` was seen.
        if in_class {
            if c == b']' {
                in_class = false;
            }
            i += 1;
            continue;
        }
        // What:     `\X`: escape. One atom at the current depth.
        if c == b'\\' {
            if let Some(top) = stack.last_mut()
                && top.pending_trailing_count >= 0 {
                    top.pending_trailing_count += 1;
                    if top.pending_trailing_count >= 3 {
                        top.pending_trailing_count = -1;
                    }
                }
            i += 2;
            continue;
        }
        // What:     `[`: character class open. One atom; the class
        //           body is consumed in the `in_class` branch.
        if c == b'[' {
            if let Some(top) = stack.last_mut()
                && top.pending_trailing_count >= 0 {
                    top.pending_trailing_count += 1;
                    if top.pending_trailing_count >= 3 {
                        top.pending_trailing_count = -1;
                    }
                }
            in_class = true;
            i += 1;
            continue;
        }
        // What:     `(`: group open. Counts as one atom at parent
        //           depth (regardless of what's inside; the group is
        //           atomic from the trailing-count perspective).
        if c == b'(' {
            if let Some(top) = stack.last_mut()
                && top.pending_trailing_count >= 0 {
                    top.pending_trailing_count += 1;
                    if top.pending_trailing_count >= 3 {
                        top.pending_trailing_count = -1;
                    }
                }
            let is_lookahead = i + 2 < bytes.len()
                && bytes[i + 1] == b'?'
                && (bytes[i + 2] == b'!' || bytes[i + 2] == b'=');
            stack.push(Frame {
                is_lookahead_self: is_lookahead,
                has_lookahead_subtree: false,
                pending_trailing_count: -1,
            });
            i += 1;
            if i < bytes.len() && bytes[i] == b'?' {
                i += 1;
                if i < bytes.len()
                    && matches!(bytes[i], b':' | b'!' | b'=' | b'<' | b'P' | b'i' | b'x' | b'u' | b'-' | b's' | b'm' | b'a' | b'R')
                {
                    i += 1;
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
        // What:     `)`: group close. Parse the trailing quantifier;
        //           classify it as exact `{n}`, variable `{m,n}`,
        //           `*`/`+`/`?`, or unquantified. If the closing
        //           frame had a lookahead in its subtree AND the
        //           quantifier is variable (i.e. unbounded or bound
        //           with m < n), arm the parent's
        //           `pending_trailing_count` to 0. Before doing so,
        //           check the parent's pre-existing pending count: a
        //           close at parent depth is also a structural
        //           boundary that fires if 1-2 atoms had accumulated.
        if c == b')' {
            i += 1;
            let frame = stack.pop().unwrap_or_default();
            // What:     `(is_quantified, is_variable_bound)`. The
            //           tuple captures both whether ANY quantifier
            //           follows (so we know how to arm the parent)
            //           and whether the bound is variable
            //           (only variable bounds trigger Bug F).
            let mut is_quantified = false;
            let mut is_variable_bound = false;
            if i < bytes.len() {
                match bytes[i] {
                    b'*' | b'+' | b'?' => {
                        is_quantified = true;
                        // `*` = `{0,inf}`, `+` = `{1,inf}`, `?` =
                        // `{0,1}` -- all variable bounds.
                        is_variable_bound = true;
                        i += 1;
                    }
                    b'{' => {
                        let mut j = i + 1;
                        let min_start = j;
                        while j < bytes.len() && bytes[j].is_ascii_digit() {
                            j += 1;
                        }
                        let min_end = j;
                        let min_val: u32 = if min_end > min_start {
                            std::str::from_utf8(&bytes[min_start..min_end])
                                .unwrap_or("0")
                                .parse()
                                .unwrap_or(0)
                        } else {
                            0
                        };
                        let mut max_val: u32 = min_val;
                        let mut saw_comma = false;
                        if j < bytes.len() && bytes[j] == b',' {
                            saw_comma = true;
                            j += 1;
                            let max_start = j;
                            while j < bytes.len() && bytes[j].is_ascii_digit() {
                                j += 1;
                            }
                            if j > max_start {
                                max_val = std::str::from_utf8(&bytes[max_start..j])
                                    .unwrap_or("0")
                                    .parse()
                                    .unwrap_or(min_val);
                            } else {
                                // `{m,}` = open upper bound = variable.
                                max_val = u32::MAX;
                            }
                        }
                        if j < bytes.len() && bytes[j] == b'}' {
                            is_quantified = true;
                            // Variable iff `{m,...}` with m < max OR `{m,}`.
                            is_variable_bound = saw_comma && (max_val > min_val);
                            j += 1;
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
            // What:     A close at parent depth is a structural
            //           boundary. If the parent was already armed and
            //           accumulated 1-2 trailing atoms (this group
            //           being one of them, already counted via `(`),
            //           fire now.
            // Why:      `(?:(?!abc)){4,12}(?:d)` -- the `(?:d)` open
            //           already incremented the count to 1; the
            //           matching close is the boundary at which we
            //           can confirm the trailing context span. But here we
            //           want to keep counting -- the close is at
            //           parent depth and only ends THIS sibling
            //           group's contribution, not the trailing
            //           span. So no firing at close-only.
            if let Some(parent) = stack.last_mut() {
                if has_la_in_subtree {
                    parent.has_lookahead_subtree = true;
                }
                if is_quantified && is_variable_bound && has_la_in_subtree {
                    // What:     Arm the parent. Set count to 0 (zero
                    //           trailing atoms seen yet).
                    parent.pending_trailing_count = 0;
                }
            }
            continue;
        }
        // What:     `|`: alternation. Structural boundary for the
        //           current frame. If we have a pending count of 1-2,
        //           fire; otherwise disarm.
        if c == b'|' {
            if let Some(top) = stack.last_mut() {
                if (1..=2).contains(&top.pending_trailing_count) {
                    return Some(fire_reason());
                }
                top.pending_trailing_count = -1;
            }
            i += 1;
            continue;
        }
        // What:     Stray `*`/`+`/`?`/`{` outside the close-quantifier
        //           handler: malformed input, treat as no-op (not a
        //           trailing atom). Skip without incrementing.
        if matches!(c, b'*' | b'+' | b'?' | b'{') {
            i += 1;
            continue;
        }
        // What:     Any other byte: literal, anchor, dot, etc. One
        //           atom at the current depth.
        if let Some(top) = stack.last_mut()
            && top.pending_trailing_count >= 0 {
                top.pending_trailing_count += 1;
                if top.pending_trailing_count >= 3 {
                    top.pending_trailing_count = -1;
                }
            }
        i += 1;
    }
    // What:     End-of-regex boundary. Check the top-level (and any
    //           remaining open frames) for pending 1-2 counts.
    // Why:      `(?:(?!abc)){4,12}a` at the top level -- the
    //           top-level frame was armed by the close, the trailing
    //           `a` brought count to 1, and there's no further
    //           boundary; eof is the boundary that fires.
    for frame in stack.iter().rev() {
        if (1..=2).contains(&frame.pending_trailing_count) {
            return Some(fire_reason());
        }
    }
    None
}
