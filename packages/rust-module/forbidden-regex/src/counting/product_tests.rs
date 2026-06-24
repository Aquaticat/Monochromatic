//! Tests for the synchronized-product back-end: differential vs the eager DFA on
//! small `&`/`~` patterns, and a serialized-size proof that the AWS-key complement
//! shape stays tiny. Exempt from the max-lines and rustdoc budgets as a
//! `*_tests.rs` file.

use crate::ast::node::Node;
use crate::ast::smart::concat;
use crate::counting::product::{ProductProgram, linearize_product};
use crate::dfa::build_dfa;
use crate::parse::parse;

// Builds the eager-DFA oracle for a pattern: the trusted (if large) reference.
fn oracle(pattern: &str) -> impl Fn(&[u8]) -> bool {
    let node = parse(pattern).expect("oracle pattern parses");
    let dfa = build_dfa(concat(vec![Node::Top, node])).expect("oracle dfa builds");
    move |line: &[u8]| dfa.is_match(line)
}

// Builds the product program, asserting the pattern takes the `&`/`~` back-end.
fn product(pattern: &str) -> ProductProgram {
    let node = parse(pattern).expect("pattern parses");
    linearize_product(&node).expect("pattern is a linear product")
}

// Every linear `&`/`~` pattern must agree with the eager DFA on every probe input.
#[test]
fn product_agrees_with_oracle() {
    let patterns = [
        "(?:[A-Z]{3}) & ~(ABC)",
        "(?:[A-Z]{2,4}) & ~(AB)",
        "(?:AKIA[A-Z2-7]{4}) & ~(AKIA2222)",
        "(?:[A-Z]{3}) & (?:[A-Za-z]{3})",
        "(?:\\b[A-Z]{3}\\b) & ~(ABC)",
        "(?:[A-Za-z]{2,3}) & ~(ab) & ~(abc)",
    ];
    let inputs: [&[u8]; 18] = [
        b"",
        b"A",
        b"AB",
        b"ABC",
        b"ABCD",
        b"xABCx",
        b"xABx",
        b"ab",
        b"abc",
        b"abcd",
        b"AKIA2222",
        b"AKIA2223",
        b"AKIAABCD",
        b"prefix AKIAABCD suffix",
        b" ABC ",
        b"ABC\n",
        b"\nABC",
        b"aZ",
    ];
    for pattern in patterns {
        let prog = product(pattern);
        let oracle_fn = oracle(pattern);
        for input in inputs {
            assert_eq!(
                prog.is_match(input),
                oracle_fn(input),
                "pattern {pattern:?} disagreed on input {:?}",
                String::from_utf8_lossy(input)
            );
        }
    }
}

// The realistic AWS-key complement shape must stay tiny and decide keys exactly.
#[test]
fn aws_key_complement_stays_small() {
    let prog = product("(?:AKIA[A-Z2-7]{16}) & ~(AKIA2{16})");
    // One positive operand (5 elements) and one negative operand (5 elements).
    assert_eq!(prog.positives.len(), 1);
    assert_eq!(prog.negatives.len(), 1);
    assert_eq!(prog.positives[0].elements.len(), 5);
    assert_eq!(prog.negatives[0].elements.len(), 5);
    let bytes = bincode::serialize(&prog).expect("serializes");
    assert!(
        bytes.len() < 2_000,
        "product program serialized to {} bytes, expected under 2 KB",
        bytes.len()
    );
}

// The complement is exact: a real key passes, only the all-`2` placeholder fails.
#[test]
fn aws_key_complement_is_exact() {
    let prog = product("(?:AKIA[A-Z2-7]{16}) & ~(AKIA2{16})");
    // A realistic key: AKIA then sixteen [A-Z2-7] that are not all '2'.
    assert!(prog.is_match(b"AKIAABCDEFGHIJKLMNOP"));
    assert!(prog.is_match(b"AKIA234567234567ABCD"));
    assert!(prog.is_match(b"prefix AKIAABCDEFGHIJKLMNOP suffix"));
    // The exact placeholder AKIA + sixteen '2' is the complement target: rejected.
    assert!(!prog.is_match(b"AKIA2222222222222222"));
    // One byte off the placeholder is a real key again: only the exact span fails.
    assert!(prog.is_match(b"AKIA2222222222222223"));
    // Too few trailing bytes: the positive operand cannot match at all.
    assert!(!prog.is_match(b"AKIA222222222222222"));
}
