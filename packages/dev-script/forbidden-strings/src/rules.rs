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

// What:     `pub struct RuleSet { ... }` is the top-level rules
//           container produced by `load_ruleset` and consumed by
//           `scan_content`. It packages both rule engines plus the
//           pattern-id-to-line-index map needed to translate AC's
//           internal pattern ids back to user-facing rule numbers.
// Why:      One owned bundle holds everything the scan path needs. We
//           build it once at startup and share it across all scan
//           threads via `&RuleSet` (Sync because all fields are Sync).
// TS map:   `type RuleSet = { ac: AhoCorasick | null; literalIndices: number[]; regexRules: readonly RegexRule[]; regexCombined: Regex | null };`.
//
// In TS you'd write (pseudocode):
// ```ts
// type RuleSet = {
//   ac: AhoCorasick | null;
//   literalIndices: number[];
//   regexRules: readonly RegexRule[];
//   regexCombined: Regex | null;
// };
// ```
pub struct RuleSet {
    pub ac: Option<AhoCorasick>,
    pub literal_indices: Vec<usize>,
    pub regex_rules: Vec<RegexRule>,
    pub regex_combined: Option<Regex>,
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

    // Phase 2a: build the AC automaton over literals. AC build itself
    // is internal; one call. Whether we have any literals at all
    // determines whether `ac` is `Some`.
    let ac: Option<AhoCorasick> = if literal_specs.is_empty() {
        None
    } else {
        // What:     `literal_specs.iter().map(|(_, l)| l.as_str()).collect::<Vec<&str>>()`
        //           produces a Vec of borrowed `&str` views into the
        //           owned literal strings. `_` ignores the index in
        //           the destructure.
        // Why:      `AhoCorasick::new` accepts `&[impl AsRef<[u8]>]`;
        //           a Vec of `&str` satisfies that.
        // TS map:   `literalSpecs.map(([, l]) => l)`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const pats = literalSpecs.map(([, l]) => l);
        // ```
        let pats: Vec<&str> = literal_specs.iter().map(|(_, l)| l.as_str()).collect();
        Some(AhoCorasick::new(&pats).map_err(|e| format!("ac build: {}", e))?)
    };
    let literal_indices: Vec<usize> = literal_specs.iter().map(|(i, _)| *i).collect();

    // Phase 2b: parallel-compile the regex bucket. Each `Regex::new`
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

    // Phase 2c: build the combined-over-regex-bucket gate (only when
    // we have regex rules at all). After P1, this combined alternation
    // covers only the regex bucket -- typically a small fraction of
    // total rules -- so its compile time is much smaller than the
    // pre-P1 "combined over everything" version.
    let regex_combined: Option<Regex> = if regex_specs.is_empty() {
        None
    } else {
        let mut combined = String::new();
        for (i, (_, src)) in regex_specs.iter().enumerate() {
            if i > 0 {
                combined.push('|');
            }
            combined.push('(');
            combined.push_str(src);
            combined.push(')');
        }
        Some(Regex::new(&combined).map_err(|e| format!("combined regex: {:?}", e))?)
    };

    Ok(RuleSet { ac, literal_indices, regex_rules, regex_combined })
}
