//! The minimap's picture:
//! the whole text in visual rows,
//! one pixel for each source column,
//!  built from the vertical mapping and the syntax classes,
//! within a work budget.

/// Where the picture's rows come from and how tall it is.
use super::geometry::Geometry;
/// The glyph cells of a row and their painting.
use super::paint::{Cell, paint_row};
/// Canonical text as a rope,
/// read by line and by character range.
use crate::document::Document;
/// The one vertical mapping:
/// which line and visual row each pixel of the picture shows.
use crate::row_map::{CODE_ROW, RowMap};
/// Shaping finds where a wrapped line breaks;
/// its work estimate bounds the budget.
use crate::shaped_text::{TextShaper, line_work};
/// Syntax classes by character offset.
use crate::source_style::StyleSpan;
/// The palette the source glyphs are painted with,
/// in both schemes.
use crate::text_raster::{CodeColors, ink};
/// A visual row is a range of characters of its line.
use std::ops::Range;

/// What:
///  Opacity the whole picture is composited with.
/// Why:
///  CodeGlance Pro's `GlancePanel.paintComponent` draws the picture with `srcOver0_8`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const IMAGE_ALPHA = 0.8;
/// ```
pub const IMAGE_ALPHA: f32 = 0.8;

/// What:
///  Columns a tab advances in the picture.
/// Why:
///  CodeGlance Pro's `MainMinimap.update` moves four pixels for a tab (`code 9 -> x += 4`) and one for every other
///  character.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const TAB_COLUMNS = 4;
/// ```
pub const TAB_COLUMNS: usize = 4;

/// What:
///  Work,
/// in the units of `line_work`,
/// the first picture of a text may spend on shaping wrapped lines.
/// Why:
///  The first picture stands on screen quickly:
/// a line it cannot afford is cut into rows of equal width
///  instead of shaped,
/// and a second,
/// full build follows when that happened.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const QUICK_WORK = 250_000;
/// ```
pub const QUICK_WORK: usize = 250_000;

/// What:
///  Work,
/// in the units of `line_work`,
/// a full picture may spend on shaping wrapped lines.
/// Why:
///  The picture samples at most one line for each pixel row,
/// so ordinary text costs a small part of this;
///  the bound is for lines that cost a great deal each,
/// such as lines with many tabs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const FULL_WORK = 5_000_000;
/// ```
pub const FULL_WORK: usize = 5_000_000;

/// What:
///  How many pixel rows are built between two looks at the cancel flag.
/// Why:
///  A newer wanted picture stops the older one within a few hundred microseconds.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const CANCEL_EVERY = 16;
/// ```
const CANCEL_EVERY: usize = 16;

/// What:
///  How much of a glyph's weight each pixel row of a source row gets,
/// by how many pixel rows the row has.
/// Why:
///  CodeGlance Pro's "clean" renderer (`BaseMinimap.renderClean`):
/// the first pixel row of four stays empty so
///  rows of text are told apart,
/// and the others carry 0.6 of the glyph's weight.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const CLEAN_WEIGHTS: number[][] = [[0.6], [0.3, 0.6], [0.1, 0.6, 0.6], [0, 0.6, 0.6, 0.6]];
/// ```
const CLEAN_WEIGHTS: [[f32; 4]; 4] = [
    [0.6, 0.0, 0.0, 0.0],
    [0.3, 0.6, 0.0, 0.0],
    [0.1, 0.6, 0.6, 0.0],
    [0.0, 0.6, 0.6, 0.6],
];

/// What:
///  The question a build asks every few pixel rows:
///  whether its result is still wanted.
/// Why:
///  A newer request or a closed window makes the rest of the build wasted work,
///  and the build ends early with nothing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// interface Cancel { isCancelled(): boolean }
/// ```
pub trait Cancel {
    /// Whether the build should stop.
    fn is_cancelled(&self) -> bool;
}

/// What:
///  What a build reads:
/// the text,
/// its syntax classes,
/// the vertical mapping,
/// the palette,
/// and the sizes.
/// Why:
///  Every field is borrowed from a snapshot the worker owns,
/// so a build never touches window state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Input = { document: Document; styles: StyleSpan[]; map: RowMap; colors: CodeColors; wrap?: number;
///   scale: number; view: number; width: number };
/// ```
pub struct Input<'a> {
    /// The text,
    /// as the snapshot the job was taken from.
    pub document: &'a Document,
    /// Syntax classes by character offset,
    /// ascending.
    pub styles: &'a [StyleSpan],
    /// Where every visual row is;
    /// the picture is this map squeezed or not.
    pub map: &'a RowMap,
    /// The palette of the source glyphs,
    /// with the scheme it belongs to.
    pub colors: CodeColors,
    /// The width wrapped lines are broken at,
    /// in logical pixels;
    /// nothing while the view has no width.
    pub wrap: Option<f32>,
    /// Physical pixels per logical pixel.
    pub scale: f32,
    /// Height of the view,
    /// in logical pixels,
    /// which is the most the picture can be.
    pub view: f32,
    /// Width of the picture,
    /// in logical pixels;
    /// one pixel is one source column.
    pub width: f32,
}

/// What:
///  What one build cost and what it had to leave rough.
/// Why:
///  The worker logs it and the tests assert the bounds from it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Stats = { pixelRows: number; lines: number; shapedLines: number; roughLines: number; work: number };
/// ```
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Stats {
    /// Pixel rows built.
    pub pixel_rows: usize,
    /// Distinct source lines the picture drew.
    pub lines: usize,
    /// Wrapped lines shaped to find their breaks.
    pub shaped_lines: usize,
    /// Wrapped lines cut into rows of equal width because their shaping did not fit the budget.
    pub rough_lines: usize,
    /// Work charged for the shaped lines.
    pub work: usize,
}

/// What:
///  A finished picture:
/// premultiplied RGBA bytes,
/// row by row,
/// and what it cost.
/// Why:
///  The window thread turns the bytes into an image and nothing else.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Built = { width: number; height: number; bytes: Uint8Array; stats: Stats };
/// ```
#[derive(Clone, Debug)]
pub struct Built {
    /// Physical pixel width.
    pub width: u32,
    /// Physical pixel height.
    pub height: u32,
    /// Premultiplied RGBA bytes.
    pub bytes: Vec<u8>,
    /// What the build cost.
    pub stats: Stats,
}

/// What:
///  The visual rows of one source line,
/// as character ranges of the text,
/// and its indent.
/// Why:
///  Consecutive pixel rows mostly fall on the same line,
/// so the last one is kept.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type LineRows = { line: number; rows: [number, number][]; indent: number };
/// ```
struct LineRows {
    /// Zero-based source line.
    line: usize,
    /// Character range of each visual row,
    /// in the text.
    rows: Vec<Range<usize>>,
    /// Columns of blanks the line starts with;
    /// a continuation row starts one column past them.
    indent: usize,
}

/// What:
///  What the build has left to spend on shaping,
/// and what it spent.
/// Why:
///  A wrapped line is charged before it is shaped,
/// so a line that does not fit stops short of its cost.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Spending = { left: number; spent: number };
/// ```
struct Spending {
    /// Work still allowed.
    left: usize,
    /// Work charged so far.
    spent: usize,
}

/// Charge for shaping.
impl Spending {
    /// Charge `work` when it fits what is left;
    /// answer whether it was charged.
    fn charge(&mut self, work: usize) -> bool {
        if work > self.left {
            return false;
        }
        self.left -= work;
        self.spent += work;
        return true;
    }
}

/// What:
///  Logical width of one source column,
/// which is one space of the source font.
/// Why:
///  A click on the minimap names a column by its pixel;
/// the text position it stands for is that many advances in.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function columnAdvance(shaper: TextShaper, scale: number): number;
/// ```
pub fn column_advance(shaper: &mut TextShaper, scale: f32) -> f32 {
    return shaper.space_advance(scale) / scale;
}

/// Number of characters of `line` without its terminator.
fn visible_length(document: &Document, line: usize) -> usize {
    let slice = document.text().line(line);
    let mut length = slice.len_chars();
    while length > 0 && matches!(slice.char(length - 1), '\n' | '\r') {
        length -= 1;
    }
    return length;
}

/// Columns of blanks `line` starts with,
/// a tab counting [`TAB_COLUMNS`].
fn indent_columns(document: &Document, line: usize) -> usize {
    let mut columns = 0;
    for character in document.text().line(line).chars() {
        match character {
            ' ' => columns += 1,
            '\t' => columns += TAB_COLUMNS,
            _ => break,
        }
    }
    return columns;
}

/// What:
///  The visual rows of `line`:
/// one range for a line the map holds as one row,
/// the shaped breaks for a wrapped line
///  the budget can pay for,
/// and rows of equal width for the rest.
/// Why:
///  The map's row count is what the editor shows,
/// so it decides how many rows the line has;
/// shaping only places
///  the breaks,
/// which the picture needs at the width of a pixel.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function describe(shaper: TextShaper, input: Input, line: number, spending: Spending, stats: Stats): LineRows;
/// ```
fn describe(
    shaper: &mut TextShaper,
    input: &Input,
    line: usize,
    spending: &mut Spending,
    stats: &mut Stats,
) -> LineRows {
    let start = input.document.text().line_to_char(line);
    let visible = visible_length(input.document, line);
    let indent = indent_columns(input.document, line);
    let count = input.map.rows_of(line);
    stats.lines += 1;
    // Only a line of several rows is measured against the wrap width.
    let wrapped_width = if count > 1 { input.wrap } else { None };
    let Some(wrap) = wrapped_width else {
        // One row holds the whole line: a list of one range of char positions.
        return LineRows {
            line,
            rows: std::iter::once(start..start + visible).collect(),
            indent,
        };
    };
    let cost = line_work(input.document, line);
    if cost != usize::MAX && spending.charge(cost) {
        stats.shaped_lines += 1;
        let shaped = shaper.wrapped_row(input.document, line, input.scale, wrap);
        return LineRows {
            line,
            rows: shaped.source_rows(),
            indent,
        };
    }
    stats.rough_lines += 1;
    // Rows of equal width in columns, from the width of a space: the break rules are not asked.
    let advance = shaper.space_advance(input.scale) / input.scale;
    let columns = if advance > 0.0 {
        ((wrap / advance).floor() as usize).max(1)
    } else {
        usize::MAX
    };
    let mut rows = Vec::new();
    for row in 0..count {
        let from = row.saturating_mul(columns).min(visible);
        let to = from.saturating_add(columns).min(visible);
        rows.push(start + from..start + to);
    }
    return LineRows { line, rows, indent };
}

/// What:
///  The glyphs of the characters `range` of the text,
/// from column `first` on,
/// up to `columns` columns:
///  a tab moves [`TAB_COLUMNS`],
/// a blank or control character one column without a glyph,
/// every other
///  character one column with its syntax ink.
/// Why:
///  The picture draws one pixel for each column and stops at its width,
/// whatever the line's length;
///  CodeGlance Pro walks every character,
/// a 200,000 character line would cost the build that much here.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function cells(input: Input, range: [number, number], first: number, columns: number): Cell[];
/// ```
fn cells(input: &Input, range: Range<usize>, first: usize, columns: usize) -> Vec<Cell> {
    let mut found = Vec::new();
    let mut column = first;
    // A halving search finds the first style span that reaches this range.
    let mut span = 0;
    let mut high = input.styles.len();
    while span < high {
        let middle = span + (high - span) / 2;
        if input.styles[middle].end <= range.start {
            span = middle + 1;
        } else {
            high = middle;
        }
    }
    for (offset, character) in input
        .document
        .text()
        .slice(range.clone())
        .chars()
        .enumerate()
    {
        if column >= columns {
            break;
        }
        let at = range.start + offset;
        while span < input.styles.len() && input.styles[span].end <= at {
            span += 1;
        }
        let code = character as u32;
        if character == '\t' {
            column += TAB_COLUMNS;
            continue;
        }
        if code > 32 {
            let role = match input.styles.get(span) {
                Some(style) if style.start <= at => style.style as u32,
                _ => 0,
            };
            let color = ink(role, input.colors);
            found.push(Cell {
                column,
                rgb: [color[0], color[1], color[2]],
                ascii: code < 127,
            });
        }
        column += 1;
    }
    return found;
}

/// What:
///  Build the picture of `input`'s text:
/// for each physical pixel row of the track,
/// the visual row of the text at
///  its center,
/// drawn as syntax colored pixels,
/// one for each source column.
///  `work` is the most it may spend shaping wrapped lines,
/// and `cancelled` is asked every few pixel rows;
///  the answer is nothing when it said so.
/// Why:
///  The picture is the whole text at a fixed size,
/// so a text with more rows than the track has pixels is sampled:
///  the work is bounded by the track's height,
/// never by the text's length.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function build(shaper: TextShaper, input: Input, work: number, cancelled: Cancel): Built | undefined;
/// ```
pub fn build(
    shaper: &mut TextShaper,
    input: &Input,
    work: usize,
    cancelled: &dyn Cancel,
) -> Option<Built> {
    let geometry = Geometry::new(input.map.height(), input.view);
    let scale = input.scale.max(1.0);
    let columns = (input.width.floor() as usize).max(1);
    let width = ((input.width * scale).round() as usize).max(1);
    let height = (geometry.track() * scale).round() as usize;
    let mut bytes = vec![0_u8; width * height * 4];
    let mut stats = Stats {
        pixel_rows: height,
        ..Stats::default()
    };
    let mut spending = Spending {
        left: work,
        spent: 0,
    };
    // Source pixels of the text for each pixel row of the picture, and how many pixel rows a source row gets.
    let per_pixel = geometry.scale() * scale;
    // The small addend keeps four pixels a row at four when the product lands a hair under it.
    let natural = ((CODE_ROW * geometry.scale() + 0.001)
        .floor()
        .clamp(1.0, 4.0)) as usize;
    let mut described: Option<LineRows> = None;
    let mut drawn: Option<(usize, usize, Vec<Cell>)> = None;
    for pixel in 0..height {
        if pixel % CANCEL_EVERY == 0 && cancelled.is_cancelled() {
            tracing::debug!(pixel, "minimap build cancelled");
            return None;
        }
        let y = (pixel as f32 + 0.5) / per_pixel;
        let place = input.map.locate(y);
        if place.in_block {
            continue;
        }
        let within = (y - input.map.code_top(place.line)).max(0.0);
        let row = ((within / CODE_ROW) as usize).min(input.map.rows_of(place.line) - 1);
        let fraction = (within - row as f32 * CODE_ROW) / CODE_ROW;
        let band = ((fraction * natural as f32) as usize).min(natural - 1);
        let weight = CLEAN_WEIGHTS[natural - 1][band];
        if weight <= 0.0 {
            continue;
        }
        // A row is drawn again only when it is not the one drawn last.
        let new_row = match drawn.as_ref() {
            Some((line, kept, _)) => (*line, *kept) != (place.line, row),
            None => true,
        };
        if new_row {
            let new_line = match described.as_ref() {
                Some(rows) => rows.line != place.line,
                None => true,
            };
            if new_line {
                described = Some(describe(
                    shaper,
                    input,
                    place.line,
                    &mut spending,
                    &mut stats,
                ));
            }
            let Some(rows) = described.as_ref() else {
                continue;
            };
            let found = match rows.rows.get(row) {
                Some(range) if !range.is_empty() => {
                    let first = if row > 0 { rows.indent + 1 } else { 0 };
                    cells(input, range.clone(), first, columns)
                }
                _ => Vec::new(),
            };
            drawn = Some((place.line, row, found));
        }
        if let Some((_, _, found)) = drawn.as_ref() {
            paint_row(&mut bytes, width, pixel, found, weight, scale);
        }
    }
    stats.work = spending.spent;
    tracing::debug!(
        pixel_rows = stats.pixel_rows,
        lines = stats.lines,
        shaped = stats.shaped_lines,
        rough = stats.rough_lines,
        work = stats.work,
        "minimap built"
    );
    return Some(Built {
        width: width as u32,
        height: height as u32,
        bytes,
        stats,
    });
}
