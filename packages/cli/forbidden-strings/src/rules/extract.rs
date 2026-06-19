//! rules extract support for the forbidden-strings scanner.
/// Imports dependencies used by this module.
use super::walker::extract_scope;

/// Defines the `MIN_PREFIX_LEN` constant.
// What:     Minimum byte length of an extracted regex prefix. Anything
//           shorter is dropped from the unified AC index because short
//           prefixes (like "a" or "to") fire on every file and defeat
//           the gate's whole purpose.
// Why:      The AC gate is meant to skip work on no-match files. A
//           1-byte "prefix" matches almost everywhere, queueing the
//           full regex `find_all` for nothing.
//
// In TS you'd write (pseudocode):
// ```ts
// const MIN_PREFIX_LEN = 3;
// ```
// 2026-05-03: lowered from 4 -> 3 after bench. Drains 13 of 28 residual
// rules whose leading literal is exactly 3 chars (`xox`, `pat`, `sat`,
// `ghu`/`ghs`, `r8_`, `hf_`, `SG.`, `EAA`, `.ey`, `A3-`, `A3T`). The
// trade-off is more spurious AC fires for files containing those 3-byte
// substrings (e.g. `xox` appears in code as substrings of `xxxoxxx`),
// each fire enqueues a `find_all` -- but `find_all` on a clean file is
// 5-10 us per rule, and these 3-byte substrings are rare in non-secret
// content. Net win: ~13 fewer unconditional residual scans per file,
// and the AC build / per-file scan cost grows negligibly. Two-byte
// prefixes (`SK`, `s.`) are NOT drained because they're common enough in
// real code (`static`, `sk`, `s.something`) that the spurious-AC-fire
// cost exceeds the residual-scan saving.
pub const MIN_PREFIX_LEN: usize = 3;

/// Implements `extract_gating_substrings`.
// What:     `pub fn extract_gating_substrings(src: &str) -> Option<Vec<(String, bool)>>`
//           returns a Vec of (substring, ci) pairs such that ANY successful
//           regex match must contain AT LEAST ONE of them. The `ci` flag
//           is per-substring -- determined by the scoped-flag context
//           active at the point of extraction. A `(?i:body)` scope
//           tags its substrings ci=true; a `(?-i:body)` scope tags
//           them ci=false; absent flag context inherits from the
//           outer rule's leading `(?i)` strip (default false).
//           Returns `None` if the regex cannot be soundly
//           gated -- e.g. a top-level alternation where one branch has
//           no required substring at all, or the longest substring per
//           branch falls below `MIN_PREFIX_LEN`.
// Why:      The previous "single longest required prefix" walker missed
//           the betterleaks rule shape `(?i)[\w.-]{0,50}(?:cohere|CO_API_KEY)...`,
//           where the body of a required group is itself a literal
//           alternation. With multi-substring gating, EACH alternation
//           branch contributes its own AC pattern; all of them are
//           registered against the SAME `rule_pos`. AC firing for any
//           one of them queues the rule's full `find_all`. The "rule
//           fires if any AC pattern in its set matches" semantics
//           drains alternation-shape rules out of the residual gate
//           and onto the AC fast path. PERF.md "Open opportunities".
//
// In TS you'd write (pseudocode):
// ```ts
// function extractGatingSubstrings(src: string): Array<{ sub: string; ci: boolean }> | null {
//   // 1. Strip leading `(?flags)`; record `ci` as the outer-scope context.
//   // 2. Strip leading anchors `^`, `\b`, `\A`.
//   // 3. Recurse via extractScope on the remainder, threading `ci` through
//   //    so scoped-flag groups can override it for their bodies.
//   // 4. Reject if any returned substring is shorter than MIN_PREFIX_LEN.
// }
// ```
//
// Soundness contract: every returned substring must be valid UTF-8
// whose bytes match exactly what the original regex source would
// expect to find in file content. A regex literal `—` (em-dash,
// `\xe2\x80\x94`) MUST yield a substring whose `.as_bytes()` is
// `[0xe2, 0x80, 0x94]` -- NOT mojibake from per-byte casts.
// Aho-Corasick searches the file's raw bytes; if the registered
// pattern doesn't byte-for-byte match what the regex would match,
// the AC gate becomes a one-way trap-door: AC never fires, the
// regex's `find_all` is never invoked, and the rule is silently
// disabled while still appearing on the "fast path" (because a
// non-empty extraction excludes the rule from the residual gate).
// See `walk_literal_bytes` in `atom.rs` for the walker that must
// uphold this contract.
pub fn extract_gating_substrings(src: &str) -> Option<Vec<(String, bool)>> {
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
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const flagMatch = s.match(/^\(\?([a-zA-Z\-]*)\)/);
    // if (flagMatch) {
    //   if (flagMatch[1].includes("i")) ci = true;
    //   s = s.slice(flagMatch[0].length);
    // }
    // ```
    if let Some(rest) = s.strip_prefix("(?")
        && let Some(end) = rest.find(')') {
            let flags = &rest[..end];
            // Flag-group bodies are `[a-zA-Z-]*` only. If we see
            // anything else (`:`, `[`, etc.), this is not a flag-group
            // and we should not consume past `)`.
            let is_flag_group = !flags.is_empty()
                && flags.chars().all(|c| c.is_ascii_alphabetic() || c == '-');
            if is_flag_group {
                // What:     `if flags.contains('u') { return None; }`.
                //           Leading `(?u)` (or `(?iu)`, `(?ui)`, any flag
                //           set containing `u`) enables Unicode-aware
                //           regex semantics. When combined with `(?i)`,
                //           case-folding becomes Unicode-aware (É <-> é).
                //           The AC-CI bucket uses aho-corasick's
                //           `ascii_case_insensitive(true)` which only
                //           folds ASCII letters, so a Unicode-cased
                //           variant in file content would not fire the
                //           gate. Plain `(?u)` without `(?i)` is fine in
                //           principle (literal extraction is byte-
                //           verbatim and Unicode mode does not enable
                //           case-folding by itself), but the simplest
                //           safe fix is to skip extraction for ANY `u`
                //           flag and let the residual resharp scan run
                //           the rule. The conservative drop avoids
                //           subtle cases where a future change to the
                //           extraction walker might intersect with `u`
                //           semantics; the perf cost is bounded because
                //           `u`-flagged rules are rare in the bundled
                //           corpus.
                // Why:      Closes BUG 2: pre-fix, `(?iu)cafésecret`
                //           registered `cafésecret` into the AC-CI
                //           bucket; a file containing `CAFÉSECRET`
                //           never fired the gate, the regex's find_all
                //           was never invoked, and the rule silently
                //           missed.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (flags.includes('u')) return null;
                // ```
                if flags.contains('u') {
                    return None;
                }
                if flags.contains('i') {
                    ci = true;
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

    // What:     `extract_scope(s)` is the workhorse that splits any
    //           top-level alternation in `s` into branches and recurses.
    //           Each branch returns its best required-substring set;
    //           branches are concatenated (AC fires the rule if ANY of
    //           the union appears).
    // Why:      Top-level wrapper handles the once-per-rule concerns
    //           (flag-group strip, anchor strip, MIN_PREFIX_LEN filter).
    //           The actual walk lives in `extract_scope` so it can
    //           recurse from inside a group body without re-stripping
    //           outer-only constructs.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractScope(s);
    // if (subs === null) return null;
    // if (subs.some((p) => p.length < MIN_PREFIX_LEN)) return null;
    // return { subs, ci };
    // ```
    let subs = extract_scope(s, ci)?;
    if subs.is_empty() {
        return None;
    }
    // What:     Soundness rule: if ANY substring in the gate set is
    //           below `MIN_PREFIX_LEN`, drop the rule into residual.
    //           A short substring fires AC too often, defeating the
    //           gate's purpose; AND because the alternation needs to
    //           be COVERED entirely (one substring per branch), we
    //           cannot just filter out the short ones -- doing so
    //           would leave that branch ungated, breaking the
    //           soundness contract that any successful match contains
    //           at least one registered substring.
    // Why:      Better to let resharp handle the whole rule than to
    //           emit an AC pattern that fires constantly while still
    //           missing matches.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (subs.some((p) => p.sub.length < MIN_PREFIX_LEN)) return null;
    // ```
    if subs.iter().any(|(p, _)| p.len() < MIN_PREFIX_LEN) {
        return None;
    }
    Some(subs)
}
