//! rules engine quantifier support for the forbidden-strings scanner.
/// Implements `stacked_quantifier`.
// What:     `pub fn stacked_quantifier(src: &str) -> Option<String>`
//           detects two regex quantifier suffixes appearing back-to-back
//           without an atom or group between them: `a**`, `\D{5,11}{5,11}`,
//           `(?:a){2}{3}`, `a*?+`, `a*??`. Returns `Some(reason)` when the
//           shape is found and `None` otherwise.
// Why:      Stacked quantifiers expand multiplicatively in NFA-based
//           regex engines. The `regex` crate parses `a{5,11}{5,11}` as
//           "5-11 reps of (5-11 reps of `a`)" -- 25-121 reps -- and
//           five-deep stacking like the fuzz-discovered slow-unit
//           `\D{5,11}{5,11}{5,11}{5,11}{5,11}\D*****aa` reaches 5^5
//           through 11^5 (~161,051 reps). With `(?u)` widening `\D`
//           to the full non-decimal-digit Unicode class, NFA size
//           exceeds the crate's 256 MB limit and `RegexBuilder::build`
//           wall-clocks at 1.4-1.5 seconds before erroring with
//           `CompiledTooBig`. The plain path tries `unicode(false)`
//           first then `unicode(true)`, so the total compile call
//           takes ~2.9s -- well past libFuzzer's `report_slow_units`
//           threshold of 10s once ASAN overhead and the fuzz-corpus
//           replay loop are accounted for. The resharp parser rejects
//           stacked quantifiers in microseconds with
//           `UnsupportedResharpRegex`, but the slow-unit shape lacks
//           any `requires_resharp` trigger (no `&`, `_`, `~(`,
//           lookaround), so it never reaches resharp.
//
//           Stacked quantifiers are virtually never a legitimate
//           authored pattern: the regex crate accepts them by treating
//           the outer as a quantifier on the inner-quantified atom,
//           but no realistic secret-detection rule needs this shape.
//           Rejecting at the pre-validator level is conservative and
//           keeps the fuzz target moving past inputs that would
//           otherwise burn the entire budget on one compile attempt.
//
//           Detection runs as a single-pass byte walker over `src`
//           and skips:
//             - escape pairs `\X` (so `\{` is a literal `{`, not a
//               quantifier-brace start);
//             - character class interiors `[...]` (where the
//               metacharacters are literal bytes);
//             - the `?` byte immediately after `(` (so `(?:`, `(?i)`,
//               `(?<=`, `(?P<name>` are not counted as a `?`
//               quantifier).
//           A quantifier is recognised as one of `*`, `+`, `?`, or
//           `{` followed by an ASCII digit (so a literal `{abc}` is
//           NOT treated as a quantifier). After a primary quantifier,
//           a single trailing `?` (lazy) or `+` (possessive) modifier
//           is consumed as part of the same quantifier; a second
//           quantifier byte after that is the stacked case we flag.
//
//           Place the call BEFORE `requires_resharp` in
//           `compile_rule_src` so the rejection reads as "this
//           pattern is structurally bad", not "the plain path
//           specifically dislikes it". Either engine would either
//           reject the shape outright (resharp) or wall-clock on it
//           (regex crate); the structural rejection is the honest
//           framing.
//
// In TS you'd write (pseudocode):
// ```ts
// function stackedQuantifier(src: string): string | null {
//   // walk bytes; track in_class and just_consumed_quant;
//   // skip \X escapes and class interiors and `(?` group prefixes;
//   // when a quantifier start is seen and just_consumed_quant is true,
//   // return Some(reason); otherwise consume the quantifier and any
//   // single trailing `?`/`+` modifier, set just_consumed_quant=true.
// }
// ```
pub fn stacked_quantifier(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    // What:     `just_consumed_quant` tracks whether the previous byte
    //           span consumed a full quantifier (`*`/`+`/`?`/`{N,M}`
    //           plus optional `?`/`+` modifier). The next quantifier
    //           start while this is `true` is the stacked case.
    //           Resets to `false` on any non-quantifier byte: a literal
    //           byte starts a fresh atom; `(`, `|`, `)`, anchors all
    //           re-anchor the parse state to "atom may follow".
    // Why:      The stacked-quantifier failure is exactly two
    //           quantifier suffixes back-to-back; the state-machine
    //           pinpoints that adjacency without parsing the regex.
    let mut just_consumed_quant = false;
    while i < bytes.len() {
        let c = bytes[i];
        // What:     `if c == b'\\' { i += 2; ... }` skips the escape
        //           pair. `\{`, `\}`, `\*`, `\+`, `\?` are all literal
        //           bytes, NOT quantifier starts. Resetting
        //           `just_consumed_quant = false` is correct: the
        //           escape pair represents an atom (a single
        //           literal/shorthand), so a quantifier may follow it
        //           but the escape itself is not a quantifier.
        // Why:      Without this skip, `\{` would be mis-detected as a
        //           bounded-quantifier start and the algorithm would
        //           walk past the `}` of a literal byte sequence.
        if c == b'\\' {
            i += 2;
            just_consumed_quant = false;
            continue;
        }
        // What:     Character class entry / exit. Inside a class,
        //           `*`/`+`/`?`/`{` are literal bytes; we don't
        //           reason about quantifiers there.
        // Why:      `[*+?{]` is a five-byte literal class, not five
        //           stacked quantifiers.
        if !in_class && c == b'[' {
            in_class = true;
            just_consumed_quant = false;
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
        // What:     `(?` group prefix. The `?` is part of the group
        //           syntax (non-capturing `(?:`, inline flags `(?i)`,
        //           lookarounds `(?=`/`(?!`/`(?<=`/`(?<!`, named
        //           captures `(?P<name>`/`(?<name>`, comments
        //           `(?#...)`). Skipping the two bytes prevents the
        //           `?` from being misread as a `?` quantifier on the
        //           preceding atom -- which it is not, because the
        //           preceding atom is `(`, which starts a new
        //           sub-expression rather than ending one.
        // Why:      Without the skip, `(?:a)*` would parse as
        //           "open-paren, lazy-quantifier-on-open-paren, ..."
        //           which is structurally wrong and would falsely flag
        //           any `(?:...){...}` shape as stacked.
        if c == b'(' && i + 1 < bytes.len() && bytes[i + 1] == b'?' {
            i += 2;
            just_consumed_quant = false;
            continue;
        }
        // What:     Recognise a quantifier start. `{` is only a
        //           quantifier start if followed by an ASCII digit;
        //           otherwise it is a literal `{` (e.g. `{abc}` is
        //           treated as the four literal bytes `{abc}` by the
        //           regex crate when the contents do not parse as a
        //           repetition spec).
        // Why:      The fuzz generator never emits literal `{` outside
        //           a class, but real rules sometimes do (e.g. JSON-
        //           shaped literals like `{"key":`). Requiring the
        //           digit lookahead keeps the algorithm well-defined
        //           on real inputs.
        let is_quant_start = matches!(c, b'*' | b'+' | b'?')
            || (c == b'{'
                && i + 1 < bytes.len()
                && bytes[i + 1].is_ascii_digit());
        if is_quant_start {
            if just_consumed_quant {
                return Some(format!(
                    "stacked quantifier at byte offset {}: `{}` follows another quantifier suffix. Stacked quantifiers (e.g. `a**`, `\\D{{5,11}}{{5,11}}`, `(?:a){{2}}{{3}}`) cause NFA size explosion in the `regex` crate (compile reaches the 256 MB DFA limit before erroring) and are rejected outright by resharp's parser. Group the inner quantified atom and apply at most one quantifier per level, or rewrite to a single bounded-or-unbounded repetition.",
                    i, c as char
                ));
            }
            // What:     Consume the quantifier. For `{N}` / `{N,}` /
            //           `{N,M}` we walk to the matching `}`; for the
            //           single-byte `*`/`+`/`?` we just advance one.
            //           Then absorb an optional lazy `?` or possessive
            //           `+` modifier so `a*?` is NOT counted as two
            //           stacked quantifiers (it is one lazy `*`).
            // Why:      The lazy/possessive modifier is part of the
            //           same quantifier in regex syntax. Treating it
            //           as a separate quantifier would false-positive
            //           every lazy quantifier in the corpus.
            if c == b'{' {
                while i < bytes.len() && bytes[i] != b'}' {
                    i += 1;
                }
                if i < bytes.len() {
                    i += 1;
                }
            } else {
                i += 1;
            }
            // What:     Optional `?` lazy modifier suffix. The regex
            //           crate does NOT support possessive `+`
            //           modifier (e.g. `a*+`, `a++`); the trailing
            //           `+` always represents a fresh quantifier on
            //           the previously-quantified atom and is
            //           therefore stacked.
            // Why:      `a*?` is a complete lazy quantifier; the `?`
            //           is part of it. A SECOND `?` (so `a*??`) is
            //           the stacked case, caught on the next
            //           iteration. `a*+` is treated as `*` followed
            //           by stacked `+`, the same way the regex crate
            //           parses it.
            if i < bytes.len() && bytes[i] == b'?' {
                i += 1;
            }
            just_consumed_quant = true;
            continue;
        }
        // What:     Any other byte (atom, anchor, `(`, `)`, `|`, ...)
        //           resets `just_consumed_quant` to `false`. A
        //           quantifier may follow this byte but the byte
        //           itself is not a quantifier suffix.
        // Why:      Re-anchor the state machine to "atom may now be
        //           quantified". `(a)*` is fine: `(` starts a group,
        //           `)` closes it (group becomes an atom), `*`
        //           quantifies the group; only ONE quantifier follows
        //           the group close.
        i += 1;
        just_consumed_quant = false;
    }
    None
}

/// Implements `nested_grouped_quantifier`.
// What:     `pub fn nested_grouped_quantifier(src: &str) -> Option<String>`
//           detects regex source containing four or more consecutive
//           `)`+quantifier adjacencies. The shape the fuzz target
//           actually emits looks like
//           `(?:(?:(?:(?:(?:\d){5,11}){5,11}){5,11}){5,11}){5,11}` --
//           five `(?:` opens, an inner atom, then five `){5,11}`
//           close+quantifier pairs back-to-back. Sibling shape
//           `(?:(?:(?:(?:(?:\d)*)*)*)*)*` is the same with `*`
//           instead of `{5,11}`. The `Node::Quant` renderer at
//           `fuzz/src/generators.rs:1292` ALWAYS wraps a quantified
//           atom in `(?:...)`, so the fuzz generator can never emit
//           the bare-stacked shape `stacked_quantifier` was written
//           for -- the grouped form is the actual blowup vector.
// Why:      Each `{N,M}` (or `*`/`+`/`?`) on a group multiplies the
//           inner NFA's state count by up to M (or by a large but
//           bounded factor for `*`/`+`). Five-deep multiplication
//           reaches `11^5 = 161051` repetitions of the inner atom;
//           combined with `(?u)` widening `\d` to the full Unicode
//           decimal-digit class (~700 codepoint sub-states), the
//           regex crate's NFA construction exceeds the 256 MB
//           DFA size limit and takes ~3 s of wall to error with
//           `CompiledTooBig`. Under ASAN in the fuzz target, the
//           single iteration crosses libFuzzer's `report_slow_units`
//           threshold of 10 s and halts the run before the
//           interesting (?u)-Unicode shapes for the e49d8694
//           case-fold soundness bug can be discovered. Rejecting
//           depth-4 chains at the pre-validator level rejects the
//           shape in microseconds with a clear message, keeping
//           the fuzz target moving.
//
//           Threshold: depth 4 (= chain of four `){quant}` pairs).
//           Empirically depth 3 still compiles in milliseconds even
//           under Unicode `\D`/`\d`; depth 4 starts to noticeably
//           bloat NFA construction; depth 5+ reliably wall-clocks.
//           Catching at 4 is conservative enough to spare any
//           plausibly-authored rule (real secret-detection rules
//           seldom nest beyond 2 levels of quantified groups) while
//           covering both halves of the slow-unit source (chain=5
//           for each half; flags as soon as chain reaches 4).
//
//           Detection runs as a single-pass byte walker over `src`:
//             - Escape pairs `\X` and class interiors `[...]` are
//               skipped (escapes are atoms; class bytes are literal
//               and quantifiers don't apply structurally there).
//             - Any `(` resets the chain (a new group opening breaks
//               a `)`+quant chain). The optional `?` after `(` for
//               `(?...)` group prefixes (non-capturing `(?:`, flag
//               groups `(?i)`, lookarounds `(?=`/`(?!`/`(?<=`/`(?<!`,
//               named captures `(?P<...>`/`(?<...>`, comments `(?#...)`)
//               is skipped so it isn't misread as a `?` quantifier.
//             - On `)`, peek the next byte: if it is a quantifier
//               start (`*`/`+`/`?`/`{` followed by a digit), consume
//               the quantifier and an optional `?` lazy modifier;
//               increment the chain counter. If the chain reaches
//               THRESHOLD, return Some(reason).
//             - On `)` with no quantifier following, reset the chain
//               (a close that is not quantified breaks the pattern).
//             - Any other byte (atom, anchor, `|`, literal) resets
//               the chain.
//
//           Place the call alongside `stacked_quantifier` in
//           `compile_rule_src` -- both are structural pre-validators
//           that apply regardless of engine routing, and both
//           rejection messages read as "this source shape is
//           structurally bad" rather than "the plain path
//           specifically dislikes it". Either engine would either
//           reject the shape outright or wall-clock on it.
//
// In TS you'd write (pseudocode):
// ```ts
// function nestedGroupedQuantifier(src: string): string | null {
//   // walk bytes; skip \X escapes and class interiors;
//   // on `(` reset chain (and skip optional `?` after);
//   // on `)` peek next byte: if quantifier start, consume it
//   // (plus optional lazy `?`) and chain++; if chain >= 4 return reason;
//   // otherwise reset chain. Any other byte resets chain.
// }
// ```
pub fn nested_grouped_quantifier(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    // What:     `chain: usize` counts consecutive `){quant}` adjacencies.
    //           Resets to 0 on anything that interrupts the pattern
    //           (a new `(`, an atom byte, an alternation, an escape,
    //           a class boundary, or a `)` not followed by a quantifier).
    // Why:      The fuzz blowup shape is exactly a chain of these; the
    //           single integer captures the state without paren-depth
    //           tracking. We don't need to know HOW deep the groups
    //           nest, only that there are CHAIN consecutive
    //           close+quantifier pairs back-to-back.
    let mut chain: usize = 0;
/// Defines the `THRESHOLD` constant.
    // What:     `const THRESHOLD: usize = 4;` is the flag-at chain
    //           length. Empirically 3 still compiles in milliseconds
    //           even on Unicode classes; 4 is the inflection point
    //           where NFA size starts to bloat noticeably; 5 is the
    //           slow-unit shape. Catching at 4 gives one level of
    //           safety margin under Unicode widening.
    // Why:      The cutoff is conservative enough to spare plausibly-
    //           authored rules (real secret-detection patterns rarely
    //           nest beyond 2 quantifier levels). Tune downward only
    //           if production rules trip it.
    const THRESHOLD: usize = 4;
    while i < bytes.len() {
        let c = bytes[i];
        // What:     Escape pair `\X` is two literal bytes representing
        //           one atom. Skip both bytes and reset chain (the atom
        //           breaks any pending chain of `){quant}` pairs --
        //           e.g. `){5,11}\d){5,11}` is not a chain).
        // Why:      Without skipping, `\)` would be mis-detected as a
        //           group close, and `\{` would be mis-detected as a
        //           quantifier start.
        if c == b'\\' {
            i += 2;
            chain = 0;
            continue;
        }
        // What:     Character class entry / exit. Inside `[...]` the
        //           metacharacters `(`, `)`, `*`, `+`, `?`, `{`, `}`
        //           are literal bytes; we skip the entire class body.
        //           The class itself is an atom so entry resets chain.
        // Why:      `[)]*` is a one-byte class then a quantifier on
        //           that atom, NOT a `)`+quantifier chain link.
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
        // What:     Group open `(`. Opens a fresh group; any pending
        //           `){quant}` chain is broken (the chain demands
        //           BACK-TO-BACK close+quant pairs with nothing
        //           between, and a new open is "something between").
        //           Skip an optional `?` after `(` so the `?` in
        //           `(?:`, `(?i)`, `(?P<name>`, `(?<name>`, `(?=`,
        //           `(?!`, `(?<=`, `(?<!`, `(?#...)` is not later
        //           misread as a `?` quantifier.
        // Why:      Without the `?` skip, `(?:a)*` would peek `?`
        //           after the open and may misinterpret subsequent
        //           parsing. The skip keeps the walker structurally
        //           agnostic to group flavor.
        if c == b'(' {
            chain = 0;
            i += 1;
            if i < bytes.len() && bytes[i] == b'?' {
                i += 1;
            }
            continue;
        }
        // What:     Group close `)`. Peek the next byte; if it is a
        //           quantifier start, consume the quantifier (`*`/`+`/
        //           `?` is one byte; `{N}`/`{N,}`/`{N,M}` runs to the
        //           matching `}`) plus an optional `?` lazy modifier,
        //           and increment chain. The `+` possessive is NOT a
        //           modifier in the regex crate -- treat it as a
        //           fresh stacked quantifier on the next iteration
        //           (which will hit "any other byte" and reset chain).
        //           If chain reaches THRESHOLD, return the reason.
        //           If the close is not followed by a quantifier
        //           (close that re-enters a parent expression, etc.),
        //           reset chain -- the pattern is broken.
        // Why:      This is the single state transition that detects
        //           the blowup shape. Every chain increment requires a
        //           `)` IMMEDIATELY followed by a `*`/`+`/`?`/`{N`;
        //           any deviation resets the chain.
        if c == b')' {
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
                if chain >= THRESHOLD {
                    return Some(format!(
                        "nested grouped quantifier at byte offset {}: chain of {} consecutive `)`+quantifier pairs detected. Deeply nested quantified groups (e.g. `(?:(?:(?:(?:a){{5,11}}){{5,11}}){{5,11}}){{5,11}}`) expand multiplicatively in NFA construction; depth 4+ reaches the `regex` crate's 256 MB size limit during compile and takes seconds to error. Flatten the nesting or apply at most a few quantifier levels per group.",
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
        // Why:      Chain requires BACK-TO-BACK close+quant; an atom
        //           between two `){quant}` pairs means they are not
        //           chained.
        chain = 0;
        i += 1;
    }
    None
}
