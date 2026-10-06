//! Where one frame draws its annotations: underline segments under source glyphs, and the texts of the
//! virtual rows above annotated lines. Every horizontal position comes from the shaped rows that paint the
//! source, and nothing is inserted into a row, so the geometry inside a code row is the same with and without
//! annotations.

/// The visible subset of the snapshots, hint labels, and the severity order.
use crate::annotation::{Label, Mark, Visible, rank};
/// Severities as the Language module names them.
use crate::language::diagnostics::Severity;
/// One shaped source row and its caret and range geometry.
use crate::shaped_row::ShapedRow;
/// The frame's shaped rows, the selected-terminator width, and the shaper that sets virtual-row text.
use crate::shaped_text::{ShapedView, TERMINATOR_MARK, TextShaper};
/// Placed hints and the spacing of virtual rows.
use crate::virtual_row::{CONTINUATION_INDENT, HINT_GAP, HintPlace};
/// What: `Layout<u32>` is a shaped paragraph whose glyph brushes are numbers.
/// Why: Each virtual-row text is shaped once per frame and painted by the raster like a source row.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type Layout } from 'parley';
/// ```
use parley::Layout;

/// What: The inks annotations are painted with, as straight RGBA bytes; `[u8; 4]` is a fixed array of four bytes
///       (siblings `Vec<u8>`, `&[u8]`).
/// Why: Colors follow the system scheme; they are part of the frame stamp, so a scheme change repaints.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type AnnotationColors = { hint: Rgba; error: Rgba; warning: Rgba; information: Rgba; suggestion: Rgba };
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AnnotationColors {
    /// Hint label text.
    pub hint: [u8; 4],
    /// Error underline.
    pub error: [u8; 4],
    /// Warning underline.
    pub warning: [u8; 4],
    /// Information underline.
    pub information: [u8; 4],
    /// Hint-severity underline.
    pub suggestion: [u8; 4],
}

/// Pick the ink of one severity.
impl AnnotationColors {
    /// The underline ink of `severity`.
    pub fn severity(&self, severity: Severity) -> [u8; 4] {
        if severity == Severity::Error {
            return self.error;
        }
        if severity == Severity::Warning {
            return self.warning;
        }
        if severity == Severity::Information {
            return self.information;
        }
        return self.suggestion;
    }
}

/// What: One horizontal underline run on one row, in logical pixels from the text's left edge.
/// Why: A multi-line diagnostic becomes one run per row; the raster draws each in its severity's line style.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Underline = { row: number; x: number; width: number; severity: Severity };
/// ```
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Underline {
    /// Source line the run lies on.
    pub row: usize,
    /// Left edge.
    pub x: f32,
    /// Horizontal extent.
    pub width: f32,
    /// Severity, which selects ink and line style.
    pub severity: Severity,
}

/// What: One shaped text on a virtual row: a hint label or one row of a diagnostic message. `[u8; 4]` is the
///       straight RGBA ink. `Option<Severity>` is the message's severity, or nothing for a hint.
/// Why: The raster paints every text of every virtual row the same way; tests read positions from here.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type RowText = { line: number; rise: number; x: number; width: number; layout: Layout; ink: Rgba;
///   severity?: Severity };
/// ```
pub struct RowText {
    /// Source line whose block the text belongs to.
    pub line: usize,
    /// How far above the top of that line's code row the text's row starts, in logical pixels.
    pub rise: f32,
    /// Left edge in logical pixels from the start of the line's text.
    pub x: f32,
    /// Shaped width in logical pixels.
    pub width: f32,
    /// The shaped text.
    pub layout: Layout<u32>,
    /// Ink: the hint ink, or the ink of the message's severity.
    pub ink: [u8; 4],
    /// Severity of a message row; nothing for a hint.
    pub severity: Option<Severity>,
}

/// Everything one frame paints for annotations, positioned against its shaped rows.
pub struct AnnotationFrame {
    /// Underline runs, mildest severity first, so the worst is drawn on top where ranges overlap.
    pub underlines: Vec<Underline>,
    /// Texts of the virtual rows of the materialized lines: hints first, then messages, line by line.
    pub texts: Vec<RowText>,
    /// Right edge of the furthest virtual-row text, so the scroll range can reach it.
    pub extent: f32,
    /// Inks the raster uses.
    pub colors: AnnotationColors,
}

/// What: Add the underline runs of `mark` on `row` to `out`; `&mut Vec<Underline>` lends the list for appending.
/// Why: The marked characters come from the same range geometry as selection, so ligatures, tabs, CJK, and
///      combining marks are covered exactly. Like a selection, a range crossing the line end also marks the
///      terminator, so an empty line inside a range stays visible. A point gets a terminator-wide run:
///      after the text at a line end, centered on the boundary elsewhere.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function runs(row: ShapedRow, mark: Mark, scale: number, out: Underline[]): void;
/// ```
fn runs(row: &ShapedRow, mark: Mark, scale: f32, out: &mut Vec<Underline>) {
    let row_end = row.source_start + row.source_len();
    let end_x = row.caret_x(row_end, scale);
    if mark.start == mark.end {
        if mark.start < row.source_start || mark.start > row_end {
            return;
        }
        let x = row.caret_x(mark.start, scale);
        let mut left = x;
        if mark.start < row_end {
            left = (x - TERMINATOR_MARK / 2.0).max(0.0);
        }
        out.push(Underline {
            row: row.row,
            x: left,
            width: TERMINATOR_MARK,
            severity: mark.severity,
        });
        return;
    }
    for rect in row.range(mark.start, mark.end, scale) {
        out.push(Underline {
            row: row.row,
            x: rect.x,
            width: rect.width,
            severity: mark.severity,
        });
    }
    if mark.start <= row_end && mark.end > row_end {
        out.push(Underline {
            row: row.row,
            x: end_x,
            width: TERMINATOR_MARK,
            severity: mark.severity,
        });
    }
}

/// What: Pack the hints of one line onto hint rows. `row` is the line's shaped code row, `labels` its hints
///       in position order; `&mut TextShaper` is lent to measure each label. The answer pairs the number of
///       rows with one placement per hint (a tuple).
/// Why: Each hint stands at the exact pixel x of the position it annotates, so it sits above the place it
///      describes. A hint that would start less than [`HINT_GAP`] after the previous hint's end starts a new
///      row; like the reference editor's packing, only the current row is considered, so reading the rows top
///      to bottom follows the source left to right.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function pack(row: ShapedRow, labels: Label[], shaper: TextShaper, scale: number): [rows: number, places: HintPlace[]];
/// ```
pub fn pack(
    row: &ShapedRow,
    labels: &[Label],
    shaper: &mut TextShaper,
    scale: f32,
) -> (usize, Vec<HintPlace>) {
    let mut places = Vec::new();
    let mut rows: usize = 0;
    // Right edge of the last hint placed on the current row.
    let mut end: f32 = 0.0;
    for label in labels {
        let x = row.caret_x(label.position, scale);
        let width = shaper.row_layout(&label.text, scale).full_width() / scale;
        if rows == 0 || x < end + HINT_GAP {
            rows += 1;
        }
        places.push(HintPlace {
            row: rows - 1,
            position: label.position,
            x,
            width,
            // `clone` copies the label so the placement owns its text.
            text: label.text.clone(),
        });
        end = x + width;
    }
    return (rows, places);
}

/// What: Position every visible annotation against the frame's rows. `&mut TextShaper` is lent so virtual-row
///       texts can be shaped; the other inputs are lent read-only.
/// Why: Underlines follow the glyphs they mark. A hint takes its x from the painted row's own caret geometry
///      and a message row from its diagnostic's start, so both stand exactly above the characters they are
///      about. The cost per repaint is one text layout per visible hint and message row plus a pass over the
///      visible marks for each materialized row.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function layOut(view: ShapedView, visible: Visible, shaper: TextShaper, colors: AnnotationColors): AnnotationFrame;
/// ```
pub fn lay_out(
    view: &ShapedView,
    visible: &Visible,
    shaper: &mut TextShaper,
    colors: AnnotationColors,
) -> AnnotationFrame {
    let scale = view.viewport.scale;
    let mut underlines = Vec::new();
    for row in &view.rows {
        for mark in &visible.marks {
            runs(row, *mark, scale, &mut underlines);
        }
    }
    let mut texts = Vec::new();
    let mut extent: f32 = 0.0;
    for block in &visible.blocks {
        // What: `checked_sub` answers nothing for a line above the frame; `and_then` then asks the rows for
        //       the entry at that index, which is nothing past the last row; `let ... else` skips the block.
        // Why: Rows are materialized in line order from the frame's first line.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const row = view.rows[block.line - view.viewport.first]; if (!row) continue;
        // ```
        let Some(row) = block
            .line
            .checked_sub(view.viewport.first)
            .and_then(|index| return view.rows.get(index))
        else {
            continue;
        };
        for hint in &block.hints {
            let layout = shaper.row_layout(&hint.text, scale);
            let x = row.caret_x(hint.position, scale);
            let width = layout.full_width() / scale;
            extent = extent.max(x + width);
            texts.push(RowText {
                line: block.line,
                rise: block.hint_rise(hint.row),
                x,
                width,
                layout,
                ink: colors.hint,
                // `None`: a hint has no severity.
                severity: None,
            });
        }
        for (index, message) in block.messages.iter().enumerate() {
            let layout = shaper.row_layout(&message.text, scale);
            let mut x = row.caret_x(message.start, scale);
            if message.continued {
                x += CONTINUATION_INDENT;
            }
            let width = layout.full_width() / scale;
            extent = extent.max(x + width);
            texts.push(RowText {
                line: block.line,
                rise: block.message_rise(index),
                x,
                width,
                layout,
                ink: colors.severity(message.severity),
                // `Some(...)` records the severity the row's ink and first word show.
                severity: Some(message.severity),
            });
        }
    }
    // What: `sort_by_key` is stable; `3 - rank` puts hints first and errors last.
    // Why: Where ranges of different severities overlap, the worst line style is painted on top.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // underlines.sort((a, b) => rank(b.severity) - rank(a.severity));
    // ```
    underlines.sort_by_key(|run| return 3 - rank(run.severity));
    return AnnotationFrame {
        underlines,
        texts,
        extent,
        colors,
    };
}
