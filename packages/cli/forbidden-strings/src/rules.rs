// What:     Module-tree wiring. Each `mod foo;` declares that
//           `src/rules/foo.rs` exists and should be compiled as
//           `crate::rules::foo`. The submodules carry the actual
//           code; this file is the public face plus `load_ruleset`.
// Why:      `rules.rs` was 2000+ lines with tightly coupled but
//           topically distinct sections (engine dispatch, parsing,
//           types, walker, atom-scan, regex-syntax helpers, residual
//           sharding, loader). Splitting along those seams keeps
//           every file under ~500 lines and makes the dependency
//           graph between sections explicit (each `use super::xxx`
//           line names a real boundary).
// TS map:   `import { ... } from "./rules/foo";` per submodule.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Closest: the `index.ts` barrel-export pattern.
// ```
mod atom;
mod engine;
mod extract;
mod parse;
mod regex_syntax;
mod shards;
mod types;
mod walker;

// What:     `#[cfg(test)] mod atom_tests;` and `#[cfg(test)] mod
//           extract_tests;` declare two sibling submodules that ONLY
//           compile when running `cargo test`. The `#[cfg(test)]`
//           attribute is a conditional-compilation gate -- equivalent
//           to `#ifdef TEST` in C.
// Why:      Tests for `pub(super)` items (e.g. `atom::walk_literal_bytes`)
//           must live in a sibling module under `rules/` because they
//           need the parent-module visibility. Splitting tests into
//           their own files (rather than inline `#[cfg(test)] mod tests`
//           inside `atom.rs`) keeps the production source small and
//           lets the test files use their own dum-dum-non-ts comment
//           density without bloating the production file.
// TS map:   `if (process.env.NODE_ENV === 'test') { require("./atom_tests"); }`
//           in spirit, but Rust handles it at compile time.
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1 -- TS test files are typically compiled separately.
// ```
#[cfg(test)]
mod algebra_tests;
#[cfg(test)]
mod atom_tests;
#[cfg(test)]
mod engine_tests;
#[cfg(test)]
mod extract_tests;

// What:     Public surface re-exports so external callers (`scan.rs`,
//           `main.rs`) can keep using `crate::rules::Foo` without
//           knowing which submodule actually defines `Foo`.
// Why:      Preserves the existing `crate::rules::*` API. Renaming
//           call sites would have been a massive diff for no benefit.
// TS map:   `export { Foo } from "./rules/foo";`.
//
// In TS you'd write (pseudocode):
// ```ts
// export { CompiledRegex, ScanMatch, requiresResharp } from "./rules/engine";
// ```
pub use engine::{
    complement_intersection_quantified_group,
    intersection_with_lookbehind,
    intersection_with_word_end_alternation,
    lookaround_in_alternation_with_sibling,
    lookaround_in_complement,
    nested_grouped_quantifier,
    nested_lookahead_in_quantified_group,
    quantified_lookahead_with_sibling_content,
    requires_resharp,
    stacked_quantifier,
    CompiledRegex,
};
pub use extract::extract_gating_substrings;
pub use parse::{parse_rule_source, ParsedRule};
pub use shards::build_residual_shards;
pub use types::{is_word_byte, AcMeta, RegexRule, ResidualShard, RuleSet, SUBSTRING_THRESHOLD};

// What:     Crate-local re-exports gated behind the `fuzzing` Cargo
//           feature. Each item is a `pub(crate)` helper inside the
//           rules submodule; the re-export pulls it up to
//           `crate::rules::*` so `crate::fuzz_api` can import it
//           without learning the submodule layout. Production
//           consumers compile with this feature off and see no
//           change to the public API surface.
// Why:      Avoid widening to `pub`/`pub(crate)` everywhere just so
//           fuzz_api can reach two atom helpers and five regex-
//           syntax walkers. The cfg gate keeps the re-export
//           invisible outside the fuzzing build.
// TS map:   `export { walkLiteralBytes, skipAtomWithExtract } from "./rules/atom";`.
//
// In TS you'd write (pseudocode):
// ```ts
// export { walkLiteralBytes, skipAtomWithExtract } from "./atom";
// export {
//   groupBodyStart, findMatchingCloseParen, skipAnyQuantifier,
//   quantifierIsRequired, skipClassBody,
// } from "./regex_syntax";
// ```
#[cfg(feature = "fuzzing")]
pub use atom::{skip_atom_with_extract, walk_literal_bytes};
#[cfg(feature = "fuzzing")]
pub use regex_syntax::{
    find_matching_close_paren,
    group_body_start,
    quantifier_is_required,
    skip_any_quantifier,
    skip_class_body,
};

// What:     `use std::fs;` brings the filesystem module into scope. We
//           use `fs::read_to_string` to slurp the rules file.
// Why:      Reading rules is sync and tiny; no need for streaming.
// TS map:   `import * as fs from "node:fs";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import * as fs from "node:fs";
// ```
use std::fs;

// What:     `use aho_corasick::AhoCorasick;` imports the multi-pattern
//           literal-matcher type from the `aho-corasick` crate.
//           AhoCorasick is `Send + Sync` (no interior mutex), uses SIMD
//           (Teddy on x86, fallback elsewhere), and reports the
//           matching pattern's id with each hit -- properties we
//           explicitly exploit in the parallel scan path.
// Why:      Most rules are literal substrings. A single AC automaton
//           scans a haystack for thousands of patterns in linear time.
//           Critically, sharing one `&AhoCorasick` across rayon threads
//           does NOT serialize through a mutex, unlike `resharp::Regex`.
// TS map:   `import { AhoCorasick } from "aho-corasick";` -- though TS
//           has no equivalent first-class library; the closest is hand-
//           rolling a trie or using `RegExp` with one giant alternation.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AhoCorasick } from "aho-corasick";
// ```
use aho_corasick::AhoCorasick;

// What:     `use rayon::prelude::*;` is a "prelude import" that brings
//           every common rayon trait into scope, notably `IntoParallelIterator`,
//           `ParallelIterator`, `IndexedParallelIterator`. Glob imports
//           with `*` are unusual in TS but typical for Rust preludes.
// Why:      Without this, `.par_iter()` and friends do not exist as
//           method calls.
// TS map:   No equivalent. TS has no work-stealing thread-pool built in;
//           closest is `Promise.all` over async tasks, which is not the
//           same model.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Imagine a hypothetical:
// // import { parIter } from "rayon-like-pool";
// ```
use rayon::prelude::*;

// What:     `use resharp::Regex;` imports the resharp regex type.
//           Used inside `load_ruleset` for the (smaller) regex bucket
//           on rules that use set-algebra; rules without set-algebra
//           go through the `regex` crate via `CompiledRegex::Plain`.
// Why:      Hybrid engine dispatch: this module owns the per-rule
//           routing decision via `requires_resharp`.
// TS map:   `import { Regex } from "resharp";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Regex } from "resharp";
// ```
use resharp::Regex;

// What:     `use std::panic::{catch_unwind, AssertUnwindSafe};` brings
//           the panic-recovery primitives into scope for the
//           compile-time wrap on `Regex::new`. Full primer at the
//           same import in `src/rules/engine.rs`. Short version:
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
//           returns a normal `Err(String)` that the loader bubbles
//           up to the user with the same `rule on line N (resharp): ...`
//           prefix as every other compile failure.
// TS map:   `try { ... } catch (e) { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Rust requires catch_unwind + AssertUnwindSafe to
// // intercept panics across a closure boundary.
// ```
use std::panic::{catch_unwind, AssertUnwindSafe};

// What:     `pub fn load_ruleset(path: &str) -> Result<RuleSet, String>`
//           reads the rules file, classifies each line, parallel-compiles
//           the regex bucket via rayon, builds the AC automaton over
//           literals, and returns the bundled `RuleSet`. Error messages
//           are owned `String`s so we can carry context.
// Why:      One-stop entry point for everything rule-related. Putting
//           the parallel work behind this boundary keeps `main.rs`
//           clean of dependency-specific code.
// TS map:   `async function loadRuleset(path: string): Promise<RuleSet>`
//           where the regex compile step uses something like
//           `Promise.all` instead of rayon.
//
// In TS you'd write (pseudocode):
// ```ts
// function loadRuleset(path: string): RuleSet {
//   // throws on error; in Rust we return Err
//   ...
// }
// ```
// What:     `fn compile_plain_rule(src: &str, idx: usize) -> Result<RegexRule, String>`
//           compiles a non-set-algebra rule via the `regex` crate, trying
//           `unicode(false)` first for the speedup and falling back to
//           `unicode(true)` only when the rule actually needs unicode-
//           aware semantics (Unicode property classes, multi-byte chars
//           inside character classes, the `(?u)` flag, etc.).
// Why:      Disabling unicode is ~90x faster on Phase 1 compile and
//           gives smaller DFAs that scan faster, but a rule using
//           unicode features must compile correctly. Literal multi-
//           byte UTF-8 sequences in the regex source compile fine
//           in bytes mode without unicode -- the parser treats them
//           as the matching byte sequence -- so they take the
//           unicode-off fast path. Rules with unicode-property
//           classes or multi-byte chars inside `[...]` fall back.
//           Try-and-fallback is robust to any future rule shape:
//           ASCII rules and ones with bare-literal unicode get the
//           speedup, rules with unicode-property features get correct
//           semantics, and the rule author does not have to annotate
//           which is which.
// TS map:   `function compilePlainRule(src: string, idx: number): RegexRule | Error`.
//
// In TS you'd write (pseudocode):
// ```ts
// function compilePlainRule(src: string, idx: number): RegexRule {
//   try {
//     return { idx, re: { kind: "plain", re: regex(src, { unicode: false }) } };
//   } catch {
//     return { idx, re: { kind: "plain", re: regex(src, { unicode: true }) } };
//   }
// }
// ```
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
// TS map:   `const UNICODE_WS_ALT = "\\xc2\\xa0|...";`.
//
// In TS you'd write (pseudocode):
// ```ts
// const UNICODE_WS_ALT = String.raw`\xc2\xa0|...`;
// ```
const UNICODE_WS_ALT: &str = r"\xc2\xa0|\xe1\x9a\x80|\xe1\xa0\x8e|\xe2\x80[\x80-\x8a\xa8\xa9\xaf]|\xe2\x81\x9f|\xe3\x80\x80|\xef\xbb\xbf";

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
// TS map:   `function scanClass(bytes: Uint8Array, start: number)
//                              : { close: number; containsS: boolean } | null`.
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
// TS map:   `function utf8Width(b: number): number`.
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
// TS map:   `function expandUnicodeWhitespace(src: string): string`.
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

// What:     `pub fn compile_rule_src(src: &str) -> Result<CompiledRegex, String>`
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
// TS map:   `function compileRuleSrc(src: string): CompiledRegex`.
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
pub fn compile_rule_src(src: &str) -> Result<CompiledRegex, String> {
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
    // TS map:   `const reason = stackedQuantifier(src); if (reason) throw new Error(`(regex): ${reason}`);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const reason = stackedQuantifier(src);
    // if (reason) throw new Error(`(regex): ${reason}`);
    // ```
    if let Some(reason) = stacked_quantifier(src) {
        return Err(format!("(regex): {}", reason));
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
    // TS map:   `const reason = nestedGroupedQuantifier(src); if (reason) throw new Error(`(regex): ${reason}`);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const reason = nestedGroupedQuantifier(src);
    // if (reason) throw new Error(`(regex): ${reason}`);
    // ```
    if let Some(reason) = nested_grouped_quantifier(src) {
        return Err(format!("(regex): {}", reason));
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
    // TS map:   `if (requiresResharp(src)) ... else ...`.
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
        // TS map:   `const reason = lookaroundInComplement(src); if (reason) throw new Error(...);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = lookaroundInComplement(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = lookaround_in_complement(src) {
            return Err(format!("(resharp): {}", reason));
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
        //           TROUBLESHOOTING.resharp.md for the bisection
        //           record and rewrite recipes.
        // TS map:   `for (const check of [intersectionWithLookbehind, intersectionWithWordEndAlternation]) { const r = check(src); if (r) throw new Error(`(resharp): ${r}`); }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const check of [intersectionWithLookbehind, intersectionWithWordEndAlternation]) {
        //   const r = check(src);
        //   if (r) throw new Error(`(resharp): ${r}`);
        // }
        // ```
        if let Some(reason) = intersection_with_lookbehind(src) {
            return Err(format!("(resharp): {}", reason));
        }
        if let Some(reason) = intersection_with_word_end_alternation(src) {
            return Err(format!("(resharp): {}", reason));
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
        // TS map:   `const reason = lookaroundInAlternationWithSibling(src); if (reason) throw new Error(`(resharp): ${reason}`);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = lookaroundInAlternationWithSibling(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = lookaround_in_alternation_with_sibling(src) {
            return Err(format!("(resharp): {}", reason));
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
        // TS map:   `const reason = complementIntersectionQuantifiedGroup(src); if (reason) throw new Error(`(resharp): ${reason}`);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = complementIntersectionQuantifiedGroup(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = complement_intersection_quantified_group(src) {
            return Err(format!("(resharp): {}", reason));
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
        // TS map:   `const reason = nestedLookaheadInQuantifiedGroup(src); if (reason) throw new Error(`(resharp): ${reason}`);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = nestedLookaheadInQuantifiedGroup(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = nested_lookahead_in_quantified_group(src) {
            return Err(format!("(resharp): {}", reason));
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
        //           HANDOVER.forbidden-strings-fuzzing.md for the
        //           trade-off discussion.
        // Why:      Without this guard the soundness-by-revert phase
        //           11 fuzz run halts on the trailing-content Bug F
        //           shape before reaching the (?u)-Unicode case-fold
        //           soundness panic the target was built to catch.
        // TS map:   `const reason = quantifiedLookaheadWithSiblingContent(src); if (reason) throw new Error(`(resharp): ${reason}`);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const reason = quantifiedLookaheadWithSiblingContent(src);
        // if (reason) throw new Error(`(resharp): ${reason}`);
        // ```
        if let Some(reason) = quantified_lookahead_with_sibling_content(src) {
            return Err(format!("(resharp): {}", reason));
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
        // TS map:   `try { return { kind: "resharp", re: new Regex(src) }; } catch (e) { throw new Error(`(resharp): ${e}`); }`.
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
        //             into a single `Result<CompiledRegex, String>`:
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
        // TS map:   `try { return new Regex(src); } catch (e) { throw new Error(`(resharp): ${e}`); }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try { return { kind: "resharp", re: new Regex(src) }; }
        // catch (e) { throw new Error(`(resharp): ${e}`); }
        // ```
        let caught = catch_unwind(AssertUnwindSafe(|| Regex::new(src)));
        return match caught {
            Ok(Ok(re)) => Ok(CompiledRegex::Resharp(re)),
            Ok(Err(e)) => Err(format!("(resharp): {:?}", e)),
            Err(_) => Err(
                "(resharp): panic during compile (upstream resharp 0.5.x through 0.6.x bug). See TROUBLESHOOTING.resharp.md."
                    .to_string()
            ),
        };
    }
    compile_plain_rule_to_compiled(src)
}

// What:     `fn compile_plain_rule_to_compiled(src: &str) -> Result<CompiledRegex, String>`
//           is the unicode-off / unicode-on fallback compile path
//           for rules that did NOT route to resharp. Identical to
//           the previous `compile_plain_rule` body, but returns a
//           `CompiledRegex` without the rule index so it composes
//           into `compile_rule_src`.
// Why:      Keep the "fast path -> retry with unicode" mechanic
//           in one place. `compile_plain_rule` is now a thin
//           wrapper that calls this and decorates the error
//           with `rule on line N` for diagnostics.
// TS map:   `function compilePlainToCompiled(src: string): CompiledRegex`.
//
// In TS you'd write (pseudocode):
// ```ts
// function compilePlainToCompiled(src: string): CompiledRegex { ... }
// ```
fn compile_plain_rule_to_compiled(src: &str) -> Result<CompiledRegex, String> {
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
    // TS map:   `try { return new Regex(src, { unicode: false, ... }); } catch { /* fall through */ }`.
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
        // TS map:   `return { idx, re: { kind: "plain", re } };` (with
        //           throwing-style errors instead of `Result`).
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
    // TS map:   `try { return { kind: "plain", re: build(src, { unicode: true }) }; } catch (e) { throw new Error(`(regex): ${e}`); }`.
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
        .map_err(|e| format!("(regex): {:?}", e))
}

// What:     `pub fn load_ruleset(path: &str) -> Result<RuleSet, String>`
//           reads the rules file at `path`, surfaces the I/O error
//           with a friendly message if the read fails, and hands
//           the contents to `load_ruleset_from_source`. The
//           production CLI calls this; fuzz targets that want to
//           drive the loader with a generated in-memory source
//           call `load_ruleset_from_source` directly.
// Why:      Keep the file-read split out from the loader proper so
//           it can be exercised from fuzz tests without writing a
//           tempfile per iteration.
// TS map:   `async function loadRuleset(path: string): Promise<RuleSet>`.
//
// In TS you'd write (pseudocode):
// ```ts
// async function loadRuleset(path: string): Promise<RuleSet> {
//   const content = await readFile(path, "utf8");
//   return loadRulesetFromSource(content, path);
// }
// ```
pub fn load_ruleset(path: &str) -> Result<RuleSet, String> {
    // What:     `fs::read_to_string(path).map_err(|e| ...)?`. Slurp the
    //           rules file into an owned `String`. `?` propagates the
    //           formatted error early so the caller sees a friendly
    //           "read rules PATH: ERROR" message instead of an opaque
    //           `io::Error`.
    // Why:      Centralise file-read error formatting in one place.
    // TS map:   `const content = await readFile(path, "utf8");`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const content = await readFile(path, "utf8");
    // ```
    let timing = std::env::var("FORBIDDEN_STRINGS_DEBUG_TIMING").is_ok();
    let t_start = std::time::Instant::now();
    let content = fs::read_to_string(path)
        .map_err(|e| format!("read rules {}: {}", path, e))?;
    if timing {
        let dt = std::time::Instant::now().duration_since(t_start).as_secs_f64() * 1000.0;
        eprintln!("load_ruleset phase 0 read_rules_file: {:.1}ms", dt);
    }
    load_ruleset_from_source(&content, path)
}

// What:     `pub fn load_ruleset_from_source(content: &str, _label: &str) -> Result<RuleSet, String>`
//           runs the loader pipeline (classify -> compile regex
//           rules in parallel -> extract gating substrings -> build
//           the AC indices -> build the residual shards) against an
//           in-memory rule source. The `_label` parameter exists for
//           future error-context use; it is currently unused but
//           kept so callers can pass an identifying string (path,
//           "fuzz-input", "test-fixture").
// Why:      Fuzz targets need to drive the loader without touching
//           the filesystem. Splitting the file-read out of the
//           pipeline gives them an entry point that takes a
//           generated source directly.
// TS map:   `function loadRulesetFromSource(content: string, label: string): RuleSet`.
//
// In TS you'd write (pseudocode):
// ```ts
// function loadRulesetFromSource(content: string, label: string): RuleSet {
//   /* classify, compile, build indices, return RuleSet */
// }
// ```
pub fn load_ruleset_from_source(content: &str, _label: &str) -> Result<RuleSet, String> {
    // What:     `let timing = std::env::var("FORBIDDEN_STRINGS_DEBUG_TIMING").is_ok();`
    //           reads an env var ONCE; subsequent phase boundaries log
    //           elapsed wall time when this is true. The closure
    //           `now` captures `t_phase` so we get per-phase deltas
    //           rather than absolute times since program start.
    // Why:      Bench-driven optimisation needs per-phase visibility.
    //           Without it, "startup is 3 s" tells us nothing about
    //           which phase to attack. Env-gated so the production
    //           hot path pays nothing.
    // TS map:   `const timing = !!process.env.FORBIDDEN_STRINGS_DEBUG_TIMING;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const timing = !!process.env.FORBIDDEN_STRINGS_DEBUG_TIMING;
    // let tPhase = performance.now();
    // const phase = (label: string) => {
    //   if (!timing) return;
    //   const now = performance.now();
    //   console.error(`load_ruleset phase ${label}: ${(now - tPhase).toFixed(1)}ms`);
    //   tPhase = now;
    // };
    // ```
    let timing = std::env::var("FORBIDDEN_STRINGS_DEBUG_TIMING").is_ok();
    let mut t_phase = std::time::Instant::now();
    let mut phase = |label: &str| {
        if !timing { return; }
        let now = std::time::Instant::now();
        let dt = now.duration_since(t_phase).as_secs_f64() * 1000.0;
        eprintln!("load_ruleset phase {}: {:.1}ms", label, dt);
        t_phase = now;
    };

    // Phase 1: sequential classification. Cheap (string ops only).
    // What:     `let mut literal_specs: Vec<(usize, String)> = Vec::new();`
    //           allocates an empty growable vector of TUPLES. `(usize,
    //           String)` is an anonymous tuple type -- a fixed-size,
    //           positional product of a `usize` and an owned `String`.
    //           Sibling: `Vec<RuleSpec>` would use a named struct;
    //           we use a tuple here because the two fields are always
    //           accessed together and never need named accessors.
    // Why:      Pair each rule's line index with its literal text for
    //           later AC building; line index is needed for diagnostics.
    // TS map:   `const literalSpecs: Array<[number, string]> = [];`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const literalSpecs: Array<[number, string]> = [];
    // const regexSpecs: Array<[number, string]> = [];
    // ```
    let mut literal_specs: Vec<(usize, String)> = Vec::new();
    let mut regex_specs: Vec<(usize, String)> = Vec::new();
    let mut line_idx: usize = 0;
    // What:     `for line in content.lines() { ... }` iterates the
    //           string by lines. `content.lines()` returns an iterator
    //           of `&str` slices, each one a borrowed view into
    //           `content` with no trailing `\n`. Inside the loop, `line`
    //           is `&str`; we don't take ownership.
    // Why:      Process the rules file one line at a time, classifying
    //           each into the literal bucket, the regex bucket, or
    //           ignored (blank/comment).
    // TS map:   `for (const line of content.split("\n")) { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const line of content.split("\n")) {
    //   lineIdx += 1;
    //   const parsed = parseRuleSource(line);
    //   if (parsed?.kind === "literal") literalSpecs.push([lineIdx, parsed.text]);
    //   else if (parsed?.kind === "regex") regexSpecs.push([lineIdx, parsed.src]);
    // }
    // ```
    for line in content.lines() {
        line_idx += 1;
        // What:     `match parse_rule_source(line) { Some(ParsedRule::Literal(lit)) => ..., Some(ParsedRule::Regex(src)) => ..., None => {} }`.
        //           A nested pattern match: the outer `Some(...)`
        //           extracts the present variant of `Option<ParsedRule>`,
        //           and inside that the nested `ParsedRule::Literal(lit)`
        //           or `ParsedRule::Regex(src)` extracts the enum
        //           variant's payload into a fresh local. The `None =>
        //           {}` arm is required for completeness -- Rust matches
        //           must be exhaustive -- and produces no work (empty
        //           block).
        // Why:      Route each parsed line to its destination bucket;
        //           drop unparseable / blank / comment lines silently.
        // TS map:   `if (parsed?.kind === "literal") ...; else if (parsed?.kind === "regex") ...;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const parsed = parseRuleSource(line);
        // if (parsed?.kind === "literal") literalSpecs.push([lineIdx, parsed.text]);
        // else if (parsed?.kind === "regex") regexSpecs.push([lineIdx, parsed.src]);
        // ```
        match parse_rule_source(line) {
            Some(ParsedRule::Literal(lit)) => literal_specs.push((line_idx, lit)),
            Some(ParsedRule::Regex(src)) => regex_specs.push((line_idx, src)),
            None => {}
        }
    }

    if literal_specs.is_empty() && regex_specs.is_empty() {
        // What:     `Err("no rules loaded".to_string())`. `Err(...)` is
        //           the failure variant of `Result`; the literal
        //           `"no rules loaded"` is `&'static str` (a borrowed
        //           slice of the binary's read-only string table).
        //           `.to_string()` allocates a fresh OWNED `String`
        //           copy. Sibling: `&str` would not satisfy the
        //           function's `Result<_, String>` signature -- the
        //           caller may keep the error past our stack frame.
        // Why:      Empty rules file is a configuration error; surface
        //           it instead of silently scanning nothing.
        // TS map:   `throw new Error("no rules loaded");`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // throw new Error("no rules loaded");
        // ```
        return Err("no rules loaded".to_string());
    }

    // Phase 2a: parallel-compile the regex bucket. Each `Regex::new`
    // call is independent (its own algebra/parser pass plus a fresh
    // `Mutex<RegexInner>`), so rayon's work-stealing fits perfectly.
    // Hybrid engine dispatch: rules without resharp-only features
    // (set-algebra `A&B` / `~(A)`, lookarounds `(?=` / `(?!` / `(?<=` /
    // `(?<!`) compile via the `regex` crate (~100x faster than resharp
    // on equivalent patterns); rules WITH any of those features stay
    // on resharp. The classification is a shallow string scan
    // (`requires_resharp`) -- no parser invocation -- so the
    // dispatch itself is essentially free.
    //
    // The regex builder bumps size_limit / dfa_size_limit because
    // a few corpus rules with large bounded repetitions (e.g.
    // `hvb\.[\w-]{138,300}`) compile to NFA/DFA sizes above the
    // default 10 MiB cap. 256 MiB has room for any realistic
    // secret-detection pattern in practice; this is RAM, not disk,
    // so the cap is per-process and disposed when the scanner exits.
    // What:     `regex_specs.par_iter().map(|(idx, src)| { ... }).collect::<Result<Vec<_>, _>>()?`.
    //           Step by step:
    //           - `.par_iter()` borrows the vec as a parallel iterator
    //             (rayon work-stealing across cores).
    //           - `.map(|(idx, src)| { ... })` runs the closure on each
    //             element. The closure params destructure the
    //             `&(usize, String)` tuple into `idx: &usize` and
    //             `src: &String`. The closure returns
    //             `Result<RegexRule, String>` per element.
    //           - `.collect::<Result<Vec<_>, _>>()` materializes back
    //             into a SINGLE `Result`: either `Ok(Vec<RegexRule>)`
    //             with every per-element success, OR the FIRST `Err`
    //             encountered (short-circuit). The turbofish `::<...>`
    //             tells `collect` the target type since otherwise the
    //             call is ambiguous; `Vec<_>` lets the inner type infer.
    //           - The trailing `?` unwraps `Ok` or propagates `Err`.
    // Why:      Compile every regex rule in parallel and bubble up the
    //           first compile failure as a single error.
    // TS map:   `const regexRules = await Promise.all(regexSpecs.map(([idx, src]) => requires_resharp(src) ? Regex.new(src) : compilePlainRule(src, idx)));`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const regexRules: RegexRule[] = await Promise.all(regexSpecs.map(([idx, src]) => {
    //   if (requiresResharp(src)) {
    //     try { return { idx, re: { kind: "resharp", re: new Regex(src) } }; }
    //     catch (e) { throw new Error(`rule on line ${idx} (resharp): ${e}`); }
    //   }
    //   return compilePlainRule(src, idx);
    // }));
    // ```
    // What:     `regex_specs.par_iter().map(...).collect()`. Every
    //           per-rule compile delegates to `compile_rule_src`, the
    //           single source of truth for the route+compile decision
    //           (also reached by `fuzz_api::compile_rule_src`). The
    //           closure wraps the returned `CompiledRegex` with the
    //           rule's line index, and decorates compile errors with
    //           the same `rule on line N` prefix the loader has
    //           always produced. Suffix shape comes from
    //           `compile_rule_src` itself: `(resharp): ...` or
    //           `(regex): ...`.
    // Why:      The plan requires fuzz and production to exercise an
    //           identical compile path. Routing both through
    //           `compile_rule_src` makes that property structural,
    //           not a documented invariant.
    // TS map:   `regexRules = await Promise.all(regexSpecs.map(([idx, src]) => compileRuleSrc(src).then(re => ({ idx, re })).catch(e => { throw new Error(`rule on line ${idx} ${e.message}`); })));`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const regexRules: RegexRule[] = await Promise.all(
    //   regexSpecs.map(([idx, src]) => {
    //     try { return { idx, re: compileRuleSrc(src) }; }
    //     catch (e) { throw new Error(`rule on line ${idx} ${e.message}`); }
    //   }),
    // );
    // ```
    let regex_rules: Vec<RegexRule> = regex_specs
        .par_iter()
        .map(|(idx, src)| {
            compile_rule_src(src)
                .map(|re| RegexRule { idx: *idx, re })
                .map_err(|e| format!("rule on line {} {}", idx, e))
        })
        .collect::<Result<Vec<_>, _>>()?;
    phase("1 classify+regex_compile");

    // Phase 2b: extract a Vec of gating substrings from each regex rule
    // where possible. Rules with an extractable set go into the unified
    // AC index (each substring is its own AC pattern, all mapped to the
    // same rule_pos in metadata). Rules whose extraction returns `None`
    // fall back to a residual resharp gate covering only that small
    // subset.
    let regex_prefixes: Vec<Option<Vec<(String, bool)>>> = regex_specs
        .iter()
        .map(|(_, src)| extract_gating_substrings(src))
        .collect();
    phase("2 extract_gating_substrings");

    // Phase 2c: build the unified AC pattern list. Order matters --
    // pattern ids are assigned in input order, so `ac_meta[i]` must
    // describe the i-th pattern. We push literals first, then regex
    // prefixes, building both the pattern Vec and the metadata Vec
    // in lockstep.
    //
    // Two parallel pattern/meta vecs -- one for the case-sensitive AC
    // (literals + ci=false regex prefixes) and one for the case-
    // insensitive AC (only ci=true regex prefixes). User-authored
    // literal rules are always case-sensitive, so they only enter
    // the cs vec. Splitting buckets lets aho-corasick's
    // `ascii_case_insensitive(true)` builder option apply ONLY to the
    // ci bucket, leaving the cs bucket strict.
    let mut ac_patterns: Vec<&str> = Vec::new();
    let mut ac_meta: Vec<AcMeta> = Vec::new();
    let mut ac_patterns_ci: Vec<&str> = Vec::new();
    let mut ac_meta_ci: Vec<AcMeta> = Vec::new();
    for (line_idx, lit) in literal_specs.iter() {
        ac_patterns.push(lit.as_str());
        // Compute conditional word-boundary requirements once at load
        // time. Length gate: when the literal is at least
        // `SUBSTRING_THRESHOLD` bytes long, both bounds drop to `false`
        // -- distinctiveness from sheer length makes coincidental
        // substring match negligible (see threshold-constant docs for
        // the math).
        let long_enough = lit.len() >= SUBSTRING_THRESHOLD;
        let bound_left = !long_enough
            && lit.as_bytes().first().copied().is_some_and(is_word_byte);
        let bound_right = !long_enough
            && lit.as_bytes().last().copied().is_some_and(is_word_byte);
        ac_meta.push(AcMeta::Literal { idx: *line_idx, bound_left, bound_right });
    }
    // For each regex rule with an extractable set, push EVERY substring
    // as its own AC pattern, all mapped to the same `rule_pos`. AC
    // firing for any of them dedups via `prefix_matched.insert(rule_pos)`
    // in scan.rs and runs `find_all` exactly once per rule per file.
    // OR-gate semantics: any substring in the set is a valid gate for
    // this rule.
    for (rule_pos, pre) in regex_prefixes.iter().enumerate() {
        if let Some(subs) = pre {
            for (sub, ci) in subs {
                if *ci {
                    ac_patterns_ci.push(sub.as_str());
                    ac_meta_ci.push(AcMeta::RegexPrefix { rule_pos });
                } else {
                    ac_patterns.push(sub.as_str());
                    ac_meta.push(AcMeta::RegexPrefix { rule_pos });
                }
            }
        }
    }

    // What:     `AhoCorasick::new(&ac_patterns)` returns
    //           `Result<AhoCorasick, ...>`. Default `MatchKind::Standard`
    //           supports `find_overlapping_iter`, which we need so that
    //           a longer literal hit doesn't suppress the shorter regex-
    //           prefix hit at the same position.
    // Why:      Without overlapping iteration, a file containing a literal
    //           rule whose text ALSO starts with a regex rule's prefix
    //           would only fire the literal -- the regex rule's full
    //           `find_all` would never be triggered.
    // TS map:   `new AhoCorasick(acPatterns)`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const ac = acPatterns.length === 0 ? null : new AhoCorasick(acPatterns);
    // ```
    let ac: Option<AhoCorasick> = if ac_patterns.is_empty() {
        None
    } else {
        Some(AhoCorasick::new(&ac_patterns).map_err(|e| format!("ac build: {}", e))?)
    };

    // What:     `AhoCorasickBuilder::new().ascii_case_insensitive(true).build(&ac_patterns_ci)?`
    //           builds a separate AC automaton that compares each input
    //           byte folded to lowercase against pattern bytes also
    //           folded to lowercase. Because the fold is ASCII-only
    //           (the implementation OR's `0x20` only on ASCII letters),
    //           non-ASCII bytes are unaffected and the gate stays sound.
    // Why:      The case-insensitive AC handles `(?i)` regex rules
    //           cheaply on the hot path: one extra `find_overlapping_iter`
    //           per file scan, no per-rule resharp work.
    // TS map:   `new AhoCorasick(acPatternsCi, { caseInsensitive: true })`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const acCi = acPatternsCi.length === 0
    //   ? null
    //   : new AhoCorasickBuilder().asciiCaseInsensitive(true).build(acPatternsCi);
    // ```
    let ac_ci: Option<AhoCorasick> = if ac_patterns_ci.is_empty() {
        None
    } else {
        Some(
            aho_corasick::AhoCorasickBuilder::new()
                .ascii_case_insensitive(true)
                .build(&ac_patterns_ci)
                .map_err(|e| format!("ac-ci build: {}", e))?,
        )
    };
    phase("3 ac_build");

    // Phase 2d: build the residual gate over regex rules WITHOUT an
    // extractable prefix. If every regex rule had a prefix, this is
    // empty -- and `residual_combined` becomes `None`, removing the
    // resharp lazy-DFA pass from the per-file hot path entirely.
    // What:     `regex_prefixes.iter().enumerate().filter_map(|(pos, p)| ... ).collect()`.
    //           - `.iter()` is a SEQUENTIAL borrowed iterator (no rayon).
    //           - `.enumerate()` adapts each item `&Option<...>` into a
    //             `(usize, &Option<...>)` pair where the `usize` is the
    //             0-based position.
    //           - `.filter_map(closure)` is "filter + map at once": the
    //             closure returns `Option<usize>`; `Some(v)` keeps `v`,
    //             `None` drops the element. We test `p.is_none()` and
    //             keep the position when the prefix-extraction returned
    //             None (= residual).
    //           - `.collect()` materialises into `Vec<usize>` (the
    //             explicit type annotation guides the inference).
    // Why:      We need a list of regex_rules indices whose required
    //           prefix could not be extracted; those become residual
    //           shards.
    // TS map:   `const residualPositions = regexPrefixes.flatMap((p, pos) => p === null ? [pos] : []);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const residualPositions: number[] = [];
    // regexPrefixes.forEach((p, pos) => { if (p === null) residualPositions.push(pos); });
    // ```
    let residual_positions: Vec<usize> = regex_prefixes
        .iter()
        .enumerate()
        .filter_map(|(pos, p)| if p.is_none() { Some(pos) } else { None })
        .collect();

    // Phase 2e: build sharded residual gates with try-and-halve sizing.
    // Resharp's HIR translator rejects sufficiently large alternations
    // with `UnsupportedResharpRegex` (cliff measured at 1722-1725 for
    // the synthetic `[a-z]{4}_RESID_..._[A-Za-z0-9]{12}` shape; cliff
    // varies with rule content because the limit comes from
    // `regex_syntax::hir::translate` size/depth costs, not a fixed
    // pattern-count constant in resharp). The right architecture is
    // therefore runtime-adaptive sharding rather than a hardcoded shard
    // size.
    // What:     `build_residual_shards(&residual_positions, &regex_specs)?`.
    //           Two BORROW arguments (`&...`) -- we lend the slices
    //           read-only, the callee doesn't take ownership. The `?`
    //           operator unwraps the returned `Result<Vec<ResidualShard>, String>`:
    //           `Ok(v)` becomes the bound value, `Err(e)` early-returns
    //           from `load_ruleset` with that error.
    // Why:      Compute the sharded residual gates from the positions
    //           that didn't make it onto the AC fast path; surface any
    //           shard-build failure to the caller.
    // TS map:   `const residualShards = await buildResidualShards(residualPositions, regexSpecs);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const residualShards = buildResidualShards(residualPositions, regexSpecs);
    // ```
    let residual_shards = build_residual_shards(&residual_positions, &regex_specs)?;
    phase("4 residual_shards");

    // What:     `Ok(RuleSet { ac, ac_meta, ac_ci, ac_meta_ci, regex_rules, residual_shards })`
    //           constructs the success variant of `Result`, wrapping a
    //           freshly built `RuleSet`. The struct literal uses
    //           field-init shorthand: each name is both the field
    //           name AND the local variable name, so `ac` is sugar for
    //           `ac: ac`. No trailing `;` -- this is the function's
    //           tail expression, so its value becomes the return.
    // Why:      Hand the assembled ruleset back to the caller.
    // TS map:   `return { ac, acMeta, acCi, acMetaCi, regexRules, residualShards };`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { ac, acMeta, acCi, acMetaCi, regexRules, residualShards };
    // ```
    Ok(RuleSet { ac, ac_meta, ac_ci, ac_meta_ci, regex_rules, residual_shards })
}
