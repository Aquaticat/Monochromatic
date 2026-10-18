// What:     Unit tests for the notice line model of the Licenses page.
// Why:      The page reads the 2 MB notice text through this model, so its line splitting decides what the user sees.

use super::*;

// What:     Collects every row of a model over `text`.
fn rows_of(text: &'static str) -> Vec<String> {
    let lines = NoticeLines::new(text);
    return (0..lines.row_count()).map(|row| return lines.row_data(row).expect("row in range").to_string()).collect();
}

// What:     Lines split at newlines, blank lines stay as empty rows, and a final newline adds no empty row.
// Why:      A blank line is the paragraph gap the page draws, and a phantom last row would be a stray gap.
#[test]
fn splits_at_newlines_and_keeps_blank_lines() {
    assert_eq!(rows_of("a\n\nb\n"), ["a", "", "b"]);
    assert_eq!(rows_of("a\nb"), ["a", "b"]);
    assert_eq!(rows_of("single"), ["single"]);
}

// What:     Windows line endings leave no carriage return in a row.
// Why:      A vendored license text may carry them, and Slint would draw the character.
#[test]
fn strips_carriage_returns() {
    assert_eq!(rows_of("a\r\nb\r\n"), ["a", "b"]);
}

// What:     A row past the end gives nothing.
// Why:      The ListView must never read a row that is not there.
#[test]
fn row_past_the_end_is_none() {
    let lines = NoticeLines::new("a\nb\n");
    assert_eq!(lines.row_count(), 2);
    assert!(lines.row_data(2).is_none());
}

// What:     The rows of the embedded notice text, joined, equal the text without its final newline.
// Why:      The page must show the same text `--licenses` prints, byte for byte, in whichever build embedded it.
#[test]
fn embedded_notices_round_trip() {
    let joined = rows_of(NOTICES).join("\n");
    assert_eq!(joined, NOTICES.strip_suffix('\n').unwrap_or(NOTICES));
}
