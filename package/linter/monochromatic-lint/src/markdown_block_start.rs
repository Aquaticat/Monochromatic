//! What: Conservative block-start detection before inserting prose line breaks.
//! Why: An add-only newline can still turn inline text into a heading, list, quote or code block.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Decline a break when the following source would acquire block syntax at line start.
//! ```

/// Treat EOF and ordinary Markdown spacing as a marker boundary.
fn boundary(byte: Option<u8>) -> bool {
    // None is EOF; byte values otherwise describe ASCII syntax, not Unicode text characters.
    let Some(value) = byte else { return true; };
    return value == b' ' || value == b'\t' || value == b'\n' || value == b'\r';
}

/// What: Check only as far as a candidate marker requires, without rescanning every remaining line suffix.
/// Why: Long prose lines with many punctuation characters must not force repeated full-line scans.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function startsBlockConstruct(source, at): boolean;
/// ```
pub(crate) fn starts_block_construct(source: &str, at: usize) -> bool {
    // Borrow the original bytes; offsets remain UTF-8 boundaries supplied by the text scanner.
    let bytes: &[u8] = source.as_bytes();
    let mut start: usize = at;
    while start < bytes.len() && (bytes[start] == b' ' || bytes[start] == b'\t') {
        start += 1;
    }
    // A missing/empty next line cannot introduce a block.
    let Some(first): Option<u8> = bytes.get(start).copied() else { return false; };
    if first == b'\n' || first == b'\r' { return false; }
    if first == b'>' || first == b'<' || first == b'|' { return true; }
    // Count the first written marker's run; non-ASCII leading bytes never match the ASCII marker catalog.
    let mut end: usize = start;
    while end < bytes.len() && bytes[end] == first { end += 1; }
    let width: usize = end - start;
    let after: Option<u8> = bytes.get(end).copied();
    if first == b'#' && width <= 6 && boundary(after) { return true; }
    if (first == b'`' || first == b'~') && width >= 3 { return true; }
    if (first == b'-' || first == b'+' || first == b'*') && width == 1 && boundary(after) { return true; }
    if first == b'-' || first == b'=' || first == b'_' || first == b'*' {
        // Uniform rule lines contain no further prose break points, so this scan cannot repeat per punctuation.
        let mut cursor: usize = end;
        while cursor < bytes.len() {
            let current: u8 = bytes[cursor];
            if current == b'\n' || current == b'\r' { return true; }
            if current != first && current != b' ' && current != b'\t' { return false; }
            cursor += 1;
        }
        return true;
    }
    // An ordered marker needs digits, a delimiter and a separating boundary.
    let mut digit_end: usize = start;
    while digit_end < bytes.len() && bytes[digit_end].is_ascii_digit() { digit_end += 1; }
    if digit_end == start { return false; }
    let Some(delimiter): Option<u8> = bytes.get(digit_end).copied() else { return false; };
    return (delimiter == b'.' || delimiter == b')') && boundary(bytes.get(digit_end + 1).copied());
}

/// Verify both block starters and lookalike prose without requiring a complete Markdown parse.
#[cfg(test)]
mod tests {
    /// Import the production boundary classifier.
    use super::starts_block_construct;

    /// Real block markers are conservatively rejected.
    #[test]
    fn recognizes_the_incumbent_block_start_catalog() {
        for suffix in [" # h", " ###### h", " - item", " + item", " * item", " > quote", " 1) item", " 1. item", " ```rs", " ~~~", " <div>", " | row", " ---\n", " _ _ _", " ===", " #", " 1)"] {
            assert!(starts_block_construct(suffix, 0), "{suffix}");
        }
    }

    /// Negative controls distinguish actual markers from prefixes of ordinary words.
    #[test]
    fn leaves_non_markers_and_empty_lines_available() {
        for suffix in ["", "   ", "\n", "\r", " #word", " ####### h", " ~~ text", " -word", " ++ text", " --- prose", " 12word", " 12.x", " 123", " ordinary", " 🚀"] {
            assert!(!starts_block_construct(suffix, 0), "{suffix}");
        }
        assert!(starts_block_construct("🚀. # h", 5));
    }
}
