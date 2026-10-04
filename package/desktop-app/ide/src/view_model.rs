//! Shared source-position geometry for painting, hit testing, and selection.

/// What: Import the document and Unicode grapheme/column helpers.
/// Why: Drawing and input must use the same boundaries, including combining text.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Document, segmentGraphemes, displayWidth } from './text';
/// ```
use crate::document::Document;
/// Reuse Helix's Unicode segmentation rather than splitting UTF-8 bytes.
use helix_core::unicode::segmentation::UnicodeSegmentation;
/// Reuse Helix's display-column widths for the monospace rendering probe.
use helix_core::unicode::width::UnicodeWidthStr;

/// What: One rendered grapheme with its source position and display geometry.
/// Why: The same record drives paint and click-to-caret mapping.
/// String owns its bytes instead of borrowing &str; usize matches rope indices.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Glyph = {text: string; row: number; column: number; width: number;
///   start: number; end: number; selected: boolean; style: number};
/// ```
#[derive(Clone, Debug)]
pub struct Glyph {
    /// Text to draw; tabs keep their geometry but draw no characters.
    pub text: String,
    /// Document line number, zero-based.
    pub row: usize,
    /// Visual monospace column, distinct from the character offset.
    pub column: usize,
    /// Width in display columns, including tab expansion.
    pub width: usize,
    /// Inclusive source start in Unicode scalar positions.
    pub start: usize,
    /// Exclusive source endpoint in Unicode scalar positions.
    pub end: usize,
    /// Whether this grapheme intersects the selected source range.
    pub selected: bool,
    /// Highlight palette index supplied by the parser, zero for ordinary text.
    pub style: usize,
}

/// What: A source highlight range, independent of native pixels.
/// Why: Parser results can be validated and tested without a window.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type StyleSpan = {start: number; end: number; style: number};
/// ```
#[derive(Clone, Debug)]
pub struct StyleSpan {
    /// Inclusive source character offset.
    pub start: usize,
    /// Exclusive source character offset.
    pub end: usize,
    /// Semantic palette entry.
    pub style: usize,
}

/// What: Own visible glyphs and caret geometry. Vec grows dynamically unlike
/// a borrowed &[Glyph] or fixed [Glyph; N].
/// Why: The viewport size is runtime-dependent and outlives temporary line reads.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ViewModel = {glyphs: Glyph[]; caretRow: number; caretColumn: number};
/// ```
pub struct ViewModel {
    /// Only visible source rows plus overscan are materialized.
    pub glyphs: Vec<Glyph>,
    /// Current caret source row.
    pub caret_row: usize,
    /// Current caret display column.
    pub caret_column: usize,
}

/// Build a bounded viewport from one immutable document snapshot.
pub fn build_view(document: &Document, first_line: usize, line_count: usize, styles: &[StyleSpan]) -> ViewModel {
    // What: Vec::new allocates an initially empty growable sequence.
    // Why: Materialize only the source visible to this viewport.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const glyphs: Glyph[] = [];
    // ```
    let mut glyphs = Vec::new();
    let text = document.text();
    let position = document.position();
    let selected_start = position.anchor.min(position.head);
    let selected_end = position.anchor.max(position.head);
    let caret_row = text.char_to_line(position.head);
    let mut caret_column = 0;
    // Bound the requested viewport even when resize events arrive before loading.
    let last_line = first_line.saturating_add(line_count).min(text.len_lines());
    // What: a..b iterates integers excluding b, like a counted TS for loop.
    // Why: No whole-file widget list is built for a scrolling viewport.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (let row = firstLine; row < lastLine; row++) { ... }
    // ```
    for row in first_line..last_line {
        let mut start = text.line_to_char(row);
        // What: to_string owns the line so grapheme segmentation can borrow it.
        // Why: The temporary rope slice need not remain in the rendered model.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const line = text.line(row).toString();
        // ```
        let line = text.line(row).to_string();
        let mut column = 0;
        for grapheme in line.graphemes(true) {
            let end = start + grapheme.chars().count();
            if start == position.head {
                caret_column = column;
            }
            if grapheme == "\n" || grapheme == "\r\n" || grapheme == "\r" {
                start = end;
                continue;
            }
            let width;
            if grapheme == "\t" {
                width = 4 - column % 4;
            } else {
                width = UnicodeWidthStr::width(grapheme).max(1);
            }
            let mut style = 0;
            for span in styles {
                if start >= span.start && start < span.end {
                    style = span.style;
                }
            }
            let shown;
            if grapheme == "\t" {
                // An empty owned string represents a tab's undrawn cells.
                shown = String::new();
            } else {
                // Copy this borrowed grapheme into the durable render model.
                shown = grapheme.to_string();
            }
            glyphs.push(Glyph {
                text: shown, row, column, width, start, end,
                selected: start < selected_end && end > selected_start,
                style,
            });
            column += width;
            start = end;
        }
        if start == position.head {
            caret_column = column;
        }
    }
    return ViewModel { glyphs, caret_row, caret_column };
}

/// Resolve a click using the exact glyph cells supplied to the native view.
pub fn hit_test(document: &Document, view: &ViewModel, row: usize, column: f32) -> usize {
    let text = document.text();
    let row = row.min(text.len_lines().saturating_sub(1));
    let mut result = text.line_to_char(row);
    // What: & borrows the glyph vector, so hit testing cannot consume it.
    // Why: Paint and subsequent pointer movement keep using the same model.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const glyph of view.glyphs) { ... }
    // ```
    for glyph in &view.glyphs {
        if glyph.row != row {
            continue;
        }
        // What: as converts bounded display columns to floating-point pixels.
        // Why: Mouse coordinates can lie inside a cell rather than on an integer.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const middle = glyph.column + glyph.width / 2;
        // ```
        let middle = glyph.column as f32 + glyph.width as f32 / 2.0;
        if column < middle {
            return glyph.start;
        }
        result = glyph.end;
    }
    return result;
}
