//! The fills the window's markup draws behind the source glyphs:
//!  the selection,
//!  the other find matches,
//!  and the boundary of the active match.
//!  The window draws them as rectangles over the toolkit's background;
//!  the minimap has no such rectangles,
//!  so its scene draws the same ones as paint items under the glyphs,
//!  in the markup's order and inks.

/// The rectangles come from the same shaped rows as the glyphs.
use crate::shaped_text::{ReadingRect, ShapedView};
/// The fills are paint items beside the glyph runs.
use crate::tile_scene::Item;

/// What:
///  The inks of the markup's fills,
///  straight RGBA.
/// Why:
///  The selection fill and the foreground are properties of the window's palette,
///  which the minimap worker cannot read;
///  they travel with the request.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Fills = { selection: Rgba; foreground: Rgba; boundary: boolean };
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fills {
    /// The selection's background.
    pub selection: [u8; 4],
    /// The foreground,
    /// which the match fill and the boundaries are the translucent forms of.
    pub foreground: [u8; 4],
    /// Whether the selection is a find match,
    /// which the window outlines with a heavier boundary.
    pub boundary: bool,
}

/// Opacity of the fill of a match that is not the selection.
const MATCH_FILL: f32 = 0.14;

/// Opacity of the thin boundary of a match that is not the selection.
const MATCH_BOUNDARY: f32 = 0.7;

/// Width of the boundary of a match that is not the selection,
/// in logical pixels.
const MATCH_BOUNDARY_WIDTH: f32 = 1.0;

/// Width of the boundary of the active match,
/// in logical pixels.
const ACTIVE_BOUNDARY_WIDTH: f32 = 2.0;

/// A rectangle in whole pixels of the text at the view's scale:
/// left,
/// top,
/// right,
/// bottom.
#[derive(Clone, Copy)]
struct Cell {
    /// Left edge.
    left: i64,
    /// Top edge.
    top: i64,
    /// Right edge,
    /// not inside.
    right: i64,
    /// Bottom edge,
    /// not inside.
    bottom: i64,
}

/// A fill of `cell` in the straight RGBA `ink`,
/// or nothing when the ink is clear or the cell is empty.
fn fill(items: &mut Vec<Item>, cell: Cell, ink: [u8; 4]) {
    if ink[3] == 0 || cell.right <= cell.left || cell.bottom <= cell.top {
        return;
    }
    items.push(Item::Fill {
        left: cell.left as f32,
        top: cell.top as f32,
        right: cell.right as f32,
        bottom: cell.bottom as f32,
        ink,
    });
}

/// Fill the boundary of `cell`,
/// `width` pixels wide and inside it,
/// in `ink`,
/// as four rectangles that do not overlap.
fn outline(items: &mut Vec<Item>, cell: Cell, width: i64, ink: [u8; 4]) {
    let thick = width.max(1);
    let inner_top = (cell.top + thick).min(cell.bottom);
    let inner_bottom = (cell.bottom - thick).max(inner_top);
    fill(
        items,
        Cell {
            bottom: inner_top,
            ..cell
        },
        ink,
    );
    fill(
        items,
        Cell {
            top: inner_bottom,
            ..cell
        },
        ink,
    );
    fill(
        items,
        Cell {
            top: inner_top,
            bottom: inner_bottom,
            right: (cell.left + thick).min(cell.right),
            ..cell
        },
        ink,
    );
    fill(
        items,
        Cell {
            top: inner_top,
            bottom: inner_bottom,
            left: (cell.right - thick).max(cell.left),
            ..cell
        },
        ink,
    );
}

/// The straight RGBA `color` at `opacity` of its own alpha.
fn faded(color: [u8; 4], opacity: f32) -> [u8; 4] {
    let alpha = (f32::from(color[3]) * opacity).round().clamp(0.0, 255.0) as u8;
    return [color[0], color[1], color[2], alpha];
}

/// The pixels of `rectangle`,
/// in logical pixels of the text,
/// in a frame whose top is `origin` logical pixels down the text,
/// at `scale`:
/// edges rounded to the nearest pixel.
fn cell_of(rectangle: &ReadingRect, origin: f32, scale: f32, grow: (f32, f32, f32)) -> Cell {
    let (side, above, below) = grow;
    let left = (rectangle.x - side) * scale;
    let right = (rectangle.x + rectangle.width + side) * scale;
    let top = (rectangle.y - origin + above) * scale;
    let bottom = (rectangle.y + rectangle.height - origin + below) * scale;
    return Cell {
        left: left.round() as i64,
        top: top.round() as i64,
        right: right.round() as i64,
        bottom: bottom.round() as i64,
    };
}

/// What:
///  The paint items of the selection and the matches of `view`,
///  in physical pixels at the view's scale.
/// Why:
///  The markup draws a selection rectangle in the selection fill,
///  then each other match as a translucent foreground fill with a thin boundary over it,
///  and the glyphs over both;
///  the minimap puts these items before the glyph items,
///  so its marks stand where the window's rectangles do.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function fillItems(view: ShapedView, fills: Fills): Item[];
/// ```
pub fn fill_items(view: &ShapedView, fills: Fills) -> Vec<Item> {
    let scale = view.viewport.scale;
    let mut items = Vec::new();
    for rectangle in &view.selections {
        let cell = cell_of(rectangle, view.origin, scale, (0.0, 0.0, 0.0));
        fill(&mut items, cell, fills.selection);
        if fills.boundary {
            // The boundary sits just outside the character cells, two pixels to each side.
            let outer = cell_of(
                rectangle,
                view.origin,
                scale,
                (ACTIVE_BOUNDARY_WIDTH, 0.0, 0.0),
            );
            let width = (ACTIVE_BOUNDARY_WIDTH * scale).round() as i64;
            outline(&mut items, outer, width, fills.foreground);
        }
    }
    for rectangle in &view.matches {
        // A match is drawn one pixel wider on each side and one pixel shorter at the top and bottom.
        let cell = cell_of(rectangle, view.origin, scale, (1.0, 1.0, -1.0));
        fill(&mut items, cell, faded(fills.foreground, MATCH_FILL));
        let width = (MATCH_BOUNDARY_WIDTH * scale).round() as i64;
        outline(&mut items, cell, width, faded(fills.foreground, MATCH_BOUNDARY));
    }
    return items;
}
