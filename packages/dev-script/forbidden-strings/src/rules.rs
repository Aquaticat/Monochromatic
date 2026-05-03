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
//           Resharp's `Regex` holds a `Mutex<RegexInner>` for lazy DFA
//           growth, so calling `is_match`/`find_all` on a SHARED Regex
//           from multiple threads serializes through that lock. Each
//           rule gets its own Regex, so per-rule parallelism still
//           works (different mutexes).
// Why:      We use resharp only for the (smaller) regex bucket --
//           literals go through AC. The combined-over-regex-bucket
//           Regex acts as a fast "any regex rule might match?" gate.
// TS map:   `import { Regex } from "resharp";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Regex } from "resharp";
// ```
use resharp::Regex;

// What:     `pub enum ParsedRule { Literal(String), Regex(String) }`
//           declares an enum (Rust's tagged-union; closer to a
//           discriminated union in TS than a TS `enum`). Each variant
//           carries an owned `String` payload: the raw literal text,
//           or the resharp regex source string. `pub` exposes it for
//           `parse_rule_source`'s return type.
// Why:      The classifier output of `parse_rule_source`. Downstream
//           code splits these into the AC bucket vs the regex bucket.
// TS map:   `type ParsedRule = { kind: "literal"; text: string } | { kind: "regex"; src: string };`.
//
// In TS you'd write (pseudocode):
// ```ts
// type ParsedRule =
//   | { kind: "literal"; text: string }
//   | { kind: "regex"; src: string };
// ```
pub enum ParsedRule {
    Literal(String),
    Regex(String),
}

// What:     `pub struct RegexRule { pub idx: usize, pub re: Regex }` is
//           a record type pairing the original line index with a
//           compiled resharp `Regex`. `pub` on the struct and on each
//           field makes both visible to `scan.rs`.
// Why:      We keep the rule's line index (1-based) so violation output
//           can reference `rule=N`. `re` is the compiled regex used
//           for `find_all` on the violation path.
// TS map:   `type RegexRule = { idx: number; re: Regex };`.
//
// In TS you'd write (pseudocode):
// ```ts
// type RegexRule = { idx: number; re: Regex };
// ```
pub struct RegexRule {
    pub idx: usize,
    pub re: Regex,
}

// What:     `pub enum AcMeta { Literal { idx, bound_left, bound_right }, RegexPrefix { rule_pos } }`
//           is the side-table value telling `scan.rs` what an AC pattern
//           id represents. `Literal` carries the user-facing rule line
//           index for direct emission, plus two booleans that say
//           whether a `grep -w`-style word-boundary check is required at
//           each end of the match (computed at load time from the
//           literal's first/last byte and length; see `compute_bounds`).
//           `RegexPrefix` carries an index into `RuleSet.regex_rules`,
//           signalling "this prefix being seen means the matching regex
//           rule needs its full `find_all` run on this file".
// Why:      One unified AC index now scans for BOTH literal rules AND
//           required-literal prefixes of regex rules. The metadata
//           dispatch lets `scan_content` route each AC hit to the right
//           handler without a second pass. In the 99%-clean case AC
//           emits zero hits and no resharp `Regex` work happens at all.
//           The boundary bools let short literal hits be filtered
//           before emission so a 3-char acronym does not match
//           coincidentally inside a noisy base64 blob, while long
//           literals match as pure substrings (substring uniqueness
//           grows fast enough with length that boundary protection is
//           not needed for distinctive multi-character phrases).
// TS map:   `type AcMeta = { kind: "literal"; idx: number; boundLeft: boolean; boundRight: boolean } | { kind: "regexPrefix"; rulePos: number };`.
//
// In TS you'd write (pseudocode):
// ```ts
// type AcMeta =
//   | { kind: "literal"; idx: number; boundLeft: boolean; boundRight: boolean }
//   | { kind: "regexPrefix"; rulePos: number };
// ```
pub enum AcMeta {
    Literal { idx: usize, bound_left: bool, bound_right: bool },
    RegexPrefix { rule_pos: usize },
}

// What:     `pub fn is_word_byte(b: u8) -> bool` returns `true` when the
//           ASCII byte `b` is a "word character" in the regex sense:
//           `[A-Za-z0-9_]`. Public so `scan.rs` can reuse the same
//           definition for the file-side boundary check.
// Why:      Conditional word-boundary semantics for literal rules
//           (modeled on `grep -w`) require classifying both the
//           literal's edge byte and the file byte adjacent to the match.
//           Centralizing the predicate keeps the two checks consistent.
// TS map:   `function isWordByte(b: number): boolean`.
//
// In TS you'd write (pseudocode):
// ```ts
// function isWordByte(b: number): boolean {
//   return (
//     (b >= 0x30 && b <= 0x39) || // 0-9
//     (b >= 0x41 && b <= 0x5a) || // A-Z
//     (b >= 0x61 && b <= 0x7a) || // a-z
//     b === 0x5f                   // _
//   );
// }
// ```
pub fn is_word_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

// What:     Minimum literal length (in bytes) at which conditional
//           word-boundary checks are DROPPED -- literals at or above
//           this length match as pure case-sensitive substrings.
// Why:      Derivation: a length-L literal in case-sensitive alphabet
//           of size A scanned over N random bytes has expected
//           coincidence count ~= N * A^(-L). Targeting < 0.01 expected
//           coincidences per rule across 1 GB (10^9 bytes) of dense
//           noise content (orders of magnitude larger than any
//           realistic repo's combined base64/random-text content),
//           the smallest L meeting both base64 (A=64) and random
//           alphanumeric (A=62) is L=7:
//
//             L=6 -> base64 ~0.015, alnum ~0.019  (borderline)
//             L=7 -> base64 ~2.3e-4, alnum ~3.0e-4  (safe)
//             L=8 -> base64 ~3.6e-6, alnum ~4.9e-6  (overkill)
//
//           Below this threshold the per-edge boundary check still
//           fires; an explicit-substring escape hatch is to write a
//           short literal as a regex (`/foo/`).
// TS map:   `const SUBSTRING_THRESHOLD = 7;`.
//
// In TS you'd write (pseudocode):
// ```ts
// const SUBSTRING_THRESHOLD = 7;
// ```
pub const SUBSTRING_THRESHOLD: usize = 7;

// What:     `pub struct RuleSet { ... }` is the top-level rules
//           container produced by `load_ruleset` and consumed by
//           `scan_content`. The unified `ac` index now covers literals
//           AND required-literal prefixes of regex rules; `ac_meta` is
//           a parallel-by-pattern-id Vec telling which is which.
//           `residual_combined` gates only those regex rules whose
//           required-literal prefix could NOT be extracted (pure
//           character-class openers, alternations, etc.).
// Why:      One owned bundle holds everything the scan path needs. The
//           hot path on a clean file is now a single AC pass with no
//           resharp work; resharp only enters when AC fires a hit.
// TS map:   `type RuleSet = { ac: AhoCorasick | null; acMeta: AcMeta[]; regexRules: readonly RegexRule[]; residualCombined: Regex | null; residualPositions: number[] };`.
//
// In TS you'd write (pseudocode):
// ```ts
// type RuleSet = {
//   ac: AhoCorasick | null;
//   acMeta: AcMeta[];
//   regexRules: readonly RegexRule[];
//   residualCombined: Regex | null;
//   residualPositions: number[];
// };
// ```
// What:     `pub struct ResidualShard { pub gate: Regex, pub positions: Vec<usize> }`
//           pairs one combined-alternation Regex (the shard's gate) with
//           the list of `regex_rules` indices it covers. Multiple shards
//           together cover the full residual bucket.
// Why:      Resharp's HIR translator (via `regex_syntax::hir::translate`)
//           rejects sufficiently large alternations with
//           `UnsupportedResharpRegex` -- bisect on the synthetic
//           `[a-z]{4}_RESID_..._[A-Za-z0-9]{12}` shape found the cliff
//           at 1722-1725 patterns; the cliff varies with rule content
//           because translation cost depends on inner AST shape, not on
//           a fixed pattern-count constant. Sharding the bucket and
//           building one Regex per shard means a workload with arbitrary
//           residual count loads successfully; on `is_match`-true we
//           still know exactly which subset of rules might match (the
//           shard's `positions`).
// TS map:   `type ResidualShard = { gate: Regex; positions: number[] };`.
//
// In TS you'd write (pseudocode):
// ```ts
// type ResidualShard = { gate: Regex; positions: number[] };
// ```
pub struct ResidualShard {
    pub gate: Regex,
    pub positions: Vec<usize>,
}

pub struct RuleSet {
    pub ac: Option<AhoCorasick>,
    pub ac_meta: Vec<AcMeta>,
    // What:     `pub ac_ci: Option<AhoCorasick>` is a SECOND Aho-Corasick
    //           automaton built with `ascii_case_insensitive(true)`. It
    //           covers required-substring prefixes extracted from regex
    //           rules whose source carried a `(?i)` flag (or whose
    //           extractable substring would otherwise need case-folded
    //           matching). Literal rules NEVER live in this index --
    //           literals are user-authored case-sensitively.
    // Why:      Most betterleaks-shape rules begin with `(?i)` and
    //           historically left `extract_required_prefix` returning
    //           `None`, dumping them all into the residual gate. With
    //           a CI-AC bucket those same rules ride the AC fast path
    //           via case-insensitive ASCII matching, draining the
    //           residual gate and removing the per-file mutex
    //           contention on the hot path.
    // TS map:   `ac_ci: AhoCorasick | null` (a second instance built
    //           with the case-insensitive option flipped on).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // ac_ci: AhoCorasick | null;
    // acMetaCi: AcMeta[];
    // ```
    pub ac_ci: Option<AhoCorasick>,
    pub ac_meta_ci: Vec<AcMeta>,
    pub regex_rules: Vec<RegexRule>,
    pub residual_shards: Vec<ResidualShard>,
}

// What:     `pub fn parse_rule_source(line: &str) -> Option<ParsedRule>`
//           classifies one line of the rules file into a literal or a
//           regex (or `None` for blank/comment lines). `&str` is a
//           borrowed UTF-8 slice; we don't take ownership.
// Why:      Single source of truth for rule syntax. Comments use `#`,
//           blanks are ignored; `/PATTERN/FLAGS` is a regex; everything
//           else is a literal.
// TS map:   `function parseRuleSource(line: string): ParsedRule | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function parseRuleSource(line: string): ParsedRule | null {
//   const trimmed = line.trim();
//   if (!trimmed || trimmed.startsWith("#")) return null;
//   if (trimmed.length >= 2 && trimmed[0] === "/") {
//     const last = trimmed.lastIndexOf("/");
//     if (last > 0) {
//       const pattern = trimmed.slice(1, last);
//       const flags = trimmed.slice(last + 1);
//       if (/^[a-z]*$/.test(flags)) {
//         const src = flags ? `(?${flags})${pattern}` : pattern;
//         return { kind: "regex", src };
//       }
//     }
//   }
//   return { kind: "literal", text: trimmed };
// }
// ```
pub fn parse_rule_source(line: &str) -> Option<ParsedRule> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.starts_with('#') {
        return None;
    }
    let bytes = trimmed.as_bytes();
    if bytes.len() >= 2 && bytes[0] == b'/' {
        // What:     `if let Some(last) = trimmed.rfind('/') { ... }` is
        //           one-arm pattern match: `rfind` returns `Option<usize>`,
        //           we enter the block only when `Some`, binding the
        //           inner offset to `last`.
        // Why:      Anchor on the LAST `/` so the regex body itself can
        //           contain escaped slashes.
        // TS map:   `const last = trimmed.lastIndexOf("/"); if (last !== -1) { ... }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const last = trimmed.lastIndexOf("/");
        // if (last > 0) { ... }
        // ```
        if let Some(last) = trimmed.rfind('/') {
            if last > 0 {
                let pattern = &trimmed[1..last];
                let flags = &trimmed[last + 1..];
                let flags_ok = flags.chars().all(|c| c.is_ascii_lowercase());
                if flags_ok {
                    let mut out = String::new();
                    if !flags.is_empty() {
                        out.push_str("(?");
                        out.push_str(flags);
                        out.push(')');
                    }
                    out.push_str(pattern);
                    return Some(ParsedRule::Regex(out));
                }
            }
        }
    }
    Some(ParsedRule::Literal(trimmed.to_string()))
}

// What:     Minimum byte length of an extracted regex prefix. Anything
//           shorter is dropped from the unified AC index because short
//           prefixes (like "a" or "to") fire on every file and defeat
//           the gate's whole purpose.
// Why:      The AC gate is meant to skip work on no-match files. A
//           1-byte "prefix" matches almost everywhere, queueing the
//           full regex `find_all` for nothing.
// TS map:   `const MIN_PREFIX_LEN = 4;`.
//
// In TS you'd write (pseudocode):
// ```ts
// const MIN_PREFIX_LEN = 4;
// ```
const MIN_PREFIX_LEN: usize = 4;

// What:     `pub fn extract_required_prefix(src: &str) -> Option<String>`
//           returns the longest leading byte sequence of a regex source
//           that MUST appear at the start of every match. Returns
//           `None` if no prefix of at least `MIN_PREFIX_LEN` can be
//           extracted, or if the regex is case-insensitive (because the
//           AC index is case-sensitive). The walker is conservative:
//           it stops at the first character it can't prove is literal.
// Why:      Regex rules whose source starts with literal bytes (e.g.
//           `sk_live_[A-Z0-9]{20}` -> `sk_live_`) can be pre-filtered
//           by an AC scan. Files where the prefix never appears cannot
//           contain a regex match, so we skip the slow resharp pass
//           entirely on those files.
// TS map:   `function extractRequiredPrefix(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function extractRequiredPrefix(src: string): string | null {
//   // Skip leading "(?flags)" group; bail if `i` is set.
//   // Skip leading anchors `^`, `\b`, `\A`.
//   // Walk literal bytes; stop at first metacharacter.
//   // Return null if shorter than MIN_PREFIX_LEN.
// }
// ```
pub fn extract_required_prefix(src: &str) -> Option<(String, bool)> {
    let mut s = src;
    let mut ci = false;

    // What:     `if let Some(rest) = s.strip_prefix("(?")` matches the
    //           inline-flags group `(?flags)` at the very start.
    //           `strip_prefix` returns `Option<&str>` -- `Some(rest)`
    //           when the prefix matched (rest = remainder), `None`
    //           otherwise. We also have to discriminate `(?flags)` from
    //           `(?:body)` non-capturing groups: the former carries
    //           ASCII letters and an optional `-` sign before `)`; the
    //           latter has `:` immediately after `?`.
    // Why:      Regex sources commonly start with `(?i)` (case-
    //           insensitive). Stripping it and remembering the flag
    //           lets the rest of the walker treat the remainder as a
    //           normal pattern; the flag is returned as a tuple field
    //           so the loader can route this rule's substring onto the
    //           case-insensitive AC bucket.
    // TS map:   `const m = s.match(/^\(\?([a-zA-Z\-]*)\)/);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const flagMatch = s.match(/^\(\?([a-zA-Z\-]*)\)/);
    // if (flagMatch) {
    //   if (flagMatch[1].includes("i")) ci = true;
    //   s = s.slice(flagMatch[0].length);
    // }
    // ```
    if let Some(rest) = s.strip_prefix("(?") {
        if let Some(end) = rest.find(')') {
            let flags = &rest[..end];
            // Flag-group bodies are `[a-zA-Z-]*` only. If we see
            // anything else (`:`, `[`, etc.), this is not a flag-group
            // and we should not consume past `)`.
            let is_flag_group = !flags.is_empty()
                && flags.chars().all(|c| c.is_ascii_alphabetic() || c == '-');
            if is_flag_group {
                if flags.contains('i') {
                    ci = true;
                }
                s = &rest[end + 1..];
            }
        }
    }

    // What:     Loop stripping leading anchors `^`, `\A`, `\b` -- they
    //           don't contribute literal bytes themselves but also don't
    //           invalidate the prefix that follows.
    // Why:      `^prefix` still requires the literal `prefix` somewhere
    //           in the file (specifically at line/string start), so the
    //           AC index for the literal portion remains a valid gate.
    //           We accept rare false-positive AC hits where `prefix`
    //           appears mid-line; the regex's own anchors will reject
    //           those when `find_all` runs.
    // TS map:   `while (s.startsWith("^") || s.startsWith("\\b") || s.startsWith("\\A")) s = s.slice(...);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (s.startsWith("^")) s = s.slice(1);
    // while (s.startsWith("\\b") || s.startsWith("\\A")) s = s.slice(2);
    // ```
    loop {
        if let Some(rest) = s.strip_prefix('^') {
            s = rest;
        } else if let Some(rest) = s.strip_prefix("\\b") {
            s = rest;
        } else if let Some(rest) = s.strip_prefix("\\A") {
            s = rest;
        } else {
            break;
        }
    }

    // What:     Walk the regex source byte by byte, accumulating literal
    //           characters into `out`. Stop at the first character
    //           that introduces a non-literal regex construct: any of
    //           `. * + ? | ( [ { $ ^`. Handle `\X` escapes -- if `X`
    //           is a punctuation char, it's a literal X; if it's
    //           anything else (`\d`, `\w`, `\s`, `\n`, ...), bail.
    // Why:      Conservative literal extraction. A character that
    //           introduces a regex operator could let the regex skip
    //           the leading bytes we've collected -- e.g. `(prefix)?`
    //           makes prefix optional. Bailing at any operator keeps
    //           the prefix sound.
    // TS map:   `for (const c of s) { ...; }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let out = "";
    // for (let i = 0; i < s.length; ) {
    //   const c = s[i];
    //   if (c === "\\") {
    //     const next = s[i + 1];
    //     if ('.*+?()[]{}|^$\\/"\''.includes(next)) { out += next; i += 2; }
    //     else break;
    //   } else if ('.*+?|([${^'.includes(c)) break;
    //   else { out += c; i += 1; }
    // }
    // ```
    // What:     The outer loop alternates between accumulating literal
    //           bytes and skipping a "required-but-non-literal" structure
    //           at the head. A required-but-non-literal structure is
    //           something whose presence is mandatory in any match (so
    //           the literal that follows it is *also* mandatory) but
    //           that contributes no fixed bytes itself: a character
    //           class with a required quantifier (`[a-z]{4}`, `\d+`),
    //           or an escape-class with a required quantifier
    //           (`\w{8}`, `\s+`). After each successful skip the loop
    //           re-enters literal accumulation against the remainder.
    // Why:      Pure leading-prefix extraction misses common rule shapes
    //           like `[a-z]{4}_RESID_<tag>_[A-Za-z0-9]{12}` where the
    //           rule starts with a character class. The substring
    //           `_RESID_<tag>_` is still mandatory in every match
    //           (`[a-z]{4}` matches exactly 4 chars; nothing optional in
    //           between). Putting that substring into the AC index lets
    //           the rule ride the AC fast path, with its own per-rule
    //           `Mutex<RegexInner>` -- removing the
    //           `residual_combined`-mutex contention on the hot path.
    //           See PERF.md: in the 10k-rule + 10% residual benchmark
    //           the residual gate's contention drops parallelism from
    //           9.5x to 4.2x cores; routing those rules onto AC instead
    //           of a shared combined Regex restores ~9-10x parallelism.
    // TS map:   No equivalent.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // outer: walk literals -> skip char-class -> repeat
    // ```
    let mut best = String::new();
    let mut current = String::new();
    loop {
        walk_literal_bytes(s, &mut current, &mut s);
        if current.len() > best.len() {
            best = std::mem::take(&mut current);
        } else {
            current.clear();
        }
        // What:     If the walker stopped because the remainder begins
        //           with a top-level alternation `|`, the substring
        //           accumulated above is NOT required -- it could be
        //           the other branch instead. Return `None` so the
        //           rule routes onto the residual gate where the full
        //           regex semantics apply. We do NOT rely on best
        //           being the longer/shorter branch's contents; both
        //           are equally invalid as a required substring.
        // Why:      Soundness fix. Without this, a rule like
        //           `/foobar|barfoo/` would extract "foobar" and
        //           AC-gate on it, missing files that contain only
        //           "barfoo". The same hazard applies to body-level
        //           alternation handled inside the recursion: when
        //           `extract_required_prefix` is called on the body
        //           of `(?:foo|bar)`, this same check fires and we
        //           return None, so the parent skip_atom contributes
        //           nothing.
        // TS map:   `if (s.startsWith("|")) return null;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (s.startsWith("|")) return null;
        // ```
        if s.starts_with('|') {
            return None;
        }
        // What:     `skip_atom_with_extract(s)` returns a tuple of
        //           `(remainder, optional_extracted_substring)`. The
        //           extracted substring is `Some(content)` only for
        //           required `(?:...)` / `(...)` groups whose body
        //           reduces to a literal substring -- e.g. `(?:adafruit)`
        //           contributes `"adafruit"`. Optional groups
        //           (`(?:...)?`, `(?:...)*`, `(?:...){0,N}`) and
        //           non-literal-contributing atoms (character classes,
        //           `\d`/`\w`/`\s`) return `None` for the extraction
        //           field but still advance `s` past the atom so the
        //           outer loop continues.
        // Why:      The betterleaks rule shape has `(?i)[\w.-]{0,50}(?:KEYWORD)...`;
        //           after stripping `(?i)` and skipping the optional
        //           class, the next required atom is the non-capturing
        //           group whose literal body IS the keyword. Extracting
        //           the body's literal lets the rule's required
        //           substring ride the AC fast path.
        // TS map:   `const { remainder, extracted } = skipAtomWithExtract(s);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const r = skipAtomWithExtract(s);
        // if (r === null) break;
        // s = r.remainder;
        // if (r.extracted && r.extracted.length > best.length) best = r.extracted;
        // ```
        if let Some((rest, contribution)) = skip_atom_with_extract(s) {
            s = rest;
            if let Some(extracted) = contribution {
                if extracted.len() > best.len() {
                    best = extracted;
                }
            }
            continue;
        }
        break;
    }

    if best.len() < MIN_PREFIX_LEN {
        return None;
    }
    Some((best, ci))
}

// What:     `fn walk_literal_bytes(input, out, remainder)` walks `input`
//           byte by byte, pushing literal characters into `out` and
//           returning the un-walked tail via `remainder` (a `&mut &str`
//           pointing into `input`'s lifetime). Stops at the first byte
//           that introduces a non-literal regex construct.
// Why:      Extracted from the original inline walk so it can be reused
//           between the leading pass and the post-skip passes. Same
//           literal-recognition rules as before: punctuation escapes
//           (`\.`, `\*`, ...) become their literal char; metacharacters
//           (`. * + ? | ( [ { $ ^`) end the walk; non-punctuation
//           escapes (`\d`, `\w`, ...) end the walk.
// TS map:   `function walkLiteralBytes(input: string, out: string[]): { remainder: string }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function walkLiteralBytes(input: string, out: string[]) {
//   let i = 0;
//   while (i < input.length) {
//     const c = input.charCodeAt(i);
//     if (c === 0x5c /* \\ */) { /* punctuation-escape -> push, else break */ }
//     else if ('.*+?|([{$^'.includes(input[i])) break;
//     else { out.push(input[i]); i += 1; }
//   }
//   return { remainder: input.slice(i) };
// }
// ```
fn walk_literal_bytes<'a>(input: &'a str, out: &mut String, remainder: &mut &'a str) {
    let bytes = input.as_bytes();
    let mut i = 0usize;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'|' {
            // What:     Top-level alternation `|` makes the substring
            //           on either side of `|` not required (could be
            //           the other branch instead). Force the walker
            //           to bail; the caller's outer logic must then
            //           reject the whole scope as a candidate (see
            //           `extract_required_prefix` -- it tracks
            //           alternation via the helper below).
            // Why:      Without this, `/foobar|barfoo/` would extract
            //           "foobar" and AC-gate on it, missing files that
            //           contain only "barfoo". Soundness bug.
            // TS map:   `if (c === "|") break;`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (c === "|") break;
            // ```
            break;
        }
        if c == b'\\' {
            if i + 1 >= bytes.len() {
                break;
            }
            let next = bytes[i + 1];
            // What:     ASCII alphanumeric escapes (`\w`, `\d`, `\s`,
            //           `\b`, `\A`, `\Z`, `\n`, etc.) are SPECIAL --
            //           they should end the walk, not contribute a
            //           literal character. Everything else after `\`
            //           is treated as that character literal (`\_` ->
            //           `_`, `\=` -> `=`, `\:` -> `:`, etc.). Resharp's
            //           grammar accepts `\X` as the literal X for any
            //           non-special X; the walker mirrors that.
            // Why:      The previous allowlist of punctuation escapes
            //           missed `\_` -- which is common in
            //           betterleaks-shape rules (e.g. `doo\_v1\_`
            //           pattern bodies). 25+ rules with `\_` were
            //           falling into the residual bucket purely
            //           because the walker bailed on `\_`.
            // TS map:   `if (/[A-Za-z0-9]/.test(next)) break; else { out += next; i += 2; }`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (/[A-Za-z0-9]/.test(next)) break;
            // out += next; i += 2;
            // ```
            if next.is_ascii_alphanumeric() {
                break;
            }
            out.push(next as char);
            i += 2;
            continue;
        }
        // What:     `matches!(c, b'.' | ...)` -- match-as-expression.
        //           Returns true when `c` is any regex metacharacter
        //           that ends a literal run.
        // Why:      These characters introduce non-literal regex
        //           constructs the walker is not equipped to handle
        //           inline; the outer `extract_required_prefix` loop
        //           may resume after them via `skip_atom_with_extract`.
        // TS map:   `if ('.*+?([{$^'.includes(c)) break;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if ('.*+?([{$^'.includes(c)) break;
        // ```
        if matches!(c, b'.' | b'*' | b'+' | b'?' | b'(' | b')' | b'[' | b']' | b'{' | b'}' | b'$' | b'^') {
            break;
        }
        out.push(c as char);
        i += 1;
    }
    *remainder = &input[i..];
}

// What:     `fn skip_atom_with_extract(s) -> Option<(&str, Option<String>)>`
//           recognizes one head atom, advances past it AND its
//           quantifier, and optionally returns a literal substring
//           extracted from a `(?:body)` / `(body)` group whose body
//           reduces to a literal. Returns `None` only when the head is
//           not a recognised atom (so the outer walker should stop).
//
//           Recognised heads:
//           - `[ ... ]<quantifier>` (character class with any quantifier)
//           - `\d|\w|\s|\D|\W|\S<quantifier>` (perl-class escape with any quantifier)
//           - `(?: body )<quantifier>` and `( body )<quantifier>`
//             non-capturing or capturing group; recurses into body to
//             try to pull out a required literal substring.
//
//           A REQUIRED quantifier is `+`, `{N}`, `{N,}`, or `{N,M}`
//           with N>=1, or absence of quantifier. Optional quantifiers
//           (`?`, `*`, `{0}`, `{0,N}`, `{0,}`) are still recognised so
//           the walker advances past them; their group body never
//           contributes a literal even if it is one (because the body
//           may match zero times).
// Why:      Lets the walker continue past optional structures it used
//           to bail on (`{0,50}`, `(?:foo)?`) and pull out body
//           literals from non-capturing groups (`(?:adafruit)`). The
//           combined effect on the betterleaks ruleset: 162 `(?i)...`
//           rules whose substring is `(?:KEYWORD)` mid-body now reach
//           the AC fast path instead of dumping into the residual
//           combined-regex gate.
// TS map:   `function skipAtomWithExtract(s: string): { remainder: string; extracted: string | null } | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function skipAtomWithExtract(s: string): { remainder: string; extracted: string | null } | null { /* ... */ }
// ```
fn skip_atom_with_extract(s: &str) -> Option<(&str, Option<String>)> {
    let bytes = s.as_bytes();
    if bytes.is_empty() {
        return None;
    }

    // Character class `[...]`
    if bytes[0] == b'[' {
        let after_class = skip_class_body(s)?;
        let after_quant = skip_any_quantifier(after_class);
        return Some((after_quant, None));
    }

    // Perl-class escape `\d`, `\w`, `\s`, `\D`, `\W`, `\S`
    if bytes.len() >= 2 && bytes[0] == b'\\' {
        match bytes[1] {
            b'd' | b'w' | b's' | b'D' | b'W' | b'S' => {
                let after_quant = skip_any_quantifier(&s[2..]);
                return Some((after_quant, None));
            }
            _ => {}
        }
    }

    // What:     Group: `(?:body)`, `(body)`, or inline `(?flags)`.
    //           For an inline `(?flags)` group with no body, treat as a
    //           transparent atom (advance past, no extraction). For a
    //           true group, find the matching close paren via
    //           `find_matching_close_paren`, recurse into the body to
    //           pull out a required substring (if quantifier permits),
    //           and advance past the quantifier.
    // Why:      Group skipping is what enables walking past
    //           `[\w.-]{0,50}` (already an optional class) and pulling
    //           the keyword out of the next `(?:adafruit)` group on
    //           the betterleaks shape.
    // TS map:   no equivalent.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // group head detection
    // ```
    if bytes[0] == b'(' {
        // Determine if this is `(?flags)` (inline, no body), a scoped
        // flag group `(?flags:body)`, or a regular group `(?:body)` /
        // `(body)`. The inline form is a transparent atom; the scoped
        // form delimits a body whose flag context differs from outer;
        // the regular form is the common case.
        if bytes.len() >= 2 && bytes[1] == b'?' {
            // What:     Walk past `?` and any flag letters/dashes.
            //           `j` ends at either `)` (inline) or `:` (scoped)
            //           or another character (regular group with `(?:`,
            //           `(?<name>`, `(?P<name>`, `(?=...)`, etc.).
            // Why:      Discriminate inline-flag from scoped-flag from
            //           regular group without false-matching `(?:body)`
            //           which has `:` immediately after `?`.
            // TS map:   `let j = 2; while (...) j++;`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // let j = 2;
            // while (j < bytes.length && (isAlpha(bytes[j]) || bytes[j] === '-')) j += 1;
            // ```
            let mut j = 2usize;
            while j < bytes.len() && (bytes[j].is_ascii_alphabetic() || bytes[j] == b'-') {
                j += 1;
            }
            // Inline `(?flags)` -- requires at least one flag char and
            // immediate `)` after the run.
            if j > 2 && j < bytes.len() && bytes[j] == b')' {
                return Some((&s[j + 1..], None));
            }
            // Scoped `(?flags:body)` -- non-zero flag run followed by
            // `:`. The body's flag context may invert outer ci, so we
            // can't safely merge the body's required substring into
            // the outer's accumulator. Skip without extraction; the
            // rule may land in residual if its only required substring
            // lives inside such a scope. The few rules using this form
            // (~5% of the betterleaks corpus) are the cost of keeping
            // ci as a single bool per rule.
            if j > 2 && j < bytes.len() && bytes[j] == b':' {
                let close_idx = find_matching_close_paren(s)?;
                let after = &s[close_idx + 1..];
                let after_quant = skip_any_quantifier(after);
                return Some((after_quant, None));
            }
        }

        let close_idx = find_matching_close_paren(s)?;
        let body_start = group_body_start(s)?;
        let body = &s[body_start..close_idx];
        let after = &s[close_idx + 1..];
        let after_quant = skip_any_quantifier(after);
        let quant_required = quantifier_is_required(after);
        // Recurse only if the group is required. Optional groups
        // contribute nothing to the required-substring set.
        let extraction = if quant_required {
            // Recurse, then forget the ci flag -- the outer walker has
            // its own ci scope. If the body contained an inline `(?i)`
            // changing ci mid-walk, the recursive result's ci flag
            // refers to that inner scope; we conservatively use the
            // body's extracted substring only when ci matches the
            // outer scope. Since `extract_required_prefix` here always
            // returns ci=false for bodies that didn't carry their own
            // `(?i)`, and we never propagate the outer ci into the
            // recursion (we don't have it here), we accept the body's
            // result as-is and let the literal-prefix mismatch fall
            // out at the AC dispatch layer. In practice the betterleaks
            // shape has `(?i)` AT THE TOP and bodies are flag-free, so
            // the body's recursive ci is always `false` and is
            // overridden by the outer's `ci` field on the way out.
            extract_required_prefix(body).map(|(text, _ci)| text)
        } else {
            None
        };
        return Some((after_quant, extraction));
    }

    None
}

// What:     `fn group_body_start(s: &str) -> Option<usize>` returns the
//           byte offset of the first character of a group's body.
//           For `(body)` it is `1`; for `(?:body)` and `(?P<name>body)`
//           it is the offset just after the opener metadata.
// Why:      Recursion into a group body must skip the opener itself
//           (`(`, `(?:`, `(?P<name>`, `(?<name>`) so the recursive
//           walker sees only the body's regex syntax.
// TS map:   `function groupBodyStart(s: string): number | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function groupBodyStart(s: string): number | null {
//   if (s[0] !== "(") return null;
//   if (s[1] !== "?") return 1;
//   if (s[2] === ":") return 3;
//   if (s[2] === "P" && s[3] === "<") return s.indexOf(">", 4) + 1;
//   if (s[2] === "<") return s.indexOf(">", 3) + 1;
//   return 1;  // fallback: best-effort
// }
// ```
fn group_body_start(s: &str) -> Option<usize> {
    let bytes = s.as_bytes();
    if bytes.is_empty() || bytes[0] != b'(' {
        return None;
    }
    if bytes.len() < 2 || bytes[1] != b'?' {
        return Some(1);
    }
    if bytes.len() >= 3 && bytes[2] == b':' {
        return Some(3);
    }
    if bytes.len() >= 4 && bytes[2] == b'P' && bytes[3] == b'<' {
        let close = s[4..].find('>')?;
        return Some(4 + close + 1);
    }
    if bytes.len() >= 3 && bytes[2] == b'<' {
        let close = s[3..].find('>')?;
        return Some(3 + close + 1);
    }
    // (?... unknown shape, e.g. (?=lookahead)/(?!neg)/(?<=...) -- bail.
    None
}

// What:     `fn find_matching_close_paren(s: &str) -> Option<usize>`
//           returns the byte index of the `)` matching the leading `(`
//           in `s`. Handles nested parens, character classes (which
//           don't nest but contain literal `)` as a regular char), and
//           `\X` escapes.
// Why:      Group skipping needs the right closing paren to advance
//           past the whole group, including any nested parens.
// TS map:   `function findMatchingCloseParen(s: string): number | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function findMatchingCloseParen(s: string): number | null {
//   if (s[0] !== "(") return null;
//   let depth = 1, i = 1;
//   while (i < s.length) {
//     const c = s[i];
//     if (c === "\\") { i += 2; continue; }
//     if (c === "[") { /* skip class */ }
//     else if (c === "(") depth += 1;
//     else if (c === ")") { depth -= 1; if (depth === 0) return i; }
//     i += 1;
//   }
//   return null;
// }
// ```
fn find_matching_close_paren(s: &str) -> Option<usize> {
    let bytes = s.as_bytes();
    if bytes.is_empty() || bytes[0] != b'(' {
        return None;
    }
    let mut depth: usize = 1;
    let mut i: usize = 1;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\\' {
            i += 2;
            continue;
        }
        if c == b'[' {
            // Skip class body so an unescaped `(`/`)` inside a class
            // doesn't break our paren count. The class body skipper
            // returns the slice AFTER the closing `]`.
            let class_slice = &s[i..];
            if let Some(after_class) = skip_class_body(class_slice) {
                let bytes_consumed = class_slice.len() - after_class.len();
                i += bytes_consumed;
                continue;
            }
            // Malformed class -- bail out.
            return None;
        }
        if c == b'(' {
            depth += 1;
            i += 1;
            continue;
        }
        if c == b')' {
            depth -= 1;
            if depth == 0 {
                return Some(i);
            }
            i += 1;
            continue;
        }
        i += 1;
    }
    None
}

// What:     `fn skip_any_quantifier(s: &str) -> &str` advances past one
//           leading quantifier (required OR optional) and returns the
//           remainder. If no quantifier is present, returns `s`.
// Why:      The new atom-skipper needs to advance past quantifiers
//           regardless of required-vs-optional: the body-extracted
//           literal is contributed only when the quantifier is required,
//           but the walker still has to skip past optional quantifiers
//           in either case so it can keep going.
// TS map:   `function skipAnyQuantifier(s: string): string`.
//
// In TS you'd write (pseudocode):
// ```ts
// function skipAnyQuantifier(s: string): string { /* ... */ }
// ```
fn skip_any_quantifier(s: &str) -> &str {
    let bytes = s.as_bytes();
    if bytes.is_empty() {
        return s;
    }
    if matches!(bytes[0], b'+' | b'?' | b'*') {
        // Tail `?` (lazy) is OK to also skip; e.g. `++?`
        if bytes.len() >= 2 && bytes[1] == b'?' {
            return &s[2..];
        }
        return &s[1..];
    }
    if bytes[0] == b'{' {
        if let Some(close) = s.find('}') {
            // Tail `?` (lazy) after `}` is also part of the quantifier
            // syntax; skip if present.
            let after = close + 1;
            if after < bytes.len() && bytes[after] == b'?' {
                return &s[after + 1..];
            }
            return &s[after..];
        }
    }
    s
}

// What:     `fn quantifier_is_required(s: &str) -> bool` returns true
//           if the head of `s` is a quantifier whose lower bound is
//           >= 1 (or there is no quantifier, treating "exactly one"
//           as required).
// Why:      Decides whether the body of a preceding group is required
//           to appear in any match. Optional quantifiers (`?`, `*`,
//           `{0}`, `{0,N}`, `{0,}`) make the group body matchable zero
//           times, so its literal contributes nothing.
// TS map:   `function quantifierIsRequired(s: string): boolean`.
//
// In TS you'd write (pseudocode):
// ```ts
// function quantifierIsRequired(s: string): boolean { /* ... */ }
// ```
fn quantifier_is_required(s: &str) -> bool {
    let bytes = s.as_bytes();
    if bytes.is_empty() {
        return true; // no quantifier -> exactly one match -> required
    }
    if bytes[0] == b'+' {
        return true;
    }
    if bytes[0] == b'?' || bytes[0] == b'*' {
        return false;
    }
    if bytes[0] == b'{' {
        if let Some(close) = s.find('}') {
            let inner = &s[1..close];
            let first_num = inner
                .split(',')
                .next()
                .and_then(|n| n.trim().parse::<u32>().ok())
                .unwrap_or(0);
            return first_num >= 1;
        }
        return true;
    }
    true
}

// What:     `fn skip_class_body(s: &str) -> Option<&str>` skips a single
//           bracketed character class starting at the leading `[` of
//           `s` and returns the remainder after the closing `]`.
//           Handles a leading `^` negation and a leading `]` treated as
//           a literal character (e.g. `[]abc]` matches `]ab` etc.).
//           Skips `\X` escape sequences inside the class without
//           interpreting them.
// Why:      Resharp accepts character classes with the same syntax as
//           PCRE/regex_syntax; skipping one body is a flat scan with
//           no nesting (regex character classes don't nest, except via
//           the resharp set-algebra `[A&&B]` form -- which this scan
//           handles correctly because `&&` doesn't open a new class).
// TS map:   `function skipClassBody(s: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function skipClassBody(s: string): string | null {
//   // walk past `[`, optional `^`, optional immediate `]`-as-literal,
//   // then characters and `\X` escapes until the matching `]`.
// }
// ```
fn skip_class_body(s: &str) -> Option<&str> {
    let bytes = s.as_bytes();
    if bytes.is_empty() || bytes[0] != b'[' {
        return None;
    }
    let mut i: usize = 1;
    if i < bytes.len() && bytes[i] == b'^' {
        i += 1;
    }
    if i < bytes.len() && bytes[i] == b']' {
        i += 1;
    }
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\\' {
            if i + 1 >= bytes.len() {
                return None;
            }
            i += 2;
            continue;
        }
        if c == b']' {
            return Some(&s[i + 1..]);
        }
        i += 1;
    }
    None
}

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
pub fn load_ruleset(path: &str) -> Result<RuleSet, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("read rules {}: {}", path, e))?;

    // Phase 1: sequential classification. Cheap (string ops only).
    let mut literal_specs: Vec<(usize, String)> = Vec::new();
    let mut regex_specs: Vec<(usize, String)> = Vec::new();
    let mut line_idx: usize = 0;
    for line in content.lines() {
        line_idx += 1;
        match parse_rule_source(line) {
            Some(ParsedRule::Literal(lit)) => literal_specs.push((line_idx, lit)),
            Some(ParsedRule::Regex(src)) => regex_specs.push((line_idx, src)),
            None => {}
        }
    }

    if literal_specs.is_empty() && regex_specs.is_empty() {
        return Err("no rules loaded".to_string());
    }

    // Phase 2a: parallel-compile the regex bucket. Each `Regex::new`
    // call is independent (its own algebra/parser pass plus a fresh
    // `Mutex<RegexInner>`), so rayon's work-stealing fits perfectly.
    // What:     `regex_specs.par_iter().map(|(idx, src)| { ... }).collect::<Result<Vec<_>, _>>()?`
    //           - `par_iter()` produces a parallel iterator (rayon).
    //           - `.map(...)` runs the closure on each item across
    //             worker threads.
    //           - `.collect::<Result<Vec<_>, _>>()` collects into a
    //             `Result<Vec<RegexRule>, String>`: short-circuits on
    //             the first `Err`. The turbofish `::<...>` tells the
    //             compiler the target type. `?` propagates the error.
    // Why:      For 1k rules at ~50us each, single-core compile is
    //           ~50ms; 16-thread parallel drops it to ~5-10ms.
    // TS map:   Async equivalent: `await Promise.all(regexSpecs.map(...))`,
    //           collecting failures.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const regexRules: RegexRule[] = await Promise.all(
    //   regexSpecs.map(async ([idx, src]) => ({ idx, re: new Regex(src) }))
    // );
    // ```
    let regex_rules: Vec<RegexRule> = regex_specs
        .par_iter()
        .map(|(idx, src)| {
            Regex::new(src)
                .map(|re| RegexRule { idx: *idx, re })
                .map_err(|e| format!("rule on line {}: {:?}", idx, e))
        })
        .collect::<Result<Vec<_>, _>>()?;

    // Phase 2b: extract a required-literal prefix from each regex rule
    // where possible. Rules with an extractable prefix go into the
    // unified AC index; rules without one fall back to a residual
    // resharp gate covering only that small subset.
    // What:     `regex_specs.iter().map(|(_, src)| extract_required_prefix(src)).collect()`
    //           runs the extractor over each regex source string and
    //           collects the per-rule `Option<String>`. We do this
    //           sequentially because string-walking 1k short strings
    //           takes microseconds and parallelism overhead would lose.
    // Why:      Per-rule prefix is the input to building the unified AC;
    //           we need every rule's result before we can decide which
    //           bucket each goes into.
    // TS map:   `regexSpecs.map(([, src]) => extractRequiredPrefix(src))`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const prefixes = regexSpecs.map(([, src]) => extractRequiredPrefix(src));
    // ```
    let regex_prefixes: Vec<Option<(String, bool)>> = regex_specs
        .iter()
        .map(|(_, src)| extract_required_prefix(src))
        .collect();

    // Phase 2c: build the unified AC pattern list. Order matters --
    // pattern ids are assigned in input order, so `ac_meta[i]` must
    // describe the i-th pattern. We push literals first, then regex
    // prefixes, building both the pattern Vec and the metadata Vec
    // in lockstep.
    // What:     `let mut ac_patterns: Vec<&str> = Vec::new();` -- a Vec
    //           of borrowed string slices pointing into `literal_specs`
    //           (owned `String`s) and `regex_prefixes` (owned `String`s
    //           inside `Option`). Borrows are valid until those source
    //           Vecs are dropped at the end of `load_ruleset`.
    // Why:      `AhoCorasick::new` takes `&[impl AsRef<[u8]>]`; a slice
    //           of `&str` satisfies that without copying the bytes.
    // TS map:   `const acPatterns: string[] = []; const acMeta: AcMeta[] = [];`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const acPatterns: string[] = [];
    // const acMeta: AcMeta[] = [];
    // for (const [idx, lit] of literalSpecs) {
    //   acPatterns.push(lit);
    //   acMeta.push({ kind: "literal", idx });
    // }
    // for (let pos = 0; pos < regexPrefixes.length; pos++) {
    //   const pre = regexPrefixes[pos];
    //   if (pre) { acPatterns.push(pre); acMeta.push({ kind: "regexPrefix", rulePos: pos }); }
    // }
    // ```
    // What:     Two parallel pattern/meta vecs -- one for the case-
    //           sensitive AC (literals + ci=false regex prefixes) and
    //           one for the case-insensitive AC (only ci=true regex
    //           prefixes). User-authored literal rules are always case-
    //           sensitive, so they only enter the cs vec.
    // Why:      Splitting buckets lets aho-corasick's
    //           `ascii_case_insensitive(true)` builder option apply ONLY
    //           to the ci bucket, leaving the cs bucket strict. With one
    //           shared AC, enabling case-insensitivity would also make
    //           the user's case-sensitive literal rules match
    //           case-insensitively -- wrong behaviour.
    // TS map:   `const acPatternsCs: string[] = []; const acPatternsCi: string[] = [];`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const acPatternsCs: string[] = [];
    // const acPatternsCi: string[] = [];
    // const acMetaCs: AcMeta[] = [];
    // const acMetaCi: AcMeta[] = [];
    // ```
    let mut ac_patterns: Vec<&str> = Vec::new();
    let mut ac_meta: Vec<AcMeta> = Vec::new();
    let mut ac_patterns_ci: Vec<&str> = Vec::new();
    let mut ac_meta_ci: Vec<AcMeta> = Vec::new();
    for (line_idx, lit) in literal_specs.iter() {
        ac_patterns.push(lit.as_str());
        // What:     Compute conditional word-boundary requirements once
        //           at load time. `lit.as_bytes().first()` returns
        //           `Option<&u8>` (None on empty string, but
        //           `parse_rule_source` already rejects empty literals);
        //           `.copied()` turns `&u8` into `u8`; `map_or(false, ...)`
        //           gives `false` when None, otherwise applies the
        //           predicate. Same for `.last()`.
        //           Length gate: when the literal is at least
        //           `SUBSTRING_THRESHOLD` bytes long, both bounds drop
        //           to `false` -- distinctiveness from sheer length
        //           makes coincidental substring match negligible
        //           (see threshold-constant docs for the math).
        // Why:      A short acronym like a 3-char codename should not
        //           match inside random base64 noise where the same
        //           three bytes appear coincidentally. A long phrase
        //           like a 20-char codename glued mid-identifier
        //           SHOULD match because the substring is uniquely
        //           recognisable -- requiring the user to add separate
        //           "with-spaces" and "without-spaces" forms is fine,
        //           but each form must match wherever it actually
        //           appears regardless of surrounding word chars.
        // TS map:   `const boundLeft = lit.length < SUBSTRING_THRESHOLD && isWordByte(lit.charCodeAt(0));`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const longEnough = lit.length >= SUBSTRING_THRESHOLD;
        // const boundLeft  = !longEnough && lit.length > 0 && isWordByte(lit.charCodeAt(0));
        // const boundRight = !longEnough && lit.length > 0 && isWordByte(lit.charCodeAt(lit.length - 1));
        // ```
        let long_enough = lit.len() >= SUBSTRING_THRESHOLD;
        let bound_left = !long_enough
            && lit.as_bytes().first().copied().is_some_and(is_word_byte);
        let bound_right = !long_enough
            && lit.as_bytes().last().copied().is_some_and(is_word_byte);
        ac_meta.push(AcMeta::Literal { idx: *line_idx, bound_left, bound_right });
    }
    for (rule_pos, pre) in regex_prefixes.iter().enumerate() {
        if let Some((p, ci)) = pre {
            if *ci {
                ac_patterns_ci.push(p.as_str());
                ac_meta_ci.push(AcMeta::RegexPrefix { rule_pos });
            } else {
                ac_patterns.push(p.as_str());
                ac_meta.push(AcMeta::RegexPrefix { rule_pos });
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

    // Phase 2d: build the residual gate over regex rules WITHOUT an
    // extractable prefix. If every regex rule had a prefix, this is
    // empty -- and `residual_combined` becomes `None`, removing the
    // resharp lazy-DFA pass from the per-file hot path entirely.
    // What:     `regex_prefixes.iter().enumerate().filter_map(...).collect::<Vec<_>>()`
    //           collects rule positions whose prefix extraction returned
    //           `None`. `enumerate()` adds the index; `filter_map` keeps
    //           only the entries that pass a closure-returned `Option`.
    // Why:      We need both the indices (for per-rule fan-out on a
    //           gate hit) and the source strings (to build the combined
    //           residual regex).
    // TS map:   `const residualPositions = regexPrefixes.flatMap((p, i) => p === null ? [i] : []);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const residualPositions = regexPrefixes.flatMap((p, i) => p === null ? [i] : []);
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
    let residual_shards = build_residual_shards(&residual_positions, &regex_specs)?;

    Ok(RuleSet { ac, ac_meta, ac_ci, ac_meta_ci, regex_rules, residual_shards })
}

// What:     `fn build_residual_shards(positions, regex_specs) -> Result<Vec<ResidualShard>, String>`
//           shards the residual-bucket rule positions into groups, each
//           backed by one combined-alternation `Regex` gate. Starts at
//           shard size = `INITIAL_SHARD_SIZE`; on `Regex::new` failure,
//           halves the shard size and rebuilds from scratch. Floor at
//           `1` -- a single-rule "shard" reduces to `Regex::new(rule)`,
//           which already succeeded in Phase 2a, so the loop is bounded.
// Why:      Resharp's combined-regex parse cliff varies with rule
//           content (bisect: 1722 for synthetic `_RESID_` rules; could
//           be different for other shapes). A fixed constant would be
//           either too conservative (too many shards = more per-file
//           gate calls) or too aggressive (loads fail on adversarial
//           inputs). Try-and-halve self-tunes to the actual limit on
//           any given ruleset without hardcoding.
// TS map:   `function buildResidualShards(positions, regexSpecs): ResidualShard[]`.
//
// In TS you'd write (pseudocode):
// ```ts
// function buildResidualShards(positions: number[], regexSpecs: [number, string][]): ResidualShard[] {
//   let shardSize = INITIAL_SHARD_SIZE;
//   while (shardSize >= 1) {
//     try { return buildAtSize(positions, regexSpecs, shardSize); }
//     catch (e) { shardSize = Math.floor(shardSize / 2); }
//   }
//   throw new Error("unreachable: shardSize=1 cannot fail");
// }
// ```
fn build_residual_shards(
    positions: &[usize],
    regex_specs: &[(usize, String)],
) -> Result<Vec<ResidualShard>, String> {
    if positions.is_empty() {
        return Ok(Vec::new());
    }
    let mut shard_size: usize = INITIAL_SHARD_SIZE;
    let mut last_err: Option<String> = None;
    while shard_size >= 1 {
        match try_build_shards(positions, regex_specs, shard_size) {
            Ok(shards) => return Ok(shards),
            Err(e) => {
                last_err = Some(e);
                if shard_size == 1 {
                    break;
                }
                shard_size /= 2;
            }
        }
    }
    Err(last_err.unwrap_or_else(|| "residual sharding: unknown error".to_string()))
}

// What:     `fn try_build_shards(positions, regex_specs, shard_size)
//           -> Result<Vec<ResidualShard>, String>` partitions `positions`
//           into chunks of `shard_size`, builds one combined-alternation
//           `Regex` per chunk, and returns all shards or the first
//           compile error.
// Why:      Inner step of `build_residual_shards`. Kept separate so the
//           outer halving loop only contains control flow, not the
//           per-shard build details.
// TS map:   `function tryBuildShards(positions, regexSpecs, shardSize): ResidualShard[]` (throws on failure).
//
// In TS you'd write (pseudocode):
// ```ts
// function tryBuildShards(positions, regexSpecs, shardSize): ResidualShard[] {
//   const out: ResidualShard[] = [];
//   for (const chunk of chunked(positions, shardSize)) {
//     const combined = chunk.map(p => `(${regexSpecs[p][1]})`).join("|");
//     out.push({ gate: new Regex(combined), positions: [...chunk] });
//   }
//   return out;
// }
// ```
fn try_build_shards(
    positions: &[usize],
    regex_specs: &[(usize, String)],
    shard_size: usize,
) -> Result<Vec<ResidualShard>, String> {
    // What:     `positions.par_chunks(shard_size).map(...).collect::<Result<Vec<_>, _>>()`
    //           parallel-compiles one combined-alternation `Regex` per chunk
    //           via rayon. Each chunk's `Regex::new` is independent (its
    //           own parser/algebra/translator pass and its own
    //           `Mutex<RegexInner>`), so work-stealing across cores is a
    //           clean fit. `collect::<Result<Vec<_>, _>>()` short-circuits
    //           on the first error.
    // Why:      With many residual rules, the previous sequential loop
    //           dominated startup: 259 betterleaks-shape rules with the
    //           default `INITIAL_SHARD_SIZE` produced one mega-shard whose
    //           `Regex::new` cost was super-linear, AND with `shard_size=1`
    //           it produced ~200 sequential single-pattern compiles -- so
    //           neither extreme parallelised. Switching the per-shard
    //           build to `par_chunks` makes the cost scale as
    //           `total_residual_compile_cost / num_cores` regardless of
    //           shard size.
    // TS map:   `await Promise.all(chunks.map(async chunk => buildShard(chunk)))`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const shards = await Promise.all(
    //   chunked(positions, shardSize).map(chunk => buildShard(chunk))
    // );
    // ```
    let shards: Vec<ResidualShard> = positions
        .par_chunks(shard_size)
        .map(|chunk| {
            let mut combined = String::new();
            for (i, &rule_pos) in chunk.iter().enumerate() {
                if i > 0 {
                    combined.push('|');
                }
                combined.push('(');
                combined.push_str(&regex_specs[rule_pos].1);
                combined.push(')');
            }
            let gate = Regex::new(&combined).map_err(|e| {
                format!(
                    "residual shard ({} rules, shard_size={}): {:?}",
                    chunk.len(),
                    shard_size,
                    e
                )
            })?;
            Ok(ResidualShard { gate, positions: chunk.to_vec() })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(shards)
}

// What:     `const INITIAL_SHARD_SIZE: usize = 1;` is the first shard
//           size tried by `build_residual_shards`. Phase 2e
//           parallel-compiles shards via rayon, so total cost scales
//           as `(per_rule_compile * residual_count) / num_cores`
//           regardless of shard size. The choice IS a startup-cost
//           tradeoff: when the chosen size cannot compile (resharp
//           HIR-translator parse cliff on combined alternations of
//           complex rules), the try-and-halve loop pays for every
//           failed attempt before succeeding. Starting at 1 skips
//           those attempts.
// Why:      Bench-derived 2026-05-02 (PERF.md "Last benched"). On the
//           betterleaks-shape ruleset (259 rules; 40 in residual after
//           substring extraction) on Linux kernel (94k files,
//           1.5 GiB), shard sizes 1/4/16/64 produced --all wall times
//           within the same ~61-66s noise band (3 runs each). Reason:
//           the 40 residual rules CANNOT be combined into one Regex
//           on this corpus (resharp's HIR-translator rejects the
//           alternation), so auto-halving converges to 1-rule shards
//           regardless of initial size. Initial-1 has marginally
//           faster startup because it skips failed try-and-halve
//           iterations. For workloads where resharp CAN combine the
//           residual bucket (e.g. the synthetic 10k-rule corpus,
//           where the substring walker drains residual to empty),
//           shard size also doesn't matter for `--all`, so 1 is a
//           safe neutral default.
// TS map:   `const INITIAL_SHARD_SIZE = 1;`.
//
// In TS you'd write (pseudocode):
// ```ts
// const INITIAL_SHARD_SIZE = 1;
// ```
const INITIAL_SHARD_SIZE: usize = 256;
