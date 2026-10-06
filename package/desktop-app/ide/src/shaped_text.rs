//! Shared shaped rows replace independently centered fallback-font glyph items.

/// Positioned hints and diagnostic marks travel with the frame they were laid out against.
use crate::annotation_layout::AnnotationFrame;
/// Canonical source remains in the read-only document.
use crate::document::Document;
/// Variable roman and real italic blobs retain stable cache identities; the interface face sets virtual rows.
use crate::font_asset::{code_faces, row_face};
/// The one vertical mapping: where each line's code row starts and how tall rows and the caret are.
use crate::row_map::{CODE_ROW, RowMap};
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
/// Height and text size of the virtual rows above annotated lines.
use crate::virtual_row::{ROW_HEIGHT, ROW_TEXT};
/// Construction failures identify unsupported source typography.
use anyhow::Result;
/// Font and paragraph layout are supplied by the same Parley stack Slint uses.
use parley::{
    Affinity, Cursor, FontContext, FontFamily, FontFeature, FontFeatures, FontStyle, FontWeight,
    Layout, LayoutContext, LineHeight, StyleProperty,
};
/// Font bytes are shared immutably across the font database.
use std::borrow::Cow;

/// Reading geometry of a prepared frame: hits, caret, selection and range rectangles, and rebasing.
mod view;

/// What: `pub const` exports a compile-time value; `f32` is a 32-bit float of logical pixels (sibling `f64`).
/// Why: A selected line terminator has no glyph; a mark about one space wide shows that it is selected.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const TERMINATOR_MARK = 9;
/// ```
pub const TERMINATOR_MARK: f32 = 9.0;

/// What: Paint role of virtual-row glyphs, a number outside the syntax roles; `u32` is the brush type of layouts.
/// Why: The raster paints hints and messages with one given ink each, never with a syntax or selection color.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const ROW_ROLE = 65;
/// ```
pub const ROW_ROLE: u32 = 65;

/// Family name of the bundled interface face, as its name table spells it.
const ROW_FAMILY: &str = "Inter Variable";

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
    /// Top of the raster in logical pixels from the top of the text: the top of the first materialized
    /// line's block.
    pub origin: f32,
    /// The vertical mapping this frame was shaped against; rows outside the frame are placed by it.
    pub map: RowMap,
    /// Shared logical selection rectangles drive both native backgrounds and glyph clipping.
    pub selections: Vec<ReadingRect>,
    /// In-file find rectangles from the same row geometry; filled by the native renderer.
    pub matches: Vec<ReadingRect>,
    /// What: `Option<AnnotationFrame>` is the frame's positioned hints and diagnostic marks, or nothing.
    /// Why: The renderer fills it after shaping; rows are never changed by it, so reading geometry ignores it.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// annotations?: AnnotationFrame;
    /// ```
    pub annotations: Option<AnnotationFrame>,
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
        // Virtual rows are set in the bundled interface face, never in whatever the host calls by that name.
        fonts.collection.register_fonts(row_face(), None);
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
        // Glyphs are set on a line box as tall as one code row; where that row sits is the row map's business.
        builder.push_default(StyleProperty::LineHeight(LineHeight::Absolute(CODE_ROW)));
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

    /// What: Shape the text of one virtual row, an inlay hint or one row of a diagnostic message: the
    ///       interface face at [`ROW_TEXT`] on a line box of [`ROW_HEIGHT`], regular weight, upright.
    ///       `&str` lends the text; the answer is an owned layout.
    /// Why: The reference editor sets these rows in its interface face, which tells them from source text at
    ///      a glance. The text is never part of a source line, and the raster paints it in one given ink.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// rowLayout(text: string, scale: number): Layout;
    /// ```
    pub fn row_layout(&mut self, text: &str, scale: f32) -> Layout<u32> {
        let mut builder = self
            .layouts
            .ranged_builder(&mut self.fonts, text, scale, true);
        builder.push_default(StyleProperty::FontFamily(FontFamily::Source(
            Cow::Borrowed(ROW_FAMILY),
        )));
        builder.push_default(StyleProperty::FontSize(ROW_TEXT));
        builder.push_default(StyleProperty::FontWeight(FontWeight::new(400.0)));
        builder.push_default(StyleProperty::FontStyle(FontStyle::Normal));
        builder.push_default(StyleProperty::LineHeight(LineHeight::Absolute(ROW_HEIGHT)));
        builder.push_default(StyleProperty::Brush(ROW_ROLE));
        let mut layout = builder.build(text);
        layout.break_all_lines(None);
        return layout;
    }

    /// Prototype variant: one hint label in the source family's real italic face at 13 px.
    pub fn hint_layout(&mut self, text: &str, scale: f32) -> Layout<u32> {
        let mut builder = self
            .layouts
            .ranged_builder(&mut self.fonts, text, scale, true);
        builder.push_default(StyleProperty::FontFamily(FontFamily::Source(
            Cow::Borrowed("JetBrains Mono"),
        )));
        builder.push_default(StyleProperty::FontSize(ROW_TEXT));
        builder.push_default(StyleProperty::FontWeight(FontWeight::new(
            self.typography.weight,
        )));
        builder.push_default(StyleProperty::FontStyle(FontStyle::Italic));
        builder.push_default(StyleProperty::LineHeight(LineHeight::Absolute(ROW_HEIGHT)));
        builder.push_default(StyleProperty::Brush(ROW_ROLE));
        builder.push_default(StyleProperty::FontFeatures(FontFeatures::List(
            Cow::Borrowed(&self.typography.features),
        )));
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
    /// `place` pairs the line with the top of its code row in logical pixels.
    fn shape_row(
        &mut self,
        document: &Document,
        place: (usize, f32),
        scale: f32,
        styles: &[StyleSpan],
        baseline: f32,
    ) -> ShapedRow {
        let (row, top) = place;
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
            top,
            source_start,
            projection,
            layout,
            baseline,
            baseline_shift: baseline - natural,
        };
    }

    /// Shape one arbitrary source line for reading geometry, without syntax colors.
    /// Caret movement uses it for lines outside the materialized viewport; `row` is clamped to the last line.
    /// The row has no vertical position: its `top` is zero, and only its horizontal geometry is meaningful.
    pub fn row(&mut self, document: &Document, row: usize, scale: f32) -> ShapedRow {
        let last = document.text().len_lines().saturating_sub(1);
        let baseline = self.baseline(scale);
        return self.shape_row(document, (row.min(last), 0.0), scale, &[], baseline);
    }

    /// Prepare a visible viewport of a text without virtual rows: line `n` starts at `n` code rows.
    pub fn prepare(
        &mut self,
        document: &Document,
        viewport: Viewport,
        styles: &[StyleSpan],
    ) -> ShapedView {
        let map = RowMap::plain(document.text().len_lines());
        return self.prepare_rows(document, viewport, styles, &map);
    }

    /// What: Prepare a visible viewport using native font advances rather than character cells, with every
    ///       row placed by `map`. `&RowMap` lends the vertical mapping; the view keeps its own copy.
    /// Why: Lines with virtual rows above them start lower than their line number alone says; the frame,
    ///      its selection rectangles, and its raster all take row positions from this one mapping.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// prepareRows(document: Document, viewport: Viewport, styles: StyleSpan[], map: RowMap): ShapedView;
    /// ```
    pub fn prepare_rows(
        &mut self,
        document: &Document,
        viewport: Viewport,
        styles: &[StyleSpan],
        map: &RowMap,
    ) -> ShapedView {
        let text = document.text();
        let last = viewport
            .first
            .saturating_add(viewport.count)
            .min(text.len_lines());
        let baseline = self.baseline(viewport.scale);
        let mut rows = Vec::new();
        for row in viewport.first..last {
            let place = (row, map.code_top(row));
            rows.push(self.shape_row(document, place, viewport.scale, styles, baseline));
        }
        let width = (viewport.width.max(1.0) * viewport.scale).ceil() as u32;
        // The raster spans every materialized line with its block; an empty frame is still one row tall.
        let origin = map.block_top(viewport.first);
        let extent = (map.block_top(last) - origin).max(CODE_ROW);
        let height = (extent * viewport.scale).ceil() as u32;
        let mut view = ShapedView {
            rows,
            viewport,
            width,
            height,
            origin,
            // `clone` copies the mapping so the frame stays consistent while the window's own map moves on.
            map: map.clone(),
            selections: Vec::new(),
            matches: Vec::new(),
            annotations: None,
        };
        view.selections = view.selection(document);
        return view;
    }
}
