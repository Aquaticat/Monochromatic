// What:     `package dev.monochromatic.musicplayer` places the transport deck beside the other
//           player composables of the app.
// Why:      The deck is a stateless composable that screens import without reaching into
//           MainActivity.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     Imports from `core` bring in the four-state playback mode type.
// Why:      The deck displays and reports the same mode that playback uses.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PlaybackMode } from "core/PlaybackMode";
// ```
import dev.monochromatic.musicplayer.core.PlaybackMode

// What:     Imports from `androidx.compose.foundation` bring in layout, selection, scrolling,
//           system inset, and dark-theme helpers.
// Why:      The deck uses them for its background, seek row, mode group, and safe-area padding.
//
// In TS you'd write (pseudocode):
// ```ts
// import { isSystemInDarkTheme, verticalScroll } from "compose/foundation";
// ```
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemGestures
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll

// What:     Imports from `androidx.compose.material3` bring in Material 3 buttons, text,
//           slider, segmented-button defaults, and the theme accessor.
// Why:      The deck uses Material 3 roles so it follows the app theme.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Slider, Text, OutlinedButton, MaterialTheme } from "material3";
// ```
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember

// What:     Imports from `androidx.compose.ui` bring in modifiers, colors, vectors, text
//           measurement, density, layout direction, and semantics.
// Why:      The mode control measures labels and publishes radio semantics for each segment.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier, Color, Density, LayoutDirection } from "compose/ui";
// ```
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.LayoutDirection

// What:     `private val DECK_VERTICAL_PADDING: Dp = 16.dp` names the deck's outer vertical inset.
// Why:      The accepted deck keeps 16dp above the heading and below the mode control.
//
// In TS you'd write (pseudocode):
// ```ts
// const DECK_VERTICAL_PADDING = 16;
// ```
/** Outer vertical inset above the heading and below the mode control. */
private val DECK_VERTICAL_PADDING: Dp = 16.dp

// What:     `private val DECK_GROUP_SPACING: Dp = 8.dp` names the gap between deck groups.
// Why:      The accepted cover deck uses 8dp between heading, seek, transport, and mode groups.
//
// In TS you'd write (pseudocode):
// ```ts
// const DECK_GROUP_SPACING = 8;
// ```
/** Vertical gap between the heading, seek row, transport row, and mode control. */
private val DECK_GROUP_SPACING: Dp = 8.dp

// What:     `private val CONTROL_SPACING: Dp = 8.dp` names the horizontal gap in seek and transport rows.
// Why:      The accepted deck spaces time labels, slider, and transport buttons at 8dp.
//
// In TS you'd write (pseudocode):
// ```ts
// const CONTROL_SPACING = 8;
// ```
/** Horizontal gap between time labels, the slider, and transport buttons. */
private val CONTROL_SPACING: Dp = 8.dp

// What:     `private val MIN_TARGET: Dp = 48.dp` names the minimum touch target of each segment.
// Why:      Every mode segment keeps a 48dp minimum target at every layout.
//
// In TS you'd write (pseudocode):
// ```ts
// const MIN_TARGET = 48;
// ```
/** Minimum width and height of one mode segment touch target. */
private val MIN_TARGET: Dp = 48.dp

// What:     `private val SEGMENT_OVERLAP: Dp = (-1).dp` shares one hairline between adjacent segments.
// Why:      Connected segments overlap by one dp so the outlines read as one control.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEGMENT_OVERLAP = -1;
// ```
/** Negative spacing that makes adjacent segment outlines share one edge. */
private val SEGMENT_OVERLAP: Dp = (-1).dp

// What:     `private val SEGMENT_OUTER_RADIUS: Dp = 20.dp` rounds only the outside corners.
// Why:      Multi-row layouts keep internal edges square so the group reads as one control.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEGMENT_OUTER_RADIUS = 20;
// ```
/** Corner radius applied only to the outside corners of a multi-row mode group. */
private val SEGMENT_OUTER_RADIUS: Dp = 20.dp

// What:     `private val ONE_ROW_MIN_WIDTH: Dp = 189.dp` is the narrowest width of one row.
// Why:      Four 48dp targets less three shared edges keep every segment at its minimum target.
//
// In TS you'd write (pseudocode):
// ```ts
// const ONE_ROW_MIN_WIDTH = 4 * 48 - 3;
// ```
/** Width floor below which the mode control stops using one row. */
private val ONE_ROW_MIN_WIDTH: Dp = 189.dp

// What:     `private val TWO_ROW_MIN_WIDTH: Dp = 95.dp` is the narrowest width of two rows.
// Why:      Two 48dp targets less one shared edge keep each row segment at its minimum target.
//
// In TS you'd write (pseudocode):
// ```ts
// const TWO_ROW_MIN_WIDTH = 2 * 48 - 1;
// ```
/** Width floor below which the mode control stops using two rows. */
private val TWO_ROW_MIN_WIDTH: Dp = 95.dp

// What:     `private val SEGMENT_ICON_END_SPACING: Dp = 8.dp` separates the check mark from its label.
// Why:      The selected segment keeps its check mark visually attached to the label.
//
// In TS you'd write (pseudocode):
// ```ts
// const SEGMENT_ICON_END_SPACING = 8;
// ```
/** Gap between the check mark and the label of the selected segment. */
private val SEGMENT_ICON_END_SPACING: Dp = 8.dp

// What:     `private val ICON_SIZE: Dp = 24.dp` is the nominal size of each transport glyph.
// Why:      The drawn glyphs use the same 24dp grid as the Material icon set they replace.
//
// In TS you'd write (pseudocode):
// ```ts
// const ICON_SIZE = 24;
// ```
/** Nominal width and height of each drawn transport glyph. */
private val ICON_SIZE: Dp = 24.dp

// What:     `private const val ICON_VIEWPORT: Float = 24f` is the coordinate space of each glyph path.
// Why:      Path data is written on a 24 by 24 grid so it scales with `ICON_SIZE`.
//
// In TS you'd write (pseudocode):
// ```ts
// const ICON_VIEWPORT = 24;
// ```
/** Coordinate extent of each glyph path on both axes. */
private const val ICON_VIEWPORT: Float = 24f

// What:     `private const val SECONDS_PER_MINUTE: Long = 60L` converts whole seconds to minutes.
// Why:      The time labels print `m:ss` from a whole-second count.
//
// In TS you'd write (pseudocode):
// ```ts
// const SECONDS_PER_MINUTE = 60;
// ```
/** Number of seconds in one minute for the clock label. */
private const val SECONDS_PER_MINUTE: Long = 60L

// What:     `private val DECK_FIXED_DARK_CONTAINER: Color = Color(0xFF0A0A0D)` is the fixed dark deck.
// Why:      The accepted dark deck stays one neutral regardless of wallpaper-generated colors.
//
// In TS you'd write (pseudocode):
// ```ts
// const DECK_FIXED_DARK_CONTAINER = 0xff0a0a0d;
// ```
/** Fixed neutral ground of the deck in dark mode. */
private val DECK_FIXED_DARK_CONTAINER: Color = Color(0xFF0A0A0D)

// What:     `private const val SHUFFLE_PREFIX: String = "Shuffle "` is the fixed label prefix.
// Why:      The folder name follows a stable prefix so the verb stays visible when the name truncates.
//
// In TS you'd write (pseudocode):
// ```ts
// const SHUFFLE_PREFIX = "Shuffle ";
// ```
/** Fixed text before the folder name in the shuffle-folder segment. */
private const val SHUFFLE_PREFIX: String = "Shuffle "

// What:     `private const val SHUFFLE_WIDTH_REFERENCE: String = "Camellia"` sets the width cap.
// Why:      Long folder names truncate to the rendered width of this reference name.
//
// In TS you'd write (pseudocode):
// ```ts
// const SHUFFLE_WIDTH_REFERENCE = "Camellia";
// ```
/** Reference folder name whose rendered width caps the shuffle-folder text. */
private const val SHUFFLE_WIDTH_REFERENCE: String = "Camellia"

// What:     `private const val CHECK_PATH: String` holds the check mark outline.
// Why:      The check mark appears on the selected segment without an extended icon dependency.
//
// In TS you'd write (pseudocode):
// ```ts
// const CHECK_PATH = "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z";
// ```
/** SVG path data for the check mark on a 24 by 24 grid. */
private const val CHECK_PATH: String = "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"

// What:     `private const val PLAY_PATH: String` holds the play triangle outline.
// Why:      The play button shows this glyph while playback is paused.
//
// In TS you'd write (pseudocode):
// ```ts
// const PLAY_PATH = "M8 5v14l11-7z";
// ```
/** SVG path data for the play triangle on a 24 by 24 grid. */
private const val PLAY_PATH: String = "M8 5v14l11-7z"

// What:     `private const val PAUSE_PATH: String` holds the two pause bars.
// Why:      The pause button shows this glyph while playback is running.
//
// In TS you'd write (pseudocode):
// ```ts
// const PAUSE_PATH = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";
// ```
/** SVG path data for the two pause bars on a 24 by 24 grid. */
private const val PAUSE_PATH: String = "M6 19h4V5H6v14zm8-14v14h4V5h-4z"

// What:     `private const val SKIP_PREVIOUS_PATH: String` holds the previous-track glyph.
// Why:      The previous button uses a bar and a left-pointing triangle.
//
// In TS you'd write (pseudocode):
// ```ts
// const SKIP_PREVIOUS_PATH = "M6 6h2v12H6zM9.5 12l8.5 6V6z";
// ```
/** SVG path data for the previous-track glyph on a 24 by 24 grid. */
private const val SKIP_PREVIOUS_PATH: String = "M6 6h2v12H6zM9.5 12l8.5 6V6z"

// What:     `private const val SKIP_NEXT_PATH: String` holds the next-track glyph.
// Why:      The next button uses a right-pointing triangle and a bar.
//
// In TS you'd write (pseudocode):
// ```ts
// const SKIP_NEXT_PATH = "M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z";
// ```
/** SVG path data for the next-track glyph on a 24 by 24 grid. */
private const val SKIP_NEXT_PATH: String = "M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"

// What:     `data class TransportDeckModel(...)` is the immutable state the deck displays.
// Why:      The caller owns playback state and passes one snapshot per frame.
//
// In TS you'd write (pseudocode):
// ```ts
// type TransportDeckModel = { title: string; subtitle: string; positionSec: number;
//   durationSec: number; playing: boolean; mode: PlaybackMode; shuffleFolderLabel: string };
// ```
/** Snapshot of playback state rendered by [transportDeck]. */
data class TransportDeckModel(
    // What:     `val title: String` is the playing track title.
    // Why:      The heading names the track the deck controls.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // title: string;
    // ```
    /** Title of the playing track shown in the heading. */
    val title: String,
    // What:     `val subtitle: String` is the preformatted line under the title.
    // Why:      The caller formats the position and loudness text, so the deck draws it unchanged.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // subtitle: string;
    // ```
    /** Preformatted line drawn under the title, such as the track index and true peak. */
    val subtitle: String,
    // What:     `val positionSec: Double` is the playhead in seconds.
    // Why:      The seek row shows the elapsed time and the slider position from it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // positionSec: number;
    // ```
    /** Current playhead position in seconds. */
    val positionSec: Double,
    // What:     `val durationSec: Double` is the track length in seconds.
    // Why:      The seek row shows the total time and scales slider fractions to seconds.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // durationSec: number;
    // ```
    /** Total track length in seconds. */
    val durationSec: Double,
    // What:     `val playing: Boolean` records whether playback is running.
    // Why:      The center button shows pause while playing and play while paused.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // playing: boolean;
    // ```
    /** True while playback is running. */
    val playing: Boolean,
    // What:     `val mode: PlaybackMode` is the selected playback mode.
    // Why:      The mode control marks exactly one segment as selected.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // mode: PlaybackMode;
    // ```
    /** Playback mode whose segment is marked selected. */
    val mode: PlaybackMode,
    // What:     `val shuffleFolderLabel: String` is the folder name shown in the shuffle segment.
    // Why:      The shuffle-folder segment names the folder that shuffling is scoped to.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // shuffleFolderLabel: string;
    // ```
    /** Folder name shown after the shuffle prefix in the shuffle-folder segment. */
    val shuffleFolderLabel: String,
)

// What:     `data class TransportDeckActions(...)` bundles the callbacks the deck reports through.
// Why:      The deck never mutates playback itself; the caller decides what each action does.
//
// In TS you'd write (pseudocode):
// ```ts
// type TransportDeckActions = { onSeek(sec: number): void; onPrevious(): void;
//   onTogglePlay(): void; onNext(): void; onSelectMode(mode: PlaybackMode): void };
// ```
/** Callbacks the deck invokes when the user acts on it. */
data class TransportDeckActions(
    // What:     `val onSeek: (Double) -> Unit` receives an absolute target position.
    // Why:      The slider reports a fraction that the deck converts to seconds before calling it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // onSeek: (positionSec: number) => void;
    // ```
    /** Requests a seek to an absolute position in seconds. */
    val onSeek: (Double) -> Unit,
    // What:     `val onPrevious: () -> Unit` reports the previous-track button.
    // Why:      The caller decides which track precedes the playing one.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // onPrevious: () => void;
    // ```
    /** Requests the previous track. */
    val onPrevious: () -> Unit,
    // What:     `val onTogglePlay: () -> Unit` reports the center play or pause button.
    // Why:      The caller owns the playback state and decides whether to play or pause.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // onTogglePlay: () => void;
    // ```
    /** Requests a play or pause toggle. */
    val onTogglePlay: () -> Unit,
    // What:     `val onNext: () -> Unit` reports the next-track button.
    // Why:      The caller decides which track follows the playing one.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // onNext: () => void;
    // ```
    /** Requests the next track. */
    val onNext: () -> Unit,
    // What:     `val onSelectMode: (PlaybackMode) -> Unit` reports a mode-segment selection.
    // Why:      The caller persists the mode, so the deck only reports the choice.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // onSelectMode: (mode: PlaybackMode) => void;
    // ```
    /** Requests selection of one playback mode. */
    val onSelectMode: (PlaybackMode) -> Unit,
)

// What:     `internal enum class ModeControlLayout` names the three arrangements of the mode control.
// Why:      A pure function can choose the arrangement and tests can assert the choice without Compose.
//
// In TS you'd write (pseudocode):
// ```ts
// type ModeControlLayout = "one-row" | "two-row" | "four-row";
// ```
/** Arrangements the mode control can take, from fewest rows to most rows. */
internal enum class ModeControlLayout {
    // What:     `ONE_ROW` is the single connected row with intrinsic segment widths.
    // Why:      It is the first choice when every full label fits at the current width.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const oneRow = "one-row";
    // ```
    /** One connected row of four segments with intrinsic widths. */
    ONE_ROW,

    // What:     `TWO_ROW` is the connected two-by-two block.
    // Why:      It is the second choice when labels fit two per row but not one row.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const twoRow = "two-row";
    // ```
    /** Two connected rows of two segments each. */
    TWO_ROW,

    // What:     `FOUR_ROW` is the connected vertical stack of four segments.
    // Why:      It is the final fallback when even two segments cannot share a row.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const fourRow = "four-row";
    // ```
    /** Four connected rows of one segment each. */
    FOUR_ROW,
}

// What:     `internal fun modeControlLayoutFor(...)` chooses the arrangement from width and overflow.
// Why:      The thresholds and overflow fallbacks are testable without a Compose runtime.
//
// In TS you'd write (pseudocode):
// ```ts
// function modeControlLayoutFor(widthDp: number, oneRowOverflowed: boolean,
//   twoRowOverflowed: boolean): ModeControlLayout { ... }
// ```
/**
 * Picks the fewest connected rows that fit, honoring text overflow reported by earlier layouts.
 *
 * @param widthDp available width of mode control
 * @param oneRowOverflowed true when one row previously clipped a label at this width
 * @param twoRowOverflowed true when two rows previously clipped a label at this width
 * @return arrangement to draw
 */
internal fun modeControlLayoutFor(
    widthDp: Dp,
    oneRowOverflowed: Boolean,
    twoRowOverflowed: Boolean,
): ModeControlLayout {
    if (widthDp >= ONE_ROW_MIN_WIDTH && !oneRowOverflowed) {
        return ModeControlLayout.ONE_ROW
    }
    if (widthDp >= TWO_ROW_MIN_WIDTH && !twoRowOverflowed) {
        return ModeControlLayout.TWO_ROW
    }
    return ModeControlLayout.FOUR_ROW
}

// What:     `private val MODE_SEGMENT_ORDER: List<PlaybackMode>` fixes the left-to-right segment order.
// Why:      Segment position drives the connected corner shapes and the traversal order.
//
// In TS you'd write (pseudocode):
// ```ts
// const MODE_SEGMENT_ORDER: readonly PlaybackMode[] =
//   ["repeat", "in_order", "shuffle_page", "shuffle_all"];
// ```
/** Left-to-right order of the four mode segments. */
private val MODE_SEGMENT_ORDER: List<PlaybackMode> = listOf(
    PlaybackMode.REPEAT,
    PlaybackMode.IN_ORDER,
    PlaybackMode.SHUFFLE_PAGE,
    PlaybackMode.SHUFFLE_ALL,
)

// What:     `internal fun modeLabelFor(...)` maps one playback mode to its visible label.
// Why:      Visible labels are fixed except the folder name, which the caller supplies.
//
// In TS you'd write (pseudocode):
// ```ts
// function modeLabelFor(mode: PlaybackMode, folder: string): string { ... }
// ```
/** Returns the visible segment text for one playback mode. */
internal fun modeLabelFor(mode: PlaybackMode, shuffleFolderLabel: String): String = when (mode) {
    PlaybackMode.REPEAT -> "Repeat"
    PlaybackMode.IN_ORDER -> "In order"
    PlaybackMode.SHUFFLE_PAGE -> SHUFFLE_PREFIX + shuffleFolderLabel
    PlaybackMode.SHUFFLE_ALL -> "Shuffle all"
}

// What:     `internal fun modeAccessibleLabelFor(...)` maps one playback mode to its spoken label.
// Why:      Screen readers hear fuller phrases than the compact visible labels show.
//
// In TS you'd write (pseudocode):
// ```ts
// function modeAccessibleLabelFor(mode: PlaybackMode, folder: string): string { ... }
// ```
/** Returns the spoken description for one playback mode segment. */
internal fun modeAccessibleLabelFor(mode: PlaybackMode, shuffleFolderLabel: String): String =
    when (mode) {
        PlaybackMode.REPEAT -> "Repeat track"
        PlaybackMode.IN_ORDER -> "Play in order"
        PlaybackMode.SHUFFLE_PAGE -> SHUFFLE_PREFIX + shuffleFolderLabel
        PlaybackMode.SHUFFLE_ALL -> "Shuffle all folders"
    }

// What:     `internal fun deckClockLabel(...)` formats whole seconds as `m:ss`.
// Why:      The seek row shows elapsed and total time in one fixed, locale-independent form.
//
// In TS you'd write (pseudocode):
// ```ts
// function deckClockLabel(seconds: number): string {
//   const total = Math.max(0, Math.trunc(seconds));
//   return `${Math.trunc(total / 60)}:${String(total % 60).padStart(2, "0")}`;
// }
// ```
/** Formats a non-negative duration in seconds as minutes and two-digit seconds. */
internal fun deckClockLabel(seconds: Double): String {
    /** Whole seconds with negatives and NaN clamped to zero. */
    val total: Long = seconds.toLong().coerceAtLeast(0L)
    /** Whole minutes in the duration. */
    val minutes: Long = total / SECONDS_PER_MINUTE
    /** Seconds left after whole minutes are removed. */
    val remainder: Long = total % SECONDS_PER_MINUTE
    return "$minutes:${remainder.toString().padStart(2, '0')}"
}

// What:     `internal fun progressFractionFor(...)` converts a position into a slider fraction.
// Why:      The slider needs a value in 0 to 1 even when the duration is zero or unknown.
//
// In TS you'd write (pseudocode):
// ```ts
// function progressFractionFor(positionSec: number, durationSec: number): number {
//   if (!(durationSec > 0)) return 0;
//   return Math.min(1, Math.max(0, positionSec / durationSec));
// }
// ```
/** Returns the playhead as a fraction of the track in the closed range zero to one. */
internal fun progressFractionFor(positionSec: Double, durationSec: Double): Float {
    if (durationSec <= 0.0) {
        return 0f
    }
    /** Raw position divided by duration before clamping. */
    val fraction: Float = (positionSec / durationSec).toFloat()
    if (fraction.isNaN()) {
        return 0f
    }
    return fraction.coerceIn(0f, 1f)
}

// What:     `private fun deckIcon(...)` builds one 24dp glyph from a single path string.
// Why:      The check, play, pause, and skip glyphs need no extended icon artifact in production.
//
// In TS you'd write (pseudocode):
// ```ts
// function deckIcon(name: string, pathData: string): ImageVector { ... }
// ```
/** Builds one filled glyph from SVG path data on the shared 24 by 24 grid. */
private fun deckIcon(name: String, pathData: String): ImageVector = ImageVector.Builder(
    name = name,
    defaultWidth = ICON_SIZE,
    defaultHeight = ICON_SIZE,
    viewportWidth = ICON_VIEWPORT,
    viewportHeight = ICON_VIEWPORT,
).addPath(
    pathData = addPathNodes(pathData),
    fill = SolidColor(Color.Black),
).build()

// What:     `private val CHECK_ICON: ImageVector` is the check mark on the selected segment.
// Why:      Selection needs a second visual channel besides the container fill.
//
// In TS you'd write (pseudocode):
// ```ts
// const CHECK_ICON = deckIcon("Check", CHECK_PATH);
// ```
/** Check mark drawn on the selected mode segment. */
private val CHECK_ICON: ImageVector = deckIcon(name = "Deck.Check", pathData = CHECK_PATH)

// What:     `private val PLAY_ICON: ImageVector` is the play glyph.
// Why:      The center button shows play while playback is paused.
//
// In TS you'd write (pseudocode):
// ```ts
// const PLAY_ICON = deckIcon("PlayArrow", PLAY_PATH);
// ```
/** Play glyph shown on the center button while paused. */
private val PLAY_ICON: ImageVector = deckIcon(name = "Deck.PlayArrow", pathData = PLAY_PATH)

// What:     `private val PAUSE_ICON: ImageVector` is the pause glyph.
// Why:      The center button shows pause while playback is running.
//
// In TS you'd write (pseudocode):
// ```ts
// const PAUSE_ICON = deckIcon("Pause", PAUSE_PATH);
// ```
/** Pause glyph shown on the center button while playing. */
private val PAUSE_ICON: ImageVector = deckIcon(name = "Deck.Pause", pathData = PAUSE_PATH)

// What:     `private val SKIP_PREVIOUS_ICON: ImageVector` is the previous-track glyph.
// Why:      The previous button identifies the backward transport action.
//
// In TS you'd write (pseudocode):
// ```ts
// const SKIP_PREVIOUS_ICON = deckIcon("SkipPrevious", SKIP_PREVIOUS_PATH);
// ```
/** Previous-track glyph on the left transport button. */
private val SKIP_PREVIOUS_ICON: ImageVector =
    deckIcon(name = "Deck.SkipPrevious", pathData = SKIP_PREVIOUS_PATH)

// What:     `private val SKIP_NEXT_ICON: ImageVector` is the next-track glyph.
// Why:      The next button identifies the forward transport action.
//
// In TS you'd write (pseudocode):
// ```ts
// const SKIP_NEXT_ICON = deckIcon("SkipNext", SKIP_NEXT_PATH);
// ```
/** Next-track glyph on the right transport button. */
private val SKIP_NEXT_ICON: ImageVector = deckIcon(name = "Deck.SkipNext", pathData = SKIP_NEXT_PATH)

// What:     `@Composable private fun deckContainerColor()` picks the deck ground for the appearance.
// Why:      Dark mode keeps the fixed neutral deck, while light mode uses the Material surface role.
//
// In TS you'd write (pseudocode):
// ```ts
// function deckContainerColor(): Color {
//   return isSystemInDarkTheme() ? DECK_FIXED_DARK_CONTAINER : scheme.surfaceContainerLow;
// }
// ```
/** Resolves the deck background from the system appearance. */
@Composable
private fun deckContainerColor(): Color {
    /** Records whether the system is in dark mode. */
    val dark: Boolean = isSystemInDarkTheme()
    if (dark) {
        return DECK_FIXED_DARK_CONTAINER
    }
    return MaterialTheme.colorScheme.surfaceContainerLow
}

// What:     `@Composable private fun deckHeading(...)` draws the centered title and subtitle.
// Why:      The heading names the playing track and the caller's preformatted status line.
//
// In TS you'd write (pseudocode):
// ```ts
// function deckHeading(props: { title: string; subtitle: string }): UIElement;
// ```
/** Draws the centered playing title above the preformatted subtitle. */
@Composable
private fun deckHeading(title: String, subtitle: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = title, style = MaterialTheme.typography.titleMedium)
        Text(
            text = subtitle,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

// What:     `@Composable private fun seekRow(...)` draws elapsed time, a slider, and total time.
// Why:      The slider reports a fraction that becomes an absolute position in seconds.
//
// In TS you'd write (pseudocode):
// ```ts
// function seekRow(props: { positionSec: number; durationSec: number;
//   onSeek(sec: number): void }): UIElement;
// ```
/** Draws the seek row with the slider converting its fraction into seconds. */
@Composable
private fun seekRow(positionSec: Double, durationSec: Double, onSeek: (Double) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(CONTROL_SPACING),
    ) {
        /** Tabular-figure style so the clock digits do not shift width while playing. */
        val timeStyle = MaterialTheme.typography.labelMedium.copy(fontFeatureSettings = "tnum")
        Text(
            text = deckClockLabel(positionSec),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = timeStyle,
        )
        Slider(
            value = progressFractionFor(positionSec, durationSec),
            onValueChange = { fraction -> onSeek(fraction.toDouble() * durationSec) },
            modifier = Modifier
                .weight(1f)
                .semantics {
                    contentDescription = "Track position"
                },
        )
        Text(
            text = deckClockLabel(durationSec),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = timeStyle,
        )
    }
}

// What:     `@Composable private fun secondaryTransportButton(...)` draws one outlined skip button.
// Why:      Skip actions use the accepted outlined treatment, which carries less emphasis than play.
//
// In TS you'd write (pseudocode):
// ```ts
// function secondaryTransportButton(props: { icon: ImageVector; label: string;
//   onClick(): void }): UIElement;
// ```
/** Draws one outlined icon button for a skip action. */
@Composable
private fun secondaryTransportButton(
    imageVector: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
) {
    OutlinedIconButton(onClick = onClick) {
        Icon(imageVector = imageVector, contentDescription = contentDescription)
    }
}

// What:     `@Composable private fun transportControls(...)` draws previous, play or pause, and next.
// Why:      The filled center button carries the strongest emphasis of the three transport actions.
//
// In TS you'd write (pseudocode):
// ```ts
// function transportControls(props: { playing: boolean; onPrevious(): void;
//   onTogglePlay(): void; onNext(): void }): UIElement;
// ```
/** Draws the three transport buttons centered in one row. */
@Composable
private fun transportControls(
    playing: Boolean,
    onPrevious: () -> Unit,
    onTogglePlay: () -> Unit,
    onNext: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(CONTROL_SPACING, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        secondaryTransportButton(
            imageVector = SKIP_PREVIOUS_ICON,
            contentDescription = "Previous track",
            onClick = onPrevious,
        )
        FilledIconButton(onClick = onTogglePlay) {
            Icon(
                imageVector = if (playing) PAUSE_ICON else PLAY_ICON,
                contentDescription = if (playing) "Pause" else "Play",
            )
        }
        secondaryTransportButton(
            imageVector = SKIP_NEXT_ICON,
            contentDescription = "Next track",
            onClick = onNext,
        )
    }
}

// What:     `@Composable private fun shuffleModeLabel(...)` draws `Shuffle ` and a capped folder name.
// Why:      Long names keep the verb and useful characters without widening the segment beyond
//           the reference name.
//
// In TS you'd write (pseudocode):
// ```ts
// function shuffleModeLabel(props: { folderName: string; onUnexpectedOverflow(): void }): UIElement;
// ```
/** Draws the shuffle-folder label, truncating the folder name in the middle when it is too wide. */
@Composable
private fun shuffleModeLabel(folderName: String, onUnexpectedOverflow: () -> Unit) {
    /** Label text style shared by the prefix and the folder name. */
    val textStyle = MaterialTheme.typography.labelLarge
    /** Text measurer retained across redraws so measurement does not allocate per frame. */
    val textMeasurer = rememberTextMeasurer()
    /** Density used to convert measured pixel widths to Dp. */
    val density = LocalDensity.current
    /** Pixel width of the reference name, which caps the folder text. */
    val maximumFolderWidthPixels: Int = remember(textMeasurer, textStyle) {
        textMeasurer.measure(text = SHUFFLE_WIDTH_REFERENCE, style = textStyle).size.width
    }
    /** Pixel width of the full folder name before any cap. */
    val naturalFolderWidthPixels: Int = remember(folderName, textMeasurer, textStyle) {
        textMeasurer.measure(text = folderName, style = textStyle).size.width
    }
    /** Folder text width in pixels after applying the cap. */
    val desiredFolderWidthPixels: Int = minOf(naturalFolderWidthPixels, maximumFolderWidthPixels)
    /** Folder text width converted to Dp for the layout modifier. */
    val desiredFolderWidth: Dp = with(density) {
        desiredFolderWidthPixels.toDp()
    }
    Row(
        modifier = Modifier.clearAndSetSemantics {},
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = SHUFFLE_PREFIX,
            maxLines = 1,
            overflow = TextOverflow.Clip,
            style = textStyle,
            onTextLayout = { result ->
                if (result.hasVisualOverflow) {
                    onUnexpectedOverflow()
                }
            },
        )
        Text(
            text = folderName,
            modifier = Modifier.width(desiredFolderWidth),
            maxLines = 1,
            overflow = TextOverflow.MiddleEllipsis,
            style = textStyle,
            onTextLayout = { result ->
                if (result.size.width < desiredFolderWidthPixels) {
                    onUnexpectedOverflow()
                }
            },
        )
    }
}

// What:     `@Composable private fun variableWidthModeSegment(...)` draws one connected segment.
// Why:      Each segment sizes to its own label, so unequal labels can share one row.
//
// In TS you'd write (pseudocode):
// ```ts
// function variableWidthModeSegment(props: { mode: PlaybackMode; selected: PlaybackMode;
//   shuffleFolderLabel: string; shape: Shape; onSelect(m: PlaybackMode): void;
//   onOverflow(): void }): UIElement;
// ```
/** Draws one radio-style mode segment with a 48dp minimum target. */
@Composable
private fun variableWidthModeSegment(
    mode: PlaybackMode,
    selectedMode: PlaybackMode,
    shuffleFolderLabel: String,
    shape: Shape,
    modifier: Modifier,
    contentPadding: PaddingValues,
    onSelectMode: (PlaybackMode) -> Unit,
    onOverflow: () -> Unit,
) {
    /** True when this segment is the playback mode in effect. */
    val isSelected: Boolean = mode == selectedMode
    /** Selected segments take the secondary container fill, others stay transparent. */
    val containerColor: Color = if (isSelected) {
        MaterialTheme.colorScheme.secondaryContainer
    } else {
        Color.Transparent
    }
    /** Text color paired with the container fill. */
    val contentColor: Color = if (isSelected) {
        MaterialTheme.colorScheme.onSecondaryContainer
    } else {
        MaterialTheme.colorScheme.onSurface
    }
    OutlinedButton(
        onClick = { onSelectMode(mode) },
        shape = shape,
        modifier = modifier
            .defaultMinSize(minWidth = MIN_TARGET, minHeight = MIN_TARGET)
            .semantics {
                contentDescription = modeAccessibleLabelFor(mode, shuffleFolderLabel)
                role = Role.RadioButton
                selected = isSelected
                traversalIndex = MODE_SEGMENT_ORDER.indexOf(mode).toFloat()
            },
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = contentColor,
        ),
        border = BorderStroke(
            width = SegmentedButtonDefaults.BorderWidth,
            color = MaterialTheme.colorScheme.outline,
        ),
        contentPadding = contentPadding,
    ) {
        if (isSelected) {
            Icon(
                imageVector = CHECK_ICON,
                contentDescription = null,
                modifier = Modifier
                    .padding(end = SEGMENT_ICON_END_SPACING)
                    .size(SegmentedButtonDefaults.IconSize),
            )
        }
        if (mode == PlaybackMode.SHUFFLE_PAGE) {
            shuffleModeLabel(
                folderName = shuffleFolderLabel,
                onUnexpectedOverflow = onOverflow,
            )
        } else {
            Text(
                text = modeLabelFor(mode, shuffleFolderLabel),
                modifier = Modifier.clearAndSetSemantics {},
                maxLines = 1,
                overflow = TextOverflow.Clip,
                onTextLayout = { result ->
                    if (result.hasVisualOverflow) {
                        onOverflow()
                    }
                },
            )
        }
    }
}

// What:     `@Composable private fun oneRowModeControl(...)` lays four segments in one row.
// Why:      Intrinsic widths keep one row as the first fitting arrangement.
//
// In TS you'd write (pseudocode):
// ```ts
// function oneRowModeControl(props: ModeControlProps): UIElement;
// ```
/** Draws the four mode segments as one connected horizontal group. */
@Composable
private fun oneRowModeControl(
    selectedMode: PlaybackMode,
    shuffleFolderLabel: String,
    contentPadding: PaddingValues,
    onSelectMode: (PlaybackMode) -> Unit,
    onOverflow: () -> Unit,
) {
    Row(
        modifier = Modifier.selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(SEGMENT_OVERLAP),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MODE_SEGMENT_ORDER.forEachIndexed { index, mode ->
            variableWidthModeSegment(
                mode = mode,
                selectedMode = selectedMode,
                shuffleFolderLabel = shuffleFolderLabel,
                shape = SegmentedButtonDefaults.itemShape(index = index, count = MODE_SEGMENT_ORDER.size),
                modifier = Modifier,
                contentPadding = contentPadding,
                onSelectMode = onSelectMode,
                onOverflow = onOverflow,
            )
        }
    }
}

// What:     `@Composable private fun twoRowModeControl(...)` lays four segments in a 2 by 2 block.
// Why:      Enlarged labels fit two per row before the control falls back to four rows.
//
// In TS you'd write (pseudocode):
// ```ts
// function twoRowModeControl(props: ModeControlProps): UIElement;
// ```
/** Draws the four mode segments as a connected two-by-two block. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun twoRowModeControl(
    selectedMode: PlaybackMode,
    shuffleFolderLabel: String,
    contentPadding: PaddingValues,
    onSelectMode: (PlaybackMode) -> Unit,
    onOverflow: () -> Unit,
) {
    FlowRow(
        modifier = Modifier
            .fillMaxWidth()
            .selectableGroup(),
        maxItemsInEachRow = 2,
        horizontalArrangement = Arrangement.spacedBy(SEGMENT_OVERLAP),
        verticalArrangement = Arrangement.spacedBy(SEGMENT_OVERLAP),
    ) {
        MODE_SEGMENT_ORDER.forEachIndexed { index, mode ->
            /** Outside corner shape for this grid position, with internal corners square. */
            val shape: Shape = when (index) {
                0 -> RoundedCornerShape(topStart = SEGMENT_OUTER_RADIUS)
                1 -> RoundedCornerShape(topEnd = SEGMENT_OUTER_RADIUS)
                2 -> RoundedCornerShape(bottomStart = SEGMENT_OUTER_RADIUS)
                else -> RoundedCornerShape(bottomEnd = SEGMENT_OUTER_RADIUS)
            }
            variableWidthModeSegment(
                mode = mode,
                selectedMode = selectedMode,
                shuffleFolderLabel = shuffleFolderLabel,
                shape = shape,
                modifier = Modifier.weight(1f),
                contentPadding = contentPadding,
                onSelectMode = onSelectMode,
                onOverflow = onOverflow,
            )
        }
    }
}

// What:     `@Composable private fun fourRowModeControl(...)` stacks four segments vertically.
// Why:      This final fallback keeps full labels when even two segments cannot share a row.
//
// In TS you'd write (pseudocode):
// ```ts
// function fourRowModeControl(props: ModeControlProps): UIElement;
// ```
/** Draws the four mode segments as one connected vertical stack. */
@Composable
private fun fourRowModeControl(
    selectedMode: PlaybackMode,
    shuffleFolderLabel: String,
    contentPadding: PaddingValues,
    onSelectMode: (PlaybackMode) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .selectableGroup(),
        verticalArrangement = Arrangement.spacedBy(SEGMENT_OVERLAP),
    ) {
        MODE_SEGMENT_ORDER.forEachIndexed { index, mode ->
            /** Only the top and bottom stack positions round their outside corners. */
            val shape: Shape = when (index) {
                0 -> RoundedCornerShape(topStart = SEGMENT_OUTER_RADIUS, topEnd = SEGMENT_OUTER_RADIUS)
                MODE_SEGMENT_ORDER.lastIndex -> RoundedCornerShape(
                    bottomStart = SEGMENT_OUTER_RADIUS,
                    bottomEnd = SEGMENT_OUTER_RADIUS,
                )
                else -> RectangleShape
            }
            variableWidthModeSegment(
                mode = mode,
                selectedMode = selectedMode,
                shuffleFolderLabel = shuffleFolderLabel,
                shape = shape,
                modifier = Modifier.fillMaxWidth(),
                contentPadding = contentPadding,
                onSelectMode = onSelectMode,
                onOverflow = {},
            )
        }
    }
}

// What:     `@Composable private fun modeControl(...)` measures width and picks one of three layouts.
// Why:      The control uses the fewest rows that fit, and text that clips at one width moves the
//           control to the next arrangement.
//
// In TS you'd write (pseudocode):
// ```ts
// function modeControl(props: ModeControlProps & { modifier: Modifier }): UIElement;
// ```
/** Chooses the mode-control arrangement from the available width and recorded text overflow. */
@Composable
private fun modeControl(
    selectedMode: PlaybackMode,
    shuffleFolderLabel: String,
    onSelectMode: (PlaybackMode) -> Unit,
    modifier: Modifier,
) {
    /** Density whose font scale resets the overflow flags when the user changes text size. */
    val density = LocalDensity.current
    /** Standard padding that keeps each segment at its minimum horizontal content width. */
    val contentPadding: PaddingValues = SegmentedButtonDefaults.ContentPadding
    BoxWithConstraints(
        modifier = modifier,
        contentAlignment = Alignment.Center,
    ) {
        /** True when one row clipped a label at this width and font scale. */
        val oneRowOverflow = remember(maxWidth, density.fontScale) { mutableStateOf(false) }
        /** True when two rows clipped a label at this width and font scale. */
        val twoRowOverflow = remember(maxWidth, density.fontScale) { mutableStateOf(false) }
        /** Arrangement chosen for the current width and recorded overflow. */
        val layout: ModeControlLayout = modeControlLayoutFor(
            widthDp = maxWidth,
            oneRowOverflowed = oneRowOverflow.value,
            twoRowOverflowed = twoRowOverflow.value,
        )
        when (layout) {
            ModeControlLayout.ONE_ROW -> oneRowModeControl(
                selectedMode = selectedMode,
                shuffleFolderLabel = shuffleFolderLabel,
                contentPadding = contentPadding,
                onSelectMode = onSelectMode,
                onOverflow = { oneRowOverflow.value = true },
            )
            ModeControlLayout.TWO_ROW -> twoRowModeControl(
                selectedMode = selectedMode,
                shuffleFolderLabel = shuffleFolderLabel,
                contentPadding = contentPadding,
                onSelectMode = onSelectMode,
                onOverflow = { twoRowOverflow.value = true },
            )
            ModeControlLayout.FOUR_ROW -> fourRowModeControl(
                selectedMode = selectedMode,
                shuffleFolderLabel = shuffleFolderLabel,
                contentPadding = contentPadding,
                onSelectMode = onSelectMode,
            )
        }
    }
}

// What:     `fun transportDeck(...)` draws the playback deck from a state snapshot and callbacks.
// Why:      The caller owns playback, so the deck stays stateless and previewable.
//
// In TS you'd write (pseudocode):
// ```ts
// function transportDeck(model: TransportDeckModel, actions: TransportDeckActions,
//   modifier?: Modifier): UIElement;
// ```
/**
 * Draws the playback deck: heading, seek row, transport buttons, and playback mode control.
 *
 * The deck takes its content height and never caps it, so the caller sets any height limit
 * through `modifier`.
 *
 * @param model playback snapshot to display
 * @param actions callbacks invoked on user actions
 * @param modifier outer modifier applied before background and padding
 */
@Composable
fun transportDeck(
    model: TransportDeckModel,
    actions: TransportDeckActions,
    modifier: Modifier = Modifier,
) {
    /** Deck background resolved for the current system appearance. */
    val containerColor: Color = deckContainerColor()
    Column(
        modifier = modifier
            .background(color = containerColor)
            .windowInsetsPadding(WindowInsets.systemGestures.only(WindowInsetsSides.Horizontal))
            .windowInsetsPadding(WindowInsets.navigationBars)
            .verticalScroll(rememberScrollState())
            .padding(vertical = DECK_VERTICAL_PADDING),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(DECK_GROUP_SPACING),
    ) {
        deckHeading(title = model.title, subtitle = model.subtitle)
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            seekRow(
                positionSec = model.positionSec,
                durationSec = model.durationSec,
                onSeek = actions.onSeek,
            )
            transportControls(
                playing = model.playing,
                onPrevious = actions.onPrevious,
                onTogglePlay = actions.onTogglePlay,
                onNext = actions.onNext,
            )
        }
        modeControl(
            selectedMode = model.mode,
            shuffleFolderLabel = model.shuffleFolderLabel,
            onSelectMode = actions.onSelectMode,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
