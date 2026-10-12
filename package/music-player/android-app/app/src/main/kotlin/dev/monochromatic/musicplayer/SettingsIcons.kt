// What:     `package dev.monochromatic.musicplayer` places the Settings row icons beside the other player composables.
// Why:      The Settings rows draw one leading icon each without an icon font or the extended icon set.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     Imports from `androidx.compose.ui.graphics` bring in the fill colour and the vector builder helpers.
// Why:      Each icon is one filled path, tinted by the caller.
//
// In TS you'd write (pseudocode):
// ```ts
// import { SolidColor, Color } from "compose/ui/graphics";
// ```
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes

// What:     Imports from `androidx.compose.ui.unit` bring in the density-independent size type and its builder.
// Why:      The icon size is a Dp so it scales with the display density like the other icons.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Dp, dp } from "compose/ui/unit";
// ```
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// What:     `private val SETTINGS_ICON_SIZE: Dp = 24.dp` is the nominal width and height of each icon.
// Why:      Material Symbols are drawn at the 24 px optical size, and the icon sits in a 40 dp circle.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_ICON_SIZE = 24;
// ```
/** Nominal width and height of each Settings icon. */
private val SETTINGS_ICON_SIZE: Dp = 24.dp

// What:     `private const val SETTINGS_ICON_VIEWPORT: Float = 960f` is the coordinate extent of each icon path.
// Why:      The upstream SVGs use `viewBox="0 -960 960 960"`, so their path data lives on a 960 unit grid.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_ICON_VIEWPORT = 960;
// ```
/** Coordinate extent of each icon path on both axes, as the upstream `viewBox` gives it. */
private const val SETTINGS_ICON_VIEWPORT: Float = 960f

// What:     `private val QUEUE_MUSIC_PATH: String` holds the Material Symbols `queue_music` outline.
// Why:      The text is the `d` attribute of
//           `symbols/web/queue_music/materialsymbolsoutlined/queue_music_24px.svg` (weight 400, grade 0, optical
//           size 24, unfilled) from google/material-design-icons at commit 49d4db35df873165d6bd6ba09b063c7dafbac2f4,
//           copied unchanged; Apache 2.0, see `LICENSES/Apache-2.0.txt`.
//
// In TS you'd write (pseudocode):
// ```ts
// const QUEUE_MUSIC_PATH = "<svg path data>";
// ```
/** SVG path data for the `queue_music` icon on the upstream 960 unit grid, whose y axis starts at -960. */
private val QUEUE_MUSIC_PATH: String = listOf(
    "M640-160q-50 0-85-35t-35-85q0-50 35-85t85-35q11 0 21 1.5t19 6.5v-328h200v80H760v360q0 50-35 85t-85 35Z",
    "M120-320v-80h320v80H120Zm0-160v-80h480v80H120Zm0-160v-80h480v80H120Z",
).joinToString(separator = "")

// What:     `private val PLAY_CIRCLE_PATH: String` holds the Material Symbols `play_circle` outline.
// Why:      The text is the `d` attribute of
//           `symbols/web/play_circle/materialsymbolsoutlined/play_circle_24px.svg` (weight 400, grade 0, optical
//           size 24, unfilled) from google/material-design-icons at commit 49d4db35df873165d6bd6ba09b063c7dafbac2f4,
//           copied unchanged; Apache 2.0, see `LICENSES/Apache-2.0.txt`.
//
// In TS you'd write (pseudocode):
// ```ts
// const PLAY_CIRCLE_PATH = "<svg path data>";
// ```
/** SVG path data for the `play_circle` icon on the upstream 960 unit grid, whose y axis starts at -960. */
private val PLAY_CIRCLE_PATH: String = listOf(
    "m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763",
    "q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5",
    "T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z",
).joinToString(separator = "")

// What:     `private fun settingsIcon(name: String, pathData: String): ImageVector` builds one filled icon.
// Why:      Both icons share one size, viewport and fill, and the group shifts the upstream y range of -960 to 0
//           down onto the 0 to 960 viewport, so the path data stays exactly as published.
//
// In TS you'd write (pseudocode):
// ```ts
// function settingsIcon(name: string, pathData: string): ImageVector { ... }
// ```
/** Builds one filled icon from upstream SVG path data whose `viewBox` starts at y = -960. */
private fun settingsIcon(name: String, pathData: String): ImageVector = ImageVector.Builder(
    name = name,
    defaultWidth = SETTINGS_ICON_SIZE,
    defaultHeight = SETTINGS_ICON_SIZE,
    viewportWidth = SETTINGS_ICON_VIEWPORT,
    viewportHeight = SETTINGS_ICON_VIEWPORT,
).addGroup(
    translationY = SETTINGS_ICON_VIEWPORT,
).addPath(
    pathData = addPathNodes(pathData),
    fill = SolidColor(Color.Black),
).clearGroup().build()

// What:     `internal val SETTINGS_TRACK_ROWS_ICON: ImageVector` is the icon of the Track rows template row.
// Why:      D109 picked `queue_music` for the template that shapes the supporting line of a track row.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_TRACK_ROWS_ICON = settingsIcon("Settings.TrackRows", QUEUE_MUSIC_PATH);
// ```
/** Queue-with-note icon of the Track rows template row. */
internal val SETTINGS_TRACK_ROWS_ICON: ImageVector = settingsIcon(
    name = "Settings.TrackRows",
    pathData = QUEUE_MUSIC_PATH,
)

// What:     `internal val SETTINGS_PLAYING_TRACK_ICON: ImageVector` is the icon of the Playing track template row.
// Why:      D109 picked `play_circle` for the template that shapes the line under the playing track's title.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_PLAYING_TRACK_ICON = settingsIcon("Settings.PlayingTrack", PLAY_CIRCLE_PATH);
// ```
/** Circled play triangle icon of the Playing track template row. */
internal val SETTINGS_PLAYING_TRACK_ICON: ImageVector = settingsIcon(
    name = "Settings.PlayingTrack",
    pathData = PLAY_CIRCLE_PATH,
)
