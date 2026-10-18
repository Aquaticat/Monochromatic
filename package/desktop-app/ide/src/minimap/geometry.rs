//! The minimap's geometry:
//! where the picture,
//! the viewport box,
//! and a pointer position are,
//!  as pure functions of the text's height and the view's height.

/// The vertical mapping the minimap's rows come from and go back to.
use crate::row_map::{CODE_ROW, RowMap};

/// What:
///  Logical width of the minimap at full size,
/// in pixels,
/// one pixel for each source column.
/// Why:
///  CodeGlance Pro's `CodeGlanceConfig.mainWidth` default is 110,
/// and the picture shows no column past it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const WIDTH = 110;
/// ```
pub const WIDTH: f32 = 110.0;

/// What:
///  Narrowest logical width a narrow view shrinks the minimap to.
/// Why:
///  CodeGlance Pro's `GlancePanel.getLogicalWidth` never goes below 15 when it shrinks the minimap beside a split.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const NARROWEST = 15;
/// ```
pub const NARROWEST: f32 = 15.0;

/// What:
///  The view's width divided by this is the widest the minimap gets in a narrow view.
/// Why:
///  CodeGlance Pro takes one twelfth of the editor beside a split;
/// the source view's sidebar split is the
///  nearest equivalent,
/// and one sixth keeps the full width from a view 660 pixels wide on.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const VIEW_SHARE = 6;
/// ```
pub const VIEW_SHARE: f32 = 6.0;

/// What:
///  Logical pixels of the picture for each source row while the whole text fits the view.
/// Why:
///  CodeGlance Pro's `pixelsPerLine` default is 4;
/// the picture of a longer text is squeezed to the view
///  (its `Fit` size mode) because the whole file has to show.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const PIXELS_PER_ROW = 4;
/// ```
pub const PIXELS_PER_ROW: f32 = 4.0;

/// What:
///  Shortest the viewport box is drawn,
/// in logical pixels.
/// Why:
///  CodeGlance Pro's `MIN_VIEWPORT_HEIGHT` is 20 (below it the box has square corners);
/// it sets no floor,
///  so a box over a 50,000 line text would be a fraction of a pixel and disappear.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const MIN_BOX = 20;
/// ```
pub const MIN_BOX: f32 = 20.0;

/// What:
///  The width of the minimap for a view `view_width` logical pixels wide:
///  [`WIDTH`],
/// or a sixth of the view when that is narrower,
/// and never under [`NARROWEST`].
/// Why:
///  The text area is what is left of the view,
/// so a narrow window must not lose its text to the minimap.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function widthFor(viewWidth: number): number;
/// ```
pub fn width_for(view_width: f32) -> f32 {
    return (view_width / VIEW_SHARE).clamp(NARROWEST, WIDTH).round();
}

/// What:
///  One visual row of the text:
/// its source line and its place among that line's rows.
/// Why:
///  A click on the minimap and the picture's rows both name rows this way,
/// as the vertical mapping does.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Target = { line: number; row: number };
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Target {
    /// Zero-based source line.
    pub line: usize,
    /// Zero-based visual row within that line.
    pub row: usize,
}

/// What:
///  The minimap column for a text `content` logical pixels tall in a view `view` pixels tall:
///  the scale of its picture,
/// the track the picture covers,
/// the viewport box,
/// and the maps between a minimap
///  position,
/// a scroll offset,
/// and a visual row.
/// Why:
///  The Slint markup moves the box from the same numbers,
/// and the native code turns a click or a drag back into a
///  scroll offset with them;
/// one type holds both directions so a test can hold them against each other.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Geometry { constructor(content: number, view: number); scale(): number; track(): number; /* ... */ }
/// ```
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Geometry {
    /// Height of the whole text with its virtual rows,
    /// in logical pixels;
    /// never negative.
    content: f32,
    /// Height of the view,
    /// and of the minimap beside it,
    /// in logical pixels;
    /// never negative.
    view: f32,
}

/// The sizes and positions of one minimap column.
impl Geometry {
    /// The geometry of a text `content` pixels tall in a view `view` pixels tall;
    /// negative inputs count as zero.
    pub fn new(content: f32, view: f32) -> Self {
        return Self {
            content: content.max(0.0),
            view: view.max(0.0),
        };
    }

    /// Logical pixels of the picture for each pixel of the text:
    ///  [`PIXELS_PER_ROW`] over one code row while the text fits the view at that scale,
    /// otherwise the view over the
    ///  text,
    /// so the picture always shows the whole text.
    pub fn scale(&self) -> f32 {
        let natural = PIXELS_PER_ROW / CODE_ROW;
        if self.content <= 0.0 {
            return natural;
        }
        return natural.min(self.view / self.content);
    }

    /// Height of the picture in logical pixels:
    /// the whole text at [`Self::scale`],
    /// never taller than the view.
    pub fn track(&self) -> f32 {
        return (self.content * self.scale()).min(self.view);
    }

    /// Whether the picture is squeezed:
    /// several rows of the text share one pixel of it.
    pub fn squeezed(&self) -> bool {
        return self.scale() < PIXELS_PER_ROW / CODE_ROW;
    }

    /// Height of the viewport box:
    /// the view at [`Self::scale`],
    /// at least [`MIN_BOX`],
    /// and never more than the track.
    pub fn box_height(&self) -> f32 {
        return (self.view * self.scale()).max(MIN_BOX).min(self.track());
    }

    /// How far the box can travel down the track:
    /// the track less the box.
    pub fn room(&self) -> f32 {
        return (self.track() - self.box_height()).max(0.0);
    }

    /// The largest scroll offset:
    /// the text less the view,
    /// zero for a text that fits.
    pub fn max_offset(&self) -> f32 {
        return (self.content - self.view).max(0.0);
    }

    /// Top of the viewport box for a view scrolled to `offset`:
    ///  the offset's share of the scroll range,
    /// as a share of the box's room.
    ///  The first offset puts the box at the top and the last at the bottom of the track.
    pub fn box_top(&self, offset: f32) -> f32 {
        let range = self.max_offset();
        if range <= 0.0 {
            return 0.0;
        }
        return self.room() * (offset / range).clamp(0.0, 1.0);
    }

    /// The text position,
    /// in logical pixels from its top,
    /// the minimap position `y` shows.
    ///  A position above or below the track is clamped to its ends.
    pub fn content_y(&self, y: f32) -> f32 {
        let track = self.track();
        if track <= 0.0 {
            return 0.0;
        }
        return (y.clamp(0.0, track) / self.scale()).min(self.content);
    }

    /// The minimap position of the text position `content_y`.
    pub fn y_of(&self, content_y: f32) -> f32 {
        return (content_y.clamp(0.0, self.content) * self.scale()).min(self.track());
    }

    /// What:
    ///  The scroll offset a drag of the viewport box gives:
    ///  the box was grabbed at `start_y` with the view at `start_offset`,
    /// and the pointer is at `y`.
    ///  The box follows the pointer one to one,
    /// so the offset moves by the pointer's distance over the box's room,
    ///  times the scroll range.
    /// Why:
    ///  CodeGlance Pro's `ScrollBar.mouseDragged` scales the drag by `maxViewportStart / movableHeight`.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// dragOffset(startOffset: number, startY: number, y: number): number;
    /// ```
    pub fn drag_offset(&self, start_offset: f32, start_y: f32, y: f32) -> f32 {
        let room = self.room();
        let range = self.max_offset();
        if room <= 0.0 {
            return start_offset.clamp(0.0, range);
        }
        return (start_offset + (y - start_y) * range / room).clamp(0.0, range);
    }

    /// What:
    ///  The scroll offset that puts the text position `content_y` in the middle of the view,
    ///  held to the scroll range.
    /// Why:
    ///  CodeGlance Pro's click scrolls its target to the center (`ScrollType.CENTER`),
    /// also near the ends,
    ///  where the range stops the view short of the middle.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// centered(contentY: number): number;
    /// ```
    pub fn centered(&self, content_y: f32) -> f32 {
        return (content_y - self.view / 2.0).clamp(0.0, self.max_offset());
    }

    /// The visual row of `map` the minimap position `y` shows.
    ///  A position in the virtual rows above a line shows that line's first row.
    pub fn target(&self, map: &RowMap, y: f32) -> Target {
        let content_y = self.content_y(y);
        let place = map.locate(content_y);
        let row = if place.in_block {
            0
        } else {
            map.visual_row_at(place.line, content_y)
        };
        return Target {
            line: place.line,
            row,
        };
    }

    /// The minimap position of the top of `target`'s visual row:
    /// the inverse of [`Self::target`] up to the pixel.
    pub fn y_of_row(&self, map: &RowMap, target: Target) -> f32 {
        let line = target.line.min(map.lines() - 1);
        let row = target.row.min(map.rows_of(line) - 1);
        return self.y_of(map.code_top(line) + row as f32 * CODE_ROW);
    }
}
