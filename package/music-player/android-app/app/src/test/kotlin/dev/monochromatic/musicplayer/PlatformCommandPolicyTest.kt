package dev.monochromatic.musicplayer

import androidx.media3.common.Player
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/** The notification controller loses only the timeline read, so media3 publishes no platform queue. */
class PlatformCommandPolicyTest {
    /** Commands the app advertises that the platform session needs for transport, position and metadata. */
    private val kept: List<Int> = listOf(
        Player.COMMAND_PLAY_PAUSE,
        Player.COMMAND_PREPARE,
        Player.COMMAND_STOP,
        Player.COMMAND_SEEK_TO_NEXT,
        Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
        Player.COMMAND_SEEK_TO_PREVIOUS,
        Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
        Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
        Player.COMMAND_SEEK_TO_MEDIA_ITEM,
        Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
        Player.COMMAND_GET_METADATA,
        Player.COMMAND_SET_REPEAT_MODE,
        Player.COMMAND_SET_SHUFFLE_MODE,
    )

    /** Everything media3 offers a trusted controller by default, here the kept commands plus the timeline read. */
    private val offered: List<Int> = kept + Player.COMMAND_GET_TIMELINE

    @Test
    fun theNotificationControllerLosesTheTimelineRead() {
        val result = platformCommandCodes(isMediaNotificationController = true, offered = offered)
        assertFalse(result.contains(Player.COMMAND_GET_TIMELINE))
    }

    @Test
    fun theNotificationControllerKeepsEveryOtherCommandInOrder() {
        val result = platformCommandCodes(isMediaNotificationController = true, offered = offered)
        assertEquals(kept, result)
    }

    @Test
    fun theNotificationControllerKeepsTheCurrentItemReadAndTheSeekCommands() {
        val result = platformCommandCodes(isMediaNotificationController = true, offered = offered)
        assertTrue(result.contains(Player.COMMAND_GET_CURRENT_MEDIA_ITEM))
        assertTrue(result.contains(Player.COMMAND_SEEK_TO_NEXT))
        assertTrue(result.contains(Player.COMMAND_SEEK_TO_PREVIOUS))
        assertTrue(result.contains(Player.COMMAND_SEEK_TO_MEDIA_ITEM))
    }

    @Test
    fun anotherControllerKeepsTheTimelineRead() {
        val result = platformCommandCodes(isMediaNotificationController = false, offered = offered)
        assertEquals(offered, result)
    }

    @Test
    fun anotherControllerGetsTheSameListBack() {
        val result = platformCommandCodes(isMediaNotificationController = false, offered = offered)
        assertSame(offered, result)
    }

    @Test
    fun anOfferWithoutTheTimelineReadIsUnchangedForTheNotificationController() {
        val result = platformCommandCodes(isMediaNotificationController = true, offered = kept)
        assertEquals(kept, result)
    }

    @Test
    fun anEmptyOfferStaysEmpty() {
        assertEquals(emptyList<Int>(), platformCommandCodes(isMediaNotificationController = true, offered = emptyList()))
        assertEquals(emptyList<Int>(), platformCommandCodes(isMediaNotificationController = false, offered = emptyList()))
    }

    @Test
    fun aRepeatedTimelineReadIsRemovedEverywhere() {
        val twice = listOf(Player.COMMAND_GET_TIMELINE, Player.COMMAND_PLAY_PAUSE, Player.COMMAND_GET_TIMELINE)
        val result = platformCommandCodes(isMediaNotificationController = true, offered = twice)
        assertEquals(listOf(Player.COMMAND_PLAY_PAUSE), result)
    }
}
