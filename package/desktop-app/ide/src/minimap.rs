//! The minimap:
//! the scroll control of the source view and the picture of the text it shows,
//!  sized as CodeGlance Pro sizes it.
//!
//! The geometry (`geometry`) is pure:
//! the picture's fixed scale,
//! the track,
//! how far a long text's picture has slid past it,
//! the viewport box,
//! and the maps between a
//!  position on the minimap,
//! a scroll offset,
//! and a visual row of the vertical mapping.
//!
//! The picture is the window's own rendering of the text,
//!  zoomed out,
//! and it holds only the bands near the visible part of it.
//!  The text is rendered in bands as the window renders a tile (`render`),
//!  with the selection,
//! the matches,
//! and the annotations the window draws,
//!  and each band is reduced to the minimap's resolution by area averaging (`downscale`),
//!  so a minimap pixel is the average of the window's pixels it stands for.
//!  The bands are planned (`plan`),
//! kept by what they were rendered for (`key`,
//! `cache`),
//!  and put together by `build`,
//! which runs on a worker thread within a work budget.

/// The picture of the bands near the visible part,
/// built band by band and kept.
mod build;
/// The units of the last picture and the keys they were rendered for.
mod cache;
/// The area-averaging reduction of rendered bands.
mod downscale;
/// The markup's selection and match fills behind the glyphs.
mod fills;
/// The minimap's sizes,
/// the viewport box,
/// and the maps between pixels and visual rows.
mod geometry;
/// The horizontal map of the picture.
mod horizontal;
/// What a unit of the picture is valid for.
mod key;
/// The bands the text is rendered in.
mod plan;
/// Rendering one band as the window renders a tile.
mod render;

/// The picture's build,
///  its inputs,
///  its work budget,
///  and what it reports.
pub use build::{BUILD_WORK, Built, Cancel, Input, Prepared, Stats, build, prepare};
/// The units a build keeps.
pub use cache::{Cache, Slot};
/// The reduction of a strip of rendered pixels to the picture's rows.
pub use downscale::{Picture, Reduced, Reducer, Reduction, Strip};
/// The fill inks.
pub use fills::{Fills, paint_fills};
/// The geometry's sizes,
///  the target of a position,
///  and the maps between pixels and visual rows.
pub use geometry::{
    Geometry, MIN_BOX, NARROWEST, PIXELS_PER_ROW, Target, VIEW_SHARE, WIDTH, width_for,
};
/// A position across the minimap and the text's width.
pub use horizontal::{text_span, text_x};
/// What a kept unit is valid for.
pub use key::{Identity, Shared, UnitKey, key_of};
/// The bands.
pub use plan::{BAND_BYTES, Band, MIN_SCALE, band_count, band_height, band_step, columns_of, plan};
/// What a band is rendered from,
/// and the rendering.
pub use render::{Rendered, Scene, blocks_between, marks_between, render};
