//! The inputs and result of one source tile,
//!  and the construction both the window thread and the tile worker run.

/// Requested and displayed tile bounds travel with each job.
use crate::native::tile::TileBounds;
/// What a measurement is valid for.
use crate::native::tile_pass::PassKey;
/// Build failures stay visible diagnostics.
use anyhow::Result;
/// Visible hints and diagnostic marks are paint inputs of the tile.
use ide_app::annotation::Visible;
/// Hint and diagnostic inks, and the lay-out that places them beside the rows.
use ide_app::annotation_layout::{AnnotationColors, lay_out};
/// Canonical source text, cloned as a rope snapshot.
use ide_app::document::Document;
/// In-file find ranges and the active match, painted from the same rows as selection.
use ide_app::find::{FindRange, FindRanges};
/// Match rectangles of the materialized rows.
use ide_app::find_paint::rectangles;
/// The one vertical mapping, copied into each job.
use ide_app::row_map::RowMap;
/// Shared shaping, the viewport description, and the frame's rows.
use ide_app::shaped_text::{ShapedView, TextShaper, Viewport};
/// Paint identity of a tile, compared again when its result arrives.
use ide_app::source_frame::FrameStamp;
/// Syntax classifications, compared by shared identity.
use ide_app::source_style::SourceStyles;
/// Shaping choices a worker shaper must match.
use ide_app::source_typography::SourceTypography;
/// Glyph rasterizer and palette of one tile.
use ide_app::text_raster::{CodeColors, TextRaster};
/// Pixel buffers that cross to the window thread.
use slint::{Rgba8Pixel, SharedPixelBuffer};

/// What:
///  `struct` groups named fields into one owned value;
///  every field here is owned, so the whole job moves to another thread.
/// Why:
///  The worker must not borrow native state, which lives on the window thread.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type TileJob = { bounds: Bounds; document: Document; styles: Styles; /* paint inputs */ };
/// ```
pub(in crate::native) struct TileJob {
    /// Tile bounds this job builds, echoed back in the result.
    pub(in crate::native) bounds: TileBounds,
    /// File-open generation the snapshot belongs to.
    pub(in crate::native) file: u64,
    /// Rope snapshot at the revision the job was taken from.
    pub(in crate::native) document: Document,
    /// Syntax classifications, shared by identity.
    pub(in crate::native) styles: SourceStyles,
    /// Shaping choices the worker shaper must match.
    pub(in crate::native) typography: SourceTypography,
    /// Materialized lines, width, and scale.
    pub(in crate::native) viewport: Viewport,
    /// Vertical mapping the rows are placed by.
    pub(in crate::native) map: RowMap,
    /// Palette of the source glyphs and selection.
    pub(in crate::native) colors: CodeColors,
    /// Hint and diagnostic inks.
    pub(in crate::native) inks: AnnotationColors,
    /// Visible annotations of the tile's lines.
    pub(in crate::native) shown: std::sync::Arc<Visible>,
    /// Find ranges to paint as matches.
    pub(in crate::native) ranges: FindRanges,
    /// The match the find bar selects.
    pub(in crate::native) active: Option<FindRange>,
    /// Paint identity the result must still match.
    pub(in crate::native) stamp: FrameStamp,
}

/// What:
///  A finished tile: the shaped rows and rectangles, and the pixels to show.
/// Why:
///  The window thread swaps all of them in together, so the image and its offset always belong to one tile.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type TileBuilt = { bounds: Bounds; view: ShapedView; pixels: RGBA8[]; stamp: Stamp };
/// ```
pub(in crate::native) struct TileBuilt {
    /// Tile bounds that were built.
    pub(in crate::native) bounds: TileBounds,
    /// File-open generation the tile was built for.
    pub(in crate::native) file: u64,
    /// Shaped rows, rectangles, and annotation positions.
    pub(in crate::native) view: ShapedView,
    /// Premultiplied pixels of the tile.
    pub(in crate::native) pixels: SharedPixelBuffer<Rgba8Pixel>,
    /// Paint identity the tile was built for.
    pub(in crate::native) stamp: FrameStamp,
    /// Active match used for the match rectangles.
    pub(in crate::native) active: Option<FindRange>,
    /// What the visual rows measured while shaping the tile's lines are valid for.
    pub(in crate::native) key: PassKey,
    /// Visual rows of each line of the tile, exact for the wrap width of its key.
    pub(in crate::native) measured: Vec<(usize, usize)>,
    /// Source rows shaped while building this tile, counted in debug builds for the structural tests.
    #[cfg(debug_assertions)]
    pub(in crate::native) rows_shaped: u64,
}

/// What:
///  `fn` declares a function; `&mut` lends the shaper and raster for this call only;
///  `Result<TileBuilt>` is the built tile or the reason it could not be built.
/// Why:
///  The same code paints a tile on the window thread and on the worker, so both produce the same pixels.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function buildTile(shaper: TextShaper, raster: TextRaster, job: TileJob): TileBuilt;
/// ```
pub(in crate::native) fn build_tile(
    shaper: &mut TextShaper,
    raster: &mut TextRaster,
    job: TileJob,
) -> Result<TileBuilt> {
    #[cfg(debug_assertions)]
    let before = shaper.shaped_rows();
    let mut view = shaper.prepare_rows(&job.document, job.viewport, &job.styles, &job.map);
    // The lines this tile shaped know their own heights; the window merges them into its table.
    let mut measured = Vec::new();
    if job.viewport.wrap.is_some() {
        for row in &view.rows {
            measured.push((row.row, row.visual_rows()));
        }
    }
    view.matches = rectangles(&view, &job.ranges, job.active);
    // Annotations are positioned after shaping and never change the geometry inside a code row.
    let frame = lay_out(&view, &job.shown, shaper, job.inks);
    view.annotations = Some(frame);
    let pixels = raster.paint(&view, job.colors, 0.0)?;
    // Premultiplied pixels share the font engine's baseline and advances.
    let buffer = SharedPixelBuffer::<Rgba8Pixel>::clone_from_slice(
        &pixels.bytes,
        pixels.width,
        pixels.height,
    );
    return Ok(TileBuilt {
        bounds: job.bounds,
        file: job.file,
        view,
        pixels: buffer,
        stamp: job.stamp,
        active: job.active,
        key: PassKey {
            file: job.file,
            revision: job.document.revision(),
            scale: job.viewport.scale.to_bits(),
            wrap: job.viewport.wrap.map_or(0, f32::to_bits),
        },
        measured,
        #[cfg(debug_assertions)]
        rows_shaped: shaper.shaped_rows() - before,
    });
}

/// Whether two typographies make the same glyphs.
pub(in crate::native) fn same_typography(left: &SourceTypography, right: &SourceTypography) -> bool {
    return left.weight == right.weight
        && left.italic == right.italic
        && left.features == right.features;
}
