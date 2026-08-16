//! OKLCH-only runtime pigment derivation for LED page controls.

/// Imports Slint color conversion and generated-global access traits.
use slint::{Color, ComponentHandle};

/// Imports generated application and palette-adapter types.
use crate::{AppWindow, LedPaletteAdapter};

/// Groups source pigment with achromatic endpoint and independent coordinate fractions.
#[derive(Clone, Copy, Debug)]
pub(crate) struct OklchNeutralMix {
    /// Runtime pigment whose hue is retained.
    pub(crate) color: Color,
    /// OKLCH lightness for black (`0`) or white (`1`).
    pub(crate) neutral_lightness: f32,
    /// Proportion of neutral lightness mixed into source pigment.
    pub(crate) lightness_fraction: f32,
    /// Proportion of zero chroma mixed into source pigment.
    pub(crate) chroma_fraction: f32,
}

/// Groups one OKLCH pigment with requested independent alpha coordinate.
#[derive(Clone, Copy, Debug)]
pub(crate) struct OklchAlpha {
    /// Runtime pigment whose OKLCH coordinates remain unchanged.
    pub(crate) color: Color,
    /// Replacement alpha coordinate.
    pub(crate) alpha: f32,
}

/// Mixes one pigment toward an achromatic endpoint in OKLCH coordinates.
///
/// Chroma approaches zero while source hue remains stable. No RGB or HSV
/// coordinate is manipulated.
#[must_use]
pub(crate) fn mix_with_neutral(options: OklchNeutralMix) -> Color {
    let lightness_fraction = options.lightness_fraction.clamp(0.0, 1.0);
    let chroma_fraction = options.chroma_fraction.clamp(0.0, 1.0);
    let source = options.color.to_oklch();
    let lightness =
        source.lightness + (options.neutral_lightness - source.lightness) * lightness_fraction;
    let chroma = source.chroma * (1.0 - chroma_fraction);
    Color::from_oklch(lightness, chroma, source.hue, source.alpha)
}

/// Replaces alpha after converting pigment to OKLCH coordinates.
#[must_use]
pub(crate) fn with_alpha(options: OklchAlpha) -> Color {
    let source = options.color.to_oklch();
    Color::from_oklch(
        source.lightness,
        source.chroma,
        source.hue,
        options.alpha.clamp(0.0, 1.0),
    )
}

/// Wires Slint's pure color callbacks to OKLCH operations.
pub(crate) fn apply(app: &AppWindow) {
    let adapter = app.global::<LedPaletteAdapter>();
    adapter.on_mix_neutral(|color, neutral_lightness, lightness_fraction, chroma_fraction| {
        mix_with_neutral(OklchNeutralMix {
            color,
            neutral_lightness,
            lightness_fraction,
            chroma_fraction,
        })
    });
    adapter.on_set_alpha(|color, alpha| with_alpha(OklchAlpha { color, alpha }));
}

/// Verifies OKLCH pigment derivation independently from rendered scene state.
#[cfg(test)]
#[path = "ui_led_palette_tests.rs"]
mod tests;
