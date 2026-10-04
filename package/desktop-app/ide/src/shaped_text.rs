//! Shared shaped rows replace independently centered fallback-font glyph items.

/// Font and paragraph layout are supplied by the same Parley stack Slint uses.
use parley::{Affinity, Cursor, FontContext, FontFamily, FontFeature, FontFeatures, Layout, LayoutContext, LineHeight, Selection, StyleProperty};
/// Four-byte OpenType tags avoid stringly typed feature names in the source defaults.
use parley::setting::Tag;
/// Font bytes are shared immutably across the font database.
use std::{borrow::Cow, sync::Arc};
/// Canonical source remains in the read-only document.
use crate::document::Document;
/// Source/display byte maps keep tabs and Unicode out of hit-test heuristics.
use crate::text_projection::{project_line, Projection};
/// Syntax classifications stay independent of pixels.
use crate::source_style::StyleSpan;

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

/// One source line shaped with one common baseline across all font fallback runs.
pub struct ShapedRow {
    /// Global logical source line.
    pub row: usize,
    /// Global source character start.
    pub source_start: usize,
    /// Source/display mappings.
    pub projection: Projection,
    /// Shaped rich text, including syntax and selection brush roles.
    pub layout: Layout<u32>,
    /// Common baseline relative to the row in physical pixels.
    pub baseline: f32,
    /// Translation from Parley's natural baseline to the common source baseline.
    pub baseline_shift: f32,
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
}

/// Own font discovery and shaping scratch space, rather than recreate per glyph.
pub struct TextShaper {
    /// Primary and fallback fonts, including the embedded source face.
    fonts: FontContext,
    /// Reusable paragraph-building allocations.
    layouts: LayoutContext<u32>,
    /// Immutable source feature policy, shared by every row and baseline probe.
    features: Vec<FontFeature>,
}

/// Constructing a default shaper registers the bundled source font.
impl Default for TextShaper {
    fn default() -> Self {
        return Self::new();
    }
}

/// Shape complete source lines while retaining a reusable font context.
impl TextShaper {
    /// Register the embedded primary face; system fonts supply other scripts.
    pub fn new() -> Self {
        // JetBrains Mono puts programming ligatures and contextual punctuation in calt, not liga.
        return Self::with_features(vec![FontFeature::new(Tag::new(b"calt"), 1)]);
    }

    /// Create a source shaper with explicit OpenType features, without changing source characters.
    /// Settings are immutable for this shaper; replacing it also requires invalidating native frame state.
    pub fn with_features(features: Vec<FontFeature>) -> Self {
        // What: FontContext owns font discovery/cache state; Arc shares static bytes.
        // Why: The source font must remain available without its installed counterpart.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const fonts = new FontContext();
        // fonts.register(embeddedJetBrainsMono);
        // ```
        let mut fonts = FontContext::new();
        let bytes: &'static [u8] = include_bytes!("../asset/font/JetBrainsMono-Regular.ttf");
        let blob = parley::fontique::Blob::new(Arc::new(bytes));
        fonts.collection.register_fonts(blob, None);
        return Self { fonts, layouts: LayoutContext::new(), features };
    }

    /// Shape text with explicit source typography and no soft wrapping.
    fn line_layout(&mut self, text: &str, scale: f32, roles: &[(usize, usize, u32)]) -> Layout<u32> {
        // Borrow the contexts only while constructing this owned layout.
        let mut builder = self.layouts.ranged_builder(&mut self.fonts, text, scale, true);
        builder.push_default(StyleProperty::FontFamily(FontFamily::Source(Cow::Borrowed("JetBrains Mono"))));
        builder.push_default(StyleProperty::FontSize(15.0));
        builder.push_default(StyleProperty::LineHeight(LineHeight::Absolute(24.0)));
        builder.push_default(StyleProperty::Brush(0));
        builder.push_default(StyleProperty::FontFeatures(FontFeatures::List(Cow::Borrowed(&self.features))));
        for (start, end, role) in roles {
            builder.push(StyleProperty::Brush(*role), *start..*end);
        }
        let mut layout = builder.build(text);
        layout.break_all_lines(None);
        return layout;
    }

    /// Prepare a visible viewport using native font advances rather than character cells.
    pub fn prepare(&mut self, document: &Document, viewport: Viewport, styles: &[StyleSpan]) -> ShapedView {
        let text = document.text();
        let position = document.position();
        let selection_start = position.anchor.min(position.head);
        let selection_end = position.anchor.max(position.head);
        let last = viewport.first.saturating_add(viewport.count).min(text.len_lines());
        let probe = self.line_layout("M", viewport.scale, &[]);
        // A known primary glyph establishes a consistent baseline for all source rows.
        let baseline = probe.lines().next().expect("primary font line").metrics().baseline;
        let mut rows = Vec::new();
        for row in viewport.first..last {
            let source_start = text.line_to_char(row);
            let source = text.line(row).to_string();
            let projection = project_line(&source);
            let source_len = projection.source_to_byte.len().saturating_sub(1);
            let mut roles = Vec::new();
            for span in styles {
                let start = span.start.saturating_sub(source_start).min(source_len);
                let end = span.end.saturating_sub(source_start).min(source_len);
                if start < end {
                    roles.push((projection.source_to_byte[start], projection.source_to_byte[end], span.style as u32));
                }
            }
            let start = selection_start.saturating_sub(source_start).min(source_len);
            let end = selection_end.saturating_sub(source_start).min(source_len);
            if start < end {
                // Role 64 is reserved for the selected foreground, applied last.
                roles.push((projection.source_to_byte[start], projection.source_to_byte[end], 64));
            }
            let layout = self.line_layout(&projection.text, viewport.scale, &roles);
            let natural = layout.lines().next().expect("source line layout").metrics().baseline;
            rows.push(ShapedRow { row, source_start, projection, layout, baseline, baseline_shift: baseline - natural });
        }
        let width = (viewport.width.max(1.0) * viewport.scale).ceil() as u32;
        let height = ((last.saturating_sub(viewport.first).max(1) as f32) * 24.0 * viewport.scale).ceil() as u32;
        return ShapedView { rows, viewport, width, height };
    }
}

/// A reading rectangle expressed in logical pixels, relative to the source content.
#[derive(Clone, Copy, Debug)]
pub struct ReadingRect {
    /// Horizontal source coordinate.
    pub x: f32,
    /// Vertical source coordinate.
    pub y: f32,
    /// Horizontal extent.
    pub width: f32,
    /// Vertical extent.
    pub height: f32,
}

impl ShapedView {
    /// Convert a pointer to a source character using the shaping engine's hit test.
    pub fn hit(&self, document: &Document, row: usize, x: f32) -> usize {
        for shaped in &self.rows {
            if shaped.row != row { continue; }
            let cursor = Cursor::from_point(&shaped.layout, x * self.viewport.scale, shaped.layout.height() / 2.0);
            let index = cursor.index().min(shaped.projection.byte_to_source.len() - 1);
            return shaped.source_start + shaped.projection.byte_to_source[index];
        }
        let bounded_row = row.min(document.text().len_lines().saturating_sub(1));
        return document.text().line_to_char(bounded_row);
    }

    /// Return caret x using exactly the same glyph advances as drawing.
    pub fn caret(&self, document: &Document) -> ReadingRect {
        let head = document.position().head;
        let row = document.text().char_to_line(head);
        for shaped in &self.rows {
            if shaped.row != row { continue; }
            let local = head.saturating_sub(shaped.source_start).min(shaped.projection.source_to_byte.len() - 1);
            let cursor = Cursor::from_byte_index(&shaped.layout, shaped.projection.source_to_byte[local], Affinity::Downstream);
            let rect = cursor.geometry(&shaped.layout, self.viewport.scale);
            // Parley's geometry uses f64; Slint logical coordinates use f32.
            return ReadingRect { x: rect.x0 as f32 / self.viewport.scale, y: row as f32 * 24.0 + 2.0, width: 2.0, height: 20.0 };
        }
        return ReadingRect { x: 0.0, y: row as f32 * 24.0 + 2.0, width: 2.0, height: 20.0 };
    }

    /// Return per-line selection rectangles without including annotations in source.
    pub fn selection(&self, document: &Document) -> Vec<ReadingRect> {
        let position = document.position();
        let start = position.anchor.min(position.head);
        let end = position.anchor.max(position.head);
        let mut result = Vec::new();
        for shaped in &self.rows {
            let len = shaped.projection.source_to_byte.len() - 1;
            let a = start.saturating_sub(shaped.source_start).min(len);
            let b = end.saturating_sub(shaped.source_start).min(len);
            if a == b { continue; }
            let anchor = Cursor::from_byte_index(&shaped.layout, shaped.projection.source_to_byte[a], Affinity::Downstream);
            let focus = Cursor::from_byte_index(&shaped.layout, shaped.projection.source_to_byte[b], Affinity::Upstream);
            let selection = Selection::new(anchor, focus);
            for (rect, _) in selection.geometry(&shaped.layout) {
                result.push(ReadingRect {
                    x: rect.x0 as f32 / self.viewport.scale, y: shaped.row as f32 * 24.0,
                    width: (rect.x1 - rect.x0) as f32 / self.viewport.scale, height: 24.0,
                });
            }
        }
        return result;
    }
}
