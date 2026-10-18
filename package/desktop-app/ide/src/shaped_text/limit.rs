//! The raster limit of one tile:
//!  the rows a raster of a given width may have,
//!  the clip rules that keep a tile within them,
//!  and the guard that cuts any frame to fit before it is painted.

/// A clip is two distances below the first line's block.
use super::frame::Clip;
/// A code row is the unit the clip edges are rounded to.
use crate::row_map::CODE_ROW;
/// The most bytes a raster may hold.
use crate::text_raster::MAX_RASTER_BYTES;

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
///  The tallest tile in logical pixels whose raster,
///  `columns` physical pixels wide at display `scale`,
///  stays within [`MAX_RASTER_BYTES`].
///  One code row is kept free for the rounding of the raster's size up to whole pixels,
///  and the answer is never under one code row.
/// Why:
///  A tile is one image of the text area's width,
///  so the limit on its bytes is a limit on its height.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function tileCap(columns: number, scale: number): number;
/// ```
pub fn tile_cap(columns: u64, scale: f32) -> f32 {
    let rows = MAX_RASTER_BYTES / 4 / columns.max(1);
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
    if raster_fits(columns, rows) {
        return clip;
    }
    return band_clip(first_top, bottom, (from, to), tile_cap(columns, scale));
}
