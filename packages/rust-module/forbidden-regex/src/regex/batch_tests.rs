// What:  unit tests for the public batch API on Regex and RegexSet.
// Why:   is_match_batch must return exactly what calling is_match on each line returns,
//        including across the seedless single-pattern path that routes to the Sheng
//        permute kernel; these pin that equality and that every hidden per-kernel hook
//        agrees, on a line set whose length is not a multiple of the batch lane count.

use crate::{RegexSet, compile};

// A spread of lines: matches, misses, substring hits, varied lengths, ragged count.
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
    // The seedless full-scan path exercises the batch kernels; force each hook and
    // confirm they agree with the per-line oracle.
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
    // Over the Sheng floor (512) and seedless + table + <=64 states, so the default
    // is_match_batch takes the permute kernel; its verdicts must equal per-line is_match.
    let re = compile("[0-9a-f]{8}").expect("compiles");
    let base: Vec<&[u8]> = vec![b"deadbeef", b"not hex here", b"cafef00d", b"xyz", b"0123abcd", b""];
    let lines: Vec<&[u8]> = base.iter().cycle().take(700).copied().collect();
    let oracle: Vec<bool> = lines.iter().map(|line| re.is_match(line)).collect();
    assert_eq!(re.is_match_batch(&lines), oracle);
}

#[test]
fn bucketed_batch_equals_per_line_across_lengths() {
    // The bucketed path groups by exact length, runs the tight kernel per bucket, and
    // scatters back; the result must equal per-line is_match regardless of input order.
    for pattern in ["[0-9a-f]{8}", "AKIA[A-Z2-7]{4}", r"\bcat\b"] {
        let re = compile(pattern).expect("compiles");
        let lines = sample_lines();
        let oracle: Vec<bool> = lines.iter().map(|line| re.is_match(line)).collect();
        assert_eq!(re.is_match_batch_bucketed(&lines), oracle, "bucketed disagrees for {pattern}");
    }
}

#[test]
fn concat_batch_sweep_equals_per_line_is_match() {
    // The concatenated-buffer gate sweep marks candidate lines by walking the prefilter from
    // hit to hit across one long buffer (`prefilter_find_from`); its per-line verdicts must
    // equal per-line is_match. A sweep that never finds a seed misses every seeded match, and
    // one that fails to advance past a hit never terminates, so this pins both. The set
    // includes a line whose first byte is a line-start candidate but which does NOT match the
    // `^`-anchored rule (`#nope...`): resolve_line must require BOTH the candidate byte and an
    // actual anchored match, so it stays false there.
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
    // The bucketed kernel runs the branchless tight kernel, which assumes every line in a
    // bucket shares one length. With all-distinct lengths each line is its own bucket; if the
    // bucket-extend test mis-grouped different lengths, the tight kernel would scan a longer
    // line for only the shortest line's bytes and miss a match in its tail.
    let re = compile("[0-9]{3}").expect("compiles");
    let lines: &[&[u8]] = &[b"x", b"123", b"ab123", b"abcd123", b"no", b"abcdefg99"];
    let oracle: Vec<bool> = lines.iter().map(|line| re.is_match(line)).collect();
    assert_eq!(re.is_match_batch_bucketed(lines), oracle, "a tail match in a longer line must be found");
}

#[test]
fn doc_hidden_kernel_hooks_agree_with_per_line() {
    // The benchmark forcer hooks must each run their kernel and return the real verdicts, not
    // a stub: every hook agrees with per-line is_match. `is_table` distinguishes the table
    // back-end (a seedless class run) from a non-table one (a seeded counted rule routes to
    // the counting NFA).
    let re = compile("[A-Za-z0-9]{6}").expect("compiles");
    assert!(re.is_table(), "a seedless class run uses the table back-end");
    let seeded = compile("AKIA[A-Z2-7]{16}").expect("compiles");
    assert!(!seeded.is_table(), "a seeded counted rule uses the counting back-end");
    let lines = sample_lines();
    let oracle: Vec<bool> = lines.iter().map(|line| re.is_match(line)).collect();
    assert_eq!(re.batch_inter_w::<8>(&lines), oracle, "inter_w hook");
    assert_eq!(re.batch_sheng(&lines), oracle, "sheng hook");
    assert_eq!(re.batch_sheng2(&lines), oracle, "sheng2 hook");
    // The tight kernel hook needs equal-length lines (one exact bucket).
    let equal: &[&[u8]] = &[b"abcdef", b"ABC123", b"!!!!!!", b"xy z 1", b"qwerty", b"0]0]0]", b"AaBbCc", b"......"];
    let teq: Vec<bool> = equal.iter().map(|line| re.is_match(line)).collect();
    assert_eq!(re.batch_tight_w::<8>(equal), teq, "tight_w hook");
}
