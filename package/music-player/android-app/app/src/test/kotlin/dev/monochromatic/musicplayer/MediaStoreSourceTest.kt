// What:     `package dev.monochromatic.musicplayer` names the namespace this test lives under,
//           the SAME package as `MediaStoreSource`, so the test can call its `internal`
//           helper by short name through the singleton object.
// Why:      The MediaStore sidecar filter is Android-source-specific, so this test belongs
//           beside the other app-level host-JVM tests.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — the file path IS the module; here it shares the SUT's namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `import org.junit.Assert.assertEquals` imports JUnit 4's static
//           `assertEquals(expected, actual)` function by short name.
// Why:      The ordinary-name case compares the helper's returned string to the input.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertEquals } from "@junit/assert";
// ```
import org.junit.Assert.assertEquals

// What:     `import org.junit.Assert.assertNull` imports JUnit 4's static
//           `assertNull(value)` assertion by short name.
// Why:      The missing-name and sidecar cases should both return null.
//
// In TS you'd write (pseudocode):
// ```ts
// import { assertNull } from "@junit/assert";
// ```
import org.junit.Assert.assertNull

// What:     `import org.junit.Test` imports the JUnit 4 annotation class used as
//           `@Test` on each test method.
// Why:      The runner discovers only methods marked with this annotation.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "vitest";
// ```
import org.junit.Test

// What:     `class MediaStoreSourceTest { ... }` declares a JUnit 4 test class.
//           The runner constructs it and invokes each `@Test` method; there is no
//           constructor or mutable state.
// Why:      Groups tests for MediaStore-specific helper behavior that the pure core
//           audio-extension tests cannot cover.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("MediaStoreSource", () => { /* ...tests... */ });
// ```
class MediaStoreSourceTest {
    // What:     `@Test` is an annotation attached to the next method.
    // Why:      Registers the MediaStore name-cleaning regression test with JUnit.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("mediaStoreTrackName drops missing names and AppleDouble sidecars", () => {
    // ```
    @Test
    // What:     `fun mediaStoreTrackNameDropsMissingNamesAndAppleDoubleSidecars() { ... }`
    //           declares a no-argument test method returning `Unit`, Kotlin's void.
    // Why:      Pins every branch of the helper the MediaStore cursor loop relies on.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // () => { /* ...assertions below... */ }
    // ```
    fun mediaStoreTrackNameDropsMissingNamesAndAppleDoubleSidecars() {
        // What:     `assertNull(MediaStoreSource.mediaStoreTrackName(null))` calls the helper
        //           through the `MediaStoreSource` singleton and expects null.
        // Why:      A MediaStore row without a display name cannot produce a track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(MediaStoreSource.mediaStoreTrackName(null)).toBeNull();
        // ```
        assertNull(MediaStoreSource.mediaStoreTrackName(null))
        // What:     `assertNull(MediaStoreSource.mediaStoreTrackName("._song.mp3"))` expects
        //           null for an AppleDouble sidecar with an audio-looking extension.
        // Why:      This is the MediaStore regression path: the row must be skipped before
        //           URI and `Track` construction.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(MediaStoreSource.mediaStoreTrackName("._song.mp3")).toBeNull();
        // ```
        assertNull(MediaStoreSource.mediaStoreTrackName("._song.mp3"))
        // What:     `assertEquals("song.mp3", MediaStoreSource.mediaStoreTrackName("song.mp3"))`
        //           compares the expected ordinary filename to the helper's actual return.
        // Why:      Real tracks must pass through unchanged.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(MediaStoreSource.mediaStoreTrackName("song.mp3")).toBe("song.mp3");
        // ```
        assertEquals("song.mp3", MediaStoreSource.mediaStoreTrackName("song.mp3"))
    }
}
