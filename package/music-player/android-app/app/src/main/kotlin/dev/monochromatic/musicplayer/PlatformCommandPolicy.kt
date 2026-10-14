// What:     `package dev.monochromatic.musicplayer` puts this file beside `PlatformSessionCallback`, which uses it.
// Why:      The rule is plain Kotlin on integers, with no media3 types, so unit tests reach it directly (media3's
//           `Player.Commands` needs an Android runtime that the host JVM tests do not have).
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     `import androidx.media3.common.Player` pulls in `Player`, whose `COMMAND_*` constants are plain integer
//           codes. Kotlin copies a Java `static final int` into the calling code at compile time.
// Why:      The rule names the one command it removes. Because the constant is copied in, a host JVM test never loads
//           the `Player` class.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Player } from "media3/common";
// ```
import androidx.media3.common.Player

// What:     `fun platformCommandCodes(...)` returns the player command codes that one connecting controller may
//           use. `isMediaNotificationController` says whether the controller is the one media3 itself creates for the
//           system notification. `offered` is the list of command codes the controller would get by default.
//           `List<Int>` is a read-only list of 32-bit integers (sibling: `MutableList<Int>`, which can be changed in
//           place).
// Why:      media3 publishes the whole playing queue to the platform session whenever the notification
//           controller may read the timeline (`COMMAND_GET_TIMELINE`), and that copy of a 10 000-track queue runs on
//           every track change. Taking only that command away from the notification controller makes media3 publish
//           an empty queue, while playback state, position, duration, metadata and every transport action keep
//           their own commands. Every other controller (an app that connects by itself, a car, a watch) keeps the full
//           offer.
// Gotcha:   Only `COMMAND_GET_TIMELINE` is removed; `COMMAND_GET_CURRENT_MEDIA_ITEM` stays, so the current item's
//           metadata and duration are still published.
//
// In TS you'd write (pseudocode):
// ```ts
// function platformCommandCodes(isMediaNotificationController: boolean, offered: number[]): number[] {
//   if (!isMediaNotificationController) return offered;
//   return offered.filter((code) => code !== Player.COMMAND_GET_TIMELINE);
// }
// ```
/** Returns the command codes [offered] to a controller, minus the timeline read for the notification controller. */
fun platformCommandCodes(isMediaNotificationController: Boolean, offered: List<Int>): List<Int> {
    if (!isMediaNotificationController) {
        return offered
    }
    return offered.filter { code -> code != Player.COMMAND_GET_TIMELINE }
}
