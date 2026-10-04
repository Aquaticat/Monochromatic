//! Warm glyph caches must match a fresh renderer across every paint input change.

/// Consumer APIs retain canonical source alongside the shared glyph geometry.
use ide_app::{
    document::{Document, ReadingPosition},
    shaped_text::{TextShaper, Viewport},
    source_style::StyleSpan,
    text_raster::{CodeColors, TextRaster},
};

/// Reuse one cache through font fallback, scale, origin, style, selection, and theme changes.
#[test]
fn cached_pixels_match_fresh_pixels_after_input_changes() {
    // What: mut allows cache updates through these owned engines.
    // Why: Each case must reuse the previous case's glyphs to expose stale-image bugs.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const shaper = new TextShaper(); const cached = new TextRaster();
    // ```
    let mut shaper = TextShaper::new();
    let mut cached = TextRaster::new();
    let texts = [
        "猫 and Latin\ntabs\there e\u{301}",
        "A different row\n猫 then 犬",
        "🙂 color and spaces  ",
    ];
    // What: 0..12 is a bounded half-open iteration range.
    // Why: Repeated scripts at changing scales and origins exercise cache identity.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (let case = 0; case < 12; case++) { /* compare */ }
    // ```
    for case in 0..12 {
        let mut document = Document::new(texts[case % texts.len()]);
        document.select(ReadingPosition {
            anchor: 0,
            head: case % 6,
            viewport: 0,
        });
        let viewport = Viewport {
            first: 0,
            count: 3,
            width: 300.0,
            scale: [1.0, 1.25, 2.0][case % 3],
        };
        let horizontal = [0.0, 0.25, 5.75, 0.0][case % 4];
        let colors = CodeColors {
            foreground: [31, 70, 110, 200],
            selected: [240, 210, 255, 255],
            dark: case % 2 == 0,
        };
        let styles = [StyleSpan {
            start: 0,
            end: document.text().len_chars(),
            style: case % 4 + 1,
        }];
        // What: & lends source and style slices without moving their ownership.
        // Why: Both renderers must consume exactly the same layout.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const view = shaper.prepare(document, viewport, styles);
        // ```
        let view = shaper.prepare(&document, viewport, &styles);
        // What: expect extracts a successful raster or fails with a test diagnostic.
        // Why: A rendering failure is not a valid empty comparison image.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const actual = cached.paint(view, colors, horizontal);
        // const expected = new TextRaster().paint(view, colors, horizontal);
        // ```
        let actual = cached
            .paint(&view, colors, horizontal)
            .expect("cached source raster");
        let expected = TextRaster::new()
            .paint(&view, colors, horizontal)
            .expect("fresh source raster");
        // assert_eq! compares every premultiplied pixel, including fallback glyph baselines.
        assert_eq!(actual.bytes, expected.bytes, "raster case {case}");
    }
}

/// Positive controls prove that the image comparison sees theme and origin changes.
#[test]
fn comparison_detects_changed_ink_and_fractional_origin() {
    let document = Document::new("Latin 猫");
    let mut shaper = TextShaper::new();
    let viewport = Viewport {
        first: 0,
        count: 1,
        width: 200.0,
        scale: 1.0,
    };
    let view = shaper.prepare(&document, viewport, &[]);
    let mut raster = TextRaster::new();
    let dark = CodeColors {
        foreground: [240, 240, 240, 255],
        selected: [255, 255, 255, 255],
        dark: true,
    };
    let light = CodeColors {
        foreground: [0, 0, 0, 255],
        selected: [255, 255, 255, 255],
        dark: false,
    };
    let original = raster.paint(&view, dark, 0.0).expect("original pixels");
    let recolored = raster.paint(&view, light, 0.0).expect("changed ink");
    let shifted = raster.paint(&view, dark, 0.25).expect("fractional origin");
    assert_ne!(original.bytes, recolored.bytes);
    assert_ne!(original.bytes, shifted.bytes);
}
