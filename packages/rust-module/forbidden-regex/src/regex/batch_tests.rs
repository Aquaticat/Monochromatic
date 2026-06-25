// What:  unit tests for the public batch API on Regex and RegexSet.
// Why:   is_match_batch must return exactly what calling is_match on each line returns,
//        including across the seedless single-pattern path that routes to the vertical
//        SIMD kernel; these pin that equality and that every hidden per-kernel hook
//        agrees, on a line set whose length is not a multiple of the SIMD lane count.

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
    // The seedless full-scan path exercises the SIMD kernel; force each hook and
    // confirm all three agree with the per-line oracle.
    let re = compile(r"[A-Za-z0-9]{6}").expect("compiles");
    let lines = sample_lines();
    let oracle: Vec<bool> = lines.iter().map(|line| re.is_match(line)).collect();
    assert_eq!(re.is_match_batch_scalar(&lines), oracle, "scalar");
    assert_eq!(re.is_match_batch_simd(&lines), oracle, "simd");
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
    let set = RegexSet::new(&["secret"]).expect("compiles");
    assert!(set.is_match_batch(&[]).is_empty());
}
