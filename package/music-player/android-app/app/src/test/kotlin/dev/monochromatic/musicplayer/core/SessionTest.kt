// Host-JVM checks for the platform-independent session value.

// What:     This package matches the code under test.
// Why:      Tests can use Session and PlaybackMode without qualified names.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.core

// What:     JUnit assertions compare values and nullable state.
// Why:      Session defaults and copies are observable as plain values.
//
// In TS you'd write (pseudocode):
// ```ts
// import { expect } from "test";
// ```
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull

// What:     `Test` marks methods discovered by JUnit.
// Why:      The Gradle unit-test task needs executable test entries.
//
// In TS you'd write (pseudocode):
// ```ts
// import { test } from "test";
// ```
import org.junit.Test

/** Verifies defaults and copying for the four-state session model. */
class SessionTest {
    /** Confirms a fresh session starts in In order with no selected track. */
    @Test
    fun defaultsUseOneInOrderMode() {
        val session = Session()
        assertNull(session.selected)
        assertEquals(0.0, session.positionSecs, 0.0)
        assertEquals(1.0f, session.volume, 0.0f)
        assertEquals(PlaybackMode.IN_ORDER, session.playbackMode)
    }

    /** Confirms every current-format field survives a structural copy. */
    @Test
    fun copyPreservesCurrentFields() {
        val original = Session(
            selected = "content://media/external/audio/media/42",
            positionSecs = 12.5,
            volume = 0.7f,
            playbackMode = PlaybackMode.SHUFFLE_PAGE,
        )
        val copied = original.copy()
        assertEquals(original, copied)
        assertEquals(PlaybackMode.SHUFFLE_PAGE, copied.playbackMode)
    }

    /** Confirms Repeat is represented by the mode rather than another field. */
    @Test
    fun repeatRoundTripsAsPlaybackMode() {
        val original = Session(playbackMode = PlaybackMode.REPEAT)
        assertEquals(PlaybackMode.REPEAT, original.copy().playbackMode)
    }
}
