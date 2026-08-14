//! Generates normalized SVG geometry for one stepped LED backplate.

/// What:     `Write` appends bounded SVG commands to one owned string.
/// Why:      Slint Path consumes the resulting command string without parsing row models.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const path: string[] = [];
/// ```
use std::fmt::Write as _;

/// Source convex outer plate radius in logical pixels.
const PLATE_RADIUS: f32 = 17.0;

/// Concave transition radius matching internal hardware corners.
const INNER_RADIUS: f32 = 2.0;

/// One content-width cap row derived from measured controls.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) struct RowGeometry {
    /// Vertical row origin.
    pub(super) y: f32,
    /// Leftmost plate edge on this row.
    pub(super) left: f32,
    /// Rightmost plate edge on this row.
    pub(super) width: f32,
    /// Slot height, including top and bottom plate margin.
    pub(super) height: f32,
}

/// Final one-piece plate properties written to Slint.
#[derive(Clone, Debug, PartialEq)]
pub(super) struct PlateGeometry {
    /// Horizontal paint origin relative to cap layout.
    pub(super) x: f32,
    /// SVG outline normalized to paint origin.
    pub(super) path: String,
    /// Bounding width of complete stepped path.
    pub(super) width: f32,
    /// Bounding height of complete stepped path.
    pub(super) height: f32,
}

/// Selects physical edge traversed around plate outline.
#[derive(Clone, Copy)]
enum PlateEdge {
    /// Uses rightmost row extent.
    Right,
    /// Uses leftmost row extent.
    Left,
}

/// Groups path mutation with adjacent row geometry.
struct TransitionOptions<'a> {
    /// Receives SVG commands.
    path: &'a mut String,
    /// Describes row before width transition.
    current: RowGeometry,
    /// Describes row after width transition.
    next: RowGeometry,
    /// Selects physical side of silhouette.
    edge: PlateEdge,
}

/// Appends one rounded row transition while traversing either plate edge.
fn append_transition(options: TransitionOptions<'_>) {
    let TransitionOptions { path, current, next, edge } = options;
    let current_x = match edge {
        PlateEdge::Right => current.width,
        PlateEdge::Left => current.left,
    };
    let next_x = match edge {
        PlateEdge::Right => next.width,
        PlateEdge::Left => next.left,
    };
    let (upper, lower) = if current.y < next.y { (current, next) } else { (next, current) };
    let overlap = (upper.y + upper.height - lower.y).max(0.0);
    let transition_y = lower.y + overlap / 2.0;
    let difference = next_x - current_x;
    if difference == 0.0 {
        write!(path, "V {transition_y:.3} ").expect("writing to String cannot fail");
        return;
    }
    let horizontal_direction = if difference > 0.0 { 1.0 } else { -1.0 };
    let vertical_direction = if next.y > current.y { 1.0 } else { -1.0 };
    let row_pitch = (next.y - current.y).abs();
    let first_is_outer = vertical_direction * horizontal_direction < 0.0;
    let first_base = if first_is_outer { PLATE_RADIUS } else { INNER_RADIUS };
    let second_base = if first_is_outer { INNER_RADIUS } else { PLATE_RADIUS };
    let scale = (difference.abs() / (first_base + second_base)).min(1.0);
    let first_radius = (first_base * scale).min(row_pitch / 2.0);
    let second_radius = (second_base * scale).min(row_pitch / 2.0);
    write!(
        path,
        "V {:.3} Q {:.3} {:.3} {:.3} {:.3} H {:.3} Q {:.3} {:.3} {:.3} {:.3} ",
        transition_y - vertical_direction * first_radius,
        current_x,
        transition_y,
        current_x + horizontal_direction * first_radius,
        transition_y,
        next_x - horizontal_direction * second_radius,
        next_x,
        transition_y,
        next_x,
        transition_y + vertical_direction * second_radius,
    )
    .expect("writing to String cannot fail");
}

/// Builds one rounded stepped SVG outline around all measured rows.
pub(super) fn plate_geometry(rows: &[RowGeometry]) -> Option<PlateGeometry> {
    let first = *rows.first()?;
    let origin_y = first.y;
    let origin_x = rows.iter().map(|row| row.left).fold(f32::INFINITY, f32::min);
    let maximum_x = rows.iter().map(|row| row.width).fold(f32::NEG_INFINITY, f32::max);
    let normalized = rows
        .iter()
        .map(|row| RowGeometry {
            y: row.y - origin_y,
            left: row.left - origin_x,
            width: row.width - origin_x,
            height: row.height,
        })
        .collect::<Vec<_>>();
    let first = normalized[0];
    let last = normalized[normalized.len() - 1];
    let height = last.y + last.height;
    let top_radius = PLATE_RADIUS.min((first.width - first.left) / 2.0);
    let bottom_radius = PLATE_RADIUS.min((last.width - last.left) / 2.0);
    let mut path = format!(
        "M {:.3} 0 H {:.3} Q {:.3} 0 {:.3} {top_radius:.3} ",
        first.left + top_radius,
        first.width - top_radius,
        first.width,
        first.width,
    );
    normalized.windows(2).for_each(|rows| {
        append_transition(TransitionOptions {
            path: &mut path,
            current: rows[0],
            next: rows[1],
            edge: PlateEdge::Right,
        });
    });
    write!(
        path,
        "V {:.3} Q {:.3} {:.3} {:.3} {:.3} H {:.3} Q {:.3} {:.3} {:.3} {:.3} ",
        height - bottom_radius,
        last.width,
        height,
        last.width - bottom_radius,
        height,
        last.left + bottom_radius,
        last.left,
        height,
        last.left,
        height - bottom_radius,
    )
    .expect("writing to String cannot fail");
    normalized.windows(2).rev().for_each(|rows| {
        append_transition(TransitionOptions {
            path: &mut path,
            current: rows[1],
            next: rows[0],
            edge: PlateEdge::Left,
        });
    });
    write!(
        path,
        "V {top_radius:.3} Q {:.3} 0 {:.3} 0 Z",
        first.left,
        first.left + top_radius,
    )
    .expect("writing to String cannot fail");
    Some(PlateGeometry {
        x: origin_x,
        width: maximum_x - origin_x,
        height,
        path,
    })
}
