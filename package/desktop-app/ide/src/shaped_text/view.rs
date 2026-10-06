//! Reading geometry of a prepared frame: pointer hits, the caret, selection and range rectangles, and moving
//! the frame when only rows above it changed.

/// The frame record these methods belong to and the width of a selected line end.
use super::{ShapedView, TERMINATOR_MARK};
/// Canonical source and the current reading position.
use crate::document::Document;
/// The one vertical mapping: where code rows start and how tall rows and the caret are.
use crate::row_map::{CARET_HEIGHT, CARET_INSET, CODE_ROW, RowMap};
/// Rectangles handed to the window for the caret, selections, and ranges.
use crate::shaped_row::ReadingRect;

/// Resolve reading geometry from the exact layouts used to paint source glyphs.
impl ShapedView {
    /// What: Move this frame to where `map` puts its first line, without reshaping or repainting; the answer
    ///       says whether anything moved. `&RowMap` lends the window's current mapping.
    /// Why: Virtual rows can appear or change above the materialized lines. The frame's own pixels are then
    ///      still right, only its place in the text is not: every row top and every cached rectangle shifts by
    ///      the same amount. The caller must have checked that the materialized lines themselves are unchanged.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// rebase(map: RowMap): boolean;
    /// ```
    pub fn rebase(&mut self, map: &RowMap) -> bool {
        if self.map == *map {
            return false;
        }
        let shift = map.block_top(self.viewport.first) - self.origin;
        // `clone` copies the mapping so rows outside the frame are placed by the current one.
        self.map = map.clone();
        if shift == 0.0 {
            return false;
        }
        self.origin += shift;
        for row in &mut self.rows {
            row.top += shift;
        }
        for rectangle in &mut self.selections {
            rectangle.y += shift;
        }
        for rectangle in &mut self.matches {
            rectangle.y += shift;
        }
        return true;
    }

    /// Convert a pointer to a source character using the shaping engine's hit test.
    pub fn hit(&self, document: &Document, row: usize, x: f32) -> usize {
        for shaped in &self.rows {
            if shaped.row == row {
                return shaped.hit(x, self.viewport.scale);
            }
        }
        let bounded_row = row.min(document.text().len_lines().saturating_sub(1));
        return document.text().line_to_char(bounded_row);
    }

    /// Return caret x using exactly the same glyph advances as drawing.
    pub fn caret(&self, document: &Document) -> ReadingRect {
        let head = document.position().head;
        let row = document.text().char_to_line(head);
        let mut x = 0.0;
        for shaped in &self.rows {
            if shaped.row == row {
                x = shaped.caret_x(head, self.viewport.scale);
            }
        }
        return ReadingRect {
            x,
            y: self.map.code_top(row) + CARET_INSET,
            width: 2.0,
            height: CARET_HEIGHT,
        };
    }

    /// Return per-line selection rectangles without including annotations in source.
    /// A selected line terminator is marked after the line's text, so a selected empty line stays visible.
    pub fn selection(&self, document: &Document) -> Vec<ReadingRect> {
        let position = document.position();
        let start = position.anchor.min(position.head);
        let end = position.anchor.max(position.head);
        let mut result = Vec::new();
        for shaped in &self.rows {
            result.extend(shaped.range(start, end, self.viewport.scale));
            // The terminator sits after the row's visible text and has no glyph of its own.
            let row_end = shaped.source_start + shaped.source_len();
            if start <= row_end && end > row_end {
                result.push(ReadingRect {
                    x: shaped.caret_x(row_end, self.viewport.scale),
                    y: shaped.top,
                    width: TERMINATOR_MARK,
                    height: CODE_ROW,
                });
            }
        }
        return result;
    }

    /// Return per-line rectangles for any source character range in the materialized rows.
    /// Selection and in-file find matches share this path, so neither reshapes a ligature.
    pub fn range(&self, start: usize, end: usize) -> Vec<ReadingRect> {
        let mut result = Vec::new();
        for shaped in &self.rows {
            result.extend(shaped.range(start, end, self.viewport.scale));
        }
        return result;
    }
}
