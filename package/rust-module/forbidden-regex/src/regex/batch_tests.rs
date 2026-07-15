// What:  unit tests for the public batch API on Regex and RegexSet.
// Why:     This file groups the batch test cases so behavior changes fail near the code path
//          they protect.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("batch", () => {
//   // test cases below
// });
// ```

use crate::{RegexSet, compile};

// What:    A spread of lines: matches, misses, substring hits, varied lengths, ragged count.
// Why:     The program needs this named step so callers can reuse the behavior without copying
//          its body.
//
// In TS you'd write (pseudocode):
// ```ts
// function sample_lines(): Uint8Array[] {
//   // Rust body below is the implementation.
// }
// ```
fn sample_lines() -> Vec<&'static [u8]> {
    vec![
        b"AKIA2345",
        b"nothing to see",
        b"prefix AKIAZ7Q9 suffix",
        b"",
        b"AKIA",
        b"short",
        b"trailing AKIA6789",
        b"another miss entirely",
        b"AKIA0000",
        b"x",
        b"zzzzzzzzzzzzzzzzzAKIA2222",
    ]
}

#[test]
fn regex_batch_equals_per_line_is_match() {
    let re = compile("AKIA[A-Z2-7]{4}").expect("compiles");
    let lines = sample_lines();
    let oracle: Vec<bool> = lines.iter().map(|line| re.is_match(line)).collect();
    assert_eq!(re.is_match_batch(&lines), oracle);
}

#[test]
fn regex_batch_kernels_all_agree() {
    // What:    The seedless full-scan path exercises the batch kernels; force each hook and
    //          confirm they agree with the per-line oracle.
    // Why:     The test uses this setup or assertion to pin the behavior named by the test
    //          function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // Same step as the Rust statement below, written with ordinary TS objects/functions.
    // ```
    let re = compile(r"[A-Za-z0-9]{6}").expect("compiles");
    let lines = sample_lines();
    let oracle: Vec<bool> = lines.iter().map(|line| re.is_match(line)).collect();
    assert_eq!(re.is_match_batch_scalar(&lines), oracle, "scalar");
    assert_eq!(re.is_match_batch_interleaved(&lines), oracle, "interleaved");
    assert_eq!(re.is_match_batch(&lines), oracle, "default");
}

#[test]
fn regexset_batch_equals_per_line_is_match() {
    let set = RegexSet::new(&["AKIA[A-Z2-7]{4}", "secret", "^#deny"]).expect("compiles");
    let lines = sample_lines();
    let oracle: Vec<bool> = lines.iter().map(|line| set.is_match(line)).collect();
    assert_eq!(set.is_match_batch(&lines), oracle);
}

#[test]
fn batch_handles_empty_input() {
    let re = compile("AKIA[A-Z2-7]{4}").expect("compiles");
    assert!(re.is_match_batch(&[]).is_empty());
    assert!(re.is_match_batch_bucketed(&[]).is_empty());
    let set = RegexSet::new(&["secret"]).expect("compiles");
    assert!(set.is_match_batch(&[]).is_empty());
}

#[test]
fn default_batch_routes_large_seedless_batch_through_sheng() {
    // What:    Over the Sheng floor (512) and seedless + table + <=64 states, so the default
    //          is_match_batch takes the permute kernel; its verdicts must equal per-line
    //          is_match.
    // Why:     The test uses this setup or assertion to pin the behavior named by the test
    //          function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // Same step as the Rust statement below, written with ordinary TS objects/functions.
    // ```
    let re = compile("[0-9a-f]{8}").expect("compiles");
    let base: Vec<&[u8]> = vec![b"deadbeef", b"not hex here", b"cafef00d", b"xyz", b"0123abcd", b""];
    let lines: Vec<&[u8]> = base.iter().cycle().take(700).copied().collect();
    let oracle: Vec<bool> = lines.iter().map(|line| re.is_match(line)).collect();
    assert_eq!(re.is_match_batch(&lines), oracle);
}

#[test]
fn bucketed_batch_equals_per_line_across_lengths() {
    // What:    The bucketed path groups by exact length, runs the tight kernel per bucket, and
    //          scatters back; the result must equal per-line is_match regardless of input
    //          order.
    // Why:     The test uses this setup or assertion to pin the behavior named by the test
    //          function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // Same step as the Rust statement below, written with ordinary TS objects/functions.
    // ```
    for pattern in ["[0-9a-f]{8}", "AKIA[A-Z2-7]{4}", r"\bcat\b"] {
        let re = compile(pattern).expect("compiles");
        let lines = sample_lines();
        let oracle: Vec<bool> = lines.iter().map(|line| re.is_match(line)).collect();
        assert_eq!(re.is_match_batch_bucketed(&lines), oracle, "bucketed disagrees for {pattern}");
    }
}

#[test]
fn concat_batch_sweep_equals_per_line_is_match() {
    // What:    The concatenated-buffer gate sweep marks candidate lines by walking the
    //          prefilter from hit to hit across one long buffer (`prefilter_find_from`); its
    //          per-line verdicts must equal per-line is_match. A sweep that never finds a seed
    //          misses every seeded match, and one that fails to advance past a hit never
    //          terminates, so this pins both. The set includes a line whose first byte is a
    //          line-start candidate but which does NOT match the `^`-anchored rule
    //          (`#nope...`): resolve_line must require BOTH the candidate byte and an actual
    //          anchored match, so it stays false there.
    // Why:     The test uses this setup or assertion to pin the behavior named by the test
    //          function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // Same step as the Rust statement below, written with ordinary TS objects/functions.
    // ```
    let set = RegexSet::new(&["AKIA[A-Z2-7]{4}", "secret", "^#deny"]).expect("compiles");
    let lines: Vec<&[u8]> = vec![
        b"AKIA2345", b"nothing to flag", b"prefix AKIAZ7Q9 suffix", b"#deny this row",
        b"#nope just a hash", b"a secret value", b"plain text", b"", b"AKIA0000", b"x",
    ];
    let oracle: Vec<bool> = lines.iter().map(|line| set.is_match(line)).collect();
    assert_eq!(set.is_match_batch_concat(&lines), oracle);
}

#[test]
fn bucketed_batch_groups_only_equal_lengths() {
    // What:    The bucketed kernel runs the branchless tight kernel, which assumes every line
    //          in a bucket shares one length. The grouping must extend a bucket over EQUAL
    //          lengths; if it instead grouped UNEQUAL lengths, every line (all distinct
    //          lengths) would fall into one bucket sized to the shortest, and the tight kernel
    //          would scan each longer line for only that one byte and miss its match. Use
    //          enough lines (> the 32-line tight chunk) that the mis-grouped bucket runs a
    //          real branchless chunk, not the scalar remainder fallback.
    // Why:     The test uses this setup or assertion to pin the behavior named by the test
    //          function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // Same step as the Rust statement below, written with ordinary TS objects/functions.
    // ```
    let re = compile("[0-9]{3}").expect("compiles");
    // What:    Length L line is `z`-padded then ends in `123`, so every line of length >= 3
    //          matches.
    // Why:     The test uses this setup or assertion to pin the behavior named by the test
    //          function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // Same step as the Rust statement below, written with ordinary TS objects/functions.
    // ```
    let owned: Vec<Vec<u8>> = (1usize..=40)
        .map(|len| {
            let mut line = vec![b'z'; len];
            if len >= 3 {
                line[len - 3..].copy_from_slice(b"123");
            }
            line
        })
        .collect();
    let lines: Vec<&[u8]> = owned.iter().map(Vec::as_slice).collect();
    let oracle: Vec<bool> = lines.iter().map(|line| re.is_match(line)).collect();
    assert_eq!(re.is_match_batch_bucketed(&lines), oracle, "unequal lengths must not share a bucket");
}

#[test]
fn doc_hidden_kernel_hooks_agree_with_per_line() {
    // What:    The benchmark forcer hooks must each run their kernel and return the real
    //          verdicts, not a stub: every hook agrees with per-line is_match. `is_table`
    //          distinguishes the table back-end (a seedless class run) from a non-table one (a
    //          seeded counted rule routes to the counting NFA).
    // Why:     The test uses this setup or assertion to pin the behavior named by the test
    //          function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // Same step as the Rust statement below, written with ordinary TS objects/functions.
    // ```
    let re = compile("[A-Za-z0-9]{6}").expect("compiles");
    assert!(re.is_table(), "a seedless class run uses the table back-end");
    let seeded = compile("AKIA[A-Z2-7]{16}").expect("compiles");
    assert!(!seeded.is_table(), "a seeded counted rule uses the counting back-end");
    let lines = sample_lines();
    let oracle: Vec<bool> = lines.iter().map(|line| re.is_match(line)).collect();
    assert_eq!(re.batch_inter_w::<8>(&lines), oracle, "inter_w hook");
    assert_eq!(re.batch_sheng(&lines), oracle, "sheng hook");
    assert_eq!(re.batch_sheng2(&lines), oracle, "sheng2 hook");
    // What:    The tight kernel hook needs equal-length lines (one exact bucket).
    // Why:     The test uses this setup or assertion to pin the behavior named by the test
    //          function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // Same step as the Rust statement below, written with ordinary TS objects/functions.
    // ```
    let equal: &[&[u8]] = &[b"abcdef", b"ABC123", b"!!!!!!", b"xy z 1", b"qwerty", b"0]0]0]", b"AaBbCc", b"......"];
    let teq: Vec<bool> = equal.iter().map(|line| re.is_match(line)).collect();
    assert_eq!(re.batch_tight_w::<8>(equal), teq, "tight_w hook");
}
