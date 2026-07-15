//! rules compile support for the forbidden-strings scanner.
/// Imports dependencies used by this module.
// What:     `use resharp::Regex;` imports the resharp regex type.
//           Used inside `load_ruleset` for the (smaller) regex bucket
//           on rules that use set-algebra; rules without set-algebra
//           go through the `regex` crate via `CompiledRegex::Plain`.
// Why:      Hybrid engine dispatch: this module owns the per-rule
//           routing decision via `requires_resharp`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Regex } from "resharp";
// ```
use resharp::Regex;

/// Imports dependencies used by this module.
// What:     `use anyhow::{anyhow, Result};` imports `anyhow`'s error-construction
//           macro and one-parameter result alias.
// Why:      Regex compilation merges pre-validator messages and upstream engine
//           errors into one user-facing diagnostic channel.
//
// In TS you'd write (pseudocode):
// ```ts
// type Result<T> = T; // failures throw Error objects
// ```
use anyhow::{anyhow, Result};

/// Imports dependencies used by this module.
// What:     `use std::panic::{catch_unwind, AssertUnwindSafe};` brings
//           the panic-recovery primitives into scope for the
//           compile-time wrap on `Regex::new`. Full primer at the
//           same import in `src/rule/engine.rs`. Short version:
//           `catch_unwind(closure)` runs the closure with an unwind
//           barrier; an inner `panic!` becomes the outer `Err` arm
//           instead of propagating through the call stack.
//           `AssertUnwindSafe(...)` asserts to the compiler that
//           the captures are sound across the panic boundary --
//           `&str` already is `UnwindSafe`, but `catch_unwind` still
//           wants the wrapper at the closure boundary for the
//           future-`Send` requirement, so we keep the symmetric
//           shape with `engine.rs`.
// Why:      Resharp 0.5.x through 0.6.x `Regex::new` panics on some
//           rule shapes the fuzzer discovered (e.g. `(?:\w|$)(?:(?![1g]
//           \_X)& a)` triggers an arithmetic overflow inside
//           resharp-algebra's `attempt_rw_concat_2` at
//           `resharp-algebra/src/lib.rs:2470`; verified unchanged
//           between 0.5.3 and 0.6.0 by `/tmp/probe-resharp-06`).
//           Without `catch_unwind` the
//           panic aborts the scanner process during the parallel
//           regex-compile phase, taking every other in-flight
//           compile down with it. With `catch_unwind` the bad rule
//           returns a normal `anyhow::Error` that the loader bubbles
//           up to the user with the same `rule on line N (resharp): ...`
//           prefix as every other compile failure.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Rust requires catch_unwind + AssertUnwindSafe to
// // intercept panics across a closure boundary.
// ```
use std::panic::{catch_unwind, AssertUnwindSafe};

/// Imports dependencies used by this module.
// What:     `use super::{...};` imports helpers re-exported by the
//           parent `rules` module. `super` means "the module above
//           this one".
// Why:      The compile pipeline applies engine routing and every
//           structural pre-validator before constructing a regex, and
//           importing through `super` keeps the parent public surface
//           marked as used in normal builds.
//
// In TS you'd write (pseudocode):
// ```ts
// import { requiresResharp, stackedQuantifier } from "./rules";
// ```
use super::{
    complement_intersection_quantified_group,
    intersection_with_lookbehind,
    intersection_with_word_end_alternation,
    lookaround_in_alternation_with_sibling,
    lookaround_in_complement,
    nested_chain_in_lookaround_body,
    nested_complement,
    nested_grouped_quantifier,
    nested_lookahead_in_quantified_group,
    nested_quantifier_after_wildcard,
    nesting_depth,
    quantified_lookahead_with_sibling_content,
    requires_resharp,
    stacked_quantifier,
    CompiledRegex,
};

/// Defines the `UNICODE_WS_ALT` constant.
// What:     The byte alternation that matches every Unicode whitespace
//           code point as its UTF-8 byte sequence. Each `\xHH` literal
//           in the regex source compiles to one byte under the regex
//           crate's `unicode(false)` mode; the alternation is then a
//           cheap NFA branch (no per-codepoint table). Coverage:
//           - U+00A0 NBSP                       `\xc2\xa0`
//           - U+1680 OGHAM SPACE MARK           `\xe1\x9a\x80`
//           - U+180E MONGOLIAN VOWEL SEPARATOR  `\xe1\xa0\x8e`
//           - U+2000..U+200A (en quad..hair)    `\xe2\x80[\x80-\x8a]`
//           - U+2028 LINE SEPARATOR             `\xe2\x80\xa8`
//           - U+2029 PARAGRAPH SEPARATOR        `\xe2\x80\xa9`
//           - U+202F NARROW NO-BREAK SPACE      `\xe2\x80\xaf`
//           - U+205F MEDIUM MATH SPACE          `\xe2\x81\x9f`
//           - U+3000 IDEOGRAPHIC SPACE          `\xe3\x80\x80`
//           - U+FEFF ZERO-WIDTH NO-BREAK SPACE  `\xef\xbb\xbf`
// Why:      Closes BUG 8 without forcing rules onto `unicode(true)`
//           compile. Pre-fix, `(?i)adafruit[\s]+=` against `adafruit\xc2\xa0=`
//           silently missed because `unicode(false)` treats `\s` as the
//           ASCII subset `[\t\n\v\f\r\x20]`. The previous fix forced
//           those rules to `unicode(true)` -- correct but ~90x more
//           expensive to compile (224 rules -> 478 ms phase 1, 64x
//           wall-time regression). Source-level expansion keeps every
//           rule on the `unicode(false)` fast path while widening the
//           class to cover the Unicode whitespace bytes.
//
// In TS you'd write (pseudocode):
// ```ts
// const UNICODE_WS_ALT = String.raw`\xc2\xa0|...`;
// ```
const UNICODE_WS_ALT: &str = r"\xc2\xa0|\xe1\x9a\x80|\xe1\xa0\x8e|\xe2\x80[\x80-\x8a\xa8\xa9\xaf]|\xe2\x81\x9f|\xe3\x80\x80|\xef\xbb\xbf";

/// Implements `scan_class`.
// What:     `fn scan_class(bytes, start) -> Option<(usize, bool)>`
//           walks a character class starting at `bytes[start] == b'['`
//           and returns `(close_offset, contains_s)` -- the index of
//           the matching `]` AND whether the class contains an
//           unescaped `\s` shorthand. Handles the corner cases:
//           - Leading `[^` (negation flag) does not start a body.
//           - A literal `]` at body-start position (`[]a-z]` or
//             `[^]a-z]`) is not the terminator.
//           - `\X` escapes consume two bytes (so `\]` inside the class
//             does NOT terminate it).
// Why:      The source rewrite below needs to know two things about
//           each class: where it ends (so we can splice in the
//           Unicode-WS alternation around it) and whether it actually
//           contains `\s` (so we only widen classes that need it).
//           Returns `None` for an unterminated class -- the caller
//           treats this as "do not rewrite; let the regex compiler
//           emit its own parse error."
fn scan_class(bytes: &[u8], start: usize) -> Option<(usize, bool)> {
    let mut j = start + 1;
    if j < bytes.len() && bytes[j] == b'^' {
        j += 1;
    }
    if j < bytes.len() && bytes[j] == b']' {
        j += 1;
    }
    let mut contains_s = false;
    while j < bytes.len() {
        let b = bytes[j];
        if b == b'\\' && j + 1 < bytes.len() {
            if bytes[j + 1] == b's' {
                contains_s = true;
            }
            j += 2;
            continue;
        }
        if b == b']' {
            return Some((j, contains_s));
        }
        j += 1;
    }
    None
}

/// Implements `utf8_width`.
// What:     `fn utf8_width(leading: u8) -> usize` returns how many
//           bytes the UTF-8 sequence starting with `leading` occupies.
//           ASCII (< 0x80) -> 1, two-byte leading (0xc0-0xdf) -> 2,
//           three-byte (0xe0-0xef) -> 3, four-byte (0xf0-0xf7) -> 4.
//           A continuation byte (0x80-0xbf) is not a valid leading byte
//           in well-formed UTF-8; the function returns 1 defensively so
//           a single-byte step advances the cursor and the caller does
//           not stall on malformed input.
// Why:      The source rewrite must copy multi-byte UTF-8 sequences
//           verbatim. A bare `bytes[i] as char` cast would mojibake
//           non-ASCII bytes; using `&src[i..i+width]` preserves the
//           UTF-8 encoding.
fn utf8_width(leading: u8) -> usize {
    if leading < 0xc0 {
        1
    } else if leading < 0xe0 {
        2
    } else if leading < 0xf0 {
        3
    } else {
        4
    }
}

/// Implements `expand_unicode_whitespace`.
// What:     `fn expand_unicode_whitespace(src) -> String` rewrites the
//           regex source so `\s` matches Unicode whitespace under
//           `unicode(false)` compile mode. Transformations:
//           - `\s` outside a character class -> `(?:\s|<UNICODE_WS_ALT>)`.
//             The `\s` inside the group still expands to ASCII WS
//             under `unicode(false)`; the alternation adds the
//             multi-byte UTF-8 sequences for the remaining whitespace
//             code points.
//           - `[...\s...]` (class containing unescaped `\s`) ->
//             `(?:[...\s...]|<UNICODE_WS_ALT>)`. The class itself is
//             preserved (matches its ASCII subset under
//             `unicode(false)`); the wrapping group adds the
//             multi-byte sequences. Semantic shift: under PCRE/Unicode
//             a class character takes one position, while the
//             expanded multi-byte UTF-8 here also occupies one
//             alternation slot. Quantifiers on the wrapped group
//             treat NBSP as a single match, which is closer to
//             author intent than the pre-fix "single byte" view.
//           - Other escape sequences (`\X`, `\n`, `\xHH`) and literal
//             characters pass through verbatim. Multi-byte UTF-8
//             literals are preserved using `utf8_width`.
// Why:      Source-level expansion keeps every rule on the
//           `unicode(false)` fast path (~5ms phase 1) while making
//           `\s` honour the user's authoring intent that a rule like
//           `(?i)adafruit[\s]+=` matches `adafruit<NBSP>=`. The
//           previous BUG 8 fix forced these rules to `unicode(true)`,
//           costing ~478 ms phase 1 (95x regression). The rewrite
//           costs microseconds and lands the same correctness.
//           `\S` is intentionally NOT expanded: a sound "not Unicode
//           whitespace" would require subtracting multi-byte byte
//           sequences from a negated byte class, which has no clean
//           source representation. Rules using `\S` keep ASCII-only
//           semantics; document in PERF.md.
//
// In TS you'd write (pseudocode):
// ```ts
// function expandUnicodeWhitespace(src: string): string {
//   let out = "";
//   let i = 0;
//   while (i < src.length) {
//     // ... handle \s, [...], escapes, multi-byte literals ...
//   }
//   return out;
// }
// ```
fn expand_unicode_whitespace(src: &str) -> String {
    let bytes = src.as_bytes();
    let mut out = String::with_capacity(src.len() + 64);
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        // Escape sequence: copy verbatim, with one exception (`\s`).
        if b == b'\\' && i + 1 < bytes.len() {
            let next = bytes[i + 1];
            if next == b's' {
                out.push_str("(?:\\s|");
                out.push_str(UNICODE_WS_ALT);
                out.push(')');
                i += 2;
                continue;
            }
            let escapee_width = utf8_width(next);
            out.push_str(&src[i..i + 1 + escapee_width]);
            i += 1 + escapee_width;
            continue;
        }
        // Character class: check for `\s` inside and wrap if needed.
        if b == b'[' {
            match scan_class(bytes, i) {
                Some((close_idx, contains_s)) => {
                    let class_slice = &src[i..=close_idx];
                    if contains_s {
                        out.push_str("(?:");
                        out.push_str(class_slice);
                        out.push('|');
                        out.push_str(UNICODE_WS_ALT);
                        out.push(')');
                    } else {
                        out.push_str(class_slice);
                    }
                    i = close_idx + 1;
                    continue;
                }
                None => {
                    // Unterminated class -- pass through and let the
                    // regex compiler report the parse error.
                    out.push('[');
                    i += 1;
                    continue;
                }
            }
        }
        // Multi-byte UTF-8 literal: copy verbatim.
        if b >= 0x80 {
            let width = utf8_width(b);
            out.push_str(&src[i..i + width]);
            i += width;
            continue;
        }
        // ASCII literal byte.
        out.push(b as char);
        i += 1;
    }
    out
}

/// Implements `compile_rule_src`.
// What:     `pub fn compile_rule_src(src: &str) -> Result<CompiledRegex>`
//           is the single source of truth for the regex compile
//           decision. It walks the routing classifier
//           (`requires_resharp`), runs the lookaround-in-complement
//           pre-flight guard when routing to resharp, and dispatches
//           to the resharp `Regex::new` or the unicode-fallback
//           `regex` builder. Returns `CompiledRegex` directly --
//           callers that need a line-indexed `RegexRule` (the
//           production loader) wrap it with the `idx` themselves.
// Why:      The plan requires fuzz_api and production to share the
//           same compile path so the AC-gate soundness fuzzer
//           exercises identical behaviour. Splitting into a thin
//           "wrap with idx" outer layer + a `compile_rule_src`
//           core gives both call sites that property.
//
// In TS you'd write (pseudocode):
// ```ts
// function compileRuleSrc(src: string): CompiledRegex {
//   if (requiresResharp(src)) {
//     const reason = lookaroundInComplement(src);
//     if (reason) throw new Error(`(resharp): ${reason}`);
//     try { return { kind: "resharp", re: new Regex(src) }; }
//     catch (e) { throw new Error(`(resharp): ${e}`); }
//   }
//   return compilePlainToCompiled(src);
// }
// ```
pub fn compile_rule_src(src: &str) -> Result<CompiledRegex> {
    // What:     `if let Some(reason) = stacked_quantifier(src)` runs
    //           the structural pre-validator first. The detector flags
    //           two regex quantifier suffixes appearing back-to-back
    //           without an atom between them (`a**`,
    //           `\D{5,11}{5,11}`, `(?:a){2}{3}`). Both engines reject
    //           or wall-clock on the shape: the `regex` crate's
    //           NFA-construction reaches the 256 MB DFA size limit and
    //           takes ~1.4-1.5 seconds to error on the first attempt
    //           and the same again on the unicode(true) retry --
    //           ~2.9 seconds total per `compile_rule_src` call, which
    //           libFuzzer's `report_slow_units` flags after ASAN
    //           overhead pushes a single fuzz iteration past 10s.
    //           Resharp's parser rejects the same shape in
    //           microseconds with `UnsupportedResharpRegex`, but the
    //           shape lacks any `requires_resharp` trigger and never
    //           reaches that engine in production. The pre-validator
    //           closes the gap.
    // Why:      Stacked quantifiers are virtually never authored
    //           intentionally; rejecting them at the source-level
    //           pre-validator surfaces a clear error in microseconds
    //           instead of burning the libFuzzer slow-unit budget on
    //           one input. Placed BEFORE `requires_resharp` so the
    //           error namespace reads as "the source shape is
    //           structurally bad", not "the plain path specifically
    //           dislikes it".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const reason = stackedQuantifier(src);
    // if (reason) throw new Error(`(regex): ${reason}`);
    // ```
    if let Some(reason) = stacked_quantifier(src) {
        return Err(anyhow!("(regex): {}", reason));
    }
    // What:     `if let Some(reason) = nested_grouped_quantifier(src)`
    //           catches the GROUPED form of multiplicative quantifier
    //           blowup: chains of `){quant})` adjacencies four or more
    //           deep, the shape the fuzz target's `Node::Quant`
    //           renderer actually emits (always wraps in `(?:...)`).
    //           Without this guard, the slow-unit shape
    //           `(?iu)(?:(?:(?:(?:(?:\d){5,11}){5,11}){5,11}){5,11}){5,11}(?:(?:(?:(?:(?:\d)*)*)*)*)*aa`
    //           takes ~3 seconds to error with `CompiledTooBig` -- well
    //           past the libFuzzer slow-unit threshold under ASAN.
    //           Placed alongside `stacked_quantifier` (both are
    //           structural shape pre-validators that apply regardless
    //           of engine routing).
    // Why:      `stacked_quantifier` catches `\D*****` and
    //           `a{5,11}{5,11}` (bare back-to-back quantifier
    //           suffixes); `nested_grouped_quantifier` catches the
    //           wrapped form `(?:(?:a){5,11}){5,11}`-deep that the
    //           generator actually produces. Both are needed because
    //           the regex-source-shape space is wider than either
    //           detector alone covers.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const reason = nestedGroupedQuantifier(src);
    // if (reason) throw new Error(`(regex): ${reason}`);
    // ```
    if let Some(reason) = nested_grouped_quantifier(src) {
        tracing::warn!(rule = ?src, "pre-validator nested_grouped_quantifier rejected rule");
        return Err(anyhow!("(regex): {}", reason));
    }
    // What:     `if requires_resharp(src) { ... } else { ... }` runs
    //           the cheap routing classifier first. Resharp-only
    //           constructs (set algebra `A&B`, complement `~(A)`,
    //           lookarounds `(?=`/`(?!`/`(?<=`/`(?<!`, bare `_`
    //           wildcard outside a class) route to resharp; every
    //           other rule rides the faster `regex` crate.
    // Why:      Match the production dispatch decision exactly --
    //           fuzz targets that compile a generated source must
    //           hit the same branch the user would.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (requiresResharp(src)) {
    //   // resharp path
    // } else {
    //   // regex-crate path
    // }
    // ```
    if requires_resharp(src) {
        // What:     `if let Some(reason) = nesting_depth(src)` runs the
        //           nesting-depth guard FIRST among the resharp checks.
        //           `nesting_depth` returns `Some(reason)` when the rule
        //           nests groups past a safe cap. `if let Some(reason) =
        //           ...` is Rust's one-arm pattern match that binds
        //           `reason` only in the present (`Some`) case.
        // Why:      Deeply nested complement (`~(...)`) or lookaround
        //           (`(?=...)`) groups aborted the scanner with an
        //           uncatchable stack overflow inside resharp's
        //           `Regex::new` through 0.6.8 (Bug G). resharp 0.6.9 caps
        //           parser recursion at the same depth upstream, but this
        //           pre-validator still rejects on the source shape before
        //           any other check or `Regex::new` as belt-and-suspenders:
        //           catch_unwind cannot intercept a stack-overflow SIGABRT.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = nestingDepth(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = nesting_depth(src) {
            tracing::warn!(rule = ?src, "pre-validator nesting_depth rejected rule");
            return Err(anyhow!("(resharp): {}", reason));
        }
        // What:     `if let Some(reason) = lookaround_in_complement(src)`
        //           runs the resharp pre-flight guard. The function
        //           returns `Some(reason_string)` when the source
        //           contains a `~(...)` complement whose body holds
        //           a `\b`/`\B`/`^`/`$` or user-explicit lookaround
        //           (resharp 0.5.x through 0.6.x rejects those shapes
        //           with opaque errors). Returning early here surfaces an
        //           actionable message instead of resharp's
        //           internal error.
        // Why:      Identical pre-flight to production. The fuzzer
        //           must trip exactly the same guard the user would
        //           when authoring a complement-body lookaround.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = lookaroundInComplement(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = lookaround_in_complement(src) {
            tracing::warn!(rule = ?src, "pre-validator lookaround_in_complement rejected rule");
            return Err(anyhow!("(resharp): {}", reason));
        }
        // What:     Two additional pre-validators for resharp panic /
        //           silent-corruption shapes the fuzzer discovered in
        //           0.5.x and re-verified against 0.6.0. Both are
        //           defined alongside `lookaround_in_complement` in
        //           `engine.rs`; each returns `Some(reason)` when its
        //           known-bad shape is detected and `None` otherwise.
        //           Returning early surfaces an actionable message
        //           before resharp's `Regex::new` reaches the
        //           panicking / corrupting code path. Note: one of the
        //           two shapes (`intersection_with_lookbehind`) panics
        //           in `engine.rs:1020` behind a `debug_assert!`; in
        //           release that path returns wrong matches instead of
        //           panicking, so the pre-validator is the only defense
        //           (catch_unwind cannot catch what does not panic).
        // Why:      `catch_unwind` below is the load-bearing safety
        //           net for arbitrary upstream panics, but the panic
        //           messages it surfaces are generic ("panic during
        //           compile") and tell the rule author nothing about
        //           why the rule is bad. These pre-validators name
        //           the structural trigger for the two shapes we
        //           have bisected and let the author rewrite the
        //           rule into a supported form. See
        //           docs/troubleshooting/resharp.md for the bisection
        //           record and rewrite recipes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const check of [intersectionWithLookbehind, intersectionWithWordEndAlternation]) {
        //   const r = check(src);
        //   if (r) throw new Error(`(resharp): ${r}`);
        // }
        // ```
        if let Some(reason) = intersection_with_lookbehind(src) {
            tracing::warn!(rule = ?src, "pre-validator intersection_with_lookbehind rejected rule");
            return Err(anyhow!("(resharp): {}", reason));
        }
        if let Some(reason) = intersection_with_word_end_alternation(src) {
            tracing::warn!(rule = ?src, "pre-validator intersection_with_word_end_alternation rejected rule");
            return Err(anyhow!("(resharp): {}", reason));
        }
        // What:     `lookaround_in_alternation_with_sibling` catches
        //           the shape `(a|(?![X]))(?!Y)` and variants -- an
        //           alternation containing a lookaround followed by
        //           another lookaround. Bisected from
        //           `crash-8cba104f0805ccb567513aff895398a4f652200c`.
        //           Compiles through resharp's parser but trips the
        //           `engine.rs:1020` debug_assert on the forward DFA
        //           scan; the panic aborts the fuzz process before
        //           `catch_unwind` in `CompiledRegex::find_all` can
        //           intercept (libFuzzer-sys's panic hook calls abort
        //           first).
        // Why:      The original HANDOVER assumed the panic shape was
        //           `&` + lookahead; bisection of the actual crash
        //           artifact revealed the shape is alternation-with-
        //           lookaround + sibling-lookaround instead. The
        //           generalised `intersection_with_lookbehind`
        //           (renamed conceptually to "with any lookaround")
        //           handles the original `&`+lookahead case
        //           defensively; this new pre-validator handles the
        //           shape actually appearing in the fuzz corpus.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = lookaroundInAlternationWithSibling(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = lookaround_in_alternation_with_sibling(src) {
            tracing::warn!(rule = ?src, "pre-validator lookaround_in_alternation_with_sibling rejected rule");
            return Err(anyhow!("(resharp): {}", reason));
        }
        // What:     `complement_intersection_quantified_group` catches
        //           the shape `<prefix>~(\w)&(?:...)*` that causes
        //           resharp's algebra simplifier to hang for tens of
        //           seconds or indefinitely during `Regex::new`.
        //           Bisected from
        //           `timeout-00179d433e26fbcc3bedf2b7b38b6ce1ff9e6438`.
        //           catch_unwind below cannot catch non-termination,
        //           and resharp does not expose a compile timeout,
        //           so structural rejection is the only safe option.
        // Why:      The compile hangs past libFuzzer's per-input
        //           timeout (default 1200s, our fuzz run uses 10s
        //           per input), halting the run entirely. The shape
        //           is virtually never authored by humans (no rule
        //           in the production corpus combines `&` and `~(`),
        //           so the false-positive risk is theoretical only.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = complementIntersectionQuantifiedGroup(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = complement_intersection_quantified_group(src) {
            tracing::warn!(rule = ?src, "pre-validator complement_intersection_quantified_group rejected rule");
            return Err(anyhow!("(resharp): {}", reason));
        }
        // What:     `nested_lookahead_in_quantified_group` catches the
        //           shape `(?:(?:(?!X)){m,n}){p,q}` (and `(?:(?!X){m,n}){p,q}`)
        //           where the outer quantifier has min >= 2. Bisected from
        //           `crash-06d9dd9fa1abfeec72a8154c09434b237dfc7f38` and
        //           `crash-df95fcd52de76d952ee3db291f59434ece2c0b81`. Both
        //           reproduce a u32 addition overflow at
        //           `resharp-algebra/src/lib.rs:2470` during `Regex::new`.
        //           libfuzzer-sys's panic hook calls abort before
        //           `catch_unwind` can intercept, so the structural
        //           pre-validator is the only way to keep the fuzz target
        //           moving past these shapes.
        // Why:      Without this guard the fuzz target halted with a
        //           crash artifact instead of continuing to the
        //           soundness-by-revert verification. In production
        //           (debug-assertions OFF) the same shape silently wraps
        //           to 0 and likely produces wrong matches -- another
        //           reason to reject at the boundary.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = nestedLookaheadInQuantifiedGroup(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = nested_lookahead_in_quantified_group(src) {
            tracing::warn!(rule = ?src, "pre-validator nested_lookahead_in_quantified_group rejected rule");
            return Err(anyhow!("(resharp): {}", reason));
        }
        // What:     `quantified_lookahead_with_sibling_content` catches a
        //           second Bug F shape: `(?:(?!X)){m,n}<atom>` (a
        //           single variable-quantified lookahead-bearing
        //           group followed by any content at parent depth).
        //           Bisected from `crash-a219859099426658d70e90bc97f560b85f2cf256`
        //           which minimised to `(?:(?!abc)){4,12}a`. Same
        //           overflow path at `resharp-algebra/src/lib.rs:2470`
        //           as the nested-quant shape but a different upstream
        //           trigger (the trailing content feeds into the
        //           lookahead-chain derivative without an intermediate
        //           `Quant` wrap). The validator is intentionally
        //           broad: it false-positives on the safe "exact-quant"
        //           shape `(?:(?!X)){n}<atom>` and the
        //           "long-uniform-trail" shape `(?:(?!X)){m,n}aaa`,
        //           but full coverage is required to keep the fuzz
        //           target moving past Bug F. See
        //           docs/handover/forbidden-strings-fuzzing.md for the
        //           trade-off discussion.
        // Why:      Without this guard the soundness-by-revert phase
        //           11 fuzz run halts on the trailing-content Bug F
        //           shape before reaching the (?u)-Unicode case-fold
        //           soundness panic the target was built to catch.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = quantifiedLookaheadWithSiblingContent(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = quantified_lookahead_with_sibling_content(src) {
            tracing::warn!(rule = ?src, "pre-validator quantified_lookahead_with_sibling_content rejected rule");
            return Err(anyhow!("(resharp): {}", reason));
        }
        // What:     `nested_quantifier_after_wildcard` catches the
        //           depth-3 nested-quantifier-on-`_`-wildcard shape
        //           decoded from slow-unit artifacts
        //           `slow-unit-8c4172d7d381b5c64c5aba568217c38c5ce94945`
        //           (compile 409ms + scan 1.16s) and
        //           `slow-unit-709cb39b5255ddf0721c435159191d03aa0498ea`
        //           (compile 4.33s). Catches at chain >= 3 immediately
        //           after a bare `_` outside a class.
        // Why:      The `_` triad expands to wildcard; nesting depth
        //           3+ quantifiers on it explodes resharp's NFA
        //           construction. libFuzzer keeps these slow units in
        //           the corpus and replays them, halving exec/s
        //           throughput. Catching at the source-shape level
        //           rejects the rule in microseconds.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = nestedQuantifierAfterWildcard(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = nested_quantifier_after_wildcard(src) {
            tracing::warn!(rule = ?src, "pre-validator nested_quantifier_after_wildcard rejected rule");
            return Err(anyhow!("(resharp): {}", reason));
        }
        // What:     `nested_chain_in_lookaround_body` catches the
        //           depth-3 nested-quantifier shape sitting inside a
        //           lookaround body, decoded from
        //           `slow-unit-4eabfd5c52969dcc20c2170cd30947eccf8ae62f`
        //           (compile 1.9s before resharp errors with
        //           `Algebra(UnsupportedPattern)`).
        // Why:      Even with a literal innermost atom, resharp's
        //           algebra simplifier walks derivative shapes per-
        //           prefix per-suffix inside lookarounds, multiplying
        //           the chain's NFA cost by the lookaround context
        //           size. The compile wall-clocks past libFuzzer's
        //           slow-unit threshold even though the eventual
        //           outcome is `Err`. Source-shape rejection avoids
        //           the wall-clock burn.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = nestedChainInLookaroundBody(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = nested_chain_in_lookaround_body(src) {
            tracing::warn!(rule = ?src, "pre-validator nested_chain_in_lookaround_body rejected rule");
            return Err(anyhow!("(resharp): {}", reason));
        }
        // What:     `nested_complement` catches rule shapes containing
        //           one complement `~(...)` whose body contains another
        //           complement. Decoded from
        //           `timeout-95f5e661c596e4b5a12e9841cda2e3ba242ecf7a`
        //           (the new-generator counterpart to slow-unit-4eab).
        //           Probed compile times: 916ms for `~(~(X))` and
        //           913ms for `~((?:~(X)))` (transparent-group form);
        //           1.84ms for single `~(X)`.
        // Why:      Resharp's algebra simplifier walks both derivative
        //           chains in complement-of-complement. Under ASAN
        //           the 900ms cost amplifies past libFuzzer's 10s
        //           timeout (the timeout artifact reproduced in 31s
        //           through the fuzz binary). Source-shape rejection
        //           is the only way to keep the fuzz target moving.
        //           Sibling complements `~(...)&~(...)` (production
        //           shape) are NOT caught -- the inner complement is
        //           detected only when an outer one is open.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = nestedComplement(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = nested_complement(src) {
            tracing::warn!(rule = ?src, "pre-validator nested_complement rejected rule");
            return Err(anyhow!("(resharp): {}", reason));
        }
        // What:     `Regex::new(src).map(CompiledRegex::Resharp).map_err(...)`.
        //           `Regex::new` is resharp's compile constructor;
        //           `.map(CompiledRegex::Resharp)` wraps the
        //           successful `Regex` into the `Resharp` variant
        //           (the function reference is used in place of an
        //           explicit closure). `.map_err(...)` turns
        //           resharp's `Error` into our `String` error
        //           channel, prefixed with `(resharp):` so the
        //           outer caller can prepend `rule on line N`.
        // Why:      Produce a `CompiledRegex` ready to consume.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try { return { kind: "resharp", re: new Regex(src) }; }
        // catch (e) { throw new Error(`(resharp): ${e}`); }
        // ```
        // What:     `catch_unwind(AssertUnwindSafe(|| Regex::new(src)))`.
        //           - The outer `catch_unwind` runs the inner closure
        //             under an unwind barrier. If `Regex::new` panics
        //             during DFA construction (resharp-algebra 0.5.x
        //             through 0.6.x has an `attempt to add with overflow`
        //             panic at `lib.rs:2470` reachable from some
        //             fuzzer-discovered rule shapes; the
        //             `overflow-checks = true` profile setting in
        //             Cargo.toml is load-bearing for the panic to fire
        //             in release), the panic is caught and we surface
        //             a normal error string instead of
        //             aborting the scanner.
        //           - `AssertUnwindSafe(...)` wraps the closure so the
        //             type-checker accepts the closure's captures
        //             across the panic boundary. `&str` (the `src`
        //             capture) IS `UnwindSafe`, but the wrapper is
        //             still required because we capture by reference
        //             and `catch_unwind`'s closure bound is `FnOnce()
        //             + UnwindSafe`.
        //           - The nested `match caught` flattens the two-level
        //             `Result<Result<Regex, resharp::Error>, Box<dyn Any + Send>>`
        //             into a single `Result<CompiledRegex>`:
        //             outer `Err` (panic) becomes `(resharp): panic
        //             during compile`, inner `Err` becomes the
        //             standard `(resharp): <error>` shape, inner `Ok`
        //             wraps into `CompiledRegex::Resharp(...)`. The
        //             actionable detail (which rule shape) lives in
        //             `src`, which the outer loader already prepends
        //             via the `rule on line N` prefix.
        // Why:      Defense in depth. The pre-validator below catches
        //           every known panicking shape and surfaces a
        //           specific message; this wrapper is the fallback
        //           for shapes the pre-validator does not yet know
        //           about. Without the wrapper a single bad rule
        //           crashes the whole scanner; with it, the rule's
        //           line is named in the error and every other rule
        //           continues to compile.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try { return { kind: "resharp", re: new Regex(src) }; }
        // catch (e) { throw new Error(`(resharp): ${e}`); }
        // ```
        let caught = catch_unwind(AssertUnwindSafe(|| Regex::new(src)));
        return match caught {
            Ok(Ok(re)) => Ok(CompiledRegex::Resharp(re)),
            Ok(Err(e)) => Err(anyhow!("(resharp): {:?}", e)),
            Err(_) => Err(anyhow!(
                "(resharp): panic during compile (upstream resharp 0.5.x through 0.6.x bug). See docs/troubleshooting/resharp.md."
            )),
        };
    }
    compile_plain_rule_to_compiled(src)
}

/// Implements `compile_plain_rule_to_compiled`.
// What:     `fn compile_plain_rule_to_compiled(src: &str) -> Result<CompiledRegex>`
//           is the unicode-off / unicode-on fallback compile path
//           for rules that did NOT route to resharp. Identical to
//           the previous `compile_plain_rule` body, but returns a
//           `CompiledRegex` without the rule index so it composes
//           into `compile_rule_src`.
// Why:      Keep the "fast path -> retry with unicode" mechanic
//           in one place. `compile_plain_rule` is now a thin
//           wrapper that calls this and decorates the error
//           with `rule on line N` for diagnostics.
//
// In TS you'd write (pseudocode):
// ```ts
// function compilePlainToCompiled(src: string): CompiledRegex { ... }
// ```
fn compile_plain_rule_to_compiled(src: &str) -> Result<CompiledRegex> {
    // What:     `let src = &expand_unicode_whitespace(src);`. Rewrite
    //           the rule source so `\s` (free or in a class) matches
    //           Unicode whitespace UTF-8 byte sequences under the
    //           `unicode(false)` compile path. See the helper's
    //           docstring for the transformation rules.
    // Why:      Closes BUG 8 cheaply. The previous fix forced rules
    //           containing `\s` (and friends) onto `unicode(true)`,
    //           regressing phase 1 from ~5 ms to ~478 ms on the
    //           example ruleset (95x). The source-level expansion
    //           costs microseconds and stays on the fast path.
    let expanded = expand_unicode_whitespace(src);
    let src = expanded.as_str();
    {
    // What:     `if let Ok(re) = builder.build() { ... }` is a one-arm
    //           pattern match against `Result<Regex, Error>`. The block
    //           runs ONLY when `build()` returned `Ok`, binding the
    //           inner `Regex` to local `re`. The `Err` arm is implicit:
    //           when build fails, we fall through past the `if`.
    //           `RegexBuilder::new(src)` starts a fluent builder;
    //           `.unicode(false)` flips off unicode-aware semantics for
    //           speed; `.size_limit` / `.dfa_size_limit` raise the
    //           internal NFA/DFA caps from 10 MiB to 256 MiB so rules
    //           with large bounded repetitions (e.g. `[\w-]{138,300}`)
    //           still compile.
    // Why:      Try the fast path first; if the rule needs unicode
    //           features the build fails fast (parse error, no DFA built)
    //           and we fall through to the unicode-on retry below.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try {
    //   const re = buildRegex(src, { unicode: false, sizeLimit: 256 * 1024 * 1024 });
    //   return { idx, re: { kind: "plain", re } };
    // } catch { /* try unicode mode */ }
    // ```
    if let Ok(re) = regex::bytes::RegexBuilder::new(src)
        .unicode(false)
        .size_limit(256 * 1024 * 1024)
        .dfa_size_limit(256 * 1024 * 1024)
        .build()
    {
        // What:     `return Ok(RegexRule { idx, re: CompiledRegex::Plain(re) });`
        //           early-returns the success variant. `Ok(...)` wraps
        //           into the success arm of `Result`. `RegexRule { ... }`
        //           is a struct literal -- field-init shorthand `idx` is
        //           Rust sugar for `idx: idx`. `CompiledRegex::Plain(re)`
        //           constructs the `Plain` variant of the `CompiledRegex`
        //           enum, wrapping the just-compiled `regex::bytes::Regex`.
        // Why:      Hand the freshly compiled rule back to the caller as
        //           a success result.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { idx, re: { kind: "plain", re } };
        // ```
        return Ok(CompiledRegex::Plain(re));
    }
    }
    // Fall back to unicode-aware mode for rules with unicode features
    // OR rules that opted out of the fast path via needs_unicode_shorthand.
    // What:     `builder.build().map(CompiledRegex::Plain).map_err(|e| ...)`.
    //           Same fluent-builder mechanic as the fast path, but with
    //           `.unicode(true)`. On success the `Regex` is wrapped into
    //           `CompiledRegex::Plain`; on failure we format the error
    //           with `(regex):` so the outer caller can prepend the
    //           line number.
    // Why:      Some rules need unicode-aware semantics (`(?u)`, certain
    //           class shorthands); they fall through here.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try {
    //   const re = buildRegex(src, { unicode: true, sizeLimit: 256 * 1024 * 1024 });
    //   return { kind: "plain", re };
    // } catch (e) {
    //   throw new Error(`(regex): ${e}`);
    // }
    // ```
    regex::bytes::RegexBuilder::new(src)
        .unicode(true)
        .size_limit(256 * 1024 * 1024)
        .dfa_size_limit(256 * 1024 * 1024)
        .build()
        .map(CompiledRegex::Plain)
        .map_err(|e| anyhow!("(regex): {:?}", e))
}
