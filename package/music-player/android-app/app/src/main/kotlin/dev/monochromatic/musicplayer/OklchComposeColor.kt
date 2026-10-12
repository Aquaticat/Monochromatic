// Compose-facing adapters over the one OKLCH implementation in `core/OklchColor.kt` (D108). They convert a Compose
// `Color` to OKLCH, move one or more coordinates, and convert back with chroma-reduction gamut mapping; they contain
// no color math of their own, so a role derived here and a role derived in `core/ThemeRoles.kt` agree.

// What:     `package dev.monochromatic.musicplayer` keeps the adapters beside the composables that call them.
// Why:      They need Compose's `Color`, which the pure `core` package must not import.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     Imports bring in Compose's `Color` and its sRGB color space, and the pure OKLCH functions.
// Why:      A Compose color may be stored in another space, so it is converted to sRGB before its coordinates are read.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Color } from "compose/ui/graphics";
// ```
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.colorspace.ColorSpaces
import dev.monochromatic.musicplayer.core.Oklch
import dev.monochromatic.musicplayer.core.SrgbUnit
import dev.monochromatic.musicplayer.core.oklchToSrgbUnit
import dev.monochromatic.musicplayer.core.mixOklch
import dev.monochromatic.musicplayer.core.srgbUnitToOklch

/** Stores achromatic black's OKLCH lightness coordinate. */
internal const val OKLCH_BLACK_LIGHTNESS: Float = 0f

/** Stores achromatic white's OKLCH lightness coordinate. */
internal const val OKLCH_WHITE_LIGHTNESS: Float = 1f

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

/** Reads a Compose color as OKLCH through its sRGB form; alpha is carried separately by the callers. */
private fun Color.toOklch(): Oklch {
    /** The same color expressed in sRGB, whatever space it was stored in. */
    val srgb: Color = convert(ColorSpaces.Srgb)
    return srgbUnitToOklch(
        SrgbUnit(
            red = srgb.red.toDouble().coerceIn(0.0, 1.0),
            green = srgb.green.toDouble().coerceIn(0.0, 1.0),
            blue = srgb.blue.toDouble().coerceIn(0.0, 1.0),
        ),
    )
}

/** Builds an sRGB Compose color from OKLCH coordinates, gamut-mapped by chroma reduction, with the given alpha. */
private fun Oklch.toComposeColor(alpha: Float): Color {
    /** The gamut-mapped channels in 0 to 1. */
    val unit: SrgbUnit = oklchToSrgbUnit(this)
    return Color(red = unit.red.toFloat(), green = unit.green.toFloat(), blue = unit.blue.toFloat(), alpha = alpha)
}

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
    val lightnessFraction: Double = options.lightnessFraction.coerceIn(0f, 1f).toDouble()
    /** Clamps caller chroma fraction independently so dark pigments can remain vibrant. */
    val chromaFraction: Double = options.chromaFraction.coerceIn(0f, 1f).toDouble()
    /** Converts source pigment before manipulating any color coordinate. */
    val source: Oklch = options.color.toOklch()
    return Oklch(
        lightness = source.lightness + (options.neutralLightness.toDouble() - source.lightness) * lightnessFraction,
        chroma = source.chroma * (1.0 - chromaFraction),
        hue = source.hue,
    ).toComposeColor(alpha = options.color.alpha)
}

/** Returns same OKLCH pigment with requested alpha coordinate. */
internal fun Color.withOklchAlpha(alpha: Float): Color = toOklch().toComposeColor(alpha = alpha.coerceIn(0f, 1f))

// What:     `private const val GRADIENT_SEGMENT_SAMPLES: Int = 7` is the number of stops added inside each
//           gradient segment.
// Why:      Seven extra stops make the stepped OKLCH ramp read as smooth at the sizes the LED plates draw.
//
// In TS you'd write (pseudocode):
// ```ts
// const GRADIENT_SEGMENT_SAMPLES = 7;
// ```
/** Intermediate stops inserted inside every gradient segment, enough that the stepped ramp reads as smooth. */
private const val GRADIENT_SEGMENT_SAMPLES: Int = 7

// What:     `internal fun oklchGradientStops(stops)` adds OKLCH-interpolated stops between a gradient's stops.
// Why:      Android blends gradient stops in sRGB, which D108 forbids, so the blend is done here in OKLCH and the
//           shader only sees close stops.
//
// In TS you'd write (pseudocode):
// ```ts
// const oklchGradientStops = (stops) => stops.flatMap((s, i) => [s, ...interpolateInOklch(s, stops[i + 1])]);
// ```
/**
 * Returns [stops] with extra stops inside each segment so a gradient interpolates in OKLCH instead of in sRGB.
 *
 * Compose and Android blend neighbouring gradient stops channel by channel in sRGB, which changes lightness, chroma and
 * hue (D108 forbids that). Each segment between two stops gets [GRADIENT_SEGMENT_SAMPLES] extra stops whose pigment is
 * the OKLCH mix of the two ends and whose alpha is the straight mix of the two alphas. A stop with zero alpha has no
 * pigment of its own (`Color.Transparent` is transparent black), so its neighbour's pigment is used and the segment
 * becomes an alpha-only ramp, which D108 allows. Stops keep their order and positions.
 *
 * @param stops position and color of each stop, in ascending position.
 * @return the original stops plus the interpolated ones, in ascending position.
 */
internal fun oklchGradientStops(stops: Array<Pair<Float, Color>>): Array<Pair<Float, Color>> {
    /** Accumulates the stops of the result in order. */
    val result = mutableListOf<Pair<Float, Color>>()
    stops.forEachIndexed { index, stop ->
        result += stop
        /** The stop after this one, or null at the end. */
        val next: Pair<Float, Color>? = stops.getOrNull(index + 1)
        if (next != null) {
            for (step in 1..GRADIENT_SEGMENT_SAMPLES) {
                /** Fraction of the way from this stop to the next. */
                val fraction: Float = step.toFloat() / (GRADIENT_SEGMENT_SAMPLES + 1)
                result += Pair(
                    stop.first + (next.first - stop.first) * fraction,
                    mixStopColors(from = stop.second, to = next.second, fraction = fraction),
                )
            }
        }
    }
    return result.toTypedArray()
}

// What:     `private fun mixStopColors(from, to, fraction)` mixes two stop colors.
// Why:      The pigment is mixed in OKLCH and the alpha straight; a zero-alpha end has no pigment, so it borrows
//           its neighbour's.
//
// In TS you'd write (pseudocode):
// ```ts
// const mixStopColors = (from, to, t) =>
//   ({ ...mixOklch(pigment(from), pigment(to), t), alpha: lerp(from.a, to.a, t) });
// ```
/** Mixes two gradient stop colors: pigment in OKLCH (a zero-alpha end borrows the other's), alpha straight. */
private fun mixStopColors(from: Color, to: Color, fraction: Float): Color {
    /** Alpha of the mixed stop. */
    val alpha: Float = from.alpha + (to.alpha - from.alpha) * fraction
    /** Pigment the zero-alpha start borrows, or the start's own. */
    val fromPigment: Oklch = (if (from.alpha == 0f) to else from).toOklch()
    /** Pigment the zero-alpha end borrows, or the end's own. */
    val toPigment: Oklch = (if (to.alpha == 0f) from else to).toOklch()
    return mixOklch(fromPigment, toPigment, fraction.toDouble()).toComposeColor(alpha = alpha)
}
