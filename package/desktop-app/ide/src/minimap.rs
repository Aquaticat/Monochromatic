//! The minimap:
//! the scroll control of the source view and the picture of the whole text it shows,
//!  with CodeGlance Pro's defaults.
//!
//! The geometry (`geometry`) is pure:
//! the picture's scale and height,
//! the viewport box,
//! and the maps between a
//!  position on the minimap,
//! a scroll offset,
//! and a visual row of the vertical mapping.
//! The picture (`raster`) is built from that mapping on a worker thread,
//! one pixel for each source column,
//!  with a work budget,
//! so its cost follows the height of the track and never the length of the text.

/// The minimap's sizes,
/// the viewport box,
/// and the maps between pixels and visual rows.
mod geometry;
/// The picture of the whole text,
/// built within a work budget.
mod raster;

/// The geometry's sizes,
///  the target of a position,
///  and the maps between pixels and visual rows.
pub use geometry::{
    Geometry, MIN_BOX, NARROWEST, PIXELS_PER_ROW, Target, VIEW_SHARE, WIDTH, width_for,
};
/// The picture's build,
///  its inputs,
///  its two work budgets,
///  and what it reports.
pub use raster::{
    Built, FULL_WORK, IMAGE_ALPHA, Input, QUICK_WORK, Stats, TAB_COLUMNS, build, column_advance,
};
