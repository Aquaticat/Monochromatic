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

// What:     Public surface re-exports so external callers (`scan.rs`,
//           `main.rs`) can keep using `crate::rules::Foo` without
//           knowing which submodule actually defines `Foo`.
// Why:      Preserves the existing `crate::rules::*` API. Renaming
//           call sites would have been a massive diff for no benefit.
// TS map:   `export { Foo } from "./rules/foo";`.
//
// In TS you'd write (pseudocode):
// ```ts
// export { CompiledRegex, ScanMatch, usesSetAlgebra } from "./rules/engine";
// ```
pub use engine::{uses_set_algebra, CompiledRegex};
pub use extract::extract_gating_substrings;
pub use parse::{parse_rule_source, ParsedRule};
pub use shards::build_residual_shards;
pub use types::{is_word_byte, AcMeta, RegexRule, ResidualShard, RuleSet, SUBSTRING_THRESHOLD};

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
//           routing decision via `uses_set_algebra`.
// TS map:   `import { Regex } from "resharp";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Regex } from "resharp";
// ```
use resharp::Regex;

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
fn compile_plain_rule(src: &str, idx: usize) -> Result<RegexRule, String> {
    if let Ok(re) = regex::bytes::RegexBuilder::new(src)
        .unicode(false)
        .size_limit(256 * 1024 * 1024)
        .dfa_size_limit(256 * 1024 * 1024)
        .build()
    {
        return Ok(RegexRule { idx, re: CompiledRegex::Plain(re) });
    }
    // Fall back to unicode-aware mode for rules with unicode features.
    regex::bytes::RegexBuilder::new(src)
        .unicode(true)
        .size_limit(256 * 1024 * 1024)
        .dfa_size_limit(256 * 1024 * 1024)
        .build()
        .map(|re| RegexRule { idx, re: CompiledRegex::Plain(re) })
        .map_err(|e| format!("rule on line {} (regex): {:?}", idx, e))
}

pub fn load_ruleset(path: &str) -> Result<RuleSet, String> {
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

    let content = fs::read_to_string(path)
        .map_err(|e| format!("read rules {}: {}", path, e))?;
    phase("0 read_rules_file");

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
    // Hybrid engine dispatch: rules without resharp set-algebra
    // (`A&B` / `~(A)`) compile via the `regex` crate (~100x faster
    // than resharp on equivalent patterns); rules WITH set-algebra
    // stay on resharp. The classification is a shallow string scan
    // (`uses_set_algebra`) -- no parser invocation -- so the
    // dispatch itself is essentially free.
    //
    // The regex builder bumps size_limit / dfa_size_limit because
    // a few corpus rules with large bounded repetitions (e.g.
    // `hvb\.[\w-]{138,300}`) compile to NFA/DFA sizes above the
    // default 10 MiB cap. 256 MiB has room for any realistic
    // secret-detection pattern in practice; this is RAM, not disk,
    // so the cap is per-process and disposed when the scanner exits.
    let regex_rules: Vec<RegexRule> = regex_specs
        .par_iter()
        .map(|(idx, src)| {
            if uses_set_algebra(src) {
                Regex::new(src)
                    .map(|re| RegexRule { idx: *idx, re: CompiledRegex::Resharp(re) })
                    .map_err(|e| format!("rule on line {} (resharp): {:?}", idx, e))
            } else {
                compile_plain_rule(src, *idx)
            }
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
    phase("4 residual_shards");

    Ok(RuleSet { ac, ac_meta, ac_ci, ac_meta_ci, regex_rules, residual_shards })
}
