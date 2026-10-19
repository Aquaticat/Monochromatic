//! The bands the minimap's picture is rendered in:
//!  consecutive stretches of the text,
//!  each short enough that its raster at the window's width stays a small part of the raster limit.

/// A clip is two distances below the first line's block.
use crate::shaped_text::Clip;
/// The unit the clip edges are rounded to,
/// and the vertical mapping that says which lines a stretch holds.
use crate::row_map::{CODE_ROW, RowMap};
/// The most bytes any raster may hold.
use crate::text_raster::MAX_RASTER_BYTES;
/// A band's span of the text.
use std::ops::Range;

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
///  The bands that cover the whole text of `map`,
///  in order,
///  for rasters `columns` pixels wide at `scale`.
/// Why:
///  The stretches are consecutive and cover the text exactly,
///  so the picture is their reductions side by side;
///  a line taller than a stretch is rendered in as many bands as it takes,
///  each with the rows of it that fall in its stretch.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function plan(map: RowMap, columns: number, scale: number): Band[];
/// ```
pub fn plan(map: &RowMap, columns: u64, scale: f32) -> Vec<Band> {
    let height = map.height();
    let step = band_height(columns, scale);
    let mut bands = Vec::new();
    let mut top = 0.0_f32;
    while top < height {
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
            last: bottom >= height,
        });
        top = bottom;
    }
    return bands;
}
