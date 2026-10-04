//! Font feature controls and ligature reading behavior use the production shaping/raster path.

/// Canonical source and production geometry/rendering interfaces.
use ide_app::{document::{Document, ReadingPosition}, shaped_text::{ShapedView, TextShaper, Viewport}, text_raster::{CodeColors, TextRaster}};
/// Typed OpenType settings and actual shaped glyph runs.
use parley::{FontFeature, PositionedLayoutItem, setting::Tag};

/// Source fixture geometry retains fractional display scaling in dedicated cases.
fn viewport() -> Viewport {
    return Viewport { first: 0, count: 1, width: 500.0, scale: 1.0 };
}

/// Compare glyph identities rather than assuming contextual ligatures reduce glyph count.
fn glyphs(view: &ShapedView) -> Vec<u32> {
    let mut result = Vec::new();
    for row in &view.rows {
        for line in row.layout.lines() {
            for item in line.items() {
                if let PositionedLayoutItem::GlyphRun(run) = item {
                    for glyph in run.positioned_glyphs() { result.push(glyph.id); }
                }
            }
        }
    }
    return result;
}

/// The default source policy enables actual programming substitutions while retaining cell advances.
#[test]
fn jetbrains_programming_ligatures_have_a_real_off_control() {
    let document = Document::new("=== != => <= -> :: &&");
    let mut defaults = TextShaper::new();
    let mut disabled = TextShaper::with_features(vec![FontFeature::new(Tag::new(b"calt"), 0)]);
    let mut enabled = TextShaper::with_features(vec![FontFeature::new(Tag::new(b"calt"), 1)]);
    let normal = defaults.prepare(&document, viewport(), &[]);
    let off = disabled.prepare(&document, viewport(), &[]);
    let on = enabled.prepare(&document, viewport(), &[]);
    assert_ne!(glyphs(&normal), glyphs(&off), "the control must change actual glyph substitutions");
    assert_eq!(glyphs(&normal), glyphs(&on));
    assert!((normal.rows[0].layout.width() - off.rows[0].layout.width()).abs() < 0.01);
}

/// Optional glyph choices work when explicitly requested; they are not forced as new defaults.
#[test]
fn slashed_zero_changes_glyphs_not_source_or_advance() {
    let document = Document::new("0O");
    let mut defaults = TextShaper::new();
    let mut alternate = TextShaper::with_features(vec![FontFeature::new(Tag::new(b"zero"), 1)]);
    let normal = defaults.prepare(&document, viewport(), &[]);
    let changed = alternate.prepare(&document, viewport(), &[]);
    assert_ne!(glyphs(&normal), glyphs(&changed));
    assert!((normal.rows[0].layout.width() - changed.rows[0].layout.width()).abs() < 0.01);
    assert_eq!(document.text().to_string(), "0O");
}

/// Each source character inside an operator ligature remains a caret and copy boundary.
#[test]
fn ligature_interior_caret_hit_and_copy_remain_source_based() {
    let mut shaper = TextShaper::new();
    for source in ["===", "!=", "=>", "<=", "->"] {
        let mut document = Document::new(source);
        for position in 0..=source.len() {
            document.select(ReadingPosition { anchor: position, head: position, viewport: 0 });
            let view = shaper.prepare(&document, viewport(), &[]);
            let caret = view.caret(&document);
            assert_eq!(view.hit(&document, 0, caret.x + 0.01), position, "{source} at {position}");
        }
        document.select(ReadingPosition { anchor: 1, head: 2, viewport: 0 });
        assert_eq!(document.selected_text(), &source[1..2]);
    }
}

/// Partial selection recolors only selected pixels without breaking the shaped operator.
#[test]
fn partial_ligature_selection_preserves_geometry_and_clips_ink() {
    let mut document = Document::new("===");
    let mut shaper = TextShaper::new();
    let unselected = shaper.prepare(&document, viewport(), &[]);
    document.select(ReadingPosition { anchor: 1, head: 2, viewport: 0 });
    let selected = shaper.prepare(&document, viewport(), &[]);
    assert_eq!(glyphs(&unselected), glyphs(&selected), "selection must not change ligature shaping");
    let rectangle = selected.selection(&document)[0];
    let colors = CodeColors { foreground: [255,0,0,255], selected: [0,255,0,255], dark: true };
    let pixels = TextRaster::new().paint(&selected, colors, 0.0).expect("selected ligature raster");
    let mut selected_ink = 0;
    let mut ordinary_ink = 0;
    for y in 0..pixels.height {
        for x in 0..pixels.width {
            let start = ((y * pixels.width + x) * 4) as usize;
            if pixels.bytes[start + 3] == 0 { continue; }
            let inside = x as f32 >= rectangle.x && (x as f32) < rectangle.x + rectangle.width;
            if inside {
                selected_ink += 1;
                assert_eq!(pixels.bytes[start], 0, "unselected red ink inside selected ligature at {x},{y}");
            } else {
                ordinary_ink += 1;
                assert_eq!(pixels.bytes[start + 1], 0, "selected green ink outside selection at {x},{y}");
            }
        }
    }
    assert!(selected_ink > 0 && ordinary_ink > 0, "both halves must contain real glyph pixels");
}
