// What:     `package dev.monochromatic.musicplayer` keeps the one surviving LED color derivation beside the player UI.
// Why:      `OklchColorTest` still verifies `ledSelectedFill`; the LED page-control renderer around it was deleted.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies the module namespace.
// ```
package dev.monochromatic.musicplayer

import androidx.compose.ui.graphics.Color

/** Stores OKLCH black-lightness mix that keeps selected fill readable behind white ink. */
private const val LED_ACCENT_BODY_LIGHTNESS_BLACK_MIX: Float = 0.50f

/** Stores smaller black-chroma mix that makes selected fill more vibrant. */
private const val LED_ACCENT_BODY_CHROMA_BLACK_MIX: Float = 0.10f

/** Returns deep accent-derived fill that preserves contrast with white legend ink. */
internal fun ledSelectedFill(accent: Color): Color = mixOklchWithNeutral(
    OklchNeutralMix(
        color = accent,
        neutralLightness = OKLCH_BLACK_LIGHTNESS,
        lightnessFraction = LED_ACCENT_BODY_LIGHTNESS_BLACK_MIX,
        chromaFraction = LED_ACCENT_BODY_CHROMA_BLACK_MIX,
    ),
)
