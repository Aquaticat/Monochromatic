package dev.monochromatic.musicplayer.core

/**
 * Three-state shuffle that also chooses the scope playback loops over, a faithful port of the
 * desktop's `ShuffleMode` (command.rs). [OFF] and [WITHIN_PAGE] confine playback to the current page
 * (the track's top-level folder, or its A-Z/`#` letter bucket for a root-level track) and loop
 * within it; only [ALL] traverses and loops the whole queue. There is deliberately no
 * "whole queue in load order, looped" mode: when not shuffling, playback stays inside the current
 * folder/page rather than jumping to another artist when a folder ends.
 *
 * The desktop persists these as serde's variant names (`"Off"`, `"WithinPage"`, `"All"`); the
 * session port maps to/from that wire form, so the enum constants here stay idiomatic Kotlin.
 */
enum class ShuffleMode {
    /** Play the current page in load order, looping within the page. */
    OFF,

    /** Shuffle the current page, looping within the page once all are played. */
    WITHIN_PAGE,

    /** Shuffle the whole queue, looping the queue once all are played. */
    ALL,
}
