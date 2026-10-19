//! The units a picture is built from.
//!  A unit is what is rendered,
//! reduced,
//! and kept together:
//!  an exact unit is one band of consecutive text;
//!  a sampled unit is one output row of a squeezed picture,
//!  made of a few code rows picked evenly from the text that row stands for.

/// A band says which lines and which part of them to render.
use super::plan::{Band, plan};
/// The unit of the clip edges,
/// and the vertical mapping.
use crate::row_map::{CODE_ROW, RowMap};
/// A clip is two distances below the first line's block.
use crate::shaped_text::Clip;
/// The span of a piece in the source's rows.
use std::ops::Range;

/// What:
///  Most code rows of a squeezed picture's output row that the full picture renders.
/// Why:
///  A text with more rows than this for each output row is sampled:
///  the picture then costs a bounded number of rows however long the text is,
///  and the rows picked evenly give an unbiased estimate of the average.
///  Measured costs of a row are in the handover.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const SAMPLES = 8;
/// ```
pub const SAMPLES: usize = 8;

/// What:
///  Which rows of the text a picture renders.
/// Why:
///  The first picture of a long text stands on screen quickly with one row picked for each output row;
///  the full one follows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Density = { kind: 'exact' } | { kind: 'sampled'; rows: number };
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Density {
    /// Every row of the text.
    Exact,
    /// This many rows for each output row.
    Sampled(
        /// How many rows are picked for each output row.
        usize,
    ),
}

/// What:
///  One rendering and where its rows go:
///  the band to render,
///  the stretch of source rows it answers for,
///  and whether its rows are stretched over that stretch.
/// Why:
///  An exact piece answers for the rows it holds;
///  a sampled piece is one row that stands for a longer stretch,
///  so each of its rows counts for more source rows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Piece = { band: Band; assigned: [number, number]; stretch: boolean };
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Piece {
    /// What to render.
    pub band: Band,
    /// The source rows,
    /// in physical pixels from the top of the text,
    /// this piece answers for;
    /// the last exact piece answers for everything below as well.
    pub assigned: Range<f64>,
    /// Whether the rendered rows are stretched over `assigned`.
    pub stretch: bool,
}

/// What:
///  The pieces whose reductions make one unit of the picture.
/// Why:
///  The cache keeps and replaces a unit as a whole.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Unit = { pieces: Piece[] };
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Unit {
    /// The renderings of the unit.
    pub pieces: Vec<Piece>,
}

/// Output rows a picture's text stands for,
/// in code rows:
/// how many code rows of the text one output row covers.
pub fn rows_per_output(ratio: f64) -> f64 {
    return 1.0 / (f64::from(CODE_ROW) * ratio.max(f64::MIN_POSITIVE));
}

/// What:
///  The density the full picture of a text is rendered at,
///  for `ratio` output rows for each source row.
/// Why:
///  A text that squeezes to more than [`SAMPLES`] code rows for each output row is sampled.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function fullDensity(ratio: number): Density;
/// ```
pub fn full_density(ratio: f64) -> Density {
    if rows_per_output(ratio) > SAMPLES as f64 {
        return Density::Sampled(SAMPLES);
    }
    return Density::Exact;
}

/// The band of the single code row of the text that physical row `row` falls in,
/// rendered for the stretch `assigned`.
fn sample(map: &RowMap, row: f64, scale: f32) -> Band {
    let y = (row / f64::from(scale)) as f32;
    let line = map.line_at(y);
    let first_top = map.block_top(line);
    let ends = map.block_top(line + 1) - first_top;
    let top = (((y - first_top) / CODE_ROW).floor() * CODE_ROW)
        .max(0.0)
        .min((ends - CODE_ROW).max(0.0));
    return Band {
        first: line,
        count: 1,
        clip: Clip {
            top,
            bottom: top + CODE_ROW,
        },
        span: y..y,
        last: false,
    };
}

/// What:
///  The sampled units of a text `height` logical pixels tall:
///  for each output row,
///  `rows` pieces,
///  each for an equal part of the text that output row stands for and holding the code row at its middle.
/// Why:
///  An output row is the average of the text it covers;
///  equal parts each represented by one row estimate that average,
///  and the text below its end counts as transparent.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function sampled(map: RowMap, ratio: number, scale: number, outputRows: number, rows: number): Unit[];
/// ```
fn sampled(map: &RowMap, ratio: f64, scale: f32, output_rows: usize, rows: usize) -> Vec<Unit> {
    let extent = f64::from(map.height()) * f64::from(scale);
    let mut units = Vec::new();
    for output in 0..output_rows {
        let from = output as f64 / ratio;
        let to = ((output + 1) as f64 / ratio).min(extent);
        if to <= from {
            continue;
        }
        let share = (to - from) / rows as f64;
        let mut pieces = Vec::new();
        for index in 0..rows {
            let start = from + share * index as f64;
            let part = start..start + share;
            let middle = (part.start + part.end) / 2.0;
            pieces.push(Piece {
                band: sample(map, middle, scale),
                assigned: part,
                stretch: true,
            });
        }
        units.push(Unit { pieces });
    }
    return units;
}

/// What:
///  The units of a picture of `map`'s text at `density`:
///  `output_rows` rows tall for `ratio` output rows for each source row,
///  rendered in rasters `columns` pixels wide at `scale`.
/// Why:
///  Both kinds of unit cover the picture exactly,
///  and the cache keeps them in this order.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function units(map: RowMap, density: Density, ratio: number, scale: number, columns: number, outputRows: number): Unit[];
/// ```
pub fn units(
    map: &RowMap,
    density: Density,
    geometry: (f64, f32, u64),
    output_rows: usize,
) -> Vec<Unit> {
    let (ratio, scale, columns) = geometry;
    if let Density::Sampled(rows) = density {
        return sampled(map, ratio, scale, output_rows, rows.max(1));
    }
    let mut units = Vec::new();
    for band in plan(map, columns, scale) {
        let from = f64::from(band.span.start) * f64::from(scale);
        let to = if band.last {
            f64::INFINITY
        } else {
            f64::from(band.span.end) * f64::from(scale)
        };
        units.push(Unit {
            pieces: vec![Piece {
                band,
                assigned: from..to,
                stretch: false,
            }],
        });
    }
    return units;
}
