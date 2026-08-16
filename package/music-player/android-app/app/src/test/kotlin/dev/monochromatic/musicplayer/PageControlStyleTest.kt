// What:     `package dev.monochromatic.musicplayer` places this test beside the internal
//           page-control preference type.
// Why:      The test can reach module-internal decoding without exposing it publicly.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies the test module namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `assertEquals` is JUnit's value-equality assertion.
// Why:      Every stored preference spelling is compared with its expected style.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from "test";
// ```
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows

// What:     `Test` is the annotation used to register a JUnit test method.
// Why:      The JVM test runner discovers the decoder coverage method.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "test";
// ```
import org.junit.Test

// What:     `PageControlStyleTest` groups host-JVM tests for preference decoding.
// Why:      Known, missing, and stale names must all have pinned outcomes.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("PageControlStyle", () => { ... });
// ```
/** Verifies stored page-control style decoding. */
class PageControlStyleTest {
    // What:     `fromStoredNameHandlesKnownMissingAndUnknownValues` covers every enum
    //           member plus compatibility fallbacks.
    // Why:      Missing preferences use Chromium while corrupt names retain radio fallback.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("decodes names with distinct missing and unknown fallbacks", () => { ... });
    // ```
    /** Confirms names decode, missing defaults to Chromium, and unknown names fall back to radio. */
    @Test
    fun fromStoredNameHandlesKnownMissingAndUnknownValues() {
        PageControlStyle.entries.forEach { storedStyle ->
            assertEquals(
                resolvePageControlStyle(
                    PageControlStyleResolutionOptions(
                        requested = storedStyle,
                        included = PageControlStyle.includedStyles,
                    ),
                ),
                PageControlStyle.fromStoredName(storedStyle.name),
            )
        }
        assertEquals(
            resolvePageControlStyle(
                PageControlStyleResolutionOptions(
                    requested = PageControlStyle.CHROMIUM_TABS,
                    included = PageControlStyle.includedStyles,
                ),
            ),
            PageControlStyle.fromStoredName(null),
        )
        assertEquals(
            resolvePageControlStyle(
                PageControlStyleResolutionOptions(
                    requested = PageControlStyle.RADIO,
                    included = PageControlStyle.includedStyles,
                ),
            ),
            PageControlStyle.fromStoredName("future-style"),
        )
    }

    /** Confirms every independently excluded style follows deterministic build fallback chain. */
    @Test
    fun excludedStylesResolveWithoutRenumbering() {
        PageControlStyle.entries.forEach { excludedStyle ->
            /** Simulates one source toggle without mutating production constants. */
            val included: List<PageControlStyle> = PageControlStyle.entries.filter { style ->
                style != excludedStyle
            }
            /** Chromium is primary fallback unless Chromium itself is excluded. */
            val expected: PageControlStyle = if (excludedStyle == PageControlStyle.CHROMIUM_TABS) {
                PageControlStyle.RADIO
            } else {
                PageControlStyle.CHROMIUM_TABS
            }
            assertEquals(
                expected,
                resolvePageControlStyle(
                    PageControlStyleResolutionOptions(
                        requested = excludedStyle,
                        included = included,
                    ),
                ),
            )
        }
    }

    /** Confirms invalid build with no styles fails instead of exposing unusable Settings. */
    @Test
    fun emptyBuildAvailabilityThrowsConfigurationError() {
        assertThrows(PageControlStyleAvailabilityError::class.java) {
            resolvePageControlStyle(
                PageControlStyleResolutionOptions(
                    requested = PageControlStyle.CHROMIUM_TABS,
                    included = emptyList(),
                ),
            )
        }
    }
}
