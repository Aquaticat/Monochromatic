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

// What:     `pub enum AcMeta { Literal { idx }, RegexPrefix { rule_pos } }`
//           is the side-table value telling `scan.rs` what an AC pattern
//           id represents. `Literal` carries the user-facing rule line
//           index for direct emission. `RegexPrefix` carries an index
//           into `RuleSet.regex_rules`, signalling "this prefix being
//           seen means the matching regex rule needs its full `find_all`
//           run on this file".
// Why:      One unified AC index now scans for BOTH literal rules AND
//           required-literal prefixes of regex rules. The metadata
//           dispatch lets `scan_content` route each AC hit to the right
//           handler without a second pass. In the 99%-clean case AC
//           emits zero hits and no resharp `Regex` work happens at all.
// TS map:   `type AcMeta = { kind: "literal"; idx: number } | { kind: "regexPrefix"; rulePos: number };`.
//
// In TS you'd write (pseudocode):
// ```ts
// type AcMeta =
//   | { kind: "literal"; idx: number }
//   | { kind: "regexPrefix"; rulePos: number };
// ```
pub enum AcMeta {
    Literal { idx: usize },
    RegexPrefix { rule_pos: usize },
}

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
pub struct RuleSet {
    pub ac: Option<AhoCorasick>,
    pub ac_meta: Vec<AcMeta>,
    pub regex_rules: Vec<RegexRule>,
    pub residual_combined: Option<Regex>,
    pub residual_positions: Vec<usize>,
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
pub fn extract_required_prefix(src: &str) -> Option<String> {
    let mut s = src;

    // What:     `if let Some(rest) = s.strip_prefix("(?")` matches the
    //           inline-flags group `(?flags)` at the very start.
    //           `strip_prefix` returns `Option<&str>` -- `Some(rest)`
    //           when the prefix matched (rest = remainder), `None`
    //           otherwise.
    // Why:      Regex sources may carry leading flag groups like `(?i)`
    //           or `(?ms)`. `i` (case-insensitive) is incompatible with
    //           our case-sensitive AC index, so we bail out for those.
    //           Other flags (m, s, etc.) don't affect literal-prefix
    //           validity.
    // TS map:   `const m = s.match(/^\(\?([a-z]*)\)/);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const flagMatch = s.match(/^\(\?([a-z\-]*)\)/);
    // if (flagMatch) {
    //   if (flagMatch[1].includes("i")) return null;
    //   s = s.slice(flagMatch[0].length);
    // }
    // ```
    if let Some(rest) = s.strip_prefix("(?") {
        if let Some(end) = rest.find(')') {
            let flags = &rest[..end];
            if flags.contains('i') {
                return None;
            }
            s = &rest[end + 1..];
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
    let mut out = String::new();
    let bytes = s.as_bytes();
    let mut i = 0usize;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\\' {
            if i + 1 >= bytes.len() {
                break;
            }
            let next = bytes[i + 1];
            match next {
                b'.' | b'*' | b'+' | b'?' | b'(' | b')' | b'[' | b']' | b'{' | b'}' | b'|'
                | b'^' | b'$' | b'\\' | b'/' | b'"' | b'\'' | b'-' => {
                    out.push(next as char);
                    i += 2;
                }
                _ => break,
            }
        } else if matches!(c, b'.' | b'*' | b'+' | b'?' | b'|' | b'(' | b'[' | b'{' | b'$' | b'^')
        {
            break;
        } else {
            out.push(c as char);
            i += 1;
        }
    }

    if out.len() < MIN_PREFIX_LEN {
        return None;
    }
    Some(out)
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
    let regex_prefixes: Vec<Option<String>> = regex_specs
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
    let mut ac_patterns: Vec<&str> = Vec::new();
    let mut ac_meta: Vec<AcMeta> = Vec::new();
    for (line_idx, lit) in literal_specs.iter() {
        ac_patterns.push(lit.as_str());
        ac_meta.push(AcMeta::Literal { idx: *line_idx });
    }
    for (rule_pos, pre) in regex_prefixes.iter().enumerate() {
        if let Some(p) = pre {
            ac_patterns.push(p.as_str());
            ac_meta.push(AcMeta::RegexPrefix { rule_pos });
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

    let residual_combined: Option<Regex> = if residual_positions.is_empty() {
        None
    } else {
        let mut combined = String::new();
        for (i, &rule_pos) in residual_positions.iter().enumerate() {
            if i > 0 {
                combined.push('|');
            }
            combined.push('(');
            combined.push_str(&regex_specs[rule_pos].1);
            combined.push(')');
        }
        Some(Regex::new(&combined).map_err(|e| format!("combined regex: {:?}", e))?)
    };

    Ok(RuleSet { ac, ac_meta, regex_rules, residual_combined, residual_positions })
}
