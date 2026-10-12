package dev.monochromatic.musicplayer

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.colorspace.ColorSpaces
import dev.monochromatic.musicplayer.core.SrgbUnit
import dev.monochromatic.musicplayer.core.srgbUnitToOklch
import kotlin.math.sqrt
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Verifies runtime accent derivation stays in OKLCH and preserves white-legend contrast. */
class OklchColorTest {
    /** Confirms brightest possible runtime accent still yields accessible white-ink contrast. */
    @Test
    fun brightAccentProducesContrastingSelectedFill() {
        val selectedFill: Color = ledSelectedFill(Color.White)
        val contrastRatio: Float = (Color.White.luminance() + CONTRAST_OFFSET) /
            (selectedFill.luminance() + CONTRAST_OFFSET)

        assertTrue(contrastRatio >= MINIMUM_TEXT_CONTRAST)
    }

    /** Confirms zero neutral mix round-trips source pigment without a visible coordinate change. */
    @Test
    fun zeroMixPreservesSourcePigment() {
        val source: Color = Color(0xFF6750A4)
        val mixed: Color = mixOklchWithNeutral(
            OklchNeutralMix(
                color = source,
                neutralLightness = OKLCH_BLACK_LIGHTNESS,
                lightnessFraction = 0f,
                chromaFraction = 0f,
            ),
        )

        assertEquals(source.red, mixed.red, CHANNEL_TOLERANCE)
        assertEquals(source.green, mixed.green, CHANNEL_TOLERANCE)
        assertEquals(source.blue, mixed.blue, CHANNEL_TOLERANCE)
    }

    /** Confirms selected background retains most runtime-accent chroma after contrast darkening. */
    @Test
    fun selectedFillRetainsVibrantAccentChroma() {
        val source: Color = Color(0xFF6750A4).convert(ColorSpaces.Oklab)
        val selected: Color = ledSelectedFill(Color(0xFF6750A4)).convert(ColorSpaces.Oklab)
        val sourceChroma: Float = sqrt(source.green * source.green + source.blue * source.blue)
        val selectedChroma: Float = sqrt(selected.green * selected.green + selected.blue * selected.blue)

        assertTrue(selectedChroma >= sourceChroma * MINIMUM_CHROMA_RETENTION)
    }

    /** Confirms alpha replacement round-trips pigment through unchanged OKLCH coordinates. */
    @Test
    fun alphaReplacementPreservesPigment() {
        val source: Color = Color(0xFF6750A4)
        val adjusted: Color = source.withOklchAlpha(0.4f)

        assertEquals(source.red, adjusted.red, CHANNEL_TOLERANCE)
        assertEquals(source.green, adjusted.green, CHANNEL_TOLERANCE)
        assertEquals(source.blue, adjusted.blue, CHANNEL_TOLERANCE)
        assertEquals(0.4f, adjusted.alpha, CHANNEL_TOLERANCE)
    }

    /** Confirms full achromatic mixes reach requested black and white endpoints. */
    @Test
    fun fullMixReachesNeutralEndpoints() {
        val source: Color = Color(0xFF6750A4)
        val black: Color = mixOklchWithNeutral(
            OklchNeutralMix(
                color = source,
                neutralLightness = OKLCH_BLACK_LIGHTNESS,
                lightnessFraction = 1f,
                chromaFraction = 1f,
            ),
        )
        val white: Color = mixOklchWithNeutral(
            OklchNeutralMix(
                color = source,
                neutralLightness = OKLCH_WHITE_LIGHTNESS,
                lightnessFraction = 1f,
                chromaFraction = 1f,
            ),
        )

        assertEquals(Color.Black.red, black.red, CHANNEL_TOLERANCE)
        assertEquals(Color.Black.green, black.green, CHANNEL_TOLERANCE)
        assertEquals(Color.Black.blue, black.blue, CHANNEL_TOLERANCE)
        assertEquals(Color.White.red, white.red, CHANNEL_TOLERANCE)
        assertEquals(Color.White.green, white.green, CHANNEL_TOLERANCE)
        assertEquals(Color.White.blue, white.blue, CHANNEL_TOLERANCE)
    }

    /** Confirms the stops keep their order and positions and add interpolated stops inside every segment. */
    @Test
    fun gradientStopsKeepTheEndsAndFillTheSegments() {
        val stops: Array<Pair<Float, Color>> = oklchGradientStops(
            arrayOf(0f to Color.White, 1f to Color.Black),
        )
        assertEquals(0f, stops.first().first, 0f)
        assertEquals(1f, stops.last().first, 0f)
        assertTrue(stops.size > 2)
        assertTrue(stops.map { stop -> stop.first }.zipWithNext().all { pair -> pair.first <= pair.second })
    }

    /** Confirms a white to black ramp is mixed in OKLCH lightness, not by averaging sRGB channels. */
    @Test
    fun whiteToBlackMidpointIsOklchMiddleGrayNotSrgbMiddleGray() {
        val stops: Array<Pair<Float, Color>> = oklchGradientStops(arrayOf(0f to Color.White, 1f to Color.Black))
        val middle: Color = stops.minByOrNull { stop -> kotlin.math.abs(stop.first - 0.5f) }!!.second
        val lightness: Double = srgbUnitToOklch(
            SrgbUnit(middle.red.toDouble(), middle.green.toDouble(), middle.blue.toDouble()),
        ).lightness
        assertEquals(0.5, lightness, 0.01)
        assertTrue("sRGB averaging would give 0.5 per channel, got ${middle.red}", middle.red < 0.45f)
    }

    /** Confirms a fade to Color.Transparent keeps the pigment of the visible end, so only alpha changes. */
    @Test
    fun fadeToTransparentBlackKeepsThePigmentAndOnlyChangesAlpha() {
        val pigment: Color = Color.White.withOklchAlpha(0.5f)
        val stops: Array<Pair<Float, Color>> = oklchGradientStops(arrayOf(0f to pigment, 1f to Color.Transparent))
        // The last stop is the caller's own Transparent (black, alpha 0); every stop the helper adds is white.
        for (stop in stops.copyOfRange(0, stops.size - 1)) {
            assertEquals(1f, stop.second.red, CHANNEL_TOLERANCE)
            assertEquals(1f, stop.second.green, CHANNEL_TOLERANCE)
            assertEquals(1f, stop.second.blue, CHANNEL_TOLERANCE)
        }
        assertEquals(0.25f, stops.minByOrNull { stop -> kotlin.math.abs(stop.first - 0.5f) }!!.second.alpha, 0.05f)
    }

    private companion object {
        /** Stores WCAG relative-luminance contrast offset. */
        const val CONTRAST_OFFSET: Float = 0.05f

        /** Stores normal-text contrast floor. */
        const val MINIMUM_TEXT_CONTRAST: Float = 4.5f

        /** Stores accepted round-trip channel quantization error. */
        const val CHANNEL_TOLERANCE: Float = 0.002f

        /** Stores minimum retained chroma for vibrant selected backgrounds. */
        const val MINIMUM_CHROMA_RETENTION: Float = 0.80f
    }
}
