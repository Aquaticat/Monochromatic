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
    // Why:      Radio controls are the required default for old or corrupt preferences.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("decodes names and defaults to radio", () => { ... });
    // ```
    /** Confirms exact names decode and all unusable names fall back to radio controls. */
    @Test
    fun fromStoredNameHandlesKnownMissingAndUnknownValues() {
        assertEquals(PageControlStyle.RADIO, PageControlStyle.fromStoredName("RADIO"))
        assertEquals(PageControlStyle.MD1_TABS, PageControlStyle.fromStoredName("MD1_TABS"))
        assertEquals(PageControlStyle.ROUNDED_BUTTONS, PageControlStyle.fromStoredName("ROUNDED_BUTTONS"))
        assertEquals(PageControlStyle.SEGMENTED_BUTTONS, PageControlStyle.fromStoredName("SEGMENTED_BUTTONS"))
        assertEquals(PageControlStyle.CHROMIUM_TABS, PageControlStyle.fromStoredName("CHROMIUM_TABS"))
        assertEquals(PageControlStyle.RADIO, PageControlStyle.fromStoredName(null))
        assertEquals(PageControlStyle.RADIO, PageControlStyle.fromStoredName("future-style"))
    }
}
