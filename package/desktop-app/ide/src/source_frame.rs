//! Distinguish glyph-image changes from caret-only presentation changes.

/// Canonical source revision and selection define source paint inputs.
use crate::document::Document;
/// Physical tile geometry determines materialized rows and font scale.
use crate::shaped_text::Viewport;
/// Syntax spans belong to the source paint key even when text is unchanged.
use crate::source_style::SourceStyles;
/// Palette colors affect pixels but not caret geometry.
use crate::text_raster::CodeColors;
/// Pointer equality avoids walking unchanged classifications on caret-only updates.
use std::sync::Arc;

/// What: Retain every input affecting source pixels, independent of caret position.
/// Why: Reusing an image requires exact paint identity, not a lossy hash.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type FrameStamp = { revision: number; selection: [number, number]; /* paint inputs */ };
/// ```
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
    /// Shared immutable classifications prevent copying the whole span list on each caret step.
    styles: SourceStyles,
}

/// Compare exact paint inputs, using shared snapshot identity before comparing new span contents.
impl PartialEq for FrameStamp {
    /// Unchanged source classifications require no per-span equality scan.
    fn eq(&self, other: &Self) -> bool {
        return self.revision == other.revision
            && self.selection == other.selection
            && self.viewport == other.viewport
            && self.horizontal == other.horizontal
            && self.colors == other.colors
            && (Arc::ptr_eq(&self.styles, &other.styles) || self.styles == other.styles);
    }
}

/// Capture immutable paint inputs without treating a collapsed caret as image content.
impl FrameStamp {
    /// Capture image inputs without including a collapsed caret's position.
    /// Reset the cached stamp when replacing the document with a different file.
    pub fn new(
        document: &Document,
        viewport: Viewport,
        horizontal: f32,
        colors: CodeColors,
        styles: SourceStyles,
    ) -> Self {
        let position = document.position();
        let mut selection = (0, 0);
        if position.anchor != position.head {
            selection = (
                position.anchor.min(position.head),
                position.anchor.max(position.head),
            );
        }
        // Transfer the immutable shared handle, not a copy of all source classifications.
        return Self {
            revision: document.revision(),
            selection,
            viewport,
            horizontal,
            colors,
            styles,
        };
    }
}
