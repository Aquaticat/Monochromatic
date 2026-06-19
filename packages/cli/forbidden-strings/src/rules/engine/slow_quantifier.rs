//! rules engine slow_quantifier support for the forbidden-strings scanner.
/// Implements `nested_quantifier_after_wildcard`.
// What:     `pub fn nested_quantifier_after_wildcard(src: &str) -> Option<String>`
//           detects rule shapes where a bare `_` wildcard (the
//           scanner's `_` triad atom, expanded to wildcard during
//           resharp dispatch) is immediately followed by three or
//           more consecutive `)`+quantifier adjacencies. The shape
//           the fuzz target emits is `(?:(?:(?:(?:_){5,6}){5,12})+`
//           and similar, decoded from artifacts
//           `slow-unit-8c4172d7d381b5c64c5aba568217c38c5ce94945`
//           (compile 409ms + scan 1.16s) and
//           `slow-unit-709cb39b5255ddf0721c435159191d03aa0498ea`
//           (compile 4.33s).
// Why:      Each `){N,M}` on a group multiplies the inner atom's NFA
//           state count by up to M. `_` is the largest atom in the
//           dispatch surface (matches every byte / Unicode code
//           point), so depth-3 nesting on `_` produces hundreds of
//           thousands of effective inner repetitions and resharp's
//           NFA construction takes from hundreds of milliseconds to
//           several seconds. libFuzzer's `report_slow_units` flag
//           records these as slow-unit artifacts; the fuzz target
//           burns budget re-running them. The existing
//           `nested_grouped_quantifier` detector (threshold 4)
//           passes these depth-3 shapes through to resharp because
//           depth-3 with literal innermost atom (e.g. `(?:(?:(?:a)*)*)*`)
//           does compile in milliseconds. Distinguishing on the
//           innermost atom kind without rewriting the existing
//           walker is cleanest as a separate, targeted pre-validator
//           that fires only when the chain follows `_` directly.
//
//           Detection criterion (single-pass byte walker):
//             - Walk `src`, skipping escape pairs `\X` and class
//               interiors `[...]` (the `_` inside a class is a
//               literal underscore byte, not the wildcard triad).
//             - At every bare `_` byte outside a class, count the
//               immediately-following chain of `)`+quantifier pairs.
//             - If the chain length reaches 3, return Some(reason).
//
//           Threshold: chain >= 3 (one less than
//           `nested_grouped_quantifier`'s threshold of 4). Empirical
//           timings (probed against resharp 0.6.0 with
//           overflow-checks=on): depth-3 on `_` ranges 400ms-4.3s;
//           depth-2 on `_` (chain 2) compiles in <50ms. Catching at
//           chain=3 is the precise inflection point and keeps the
//           false-positive risk at zero against the production
//           ruleset (max chain in `forbidden-strings.local.txt` is
//           1; max chain in any production rule is 1).
//
//           Place the call in `compile_rule_src`'s resharp branch:
//           bare `_` outside a class is a `requires_resharp` trigger,
//           so the validator only fires for rules that would route
//           to resharp anyway. The plain-regex path never sees the
//           `_` wildcard triad and the validator would be dead code
//           on that branch.
//
// In TS you'd write (pseudocode):
// ```ts
// function nestedQuantifierAfterWildcard(src: string): string | null {
//   // walk bytes; skip \X escapes and [class] bodies;
//   // at every bare `_` outside a class, count consecutive `)`+quant
//   // pairs that follow; if >= 3, return reason.
// }
// ```
pub fn nested_quantifier_after_wildcard(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    while i < bytes.len() {
        let c = bytes[i];
        // What:     Escape pair `\X` is two bytes representing one atom.
        // Why:      `\_` is an escaped underscore literal, not the
        //           wildcard triad; `\(` / `\)` would corrupt the
        //           class-tracking state.
        if c == b'\\' {
            i += 2;
            continue;
        }
        // What:     Character class entry / exit. Inside `[...]`, `_`
        //           is a literal underscore byte, NOT the wildcard
        //           triad.
        // Why:      `[_]` matches the single byte `_`; only bare `_`
        //           outside a class expands to wildcard in this
        //           scanner's dispatch.
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
        // What:     At every bare `_` outside a class, count the
        //           immediately-following chain of `)`+quantifier
        //           pairs. If >= 3, return reason.
        // Why:      The 8c41 / 709c slow-unit shape is exactly this:
        //           a `_` followed by three or more close+quantifier
        //           adjacencies.
        if c == b'_' {
            let chain = count_close_quant_chain_after(bytes, i + 1);
            if chain >= 3 {
                return Some(format!(
                    "nested quantifier on bare wildcard `_` at byte offset {}: chain of {} consecutive `)`+quantifier pairs immediately follows the `_`. The `_` triad expands to a wildcard atom (matches every char); nesting quantifiers depth 3+ on a wildcard explodes resharp's NFA construction, taking hundreds of milliseconds to several seconds to compile. Flatten the nesting or replace `_` with a more restrictive atom.",
                    i, chain
                ));
            }
        }
        i += 1;
    }
    None
}

/// Implements `nested_chain_in_lookaround_body`.
// What:     `pub fn nested_chain_in_lookaround_body(src: &str) -> Option<String>`
//           detects rule shapes containing a chain of three or more
//           consecutive `)`+quantifier adjacencies anywhere INSIDE
//           an open lookaround body (`(?!...)`, `(?=...)`,
//           `(?<!...)`, `(?<=...)`). Decoded from artifact
//           `slow-unit-4eabfd5c52969dcc20c2170cd30947eccf8ae62f`
//           which compiles in 1.9s before resharp returns
//           `Algebra(UnsupportedPattern)`.
// Why:      Even with a literal innermost atom (`nested_quantifier_after_wildcard`
//           does not fire), resharp's algebra simplifier struggles
//           to canonicalise the derivative of a chain-3 quantifier
//           nest that sits inside an open lookaround context. The
//           lookaround forces the simplifier to walk derivative
//           shapes per-prefix per-suffix, multiplying the work
//           proportionally to the chain's NFA size. The compile
//           wall-clocks past libFuzzer's slow-unit threshold even
//           though the eventual outcome is a clean `Err`.
//
//           Detection criterion (single-pass byte walker with a
//           lookaround-depth stack):
//             - Walk `src`, skipping escape pairs `\X` and class
//               interiors `[...]`.
//             - On `(`, push a frame: `true` if the opener is
//               `(?!` / `(?=` / `(?<!` / `(?<=`, else `false`.
//             - On `)`, pop the frame.
//             - Maintain a running `chain` counter of consecutive
//               `)`+quantifier pairs; reset on `(`, alternation `|`,
//               escape, class entry, or any other literal byte.
//             - Increment chain only when `)` is immediately followed
//               by a quantifier (`*`/`+`/`?`/`{N`). Consume the
//               quantifier and an optional lazy `?`.
//             - If chain >= 3 AND any frame currently on the stack
//               is a lookaround, return Some(reason).
//
//           The lookaround-stack is intentionally counter-style
//           (any lookaround anywhere up the stack triggers) rather
//           than nearest-lookaround: 4eab nests the chain inside
//           the OUTER `(?!...)` lookahead with an INNER `(?!...)`
//           in between; both are open during the chain. A nearest-
//           lookaround check would miss the case where the chain
//           sits two levels deep inside the outer lookaround.
//
//           Place the call in `compile_rule_src`'s resharp branch:
//           lookarounds are `requires_resharp` triggers, so the
//           validator only fires for rules that would route to
//           resharp anyway.
//
// In TS you'd write (pseudocode):
// ```ts
// function nestedChainInLookaroundBody(src: string): string | null {
//   // walk bytes; maintain a stack of bool (true=lookaround frame);
//   // skip \X escapes and [class] bodies;
//   // on `(` push frame (true if `(?!`/`(?=`/`(?<!`/`(?<=`);
//   // on `)` pop frame, then if next is quantifier, consume and
//   //   chain++; if chain >= 3 and any open frame is lookaround,
//   //   return reason;
//   // any other byte resets chain.
// }
// ```
pub fn nested_chain_in_lookaround_body(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    let mut chain: usize = 0;
    // What:     `stack: Vec<bool>`. One entry per open group; `true`
    //           if the opener is a lookaround (`(?!`/`(?=`/`(?<!`/
    //           `(?<=`), `false` otherwise (`(`, `(?:`, `(?P<...>`,
    //           `(?i)`, etc.).
    // Why:      Knowing whether ANY currently-open frame is a
    //           lookaround is enough to gate the chain trigger.
    //           Storing the booleans in order lets us pop on `)`
    //           and check the stack with one pass.
    let mut stack: Vec<bool> = Vec::new();
    while i < bytes.len() {
        let c = bytes[i];
        // What:     Escape pair `\X`. Two bytes, one atom; breaks any
        //           pending close+quant chain.
        // Why:      `\)` would mis-pop a frame; `\(` would push a
        //           bogus frame.
        if c == b'\\' {
            i += 2;
            chain = 0;
            continue;
        }
        // What:     Character class entry / exit. Inside `[...]`,
        //           parens / quantifiers / `|` are literal bytes.
        // Why:      `[)]` shouldn't pop a frame; `[*]` shouldn't be
        //           read as a quantifier.
        if !in_class && c == b'[' {
            in_class = true;
            chain = 0;
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
        // What:     `(`: detect lookaround opener, push frame, reset
        //           chain. Skip the `?` after `(` so the body walk
        //           doesn't misread the group prefix.
        // Why:      Lookaround openers are `(?!` / `(?=` / `(?<!` /
        //           `(?<=`. Detecting at open time means the inner
        //           body walk can check `stack.iter().any(|&b| b)`
        //           in O(depth) without re-parsing.
        if c == b'(' {
            let is_lookaround = is_lookaround_opener(bytes, i);
            stack.push(is_lookaround);
            chain = 0;
            i += 1;
            if i < bytes.len() && bytes[i] == b'?' {
                i += 1;
            }
            continue;
        }
        // What:     `)`: pop the frame. Check the following byte for
        //           a quantifier; if present, consume it (plus lazy
        //           `?`) and increment chain. If chain >= 3 AND any
        //           STILL-OPEN frame is a lookaround, return reason.
        // Why:      Popping before the chain check is critical: the
        //           lookaround that wraps the chain must remain on
        //           the stack at trigger time. The wrap is OUTER, so
        //           it stays open until its own matching `)`.
        if c == b')' {
            stack.pop();
            i += 1;
            let is_quant = i < bytes.len()
                && (matches!(bytes[i], b'*' | b'+' | b'?')
                    || (bytes[i] == b'{'
                        && i + 1 < bytes.len()
                        && bytes[i + 1].is_ascii_digit()));
            if is_quant {
                if bytes[i] == b'{' {
                    while i < bytes.len() && bytes[i] != b'}' {
                        i += 1;
                    }
                    if i < bytes.len() {
                        i += 1;
                    }
                } else {
                    i += 1;
                }
                if i < bytes.len() && bytes[i] == b'?' {
                    i += 1;
                }
                chain += 1;
                if chain >= 3 && stack.iter().any(|&b| b) {
                    return Some(format!(
                        "nested grouped quantifier inside lookaround body at byte offset {}: chain of {} consecutive `)`+quantifier pairs while an open lookaround frame remains higher up the stack. Resharp's algebra simplifier walks derivative shapes per-prefix per-suffix inside lookarounds, multiplying the chain's NFA cost by the lookaround context size; the compile wall-clocks past libFuzzer's slow-unit threshold even when the eventual outcome is `Err(UnsupportedPattern)`. Flatten the nesting or move the chain outside the lookaround body.",
                        i, chain
                    ));
                }
            } else {
                chain = 0;
            }
            continue;
        }
        // What:     Any other byte (atom, anchor, `|`, literal) breaks
        //           the chain.
        // Why:      Chain requires BACK-TO-BACK close+quant.
        chain = 0;
        i += 1;
    }
    None
}

/// Implements `count_close_quant_chain_after`.
// What:     `fn count_close_quant_chain_after(bytes: &[u8], start: usize) -> usize`
//           returns the number of consecutive `)`+quantifier pairs
//           starting at `start`. Used by `nested_quantifier_after_wildcard`
//           to count the chain after a `_`.
// Why:      Sharing the chain-counting logic via a helper avoids
//           duplicating the quantifier-parsing rules across the two
//           detectors.
fn count_close_quant_chain_after(bytes: &[u8], start: usize) -> usize {
    let mut i = start;
    let mut chain = 0usize;
    while i < bytes.len() && bytes[i] == b')' {
        i += 1;
        let is_quant = i < bytes.len()
            && (matches!(bytes[i], b'*' | b'+' | b'?')
                || (bytes[i] == b'{'
                    && i + 1 < bytes.len()
                    && bytes[i + 1].is_ascii_digit()));
        if !is_quant {
            break;
        }
        if bytes[i] == b'{' {
            while i < bytes.len() && bytes[i] != b'}' {
                i += 1;
            }
            if i < bytes.len() {
                i += 1;
            }
        } else {
            i += 1;
        }
        if i < bytes.len() && bytes[i] == b'?' {
            i += 1;
        }
        chain += 1;
    }
    chain
}

/// Implements `is_lookaround_opener`.
// What:     `fn is_lookaround_opener(bytes: &[u8], i: usize) -> bool`
//           returns true if `bytes[i..]` starts with `(?!`/`(?=`/
//           `(?<!`/`(?<=`.
// Why:      Detect lookaround openers without committing to a full
//           regex parser. Used by `nested_chain_in_lookaround_body`.
fn is_lookaround_opener(bytes: &[u8], i: usize) -> bool {
    if bytes.get(i).copied() != Some(b'(') {
        return false;
    }
    if bytes.get(i + 1).copied() != Some(b'?') {
        return false;
    }
    match bytes.get(i + 2).copied() {
        Some(b'!') | Some(b'=') => true,
        Some(b'<') => matches!(bytes.get(i + 3).copied(), Some(b'!') | Some(b'=')),
        _ => false,
    }
}
