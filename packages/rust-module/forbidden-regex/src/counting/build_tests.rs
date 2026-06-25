// What:  unit tests for the Glushkov counting-NFA builder: which node shapes it can
//        express, and that the NFA it builds matches as a substring search.
// Why:   build_nfa is the back-end selector's first choice for counted patterns; if it
//        wrongly claimed a shape it cannot express (or matched the wrong spans) the
//        engine would silently misbehave. The differential-vs-oracle tests live in
//        run_tests; these pin the builder's accept/reject and a few direct matches.

use super::build_nfa;
use crate::parse::parse;

fn node(pattern: &str) -> crate::ast::node::Node {
    parse(pattern).expect("test pattern parses")
}

#[test]
fn builds_a_counted_class_chain() {
    let nfa = build_nfa(&node("AKIA[A-Z2-7]{4}")).expect("expressible as an NFA");
    assert!(nfa.is_match(b"xx AKIAB2C7 yy"));
    assert!(!nfa.is_match(b"AKIA01"));
    assert!(!nfa.is_match(b"no key"));
}

#[test]
fn builds_a_bare_class_repetition_as_substring_search() {
    let nfa = build_nfa(&node("[a-z]{4}")).expect("expressible");
    assert!(nfa.is_match(b"--abcd--"));
    assert!(!nfa.is_match(b"abc"));
}

#[test]
fn builds_an_alternation() {
    let nfa = build_nfa(&node("(?:(?:AKIA)|(?:ASIA))[A-Z2-7]{4}")).expect("expressible");
    assert!(nfa.is_match(b"AKIAB2C7"));
    assert!(nfa.is_match(b"ASIAB2C7"));
    assert!(!nfa.is_match(b"ABIAB2C7"));
}

#[test]
fn unrolls_a_small_non_class_group_repetition() {
    let nfa = build_nfa(&node("(?:ab){3}")).expect("small group repetition unrolls");
    assert!(nfa.is_match(b"zababab"));
    assert!(!nfa.is_match(b"abab"));
}

#[test]
fn declines_intersection_and_complement() {
    // `&`/`~` are the product back-end's job, not the plain NFA's.
    assert!(build_nfa(&node("[a-z]&~(m)")).is_none());
    assert!(build_nfa(&node("(?:[a-z]{4})&~(abcd)")).is_none());
}
