//! The wrap indicator the gutter shows on a row that starts after a soft wrap.
//!
//! IntelliJ marks such a row with the first usable pair of symbols in
//! `CompositeSoftWrapPainter` (U+2926 and U+2925,
//! U+21B2 and U+21B3,
//! U+2936 and U+2937,
//! U+21A9 and U+21AA),
//!  and draws an arrow itself (`ArrowSoftWrapPainter`) when no pair can be displayed.
//! A pair is usable only when its font can display both symbols (`TextBasedSoftWrapPainter`);
//!  the symbol of the row after the wrap is the second of the pair.
//! The mark is painted in `EditorColors.SOFT_WRAP_SIGN_COLOR`,
//! `c0c0c0` in the Default scheme,
//!  which the Darcula scheme inherits.
//! Here the mark is set in the same shaper and the same fallback fonts as the source text,
//!  so what the coverage check says is what the gutter shows.

/// One code row is the height of the mark's cell.
use crate::row_map::CODE_ROW;
/// The shaper decides which symbols its fonts display,
/// and sets the one that is chosen.
use crate::shaped_text::TextShaper;
/// The raster paints the symbol with one given ink.
use crate::text_raster::{SourcePixels, TextRaster};
/// Failures of the glyph rasterizer reach the caller.
use anyhow::Result;
/// Glyph ids tell a displayable symbol from the font's missing-glyph box.
use parley::PositionedLayoutItem;

/// IntelliJ's `SOFT_WRAP_SIGN_COLOR` in the Default scheme,
/// which the Darcula scheme inherits:
///  the same straight RGBA ink in the light and the dark scheme.
pub const SIGN_INK: [u8; 4] = [0xC0, 0xC0, 0xC0, 0xFF];

/// What:
///  IntelliJ's candidate pairs in its order:
///  the symbol before a soft wrap,
/// and the symbol after it that marks the continuation row.
/// Why:
///  `CompositeSoftWrapPainter.SYMBOLS` lists these four before its private-use pair.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const SIGN_PAIRS = [['⤦', '⤥'], ['↲', '↳'], ['⤶', '⤷'], ['↩', '↪']];
/// ```
pub const SIGN_PAIRS: [(char, char); 4] = [
    ('\u{2926}', '\u{2925}'),
    ('\u{21B2}', '\u{21B3}'),
    ('\u{2936}', '\u{2937}'),
    ('\u{21A9}', '\u{21AA}'),
];

/// What:
///  What the gutter draws on a continuation row:
///  a symbol the fonts display,
///  or an arrow drawn by hand.
/// Why:
///  Shape is one of the two channels that tell the mark from a line number;
///  its color is the other.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Sign = { glyph: string } | 'arrow';
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Sign {
    /// The symbol after the wrap in the first pair whose symbols the fonts display.
    Glyph(
        /// The symbol that marks the row after the wrap.
        char,
    ),
    /// No pair is displayable,
    /// so an arrow is drawn.
    Arrow,
}

/// What:
///  The first pair of `SIGN_PAIRS` whose two symbols `can_display` accepts,
///  as the symbol of the row after the wrap;
///  an arrow when there is none.
/// Why:
///  The coverage predicate is a parameter so a test can state which symbols the fonts have.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function chooseSign(canDisplay: (c: string) => boolean): Sign;
/// ```
pub fn choose_sign(mut can_display: impl FnMut(char) -> bool) -> Sign {
    for (before, after) in SIGN_PAIRS {
        if can_display(before) && can_display(after) {
            return Sign::Glyph(after);
        }
    }
    return Sign::Arrow;
}

/// Coverage check and painting of the sign.
impl TextShaper {
    /// What:
    ///  Whether the source font or its fallbacks display `character` at `scale`:
    ///  the character shapes to at least one glyph and none of them is the missing-glyph box.
    /// Why:
    ///  Glyph zero is the font's box for a character it cannot show;
    ///  the shaper picks a fallback font when the primary lacks the character.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// canDisplay(character: string, scale: number): boolean;
    /// ```
    pub fn can_display(&mut self, character: char, scale: f32) -> bool {
        let layout = self.line_layout(&character.to_string(), scale, &[], &[]);
        let mut glyphs = 0_usize;
        for line in layout.lines() {
            for item in line.items() {
                let PositionedLayoutItem::GlyphRun(run) = item else {
                    continue;
                };
                for glyph in run.positioned_glyphs() {
                    if glyph.id == 0 {
                        return false;
                    }
                    glyphs += 1;
                }
            }
        }
        return glyphs > 0;
    }

    /// The sign this shaper's fonts can show,
    /// chosen from IntelliJ's pairs.
    pub fn choose_sign(&mut self, scale: f32) -> Sign {
        // The same walk as the free `choose_sign`, with the coverage check of this shaper at `scale`.
        for (before, after) in SIGN_PAIRS {
            if self.can_display(before, scale) && self.can_display(after, scale) {
                return Sign::Glyph(after);
            }
        }
        return Sign::Arrow;
    }

    /// What:
    ///  Paint `sign` into a cell `width` logical pixels wide and one code row tall at `scale`,
    ///  in [`SIGN_INK`].
    ///  A symbol is set like source text and ends at the cell's right edge,
    /// as line numbers do.
    /// Why:
    ///  The gutter shows this image,
    /// so the symbol is the one the coverage check shaped.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// signPixels(raster: TextRaster, sign: Sign, scale: number, width: number): Pixels;
    /// ```
    pub fn sign_pixels(
        &mut self,
        raster: &mut TextRaster,
        sign: Sign,
        scale: f32,
        width: f32,
    ) -> Result<SourcePixels> {
        let pixel_width = (width * scale).ceil().max(1.0) as u32;
        let pixel_height = (CODE_ROW * scale).ceil() as u32;
        match sign {
            Sign::Glyph(character) => {
                let layout = self.line_layout(&character.to_string(), scale, &[], &[]);
                let advance = layout.full_width();
                let left = pixel_width as f32 - advance;
                return raster.paint_layout(
                    &layout,
                    (left, 0.0),
                    SIGN_INK,
                    (pixel_width, pixel_height),
                );
            }
            Sign::Arrow => {
                return Ok(arrow_pixels(pixel_width, pixel_height, scale));
            }
        }
    }
}

/// Distance from the point `(px, py)` to the segment from `(ax, ay)` to `(bx, by)`.
fn distance(point: (f32, f32), from: (f32, f32), to: (f32, f32)) -> f32 {
    let (px, py) = point;
    let (dx, dy) = (to.0 - from.0, to.1 - from.1);
    let length = dx * dx + dy * dy;
    let along = if length == 0.0 {
        0.0
    } else {
        (((px - from.0) * dx + (py - from.1) * dy) / length).clamp(0.0, 1.0)
    };
    let (nearest_x, nearest_y) = (from.0 + along * dx, from.1 + along * dy);
    return ((px - nearest_x).powi(2) + (py - nearest_y).powi(2)).sqrt();
}

/// What:
///  An arrow drawn by hand in [`SIGN_INK`]:
///  a stem down from the upper left that turns to the right and ends in a head,
///  the shape of the symbol it stands in for.
/// Why:
///  `ArrowSoftWrapPainter` is IntelliJ's answer when no font shows a symbol of the pairs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function arrowPixels(width: number, height: number, scale: number): Pixels;
/// ```
fn arrow_pixels(width: u32, height: u32, scale: f32) -> SourcePixels {
    let cell = width as f32 / scale;
    let (stem, turn, tip) = (cell * 0.3, 15.0, cell - 2.0);
    // Stem, horizontal run, and the two strokes of the head, in logical pixels.
    let strokes = [
        ((stem, 6.0), (stem, turn)),
        ((stem, turn), (tip, turn)),
        ((tip, turn), (tip - 4.0, turn - 4.0)),
        ((tip, turn), (tip - 4.0, turn + 4.0)),
    ];
    let half = 1.25 * scale / 2.0;
    let mut bytes = vec![0_u8; (width * height * 4) as usize];
    for y in 0..height {
        for x in 0..width {
            let point = (x as f32 + 0.5, y as f32 + 0.5);
            let mut covered = 0.0_f32;
            for (from, to) in strokes {
                let near = distance(
                    point,
                    (from.0 * scale, from.1 * scale),
                    (to.0 * scale, to.1 * scale),
                );
                covered = covered.max((half + 0.5 - near).clamp(0.0, 1.0));
            }
            if covered > 0.0 {
                let offset = ((y * width + x) * 4) as usize;
                let alpha = (covered * 255.0).round() as u32;
                for channel in 0..3 {
                    bytes[offset + channel] =
                        ((u32::from(SIGN_INK[channel]) * alpha + 127) / 255) as u8;
                }
                bytes[offset + 3] = alpha as u8;
            }
        }
    }
    return SourcePixels {
        width,
        height,
        bytes,
    };
}
