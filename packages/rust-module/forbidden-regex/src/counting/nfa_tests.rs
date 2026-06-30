// What:  unit tests for counting-NFA decode validation.
// Why:   a decoded NFA is executed on attacker-influenced input, so validate must reject
//        any structurally inconsistent or out-of-range NFA before it runs; these corrupt
//        a good NFA one field at a time and assert rejection.
//
// In TS you'd write (pseudocode):
// ```ts
// import { /* names from this Rust use line */ } from "./module";
// ```

use super::CountingNfa;
use crate::counting::build_nfa;
use crate::parse::parse;

fn good() -> CountingNfa {
    build_nfa(&parse("AKIA[A-Z2-7]{4}").expect("parses")).expect("expressible as an NFA")
}

#[test]
fn validate_accepts_a_built_nfa() {
    assert!(good().validate().is_ok());
}

#[test]
fn validate_rejects_no_positions() {
    let mut nfa = good();
    nfa.elements.clear();
    assert!(nfa.validate().is_err());
}

#[test]
fn validate_rejects_a_follow_length_mismatch() {
    let mut nfa = good();
    nfa.follow.push(Vec::new());
    assert!(nfa.validate().is_err());
}

#[test]
fn validate_rejects_an_out_of_range_target() {
    let mut nfa = good();
    let beyond_accept = nfa.elements.len() as u32 + 5;
    nfa.start.push(beyond_accept);
    assert!(nfa.validate().is_err());
}
