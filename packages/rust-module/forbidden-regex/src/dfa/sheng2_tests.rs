// What:  unit tests for the two-byte composed Sheng kernel.
// Why:   the kernel advances two bytes per permute and folds both positions' acceptance
//        into one pair table, with a trailing-odd-byte and end-of-input tail; the only
//        thing that makes it safe is that every verdict equals the scalar is_match, so
//        each test builds a real position-independent search DFA and checks agreement on
//        even- and odd-length lines, substring hits, misses, and the empty line.

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

// Asserts the two-byte kernel agrees with the per-line scalar oracle on `lines`.
fn sheng2_agrees(pattern: &str, lines: &[&[u8]]) {
    let dfa = search_dfa(pattern);
    let oracle: Vec<bool> = lines.iter().map(|line| dfa.is_match(line)).collect();
    let mut out = vec![false; lines.len()];
    dfa.is_match_batch_sheng2(lines, &mut out);
    assert_eq!(out, oracle, "sheng2 disagrees for {pattern}");
}

#[test]
fn hex_run_even_and_odd_lengths() {
    let lines: &[&[u8]] = &[
        b"deadbeefdeadbeefdeadbeefdeadbeef",
        b"deadbeefdeadbeefdeadbeefdeadbee",
        b"x deadbeefdeadbeefdeadbeefdeadbeef",
        b"xx deadbeefdeadbeefdeadbeefdeadbeef",
        b"not hex",
        b"",
        b"a",
    ];
    sheng2_agrees("[0-9a-f]{32}", lines);
}

#[test]
fn literal_and_class_pattern() {
    let lines: &[&[u8]] = &[
        b"AKIA2345",
        b"AKIA23456",
        b"no secret here at all",
        b"prefix-AKIAZ7Q9",
        b"AKIA",
    ];
    sheng2_agrees("AKIA[A-Z2-7]{4}", lines);
}

#[test]
fn position_dependent_pattern_falls_back_correctly() {
    // `\bcat\b` has context-dependent acceptance, so the kernel must fall back to scalar
    // and still return correct verdicts.
    let lines: &[&[u8]] = &[b"cat", b"category", b"a cat sat", b"scatter", b"cat!"];
    sheng2_agrees(r"\bcat\b", lines);
}
