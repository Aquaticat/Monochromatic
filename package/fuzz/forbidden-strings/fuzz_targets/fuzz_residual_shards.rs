// What:     `fuzz_residual_shards` drives `build_residual_shards`
//           with a bounded set of regex sources, asserts the
//           partition invariant (every position covered exactly
//           once), and tests the combined-gate gate-soundness
//           invariant: if any constituent regex matches the
//           content, the shard gate must NOT return `Ok(false)`.
// Why:      The residual gate is fail-open if `Ok(false)` ever
//           escapes when a member would have matched (BUG 7 in
//           `is_match`'s history); a constituent's hit must trip
//           the shard.

#![no_main]

use libfuzzer_sys::fuzz_target;

use forbidden_strings::fuzz_api::*;
use forbidden_strings_fuzz::generators::RulesetAndContent;

fuzz_target!(|input: RulesetAndContent| {
    // What:     `let mut regex_specs: Vec<(usize, String)> = Vec::new();`
    //           pairs each surviving rule with its line index. We
    //           skip rules whose source can't compile (those would
    //           panic the underlying `Regex::new` inside
    //           `try_compile_combined`).
    // Why:      `build_residual_shards` assumes every entry in
    //           `regex_specs` compiles; production guarantees this
    //           via the earlier compile phase.
    let mut regex_specs: Vec<(usize, String)> = Vec::new();
    for (i, rule) in input.rules.iter().enumerate() {
        let src = rule.render();
        // What:     `compile_rule_src(&src).is_ok() && !src.contains('&')`.
        //           Keep only rules that compile individually AND do not
        //           contain intersection (`&`).
        // Why:      `build_residual_shards` COMBINES surviving rules into
        //           a union shard (`(R1|R2|...)`). If any member contains
        //           `&`, the union is `(...|A&B|...)`, the intersection-
        //           over-alternation shape that drives resharp 0.6.x into
        //           unbounded algebra-distribution recursion (mk_union /
        //           mk_inter / attempt_rw_inter_2 / attempt_rw_union_2)
        //           and overflows the stack inside `Regex::new`
        //           (uncatchable; see doc/troubleshooting/resharp.md,
        //           "intersection over alternation"). Each member compiles
        //           alone, so the earlier filter does not catch it; the
        //           blowup is created by the combination. Drop `&`-rules
        //           from shard fuzzing: there is no safe consumer-side
        //           pre-validator (a guard broad enough to catch the
        //           overflow also rejects real rules), so this harness
        //           keeps the combination-logic coverage on the common
        //           non-intersection rules. Over-skipping (`&` even inside
        //           a class) is safe here.
        if compile_rule_src(&src).is_ok() && !src.contains('&') {
            regex_specs.push((i, src));
        }
    }

    if regex_specs.is_empty() {
        return;
    }

    // What:     `let positions: Vec<usize> = (0..regex_specs.len()).collect();`.
    //           Build a contiguous position list -- the simplest
    //           input shape `build_residual_shards` accepts and the
    //           one production always uses.
    // Why:      Cover every entry once.
    let positions: Vec<usize> = (0..regex_specs.len()).collect();

    // What:     `let shards = match build_residual_shards(&positions, &regex_specs) { ... };`.
    //           Compile failures inside the combine attempt are
    //           handled inside the function; a top-level error means
    //           the shape was genuinely malformed.
    let shards = match build_residual_shards(&positions, &regex_specs) {
        Ok(s) => s,
        Err(_) => return,
    };

    //region Invariant: every position covered exactly once

    // What:     `let mut seen: Vec<bool> = vec![false; regex_specs.len()];`
    //           per-index bag-of-seen-positions; flip to true on
    //           each visit and assert the flip is on a previously-
    //           false slot.
    // Why:      Plan §7.6: each input regex appears exactly once
    //           across shards.
    let mut seen: Vec<bool> = vec![false; regex_specs.len()];
    for shard in &shards {
        match shard {
            ResidualShard::Single { rule_pos } => {
                let p = *rule_pos;
                assert!(p < seen.len(), "Single rule_pos {} out of range", p);
                assert!(!seen[p], "position {} appears twice", p);
                seen[p] = true;
            }
            ResidualShard::Combined { positions, .. } => {
                for &p in positions {
                    assert!(p < seen.len(), "Combined position {} out of range", p);
                    assert!(!seen[p], "position {} appears twice", p);
                    seen[p] = true;
                }
            }
        }
    }
    for (i, was_seen) in seen.iter().enumerate() {
        assert!(*was_seen, "position {} missing from shards", i);
    }

    //endregion

    //region Invariant: combined gate non-false-negative

    // What:     For each Combined shard: compile every member
    //           regex, run find_all on content, see if any member
    //           matched. If yes, the shard's gate.is_match must
    //           return Ok(true) or Err(()). Ok(false) would be a
    //           fail-open regression.
    let content: &[u8] = &input.content;
    for shard in &shards {
        let ResidualShard::Combined { gate, positions } = shard else {
            continue;
        };

        let mut any_member_matches = false;
        for &p in positions {
            let src = &regex_specs[p].1;
            let Ok(compiled) = compile_rule_src(src) else {
                continue;
            };
            if let Ok(matches) = compiled.find_all(content) {
                if !matches.is_empty() {
                    any_member_matches = true;
                    break;
                }
            }
        }

        if any_member_matches {
            // Gate must NOT return Ok(false).
            let gate_result = gate.is_match(content);
            match gate_result {
                Ok(true) => {
                    // expected
                }
                Err(_) => {
                    // engine error is acceptable (caller falls back
                    // to per-member evaluation -- BUG 7's fix)
                }
                Ok(false) => {
                    panic!(
                        "residual shard gate is fail-open: member regex matched \
                         but Combined gate returned Ok(false)\n\
                         positions = {:?}\n\
                         content_len = {}",
                        positions,
                        content.len(),
                    );
                }
            }
        }
    }

    //endregion
});
