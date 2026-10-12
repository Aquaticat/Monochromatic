//! Shared shaped rows replace independently centered fallback-font glyph items.

/// Positioned hints and diagnostic marks travel with the frame they were laid out against.
use crate::annotation_layout::AnnotationFrame;
/// Canonical source remains in the read-only document.
use crate::document::Document;
/// Variable roman and real italic blobs retain stable cache identities;
///  the interface face sets virtual rows.
use crate::font_asset::{code_faces, row_face};
/// The one vertical mapping:
///  where each line's code row starts and how tall rows and the caret are.
use crate::row_map::{CODE_ROW, RowMap};
/// What:
///  `pub use` re-exports the row types under this module's name.
/// Why:
///  Callers written against `shaped_text` keep their imports while row geometry lives in its own file.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export { ReadingRect, ShapedRow } from './shaped-row';
/// ```
pub use crate::shaped_row::{ReadingRect, ShapedRow, VisualCaret};
/// Shaped rows kept by line for one text revision and scale.
use crate::shaped_row_cache::RowCache;
/// Syntax classifications stay independent of pixels.
use crate::source_style::StyleSpan;
/// Immutable font requests validate continuous weights before shaping.
use crate::source_typography::SourceTypography;
/// Tabs end on pixel tab stops,
///  whatever script precedes them.
use crate::tab_layout::{layout_with_tabs, layout_wrapped_with_tabs};
/// Source/display byte maps keep tabs and Unicode out of hit-test heuristics.
use crate::text_projection::project_line;
/// Height and text size of the virtual rows above annotated lines.
use crate::virtual_row::{ROW_HEIGHT, ROW_TEXT};
/// IntelliJ's break rules as a Parley override, and the continuation indent of a wrapped line.
use crate::wrap::{INTELLIJ_LINE_BREAK, break_wrapped, has_wrap_width};
/// Construction failures identify unsupported source typography.
use anyhow::Result;
/// Font and paragraph layout are supplied by the same Parley stack Slint uses.
use parley::{
    Affinity, Cursor, FontContext, FontFamily, FontFeature, FontFeatures, FontStyle, FontWeight,
    Layout, LayoutContext, LineHeight, OverflowWrap, StyleProperty,
};
/// Font bytes are shared immutably across the font database.
use std::borrow::Cow;

/// Reading geometry of a prepared frame:
///  hits,
///  caret,
///  selection and range rectangles,
///  and rebasing.
mod view;

/// Whole-file passes: bringing rows into the cache for a wrap width,
///  and breaking kept rows again at a new width.
mod pass;
pub use pass::{Ensured, Measured};

/// What:
///  `pub const` exports a compile-time value;
///  `f32` is a 32-bit float of logical pixels (sibling `f64`).
/// Why:
///  A selected line terminator has no glyph;
///  a mark about one space wide shows that it is selected.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const TERMINATOR_MARK = 9;
/// ```
pub const TERMINATOR_MARK: f32 = 9.0;

/// What:
///  Paint role of virtual-row glyphs,
///  a number outside the syntax roles;
///  `u32` is the brush type of layouts.
/// Why:
///  The raster paints hints and messages with one given ink each,
///  never with a syntax or selection color.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const ROW_ROLE = 65;
/// ```
pub const ROW_ROLE: u32 = 65;

/// Family name of the bundled interface face,
///  as its name table spells it.
const ROW_FAMILY: &str = "Inter Variable";

/// What:
///  The inputs that shape one source line:
///  display text, scale, syntax roles, tab spacings, and an optional wrap width.
/// Why:
///  Plain and wrapped layouts share one builder,
///  and the wrap width is the only difference between them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type LineRequest = { text: string; scale: number; roles: Role[]; spacings: Spacing[]; wrap?: number };
/// ```
#[derive(Clone, Copy)]
pub(crate) struct LineRequest<'a> {
    /// Display text, with each tab stood in by one space.
    pub(crate) text: &'a str,
    /// Physical pixels per logical pixel.
    pub(crate) scale: f32,
    /// Syntax role runs as display byte start, end, and brush.
    pub(crate) roles: &'a [(usize, usize, u32)],
    /// Extra advance per display byte in logical pixels.
    pub(crate) spacings: &'a [(usize, f32)],
    /// Wrap width in logical pixels, or nothing for an unbroken line.
    pub(crate) wrap: Option<f32>,
}

/// What:
///  The part of a tile's lines that its raster holds,
///  as two distances in logical pixels from the top of the first materialized line's block.
/// Why:
///  A tile holds whole lines, and one line wrapped to thousands of rows would pass the raster limit.
///  The clip keeps the rows near the view; rows outside it are not painted,
///  and the gutter and the other row lists leave them out.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Clip = { top: number; bottom: number };
/// ```
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Clip {
    /// Where the raster starts, below the top of the first line's block.
    pub top: f32,
    /// Where the raster ends, below the top of the first line's block.
    pub bottom: f32,
}

/// Logical dimensions and scale of the source viewport.
#[derive(Clone, Copy, PartialEq)]
pub struct Viewport {
    /// First logical line materialized,
    ///  including overscan.
    pub first: usize,
    /// Maximum number of source lines materialized.
    pub count: usize,
    /// Width of the raster in logical pixels.
    pub width: f32,
    /// Physical pixels per logical pixel.
    pub scale: f32,
    /// Wrap width in logical pixels that every line is broken at,
    ///  or nothing to leave lines unbroken.
    pub wrap: Option<f32>,
    /// The part of the materialized lines the raster holds,
    ///  or nothing for all of them.
    pub clip: Option<Clip>,
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
    /// Top of the raster in logical pixels from the top of the text:
    ///  the top of the first materialized
    /// line's block, or the clip's top below it.
    pub origin: f32,
    /// The vertical mapping this frame was shaped against;
    ///  rows outside the frame are placed by it.
    pub map: RowMap,
    /// Shared logical selection rectangles drive both native backgrounds and glyph clipping.
    pub selections: Vec<ReadingRect>,
    /// In-file find rectangles from the same row geometry;
    ///  filled by the native renderer.
    pub matches: Vec<ReadingRect>,
    /// What:
    ///  `Option<AnnotationFrame>` is the frame's positioned hints and diagnostic marks,
    ///  or nothing.
    /// Why:
    ///  The renderer fills it after shaping;
    ///  rows are never changed by it,
    ///  so reading geometry ignores it.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// annotations?: AnnotationFrame;
    /// ```
    pub annotations: Option<AnnotationFrame>,
}

/// Own font discovery and shaping scratch space,
///  rather than recreate per glyph.
pub struct TextShaper {
    /// Primary and fallback fonts,
    ///  including the embedded source face.
    fonts: FontContext,
    /// Reusable paragraph-building allocations.
    layouts: LayoutContext<u32>,
    /// Immutable variable-weight,
    ///  italic,
    ///  and feature policy shared by rows and baseline probes.
    typography: SourceTypography,
    /// Measured space advance for one scale;
    ///  typography is immutable,
    ///  so only the scale can change it.
    space: Option<(f32, f32)>,
    /// Shaped rows by line for the last synced text revision and scale;
    ///  `prepare_rows` reads and fills it.
    rows: RowCache,
    /// Source rows shaped by this shaper, never reset.
    shaped_rows: u64,
    /// Kept rows broken again at a new wrap width instead of being shaped again, never reset.
    rebroken_rows: u64,
    /// Corrective shaping passes of tab-bearing wrapped lines since this shaper was made.
    tab_passes: u64,
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
    /// Register the embedded primary face;
    ///  system fonts supply other scripts.
    pub fn new() -> Self {
        return Self::with_typography(SourceTypography::default())
            .expect("valid default source typography");
    }

    /// Create a source shaper with explicit OpenType features,
    ///  without changing source characters.
    /// Settings are immutable for this shaper;
    ///  replacing it also requires invalidating native frame state.
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
            rows: RowCache::default(),
            shaped_rows: 0,
            rebroken_rows: 0,
            tab_passes: 0,
        });
    }

    /// Shape text with explicit source typography and no soft wrapping.
    /// `spacings` pairs a display byte with extra advance in logical pixels;
    ///  tabs use it to reach their stop.
    pub(crate) fn line_layout(
        &mut self,
        text: &str,
        scale: f32,
        roles: &[(usize, usize, u32)],
        spacings: &[(usize, f32)],
    ) -> Layout<u32> {
        let request = LineRequest {
            text,
            scale,
            roles,
            spacings,
            wrap: None,
        };
        return self.build_line(request);
    }

    /// What:
    ///  Shape text broken at a logical wrap width with IntelliJ's break rules,
    ///  and a hanging continuation indent.
    /// Why:
    ///  Parley breaks by its own rules unless the override says otherwise,
    ///  and a continuation row starts after the indent,
    ///  so the indent is set on the layout before it is broken.
    ///  A width that is not positive gives the unbroken layout,
    ///  because the caller keeps its last positive width instead (`wrap::has_wrap_width`).
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// wrappedLayout(text: string, scale: number, width: number): Layout;
    /// ```
    pub(crate) fn wrapped_line_layout(&mut self, request: LineRequest<'_>) -> Layout<u32> {
        let width = request.wrap.unwrap_or(0.0);
        if !has_wrap_width(width) {
            let unwrapped = LineRequest {
                wrap: None,
                ..request
            };
            return self.build_line(unwrapped);
        }
        // The advance is physical; the indent that is built from it is in logical pixels and is scaled once more
        // where the layout takes it, so a physical advance would double the indent at scale 2.
        let space = self.space_advance(request.scale) / request.scale;
        let mut layout = self.build_line(request);
        break_wrapped(&mut layout, request.text, request.scale, width, space);
        return layout;
    }

    /// Build and break one line with the shared font setup;
    ///  a request that wraps is left unbroken for `break_wrapped`.
    fn build_line(&mut self, request: LineRequest<'_>) -> Layout<u32> {
        let mut builder =
            self.layouts
                .ranged_builder(&mut self.fonts, request.text, request.scale, true);
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
        if request.wrap.is_some() {
            // What: `OverflowWrap::Anywhere` lets a token wider than the width break inside it.
            // Why: IntelliJ breaks a token without an opportunity at the code point where the width is exceeded.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // style.overflowWrap = 'anywhere';
            // ```
            builder.push_default(StyleProperty::OverflowWrap(OverflowWrap::Anywhere));
            builder.set_line_break_override(Some(INTELLIJ_LINE_BREAK));
        }
        for (start, end, role) in request.roles {
            builder.push(StyleProperty::Brush(*role), *start..*end);
        }
        // The stand-in space of a tab is one byte; spacing on it changes that one advance only.
        for (byte, extra) in request.spacings {
            builder.push(StyleProperty::LetterSpacing(*extra), *byte..*byte + 1);
        }
        let mut layout = builder.build(request.text);
        if request.wrap.is_none() {
            layout.break_all_lines(None);
        }
        return layout;
    }

    /// What:
    ///  Shape the text of one virtual row,
    ///  an inlay hint or one row of a diagnostic message:
    ///  the
    ///       interface face at [`ROW_TEXT`] on a line box of [`ROW_HEIGHT`],
    ///  regular weight,
    ///  upright.
    ///       `&str` lends the text;
    ///  the answer is an owned layout.
    /// Why:
    ///  The reference editor sets these rows in its interface face,
    ///  which tells them from source text at
    ///      a glance.
    ///  The text is never part of a source line,
    ///  and the raster paints it in one given ink.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// rowLayout(text: string, scale: number): Layout;
    /// ```
    pub fn row_layout(&mut self, text: &str, scale: f32) -> Layout<u32> {
        return self.build_row(text, scale, None);
    }

    /// What:
    ///  Break the text of one virtual row into pieces that each fit `width` logical pixels,
    ///  in the face and size [`Self::row_layout`] sets it;
    ///  a token wider than the width breaks inside it.
    ///  The answer is the pieces in reading order, trailing blanks dropped;
    ///  an empty text has none.
    /// Why:
    ///  Hint labels and message rows wrap to the width of the code they stand over,
    ///  and a block's height is the number of pieces,
    ///  so the break comes from the same shaping that paints each piece.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// wrapRowText(text: string, scale: number, width: number): string[];
    /// ```
    pub fn wrap_row_text(&mut self, text: &str, scale: f32, width: f32) -> Vec<String> {
        let layout = self.build_row(text, scale, Some(width));
        let mut pieces = Vec::new();
        for line in layout.lines() {
            let range = line.text_range();
            let piece = text[range.start..range.end.min(text.len())].trim_end();
            if !piece.is_empty() {
                pieces.push(piece.to_string());
            }
        }
        tracing::trace!(width, pieces = pieces.len(), "wrapped virtual row text");
        return pieces;
    }

    /// Shape virtual-row text in the interface face, broken at `wrap` logical pixels or not at all.
    fn build_row(&mut self, text: &str, scale: f32, wrap: Option<f32>) -> Layout<u32> {
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
        if wrap.is_some() {
            // A token wider than the width has to break inside it, as it does in the source text.
            builder.push_default(StyleProperty::OverflowWrap(OverflowWrap::Anywhere));
        }
        let mut layout = builder.build(text);
        layout.break_all_lines(wrap.map(|width| return width * scale));
        return layout;
    }

    /// Physical advance of one space in the source font at `scale`,
    ///  measured once per scale.
    /// Tab stops are multiples of this advance,
    ///  so it comes from the font,
    ///  not from an assumed cell width.
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

    /// Baseline of the primary font at `scale`;
    ///  a known primary glyph makes it the same for all source rows.
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
    /// `place` pairs the line with the top of its code row in logical pixels;
    ///  `wrap` is the wrap width in logical pixels, or nothing for an unbroken line.
    fn shape_row(
        &mut self,
        document: &Document,
        place: (usize, f32),
        scale: f32,
        styles: &[StyleSpan],
        baseline: f32,
        wrap: Option<f32>,
    ) -> ShapedRow {
        let (row, top) = place;
        let text = document.text();
        let source_start = text.line_to_char(row);
        let source = text.line(row).to_string();
        let projection = project_line(&source);
        let source_len = projection.source_to_byte.len().saturating_sub(1);
        let mut roles = Vec::new();
        // What: Spans ascend and do not overlap, so a binary search finds the first one that reaches this line.
        // Why: A pass over a whole file shapes every line; scanning every span for each would be quadratic.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const relevant = styles.slice(lowerBound(styles, (span) => span.end > sourceStart));
        // ```
        let source_end = source_start + text.line(row).len_chars();
        let reaching = styles.partition_point(|span| return span.end <= source_start);
        for span in styles[reaching..]
            .iter()
            .take_while(|span| return span.start < source_end)
        {
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
        let layout = match wrap {
            Some(width) => layout_wrapped_with_tabs(self, &projection, scale, width, &roles),
            None => layout_with_tabs(self, &projection, scale, &roles),
        };
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
            wrap,
        };
    }

    /// Shape one arbitrary source line for reading geometry,
    ///  without syntax colors.
    /// Caret movement uses it for lines outside the materialized viewport;
    ///  `row` is clamped to the last line.
    /// The row has no vertical position:
    ///  its `top` is zero,
    ///  and only its horizontal geometry is meaningful.
    pub fn row(&mut self, document: &Document, row: usize, scale: f32) -> ShapedRow {
        let last = document.text().len_lines().saturating_sub(1);
        let baseline = self.baseline(scale);
        return self.shape_row(document, (row.min(last), 0.0), scale, &[], baseline, None);
    }

    /// What:
    ///  Shape one arbitrary source line broken at a wrap width,
    ///  as the source view would show it when wrapping is on.
    /// Why:
    ///  A line with several visual rows needs its row geometry, and this is the only path that makes one.
    ///  A width that is not positive shapes the unbroken line.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// wrappedRow(document: Document, row: number, scale: number, width: number): ShapedRow;
    /// ```
    pub fn wrapped_row(
        &mut self,
        document: &Document,
        row: usize,
        scale: f32,
        width: f32,
    ) -> ShapedRow {
        let last = document.text().len_lines().saturating_sub(1);
        let baseline = self.baseline(scale);
        return self.shape_row(
            document,
            (row.min(last), 0.0),
            scale,
            &[],
            baseline,
            Some(width),
        );
    }

    /// Prepare a visible viewport of a text without virtual rows:
    ///  line `n` starts at `n` code rows.
    pub fn prepare(
        &mut self,
        document: &Document,
        viewport: Viewport,
        styles: &[StyleSpan],
    ) -> ShapedView {
        let map = RowMap::plain(document.text().len_lines());
        return self.prepare_view(document, viewport, styles, &map, false);
    }

    /// What:
    ///  Prepare a visible viewport using native font advances rather than character cells,
    ///  with every
    ///       row placed by `map`.
    ///  `&RowMap` lends the vertical mapping;
    ///  the view keeps its own copy.
    /// Why:
    ///  Lines with virtual rows above them start lower than their line number alone says;
    ///  the frame,
    ///      its selection rectangles,
    ///  and its raster all take row positions from this one mapping.
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
        return self.prepare_view(document, viewport, styles, map, true);
    }

    /// Source rows shaped since this shaper was made:
    ///  a row taken from the cache is not counted.
    /// The structural tests compare it before and after a scroll to prove that no row was shaped.
    pub fn shaped_rows(&self) -> u64 {
        return self.shaped_rows;
    }

    /// Corrective passes the tab correction of wrapped lines has shaped since this shaper was made;
    ///  the structural tests compare it with the bound a line's length allows.
    pub fn tab_passes(&self) -> u64 {
        return self.tab_passes;
    }

    /// Typography this shaper was built with, so a second shaper can produce the same glyphs.
    pub fn typography(&self) -> &SourceTypography {
        return &self.typography;
    }

    /// A shaper with this one's fonts and typography and its own layout context and empty caches.
    /// What: `FontContext::clone` copies the scanned font registry instead of discovering system fonts again.
    /// Why: A second font discovery takes as long as the first, and a worker would otherwise pay it on its first tile.
    pub fn fork(&self) -> Self {
        return Self {
            fonts: self.fonts.clone(),
            layouts: LayoutContext::new(),
            typography: self.typography.clone(),
            space: None,
            rows: RowCache::default(),
            shaped_rows: 0,
            rebroken_rows: 0,
            tab_passes: 0,
        };
    }

    /// Forget the cached rows, after a change the cache key does not describe, such as new syntax styles.
    pub fn forget_rows(&mut self) {
        self.rows.clear();
    }

    /// What:
    ///  Prepare the viewport rows,
    ///  taking a row from the cache when `cached` allows it and the row was shaped for this text revision and scale.
    /// Why:
    ///  A re-centered tile shares most of its lines with the previous one,
    ///  and shaping is the expensive part of preparing a tile.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function prepareView(document: Document, viewport: Viewport, styles: StyleSpan[], map: RowMap, cached: boolean): ShapedView;
    /// ```
    fn prepare_view(
        &mut self,
        document: &Document,
        viewport: Viewport,
        styles: &[StyleSpan],
        map: &RowMap,
        cached: bool,
    ) -> ShapedView {
        let text = document.text();
        let last = viewport
            .first
            .saturating_add(viewport.count)
            .min(text.len_lines());
        let baseline = self.baseline(viewport.scale);
        if cached {
            self.rows.sync(document.revision(), viewport.scale);
        }
        let mut shaped_rows = Vec::new();
        for row in viewport.first..last {
            // What: A cached row is copied; a miss is shaped, or a kept row of another wrap width broken again, and kept.
            // Why: Shaping ignores the vertical position, so the same row serves every map.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const shaped = cache.get(row) ?? shapeAndKeep(row);
            // ```
            let request = RowRequest {
                row,
                scale: viewport.scale,
                wrap: viewport.wrap,
                baseline,
            };
            if cached {
                self.ensure_row(document, styles, request);
            }
            let hit = if cached {
                self.rows.get(row, viewport.wrap).cloned()
            } else {
                None
            };
            let shaped = match hit {
                Some(shaped) => shaped,
                None => {
                    self.shaped_rows += 1;
                    self.shape_row(
                        document,
                        (row, 0.0),
                        viewport.scale,
                        styles,
                        baseline,
                        viewport.wrap,
                    )
                }
            };
            shaped_rows.push(shaped);
        }
        if cached {
            self.rows.trim(viewport.first + viewport.count / 2);
        }
        // What: When lines wrap, the rows these lines really have replace the map's counts for them.
        // Why: The map may still count an unmeasured line as one row; the frame must place its rows by what it shaped.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const placed = wrap ? map.withMeasured(rows.map((r) => [r.row, r.visualRows])) : map;
        // ```
        let placed = if viewport.wrap.is_some() {
            let measured: Vec<(usize, usize)> = shaped_rows
                .iter()
                .map(|shaped| return (shaped.row, shaped.visual_rows()))
                .collect();
            map.with_measured(&measured)
        } else {
            map.clone()
        };
        let mut rows = Vec::new();
        for shaped in shaped_rows {
            let top = placed.code_top(shaped.row);
            rows.push(ShapedRow { top, ..shaped });
        }
        let width = (viewport.width.max(1.0) * viewport.scale).ceil() as u32;
        // The raster spans every materialized line with its block, or the clip of them; an empty frame is still one
        // row tall.
        let first_top = placed.block_top(viewport.first);
        let (origin, extent) = match viewport.clip {
            Some(clip) => (first_top + clip.top, clip.bottom - clip.top),
            None => (first_top, placed.block_top(last) - first_top),
        };
        let extent = extent.max(CODE_ROW);
        let height = (extent * viewport.scale).ceil() as u32;
        let mut view = ShapedView {
            rows,
            viewport,
            width,
            height,
            origin,
            // The frame keeps the mapping it placed its rows by, so it stays consistent while the window's own moves on.
            map: placed,
            selections: Vec::new(),
            matches: Vec::new(),
            annotations: None,
        };
        view.selections = view.selection(document);
        return view;
    }
}

/// What:
///  Which line to bring into the row cache,
///  at what scale and wrap width,
///  against which common baseline.
/// Why:
///  Ensuring a row and shaping one take the same four inputs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type RowRequest = { row: number; scale: number; wrap?: number; baseline: number };
/// ```
#[derive(Clone, Copy)]
struct RowRequest {
    /// Line to bring in.
    row: usize,
    /// Physical pixels per logical pixel.
    scale: f32,
    /// Wrap width in logical pixels.
    wrap: Option<f32>,
    /// Common baseline of every row in physical pixels.
    baseline: f32,
}
