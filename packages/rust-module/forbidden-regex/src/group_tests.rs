// What:  unit tests for grouping literal-free rules into union DFAs.
// Why:   after the fold this path is rarely used (most literal-free rules join the gate),
//        but it remains the fallback for a rule with no usable filter, and a union DFA
//        must match if ANY of its members matches as a substring.

use super::group_seedless;
use crate::parse::parse;

fn node(pattern: &str) -> crate::ast::node::Node {
    parse(pattern).expect("test pattern parses")
}

#[test]
fn empty_input_yields_no_groups() {
    assert!(group_seedless(vec![]).is_empty());
}

#[test]
fn a_group_matches_any_of_its_members_as_a_substring() {
    let engines = group_seedless(vec![node("[0-9]{4}"), node("[a-z]{4}")]);
    assert!(!engines.is_empty());
    let any = |line: &[u8]| engines.iter().any(|engine| engine.is_match(line));
    assert!(any(b"xx 1234 xx")); // a 4-digit run
    assert!(any(b"xx abcd xx")); // a 4-letter run
    assert!(!any(b"xx 12 ab xx")); // neither run reaches length 4
}

#[test]
fn a_single_member_groups_and_matches() {
    let engines = group_seedless(vec![node("[A-Z2-7]{16}")]);
    assert!(!engines.is_empty());
    let sixteen = b"ABCDEFGH23456777";
    assert!(engines.iter().any(|engine| engine.is_match(sixteen)));
    assert!(!engines.iter().any(|engine| engine.is_match(b"ABCDEFGH")));
}
