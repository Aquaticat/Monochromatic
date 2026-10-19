//! The fills the window's markup draws behind the source glyphs:
//!  the selection,
//!  the other find matches,
//!  and the boundary of the active match.
//!  The window draws them as rectangles over the toolkit's background;
//!  a band that stands for the window's pixels draws the same rectangles into its raster first,
//!  in the markup's order and inks.

/// The rectangles come from the same shaped rows as the glyphs.
use crate::shaped_text::{ReadingRect, ShapedView};

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

/// A rectangle in whole pixels of a raster:
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

/// The raster the fills go into.
struct Canvas<'a> {
    /// Premultiplied RGBA bytes.
    bytes: &'a mut [u8],
    /// Pixels of a row.
    width: i64,
    /// Rows.
    height: i64,
}

/// Drawing into a raster.
impl Canvas<'_> {
    /// Composite the straight RGBA `color` over every pixel of `cell` that lies in the raster.
    fn fill(&mut self, cell: Cell, color: [u8; 4]) {
        let alpha = u32::from(color[3]);
        if alpha == 0 {
            return;
        }
        let inverse = 255 - alpha;
        for row in cell.top.max(0)..cell.bottom.min(self.height) {
            for column in cell.left.max(0)..cell.right.min(self.width) {
                let at = ((row * self.width + column) * 4) as usize;
                for (channel, ink) in color.iter().take(3).enumerate() {
                    let source = (u32::from(*ink) * alpha + 127) / 255;
                    let below = (u32::from(self.bytes[at + channel]) * inverse + 127) / 255;
                    self.bytes[at + channel] = (source + below).min(255) as u8;
                }
                let below = (u32::from(self.bytes[at + 3]) * inverse + 127) / 255;
                self.bytes[at + 3] = (alpha + below).min(255) as u8;
            }
        }
    }

    /// Draw the boundary of `cell`,
    /// `width` pixels wide and inside it,
    /// in `color`.
    fn outline(&mut self, cell: Cell, width: i64, color: [u8; 4]) {
        let thick = width.max(1);
        let inner_top = (cell.top + thick).min(cell.bottom);
        let inner_bottom = (cell.bottom - thick).max(inner_top);
        self.fill(
            Cell {
                bottom: inner_top,
                ..cell
            },
            color,
        );
        self.fill(
            Cell {
                top: inner_bottom,
                ..cell
            },
            color,
        );
        let left = Cell {
            top: inner_top,
            bottom: inner_bottom,
            right: (cell.left + thick).min(cell.right),
            ..cell
        };
        self.fill(left, color);
        let right = Cell {
            top: inner_top,
            bottom: inner_bottom,
            left: (cell.right - thick).max(cell.left),
            ..cell
        };
        self.fill(right, color);
    }
}

/// The straight RGBA `color` at `opacity` of its own alpha.
fn faded(color: [u8; 4], opacity: f32) -> [u8; 4] {
    let alpha = (f32::from(color[3]) * opacity).round().clamp(0.0, 255.0) as u8;
    return [color[0], color[1], color[2], alpha];
}

/// The pixels of `rectangle`,
/// in logical pixels of the text,
/// in a raster whose top is `origin` logical pixels down the text,
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
///  Draw the selection and the matches of `view` into `bytes`,
///  a raster `width` by `height` pixels at the view's scale.
/// Why:
///  The markup draws a selection rectangle in the selection fill,
///  then each other match as a translucent foreground fill with a thin boundary over it,
///  and the glyphs over both;
///  a band does the same,
/// so the glyphs painted next land on the same pixels the window shows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function paintFills(bytes: Uint8Array, size: [number, number], view: ShapedView, fills: Fills): void;
/// ```
pub fn paint_fills(bytes: &mut [u8], size: (u32, u32), view: &ShapedView, fills: Fills) {
    let scale = view.viewport.scale;
    let mut canvas = Canvas {
        bytes,
        width: i64::from(size.0),
        height: i64::from(size.1),
    };
    for rectangle in &view.selections {
        let cell = cell_of(rectangle, view.origin, scale, (0.0, 0.0, 0.0));
        canvas.fill(cell, fills.selection);
        if fills.boundary {
            // The boundary sits just outside the character cells, two pixels to each side.
            let outer = cell_of(
                rectangle,
                view.origin,
                scale,
                (ACTIVE_BOUNDARY_WIDTH, 0.0, 0.0),
            );
            let width = (ACTIVE_BOUNDARY_WIDTH * scale).round() as i64;
            canvas.outline(outer, width, fills.foreground);
        }
    }
    for rectangle in &view.matches {
        // A match is drawn one pixel wider on each side and one pixel shorter at the top and bottom.
        let cell = cell_of(rectangle, view.origin, scale, (1.0, 1.0, -1.0));
        canvas.fill(cell, faded(fills.foreground, MATCH_FILL));
        let width = (MATCH_BOUNDARY_WIDTH * scale).round() as i64;
        canvas.outline(cell, width, faded(fills.foreground, MATCH_BOUNDARY));
    }
}
