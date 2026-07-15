//! rules shards support for the forbidden-strings scanner.
/// Imports dependencies used by this module.
use resharp::Regex;

/// Imports dependencies used by this module.
// What:     `use anyhow::Result;` imports `anyhow`'s one-parameter result alias.
// Why:      `build_residual_shards` preserves the loader's fallible API shape even
//           though the current greedy implementation cannot fail.
//
// In TS you'd write (pseudocode):
// ```ts
// type Result<T> = T; // failures throw Error objects
// ```
use anyhow::Result;

/// Imports dependencies used by this module.
use super::engine::{requires_resharp, CompiledRegex};
/// Imports dependencies used by this module.
use super::types::ResidualShard;

/// Implements `build_residual_shards`.
// What:     `pub fn build_residual_shards(positions, regex_specs) -> Result<Vec<ResidualShard>>`
//           is the public entry point. Delegates to `greedy_combine`,
//           which returns `Vec<ResidualShard>` infallibly: the recursion
//           bottoms at `ResidualShard::Single`, and Single shards do not
//           require a fresh `Regex::new` (they reuse the already-compiled
//           regex from Phase 2a). The `Result` return type is preserved
//           for API compatibility with callers that already match on
//           `load_ruleset`'s overall Result.
// Why:      Wrapping the infallible inner work in an outer `Result` keeps
//           `rule.rs::load_ruleset` composition unchanged.
//
// In TS you'd write (pseudocode):
// ```ts
// function buildResidualShards(positions: number[], regexSpecs: [number, string][]): ResidualShard[] {
//   if (positions.length === 0) return [];
//   return greedyCombine(positions, regexSpecs);
// }
// ```
pub fn build_residual_shards(
    positions: &[usize],
    regex_specs: &[(usize, String)],
) -> Result<Vec<ResidualShard>> {
    if positions.is_empty() {
        return Ok(Vec::new());
    }
    let timing = std::env::var("FORBIDDEN_STRINGS_DEBUG_TIMING").is_ok();
    let t = std::time::Instant::now();
    // What:     Below `GREEDY_COMBINE_THRESHOLD` rules, skip the greedy
    //           partition entirely and emit one `Single` per position.
    //           Above the threshold, fall through to `greedy_combine`'s
    //           recursive divide-and-conquer.
    // Why:      Bench-validated 2026-05-03 on Mono with 4 residuals
    //           (L114 beamer, L251 facebook, L769 twitch, L796 vercel-ai
    //           gateway). All 4 do compile into a single Combined gate
    //           (the handover's "uncombinable" claim was wrong), but
    //           shipping that combined gate REGRESSES Mono `--all` by
    //           +86 ms (650 ms -> 736 ms, well past the 28 ms hyperfine
    //           sigma). Root cause: each individual rule has a strong
    //           literal-prefix anchor (`SK`, `Q~`, `\d{15,16}`, `hvs.`)
    //           that the regex crate's literal-prefix optimisation
    //           accelerates with memchr/Teddy. Combined into one big
    //           alternation, the union of those prefixes is too disparate
    //           for the optimisation; per-byte scan cost goes up by ~24us
    //           per file, which over 2700 Mono files dominates the +20 ms
    //           saved on the Combined-gate compile.
    //           Threshold = 16 puts Mono firmly on the all-Singles path
    //           while leaving the combine path ready for residual buckets
    //           where the savings exceed the literal-optimisation loss
    //           (large counts of betterleaks-shape rules where individual
    //           rules already lack a usable literal prefix -- otherwise
    //           the AC walker would have drained them).
    if positions.len() < GREEDY_COMBINE_THRESHOLD {
        let shards: Vec<ResidualShard> = positions
            .iter()
            .map(|&p| ResidualShard::Single { rule_pos: p })
            .collect();
        if timing {
            let dt = t.elapsed().as_secs_f64() * 1000.0;
            // eprintln, not tracing: an env-gated (FORBIDDEN_STRINGS_DEBUG_TIMING) timing report
            // line, kept as a cohesive indented direct-stderr dump.
            eprintln!(
                "  build_residual_shards: {} positions (< {} threshold) -> {} singles in {:.1}ms",
                positions.len(), GREEDY_COMBINE_THRESHOLD, shards.len(), dt,
            );
        }
        return Ok(shards);
    }
    let shards = greedy_combine(positions, regex_specs);
    if timing {
        let dt = t.elapsed().as_secs_f64() * 1000.0;
        let n_combined = shards
            .iter()
            .filter(|s| matches!(s, ResidualShard::Combined { .. }))
            .count();
        let n_single = shards.len() - n_combined;
        // eprintln, not tracing: the same env-gated (FORBIDDEN_STRINGS_DEBUG_TIMING) timing
        // report, kept as a cohesive indented direct-stderr dump.
        eprintln!(
            "  greedy_combine: {} positions -> {} shards ({} combined, {} single) in {:.1}ms",
            positions.len(), shards.len(), n_combined, n_single, dt,
        );
    }
    Ok(shards)
}

/// Defines the `GREEDY_COMBINE_THRESHOLD` constant.
// What:     `GREEDY_COMBINE_THRESHOLD` is the residual-count above which
//           `build_residual_shards` runs the divide-and-conquer
//           greedy_combine. Below it, every position is emitted as a
//           `Single` shard with no combine attempt.
// Why:      For small residual counts (Mono: 4), the per-rule literal-
//           prefix optimisation in the `regex` crate beats a combined
//           gate; the bench-derived choice of 16 leaves Mono on the
//           Singles path while admitting Combined for larger residual
//           buckets where the trade flips. See the comment block on
//           `build_residual_shards` for the bench data.
//
// In TS you'd write (pseudocode):
// ```ts
// const GREEDY_COMBINE_THRESHOLD = 16;
// ```
const GREEDY_COMBINE_THRESHOLD: usize = 16;

/// Implements `greedy_combine`.
// What:     `fn greedy_combine(positions, regex_specs) -> Vec<ResidualShard>`
//           is a recursive divide-and-conquer partitioner. For each slice:
//             - len == 0: empty.
//             - len == 1: one `ResidualShard::Single` (no compile).
//             - len >= 2: try compiling all positions into a single
//               combined-alternation gate. On success, return one
//               `ResidualShard::Combined` covering the whole slice. On
//               failure, split in half and recurse on each half in
//               parallel via `rayon::join`.
// Why:      Replaces the previous `try_build_shards` halving loop, which
//           was all-or-nothing: a single combined-compile failure forced
//           a global retry at half the shard size, wasting all successful
//           compiles at the larger size. Greedy partitioning keeps every
//           successful sub-combine and only re-partitions failed
//           sub-slices, producing fewer/larger shards on workloads where
//           SOME but not all rules are combinable.
//           Failure mode: when no rules combine (current Mono ruleset:
//           4 residuals, all hard-shape betterleaks rules), we pay
//           log2(N) levels of failed combine attempts before bottoming
//           out at all-Singles. With N=4 that's at most 3 failed
//           attempts (1 at level 0 + 2 parallel at level 1), bounded
//           by the 28ms hyperfine σ on the Mono baseline -- empirically
//           invisible. For workloads where many combines succeed, greedy
//           wins by reducing per-file scan to one gate.is_match per
//           shard instead of one find_all per rule.
//
// In TS you'd write (pseudocode):
// ```ts
// function greedyCombine(positions: number[], regexSpecs: [number, string][]): ResidualShard[] {
//   if (positions.length === 0) return [];
//   if (positions.length === 1) return [{ kind: "single", rulePos: positions[0] }];
//   const gate = tryCompileCombined(positions, regexSpecs);
//   if (gate) return [{ kind: "combined", gate, positions: [...positions] }];
//   const mid = Math.floor(positions.length / 2);
//   return [
//     ...greedyCombine(positions.slice(0, mid), regexSpecs),
//     ...greedyCombine(positions.slice(mid), regexSpecs),
//   ];
// }
// ```
fn greedy_combine(
    positions: &[usize],
    regex_specs: &[(usize, String)],
) -> Vec<ResidualShard> {
    if positions.is_empty() {
        return Vec::new();
    }
    if positions.len() == 1 {
        return vec![ResidualShard::Single { rule_pos: positions[0] }];
    }
    if let Some(gate) = try_compile_combined(positions, regex_specs) {
        return vec![ResidualShard::Combined { gate, positions: positions.to_vec() }];
    }
    let mid = positions.len() / 2;
    // What:     `rayon::join(left_closure, right_closure)` runs both
    //           closures, returning a tuple of their results once both
    //           finish. Work-stealing across the rayon pool means that
    //           if one half is much slower (more failed combine attempts
    //           inside the recursion), the other half's idle workers
    //           help process its remaining work.
    // Why:      Recursive halves are independent (disjoint position
    //           slices, disjoint regex_specs reads), so rayon::join is
    //           the natural fit. Each level of the recursion can
    //           parallelize across cores instead of serializing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [left, right] = await Promise.all([
    //   greedyCombine(positions.slice(0, mid), regexSpecs),
    //   greedyCombine(positions.slice(mid), regexSpecs),
    // ]);
    // ```
    let (mut left, right) = rayon::join(
        || greedy_combine(&positions[..mid], regex_specs),
        || greedy_combine(&positions[mid..], regex_specs),
    );
    left.extend(right);
    left
}

/// Implements `try_compile_combined`.
// What:     `fn try_compile_combined(chunk, regex_specs) -> Option<CompiledRegex>`
//           builds a combined-alternation source for `chunk` (joining
//           each rule's regex source with `|`, wrapping each in parens),
//           dispatches to resharp or regex via the same hybrid-engine
//           rule used for individual rules (`requires_resharp` shallow
//           string scan), and returns the compiled gate or `None` on
//           parse/algebra/HIR-translator failure.
// Why:      The combined alternation can fail on resharp when the union
//           triggers HIR-translator UnsupportedPattern errors (e.g. the
//           bisect-derived 1722 rule cliff for synthetic `_RESID_`
//           shapes). A `None` return signals the caller to recurse with
//           a smaller slice rather than aborting the whole load.
//
// In TS you'd write (pseudocode):
// ```ts
// function tryCompileCombined(chunk: number[], regexSpecs: [number, string][]): Regex | null {
//   const combined = chunk.map(p => `(${regexSpecs[p][1]})`).join("|");
//   try { return new Regex(combined); }
//   catch { return null; }
// }
// ```
fn try_compile_combined(
    chunk: &[usize],
    regex_specs: &[(usize, String)],
) -> Option<CompiledRegex> {
    let mut combined = String::new();
    for (i, &rule_pos) in chunk.iter().enumerate() {
        if i > 0 {
            combined.push('|');
        }
        combined.push('(');
        combined.push_str(&regex_specs[rule_pos].1);
        combined.push(')');
    }
    let any_requires_resharp = chunk
        .iter()
        .any(|&rp| requires_resharp(&regex_specs[rp].1));
    if any_requires_resharp {
        Regex::new(&combined).ok().map(CompiledRegex::Resharp)
    } else {
        // Try unicode-off for the speedup; fall back to unicode-on if
        // any rule in the chunk requires unicode semantics (e.g.
        // `\p{...}`, multi-byte chars in `[...]` classes). Mirrors
        // the per-rule compile in `rule.rs::compile_plain_rule`.
        if let Ok(re) = regex::bytes::RegexBuilder::new(&combined)
            .unicode(false)
            .size_limit(256 * 1024 * 1024)
            .dfa_size_limit(256 * 1024 * 1024)
            .build()
        {
            return Some(CompiledRegex::Plain(re));
        }
        regex::bytes::RegexBuilder::new(&combined)
            .unicode(true)
            .size_limit(256 * 1024 * 1024)
            .dfa_size_limit(256 * 1024 * 1024)
            .build()
            .ok()
            .map(CompiledRegex::Plain)
    }
}
