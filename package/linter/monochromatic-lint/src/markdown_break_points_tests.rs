//! What: Prose break offsets independent of parser-node placement.
//! Why: Existing newlines and whitespace past the text-node boundary must remain visible to the scanner.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Assert offsets on complete text and on deliberately split node/tail views.
//! ```

/// Import the real byte scanner and abbreviation classifier.
use super::{abbreviation_at, break_offsets};

/// All punctuation families share their word-boundary and paragraph-tail behavior.
#[test]
fn break_points_preserve_tokens_and_final_punctuation() {
    assert_eq!(break_offsets("left, right.", "", true), [5]);
    assert_eq!(break_offsets("first. next", "", true), [6]);
    assert_eq!(
        break_offsets("one; two: three? four! end.", "", true),
        [4, 9, 16, 22]
    );
    for source in [
        "3.14 here.",
        "1,000 here.",
        "Node.js here.",
        "9.0.0-rc.3 here.",
        "wait... here.",
        "e.g. here.",
        "first.\nnext.",
        "first.\r\nnext.",
    ] {
        assert!(break_offsets(source, "", true).is_empty(), "{source}");
    }
}

/// The offset passes Western closing delimiters but not a following punctuation token.
#[test]
fn closing_delimiters_are_completed_before_breaking() {
    assert_eq!(break_offsets("said \"done.\" Then", "", true), [12]);
    assert_eq!(break_offsets("asked \"why?\", then", "", true), [13]);
    assert_eq!(break_offsets("done.)] next", "", true), [7]);
    assert_eq!(break_offsets("done.” next", "", true), [8]);
}

/// Long inter-node whitespace and CRLF are not mistaken for missing newlines.
#[test]
fn source_after_the_text_node_is_not_truncated() {
    assert!(break_offsets("First.", "  \r\nNext", false).is_empty());
    assert_eq!(break_offsets("First.", " next", false), [6]);
    assert_eq!(break_offsets("First.", "", false), [6]);
    assert!(break_offsets("First.", "", true).is_empty());
    let trailing: String = format!("{}\nNext", " ".repeat(300));
    assert!(break_offsets("First.", trailing.as_str(), false).is_empty());
}

/// Case folding determines abbreviation identity without shifting byte coordinates.
#[test]
fn abbreviations_keep_original_unicode_offsets() {
    assert!(abbreviation_at("DR.", 3));
    assert!(abbreviation_at("e.g.", 4));
    assert!(!abbreviation_at("first.", 6));
    assert!(!abbreviation_at("Kst.", 6));
    assert!(break_offsets("🚀 DR. Example here.", "", true).is_empty());
    assert_eq!(break_offsets("🚀 first. next", "", true), [11]);
}
