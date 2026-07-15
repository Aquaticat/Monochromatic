//! rules engine lookaround_misc support for the forbidden-strings scanner.
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

/// Implements `intersection_with_lookbehind`.
// What:     `pub fn intersection_with_lookbehind(src: &str) -> Option<String>`
//           detects rule shapes that match resharp 0.5.x through 0.6.x's
//           lookahead-vs-lookbehind intersection debug_assert at
//           `resharp/src/engine.rs:1020` (`unexpected end 0 > N`,
//           where N varies by content length: 56 in 0.5.3, 1 in 0.6.0,
//           the assertion lives behind `debug_assert!` so release
//           returns corrupted matches silently instead). The minimal
//           reproducer is
//           `(?:(?=a)&(?<=_))` driven against a content slice of
//           at least 64 bytes; the panic fires inside
//           `scan_fwd_all` during the runtime forward scan, not
//           at compile. The detector reports the shape at
//           compile time so callers get an actionable error
//           BEFORE the rule reaches the scan path.
// Why:      Catch-and-convert via `catch_unwind` in
//           `CompiledRegex::find_all` already keeps the scanner
//           process alive; this pre-validator gives the rule
//           author a clean message ("intersection involving a
//           lookbehind") instead of a generic engine-error
//           synthetic hit. Bisection (see docs/troubleshooting/resharp.md)
//           narrowed the trigger to "intersection (`&` outside
//           class) where at least one operand contains a
//           lookbehind `(?<=` or `(?<!`". The two-lookahead
//           variant (`(?:(?=a)&(?=b))`) does not panic; it
//           returns `Algebra(UnsupportedPattern)` -- only the
//           lookbehind path hits the assertion. Detection is
//           conservative: any presence of intersection + any
//           lookbehind anywhere outside a class triggers; we
//           accept rare false positives on contrived shapes
//           (rule authors get a friendlier "rewrite without
//           intersecting a lookbehind" message instead of the
//           opaque assertion) in exchange for not having to walk
//           operand boundaries.
//
// In TS you'd write (pseudocode):
// ```ts
// function intersectionWithLookbehind(src: string): string | null {
//   // walk bytes outside character classes; set hasIntersection on
//   // bare `&`; set hasLookbehind on `(?<=` or `(?<!`. Return
//   // a reason when both are seen, null otherwise.
// }
// ```
pub fn intersection_with_lookbehind(src: &str) -> Option<String> {
    // What:     Single-pass walker: track `in_class` membership;
    //           on bare `&` outside class set `has_intersection`;
    //           on `(?=` / `(?!` / `(?<=` / `(?<!` outside class
    //           set `has_lookaround` and record the kind seen.
    //           Return early as soon as both are seen.
    // Why:      The original detector covered `&` + lookbehind only
    //           (the panic the user's HANDOVER bisected to).
    //           Subsequent fuzzer findings show resharp 0.5.x through
    //           0.6.x also panics on `&` + lookahead shapes via the
    //           same `engine.rs:1020` assertion. Widening keeps the
    //           detection symmetric across lookaround direction.
    //           Avoid the cost of a second pass; rule sources are
    //           short and a single linear scan is plenty.
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    let mut has_intersection = false;
    let mut has_lookaround = false;
    // What:     `lookaround_kind: &str` records which lookaround
    //           direction triggered the flag, used in the error
    //           message so the author can find the offending
    //           assertion / lookbehind quickly. "lookbehind" or
    //           "lookahead" -- whichever was seen first.
    // Why:      Diagnostic clarity. Without it the message is
    //           generic and the rule author has to scan the source
    //           to find which lookaround direction caused the
    //           rejection.
    let mut lookaround_kind: &'static str = "";
    while i < bytes.len() {
        let c = bytes[i];
        // What:     Escape sequence `\X` -- skip two bytes, do
        //           not interpret the second byte as a structural
        //           character.
        // Why:      `\&` and `\(` inside the source are literal
        //           bytes the regex parser treats as the actual
        //           character, not as the metacharacter.
        if c == b'\\' {
            i += 2;
            continue;
        }
        if !in_class && c == b'[' {
            in_class = true;
            i += 1;
            continue;
        }
        if in_class && c == b']' {
            in_class = false;
            i += 1;
            continue;
        }
        if !in_class {
            if c == b'&' {
                has_intersection = true;
            }
            // What:     `(?=` / `(?!` / `(?<=` / `(?<!` lookaround
            //           detection. The `(?` prefix can start many
            //           constructs:
            //             - `(?=...)` positive lookahead
            //             - `(?!...)` negative lookahead
            //             - `(?<=...)` positive lookbehind
            //             - `(?<!...)` negative lookbehind
            //             - `(?<name>...)` named capture (NOT a lookaround)
            //             - `(?:...)`, `(?i)`, `(?P<name>` etc. (also not)
            //           The discriminator is the byte after `(?`:
            //             - `=` / `!` means lookahead
            //             - `<` followed by `=` / `!` means lookbehind
            //             - any other shape is not a lookaround
            // Why:      Catch both directions of lookaround. The
            //           debug_assert at `engine.rs:1020` fires for
            //           intersection involving any lookaround, not
            //           just lookbehind specifically.
            if c == b'(' && i + 2 < bytes.len() && bytes[i + 1] == b'?' {
                let after = bytes[i + 2];
                if after == b'=' || after == b'!' {
                    has_lookaround = true;
                    if lookaround_kind.is_empty() {
                        lookaround_kind = "lookahead";
                    }
                } else if after == b'<'
                    && i + 3 < bytes.len()
                    && (bytes[i + 3] == b'=' || bytes[i + 3] == b'!')
                {
                    has_lookaround = true;
                    if lookaround_kind.is_empty() {
                        lookaround_kind = "lookbehind";
                    }
                }
            }
            if has_intersection && has_lookaround {
                return Some(format!(
                    "intersection (`&`) involving a {} triggers a known resharp 0.5.x through 0.6.3 soundness bug: the lookbehind-stripping rewrite `strip_lb` (`resharp-algebra/src/lib.rs:2007`) leaves the lookbehind in place, so release silently returns wrong matches (debug hits a `debug_assert!`). Rewrite the rule to lift the {} outside the intersection (e.g. anchor it as a prefix), or replace it with an explicit consume of the relevant byte. {}",
                    lookaround_kind, lookaround_kind, TROUBLESHOOT_REF
                ));
            }
        }
        i += 1;
    }
    None
}

/// Implements `lookaround_in_alternation_with_sibling`.
// What:     `pub fn lookaround_in_alternation_with_sibling(src: &str) -> Option<String>`
//           detects rule shapes that compile through resharp's
//           parser but trigger the `engine.rs:1020` `debug_assert!`
//           (`unexpected end 0 > N`) at scan time. The minimal
//           reproducer bisected from
//           `fuzz/artifacts/fuzz_extract_gate_soundness/crash-8cba104f0805ccb567513aff895398a4f652200c`
//           is `(a|(?![_]))(?!a)` -- a capturing alternation whose
//           branches include a negative lookahead with a single-char
//           class body, followed by ANOTHER negative lookahead. The
//           pattern compiles (because alternation provides a
//           non-lookaround branch the algebra can simplify against)
//           but scanning panics during the forward DFA pass.
//
//           Variants confirmed to trigger the same panic:
//             - `(a|(?![_]))(?![a-e-u-vaaa])` (original artifact)
//             - `(?:a|(?![_]))(?!a)` (non-capturing first group)
//             - `((?![_])|a)(?!a)` (lookaround as first alt branch)
//             - `(a|(?![X]))(?!a)` for X in `_`, `0`, `.`, `-`, `|`, `^a`
//
//           Variants that do NOT trigger:
//             - `(a|(?!a))(?!a)` (bare atom in first lookahead, not class)
//             - `(a|(?![ab]))(?!a)` (class with two chars)
//             - `(?!a)(a|(?!a))` (lookaround before alternation, not after)
//             - `(?!a)b(?!c)` (atom between two lookaheads, no alt)
// Why:      `catch_unwind` in `CompiledRegex::find_all` already
//           converts the upstream panic into `Err(())` so production
//           scanning degrades gracefully. But libFuzzer-sys's panic
//           hook calls `abort()` before `catch_unwind` can intercept
//           in the fuzz harness, so the fuzz target sees a crash on
//           every iteration that hits this shape. The pre-validator
//           rejects the shape at compile time, surfacing an
//           actionable error and skipping the input so the fuzzer
//           can continue exploring the (?u)-Unicode space the
//           soundness-by-revert phase 11 verification needs.
//
//           Detection algorithm (single-pass byte walker):
//             - Maintain a stack of `(has_alternation, has_lookaround)`
//               flags, one entry per open paren. Each `(` pushes
//               `(false, false)`; each `)` pops the top entry.
//             - On `|` outside class, set top entry's
//               `has_alternation = true` (the alternation belongs
//               to the innermost group).
//             - On `(?=` / `(?!` / `(?<=` / `(?<!`, count
//               `total_lookarounds += 1` AND mark the CURRENT top
//               of the stack (the parent group containing this
//               lookaround) `has_lookaround = true` -- this models
//               "this group's body contains a lookaround". Push
//               `(false, false)` for the lookaround's own group
//               (its body is irrelevant for our pattern).
//             - On `)` pop: if the popped frame has BOTH
//               `has_alternation && has_lookaround` AND
//               `total_lookarounds >= 2` (there is another
//               lookaround outside this group), return Some(reason).
//           Conservative: false positives are acceptable. The
//           panicking shape is virtually never authored
//           intentionally; rule authors writing intersection-of-
//           lookaround patterns are rare, and the alternative is
//           a fuzz crash on every iteration.
//
// In TS you'd write (pseudocode):
// ```ts
// function lookaroundInAlternationWithSibling(src: string): string | null {
//   // walk bytes; maintain paren stack of (hasAlt, hasLookaround);
//   // track totalLookarounds. On `)` pop, check the combined
//   // pattern; return reason when matched.
// }
// ```
pub fn lookaround_in_alternation_with_sibling(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    // What:     `paren_stack: Vec<(bool, bool)>` per-open-paren flags.
    //           Each entry `(has_alternation, has_lookaround)`
    //           records two facts about the open group's body so
    //           far: "did we see a `|` at this depth" and "does
    //           this group's body contain at least one lookaround".
    // Why:      The panicking shape has alt+lookaround inside one
    //           group; we need per-depth tracking because flat
    //           counters would confuse "alternation in group A,
    //           lookaround in group B" with the real pattern
    //           "alternation AND lookaround both in group A".
    let mut paren_stack: Vec<(bool, bool)> = Vec::new();
    // What:     `total_lookarounds: usize` counts every lookaround
    //           opening in the source, regardless of depth or
    //           position. Used in the final-check to know whether
    //           the alt+la group had a sibling lookaround anywhere
    //           else in the source.
    // Why:      The panicking shape always has TWO or more
    //           lookarounds in the source; one alone (even inside
    //           alternation) doesn't trigger.
    let mut total_lookarounds: usize = 0;
    // What:     `found_alt_la_group: bool` is set when ANY closed
    //           group's body had both alternation and at least one
    //           lookaround. Sticky -- once set, stays set.
    // Why:      The sibling lookaround may appear AFTER the
    //           alt+la group closes (e.g. `(a|(?![_]))(?!a)`); we
    //           can't fire at close time because we don't yet
    //           know about future siblings. Tracking the flag and
    //           checking at the end of the walk handles both
    //           "sibling before" and "sibling after" symmetrically.
    let mut found_alt_la_group = false;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\\' {
            i += 2;
            continue;
        }
        if !in_class && c == b'[' {
            in_class = true;
            i += 1;
            continue;
        }
        if in_class && c == b']' {
            in_class = false;
            i += 1;
            continue;
        }
        if in_class {
            i += 1;
            continue;
        }
        // What:     Alternation `|` outside class. Marks the
        //           innermost open group as containing alternation.
        // Why:      Belongs to the innermost group; need per-depth
        //           tracking.
        if c == b'|' {
            if let Some(top) = paren_stack.last_mut() {
                top.0 = true;
            }
            i += 1;
            continue;
        }
        // What:     Group open `(`. Two cases:
        //           - Lookaround open `(?=`/`(?!`/`(?<=`/`(?<!`:
        //             count it, mark CURRENT top-of-stack as
        //             containing a lookaround, then push a fresh
        //             frame for the lookaround's own group body.
        //           - Other `(...)` (capturing, non-capturing, named,
        //             flags, comment): push a fresh frame.
        // Why:      The lookaround's PARENT group is the one
        //           containing it; the lookaround's own body is
        //           irrelevant for the pattern we're matching.
        if c == b'(' {
            let is_lookaround = i + 2 < bytes.len()
                && bytes[i + 1] == b'?'
                && (matches!(bytes[i + 2], b'=' | b'!')
                    || (bytes[i + 2] == b'<'
                        && i + 3 < bytes.len()
                        && matches!(bytes[i + 3], b'=' | b'!')));
            if is_lookaround {
                total_lookarounds += 1;
                if let Some(top) = paren_stack.last_mut() {
                    top.1 = true;
                }
            }
            paren_stack.push((false, false));
            i += 1;
            continue;
        }
        // What:     Group close `)`. Pop the top frame. If the
        //           popped frame had BOTH alternation AND at
        //           least one lookaround in its body, set the
        //           sticky `found_alt_la_group` flag. Also bubble
        //           the popped frame's has_lookaround up to the
        //           parent (a group contains a lookaround if any
        //           nested group did).
        // Why:      We defer the final fire-decision to end of
        //           walk because the sibling lookaround may appear
        //           AFTER the alt+la group closes. The bubble
        //           preserves the per-depth invariant: an outer
        //           group's body has a lookaround iff a nested
        //           subgroup body did.
        if c == b')' {
            let popped = paren_stack.pop().unwrap_or((false, false));
            if popped.0 && popped.1 {
                found_alt_la_group = true;
            }
            if popped.1
                && let Some(parent) = paren_stack.last_mut() {
                    parent.1 = true;
                }
            i += 1;
            continue;
        }
        i += 1;
    }
    // What:     Final check: fire when any closed group had both
    //           alternation AND a lookaround in its body. The
    //           `total_lookarounds` counter is retained for debugging
    //           but is no longer required to gate the fire decision.
    // Why:      The original detector required `total_lookarounds >= 2`
    //           on the theory that the shape always has a sibling
    //           lookaround. Bisection of
    //           `crash-c3c364eb3a03114a52015721c02cba0bf20eb496` (rendered
    //           as `(?:        4qÃ¼Vk|o\w|\s(?![_]))23o:aaaaaaaaaaaaaaa`)
    //           showed that a SINGLE lookaround inside an alternation
    //           followed by literal content can also trip
    //           `engine.rs:1020` at find-all time in resharp 0.5.x to
    //           0.6.0 (fixed upstream in 0.6.x; this guard is now
    //           belt-and-suspenders). The
    //           threshold of 2 was an over-narrow heuristic from the
    //           first crash shape; widening to "any alt+la group"
    //           accepts a small false-positive rate in exchange for
    //           defense against the broader panic class.
    let _ = total_lookarounds;
    if found_alt_la_group {
        return Some(format!(
            "alternation containing a lookaround triggered a resharp 0.5.x to 0.6.0 debug_assert in the forward scan (`engine.rs:1020`; `unexpected end 0 > N`), now fixed upstream in 0.6.x; this rule is rejected conservatively (belt-and-suspenders), not to avoid a live crash. Minimal reproducers: `(a|(?![_]))(?!a)` and `(?:literal|other|x(?![_]))trailing`. Rewrite to remove the alternation, lift the lookaround outside, replace with an explicit byte consume, or split the rule into two separate patterns. {}",
            TROUBLESHOOT_REF
        ));
    }
    None
}

/// Implements `intersection_with_word_end_alternation`.
// What:     `pub fn intersection_with_word_end_alternation(src: &str) -> Option<String>`
//           detects rule shapes that match resharp 0.5.x through 0.6.x's
//           algebra arithmetic-overflow panic at
//           `resharp-algebra/src/lib.rs:2479`
//           (`attempt to add with overflow` inside
//           `attempt_rw_concat_2`; the `overflow-checks = true`
//           profile setting in our Cargo.toml is load-bearing for
//           this panic to fire in release). The minimum bisected
//           reproducer is `(?:\w|$)(?:(?![1g]\_X)& a)`: an
//           alternation containing both `\w` and the end-anchor
//           `$` concatenated with an intersection whose operand
//           contains a negative lookahead enclosing a character
//           class followed by additional literal bytes. The
//           overflow happens during DFA derivative construction,
//           reached from `Regex::new`.
// Why:      Bisection (see docs/troubleshooting/resharp.md) showed
//           the trigger is robust to the specific lookahead
//           class contents and the surrounding scoped-flag wrap.
//           The cheapest stable signal is "intersection (`&`
//           outside class) co-occurring with both `\w`
//           shorthand and `$` end-anchor (outside class) in the
//           same rule source". Real secret-detection rules
//           rarely combine all three -- they are either pure
//           literal-prefix patterns or simple character classes
//           -- so the false-positive rate is low. The catch_unwind
//           wrap in `compile_rule_src` is the load-bearing
//           safety net; this pre-validator turns the panic into
//           an actionable message for the common shape.
//
// In TS you'd write (pseudocode):
// ```ts
// function intersectionWithWordEndAlternation(src: string): string | null {
//   // walk bytes outside character classes; flag `&` outside class,
//   // flag `\w`, flag `$`. Return reason when all three are present.
// }
// ```
pub fn intersection_with_word_end_alternation(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    let mut has_intersection = false;
    let mut has_word_shorthand = false;
    let mut has_end_anchor = false;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\\' && i + 1 < bytes.len() {
            // What:     Detect `\w` (and `\W`) as the word
            //           shorthand. Inside a character class the
            //           same escape compiles to the byte-set
            //           definition rather than the alternation
            //           shape; the panic correlate appears only
            //           outside a class, so we gate on
            //           `!in_class`.
            // Why:      Match the shape we bisected to a panic.
            if !in_class && (bytes[i + 1] == b'w' || bytes[i + 1] == b'W') {
                has_word_shorthand = true;
            }
            i += 2;
            continue;
        }
        if !in_class && c == b'[' {
            in_class = true;
            i += 1;
            continue;
        }
        if in_class && c == b']' {
            in_class = false;
            i += 1;
            continue;
        }
        if !in_class {
            if c == b'&' {
                has_intersection = true;
            }
            if c == b'$' {
                has_end_anchor = true;
            }
            if has_intersection && has_word_shorthand && has_end_anchor {
                return Some(format!(
                    "intersection (`&`) co-occurring with `\\w` shorthand and `$` end-anchor triggers a known resharp 0.5.x through 0.6.x arithmetic-overflow panic in `attempt_rw_concat_2` (`resharp-algebra/src/lib.rs:2479`). Rewrite the rule to avoid this combination -- typically by replacing `\\w` with an explicit character class (`[A-Za-z0-9_]`) or by lifting the end-anchor outside the intersection. {}",
                    TROUBLESHOOT_REF
                ));
            }
        }
        i += 1;
    }
    None
}
