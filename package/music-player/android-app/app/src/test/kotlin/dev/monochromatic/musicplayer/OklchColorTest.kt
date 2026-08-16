package dev.monochromatic.musicplayer

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
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
                fraction = 0f,
            ),
        )

        assertEquals(source.red, mixed.red, CHANNEL_TOLERANCE)
        assertEquals(source.green, mixed.green, CHANNEL_TOLERANCE)
        assertEquals(source.blue, mixed.blue, CHANNEL_TOLERANCE)
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
                fraction = 1f,
            ),
        )
        val white: Color = mixOklchWithNeutral(
            OklchNeutralMix(
                color = source,
                neutralLightness = OKLCH_WHITE_LIGHTNESS,
                fraction = 1f,
            ),
        )

        assertEquals(Color.Black.red, black.red, CHANNEL_TOLERANCE)
        assertEquals(Color.Black.green, black.green, CHANNEL_TOLERANCE)
        assertEquals(Color.Black.blue, black.blue, CHANNEL_TOLERANCE)
        assertEquals(Color.White.red, white.red, CHANNEL_TOLERANCE)
        assertEquals(Color.White.green, white.green, CHANNEL_TOLERANCE)
        assertEquals(Color.White.blue, white.blue, CHANNEL_TOLERANCE)
    }

    private companion object {
        /** Stores WCAG relative-luminance contrast offset. */
        const val CONTRAST_OFFSET: Float = 0.05f

        /** Stores normal-text contrast floor. */
        const val MINIMUM_TEXT_CONTRAST: Float = 4.5f

        /** Stores accepted round-trip channel quantization error. */
        const val CHANNEL_TOLERANCE: Float = 0.002f
    }
}
