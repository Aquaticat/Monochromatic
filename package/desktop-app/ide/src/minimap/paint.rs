//! Painting the glyph cells of one picture row into the minimap's bytes.

/// The opacity the whole picture is composited with.
use super::raster::IMAGE_ALPHA;

/// Weight of a printable ASCII glyph in the clean renderer.
const ASCII_WEIGHT: f32 = 0.8;

/// Weight of any other drawn glyph in the clean renderer.
const OTHER_WEIGHT: f32 = 0.4;

/// One drawn glyph of a row:
/// its column,
/// its ink,
/// and its weight class.
pub(super) struct Cell {
    /// Column from the start of the picture row.
    pub(super) column: usize,
    /// Syntax ink of the glyph.
    pub(super) rgb: [u8; 3],
    /// Printable ASCII,
    /// which weighs twice what any other glyph does.
    pub(super) ascii: bool,
}

/// Write one drawn pixel row of `cells` into row `row` of `bytes`:
///  each glyph fills the physical pixels of its column with its ink,
///  weighed by `weight` and by the glyph's class,
/// premultiplied.
pub(super) fn paint_row(
    bytes: &mut [u8],
    width: usize,
    row: usize,
    cells: &[Cell],
    weight: f32,
    scale: f32,
) {
    if weight <= 0.0 {
        return;
    }
    let line = &mut bytes[row * width * 4..(row + 1) * width * 4];
    for cell in cells {
        let class = if cell.ascii {
            ASCII_WEIGHT
        } else {
            OTHER_WEIGHT
        };
        let alpha = (255.0 * IMAGE_ALPHA * class * weight).round() as u32;
        let from = ((cell.column as f32) * scale).round() as usize;
        let to = (((cell.column + 1) as f32) * scale)
            .round()
            .max(from as f32 + 1.0) as usize;
        for pixel in from..to.min(width) {
            for channel in 0..3 {
                line[pixel * 4 + channel] =
                    ((u32::from(cell.rgb[channel]) * alpha + 127) / 255) as u8;
            }
            line[pixel * 4 + 3] = alpha as u8;
        }
    }
}
