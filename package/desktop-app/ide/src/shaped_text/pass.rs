//! Whole-file passes over the row cache:
//!  bringing every line of a range into it at a wrap width,
//!  and breaking kept rows again at a new width without shaping them.

/// The shaper whose cache the passes fill,
///  and the request that names one line.
use super::{RowRequest, TextShaper};
/// Canonical source the lines are read from.
use crate::document::Document;
/// The kept row that is broken again.
use crate::shaped_row::ShapedRow;
/// Syntax classifications the rows are shaped with.
use crate::source_style::StyleSpan;
/// Tabs that stay on the first visual row keep their corrections when the row is broken again.
use crate::tab_layout::tabs_on_first_row;
/// Breaking a kept layout exactly as a fresh one is broken.
use crate::wrap::{break_wrapped, has_wrap_width};
/// Lines handled by one chunk.
use std::ops::Range;

/// What:
///  How a line came to be in the cache:
///  it was already there,
///  a kept row was broken again,
///  or the line was shaped.
/// Why:
///  The tests and the structural counters tell the three apart;
///  a resize must produce no `Shaped`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Ensured = 'kept' | 'rebroken' | 'shaped';
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Ensured {
    /// The cache already held the line at this width.
    Kept,
    /// A row kept at another width was broken again in place.
    Rebroken,
    /// The line was shaped from its text.
    Shaped,
}

/// What:
///  The visual rows of a range of lines and what it cost to find them.
/// Why:
///  A pass reports the rows to the window and the counts to the structural tests.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Measured = { lines: [line: number, rows: number][]; shaped: number; rebroken: number };
/// ```
#[derive(Clone, Debug, Default)]
pub struct Measured {
    /// The visual rows of each line of the range,
    ///  in line order.
    pub lines: Vec<(usize, usize)>,
    /// Lines shaped from their text.
    pub shaped: u64,
    /// Kept rows broken again at the new width.
    pub rebroken: u64,
}

/// Passes over the cache.
impl TextShaper {
    /// How many shaped lines the cache keeps;
    ///  a worker that shapes a whole file raises it above the window thread's few hundred.
    pub fn keep_layouts(&mut self, lines: usize) {
        self.rows.set_capacity(lines);
    }

    /// Kept rows broken again at a new wrap width instead of being shaped again, since this shaper was made.
    pub fn rebroken_rows(&self) -> u64 {
        return self.rebroken_rows;
    }

    /// Evict the cached lines farthest from `centre` beyond the cache's capacity.
    pub fn trim_rows(&mut self, centre: usize) {
        self.rows.trim(centre);
    }

    /// Lines the cache holds, at any wrap width.
    pub fn kept_rows(&self) -> usize {
        return self.rows.len();
    }

    /// What:
    ///  Break a kept row again at `width` logical pixels, and answer whether that was possible.
    ///  A row whose tabs are not all on the first visual row, before or after, is left for the caller to shape again.
    /// Why:
    ///  Breaking a laid-out line again takes about a microsecond,
    ///  shaping it about fifteen;
    ///  a tab on a continuation row was widened to a stop that depends on where the row broke,
    ///  so such a line has to be shaped again.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// rebreak(row: ShapedRow, scale: number, width: number): boolean;
    /// ```
    pub fn rebreak(&mut self, row: &mut ShapedRow, scale: f32, width: f32) -> bool {
        if !has_wrap_width(width) {
            return false;
        }
        let tabbed = !row.projection.tabs.is_empty();
        if tabbed && !tabs_on_first_row(&row.layout, &row.projection.tabs) {
            return false;
        }
        // The advance is physical, and the indent is built in logical pixels (see `wrapped_line_layout`).
        let space = self.space_advance(scale) / scale;
        break_wrapped(&mut row.layout, &row.projection.text, scale, width, space);
        if tabbed && !tabs_on_first_row(&row.layout, &row.projection.tabs) {
            return false;
        }
        row.wrap = Some(width);
        return true;
    }

    /// What:
    ///  Make the cache hold the line `request` names at the requested wrap width,
    ///  breaking a kept row again when the line is held at another width,
    ///  shaping only when it must.
    /// Why:
    ///  Tile builds and whole-file passes bring lines in the same way,
    ///  so the same line always ends up as the same row.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// ensureRow(document: Document, styles: StyleSpan[], request: RowRequest): Ensured;
    /// ```
    pub(super) fn ensure_row(
        &mut self,
        document: &Document,
        styles: &[StyleSpan],
        request: RowRequest,
    ) -> Ensured {
        if self.rows.get(request.row, request.wrap).is_some() {
            return Ensured::Kept;
        }
        if let Some(width) = request.wrap
            && has_wrap_width(width)
            && let Some(mut stale) = self.rows.remove(request.row)
            && self.rebreak(&mut stale, request.scale, width)
        {
            self.rebroken_rows += 1;
            self.rows.insert(stale);
            return Ensured::Rebroken;
        }
        let fresh = self.shape_row(
            document,
            (request.row, 0.0),
            request.scale,
            styles,
            request.baseline,
            request.wrap,
        );
        self.shaped_rows += 1;
        self.rows.insert(fresh);
        return Ensured::Shaped;
    }

    /// What:
    ///  Bring every line of `lines` into the cache at `wrap` and answer the visual rows of each.
    ///  Lines past the text are skipped.
    /// Why:
    ///  The background pass measures the whole file chunk by chunk and keeps the rows for later tiles and resizes.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// measureLines(document: Document, lines: Range<number>, scale: number, wrap: number | undefined,
    ///   styles: StyleSpan[]): Measured;
    /// ```
    pub fn measure_lines(
        &mut self,
        document: &Document,
        lines: Range<usize>,
        scale: f32,
        wrap: Option<f32>,
        styles: &[StyleSpan],
    ) -> Measured {
        self.rows.sync(document.revision(), scale);
        let baseline = self.baseline(scale);
        let end = lines.end.min(document.text().len_lines());
        let mut result = Measured::default();
        for row in lines.start..end {
            let request = RowRequest {
                row,
                scale,
                wrap,
                baseline,
            };
            match self.ensure_row(document, styles, request) {
                Ensured::Kept => {}
                Ensured::Rebroken => result.rebroken += 1,
                Ensured::Shaped => result.shaped += 1,
            }
            if let Some(kept) = self.rows.get(row, wrap) {
                result.lines.push((row, kept.visual_rows()));
            }
        }
        return result;
    }
}
