//! The minimap's picture as GPU scenes:
//!  the lines near the visible part of the picture,
//!  drawn as the window draws them (the same shaped rows,
//!  inks,
//!  selection and match marks,
//!  hints,
//!  messages,
//!  and underlines),
//!  scaled down to the minimap's pixels.
//!
//! Nothing here fills a pixel.
//! The scene holds glyph outlines,
//!  rectangles,
//!  and strokes,
//!  and the GPU turns them into the minimap's pixels:
//!  a minimap pixel is the coverage of the outlines it stands for,
//!  so the picture is the average the window's own pixels give,
//!  without a reduction pass.
//! A slice is cut into chunks of at most 512 rows, a scene for each,
//!  because the renderer's scratch buffers hold a fixed amount of work.

/// The paint items cut into the chunks.
use super::chunks::cut;
/// The marks drawn under the glyphs.
use super::fills::{Fills, fill_items};
/// The geometry of the picture:
/// its fixed scale.
use super::geometry::Geometry;
/// The width of the text the picture covers.
use super::horizontal::text_span;
/// Shaped lines kept by what shaped them.
use super::line_cache::{LineCache, line_key};
/// The rows of the picture a slice holds.
use super::plan::{MIN_SCALE, chunk_rows, slice_rows};
/// Diagnostic marks.
use crate::annotation::{Mark, Visible};
/// The positioning of hints and messages beside the rows.
use crate::annotation_layout::{AnnotationColors, lay_out};
/// The palette of the glyphs.
use crate::code_colors::CodeColors;
/// Canonical text,
/// whose reading position is the selection.
use crate::document::Document;
/// Matches of the in-file find.
use crate::find::FindRange;
/// The rectangles of the matches in a frame.
use crate::find_paint::rectangles;
/// The vertical mapping the lines are placed by.
use crate::row_map::{CODE_ROW, RowMap};
/// Shaping, and the frame it prepares.
use crate::shaped_text::{ShapedRow, ShapedView, TextShaper, Viewport, line_work, raster_width};
/// Syntax classes by character offset.
use crate::source_style::StyleSpan;
/// The paint items of a shaped view, and the scene they encode to.
use crate::tile_scene::{Item, TileScene, encode, tile_items};
/// Blocks of virtual rows.
use crate::virtual_row::Block;
/// Blocks are shared between the window and the worker; a window of bands is a range of numbers.
use std::{ops::Range, sync::Arc};
/// Vello's scene and transforms.
use vello::{Scene, kurbo::Affine};

/// What:
///  Work,
///  in the units of `line_work`,
///  a picture may spend shaping lines.
/// Why:
///  A picture shapes only the lines near the visible part of the picture,
///  so ordinary text costs a small part of this;
///  a line the rows kept do not hold, whose cost is more than what is left, is drawn blank.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const BUILD_WORK = 5_000_000;
/// ```
pub const BUILD_WORK: usize = 5_000_000;

/// What:
///  The question a build asks between lines:
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
///  Everything a picture is drawn from.
/// Why:
///  One value borrowed from the worker's snapshot,
///  so a build touches no window state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Source = { document: Document; styles: StyleSpan[]; map: RowMap; colors: CodeColors; inks: AnnotationColors; ... };
/// ```
#[derive(Clone, Copy)]
pub struct Source<'a> {
    /// The text and its reading position.
    pub document: &'a Document,
    /// Syntax classes by character offset,
    /// ascending.
    pub styles: &'a [StyleSpan],
    /// The window's vertical mapping.
    pub map: &'a RowMap,
    /// The palette of the glyphs.
    pub colors: CodeColors,
    /// The inks of hints and diagnostics.
    pub inks: AnnotationColors,
    /// The inks of the selection and match fills.
    pub fills: Fills,
    /// Every block of virtual rows,
    /// in line order.
    pub blocks: &'a [Arc<Block>],
    /// Every diagnostic mark,
    /// in start order.
    pub marks: &'a [Mark],
    /// The matches of the in-file find,
    /// in order.
    pub ranges: &'a [FindRange],
    /// The match the selection covers.
    pub active: Option<FindRange>,
    /// The width lines are broken at,
    /// in logical pixels.
    pub wrap: Option<f32>,
    /// Physical pixels per logical pixel.
    pub scale: f32,
}

/// What:
///  What a build reads:
///  the source,
///  the sizes,
///  and the bands to draw.
/// Why:
///  Every field is borrowed from a snapshot the worker owns.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Input = { source: Source; view: number; width: number; window: [number, number] };
/// ```
#[derive(Clone)]
pub struct Input<'a> {
    /// What the picture is drawn from.
    pub source: Source<'a>,
    /// Height of the view,
    /// in logical pixels,
    /// which is the most the picture can be.
    pub view: f32,
    /// Width of the picture,
    /// in logical pixels.
    pub width: f32,
    /// The numbers of the bands to draw,
    /// counted from the top of the text.
    pub window: Range<usize>,
}

/// What:
///  What one build cost and what it left out.
/// Why:
///  The worker logs it and the tests assert the bounds from it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Stats = { units: number; lines: number; shaped: number; reused: number; skipped: number; work: number; items: number };
/// ```
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Stats {
    /// Bands of the window.
    pub units: usize,
    /// Lines the picture draws.
    pub lines: usize,
    /// Lines shaped in this build.
    pub shaped: usize,
    /// Lines taken from the row cache.
    pub reused: usize,
    /// Lines the work budget could not pay for,
    /// which are drawn blank.
    pub skipped: usize,
    /// Work charged for the lines shaped.
    pub work: usize,
    /// Paint items of the scene.
    pub items: usize,
}

/// What:
///  A finished picture:
///  the scene of each chunk of the slice, top first,
///  and the row of the whole picture the slice's first row is.
///  The chunks are as wide as the slice and stack without a gap;
///  the slice's texture is as tall as they are together.
///  No chunk when the slice holds no rows.
/// Why:
///  The window thread hands the scenes to the GPU and places the texture by its top row.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Built = { chunks: TileScene[]; top: number; stats: Stats };
/// ```
pub struct Built {
    /// The scene of each chunk and the size of the texture region it fills.
    pub chunks: Vec<TileScene>,
    /// The row of the whole picture that the first row of the texture is.
    pub top: u32,
    /// What the build cost.
    pub stats: Stats,
}

/// What:
///  The lines the rows `rows` of the picture show,
///  with one code row of margin on each side.
/// Why:
///  A line whose glyphs reach into the slice from outside it must be drawn,
///  so the slice has no seam where its edge cuts a line.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function linesOf(map: RowMap, rows: [number, number], scale: number, ratio: number): [number, number];
/// ```
fn lines_of(map: &RowMap, rows: &Range<usize>, scale: f32, ratio: f64) -> Range<usize> {
    let per_row = 1.0 / (ratio * f64::from(scale));
    let top = (rows.start as f64 * per_row) as f32;
    let bottom = (rows.end as f64 * per_row) as f32;
    let first = map.line_at((top - CODE_ROW).max(0.0));
    let end = (map.line_at(bottom + CODE_ROW) + 1).min(map.lines());
    return first..end.max(first);
}

/// What:
///  The shaped rows of `lines`,
///  each from the cache when its key is unchanged and otherwise shaped,
///  within `work`.
///  A line the budget cannot pay for is a blank row, counted in `stats`.
/// Why:
///  The rows of a view follow one another without a gap,
///  because the annotation layout finds a line's row by its distance from the first.
///  A cancelled build answers nothing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function shapeLines(shaper: TextShaper, cache: LineCache, source: Source, lines: [number, number], work: number, cancelled: Cancel): ShapedRow[] | undefined;
/// ```
fn shape_lines(
    shaper: &mut TextShaper,
    cache: &mut LineCache,
    source: &Source,
    lines: Range<usize>,
    stats: &mut Stats,
    cancelled: &dyn Cancel,
) -> Option<Vec<ShapedRow>> {
    let text = source.document.text();
    let mut left = BUILD_WORK;
    let mut blank: Option<ShapedRow> = None;
    let mut rows = Vec::with_capacity(lines.len());
    for line in lines {
        if line % 32 == 0 && cancelled.is_cancelled() {
            return None;
        }
        let key = line_key(
            source.document,
            source.styles,
            line,
            source.wrap,
            source.scale,
        );
        let start = text.line_to_char(line);
        let mut row = match cache.take(key) {
            Some(kept) => {
                stats.reused += 1;
                kept
            }
            None => {
                let cost = line_work(source.document, line);
                if cost > left {
                    stats.skipped += 1;
                    tracing::warn!(
                        line,
                        cost,
                        left,
                        "a minimap line was left blank: the work budget cannot pay for it"
                    );
                    let template = blank.get_or_insert_with(|| {
                        let empty = Document::new("\n");
                        return shaper.shape_line(&empty, 0, source.scale, &[], source.wrap);
                    });
                    template.clone()
                } else {
                    left -= cost;
                    stats.work += cost;
                    stats.shaped += 1;
                    let shaped = shaper.shape_line(
                        source.document,
                        line,
                        source.scale,
                        source.styles,
                        source.wrap,
                    );
                    cache.put(key, shaped.clone());
                    shaped
                }
            }
        };
        row.row = line;
        row.source_start = start;
        rows.push(row);
    }
    return Some(rows);
}

/// What:
///  The shaped view of `rows`,
///  placed by the window's vertical mapping from the top of the text,
///  with the selection and match rectangles and the annotation layout of its lines.
/// Why:
///  This is the frame the window's tile is made from,
///  except that its origin is the top of the text and its height the whole text,
///  so its paint items stand where the whole text stands and nothing is culled.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function viewOf(shaper: TextShaper, source: Source, rows: ShapedRow[], first: number): ShapedView;
/// ```
fn view_of(
    shaper: &mut TextShaper,
    source: &Source,
    rows: Vec<ShapedRow>,
    first: usize,
) -> ShapedView {
    let scale = source.scale;
    let count = rows.len();
    // A wrapped line has the rows it really has, wherever the window's map still counts it as one.
    let placed = if source.wrap.is_some() {
        let mut measured: Vec<(usize, usize)> = Vec::new();
        for shaped in &rows {
            measured.push((shaped.row, shaped.visual_rows()));
        }
        source.map.with_measured(&measured)
    } else {
        source.map.clone()
    };
    let mut placed_rows = Vec::with_capacity(count);
    for shaped in rows {
        let top = placed.code_top(shaped.row);
        placed_rows.push(ShapedRow { top, ..shaped });
    }
    let raster = raster_width(source.wrap);
    let mut view = ShapedView {
        rows: placed_rows,
        viewport: Viewport {
            first,
            count,
            width: raster,
            scale,
            wrap: source.wrap,
            clip: None,
        },
        width: (raster.max(1.0) * scale).ceil() as u32,
        height: (placed.height().max(CODE_ROW) * scale).ceil() as u32,
        origin: 0.0,
        map: placed,
        selections: Vec::new(),
        matches: Vec::new(),
        annotations: None,
    };
    view.selections = view.selection(source.document);
    view.matches = rectangles(&view, source.ranges, source.active);
    let text = source.document.text();
    let end = first + count;
    let start_char = text.line_to_char(first);
    let end_char = if end < text.len_lines() {
        text.line_to_char(end)
    } else {
        text.len_chars()
    };
    let visible = Visible {
        blocks: blocks_between(source.blocks, first, end),
        marks: marks_between(source.marks, start_char, end_char),
    };
    view.annotations = Some(lay_out(&view, &visible, shaper, source.inks));
    return view;
}

/// Index of the first block that belongs to a line at or past `line`,
/// by a halving search.
fn first_block_from(blocks: &[Arc<Block>], line: usize) -> usize {
    let (mut low, mut high) = (0, blocks.len());
    while low < high {
        let middle = low + (high - low) / 2;
        if blocks[middle].line < line {
            low = middle + 1;
        } else {
            high = middle;
        }
    }
    return low;
}

/// The blocks of `blocks` that belong to the lines `first` to `end`.
pub fn blocks_between(blocks: &[Arc<Block>], first: usize, end: usize) -> Vec<Arc<Block>> {
    let from = first_block_from(blocks, first);
    let to = first_block_from(blocks, end).max(from);
    return blocks[from..to].to_vec();
}

/// The marks of `marks` that touch the characters `start` to `end`.
pub fn marks_between(marks: &[Mark], start: usize, end: usize) -> Vec<Mark> {
    let mut found = Vec::new();
    for mark in marks {
        if mark.start >= end {
            break;
        }
        if mark.end >= start {
            found.push(*mark);
        }
    }
    return found;
}

/// What:
///  The paint items of the picture of `input`,
///  in physical pixels of the text at the display scale,
///  with the rows of the whole picture they fill.
///  Nothing when the window holds no rows or the build was cancelled.
/// Why:
///  The items are the picture before it is scaled down:
///  the marks first,
///  then the glyphs,
///  then the underlines,
///  and the tests read them as they read a tile's.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function sliceItems(shaper: TextShaper, cache: LineCache, input: Input, cancelled: Cancel): { items: Item[]; rows: [number, number]; stats: Stats } | undefined;
/// ```
pub fn slice_items(
    shaper: &mut TextShaper,
    cache: &mut LineCache,
    input: &Input,
    cancelled: &dyn Cancel,
) -> Option<(Vec<Item>, Range<usize>, Stats)> {
    let source = &input.source;
    let scale = source.scale.max(MIN_SCALE);
    let ratio = f64::from(Geometry::new(source.map.height(), input.view).scale());
    let rows = slice_rows(&input.window, source.map.height(), scale, ratio);
    let mut stats = Stats {
        units: input.window.len(),
        ..Stats::default()
    };
    if rows.is_empty() {
        return Some((Vec::new(), rows, stats));
    }
    let lines = lines_of(source.map, &rows, scale, ratio);
    stats.lines = lines.len();
    cache.begin();
    let first = lines.start;
    let shaped = shape_lines(shaper, cache, source, lines, &mut stats, cancelled)?;
    cache.finish();
    let view = view_of(shaper, source, shaped, first);
    let mut items = fill_items(&view, source.fills);
    match tile_items(&view, source.colors, 0.0) {
        Ok(drawn) => items.extend(drawn),
        Err(error) => {
            tracing::error!(%error, "the minimap's lines could not be turned into paint items")
        }
    }
    stats.items = items.len();
    return Some((items, rows, stats));
}

/// What:
///  Draw the picture of `input`:
///  the items of its slice,
///  cut into chunks of at most [`CHUNK_ROWS`](super::plan::CHUNK_ROWS) rows,
///  each scaled to the minimap's width across and the fixed scale down,
///  and placed so the first row of its texture region is the chunk's first row.
/// Why:
///  The picture shows the text's whole width in the minimap's width,
///  so the horizontal factor is the minimap's pixels over the text's;
///  the vertical factor is the picture's fixed scale.
///  A chunk's scene holds only the items whose ink can reach its rows,
///  so the renderer's work for a slice is what the slice costs, however many chunks it has.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function build(shaper: TextShaper, cache: LineCache, input: Input, cancelled: Cancel): Built | undefined;
/// ```
pub fn build(
    shaper: &mut TextShaper,
    cache: &mut LineCache,
    input: &Input,
    cancelled: &dyn Cancel,
) -> Option<Built> {
    let (items, rows, stats) = slice_items(shaper, cache, input, cancelled)?;
    let source = &input.source;
    let scale = source.scale.max(MIN_SCALE);
    let geometry = Geometry::new(source.map.height(), input.view);
    let ratio = f64::from(geometry.scale());
    let width = ((input.width * scale).round() as usize).max(1);
    let across = f64::from(text_span(source.wrap)) * f64::from(scale);
    let spans = chunk_rows(&rows);
    // The text rows each chunk reaches: a glyph's ink reaches a code row or two past its layout box.
    let reaches: Vec<(f32, f32)> = spans
        .iter()
        .map(|span| {
            return (
                (span.start as f64 / ratio) as f32,
                (span.end as f64 / ratio) as f32,
            );
        })
        .collect();
    let cuts = cut(&items, &reaches, 2.0 * CODE_ROW * scale);
    // A clip item clips to the text's whole height, so a tall text never cuts a glyph run short.
    let extent = (source.map.height().max(CODE_ROW) * scale).ceil() + 1.0;
    let mut chunks = Vec::with_capacity(spans.len());
    for (span, kept) in spans.iter().zip(&cuts) {
        let mut scene = Scene::new();
        if !kept.is_empty() {
            let transform = Affine::translate((0.0, -(span.start as f64)))
                * Affine::scale_non_uniform(width as f64 / across, ratio);
            scene.append(&encode(kept, extent), Some(transform));
        }
        chunks.push(TileScene {
            scene,
            width: width as u32,
            height: span.len() as u32,
        });
    }
    return Some(Built {
        chunks,
        top: rows.start as u32,
        stats,
    });
}
