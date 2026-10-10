// What:     Unit tests for `non_spacing_mark.rs`, pulled in by
//           `#[cfg(test)] #[path = "non_spacing_mark_tests.rs"] mod tests;` at the bottom of
//           `non_spacing_mark.rs`. These are positive and negative controls for the `Mn` table, not
//           mirrors of a Kotlin case, since the Kotlin tests only reach the table through search matching.
// Why:      The table is generated data, so each category boundary is pinned by a code point whose
//           category is known. Reaches the module items via `use super::*` because this file is the
//           `tests` CHILD of non_spacing_mark.
use super::*;

// What:     `#[test]` marks the next function as a test case.
// Why:      U+0301 COMBINING ACUTE ACCENT is `Mn`, the mark that `cafe` + accent decomposes into.
#[test]
fn acute_accent_is_a_non_spacing_mark() {
    assert!(is_non_spacing_mark('\u{0301}'));
}

// What:     `#[test]` marks the next function as a test case.
// Why:      U+3099 COMBINING KATAKANA-HIRAGANA VOICED SOUND MARK is `Mn`, so `が` loses its dakuten as in `removesKanaVoicingMarks`.
#[test]
fn kana_voicing_mark_is_a_non_spacing_mark() {
    assert!(is_non_spacing_mark('\u{3099}'));
}

// What:     `#[test]` marks the next function as a test case.
// Why:      U+0E31 THAI CHARACTER MAI HAN-AKAT is `Mn` with canonical combining class 0, which a combining-class test would miss.
#[test]
fn thai_vowel_mark_with_zero_combining_class_is_a_non_spacing_mark() {
    assert!(is_non_spacing_mark('\u{0E31}'));
}

// What:     `#[test]` marks the next function as a test case.
// Why:      U+093F DEVANAGARI VOWEL SIGN I is `Mc`, a spacing mark that `keepsSpacingMarks` requires to survive.
#[test]
fn devanagari_spacing_vowel_sign_is_not_a_non_spacing_mark() {
    assert!(!is_non_spacing_mark('\u{093F}'));
}

// What:     `#[test]` marks the next function as a test case.
// Why:      U+0488 COMBINING CYRILLIC HUNDRED THOUSANDS SIGN is `Me`, an enclosing mark that must not be removed.
#[test]
fn enclosing_mark_is_not_a_non_spacing_mark() {
    assert!(!is_non_spacing_mark('\u{0488}'));
}

// What:     `#[test]` marks the next function as a test case.
// Why:      Base letters, Latin and Devanagari, are never marks, so ordinary text passes through unchanged.
#[test]
fn base_letters_are_not_non_spacing_marks() {
    assert!(!is_non_spacing_mark('a'));
    assert!(!is_non_spacing_mark('\u{0915}'));
}

// What:     `#[test]` marks the next function as a test case.
// Why:      The first table range starts at U+0300 and the code point just below it, U+02FF, is a modifier letter.
#[test]
fn first_range_boundaries_are_respected() {
    assert!(is_non_spacing_mark('\u{0300}'));
    assert!(!is_non_spacing_mark('\u{02FF}'));
}

// What:     `#[test]` marks the next function as a test case.
// Why:      The last table range ends at U+E01EF, and U+E01F0 is unassigned, so both ends of the last range are checked.
#[test]
fn last_range_boundaries_are_respected() {
    assert!(is_non_spacing_mark('\u{E01EF}'));
    assert!(!is_non_spacing_mark('\u{E01F0}'));
}

// What:     `#[test]` marks the next function as a test case.
// Why:      Binary search needs ascending, disjoint ranges, so a mis-generated table would fail here before any lookup.
#[test]
fn table_is_sorted_and_disjoint() {
    let pairs: Vec<(u32, u32)> = NON_SPACING_MARK_RANGES
        .as_chunks::<2>()
        .0
        .iter()
        .map(|pair| return (pair[0], pair[1]))
        .collect();
    assert!(!pairs.is_empty());
    for (start, end) in &pairs {
        assert!(start <= end);
    }
    for window in pairs.windows(2) {
        assert!(window[0].1 < window[1].0);
    }
}
