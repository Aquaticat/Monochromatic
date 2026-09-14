package dev.monochromatic.musicplayer

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.colorspace.ColorSpaces
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/** Stores achromatic black's OKLCH lightness coordinate. */
internal const val OKLCH_BLACK_LIGHTNESS: Float = 0f

/** Stores achromatic white's OKLCH lightness coordinate. */
internal const val OKLCH_WHITE_LIGHTNESS: Float = 1f

/** Stores one pigment in cylindrical OKLCH coordinates plus independent alpha. */
private data class OklchCoordinates(
    val lightness: Float,
    val chroma: Float,
    val hue: Float,
    val alpha: Float,
)

/**
 * Groups one source pigment with achromatic OKLCH endpoint and independent coordinate fractions.
 *
 * @property color Runtime pigment whose hue is retained.
 * @property neutralLightness OKLCH lightness for black (`0`) or white (`1`).
 * @property lightnessFraction Proportion of neutral lightness mixed into source pigment.
 * @property chromaFraction Proportion of zero chroma mixed into source pigment.
 */
internal data class OklchNeutralMix(
    val color: Color,
    val neutralLightness: Float,
    val lightnessFraction: Float,
    val chromaFraction: Float,
)

/** Converts display color to cylindrical OKLCH coordinates. */
private fun Color.toOklchCoordinates(): OklchCoordinates {
    /** Stores Cartesian OKLab representation supplied by Compose. */
    val oklab: Color = convert(ColorSpaces.Oklab)
    /** Converts Cartesian chromatic axes to cylindrical OKLCH chroma. */
    val chroma: Float = sqrt(oklab.green * oklab.green + oklab.blue * oklab.blue)
    return OklchCoordinates(
        lightness = oklab.red,
        chroma = chroma,
        hue = atan2(oklab.blue, oklab.green),
        alpha = oklab.alpha,
    )
}

/** Converts cylindrical OKLCH coordinates to display sRGB. */
private fun OklchCoordinates.toSrgbColor(): Color = Color(
    red = lightness,
    green = chroma * cos(hue),
    blue = chroma * sin(hue),
    alpha = alpha,
    colorSpace = ColorSpaces.Oklab,
).convert(ColorSpaces.Srgb)

/**
 * Mixes one pigment toward an achromatic endpoint in OKLCH color coordinates.
 *
 * Chroma approaches zero while source hue remains stable.
 *
 * @param options Source pigment, neutral lightness, and coordinate fractions.
 * @return sRGB display color produced from interpolated OKLCH coordinates.
 */
internal fun mixOklchWithNeutral(options: OklchNeutralMix): Color {
    /** Clamps caller lightness fraction to valid interpolation bounds. */
    val lightnessFraction: Float = options.lightnessFraction.coerceIn(0f, 1f)
    /** Clamps caller chroma fraction independently so dark pigments can remain vibrant. */
    val chromaFraction: Float = options.chromaFraction.coerceIn(0f, 1f)
    /** Converts source pigment before manipulating any color coordinate. */
    val source: OklchCoordinates = options.color.toOklchCoordinates()
    return OklchCoordinates(
        lightness = source.lightness +
            (options.neutralLightness - source.lightness) * lightnessFraction,
        chroma = source.chroma * (1f - chromaFraction),
        hue = source.hue,
        alpha = source.alpha,
    ).toSrgbColor()
}

/** Returns same OKLCH pigment with requested alpha coordinate. */
internal fun Color.withOklchAlpha(alpha: Float): Color {
    /** Converts source pigment before changing independent alpha coordinate. */
    val source: OklchCoordinates = toOklchCoordinates()
    return OklchCoordinates(
        lightness = source.lightness,
        chroma = source.chroma,
        hue = source.hue,
        alpha = alpha.coerceIn(0f, 1f),
    ).toSrgbColor()
}
