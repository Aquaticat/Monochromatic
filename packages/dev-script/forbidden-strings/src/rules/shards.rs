use rayon::prelude::*;
use resharp::Regex;

use super::engine::{uses_set_algebra, CompiledRegex};
use super::types::ResidualShard;

// What:     `pub fn build_residual_shards(positions, regex_specs) -> Result<Vec<ResidualShard>, String>`
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
pub fn build_residual_shards(
    positions: &[usize],
    regex_specs: &[(usize, String)],
) -> Result<Vec<ResidualShard>, String> {
    if positions.is_empty() {
        return Ok(Vec::new());
    }
    let timing = std::env::var("FORBIDDEN_STRINGS_DEBUG_TIMING").is_ok();
    let mut shard_size: usize = INITIAL_SHARD_SIZE;
    let mut last_err: Option<String> = None;
    while shard_size >= 1 {
        let t = std::time::Instant::now();
        let result = try_build_shards(positions, regex_specs, shard_size);
        let dt = t.elapsed().as_secs_f64() * 1000.0;
        let n_chunks = positions.len().div_ceil(shard_size);
        match result {
            Ok(shards) => {
                if timing {
                    eprintln!(
                        "  try shard_size={} ({} chunks): SUCCESS in {:.1}ms",
                        shard_size, n_chunks, dt,
                    );
                }
                return Ok(shards);
            }
            Err(e) => {
                if timing {
                    eprintln!(
                        "  try shard_size={} ({} chunks): FAIL in {:.1}ms err={}",
                        shard_size, n_chunks, dt, e,
                    );
                }
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
    // What:     For chunks of size 1, emit `ResidualShard::Single` with
    //           just the rule position. The rule's compiled Regex
    //           already lives in `regex_rules` (Phase 2a) and the
    //           scanner reuses it directly; building a separate gate
    //           here would compile the same pattern AGAIN (parser +
    //           algebra + lazy DFA setup), doubling Phase 2e cost.
    //           For chunks of size > 1, build the combined-alternation
    //           gate as before.
    // Why:      The redundant single-rule gate is the dominant Phase 2e
    //           cost on the betterleaks corpus: 28 single-rule shards
    //           × ~17ms per Regex::new = ~485ms. Eliminating it makes
    //           Phase 2e a near-zero-cost step for the size=1 success
    //           path. Combined chunks (when resharp accepts the union)
    //           still need a fresh Regex::new because the combined
    //           regex IS new -- not stored anywhere else.
    // TS map:   `chunk.length === 1 ? { kind: "single", rulePos: chunk[0] } : { kind: "combined", gate: new Regex(combined), positions: [...chunk] }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (chunk.length === 1) return { kind: "single", rulePos: chunk[0] };
    // // else build combined gate
    // ```
    let shards: Vec<ResidualShard> = positions
        .par_chunks(shard_size)
        .map(|chunk| -> Result<ResidualShard, String> {
            if chunk.len() == 1 {
                return Ok(ResidualShard::Single { rule_pos: chunk[0] });
            }
            let mut combined = String::new();
            for (i, &rule_pos) in chunk.iter().enumerate() {
                if i > 0 {
                    combined.push('|');
                }
                combined.push('(');
                combined.push_str(&regex_specs[rule_pos].1);
                combined.push(')');
            }
            // Hybrid engine dispatch for the combined gate: if ANY
            // rule in the chunk uses set-algebra, the combined source
            // also does, so the gate must compile via resharp.
            // Otherwise compile via regex (faster).
            let any_set_algebra = chunk
                .iter()
                .any(|&rp| uses_set_algebra(&regex_specs[rp].1));
            let gate = if any_set_algebra {
                let g = Regex::new(&combined).map_err(|e| {
                    format!(
                        "residual shard ({} rules, shard_size={}, resharp): {:?}",
                        chunk.len(),
                        shard_size,
                        e
                    )
                })?;
                CompiledRegex::Resharp(g)
            } else {
                let g = regex::bytes::RegexBuilder::new(&combined)
                    .size_limit(256 * 1024 * 1024)
                    .dfa_size_limit(256 * 1024 * 1024)
                    .build()
                    .map_err(|e| {
                        format!(
                            "residual shard ({} rules, shard_size={}, regex): {:?}",
                            chunk.len(),
                            shard_size,
                            e
                        )
                    })?;
                CompiledRegex::Plain(g)
            };
            Ok(ResidualShard::Combined { gate, positions: chunk.to_vec() })
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
const INITIAL_SHARD_SIZE: usize = 1;
