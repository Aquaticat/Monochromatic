// What:  unit tests for `CountSet`, the per-position bitset of live repetition counts.
// Why:   the counting back-end's correctness rests on this set advancing counts by one
//        per matched byte and capping at the repetition bound; an off-by-one in the
//        shift or the cap would accept the wrong lengths, so each op is asserted.

use super::*;

#[test]
fn new_is_empty_with_no_counts() {
    let set = CountSet::new(8);
    assert!(set.is_empty());
    assert!(!set.has_at_least(0));
    assert!(!set.has_at_least(1));
}

#[test]
fn insert_zero_seeds_count_zero_once() {
    let mut set = CountSet::new(4);
    assert!(set.insert_zero(), "first insert reports a change");
    assert!(!set.insert_zero(), "second insert is a no-op");
    assert!(!set.is_empty());
    assert!(set.has_at_least(0));
    assert!(!set.has_at_least(1));
}

#[test]
fn clear_empties_the_set() {
    let mut set = CountSet::new(4);
    set.insert_zero();
    set.clear();
    assert!(set.is_empty());
    assert!(!set.has_at_least(0));
}

#[test]
fn advance_steps_every_count_up_by_one() {
    let mut src = CountSet::new(8);
    src.insert_zero();
    let mut dst = CountSet::new(8);
    dst.copy_advanced_from(&src, 8);
    // The single count moved from 0 to 1.
    assert!(dst.has_at_least(1));
    assert!(!dst.has_at_least(2));
}

#[test]
fn advance_preserves_a_spread_of_counts() {
    // Build {0, 2} by advancing twice with a fresh zero each step.
    let mut a = CountSet::new(8);
    a.insert_zero(); // {0}
    let mut b = CountSet::new(8);
    b.copy_advanced_from(&a, 8); // {1}
    b.insert_zero(); // {0,1}
    let mut c = CountSet::new(8);
    c.copy_advanced_from(&b, 8); // {1,2}
    assert!(c.has_at_least(1));
    assert!(c.has_at_least(2));
    assert!(!c.has_at_least(3));
}

#[test]
fn advance_drops_a_count_that_would_exceed_max() {
    // A single count sitting at `max` is dropped when advanced past the bound.
    let mut src = CountSet::new(3);
    src.insert_zero();
    let mut at_max = CountSet::new(3);
    // Advance to 1, 2, 3 (== max), each carrying the value forward.
    let mut step = CountSet::new(3);
    step.copy_advanced_from(&src, 3); // {1}
    at_max.copy_advanced_from(&step, 3); // {2}
    step.copy_advanced_from(&at_max, 3); // {3}
    assert!(step.has_at_least(3));
    // Advancing the count at max (3) past the bound drops it: the set goes empty.
    let mut overflowed = CountSet::new(3);
    overflowed.copy_advanced_from(&step, 3);
    assert!(overflowed.is_empty(), "count beyond max is dropped");
}

#[test]
fn has_at_least_is_a_lower_bound_test() {
    // Put a single count at 5 (max 8) and probe the threshold around it.
    let mut set = CountSet::new(8);
    set.insert_zero();
    for _ in 0..5 {
        let mut next = CountSet::new(8);
        next.copy_advanced_from(&set, 8);
        set = next;
    }
    assert!(set.has_at_least(5));
    assert!(set.has_at_least(4));
    assert!(!set.has_at_least(6));
}

#[test]
fn counts_can_cross_a_word_boundary() {
    // max above 64 forces a multi-word bitset; a count past bit 63 must still register.
    let mut set = CountSet::new(80);
    set.insert_zero();
    for _ in 0..70 {
        let mut next = CountSet::new(80);
        next.copy_advanced_from(&set, 80);
        set = next;
    }
    assert!(set.has_at_least(70));
    assert!(!set.has_at_least(71));
}

#[test]
fn has_at_least_scans_higher_words_for_a_low_threshold() {
    // A count parked in a higher word must satisfy a LOW threshold through the
    // higher-words scan, not just the in-word shift test the boundary case exercises.
    let mut set = CountSet::new(80);
    set.words[1] = 1 << 6; // count 70 lives in word 1, bit 6
    assert!(set.has_at_least(5)); // word 0 holds nothing; only the higher-words scan sees it
    assert!(set.has_at_least(64));
    assert!(set.has_at_least(70));
    assert!(!set.has_at_least(71));
}

#[test]
fn nwords_sizes_to_address_the_max_plus_one_bit() {
    // Off-by-one or wrong arithmetic here mis-sizes every CountSet of that element.
    assert_eq!(nwords(0), 1);
    assert_eq!(nwords(62), 1);
    assert_eq!(nwords(63), 2); // bit 64 needs a second word
    assert_eq!(nwords(64), 2);
    assert_eq!(nwords(80), 2);
    assert_eq!(nwords(128), 3);
}
