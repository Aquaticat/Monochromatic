// Instrumented SharedPreferences migration checks. The test APK context owns the
// preference file, so these tests never touch the installed player's real session.

package dev.monochromatic.musicplayer

import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import dev.monochromatic.musicplayer.core.PlaybackMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

/** Verifies the real Android storage boundary on an emulator or device. */
class SessionStoreTest {
    /** Confirms all six old combinations migrate and remove both old keys. */
    @Test
    fun migratesEveryLegacyCombination() {
        val cases = listOf(
            Triple("OFF", false, PlaybackMode.IN_ORDER),
            Triple("WITHIN_PAGE", false, PlaybackMode.SHUFFLE_PAGE),
            Triple("ALL", false, PlaybackMode.SHUFFLE_ALL),
            Triple("OFF", true, PlaybackMode.REPEAT),
            Triple("WITHIN_PAGE", true, PlaybackMode.REPEAT),
            Triple("ALL", true, PlaybackMode.REPEAT),
        )
        cases.forEach { (shuffle, repeatTrack, expected) ->
            val context: Context = InstrumentationRegistry.getInstrumentation().context
            val preferences = context.getSharedPreferences("session", Context.MODE_PRIVATE)
            preferences.edit()
                .clear()
                .putString("shuffle", shuffle)
                .putBoolean("repeat_track", repeatTrack)
                .commit()
            assertEquals(expected, SessionStore.load(context).playbackMode)
            assertEquals(expected.storedName, preferences.getString("playback_mode", null))
            assertFalse(preferences.contains("shuffle"))
            assertFalse(preferences.contains("repeat_track"))
        }
    }

    /** Confirms a present current value wins and stale old keys are ignored. */
    @Test
    fun currentPlaybackModeWinsOverLegacyKeys() {
        val context: Context = InstrumentationRegistry.getInstrumentation().context
        val preferences = context.getSharedPreferences("session", Context.MODE_PRIVATE)
        preferences.edit()
            .clear()
            .putString("playback_mode", PlaybackMode.SHUFFLE_ALL.storedName)
            .putString("shuffle", "WITHIN_PAGE")
            .putBoolean("repeat_track", true)
            .commit()
        assertEquals(PlaybackMode.SHUFFLE_ALL, SessionStore.load(context).playbackMode)
        assertFalse(preferences.contains("shuffle"))
    }
}
