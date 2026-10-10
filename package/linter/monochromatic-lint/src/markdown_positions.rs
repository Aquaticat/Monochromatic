//! What:
//!  Owned Markdown byte-to-line and UTF-16-column indexes.
//! Why:
//!  Diagnostics keep original byte addresses while columns follow the established Markdown consumer contract.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Build line starts and sparse Unicode-width adjustments once per source.
//! ```

/// Import the common diagnostic wire span.
use crate::diagnostic::Span;
/// Import the parser's CR,
///  LF and CRLF boundary iterator instead of inventing another newline grammar.
use satteri_arena::line_ending_iter;

/// What:
///  Cumulative difference between UTF-8 bytes and UTF-16 units at a multibyte character end.
/// Why:
///  Sparse width changes let each position lookup use binary search without rescanning a long line.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type WidthChange = { end: number; extraBytes: number };
/// ```
struct WidthChange {
    /// Original byte offset immediately after this character.
    end: usize,
    /// Extra UTF-8 bytes accumulated before this offset.
    extra_bytes: usize,
}

/// What:
///  An owned position index with no references into its source string.
/// Why:
///  The parsed document can own its source and index without a self-referential lifetime.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class MarkdownPositions { starts: number[]; widths: WidthChange[]; length: number }
/// ```
pub(crate) struct MarkdownPositions {
    /// Original byte offset of each line start;
    ///  a leading BOM precedes the first content position.
    starts: Vec<usize>,
    /// Sparse cumulative Unicode-width changes.
    widths: Vec<WidthChange>,
    /// Original source byte length.
    length: usize,
}

/// What:
///  Construct and query Markdown positions.
/// Why:
///  A leading BOM is excluded from columns but retained in original-source byte offsets.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // span(offset, length) resolves original-source coordinates.
/// ```
impl MarkdownPositions {
    /// Build newline and Unicode-width indexes from the exact input.
    pub(crate) fn new(source: &str) -> MarkdownPositions {
        let bom = if source.starts_with('\u{feff}') { 3 } else { 0 };
        let mut starts = vec![bom];
        for ending in line_ending_iter(source.as_bytes()) {
            starts.push(ending + 1);
        }
        let mut widths = Vec::new();
        let mut extra_bytes = 0;
        for (offset, character) in source.char_indices() {
            if offset < bom {
                continue;
            }
            let extra = character.len_utf8() - character.len_utf16();
            if extra != 0 {
                extra_bytes += extra;
                widths.push(WidthChange {
                    end: offset + character.len_utf8(),
                    extra_bytes,
                });
            }
        }
        return MarkdownPositions {
            starts,
            widths,
            length: source.len(),
        };
    }

    /// Read cumulative width adjustment through this byte boundary.
    fn extra_at(&self, offset: usize) -> usize {
        let count = self
            .widths
            .partition_point(|entry| return entry.end <= offset);
        if count == 0 {
            return 0;
        }
        return self.widths[count - 1].extra_bytes;
    }

    /// Resolve a range without converting its byte length into character units.
    pub(crate) fn span(&self, requested_offset: usize, length: usize) -> Span {
        let offset: usize = requested_offset.min(self.length);
        let count = self.starts.partition_point(|start| return *start <= offset);
        let index = count.saturating_sub(1);
        let start = self.starts[index];
        let byte_column = offset.saturating_sub(start);
        let extra = self.extra_at(offset).saturating_sub(self.extra_at(start));
        return Span {
            offset,
            length: length.min(self.length - offset),
            line: index + 1,
            column: byte_column.saturating_sub(extra) + 1,
        };
    }
}

/// Position regressions are verification-only.
#[cfg(test)]
#[path = "markdown_positions_tests.rs"]
mod tests;
