//! What: Exact physical line ranges, with CR, LF and CRLF retained.
//! Why: Native decoded strings normalize newlines, but host rewrites must not.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Scan each byte once and retain content and newline endpoints.
//! ```

/// Import immutable mapped-line and snapshot records.
use crate::processors_model::{MappedLine, Mapping};

/// What: Byte indexes use usize rather than u32/u64/i32/i64.
/// Why: usize addresses strings without truncating on the current platform.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PhysicalLine = { start: number; contentEnd: number; end: number };
/// ```
#[derive(Clone, Debug)]
pub(crate) struct PhysicalLine {
    /// Inclusive physical start.
    pub start: usize,
    /// End excluding newline bytes.
    pub content_end: usize,
    /// End including newline bytes.
    pub end: usize,
}

/// Scan borrowed UTF-8 source once; ASCII newline indexes cannot split a Unicode character.
pub(crate) fn physical_lines(source: &str) -> Vec<PhysicalLine> {
    // What: Vec owns a growable list, unlike &[T] (borrowed) or [T; N] (fixed size).
    // Why: Authored files have a runtime-dependent number of lines.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result: PhysicalLine[] = [];
    // ```
    let mut result: Vec<PhysicalLine> = Vec::new();
    // Borrow bytes instead of decoding characters; newline delimiters are ASCII.
    let bytes: &[u8] = source.as_bytes();
    let mut cursor: usize = 0;
    let mut start: usize = 0;
    while cursor < bytes.len() {
        if bytes[cursor] != b'\n' && bytes[cursor] != b'\r' {
            cursor += 1;
            continue;
        }
        let content_end: usize = cursor;
        if bytes[cursor] == b'\r' && bytes.get(cursor + 1) == Some(&b'\n') {
            cursor += 1;
        }
        cursor += 1;
        result.push(PhysicalLine {
            start,
            content_end,
            end: cursor,
        });
        start = cursor;
    }
    if start < bytes.len() {
        result.push(PhysicalLine {
            start,
            content_end: bytes.len(),
            end: bytes.len(),
        });
    }
    return result;
}

/// Append one exact authored line and remember the stripped container spelling.
pub(crate) fn copy_line(
    mapping: &mut Mapping,
    parent: &str,
    envelope: usize,
    payload: usize,
    end: usize,
    continuation: String,
) {
    // Record positions before copying; offsets stay byte-based across Unicode.
    let start: usize = mapping.text.len();
    mapping.text.push_str(&parent[payload..end]);
    mapping.lines.push(MappedLine {
        start,
        end: mapping.text.len(),
        parent_start: payload,
        envelope,
        prefix: continuation,
    });
}

/// Return the physical line's newline spelling, choosing LF only for an unterminated input.
pub(crate) fn newline(source: &str, offset: usize) -> &str {
    // Borrow the indexed suffix; range syntax is a checked byte slice, not TS string indexing.
    let suffix: &str = &source[offset..];
    // Inspect physical ranges without converting original bytes.
    for line in physical_lines(suffix) {
        if line.content_end != line.end {
            return &suffix[line.content_end..line.end];
        }
    }
    return "\n";
}
