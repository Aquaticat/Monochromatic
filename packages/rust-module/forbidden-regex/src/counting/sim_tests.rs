// What:  unit tests for the counting simulation's State predicates.
// Why:   `is_dead` is a thread-prune optimization: a never-pruned thread still yields the
//        right verdict, so the differential-vs-oracle tests cannot observe it. Its
//        contract (a fresh state is dead, a seeded one is not) is pinned here directly,
//        so an inverted or constant predicate cannot pass unnoticed.
//
// In TS you'd write (pseudocode):
// ```ts
// import { /* names from this Rust use line */ } from "./module";
// ```

use super::State;
use crate::charset::singleton;
use crate::counting::element::Element;

#[test]
fn a_fresh_state_is_dead_and_a_seeded_state_is_not() {
    // What:    A fresh state has no active position and every count bitset empty, so it can
    //          never reach acceptance again: it is dead. Activating a start position revives
    //          it.
    // Why:     The test uses this setup or assertion to pin the behavior named by the test
    //          function.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // Same step as the Rust statement below, written with ordinary TS objects/functions.
    // ```
    let elements = vec![Element::Class(singleton(b'a'))];
    let mut state = State::new(&elements);
    assert!(state.is_dead(), "a fresh state has no active position and no live count");
    state.seed(&[0]);
    assert!(!state.is_dead(), "a state with an active position is not dead");
}
