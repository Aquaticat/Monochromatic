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
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Closest: the `index.ts` barrel-export pattern.
// ```
mod atom;
mod compile;
mod engine;
mod extract;
mod nesting;
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
#[cfg(test)]
mod nesting_tests;

// What:     Public surface re-exports so external callers (`scan.rs`,
//           `main.rs`) can keep using `crate::rules::Foo` without
//           knowing which submodule actually defines `Foo`.
// Why:      Preserves the existing `crate::rules::*` API. Renaming
//           call sites would have been a massive diff for no benefit.
//
// In TS you'd write (pseudocode):
// ```ts
// export { CompiledRegex, ScanMatch, requiresResharp } from "./rules/engine";
// ```
pub use compile::compile_rule_src;
pub use engine::{
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
    quantified_lookahead_with_sibling_content,
    requires_resharp,
    stacked_quantifier,
    CompiledRegex,
};
pub use nesting::nesting_depth;
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
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Imagine a hypothetical:
// // import { parIter } from "rayon-like-pool";
// ```
use rayon::prelude::*;

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
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { ac, acMeta, acCi, acMetaCi, regexRules, residualShards };
    // ```
    Ok(RuleSet { ac, ac_meta, ac_ci, ac_meta_ci, regex_rules, residual_shards })
}
