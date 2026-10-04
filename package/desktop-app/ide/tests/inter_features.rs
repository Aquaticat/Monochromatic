//! Audit the embedded Inter faces through the same Parley/fontique stack used by Slint.

/// Slint's shared-parley shaping path uses these same family, size, and weight properties.
use parley::{
    FontContext, FontFamily, FontFeature, FontFeatures, FontWeight, Layout, LayoutContext,
    PositionedLayoutItem, StyleProperty, setting::Tag,
};
/// Owned font bytes are shared with the font collection; borrowed family text needs no allocation.
use std::{borrow::Cow, sync::Arc};

/// Unmodified bundled faces, not fonts discovered from the host desktop.
const REGULAR: &[u8] = include_bytes!("../asset/font/Inter-Regular.ttf");
/// Actual 600-weight font avoids testing a synthesized bold face.
const SEMIBOLD: &[u8] = include_bytes!("../asset/font/Inter-SemiBold.ttf");

/// Shape one UI label with explicit features and the registered real Inter faces.
fn label(text: &str, weight: f32, features: &[FontFeature]) -> Layout<u32> {
    let mut fonts = FontContext::new();
    for bytes in [REGULAR, SEMIBOLD] {
        let blob = parley::fontique::Blob::new(Arc::new(bytes));
        fonts.collection.register_fonts(blob, None);
    }
    let mut layouts = LayoutContext::new();
    // Slint's shared-parley UI path requests fractional layout rather than quantized metrics.
    let mut builder = layouts.ranged_builder(&mut fonts, text, 1.0, false);
    builder.push_default(StyleProperty::FontFamily(FontFamily::Source(
        Cow::Borrowed("Inter"),
    )));
    builder.push_default(StyleProperty::FontSize(15.0));
    builder.push_default(StyleProperty::FontWeight(FontWeight::new(weight)));
    builder.push_default(StyleProperty::FontFeatures(FontFeatures::List(
        Cow::Borrowed(features),
    )));
    let mut layout = builder.build(text);
    layout.break_all_lines(None);
    return layout;
}

/// Inspect substitutions without assuming that a ligature reduces the number of glyphs.
fn glyph_ids(layout: &Layout<u32>) -> Vec<u32> {
    let mut ids = Vec::new();
    for line in layout.lines() {
        for item in line.items() {
            if let PositionedLayoutItem::GlyphRun(run) = item {
                for glyph in run.positioned_glyphs() {
                    ids.push(glyph.id);
                }
            }
        }
    }
    return ids;
}

/// Contextual alternates retain Inter's upstream default; optional discretionary ligatures stay opt-in.
#[test]
fn inter_contextual_and_discretionary_features_keep_distinct_defaults() {
    let contextual = "3x9 12:34 3–8 +8+x -> --> => <->";
    let defaults = label(contextual, 400.0, &[]);
    let enabled = label(contextual, 400.0, &[FontFeature::new(Tag::new(b"calt"), 1)]);
    let disabled = label(contextual, 400.0, &[FontFeature::new(Tag::new(b"calt"), 0)]);
    assert_eq!(glyph_ids(&defaults), glyph_ids(&enabled));
    assert_ne!(glyph_ids(&defaults), glyph_ids(&disabled));
    let discretionary = "Difficult affine fjord interface";
    let normal = label(discretionary, 400.0, &[]);
    let off = label(
        discretionary,
        400.0,
        &[FontFeature::new(Tag::new(b"dlig"), 0)],
    );
    let on = label(
        discretionary,
        400.0,
        &[FontFeature::new(Tag::new(b"dlig"), 1)],
    );
    assert_eq!(glyph_ids(&normal), glyph_ids(&off));
    assert_ne!(glyph_ids(&normal), glyph_ids(&on));
}

/// Kerning uses a real off control, rather than inferring shaping from a font-family label.
#[test]
fn inter_default_kerning_changes_real_advances() {
    let normal = label("AVATAR To WA", 400.0, &[]);
    let off = label(
        "AVATAR To WA",
        400.0,
        &[FontFeature::new(Tag::new(b"kern"), 0)],
    );
    assert!(
        (normal.width() - off.width()).abs() > 0.1,
        "kerning off must move the control"
    );
    eprintln!(
        "Inter kerning: default={} off={}",
        normal.width(),
        off.width()
    );
}

/// Requests for the UI's current weights resolve to the exact bundled bytes.
#[test]
fn inter_weights_choose_real_bundled_faces() {
    for (weight, expected) in [(400.0, REGULAR), (600.0, SEMIBOLD)] {
        let shaped = label("Inter", weight, &[]);
        let mut runs = 0;
        for line in shaped.lines() {
            for item in line.items() {
                if let PositionedLayoutItem::GlyphRun(run) = item {
                    assert!(
                        run.run().font().data.as_ref() == expected,
                        "weight {weight} did not choose its bundled face"
                    );
                    runs += 1;
                }
            }
        }
        assert!(runs > 0);
    }
}

/// Tabular figures work as an explicit feature, while proportional figures remain distinguishable.
#[test]
fn inter_tabular_numbers_have_a_proportional_control() {
    let tabular = [FontFeature::new(Tag::new(b"tnum"), 1)];
    let proportional = [FontFeature::new(Tag::new(b"pnum"), 1)];
    let ones = label("1111", 400.0, &tabular);
    let eights = label("8888", 400.0, &tabular);
    assert!((ones.width() - eights.width()).abs() < 0.01);
    let narrow = label("1111", 400.0, &proportional);
    let wide = label("8888", 400.0, &proportional);
    assert!((narrow.width() - wide.width()).abs() > 0.1);
}
