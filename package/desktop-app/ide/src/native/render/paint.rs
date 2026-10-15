//! The paint inputs of a tile and the geometry they are painted at:
//!  the palette and find ranges read once per frame,
//!  the raster size limit,
//!  the viewport of a tile,
//!  and the stamp and job a tile is built from.

/// The window,
///  the source state,
///  and the palette read from the window.
use super::code_colors;
/// Virtual-row texts and diagnostic marks are positioned against the frame's shaped rows.
use crate::native::{
    AppWindow, State, annotate, find::present::present, tile::TileBounds, tile_build::TileJob,
};
/// Paint identity and the frame rectangles come from the same shaped rows.
use ide_app::annotation_layout::AnnotationColors;
/// Match ranges and the active match of the in-file find.
use ide_app::find::{FindRange, FindRanges};
/// Match ranges of the displayed find results.
use ide_app::find_navigation::paint_ranges;
/// Physical viewport description for shared shaping.
use ide_app::shaped_text::Viewport;
/// Exact paint inputs exclude collapsed caret movement.
use ide_app::source_frame::FrameStamp;
/// Native palette values retain syntax and selection contrast.
use ide_app::text_raster::CodeColors;
/// A wrap width must be a positive number of pixels.
use ide_app::wrap::has_wrap_width;
/// The most bytes a raster may hold, and the height of one code row.
use ide_app::{row_map::CODE_ROW, text_raster::MAX_RASTER_BYTES};
/// The window's display scale for the paint inputs.
use slint::ComponentHandle;
/// Shared find ranges and syntax styles travel with each stamp and job.
use std::sync::Arc;

/// What:
///  Logical pixels the raster extends past the wrap width.
/// Why:
///  The raster holds glyphs, the terminator mark, and underlines of the row ends;
///  everything else the window draws over it is drawn by the markup.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const RASTER_MARGIN = 24;
/// ```
const RASTER_MARGIN: f32 = 24.0;

/// Raster width of a window that has not reported a width yet, in logical pixels.
const UNWRAPPED_RASTER_WIDTH: f32 = 1300.0;

/// What:
///  Paint inputs that come from the window and the find state, read once per frame.
/// Why:
///  A tile's paint identity and its job are both built from these values,
///  so the window and the worker see the same inputs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Paint = { scale: number; colors: Colors; inks: Inks; ranges: Range[]; active?: Range };
/// ```
pub(in crate::native) struct Paint {
    /// Physical pixels per logical pixel.
    pub(in crate::native) scale: f32,
    /// Palette of the source glyphs and selection.
    pub(in crate::native) colors: CodeColors,
    /// Hint and diagnostic inks.
    pub(in crate::native) inks: AnnotationColors,
    /// Find matches painted in the tile.
    pub(in crate::native) ranges: FindRanges,
    /// The match the find bar selects.
    pub(in crate::native) active: Option<FindRange>,
}

/// Read the paint inputs of the current frame.
impl Paint {
    /// Capture the window and find inputs; stale find results contribute no ranges.
    pub(in crate::native) fn new(window: &AppWindow, current: &State) -> Self {
        return Self {
            scale: window.window().scale_factor(),
            colors: code_colors(window),
            inks: annotate::colors(window),
            ranges: paint_ranges(
                &current.find,
                current.file_generation,
                current.document.revision(),
            ),
            active: present(current).active,
        };
    }
}

/// What:
///  The tallest tile in logical pixels whose raster stays within [`MAX_RASTER_BYTES`]
///  at wrap width `width` and display `scale`.
/// Why:
///  A tile is one image of the text area's width, so the limit on its bytes is a limit on its height;
///  a tile of lines taller than this is clipped to the rows near the view instead of being refused.
///  One code row is kept free for the rounding of the raster's size up to whole pixels.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function tileCap(width: number, scale: number): number;
/// ```
pub(in crate::native) fn tile_cap(width: f32, scale: f32) -> f32 {
    let raster = if has_wrap_width(width) {
        (width + RASTER_MARGIN).ceil()
    } else {
        UNWRAPPED_RASTER_WIDTH
    };
    let columns = ((raster * scale).ceil() as u64).max(1);
    let rows = MAX_RASTER_BYTES / 4 / columns;
    return ((rows as f32 / scale).floor() - CODE_ROW).max(CODE_ROW);
}

/// The viewport of a tile at `bounds`: its lines broken at the wrap width, and a raster as wide as the text area.
pub(in crate::native) fn viewport_of(bounds: TileBounds, scale: f32) -> Viewport {
    let wrap = has_wrap_width(bounds.width).then_some(bounds.width);
    return Viewport {
        first: bounds.first,
        count: bounds.count,
        width: wrap.map_or(UNWRAPPED_RASTER_WIDTH, |width| {
            return (width + RASTER_MARGIN).ceil();
        }),
        scale,
        wrap,
        clip: bounds.clip,
    };
}

/// The paint identity of a tile at `bounds`, from the current document and the paint inputs.
pub(in crate::native) fn stamp_for(
    current: &State,
    bounds: TileBounds,
    paint: &Paint,
) -> FrameStamp {
    return FrameStamp::new(
        &current.document,
        viewport_of(bounds, paint.scale),
        paint.colors,
        Arc::clone(&current.styles),
    )
    .with_matches(Arc::clone(&paint.ranges))
    .with_annotations(annotate::visible(current, bounds), paint.inks);
}

/// Owned inputs of a tile at `bounds`, ready for the tile worker or for an immediate build.
pub(in crate::native) fn job(current: &State, bounds: TileBounds, paint: &Paint) -> TileJob {
    return TileJob {
        bounds,
        file: current.file_generation,
        document: current.document.clone(),
        styles: Arc::clone(&current.styles),
        typography: current.shaper.typography().clone(),
        viewport: viewport_of(bounds, paint.scale),
        map: current.row_map.clone(),
        colors: paint.colors,
        inks: paint.inks,
        shown: annotate::visible(current, bounds),
        ranges: Arc::clone(&paint.ranges),
        active: paint.active,
        stamp: stamp_for(current, bounds, paint),
    };
}
