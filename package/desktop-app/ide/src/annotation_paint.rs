//! Diagnostic underline pixels: each severity has its own line style, so severity is never shown by color alone.
//!
//! Errors get a wavy line, warnings a dashed line, information a dotted line, and hint-severity problems
//! sparse dots. Runs are drawn into the source tile after the glyphs, below the common baseline.

/// Positioned underline runs and their inks.
use crate::annotation_layout::AnnotationFrame;
/// Severities as the Language module names them.
use crate::language::diagnostics::Severity;

/// What: Repeat length of the wave, dash, and sparse-dot patterns in logical pixels; `f32` is a 32-bit float
///       (sibling `f64`).
/// Why: Six pixels keep a wave visibly wavy and a dash visibly broken at 15 px source text.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const PERIOD = 6;
/// ```
pub const PERIOD: f32 = 6.0;
/// Height of the wave above and below its center line, in logical pixels.
pub const AMPLITUDE: f32 = 1.5;
/// Thickness of every underline style in logical pixels, rounded to whole physical rows and at least one.
pub const THICKNESS: f32 = 1.25;
/// Distance of the underline's center line below the common source baseline, in logical pixels.
pub const DROP: f32 = 3.0;

/// What: The tile being painted: premultiplied RGBA bytes and their physical size; `&'a mut [u8]` lends the
///       bytes for writing for as long as the record lives (`'a` names that span).
/// Why: Underlines go into the same image as the glyphs, so one upload shows both.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Tile = { bytes: Uint8Array; width: number; height: number };
/// ```
pub struct Tile<'a> {
    /// Row-major premultiplied RGBA bytes.
    pub bytes: &'a mut [u8],
    /// Physical width.
    pub width: u32,
    /// Physical height.
    pub height: u32,
}

/// What: Composite a straight RGBA color with extra coverage into one premultiplied pixel at byte `offset`.
/// Why: Partially covered edge pixels keep the line smooth without darkening the color.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function blend(bytes: Uint8Array, offset: number, color: Rgba, coverage: number): void;
/// ```
fn blend(bytes: &mut [u8], offset: usize, color: [u8; 4], coverage: f32) {
    let alpha = (f32::from(color[3]) * coverage.clamp(0.0, 1.0)).round();
    let inverse = 255.0 - alpha;
    for channel in 0..3 {
        let source = f32::from(color[channel]) * alpha / 255.0;
        let destination = f32::from(bytes[offset + channel]) * inverse / 255.0;
        // What: `as u8` truncates a float to a byte; the value is first limited to 255.
        // Why: Pixels are stored as bytes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // bytes[offset + channel] = Math.min(255, Math.round(source + destination));
        // ```
        bytes[offset + channel] = (source + destination).round().min(255.0) as u8;
    }
    let total = alpha + f32::from(bytes[offset + 3]) * inverse / 255.0;
    bytes[offset + 3] = total.round().min(255.0) as u8;
}

/// Whether the line style of `severity` draws at physical distance `along` from the run's left edge.
fn lit(severity: Severity, along: f32, scale: f32) -> bool {
    if severity == Severity::Error {
        return true;
    }
    if severity == Severity::Warning {
        // Four pixels drawn, two left out.
        return along.rem_euclid(PERIOD * scale) < 4.0 * scale;
    }
    if severity == Severity::Information {
        // Two-pixel dots as long as the gaps between them.
        return along.rem_euclid(4.0 * scale) < 2.0 * scale;
    }
    // One two-pixel dot per period.
    return along.rem_euclid(PERIOD * scale) < 2.0 * scale;
}

/// Vertical offset of the line's center at physical distance `along`: a triangle wave for errors, flat otherwise.
fn offset(severity: Severity, along: f32, scale: f32) -> f32 {
    if severity != Severity::Error {
        return 0.0;
    }
    let phase = (along / (PERIOD * scale)).rem_euclid(1.0);
    let mut wave = 3.0 - 4.0 * phase;
    if phase < 0.5 {
        wave = 4.0 * phase - 1.0;
    }
    return AMPLITUDE * scale * wave;
}

/// What: Draw one underline run over the physical `span` (left and right edge), centered on physical `line`.
///       `&mut Tile` lends the tile for writing; `(f32, f32)` is a pair (tuple) of floats.
/// Why: Each pixel column is covered in proportion to its overlap with the run; rows are whole pixels.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function underline(tile: Tile, span: [number, number], line: number, scale: number,
///   severity: Severity, color: Rgba): void;
/// ```
fn underline(
    tile: &mut Tile,
    span: (f32, f32),
    line: f32,
    scale: f32,
    severity: Severity,
    color: [u8; 4],
) {
    let (left, right) = span;
    // Whole pixel rows keep the line in its full ink; a line split over two rows reads as a paler color.
    let thickness = (THICKNESS * scale).round().max(1.0);
    // What: `as i32` truncates to a signed 32-bit integer (siblings `u32`, `i64`), clamped to the tile first.
    // Why: Pixel loops run over whole columns; a negative start would wrap an unsigned index.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const first = Math.max(0, Math.floor(left));
    // ```
    let first = left.floor().max(0.0) as i32;
    let last = right.ceil().min(tile.width as f32) as i32;
    for column in first..last {
        let x = column as f32;
        let across = (right.min(x + 1.0) - left.max(x)).clamp(0.0, 1.0);
        let along = x + 0.5 - left;
        if across <= 0.0 || !lit(severity, along, scale) {
            continue;
        }
        let center = line + offset(severity, along, scale);
        let top = (center - thickness / 2.0).round() as i32;
        for row in top..top + thickness as i32 {
            if row < 0 || row >= tile.height as i32 {
                continue;
            }
            // What: `as usize` converts the checked, non-negative coordinates to byte indices.
            // Why: Slices are indexed by `usize`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const index = (row * tile.width + column) * 4;
            // ```
            let index = (row as usize * tile.width as usize + column as usize) * 4;
            blend(tile.bytes, index, color, across);
        }
    }
}

/// What: Draw every underline run of `frame` into `tile`. `origin` pairs the first materialized line with the
///       tile's logical left edge; `baseline` is the rows' common physical baseline, `scale` physical per logical.
/// Why: The frame's runs are already ordered mildest first, so the worst style ends on top of an overlap.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function paintUnderlines(frame: AnnotationFrame, tile: Tile, origin: [first: number, horizontal: number],
///   baseline: number, scale: number): void;
/// ```
pub fn paint_underlines(
    frame: &AnnotationFrame,
    tile: &mut Tile,
    origin: (usize, f32),
    baseline: f32,
    scale: f32,
) {
    let (first, horizontal) = origin;
    for run in &frame.underlines {
        // `saturating_sub` stops at zero; a run above the tile cannot exist, because runs come from its rows.
        let row_y = run.row.saturating_sub(first) as f32 * 24.0 * scale;
        let line = row_y + baseline + DROP * scale;
        let left = (run.x - horizontal) * scale;
        let right = (run.x + run.width - horizontal) * scale;
        underline(
            tile,
            (left, right),
            line,
            scale,
            run.severity,
            frame.colors.severity(run.severity),
        );
    }
}
