// What:  unit tests for the compiled DFA table: the acceptance-bit encoding, the match
//        loop on a built automaton, the first-byte set used by the line-start reject,
//        decode validation, and that minimization preserves matching.
// Why:   this is the hot match path and a decode security boundary; a wrong accept bit,
//        a missed dead-state exit, or a too-loose validate would corrupt matching or let
//        a hostile serialized DFA run out of bounds.

use super::{Dfa, accept_bit};
use crate::charset::ByteSet;
use crate::dfa::{build_dfa_within, minimize};
use crate::parse::parse;

// Builds a minimized anchored DFA for a pattern (no Sigma* prefix, matches a prefix).
fn anchored_dfa(pattern: &str) -> Dfa {
    let node = parse(pattern).expect("test pattern parses");
    minimize(&build_dfa_within(node, 10_000).expect("builds under cap"))
}

#[test]
fn accept_bit_encodes_four_distinct_contexts() {
    assert_eq!(accept_bit(false, false), 1);
    assert_eq!(accept_bit(true, false), 2);
    assert_eq!(accept_bit(false, true), 4);
    assert_eq!(accept_bit(true, true), 8);
}

#[test]
fn anchored_dfa_matches_a_prefix_only() {
    let dfa = anchored_dfa("abc");
    assert!(dfa.is_match(b"abc"));
    assert!(dfa.is_match(b"abcd")); // the prefix "abc" matches
    assert!(!dfa.is_match(b"ab")); // incomplete
    assert!(!dfa.is_match(b"xabc")); // anchored: nothing matches at offset 0
    assert!(!dfa.is_match(b""));
}

#[test]
fn class_repetition_dfa_counts_correctly() {
    let dfa = anchored_dfa("[a-z]{3}");
    assert!(dfa.is_match(b"abc"));
    assert!(dfa.is_match(b"abcd")); // first three match
    assert!(!dfa.is_match(b"ab"));
    assert!(!dfa.is_match(b"a1c"));
}

#[test]
fn mark_first_bytes_reports_only_viable_starts() {
    let dfa = anchored_dfa("abc");
    let mut set = ByteSet::empty();
    dfa.mark_first_bytes(&mut set);
    assert!(set.contains(b'a'));
    assert!(!set.contains(b'b'));
    assert!(!set.contains(b'x'));
}

#[test]
fn validate_accepts_a_built_dfa() {
    let dfa = anchored_dfa("AKIA[A-Z2-7]{4}");
    assert!(dfa.validate().is_ok());
}

#[test]
fn minimization_preserves_matching() {
    // Multi-byte alternation branches must each be wrapped as a single atom.
    let raw = build_dfa_within(parse("(?:(?:ab)|(?:ac))d").expect("parses"), 10_000).expect("builds");
    let min = minimize(&raw);
    for input in [&b"abd"[..], b"acd", b"abc", b"ad", b"abdx"] {
        assert_eq!(raw.is_match(input), min.is_match(input), "input {input:?}");
    }
    // The minimized automaton is no larger than the raw one.
    assert!(min.num_states <= raw.num_states);
}
