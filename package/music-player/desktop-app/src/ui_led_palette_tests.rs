//! Focused tests for desktop OKLCH LED pigment derivation.

use slint::Color;

use crate::ui_led_palette::{mix_with_neutral, with_alpha, OklchAlpha, OklchNeutralMix};

/// Stores WCAG relative-luminance contrast offset.
const CONTRAST_OFFSET: f32 = 0.05;

/// Stores normal-text contrast floor.
const MINIMUM_TEXT_CONTRAST: f32 = 4.5;

/// Stores lightness and chroma tolerance for round-tripping through display sRGB.
const COORDINATE_TOLERANCE: f32 = 0.002;

/// Stores measured hue tolerance after Slint quantizes display output to eight-bit sRGB.
const HUE_TOLERANCE_DEGREES: f32 = 1.0;

/// Converts one sRGB channel to linear-light form for contrast measurement.
fn linear_srgb(channel: u8) -> f32 {
    let encoded = f32::from(channel) / 255.0;
    if encoded <= 0.04045 {
        return encoded / 12.92;
    }
    ((encoded + 0.055) / 1.055).powf(2.4)
}

/// Returns WCAG relative luminance for a rendered sRGB color.
fn relative_luminance(color: Color) -> f32 {
    0.2126 * linear_srgb(color.red())
        + 0.7152 * linear_srgb(color.green())
        + 0.0722 * linear_srgb(color.blue())
}

/// Confirms brightest possible accent remains readable behind white legend ink.
#[test]
fn bright_accent_produces_contrasting_selected_fill() {
    let selected_fill = mix_with_neutral(OklchNeutralMix {
        color: Color::from_rgb_u8(255, 255, 255),
        neutral_lightness: 0.0,
        fraction: 0.6,
    });
    let contrast_ratio = (1.0 + CONTRAST_OFFSET) /
        (relative_luminance(selected_fill) + CONTRAST_OFFSET);
    assert!(contrast_ratio >= MINIMUM_TEXT_CONTRAST);
}

/// Confirms neutral mixing retains source hue while changing OKLCH lightness and chroma.
#[test]
fn black_mix_retains_runtime_accent_hue() {
    let source = Color::from_rgb_u8(103, 80, 164);
    let source_oklch = source.to_oklch();
    let mixed = mix_with_neutral(OklchNeutralMix {
        color: source,
        neutral_lightness: 0.0,
        fraction: 0.5,
    });
    let mixed_oklch = mixed.to_oklch();
    assert!(
        (mixed_oklch.hue - source_oklch.hue).abs() <= HUE_TOLERANCE_DEGREES,
        "source={source_oklch:?}, mixed={mixed_oklch:?}"
    );
    assert!((mixed_oklch.lightness - source_oklch.lightness * 0.5).abs() <= COORDINATE_TOLERANCE);
    assert!((mixed_oklch.chroma - source_oklch.chroma * 0.5).abs() <= COORDINATE_TOLERANCE);
}

/// Confirms alpha replacement preserves all OKLCH pigment coordinates.
#[test]
fn alpha_replacement_preserves_oklch_pigment() {
    let source = Color::from_rgb_u8(103, 80, 164);
    let source_oklch = source.to_oklch();
    let adjusted = with_alpha(OklchAlpha { color: source, alpha: 0.4 });
    let adjusted_oklch = adjusted.to_oklch();
    assert!((adjusted_oklch.lightness - source_oklch.lightness).abs() <= COORDINATE_TOLERANCE);
    assert!((adjusted_oklch.chroma - source_oklch.chroma).abs() <= COORDINATE_TOLERANCE);
    assert!((adjusted_oklch.hue - source_oklch.hue).abs() <= COORDINATE_TOLERANCE);
    assert!((adjusted_oklch.alpha - 0.4).abs() <= COORDINATE_TOLERANCE);
}

/// Confirms out-of-range fractions clamp to requested achromatic endpoints.
#[test]
fn fractions_clamp_to_neutral_endpoints() {
    let source = Color::from_rgb_u8(103, 80, 164);
    let black = mix_with_neutral(OklchNeutralMix {
        color: source,
        neutral_lightness: 0.0,
        fraction: 2.0,
    });
    let white = mix_with_neutral(OklchNeutralMix {
        color: source,
        neutral_lightness: 1.0,
        fraction: 2.0,
    });
    assert_eq!(black, Color::from_rgb_u8(0, 0, 0));
    assert_eq!(white, Color::from_rgb_u8(255, 255, 255));
}
