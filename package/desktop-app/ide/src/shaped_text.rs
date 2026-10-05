//! Shared shaped rows replace independently centered fallback-font glyph items.

/// Canonical source remains in the read-only document.
use crate::document::Document;
/// Variable roman and real italic blobs retain stable cache identities.
use crate::font_asset::code_faces;
/// What: `pub use` re-exports the row types under this module's name.
/// Why: Callers written against `shaped_text` keep their imports while row geometry lives in its own file.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export { ReadingRect, ShapedRow } from './shaped-row';
/// ```
pub use crate::shaped_row::{ReadingRect, ShapedRow};
/// Syntax classifications stay independent of pixels.
use crate::source_style::StyleSpan;
/// Immutable font requests validate continuous weights before shaping.
use crate::source_typography::SourceTypography;
/// Tabs end on pixel tab stops, whatever script precedes them.
use crate::tab_layout::layout_with_tabs;
/// Source/display byte maps keep tabs and Unicode out of hit-test heuristics.
use crate::text_projection::project_line;
/// Construction failures identify unsupported source typography.
use anyhow::Result;
/// Font and paragraph layout are supplied by the same Parley stack Slint uses.
use parley::{
    Affinity, Cursor, FontContext, FontFamily, FontFeature, FontFeatures, FontStyle, FontWeight,
    Layout, LayoutContext, LineHeight, StyleProperty,
};
/// Font bytes are shared immutably across the font database.
use std::borrow::Cow;

/// What: `pub const` exports a compile-time value; `f32` is a 32-bit float of logical pixels (sibling `f64`).
/// Why: A selected line terminator has no glyph; a mark about one space wide shows that it is selected.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const TERMINATOR_MARK = 9;
/// ```
pub const TERMINATOR_MARK: f32 = 9.0;

/// Logical dimensions and scale of the source viewport.
#[derive(Clone, Copy, PartialEq)]
pub struct Viewport {
    /// First logical line materialized, including overscan.
    pub first: usize,
    /// Maximum number of source lines materialized.
    pub count: usize,
    /// Width of the raster in logical pixels.
    pub width: f32,
    /// Physical pixels per logical pixel.
    pub scale: f32,
}

/// Viewport text and selection geometry share these exact shaped rows.
pub struct ShapedView {
    /// Visible source rows.
    pub rows: Vec<ShapedRow>,
    /// Viewport request retained for coordinate conversion.
    pub viewport: Viewport,
    /// Physical raster width.
    pub width: u32,
    /// Physical raster height.
    pub height: u32,
    /// Shared logical selection rectangles drive both native backgrounds and glyph clipping.
    pub selections: Vec<ReadingRect>,
    /// In-file find rectangles from the same row geometry; filled by the native renderer.
    pub matches: Vec<ReadingRect>,
}

/// Own font discovery and shaping scratch space, rather than recreate per glyph.
pub struct TextShaper {
    /// Primary and fallback fonts, including the embedded source face.
    fonts: FontContext,
    /// Reusable paragraph-building allocations.
    layouts: LayoutContext<u32>,
    /// Immutable variable-weight, italic, and feature policy shared by rows and baseline probes.
    typography: SourceTypography,
    /// Measured space advance for one scale; typography is immutable, so only the scale can change it.
    space: Option<(f32, f32)>,
}

/// Constructing a default shaper registers the bundled source font.
impl Default for TextShaper {
    /// Keep default construction on the same embedded-font and feature policy as explicit construction.
    fn default() -> Self {
        return Self::new();
    }
}

/// Shape complete source lines while retaining a reusable font context.
impl TextShaper {
    /// Register the embedded primary face; system fonts supply other scripts.
    pub fn new() -> Self {
        return Self::with_typography(SourceTypography::default())
            .expect("valid default source typography");
    }

    /// Create a source shaper with explicit OpenType features, without changing source characters.
    /// Settings are immutable for this shaper; replacing it also requires invalidating native frame state.
    pub fn with_features(features: Vec<FontFeature>) -> Self {
        let typography = SourceTypography {
            features,
            ..SourceTypography::default()
        };
        return Self::with_typography(typography).expect("valid default source weight");
    }

    /// Select continuous variable weight and the real roman or italic face.
    pub fn with_typography(typography: SourceTypography) -> Result<Self> {
        typography.validate()?;
        let mut fonts = FontContext::new();
        // Registration includes both faces, so italic requests never depend on a host font or fake slant.
        for blob in code_faces() {
            fonts.collection.register_fonts(blob, None);
        }
        return Ok(Self {
            fonts,
            layouts: LayoutContext::new(),
            typography,
            space: None,
        });
    }

    /// Shape text with explicit source typography and no soft wrapping.
    /// `spacings` pairs a display byte with extra advance in logical pixels; tabs use it to reach their stop.
    pub(crate) fn line_layout(
        &mut self,
        text: &str,
        scale: f32,
        roles: &[(usize, usize, u32)],
        spacings: &[(usize, f32)],
    ) -> Layout<u32> {
        // Borrow the contexts only while constructing this owned layout.
        let mut builder = self
            .layouts
            .ranged_builder(&mut self.fonts, text, scale, true);
        builder.push_default(StyleProperty::FontFamily(FontFamily::Source(
            Cow::Borrowed("JetBrains Mono"),
        )));
        builder.push_default(StyleProperty::FontSize(15.0));
        builder.push_default(StyleProperty::FontWeight(FontWeight::new(
            self.typography.weight,
        )));
        let style = if self.typography.italic {
            FontStyle::Italic
        } else {
            FontStyle::Normal
        };
        builder.push_default(StyleProperty::FontStyle(style));
        builder.push_default(StyleProperty::LineHeight(LineHeight::Absolute(24.0)));
        builder.push_default(StyleProperty::Brush(0));
        builder.push_default(StyleProperty::FontFeatures(FontFeatures::List(
            Cow::Borrowed(&self.typography.features),
        )));
        for (start, end, role) in roles {
            builder.push(StyleProperty::Brush(*role), *start..*end);
        }
        // The stand-in space of a tab is one byte; spacing on it changes that one advance only.
        for (byte, extra) in spacings {
            builder.push(StyleProperty::LetterSpacing(*extra), *byte..*byte + 1);
        }
        let mut layout = builder.build(text);
        layout.break_all_lines(None);
        return layout;
    }

    /// Physical advance of one space in the source font at `scale`, measured once per scale.
    /// Tab stops are multiples of this advance, so it comes from the font, not from an assumed cell width.
    pub(crate) fn space_advance(&mut self, scale: f32) -> f32 {
        // What: `if let Some((known, advance))` runs only when a measurement is stored, naming its two parts.
        // Why: A viewport reshapes many tab lines per frame; the font is asked once.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.space && this.space[0] === scale) return this.space[1];
        // ```
        if let Some((known, advance)) = self.space
            && known == scale
        {
            return advance;
        }
        let probe = self.line_layout(" ", scale, &[], &[]);
        // The caret after the only character stands one space advance from the line start.
        let cursor = Cursor::from_byte_index(&probe, 1, Affinity::Upstream);
        let advance = cursor.geometry(&probe, 1.0).x0 as f32;
        self.space = Some((scale, advance));
        return advance;
    }

    /// Baseline of the primary font at `scale`; a known primary glyph makes it the same for all source rows.
    fn baseline(&mut self, scale: f32) -> f32 {
        let probe = self.line_layout("M", scale, &[], &[]);
        return probe
            .lines()
            .next()
            .expect("primary font line")
            .metrics()
            .baseline;
    }

    /// Shape one source line with syntax roles on a given common baseline.
    fn shape_row(
        &mut self,
        document: &Document,
        row: usize,
        scale: f32,
        styles: &[StyleSpan],
        baseline: f32,
    ) -> ShapedRow {
        let text = document.text();
        let source_start = text.line_to_char(row);
        let source = text.line(row).to_string();
        let projection = project_line(&source);
        let source_len = projection.source_to_byte.len().saturating_sub(1);
        let mut roles = Vec::new();
        for span in styles {
            let start = span.start.saturating_sub(source_start).min(source_len);
            let end = span.end.saturating_sub(source_start).min(source_len);
            if start < end {
                roles.push((
                    projection.source_to_byte[start],
                    projection.source_to_byte[end],
                    span.style as u32,
                ));
            }
        }
        let layout = layout_with_tabs(self, &projection, scale, &roles);
        let natural = layout
            .lines()
            .next()
            .expect("source line layout")
            .metrics()
            .baseline;
        return ShapedRow {
            row,
            source_start,
            projection,
            layout,
            baseline,
            baseline_shift: baseline - natural,
        };
    }

    /// Shape one arbitrary source line for reading geometry, without syntax colors.
    /// Caret movement uses it for lines outside the materialized viewport; `row` is clamped to the last line.
    pub fn row(&mut self, document: &Document, row: usize, scale: f32) -> ShapedRow {
        let last = document.text().len_lines().saturating_sub(1);
        let baseline = self.baseline(scale);
        return self.shape_row(document, row.min(last), scale, &[], baseline);
    }

    /// Prepare a visible viewport using native font advances rather than character cells.
    pub fn prepare(
        &mut self,
        document: &Document,
        viewport: Viewport,
        styles: &[StyleSpan],
    ) -> ShapedView {
        let text = document.text();
        let last = viewport
            .first
            .saturating_add(viewport.count)
            .min(text.len_lines());
        let baseline = self.baseline(viewport.scale);
        let mut rows = Vec::new();
        for row in viewport.first..last {
            rows.push(self.shape_row(document, row, viewport.scale, styles, baseline));
        }
        let width = (viewport.width.max(1.0) * viewport.scale).ceil() as u32;
        let height = ((last.saturating_sub(viewport.first).max(1) as f32) * 24.0 * viewport.scale)
            .ceil() as u32;
        let mut view = ShapedView {
            rows,
            viewport,
            width,
            height,
            selections: Vec::new(),
            matches: Vec::new(),
        };
        view.selections = view.selection(document);
        return view;
    }
}

/// Resolve reading geometry from the exact layouts used to paint source glyphs.
impl ShapedView {
    /// Convert a pointer to a source character using the shaping engine's hit test.
    pub fn hit(&self, document: &Document, row: usize, x: f32) -> usize {
        for shaped in &self.rows {
            if shaped.row == row {
                return shaped.hit(x, self.viewport.scale);
            }
        }
        let bounded_row = row.min(document.text().len_lines().saturating_sub(1));
        return document.text().line_to_char(bounded_row);
    }

    /// Return caret x using exactly the same glyph advances as drawing.
    pub fn caret(&self, document: &Document) -> ReadingRect {
        let head = document.position().head;
        let row = document.text().char_to_line(head);
        let mut x = 0.0;
        for shaped in &self.rows {
            if shaped.row == row {
                x = shaped.caret_x(head, self.viewport.scale);
            }
        }
        return ReadingRect {
            x,
            y: row as f32 * 24.0 + 2.0,
            width: 2.0,
            height: 20.0,
        };
    }

    /// Return per-line selection rectangles without including annotations in source.
    /// A selected line terminator is marked after the line's text, so a selected empty line stays visible.
    pub fn selection(&self, document: &Document) -> Vec<ReadingRect> {
        let position = document.position();
        let start = position.anchor.min(position.head);
        let end = position.anchor.max(position.head);
        let mut result = Vec::new();
        for shaped in &self.rows {
            result.extend(shaped.range(start, end, self.viewport.scale));
            // The terminator sits after the row's visible text and has no glyph of its own.
            let row_end = shaped.source_start + shaped.source_len();
            if start <= row_end && end > row_end {
                result.push(ReadingRect {
                    x: shaped.caret_x(row_end, self.viewport.scale),
                    y: shaped.row as f32 * 24.0,
                    width: TERMINATOR_MARK,
                    height: 24.0,
                });
            }
        }
        return result;
    }

    /// Return per-line rectangles for any source character range in the materialized rows.
    /// Selection and in-file find matches share this path, so neither reshapes a ligature.
    pub fn range(&self, start: usize, end: usize) -> Vec<ReadingRect> {
        let mut result = Vec::new();
        for shaped in &self.rows {
            result.extend(shaped.range(start, end, self.viewport.scale));
        }
        return result;
    }
}
