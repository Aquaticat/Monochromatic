//! rules engine complement support for the forbidden-strings scanner.
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

/// Implements `lookaround_in_complement`.
// What:     `pub fn lookaround_in_complement(src: &str) -> Option<String>`
//           returns `Some(reason)` when `src` contains a `~(...)` whose
//           body holds an atom that resharp 0.5.x through 0.6.x cannot handle, and
//           `None` otherwise. The detected atoms are:
//             - `\b` (rewritten to a lookaround pair, then refused by
//               the reverse pass at `resharp-algebra/src/lib.rs:2234`)
//             - `\B` (parser falls through to the generic assertion
//               handler at `resharp-parser/src/lib.rs:1419-1424` and
//               rejects at parse time)
//             - unescaped `^` or `$` (rewritten to lookaround in
//               default-multiline mode at
//               `resharp-parser/src/lib.rs:1425-1441`, then refused)
//             - user-explicit lookaround `(?=`, `(?!`, `(?<=`, `(?<!`
//               (refused by the same reverse-pass arm)
//           The function tracks paren depth via a stack of "is this
//           open paren a complement-open" flags so we can recognise
//           when the matching close exits the complement. Character
//           class interiors `[...]` are skipped because inside a class
//           those bytes are literal, not the structural metacharacters.
// Why:      Catch the failure shape before the rule reaches
//           `resharp::Regex::new`, so the user gets an actionable
//           message that names the surface trigger ("complement body
//           contains \b") instead of resharp's opaque rendering
//           ("unsupported lookaround pattern" or
//           "UnsupportedResharpRegex"), which the user must reverse-
//           engineer back to their own input.
//
// In TS you'd write (pseudocode):
// ```ts
// function lookaroundInComplement(src: string): string | null {
//   // walk bytes; for each position, track:
//   //   inClass: are we inside `[...]`?
//   //   parenStack: bool[] -- true means the open paren was `~(`
//   // inside a complement (any `true` in the stack) and outside a class,
//   // reject \b, \B, ^, $, (?=, (?!, (?<=, (?<!.
// }
// ```
pub fn lookaround_in_complement(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    // What:     `let mut paren_stack: Vec<bool> = Vec::new();`. A growable
    //           vector of `bool`. Each entry records the kind of an
    //           unclosed open paren -- `true` if the opener was `~(`,
    //           `false` for any other `(` (including non-capturing
    //           `(?:`, named `(?P<...>`, inline flags `(?i)`). On `)`
    //           we pop the top; tracking complement-ness depth-aware
    //           lets nested constructs like `~(.*(?:foo).*)` correctly
    //           identify the `~(` as the complement while the inner
    //           `(?:foo)` close does not exit the complement.
    // Why:      Without per-open kind tracking we cannot tell whether
    //           a `)` closes a complement or a regular group, so we
    //           cannot bound the complement body.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const parenStack: boolean[] = [];
    // ```
    let mut paren_stack: Vec<bool> = Vec::new();
    while i < bytes.len() {
        let c = bytes[i];
        // What:     `if c == b'\\' { ... }` handles regex escape
        //           sequences. The trigger atoms `\b` and `\B` ARE
        //           escape sequences, so we check the escapee byte
        //           BEFORE skipping past the pair. Outside a complement
        //           or inside a class, `\b` is literal-ish and we just
        //           skip the two bytes.
        // Why:      The trigger is the escape sequence itself, not the
        //           backslash. Treating `\\` as "skip 2" would let us
        //           miss `\b` and `\B` entirely.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (c === '\\'.charCodeAt(0)) {
        //   if (inComplement && !inClass && i + 1 < bytes.length) {
        //     const e = bytes[i + 1];
        //     if (e === 'b') return msgWordBoundary();
        //     if (e === 'B') return msgNotWordBoundary();
        //   }
        //   i += 2; continue;
        // }
        // ```
        if c == b'\\' {
            let in_complement = !in_class && paren_stack.iter().any(|&k| k);
            if in_complement && i + 1 < bytes.len() {
                match bytes[i + 1] {
                    b'b' => {
                        return Some(format!(
                            "complement body contains \\b; resharp 0.5.x through 0.6.x rewrites it to an internal lookaround which the reverse pass refuses. Replace with \\W (consumes a char on each side) or literal whitespace, or move the boundary check outside the complement. {}",
                            TROUBLESHOOT_REF
                        ));
                    }
                    b'B' => {
                        return Some(format!(
                            "complement body contains \\B; resharp 0.5.x through 0.6.x rejects it at parse time when its neighbours are unclassifiable. Restructure the rule to avoid \\B inside the complement. {}",
                            TROUBLESHOOT_REF
                        ));
                    }
                    _ => {}
                }
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
            // What:     `let in_complement = paren_stack.iter().any(|&k| k);`
            //           returns `true` when ANY entry in the paren
            //           stack is a complement-open. Equivalent to
            //           "we are nested inside at least one `~(`".
            //           `.iter()` borrows the vec; `.any(closure)`
            //           short-circuits on the first match.
            // Why:      A `^` inside a regular group nested inside a
            //           complement (`~(foo(.|\n)*^bar)`) is still
            //           "inside the complement" for resharp's purposes;
            //           the rewrite happens regardless of intermediate
            //           non-complement parens.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const inComplement = parenStack.some(Boolean);
            // ```
            let in_complement = paren_stack.iter().any(|&k| k);
            if in_complement {
                if c == b'^' {
                    return Some(format!(
                        "complement body contains ^; resharp 0.5.x through 0.6.x rewrites it to a lookbehind in default-multiline mode, which the reverse pass refuses. Use \\A for whole-content start-anchor semantics, or move the anchor outside the complement. {}",
                        TROUBLESHOOT_REF
                    ));
                }
                if c == b'$' {
                    return Some(format!(
                        "complement body contains $; resharp 0.5.x through 0.6.x rewrites it to a lookahead in default-multiline mode, which the reverse pass refuses. Use \\z for whole-content end-anchor semantics, or move the anchor outside the complement. {}",
                        TROUBLESHOOT_REF
                    ));
                }
                if c == b'(' && i + 2 < bytes.len() && bytes[i + 1] == b'?' {
                    let after = bytes[i + 2];
                    if after == b'=' || after == b'!' {
                        return Some(format!(
                            "complement body contains a lookahead (?{}; the reverse pass refuses complement-of-lookaround. Lift the lookaround outside the complement. {}",
                            after as char, TROUBLESHOOT_REF
                        ));
                    }
                    if after == b'<'
                        && i + 3 < bytes.len()
                        && (bytes[i + 3] == b'=' || bytes[i + 3] == b'!')
                    {
                        return Some(format!(
                            "complement body contains a lookbehind (?<{}; the reverse pass refuses complement-of-lookaround. Lift the lookaround outside the complement. {}",
                            bytes[i + 3] as char, TROUBLESHOOT_REF
                        ));
                    }
                }
            }
            // What:     Push/pop the paren stack. Order matters: detect
            //           `~(` BEFORE the bare-`(` arm, otherwise the `~`
            //           and `(` would be pushed independently and we
            //           would miscount.
            // Why:      Maintain accurate complement-depth tracking
            //           across nested groups.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (c === '~' && bytes[i+1] === '(') { parenStack.push(true); i += 2; continue; }
            // if (c === '(') { parenStack.push(false); i += 1; continue; }
            // if (c === ')') { parenStack.pop(); i += 1; continue; }
            // ```
            if c == b'~' && i + 1 < bytes.len() && bytes[i + 1] == b'(' {
                paren_stack.push(true);
                i += 2;
                continue;
            }
            if c == b'(' {
                paren_stack.push(false);
                i += 1;
                continue;
            }
            if c == b')' {
                paren_stack.pop();
                i += 1;
                continue;
            }
        }
        i += 1;
    }
    None
}

/// Implements `complement_intersection_quantified_group`.
// What:     `pub fn complement_intersection_quantified_group(src: &str) -> Option<String>`
//           detects rule shapes that cause resharp's algebra
//           simplification to hang for tens of seconds or
//           indefinitely. The name is historical -- the original
//           bisect targeted `<prefix>~(\w)&(?:aaa)*`, but a second
//           fuzz timeout
//           (`timeout-0815a95346bfa16ae0c6454162d9af0b8c05779c`,
//           shape `(?i) ###(?:\s&üü)(?:####)+#@...`) showed the
//           hang also fires WITHOUT a `~(` complement -- bare
//           intersection (`&`) co-occurring with a quantified
//           group (`)*`/`)+`/etc.) is sufficient. The detector now
//           checks only those two co-occurrence triggers; the
//           complement check is omitted. The original bisect
//           reproducer from
//           `timeout-00179d433e26fbcc3bedf2b7b38b6ce1ff9e6438` was
//           `abc~(\w)&(?:aaa)*`. The compile call to resharp's
//           `Regex::new` does not terminate within libFuzzer's
//           10s per-input timeout.
//
//           Shapes confirmed to hang (>5s each via probe bisection):
//             - `abc~(\w)&(?:aaa)*`
//             - `xyz~(\w)&(?:aaaaaaaaaaaaa)*`
//             - `[_]ñe-XM1[^42v]~(\w)&(?:aaaaaaaaaaaaa)*` (original artifact)
//             - `(?:[^a]~(\w)&(?:aaaaaaaaaaaaa)*)` (with negated-class prefix)
//
//           Shapes that compile in milliseconds:
//             - `~(\w)&(?:a)*` (no prefix)
//             - `abc~(\w)&def` (no quantified group)
//             - `(?:abc~(\w)&(?:aaa)*)` (wrapped in single outer group)
//             - `x~(\w)&(?:a)*` (1-char prefix and 1-char quantified body)
//
//           Root cause traced via gdb-attach to a hung probe plus
//           reading the cloned resharp source: the hang is in
//           `resharp::prefix::calc_prefix_sets_inner` at
//           `resharp-engine/src/prefix.rs:27`. The function walks a
//           chain of regex derivatives in a `loop { ... }` searching
//           for a fixed prefix, but its `redundant` set only ever
//           holds the original `start` node and `NodeId::BOT` --
//           freshly visited nodes are never added back. For the
//           trigger shape `<prefix>~(\w)&(?:aaa)*`, the derivative
//           chain produces a sequence of unique single-target
//           nodes indefinitely (each `der` step rotates the
//           star+intersection state but never lands back on `start`
//           or `BOT`), so the loop runs without bound. The shape
//           `(?:<prefix>~(\w)&(?:aaa)*)` wrapped in a group skips
//           the slow path because the outer non-capturing group
//           changes the simplified node form that enters
//           `select_prefix`, making the derivative chain visit
//           `BOT` early. Documented as Bug E in
//           doc/troubleshooting/resharp.md; prototyped and folded into the
//           merged upstream issue (`resharp-merged-issue.local.md`), filed upstream as ieviev/resharp#5.
//
//           The pre-validator uses a coarse structural heuristic:
//           "source contains a complement (`~(`), intersection
//           (`&`), AND a quantified group (`)*`, `)+`, `)?`,
//           `){...}`) outside character classes". This is
//           conservative: it would flag the OK cases above too.
//           That trade-off is acceptable because:
//             1. The production rule corpus contains zero rules
//                with both `&` and `~(` (intersection requires
//                resharp set-algebra, which is virtually never
//                authored by humans; the only `&` in the example
//                betterleaks config is inside character classes or
//                as `&amp;` HTML-escape literals).
//             2. The fuzz target only authors these shapes
//                accidentally via the structured generator; it
//                never needs them to discover the real bugs.
//             3. The cost of a false positive is "skip this rule
//                and continue"; the cost of a missed hang is
//                "libFuzzer reports a timeout and halts the run",
//                which blocks progress entirely.
// Why:      catch_unwind protects against panics but not against
//           non-termination. resharp does not expose a compile
//           timeout, and we can't safely cancel a running compile
//           from outside. The pre-validator is the only safe way
//           to skip the slow shapes without modifying resharp.
//           Upstream fix would be adding `redundant.insert(node);`
//           on each loop iteration in `calc_prefix_sets_inner`
//           so the visited-set actually accumulates across the walk.
//
// In TS you'd write (pseudocode):
// ```ts
// function complementIntersectionQuantifiedGroup(src: string): string | null {
//   // walk bytes outside character classes; set hasComplement on `~(`,
//   // set hasIntersection on `&`, set hasQuantifiedGroup on `)` followed
//   // by `*`/`+`/`?`/`{N`. Return reason when all three are present.
// }
// ```
pub fn complement_intersection_quantified_group(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    let mut has_intersection = false;
    let mut has_quantified_group = false;
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
        if !in_class {
            if c == b'&' {
                has_intersection = true;
            }
            // What:     `)` followed by `*`/`+`/`?`/`{N` is a
            //           quantified group close. Same recognition
            //           rule used by `nested_grouped_quantifier`.
            // Why:      The trigger shape needs the quantified
            //           group; bare `)` not followed by a
            //           quantifier doesn't reproduce the hang.
            if c == b')' && i + 1 < bytes.len() {
                let next = bytes[i + 1];
                if matches!(next, b'*' | b'+' | b'?')
                    || (next == b'{'
                        && i + 2 < bytes.len()
                        && bytes[i + 2].is_ascii_digit())
                {
                    has_quantified_group = true;
                }
            }
            if has_intersection && has_quantified_group {
                return Some(format!(
                    "intersection (`&`) co-occurring with a quantified group (`(...)`*/+/?/{{N}}) triggers a known resharp 0.5.x through 0.6.x prefix-loop non-termination during `Regex::new` (see doc/troubleshooting/resharp.md Bug E -- `calc_prefix_sets_inner` lacks a visited-set update on each iteration). The compile does not terminate within libFuzzer's per-input timeout. Reproducers: `abc~(\\w)&(?:aaa)*` and `(?i) ###(?:\\s&üü)(?:####)+...`. Rewrite the rule to inline the quantified group's body into the intersection operand, or remove one of the two operators. {}",
                    TROUBLESHOOT_REF
                ));
            }
        }
        i += 1;
    }
    None
}

/// Implements `nested_complement`.
// What:     `pub fn nested_complement(src: &str) -> Option<String>`
//           detects rule shapes containing one resharp complement
//           `~(...)` whose body contains another `~(...)` complement
//           (back-to-back `~(~(...))` or transparent-group-separated
//           `~((?:~(...)))`). Decoded from artifact
//           `timeout-95f5e661c596e4b5a12e9841cda2e3ba242ecf7a` after
//           the bias commit's generator now produces such shapes.
// Why:      Resharp's algebra simplifier computes a complement via
//           DFA derivative; computing the complement of a complement
//           does not short-circuit to identity in 0.6.x and instead
//           walks both derivative chains. Probed compile time:
//             - `~(~(quantified_ws_chain))` -- 916 ms
//             - `~((?:~(quantified_ws_chain)))` -- 913 ms
//             - `~(quantified_ws_chain)` (single) -- 1.84 ms
//           Under cargo-fuzz's ASAN build the 900 ms compile
//           amplifies past libFuzzer's 10 s per-input timeout (the
//           timeout artifact reproduced in 31 s through the fuzz
//           binary). Source-shape rejection avoids the wall-clock
//           burn.
//
//           Detection criterion (single-pass byte walker with a
//           per-paren is-complement-frame stack):
//             - Walk `src`, skipping escape pairs `\X` and class
//               interiors `[...]`.
//             - On `~(`, FIRST check whether any open frame is a
//               complement; if so, return Some(reason). Then push
//               a "complement" frame onto the stack.
//             - On `(` (without preceding `~`), push a "non-
//               complement" frame; skip the `?` after `(` so the
//               body walk doesn't misread group prefixes.
//             - On `)`, pop the top frame.
//
//           The check-before-push order is critical: it ensures the
//           OUTER complement is still on the stack when the INNER
//           complement is detected. Reversing the order would miss
//           the back-to-back case (the outer's frame would be
//           pushed, then immediately the inner's, with no
//           opportunity to detect that the inner is INSIDE the
//           outer's body).
//
//           Sibling complements (`~(...)&~(...)` shape used by the
//           production rule
//           `RELEASE_TAG_[a-f0-9]{32}&~(RELEASE_TAG_(00){16})&~(...)`)
//           do NOT trigger this detector: the first complement
//           closes (popping its frame) before the second opens, so
//           the second `~(` sees a stack with no complement frames.
//
//           Place the call in `compile_rule_src`'s resharp branch:
//           `~(` is itself a `requires_resharp` trigger, so the
//           validator only fires for rules that would route to
//           resharp anyway.
//
// In TS you'd write (pseudocode):
// ```ts
// function nestedComplement(src: string): string | null {
//   // walk bytes; maintain stack of bool (true=complement frame);
//   // skip \X escapes and [class] bodies;
//   // on `~(`: check `stack.some(b => b)` first (return if true);
//   //   then push true; skip 2 bytes;
//   // on `(`: push false; skip 1 byte; skip `?` after `(`;
//   // on `)`: pop.
// }
// ```
pub fn nested_complement(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    let mut stack: Vec<bool> = Vec::new();
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
        if in_class {
            if c == b']' {
                in_class = false;
            }
            i += 1;
            continue;
        }
        // What:     `~(` opens a complement. Check first whether we
        //           are inside another complement; if so, fire.
        //           Otherwise push a "complement" frame and skip
        //           past `~(`.
        // Why:      Resharp's complement-of-complement evaluation
        //           walks both derivative chains and takes
        //           hundreds of milliseconds; under ASAN that
        //           amplifies past libFuzzer's timeout.
        if c == b'~' && bytes.get(i + 1).copied() == Some(b'(') {
            if stack.iter().any(|&b| b) {
                return Some(format!(
                    "nested complement `~(~(...))` at byte offset {}: a complement appears inside another complement's body. Resharp's algebra simplifier computes complements via DFA derivative; complement-of-complement walks both derivative chains without identity short-circuit, taking hundreds of milliseconds to compile. Under ASAN the cost amplifies past libFuzzer's 10s per-input timeout. Flatten the nesting (one complement at a time, joined via `&` if combining), or eliminate the outer complement.",
                    i
                ));
            }
            stack.push(true);
            i += 2;
            continue;
        }
        if c == b'(' {
            stack.push(false);
            i += 1;
            if i < bytes.len() && bytes[i] == b'?' {
                i += 1;
            }
            continue;
        }
        if c == b')' {
            stack.pop();
            i += 1;
            continue;
        }
        i += 1;
    }
    None
}
