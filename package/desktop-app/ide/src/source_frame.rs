//! Distinguish glyph-image changes from caret-only presentation changes.

/// Canonical source revision and selection define source paint inputs.
use crate::document::Document;
/// Physical tile geometry determines materialized rows and font scale.
use crate::shaped_text::Viewport;
/// Palette colors affect pixels but not caret geometry.
use crate::text_raster::CodeColors;
/// Syntax spans belong to the source paint key even when text is unchanged.
use crate::view_model::StyleSpan;

/// What: PartialEq generates field-by-field equality for this owned value.
/// Why: Reusing an image requires every paint input to match, not a lossy hash.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type FrameStamp = { revision: number; selection: [number, number]; /* paint inputs */ };
/// ```
#[derive(PartialEq)]
pub struct FrameStamp {
    /// Content change sequence within the displayed document.
    revision: u64,
    /// Normalized range; all collapsed carets share an empty paint selection.
    selection: (usize, usize),
    /// Materialized rows, physical scale, and tile width.
    viewport: Viewport,
    /// Horizontal tile origin affects subpixel glyph positions.
    horizontal: f32,
    /// Foreground and selection colors include current system appearance.
    colors: CodeColors,
    /// Owned classifications prevent reuse after a syntax-only change.
    styles: Vec<StyleSpan>,
}

impl FrameStamp {
    /// Capture image inputs without including a collapsed caret's position.
    /// Reset the cached stamp when replacing the document with a different file.
    pub fn new(document: &Document, viewport: Viewport, horizontal: f32, colors: CodeColors, styles: &[StyleSpan]) -> Self {
        let position = document.position();
        let mut selection = (0, 0);
        if position.anchor != position.head {
            selection = (position.anchor.min(position.head), position.anchor.max(position.head));
        }
        // What: to_vec copies the borrowed syntax slice into owned values.
        // Why: Subsequent syntax updates must not mutate the previous frame's identity.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { revision: document.revision, selection, viewport, horizontal, colors, styles: [...styles] };
        // ```
        return Self { revision: document.revision(), selection, viewport, horizontal, colors, styles: styles.to_vec() };
    }
}
