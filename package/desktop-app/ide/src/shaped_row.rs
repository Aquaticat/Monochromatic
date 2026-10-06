//! One shaped source line and its reading geometry: caret position, pointer hit, and range rectangles.

/// Range rectangles are as tall as one code row.
use crate::row_map::CODE_ROW;
/// Source/display byte maps keep tabs and Unicode out of hit-test heuristics.
use crate::text_projection::Projection;
/// What: Import the shaping engine's paragraph, caret, and selection types.
/// Why: Caret, hit testing, and selection read the same glyph advances that painting uses.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Affinity, Cursor, Layout, Selection } from 'parley';
/// ```
use parley::{Affinity, Cursor, Layout, Selection};

/// What: A copyable rectangle record; `f32` is a 32-bit float (sibling `f64`), the unit of logical pixels here.
/// Why: Selection, find matches, and the caret hand the same shape to the native window.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ReadingRect = { x: number; y: number; width: number; height: number };
/// ```
#[derive(Clone, Copy, Debug)]
pub struct ReadingRect {
    /// Horizontal source coordinate.
    pub x: f32,
    /// Vertical source coordinate.
    pub y: f32,
    /// Horizontal extent.
    pub width: f32,
    /// Vertical extent.
    pub height: f32,
}

/// What: One source line shaped with one common baseline across all font fallback runs;
/// `usize` is an address-sized index (siblings `u32`, `u64`), `Layout<u32>` a paragraph whose brushes are numbers.
/// Why: Rope and string indexing take `usize`; numeric brushes keep syntax roles independent of colors.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ShapedRow = { row: number; top: number; sourceStart: number; projection: Projection; layout: Layout;
///   baseline: number; baselineShift: number };
/// ```
pub struct ShapedRow {
    /// Global logical source line.
    pub row: usize,
    /// Top of the line's code row in logical pixels from the top of the text, taken from the frame's
    /// [`crate::row_map::RowMap`]; zero for a row shaped outside a frame, which has no vertical position.
    pub top: f32,
    /// Global source character start.
    pub source_start: usize,
    /// Source/display mappings.
    pub projection: Projection,
    /// Shaped rich text, including syntax and selection brush roles.
    pub layout: Layout<u32>,
    /// Common baseline relative to the row in physical pixels.
    pub baseline: f32,
    /// Translation from Parley's natural baseline to the common source baseline.
    pub baseline_shift: f32,
}

/// Reading geometry of one row, shared by materialized viewport rows and rows shaped for caret movement.
impl ShapedRow {
    /// Number of source characters shown on this row, excluding its line terminator.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// get sourceLength(): number { return this.projection.sourceToByte.length - 1; }
    /// ```
    pub fn source_len(&self) -> usize {
        return self.projection.source_to_byte.len() - 1;
    }

    /// Physical x of the caret before row-local source character `local`.
    fn physical_x(&self, local: usize) -> f32 {
        let cursor = Cursor::from_byte_index(
            &self.layout,
            self.projection.source_to_byte[local.min(self.source_len())],
            Affinity::Downstream,
        );
        // What: `as f32` narrows the engine's 64-bit coordinate to the 32-bit float advances use.
        // Why: Parley's geometry uses `f64`; glyph advances and Slint coordinates use `f32`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return cursor.geometry(this.layout, 1).x0;
        // ```
        return cursor.geometry(&self.layout, 1.0).x0 as f32;
    }

    /// Grapheme boundary nearest to physical `x` for a row-local position the shaping engine proposed.
    ///
    /// The engine divides a multi-character cluster, such as a letter with a combining mark or a joined emoji,
    /// into equal parts and can propose a position between them. A caret there would split one grapheme,
    /// so the proposal moves to whichever neighboring boundary is nearer to the pointer.
    fn snapped(&self, local: usize, x: f32) -> usize {
        let mut before = 0;
        let mut after = self.source_len();
        // The stops ascend, so the last one at or before `local` and the first at or after it enclose it.
        for stop in &self.projection.stops {
            if *stop <= local {
                before = *stop;
            }
            if *stop >= local {
                after = *stop;
                break;
            }
        }
        if before == after {
            return local;
        }
        if (x - self.physical_x(before)).abs() <= (self.physical_x(after) - x).abs() {
            return before;
        }
        return after;
    }

    /// Source character boundary nearest to logical `x`, using the shaping engine's hit test.
    /// A point inside a widened tab resolves to the nearer edge of that tab,
    /// and a point inside a multi-character grapheme to the nearer edge of the whole grapheme.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// hit(x: number, scale: number): number;
    /// ```
    pub fn hit(&self, x: f32, scale: f32) -> usize {
        // What: `&self.layout` lends the paragraph to the hit test without moving it.
        // Why: The row keeps its layout for later caret and selection queries.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const cursor = Cursor.fromPoint(this.layout, x * scale, this.layout.height / 2);
        // ```
        let cursor = Cursor::from_point(&self.layout, x * scale, self.layout.height() / 2.0);
        let index = cursor.index().min(self.projection.byte_to_source.len() - 1);
        let proposed = self.projection.byte_to_source[index];
        return self.source_start + self.snapped(proposed, x * scale);
    }

    /// Logical x of the caret standing before global source character `position` on this row.
    /// Positions outside the row clamp to its start or to the end of its visible text.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// caretX(position: number, scale: number): number;
    /// ```
    pub fn caret_x(&self, position: usize, scale: f32) -> f32 {
        let local = position.saturating_sub(self.source_start);
        return self.physical_x(local) / scale;
    }

    /// Rectangles covering the part of the global source range `start..end` that lies on this row.
    /// Selection and in-file find matches share this path, so neither reshapes a ligature.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// range(start: number, end: number, scale: number): ReadingRect[];
    /// ```
    pub fn range(&self, start: usize, end: usize, scale: f32) -> Vec<ReadingRect> {
        // What: `Vec::new()` creates an empty growable list (siblings: fixed `[T; N]`, borrowed `&[T]`).
        // Why: A bidirectional selection can produce several rectangles on one row.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const result: ReadingRect[] = [];
        // ```
        let mut result = Vec::new();
        let len = self.source_len();
        let first = start.saturating_sub(self.source_start).min(len);
        let last = end.saturating_sub(self.source_start).min(len);
        if first == last {
            return result;
        }
        let anchor = Cursor::from_byte_index(
            &self.layout,
            self.projection.source_to_byte[first],
            Affinity::Downstream,
        );
        let focus = Cursor::from_byte_index(
            &self.layout,
            self.projection.source_to_byte[last],
            Affinity::Upstream,
        );
        let selection = Selection::new(anchor, focus);
        for (rect, _) in selection.geometry(&self.layout) {
            result.push(ReadingRect {
                x: rect.x0 as f32 / scale,
                y: self.top,
                width: (rect.x1 - rect.x0) as f32 / scale,
                height: CODE_ROW,
            });
        }
        return result;
    }
}
