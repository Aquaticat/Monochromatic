//! Where one frame draws its annotations: underline segments under source glyphs, and a severity marker and
//! hint labels after each line's text. Every position comes from the shaped rows that paint the source,
//! and nothing is inserted into a row, so source geometry is the same with and without annotations.

/// The visible subset of the snapshots and the severity order.
use crate::annotation::{Mark, Visible, rank};
/// Line starts of the displayed text decide which row a marker or label belongs to.
use crate::document::Document;
/// Severities as the Language module names them.
use crate::language::diagnostics::Severity;
/// One shaped source row and its caret and range geometry.
use crate::shaped_row::ShapedRow;
/// The frame's shaped rows, the selected-terminator width, and the shaper that sets hint labels.
use crate::shaped_text::{ShapedView, TERMINATOR_MARK, TextShaper};
/// What: `Layout<u32>` is a shaped paragraph whose glyph brushes are numbers.
/// Why: Each hint label is shaped once per frame and painted by the raster like a source row.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type Layout } from 'parley';
/// ```
use parley::Layout;

/// What: Space between the end of a line's text and its first annotation, in logical pixels; `f32` is a 32-bit
///       float (sibling `f64`), the unit of every glyph advance.
/// Why: It is wider than the selected-terminator mark, so a selected line end never touches a marker or label.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const ITEM_GAP = 12;
/// ```
pub const ITEM_GAP: f32 = 12.0;
/// Width and height of the severity marker box after a line's text.
pub const MARKER_SIZE: f32 = 18.0;
/// Space between two annotations on one line.
pub const LABEL_GAP: f32 = 6.0;
/// Space between a hint label's box edge and its text.
pub const LABEL_PADDING: f32 = 5.0;

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

/// The severity marker after the text of a line where at least one diagnostic starts; it shows the worst one.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Marker {
    /// Source line.
    pub row: usize,
    /// Left edge of the marker box.
    pub x: f32,
    /// Worst severity starting on the line.
    pub severity: Severity,
}

/// One shaped hint label and its box after a line's text.
pub struct HintBox {
    /// Source line.
    pub row: usize,
    /// Left edge of the box; the text starts [`LABEL_PADDING`] further right.
    pub x: f32,
    /// Box width, including padding on both sides.
    pub width: f32,
    /// The shaped label.
    pub layout: Layout<u32>,
    /// Physical translation from the label's own baseline to the row's common source baseline.
    pub baseline_shift: f32,
}

/// Everything one frame paints for annotations, positioned against its shaped rows.
pub struct AnnotationFrame {
    /// Underline runs, mildest severity first, so the worst is drawn on top where ranges overlap.
    pub underlines: Vec<Underline>,
    /// Severity markers, one per line at most.
    pub markers: Vec<Marker>,
    /// Hint labels in source order.
    pub hints: Vec<HintBox>,
    /// Right edge of the furthest marker or label, so the scroll range can reach it.
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

/// What: Whether character `position` belongs to row `row` of `document`; the last line also owns the end
///       of the text.
/// Why: A marker belongs to the line where its diagnostic starts, a label to the line of its position.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function onRow(document: Document, row: number, position: number): boolean;
/// ```
fn on_row(document: &Document, row: usize, position: usize) -> bool {
    let text = document.text();
    let lines = text.len_lines();
    if position < text.line_to_char(row.min(lines)) {
        return false;
    }
    if row + 1 >= lines {
        return true;
    }
    return position < text.line_to_char(row + 1);
}

/// What: Position every visible annotation against the frame's rows. `&mut TextShaper` is lent so labels can
///       be shaped; the other inputs are lent read-only.
/// Why: Labels and markers start [`ITEM_GAP`] after the line's text and never move a source glyph, so late or
///      stale snapshots change only annotation pixels. The cost per repaint is one label layout per visible
///      label plus a pass over the visible marks for each materialized row.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function layOut(document: Document, view: ShapedView, visible: Visible, shaper: TextShaper,
///   colors: AnnotationColors): AnnotationFrame;
/// ```
pub fn lay_out(
    document: &Document,
    view: &ShapedView,
    visible: &Visible,
    shaper: &mut TextShaper,
    colors: AnnotationColors,
) -> AnnotationFrame {
    let scale = view.viewport.scale;
    let mut underlines = Vec::new();
    let mut markers = Vec::new();
    let mut hints = Vec::new();
    let mut extent: f32 = 0.0;
    for row in &view.rows {
        let row_end = row.source_start + row.source_len();
        // What: `Option<Severity>` is the worst severity found so far, or nothing.
        // Why: Only a line where a diagnostic starts gets a marker.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let worst: Severity | undefined;
        // ```
        let mut worst: Option<Severity> = None;
        for mark in &visible.marks {
            runs(row, *mark, scale, &mut underlines);
            if !on_row(document, row.row, mark.start) {
                continue;
            }
            // `is_none_or` is true without a previous severity, otherwise asks the closure whether this one is worse.
            if worst.is_none_or(|known| return rank(mark.severity) < rank(known)) {
                worst = Some(mark.severity);
            }
        }
        let mut x = row.caret_x(row_end, scale) + ITEM_GAP;
        let mut placed = false;
        if let Some(severity) = worst {
            markers.push(Marker {
                row: row.row,
                x,
                severity,
            });
            x += MARKER_SIZE + LABEL_GAP;
            placed = true;
        }
        for label in &visible.labels {
            if !on_row(document, row.row, label.position) {
                continue;
            }
            let layout = shaper.hint_layout(&label.text, scale);
            // What: `lines().next()` is the label's only line; `map_or` reads its baseline or uses the row's own.
            // Why: The label's baseline is moved onto the row's common source baseline.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const natural = layout.lines()[0]?.metrics.baseline ?? row.baseline;
            // ```
            let natural = layout
                .lines()
                .next()
                .map_or(row.baseline, |line| return line.metrics().baseline);
            let width = layout.full_width() / scale + 2.0 * LABEL_PADDING;
            hints.push(HintBox {
                row: row.row,
                x,
                width,
                layout,
                baseline_shift: row.baseline - natural,
            });
            x += width + LABEL_GAP;
            placed = true;
        }
        if placed {
            extent = extent.max(x - LABEL_GAP);
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
        markers,
        hints,
        extent,
        colors,
    };
}
