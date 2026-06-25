// What:  unit tests for the batched multi-line DFA kernels.
// Why:   the interleaved and tight kernels reimplement the per-byte match loop across
//        several lines at once; the only thing that makes them safe to ship is that
//        every verdict equals the scalar `is_match` the engine already trusts, so each
//        test builds a real search DFA and asserts all three kernels agree with it on a
//        deliberately awkward line set (varied lengths, matches and misses, a count not
//        divisible by LANES so the scalar remainder path runs).

use super::LANES;
use crate::ast::node::Node;
use crate::ast::smart::concat;
use crate::dfa::table::Dfa;
use crate::dfa::{build_dfa_within, minimize};
use crate::parse::parse;

// Builds the same unanchored search DFA an engine would for `pattern`.
fn search_dfa(pattern: &str) -> Dfa {
    let node = concat(vec![Node::Top, parse(pattern).expect("pattern parses")]);
    minimize(&build_dfa_within(node, 10_000).expect("builds under cap"))
}

// Asserts every kernel agrees with the per-line scalar oracle on `lines`.
fn kernels_agree(pattern: &str, lines: &[&[u8]]) {
    let dfa = search_dfa(pattern);
    let oracle: Vec<bool> = lines.iter().map(|line| dfa.is_match(line)).collect();

    let mut scalar = vec![false; lines.len()];
    dfa.is_match_batch_scalar(lines, &mut scalar);
    assert_eq!(scalar, oracle, "scalar batch disagrees for {pattern}");

    let mut interleaved = vec![false; lines.len()];
    dfa.is_match_batch_interleaved(lines, &mut interleaved);
    assert_eq!(interleaved, oracle, "interleaved batch disagrees for {pattern}");
}

#[test]
fn literal_and_class_pattern_across_varied_lines() {
    // A leading-literal rule with a bounded class tail: matches as a substring, dies
    // fast on most lines (exercises the per-lane dead early-exit divergence).
    let lines: &[&[u8]] = &[
        b"AKIA2345",
        b"no secret here",
        b"prefix-AKIAZ7Q9-suffix",
        b"",
        b"AKIA",
        b"AKIA!!!!",
        b"a",
        b"AKIA67QZ tail bytes that keep going for a while",
        b"another miss",
        b"xxxxxxxxxxxxxxxxxxxxAKIA2222",
        b"short",
        b"AKIAAAAA",
        b"zzz",
    ];
    kernels_agree("AKIA[A-Z2-7]{4}", lines);
}

#[test]
fn word_boundary_and_anchors_at_chunk_and_remainder_sizes() {
    // `\b` acceptance can fire at end of input and mid-line transitions; run both a
    // chunk-aligned count (2 * LANES) and a ragged count so both code paths execute.
    let base: Vec<&[u8]> = vec![
        b"cat",
        b"a cat sat",
        b"category",
        b"the cat.",
        b"scatter",
        b"cat!",
        b"dog",
        b" cat ",
        b"concat",
        b"cat\tcat",
    ];
    let aligned: Vec<&[u8]> = base.iter().cycle().take(LANES * 2).copied().collect();
    kernels_agree(r"\bcat\b", &aligned);
    let ragged: Vec<&[u8]> = base.iter().cycle().take(LANES * 2 + 3).copied().collect();
    kernels_agree(r"\bcat\b", &ragged);
}

#[test]
fn line_start_and_line_end_anchors() {
    // `^`/`$` resolve against the one-line input's position zero and end of input.
    let lines: &[&[u8]] = &[
        b"#deny this",
        b"deny that",
        b"  #deny indented",
        b"trailing deny",
        b"#deny",
        b"nope",
        b"#den",
        b"#deny extra",
        b"x",
    ];
    kernels_agree("^#deny", lines);
}

#[test]
fn empty_line_set_is_a_noop() {
    // No lines: every kernel must leave the (empty) output untouched without panic.
    kernels_agree("AKIA[A-Z2-7]{4}", &[]);
}

#[test]
fn tight_kernel_matches_oracle_on_equal_length_lines() {
    // The branchless tight kernel assumes every line shares one length (exact bucket);
    // on such a set its accumulated verdict must equal the scalar oracle.
    let dfa = search_dfa("AKIA[A-Z2-7]{4}");
    let lines: &[&[u8]] = &[
        b"AKIA2345", b"nomatch1", b"AKIAZ7Q9", b"xxxxxxxx", b"AKIA0000",
        b"abcdefgh", b"AKIA6QZ7", b"zzzzzzzz", b"AKIA9999", b"plain---",
    ];
    let oracle: Vec<bool> = lines.iter().map(|line| dfa.is_match(line)).collect();
    let mut out = vec![false; lines.len()];
    dfa.is_match_batch_tight_w::<8>(lines, &mut out);
    assert_eq!(out, oracle);
}
