//! The raster limit of one tile:
//!  the rows a raster of a given width may have,
//!  the clip rules that keep a tile within them,
//!  and the guard that cuts any frame to fit before it is painted.

/// A clip is two distances below the first line's block,
/// and a viewport carries the one a frame is prepared for.
use super::frame::{Clip, Viewport};
/// A code row is the unit the clip edges are rounded to.
use crate::row_map::CODE_ROW;
/// The most bytes a raster may hold.
use crate::text_raster::MAX_RASTER_BYTES;
/// The device's texture size limit is one process-wide number, read by the window thread and the tile worker.
use std::sync::atomic::{AtomicU32, Ordering};

/// What:
///  The texture size every GPU device offers at least:
///  wgpu's default limit for the width and the height of a 2D texture.
/// Why:
///  The application opens its device with wgpu's default limits raised to the adapter's,
///  so no device it works on offers less,
///  and a tile cut for this size fits any of them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const DEFAULT_TEXTURE_DIMENSION = 8192;
/// ```
pub const DEFAULT_TEXTURE_DIMENSION: u32 = 8192;

/// The largest texture side the process's GPU device offers.
static TEXTURE_DIMENSION: AtomicU32 = AtomicU32::new(DEFAULT_TEXTURE_DIMENSION);

/// What:
///  Record the largest side of a 2D texture the process's GPU device offers
///  (`max_texture_dimension_2d`),
///  so that a tile is never cut taller than one texture can be.
/// Why:
///  The launcher and the test harness know the device before any window exists,
///  and the rendering notifier checks the value again when the device arrives.
///  The device is one per process, so the limit is too.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export function setTextureDimension(limit: number): void;
/// ```
pub fn set_texture_dimension(limit: u32) {
    TEXTURE_DIMENSION.store(limit.max(1), Ordering::Relaxed);
}

/// The largest side of a 2D texture the device offers,
/// as last recorded by [`set_texture_dimension`].
pub fn texture_dimension() -> u32 {
    return TEXTURE_DIMENSION.load(Ordering::Relaxed);
}

/// What:
///  Logical pixels a raster extends past the wrap width.
/// Why:
///  The raster holds glyphs,
///  the terminator mark,
///  and underlines of the row ends;
///  everything else the window draws over it is drawn by the markup.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const RASTER_MARGIN = 24;
/// ```
pub const RASTER_MARGIN: f32 = 24.0;

/// Raster width of a window that has not reported a width yet,
/// in logical pixels.
pub const UNWRAPPED_RASTER_WIDTH: f32 = 1300.0;

/// What:
///  The width in logical pixels of the raster of a frame whose lines are broken at `wrap`,
///  or of unbroken lines when there is no wrap width.
/// Why:
///  The window's tiles and the minimap's bands are painted at the same width,
///  so a band holds the glyphs of a tile pixel for pixel.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function rasterWidth(wrap?: number): number;
/// ```
pub fn raster_width(wrap: Option<f32>) -> f32 {
    return match wrap {
        Some(width) => (width + RASTER_MARGIN).ceil(),
        None => UNWRAPPED_RASTER_WIDTH,
    };
}

/// What:
///  Whether a raster `columns` pixels wide and `rows` pixels tall holds at most [`MAX_RASTER_BYTES`].
/// Why:
///  Every check against the limit asks this one question,
///  so no caller repeats the multiplication or its overflow rule.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function rasterFits(columns: number, rows: number): boolean;
/// ```
pub fn raster_fits(columns: u64, rows: u64) -> bool {
    return columns.saturating_mul(rows).saturating_mul(4) <= MAX_RASTER_BYTES;
}

/// What:
///  Whether a tile texture `columns` pixels wide and `rows` pixels tall is within [`MAX_RASTER_BYTES`] and within
///  the device's texture size on both sides.
/// Why:
///  The tile is one texture on the GPU,
///  so its memory and the limit of the device both bound its height.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function textureFits(columns: number, rows: number): boolean;
/// ```
pub fn texture_fits(columns: u64, rows: u64) -> bool {
    let side = u64::from(texture_dimension());
    return raster_fits(columns, rows) && columns <= side && rows <= side;
}

/// What:
///  The tallest tile in logical pixels whose texture,
///  `columns` physical pixels wide at display `scale`,
///  stays within [`MAX_RASTER_BYTES`] and within the device's texture size.
///  One code row is kept free for the rounding of the texture's size up to whole pixels,
///  and the answer is never under one code row.
/// Why:
///  A tile is one texture of the text area's width,
///  so the limits on its bytes and on its side are limits on its height.
///  A window cannot be taller than the device's texture size either,
///  so a tile of that height always holds a view.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function tileCap(columns: number, scale: number): number;
/// ```
pub fn tile_cap(columns: u64, scale: f32) -> f32 {
    let rows = (MAX_RASTER_BYTES / 4 / columns.max(1)).min(u64::from(texture_dimension()));
    return ((rows as f32 / scale).floor() - CODE_ROW).max(CODE_ROW);
}

/// What:
///  The clip of lines that span `first_top` to `bottom` (logical pixels from the top of the text) for a view whose
///  three-height `band` is given,
/// when a raster may be `cap` pixels tall at most;
/// nothing while the lines fit.
///  The band may reach past the lines at either end;
/// its middle is where a raster taller than `cap` is centered.
///  The edges are whole code rows below `first_top`,
/// and the clip is never taller than `cap`.
/// Why:
///  The rounding to whole code rows adds up to two rows,
/// and the cap leaves only one,
/// so the height is cut back to the
///  rows the cap allows;
/// a view taller than the cap can never be held by such a tile,
/// so it is placed again at every
///  scroll step,
/// as a window that tall has no better answer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function bandClip(firstTop: number, bottom: number, band: [number, number], cap: number): Clip | undefined;
/// ```
pub fn band_clip(first_top: f32, bottom: f32, band: (f32, f32), cap: f32) -> Option<Clip> {
    if bottom - first_top <= cap {
        return None;
    }
    let mut from = band.0.max(first_top);
    let mut to = band.1.min(bottom);
    if to - from > cap {
        // What: The raster is as tall as the cap, centered on the middle of the band as it was asked for (the view's
        //       middle, when the band is three view heights around the view) and moved inside the lines.
        // Why: The ends of the text cut the band short on one side, which would move its middle away from the view.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // from = clamp(middle - cap / 2, firstTop, Math.max(firstTop, bottom - cap)); to = from + cap;
        // ```
        let middle = (band.0 + band.1) / 2.0;
        from = (middle - cap / 2.0).clamp(first_top, (bottom - cap).max(first_top));
        to = from + cap;
    }
    // Whole code rows below the first line's block keep the raster on whole pixels at the usual scales.
    let mut top = ((from - first_top) / CODE_ROW).floor().max(0.0) * CODE_ROW;
    let mut cut = ((to - first_top) / CODE_ROW).ceil() * CODE_ROW;
    cut = cut.min(bottom - first_top).max(top + CODE_ROW);
    // The rounding must not take the raster past what the cap allows.
    let allowed = (cap / CODE_ROW).floor().max(1.0) * CODE_ROW;
    if cut - top > allowed {
        // What: When the window reaches the last line, the top edge gives way, so the last row of the text stays in
        //       the raster; otherwise the bottom edge does.
        // Why: Rounding the top edge down must not push a raster that ends with the text short of its last row.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (to >= bottom - 0.5) top = Math.ceil((cut - allowed) / CODE_ROW) * CODE_ROW; else cut = top + allowed;
        // ```
        if to >= bottom - 0.5 {
            top = ((cut - allowed) / CODE_ROW).ceil() * CODE_ROW;
        } else {
            cut = top + allowed;
        }
    }
    return Some(Clip { top, bottom: cut });
}

/// What:
///  The clip a frame must carry so that its raster,
///  `columns` physical pixels wide at display `scale`,
///  is within the limit:
///  `clip` unchanged when its raster (all of the lines from `first_top` to `bottom` when it is `None`) fits,
///  otherwise the part of it [`band_clip`] keeps around its middle.
/// Why:
///  The window chooses a clip from the heights its map holds,
///  and a line it never measured counts as one row there;
///  the shaper sizes the raster from the heights it measured itself.
///  This is the one place where the frame's own final heights meet the limit,
///  so a frame the window judged too small can never reach the painter too large.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function fitClip(firstTop: number, bottom: number, clip: Clip | undefined, columns: number, scale: number):
///   Clip | undefined;
/// ```
pub fn fit_clip(
    first_top: f32,
    bottom: f32,
    clip: Option<Clip>,
    columns: u64,
    scale: f32,
) -> Option<Clip> {
    let (from, to) = match clip {
        Some(held) => (first_top + held.top, first_top + held.bottom),
        None => (first_top, bottom),
    };
    let rows = ((to - from).max(CODE_ROW) * scale).ceil() as u64;
    if texture_fits(columns, rows) {
        return clip;
    }
    return band_clip(first_top, bottom, (from, to), tile_cap(columns, scale));
}

/// What:
///  `viewport` with its clip replaced by the one [`fit_clip`] gives for a raster `columns` pixels wide,
///  for the lines from `first_top` to `bottom`;
///  the cut is logged at warn level.
/// Why:
///  The shaper prepares every frame through this,
///  so the viewport a frame keeps names the clip its raster really has.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function fitViewport(viewport: Viewport, firstTop: number, bottom: number, columns: number): Viewport;
/// ```
pub fn fit_viewport(viewport: Viewport, first_top: f32, bottom: f32, columns: u64) -> Viewport {
    let fitted = fit_clip(first_top, bottom, viewport.clip, columns, viewport.scale);
    if fitted == viewport.clip {
        return viewport;
    }
    tracing::warn!(
        first = viewport.first,
        count = viewport.count,
        asked = ?viewport.clip,
        fitted = ?fitted,
        tile_top = first_top,
        tile_bottom = bottom,
        "cut a frame to the raster limit: the lines are taller than the window's map held"
    );
    return Viewport {
        clip: fitted,
        ..viewport
    };
}
