//! The bands the minimap's picture is rendered in:
//!  consecutive stretches of the text,
//!  each short enough that its raster at the window's width stays a small part of the raster limit.

/// The unit the clip edges are rounded to,
/// and the vertical mapping that says which lines a stretch holds.
use crate::row_map::{CODE_ROW, RowMap};
/// A clip is two distances below the first line's block,
/// and a raster's width follows the wrap width.
use crate::shaped_text::{Clip, raster_width};
/// The most bytes any raster may hold.
use crate::text_raster::MAX_RASTER_BYTES;
/// A band's span of the text.
use std::ops::Range;

/// What:
///  Least display scale the picture is built at.
/// Why:
///  A scale of zero or less would make every raster empty;
///  no real display is this small.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const MIN_SCALE = 0.25;
/// ```
pub const MIN_SCALE: f32 = 0.25;

/// What:
///  Most bytes the raster of one band may hold,
///  a sixteenth of the raster limit.
/// Why:
///  Only one band is held at full size at a time,
///  and the headroom keeps a band far from the limit the window's own tile is held to;
///  measured bands of this size cost a few milliseconds each.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const BAND_BYTES = MAX_RASTER_BYTES / 16;
/// ```
pub const BAND_BYTES: u64 = MAX_RASTER_BYTES / 16;

/// What:
///  One band:
///  the lines it renders,
///  the clip of them its raster holds,
///  and the stretch of the text it is responsible for.
/// Why:
///  A band renders a little more than its stretch,
///  because a clip is whole code rows below the first line's block;
///  only the stretch counts in the picture.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Band = { first: number; count: number; clip: Clip; span: [number, number]; last: boolean };
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Band {
    /// First line rendered.
    pub first: usize,
    /// Lines rendered.
    pub count: usize,
    /// The part of those lines the raster holds.
    pub clip: Clip,
    /// The stretch of the text this band answers for,
    /// in logical pixels from the top of the text.
    pub span: Range<f32>,
    /// Whether this is the last band,
    /// which also answers for the output rows below the text's end.
    pub last: bool,
}

/// The rows a band answers for.
impl Band {
    /// The source rows,
    /// in physical pixels from the top of the text at `scale`,
    /// this band answers for;
    /// the last band answers for everything below as well.
    pub fn assigned(&self, scale: f32) -> Range<f64> {
        let from = f64::from(self.span.start) * f64::from(scale);
        if self.last {
            return from..f64::INFINITY;
        }
        return from..f64::from(self.span.end) * f64::from(scale);
    }
}

/// What:
///  How tall a stretch of text a band answers for,
///  in logical pixels,
///  so that its raster of `columns` pixels at `scale` holds at most [`BAND_BYTES`].
/// Why:
///  The clip rounds both edges out to whole code rows,
///  and one more row covers the rounding of the raster up to whole pixels;
///  the answer is whole code rows and never under two.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function bandHeight(columns: number, scale: number): number;
/// ```
pub fn band_height(columns: u64, scale: f32) -> f32 {
    let rows = BAND_BYTES / 4 / columns.max(1);
    let logical = rows as f32 / scale.max(f32::MIN_POSITIVE);
    let spare = logical - 3.0 * CODE_ROW;
    return ((spare / CODE_ROW).floor() * CODE_ROW).max(2.0 * CODE_ROW);
}

/// What:
///  Physical pixels in a row of a band's raster,
///  for a text wrapped at `wrap` shown at `scale`.
/// Why:
///  The window thread and the worker both size bands from it,
///  so they agree on where the cuts are.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function columnsOf(wrap: number | undefined, scale: number): number;
/// ```
pub fn columns_of(wrap: Option<f32>, scale: f32) -> u64 {
    return (raster_width(wrap) * scale.max(MIN_SCALE)).ceil() as u64;
}

/// What:
///  How tall a stretch of text one band answers for,
///  in logical pixels, for a text wrapped at `wrap` shown at `scale`.
/// Why:
///  The cuts of a text stand at multiples of this from its top,
///  so the window thread can name the bands the track shows without the worker.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function bandStep(wrap: number | undefined, scale: number): number;
/// ```
pub fn band_step(wrap: Option<f32>, scale: f32) -> f32 {
    return band_height(columns_of(wrap, scale), scale.max(MIN_SCALE));
}

/// What:
///  How many bands of `step` logical pixels cover a text `height` logical pixels tall.
/// Why:
///  The window thread and the worker count the bands the same way,
///  so a range of band numbers means the same bands to both.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function bandCount(height: number, step: number): number;
/// ```
pub fn band_count(height: f32, step: f32) -> usize {
    if height <= 0.0 || step <= 0.0 {
        return 0;
    }
    return (height / step).ceil() as usize;
}

/// What:
///  The bands numbered `window` of the text of `map`,
///  in order,
///  for rasters `columns` pixels wide at `scale`.
/// Why:
///  Band `n` stands from `n` steps below the top of the text whatever the window,
///  so scrolling moves the window and never a cut;
///  the stretches are consecutive and cover the text exactly,
///  so the picture is their reductions side by side;
///  a line taller than a stretch is rendered in as many bands as it takes,
///  each with the rows of it that fall in its stretch.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function plan(map: RowMap, columns: number, scale: number, window: [number, number]): Band[];
/// ```
pub fn plan(map: &RowMap, columns: u64, scale: f32, window: Range<usize>) -> Vec<Band> {
    let height = map.height();
    let step = band_height(columns, scale);
    let count = band_count(height, step);
    let mut bands = Vec::new();
    for index in window.start..window.end.min(count) {
        let top = index as f32 * step;
        let bottom = (top + step).min(height);
        let first = map.line_at(top);
        let last_line = map.line_at((bottom - 0.01).max(top));
        let first_top = map.block_top(first);
        let ends = map.block_top(last_line + 1) - first_top;
        let from = ((top - first_top) / CODE_ROW).floor().max(0.0) * CODE_ROW;
        let to = (((bottom - first_top) / CODE_ROW).ceil() * CODE_ROW)
            .min(ends)
            .max(from + CODE_ROW);
        bands.push(Band {
            first,
            count: last_line - first + 1,
            clip: Clip {
                top: from,
                bottom: to,
            },
            span: top..bottom,
            last: index + 1 == count,
        });
    }
    return bands;
}
