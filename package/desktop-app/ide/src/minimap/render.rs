//! Rendering one band of the text exactly as the window renders a tile:
//!  the same shaping at the same wrap width and scale,
//!  the same rows,
//! glyphs,
//! virtual rows and underlines,
//!  and the markup's selection and match fills behind them.

/// The markup's fills behind the glyphs.
use super::fills::{Fills, paint_fills};
/// Which stretch of lines a band renders.
use super::plan::Band;
/// Diagnostic marks.
use crate::annotation::Mark;
/// Hints and diagnostic marks that touch a band's lines.
use crate::annotation::Visible;
/// The positioning of hints and messages beside the rows.
use crate::annotation_layout::{AnnotationColors, lay_out};
/// Canonical text,
/// whose reading position is the selection.
use crate::document::Document;
/// Matches of the in-file find.
use crate::find::FindRange;
/// The rectangles of the matches in a frame.
use crate::find_paint::rectangles;
/// The vertical mapping the band is placed by.
use crate::row_map::RowMap;
/// Shaping and the frame it prepares.
use crate::shaped_text::{TextShaper, Viewport};
/// Syntax classes by character offset.
use crate::source_style::StyleSpan;
/// The painter and the palette.
use crate::text_raster::{CodeColors, TextRaster};
/// Blocks of virtual rows and diagnostics are the annotations of a band.
use crate::virtual_row::Block;
/// A band that cannot be rendered is an error with the reason.
use anyhow::{Result, bail};
/// Blocks are shared between the window and the worker.
use std::sync::Arc;

/// What:
///  Everything a band is rendered from.
/// Why:
///  One value borrowed from the worker's snapshot,
///  so rendering a band touches no window state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Scene = { document: Document; styles: StyleSpan[]; map: RowMap; colors: CodeColors; inks: AnnotationColors; ... };
/// ```
#[derive(Clone, Copy)]
pub struct Scene<'a> {
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
    /// The width of the raster,
    /// in logical pixels.
    pub width: f32,
    /// Physical pixels per logical pixel.
    pub scale: f32,
}

/// What:
///  A rendered band:
///  its premultiplied pixels,
///  and where its first row stands among the rows of the whole text.
/// Why:
///  The reduction needs the pixels and their place,
///  and nothing else of the frame.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Rendered = { bytes: Uint8Array; width: number; height: number; top: number };
/// ```
pub struct Rendered {
    /// Premultiplied RGBA bytes.
    pub bytes: Vec<u8>,
    /// Pixels of a row.
    pub width: usize,
    /// Rows.
    pub height: usize,
    /// Physical rows from the top of the text to the first row.
    pub top: f64,
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
///  Render `band` of `scene`.
/// Why:
///  This is `build_tile` with a clip:
///  it prepares the frame,
/// adds the matches and annotations of its lines,
///  draws the fills,
/// and paints the glyphs over them.
///
/// # Errors
/// The shaper had to cut the frame to the raster limit,
/// or the painter refused it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function render(shaper: TextShaper, raster: TextRaster, scene: Scene, band: Band): Rendered;
/// ```
pub fn render(
    shaper: &mut TextShaper,
    raster: &mut TextRaster,
    scene: &Scene,
    band: &Band,
) -> Result<Rendered> {
    let viewport = Viewport {
        first: band.first,
        count: band.count,
        width: scene.width,
        scale: scene.scale,
        wrap: scene.wrap,
        clip: Some(band.clip),
    };
    let mut view = shaper.prepare_rows(scene.document, viewport, scene.styles, scene.map);
    if view.viewport.clip != Some(band.clip) {
        bail!(
            "The frame of lines {} to {} was cut to {:?} instead of {:?} to stay within the raster limit",
            band.first,
            band.first + band.count,
            view.viewport.clip,
            band.clip
        );
    }
    view.matches = rectangles(&view, scene.ranges, scene.active);
    let text = scene.document.text();
    let end = band.first + band.count;
    let start_char = text.line_to_char(band.first);
    let end_char = if end < text.len_lines() {
        text.line_to_char(end)
    } else {
        text.len_chars()
    };
    let visible = Visible {
        blocks: blocks_between(scene.blocks, band.first, end),
        marks: marks_between(scene.marks, start_char, end_char),
    };
    view.annotations = Some(lay_out(&view, &visible, shaper, scene.inks));
    let mut bytes = vec![0; view.width as usize * view.height as usize * 4];
    paint_fills(&mut bytes, (view.width, view.height), &view, scene.fills);
    let pixels = raster.paint_onto(&view, scene.colors, 0.0, bytes)?;
    return Ok(Rendered {
        bytes: pixels.bytes,
        width: pixels.width as usize,
        height: pixels.height as usize,
        top: f64::from(view.origin) * f64::from(scene.scale),
    });
}
