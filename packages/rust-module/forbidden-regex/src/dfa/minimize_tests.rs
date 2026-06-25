// What:  unit tests for DFA minimization helpers.
// Why:   distinct_count drives the refinement fixpoint and sizes the rebuilt table; a
//        wrong count would either stop refinement early (under-minimized) or mis-size
//        the rebuild, so it is pinned directly here, with the matching-preservation
//        property covered in table_tests.

use super::distinct_count;

#[test]
fn distinct_count_counts_unique_colors() {
    assert_eq!(distinct_count(&[]), 0);
    assert_eq!(distinct_count(&[5, 5, 5]), 1);
    assert_eq!(distinct_count(&[0, 1, 2, 0, 1]), 3);
    assert_eq!(distinct_count(&[3, 1, 4, 1, 5, 9, 2, 6]), 7);
}
