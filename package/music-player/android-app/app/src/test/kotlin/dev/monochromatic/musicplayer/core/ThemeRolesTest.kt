// What:     `package dev.monochromatic.musicplayer.core` places this test beside the role derivation.
// Why:      The test reaches the internal pure functions in the same package as the code under test.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies the test module namespace.
// ```
package dev.monochromatic.musicplayer.core

import kotlin.math.abs
import kotlin.math.sign
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Ports the Rust `theme_roles_tests.rs` guarantees: AA for any root, fixed roles, gray roots, the cap, layers. */
class ThemeRolesTest {
    /** Every test root: hues every 10 degrees by lightness and chroma spreads, plus grays and the extremes. */
    private fun sweptRoots(): List<Srgb8> {
        val roots = mutableListOf<Srgb8>()
        for (hue in 0 until FULL_TURN step HUE_STEP) {
            for (lightness in listOf(0.3, 0.55, 0.8, 0.95)) {
                for (chroma in listOf(0.0, 0.01, 0.03, 0.06, 0.1, 0.15, 0.2, 0.3)) {
                    roots += oklchToSrgb8(Oklch(lightness, chroma, hue.toDouble()))
                }
            }
        }
        for (value in listOf(0xFF0000, 0xFFD000, 0xFFFF00, 0x00FF00, 0x0000FF, 0x6060C0, 0, 0xFFFFFF, 0x808080, 0x7F7F80)) {
            roots += Srgb8.fromRgbInt(value)
        }
        return roots
    }

    /** Asserts one contrast pair with a message naming it. */
    private fun assertRatio(label: String, foreground: Srgb8, background: Srgb8, minimum: Double) {
        val ratio: Double = contrastRatio(foreground, background)
        assertTrue("$label: ${foreground.toHex()} on ${background.toHex()} is $ratio, below $minimum", ratio >= minimum)
    }

    /** Asserts every text pair of one scheme at AA (4.5, and 3 for outlines and the error icon). */
    private fun checkSchemeContrast(label: String, set: RoleSet) {
        val surfaces: List<Srgb8> = listOf(set.canvas, set.deck, set.currentRow, set.surfaceHigh)
        for (surface in surfaces) {
            val pressed: Srgb8 = compositeOver(set.onSurface, PRESSED_ALPHA, surface)
            val hovered: Srgb8 = compositeOver(set.onSurface, HOVER_ALPHA, surface)
            assertRatio("$label on-surface", set.onSurface, surface, AA_TEXT)
            assertRatio("$label on-surface pressed", set.onSurface, pressed, AA_TEXT)
            assertRatio("$label on-surface-variant", set.onSurfaceVariant, surface, AA_TEXT)
            assertRatio("$label on-surface-variant hovered", set.onSurfaceVariant, hovered, AA_TEXT)
            assertRatio("$label primary text", set.primary, surface, AA_TEXT)
            assertRatio("$label primary hovered", set.primary, hovered, AA_TEXT)
        }
        for (fill in listOf(set.secondaryContainer, set.secondaryContainerHovered, set.secondaryContainerPressed)) {
            assertRatio("$label on-secondary-container", set.onSecondaryContainer, fill, AA_TEXT)
        }
        assertRatio("$label primary on the selected fill", set.primary, set.secondaryContainer, AA_TEXT)
        assertRatio("$label on-primary", set.onPrimary, set.primary, AA_TEXT)
        val onPrimaryPressed: Srgb8 = compositeOver(set.onPrimary, PRESSED_ALPHA, set.primary)
        assertRatio("$label on-primary pressed", set.onPrimary, onPrimaryPressed, AA_TEXT)
        assertRatio("$label on-surface on the match fill", set.onSurface, set.matchFill, AA_TEXT)
        assertRatio("$label on-surface-variant on the match fill", set.onSurfaceVariant, set.matchFill, AA_TEXT)
        assertRatio("$label outline on the canvas", set.outline, set.canvas, AA_NON_TEXT)
        assertRatio("$label outline on the deck", set.outline, set.deck, AA_NON_TEXT)
        assertRatio("$label on-error-container", set.onErrorContainer, set.errorContainer, AA_TEXT)
        assertRatio("$label error on the container", set.error, set.errorContainer, AA_NON_TEXT)
        assertRatio("$label error text on the canvas", set.error, set.canvas, AA_TEXT)
    }

    /** Confirms AA text contrast on every surface and state layer for more than a thousand roots in both schemes. */
    @Test
    fun everySweptRootKeepsAaContrastInBothSchemes() {
        val roots: List<Srgb8> = sweptRoots()
        assertTrue("the sweep is too small: ${roots.size}", roots.size > MINIMUM_SWEEP)
        for (root in roots) {
            val palette: ThemePalette = deriveRoles(root)
            checkSchemeContrast("dark root ${root.toHex()}", palette.dark)
            checkSchemeContrast("light root ${root.toHex()}", palette.light)
        }
    }

    /** Confirms the Settings page pairs hold AA: Settings is drawn on the canvas alone (D109). */
    @Test
    fun settingsRowPairsHoldAaOnTheCanvasUnderEveryRoot() {
        for (root in sweptRoots()) {
            val palette: ThemePalette = deriveRoles(root)
            for (set in listOf(palette.dark, palette.light)) {
                val hovered: Srgb8 = compositeOver(set.onSurface, HOVER_ALPHA, set.canvas)
                val pressed: Srgb8 = compositeOver(set.onSurface, PRESSED_ALPHA, set.canvas)
                assertRatio("title ${root.toHex()}", set.onSurface, set.canvas, AA_TEXT)
                assertRatio("title pressed ${root.toHex()}", set.onSurface, pressed, AA_TEXT)
                assertRatio("line ${root.toHex()}", set.onSurfaceVariant, set.canvas, AA_TEXT)
                assertRatio("line hovered ${root.toHex()}", set.onSurfaceVariant, hovered, AA_TEXT)
            }
        }
    }

    /** Confirms the dark canvas, the deck and the seam, the light canvas and white on-primary, and error roles are fixed. */
    @Test
    fun fixedRolesDoNotFollowTheAccent() {
        for (root in sweptRoots()) {
            val palette: ThemePalette = deriveRoles(root)
            assertEquals(Srgb8(0x00, 0x00, 0x00), palette.dark.canvas)
            assertEquals(Srgb8(0x0A, 0x0A, 0x0D), palette.dark.deck)
            assertEquals(Srgb8(0x00, 0x00, 0x00), palette.dark.seam)
            assertEquals(Srgb8(0xFF, 0xFF, 0xFF), palette.light.canvas)
            assertEquals(Srgb8(0xFF, 0xFF, 0xFF), palette.light.onPrimary)
            assertEquals(Srgb8(0xFF, 0xB4, 0xAB), palette.dark.error)
            assertEquals(Srgb8(0xF9, 0xDE, 0xDC), palette.light.errorContainer)
        }
    }

    /** Confirms the baseline root reproduces the values the player held before D108, within a just-noticeable step. */
    @Test
    fun theBaselineStaysCloseToTheOldFixedValues() {
        val palette: ThemePalette = deriveRoles(null)
        val old: List<Triple<String, Int, Int>> = listOf(
            Triple("canvas", 0x000000, 0xFFFFFF), Triple("deck", 0x0A0A0D, 0xF4F3FA),
            Triple("currentRow", 0x121318, 0xF4F3FA), Triple("seam", 0x000000, 0xB0B1BC),
            Triple("onSurface", 0xE4E5F0, 0x30323B), Triple("onSurfaceVariant", 0xC5C6D0, 0x5C5E6A),
            Triple("outline", 0x8E9099, 0x757780), Triple("outlineVariant", 0x44464F, 0xC5C6D0),
            Triple("primary", 0xBAC5EE, 0x4E5E8B), Triple("onPrimary", 0x1F2D52, 0xFFFFFF),
            Triple("secondaryContainer", 0x353B4D, 0xDDE2F9), Triple("onSecondaryContainer", 0xDDE2F9, 0x161B2C),
            Triple("surfaceHigh", 0x1E1F25, 0xE8E7EE), Triple("error", 0xFFB4AB, 0xBA1A1A),
            Triple("errorContainer", 0x8C1D18, 0xF9DEDC), Triple("onErrorContainer", 0xF9DEDC, 0x410E0B),
        )
        var largest = 0.0
        for ((name, dark, light) in old) {
            val darkRole: Srgb8 = palette.dark.toNamedList().first { pair -> pair.first == name }.second
            val lightRole: Srgb8 = palette.light.toNamedList().first { pair -> pair.first == name }.second
            largest = maxOf(largest, deltaEOk(darkRole, Srgb8.fromRgbInt(dark)), deltaEOk(lightRole, Srgb8.fromRgbInt(light)))
        }
        println("largest baseline delta-E vs the old fixed values: $largest")
        assertTrue("baseline drifted: $largest", largest < BASELINE_DRIFT_LIMIT)
    }

    /** Confirms a gray root gives gray roles (except the fixed error roles and the fixed dark deck). */
    @Test
    fun aGrayRootYieldsGrayRoles() {
        val terms: RootTerms = rootTerms(Srgb8(0x80, 0x80, 0x80))
        assertEquals(srgbToOklch(BASELINE_ROOT).hue, terms.hue, 0.0)
        assertTrue(terms.scale < 0.01)
        val palette: ThemePalette = deriveRoles(Srgb8(0x80, 0x80, 0x80))
        for ((label, set) in listOf("dark" to palette.dark, "light" to palette.light)) {
            for ((name, color) in set.toNamedList()) {
                if (name.startsWith("error") || name == "onErrorContainer" || (name == "deck" && label == "dark")) {
                    continue
                }
                val spread: Int = maxOf(color.red, color.green, color.blue) - minOf(color.red, color.green, color.blue)
                assertTrue("$label $name ${color.toHex()} is not gray", spread <= 2)
            }
        }
    }

    /** Confirms a more vivid accent gives a more vivid primary up to the cap, and that past the cap nothing changes. */
    @Test
    fun aMoreVividAccentGivesAMoreVividPrimaryUpToTheCap() {
        val muted: Double = srgbToOklch(deriveRoles(Srgb8.fromRgbInt(0x7A7F9A)).dark.primary).chroma
        val vivid: Double = srgbToOklch(deriveRoles(Srgb8.fromRgbInt(0x6060C0)).dark.primary).chroma
        assertTrue("$vivid vs $muted", vivid > muted)
        val capScale: Double = ROOT_CHROMA_CAP / srgbToOklch(BASELINE_ROOT).chroma
        assertEquals(capScale, rootTerms(Srgb8.fromRgbInt(0x4000FF)).scale, 1e-12)
        assertEquals(capScale, rootTerms(Srgb8.fromRgbInt(0xFF0000)).scale, 1e-12)
    }

    /** Confirms a vivid root does not tint the neutral surfaces beyond the baseline. */
    @Test
    fun aVividRootDoesNotTintTheNeutralSurfacesBeyondTheBaseline() {
        val baseline: Double = srgbToOklch(deriveRoles(null).dark.surfaceHigh).chroma
        val vivid: Double = srgbToOklch(deriveRoles(Srgb8.fromRgbInt(0xFF0000)).dark.surfaceHigh).chroma
        assertTrue("$vivid vs $baseline", abs(vivid - baseline) < 0.004)
    }

    /** Confirms the selected-fill layers step toward the content color, hover first and pressed further. */
    @Test
    fun theSelectedFillLayersStepTowardTheContentColor() {
        for (root in listOf(null, Srgb8.fromRgbInt(0x6060C0))) {
            val palette: ThemePalette = deriveRoles(root)
            for (set in listOf(palette.dark, palette.light)) {
                val base: Oklch = srgbToOklch(set.secondaryContainer)
                val content: Oklch = srgbToOklch(set.onSecondaryContainer)
                val hovered: Oklch = srgbToOklch(set.secondaryContainerHovered)
                val pressed: Oklch = srgbToOklch(set.secondaryContainerPressed)
                val toward: Double = sign(content.lightness - base.lightness)
                assertTrue((hovered.lightness - base.lightness) * toward > 0.0)
                assertTrue((pressed.lightness - hovered.lightness) * toward > 0.0)
            }
        }
    }

    /** Confirms the match fill is darker than primary in dark and lighter in light (D59). */
    @Test
    fun theMatchFillIsDarkerInDarkAndLighterInLight() {
        val palette: ThemePalette = deriveRoles(Srgb8.fromRgbInt(0x6060C0))
        assertTrue(srgbToOklch(palette.dark.matchFill).lightness < srgbToOklch(palette.dark.primary).lightness)
        assertTrue(srgbToOklch(palette.light.matchFill).lightness > srgbToOklch(palette.light.primary).lightness)
    }

    /** Confirms accent roles keep root hue plus their offset instead of clipping, wherever they keep enough chroma. */
    @Test
    fun accentRolesKeepTheRootHueInsteadOfClipping() {
        var checked = 0
        for (hue in 0 until FULL_TURN step HUE_STEP) {
            val root: Srgb8 = oklchToSrgb8(Oklch(0.6, 0.15, hue.toDouble()))
            val terms: RootTerms = rootTerms(root)
            val palette: ThemePalette = deriveRoles(root)
            for ((set, offset) in listOf(palette.dark to DARK_PRIMARY_OFFSET, palette.light to LIGHT_PRIMARY_OFFSET)) {
                val lch: Oklch = srgbToOklch(set.primary)
                if (lch.chroma < MIN_CHECKED_CHROMA) {
                    continue
                }
                val difference: Double = wrapHue(lch.hue - (terms.hue + offset) + 540.0) - 180.0
                assertTrue("primary hue ${lch.hue} for root hue $hue", abs(difference) < HUE_TOLERANCE)
                checked += 1
            }
        }
        assertTrue("the hue check ran on only $checked roles", checked > MINIMUM_HUE_CHECKS)
    }

    /** Positive control: a start that fails 4.6 on white comes back darker and passing, so the fit can act. */
    @Test
    fun theFitMovesLightnessWhenATargetFails() {
        val white = Srgb8(255, 255, 255)
        val start = Oklch(0.85, 0.05, 250.0)
        val fitted: Oklch = fitLightness(start, 0.0) { candidate -> contrastRatio(candidate, white) >= 4.6 }
        assertTrue(fitted.lightness < start.lightness)
        assertEquals(start.hue, fitted.hue, 0.0)
        assertTrue(contrastRatio(oklchToSrgb8(fitted), white) >= 4.6)
    }

    /** Confirms the fit returns the endpoint when no lightness can pass. */
    @Test
    fun theFitReturnsTheEndpointWhenNothingCanPass() {
        val fitted: Oklch = fitLightness(Oklch(0.5, 0.0, 0.0), 0.0) { false }
        assertEquals(0.0, fitted.lightness, 0.0)
    }

    private companion object {
        /** AA contrast for text. */
        const val AA_TEXT: Double = 4.5

        /** AA contrast for UI parts. */
        const val AA_NON_TEXT: Double = 3.0

        /** Degrees in a turn. */
        const val FULL_TURN: Int = 360

        /** Degrees between swept hues. */
        const val HUE_STEP: Int = 10

        /** Fewest roots the sweep must contain. */
        const val MINIMUM_SWEEP: Int = 1000

        /** Largest OKLab distance (times 100) the baseline may drift from the pre-D108 values. */
        const val BASELINE_DRIFT_LIMIT: Double = 0.5

        /** Primary hue offsets of the dark and light tables. */
        const val DARK_PRIMARY_OFFSET: Double = 4.7
        const val LIGHT_PRIMARY_OFFSET: Double = 0.0

        /** Chroma below which 8-bit rounding limits hue accuracy and the hue check is skipped. */
        const val MIN_CHECKED_CHROMA: Double = 0.03

        /** Accepted hue difference in degrees. */
        const val HUE_TOLERANCE: Double = 4.0

        /** Fewest hue checks that must run. */
        const val MINIMUM_HUE_CHECKS: Int = 20
    }
}
