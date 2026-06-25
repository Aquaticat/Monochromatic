// What:  unit tests for required-literal seed extraction and the SIMD prefilter.
// Why:   the RegexSet gate prefilters on these seeds and only runs a rule when its seed
//        is present, so a seed that is NOT actually required by every match would make
//        the gate skip real matches (a missed secret). These tests pin the seeds the
//        gate trusts; patterns are built through the real parser.

use super::{Prefilter, leading_seeds, leading_seeds_min, seeds_from_node, seeds_from_node_min};
use crate::parse::parse;

// Parses a pattern (panicking on a bad test input) for seed extraction.
fn node(pattern: &str) -> crate::ast::node::Node {
    parse(pattern).expect("test pattern parses")
}

#[test]
fn leading_literal_is_the_seed_for_a_prefixed_rule() {
    assert_eq!(seeds_from_node(&node("AKIA[A-Z2-7]{16}")), vec![b"AKIA".to_vec()]);
    assert_eq!(leading_seeds(&node("AKIA[A-Z2-7]{16}")), vec![b"AKIA".to_vec()]);
}

#[test]
fn inner_keyword_is_a_required_seed() {
    // The mandatory inner keyword is a required substring even without a leading literal.
    let seeds = seeds_from_node(&node("[a-z]{3}adafruit[a-z]{3}"));
    assert_eq!(seeds, vec![b"adafruit".to_vec()]);
    // It is not a LEADING literal (the class run precedes it), so leading_seeds is empty.
    assert!(leading_seeds(&node("[a-z]{3}adafruit[a-z]{3}")).is_empty());
}

#[test]
fn class_only_rule_has_no_seed() {
    assert!(seeds_from_node(&node("[a-z]{5}")).is_empty());
    assert!(leading_seeds(&node("[A-Z2-7]{16}")).is_empty());
}

#[test]
fn alternation_seeds_require_every_branch_to_contribute() {
    // Every branch begins with a >=3 literal, so the union is a sound leading seed.
    // Multi-byte alternation branches must each be wrapped as a single atom.
    let seeds = leading_seeds(&node("(?:(?:AKIA)|(?:ASIA))[A-Z2-7]{16}"));
    assert!(seeds.contains(&b"AKIA".to_vec()));
    assert!(seeds.contains(&b"ASIA".to_vec()));
    // One branch with no literal sinks the whole alternation's seed.
    assert!(leading_seeds(&node("(?:(?:AKIA)|(?:[A-Z]{4}))[A-Z2-7]{16}")).is_empty());
}

#[test]
fn short_literals_are_below_the_default_floor_but_pass_the_weak_floor() {
    // "SK" (2 bytes) is too short for the default floor, fine for the weak leading floor.
    assert!(leading_seeds(&node("SK[0-9a-f]{32}")).is_empty());
    assert_eq!(leading_seeds_min(&node("SK[0-9a-f]{32}"), 2), vec![b"SK".to_vec()]);
}

#[test]
fn one_byte_required_literal_only_at_the_weakest_floor() {
    // facebook-shape: the only literal is the one-byte alternation, seen at floor 1.
    let seeds = seeds_from_node_min(&node("\\d{15,16}(?:(?:\\|)|(?:%))[0-9a-z]{27,40}"), 1);
    assert!(seeds.contains(&b"|".to_vec()));
    assert!(seeds.contains(&b"%".to_vec()));
    // Nothing at the default floor.
    assert!(seeds_from_node(&node("\\d{15,16}(?:(?:\\|)|(?:%))[0-9a-z]{27,40}")).is_empty());
}

#[test]
fn prefilter_allows_only_lines_containing_a_seed() {
    let prefilter = Prefilter::from_seeds(&[b"AKIA".to_vec()]);
    assert!(prefilter.allows(b"xx AKIA yy"));
    assert!(!prefilter.allows(b"no key here"));
}

#[test]
fn empty_prefilter_allows_everything() {
    let prefilter = Prefilter::from_seeds(&[]);
    assert!(prefilter.allows(b"anything"));
    assert!(prefilter.allows(b""));
}

#[test]
fn prefilter_allows_when_any_seed_present() {
    let prefilter = Prefilter::from_seeds(&[b"AKIA".to_vec(), b"ASIA".to_vec()]);
    assert!(prefilter.allows(b"has ASIA only"));
    assert!(!prefilter.allows(b"has neither"));
}
