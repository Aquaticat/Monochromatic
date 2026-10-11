// Track list pane for one folder's flat list (D5, D6, D31, D42). It draws track rows and subfolder headers
// from the entries the core layer builds, and keeps the playing row in view as it changes.

// What:     `package dev.monochromatic.musicplayer` places the track list pane beside the other player composables.
// Why:      The pane is a stateless composable that screens import without reaching into MainActivity.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     Imports from `androidx.compose.foundation` bring in clicking, layout, and the lazy list.
// Why:      The pane draws a scrolling list of rows that play a track when tapped.
//
// In TS you'd write (pseudocode):
// ```ts
// import { clickable, LazyColumn } from "compose/foundation";
// ```
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState

// What:     Imports from `androidx.compose.material3` and `runtime` bring in the theme roles, text, and effects.
// Why:      Rows read Material roles so they follow the app theme, and the scroll effect runs as a coroutine.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MaterialTheme, Text } from "material3";
// import { LaunchedEffect, Composable } from "compose/runtime";
// ```
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import kotlin.math.roundToInt
import dev.monochromatic.musicplayer.core.MenuAnchorRect

// What:     Imports from `androidx.compose.ui` bring in the modifier, color, font weight, semantics, and dp units.
// Why:      The current row is bold, uses the surface role as its background, and publishes its selected state.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier, Color, FontWeight, Role, Dp } from "compose/ui";
// ```
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEvent
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.isSecondaryPressed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import kotlinx.coroutines.flow.first
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// What:     Imports from `dev.monochromatic.musicplayer.core` bring in the entry types the pane draws.
// Why:      The pane renders the pure entries built by the core layer and never builds them itself.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { TrackListEntry, TrackRowModel } from "core/TrackListEntries";
// ```
import dev.monochromatic.musicplayer.core.TrackListEntry
import dev.monochromatic.musicplayer.core.TrackRowModel

// What:     `private val ROW_MIN_HEIGHT: Dp = 48.dp` is the smallest height of a track row and a header.
// Why:      The row meets the 48dp touch target, and a row with a supporting line grows past it.
//
// In TS you'd write (pseudocode):
// ```ts
// const ROW_MIN_HEIGHT = 48;
// ```
/** Smallest height of one track row or subfolder header, matching the 48dp touch target. */
private val ROW_MIN_HEIGHT: Dp = 48.dp

// What:     `private val ROW_HORIZONTAL_PADDING: Dp = 16.dp` insets a row's text from the pane edges.
// Why:      The text sits clear of the edges so it does not touch the highlight of the current row.
//
// In TS you'd write (pseudocode):
// ```ts
// const ROW_HORIZONTAL_PADDING = 16;
// ```
/** Horizontal inset of a row's text from the pane edges. */
private val ROW_HORIZONTAL_PADDING: Dp = 16.dp

// What:     `private val ROW_VERTICAL_PADDING: Dp = 12.dp` insets a row's text from its top and bottom.
// Why:      A one-line row with this inset reaches the 48dp minimum height.
//
// In TS you'd write (pseudocode):
// ```ts
// const ROW_VERTICAL_PADDING = 12;
// ```
/** Vertical inset of a row's text from its top and bottom edges. */
private val ROW_VERTICAL_PADDING: Dp = 12.dp

// What:     `private val TEXT_SPACING: Dp = 2.dp` separates a row's title from its supporting line.
// Why:      A small gap keeps the two lines readable as one row.
//
// In TS you'd write (pseudocode):
// ```ts
// const TEXT_SPACING = 2;
// ```
/** Gap between a row's title and its supporting line. */
private val TEXT_SPACING: Dp = 2.dp

// What:     `private val HEADER_TOP_PADDING: Dp = 16.dp` sets the space above each subfolder header.
// Why:      The space sets a header apart from the tracks above it, which distinguishes it from a track row.
//
// In TS you'd write (pseudocode):
// ```ts
// const HEADER_TOP_PADDING = 16;
// ```
/** Space above a subfolder header, which sets it apart from the track rows above it. */
private val HEADER_TOP_PADDING: Dp = 16.dp

// What:     `internal val LocalTrackRowMenuOpener` carries the menu opener from the player host to every track row.
// Why:      The track list is drawn through the player content, which takes no menu parameter, so the host provides the
//           opener through this local instead of threading a new parameter through every screen.
//
// In TS you'd write (pseudocode):
// ```ts
// const LocalTrackRowMenuOpener = createContext<((index: number) => void) | null>(null);
// ```
/** Composition local holding the track menu opener, or null when no host provides one. */
internal val LocalTrackRowMenuOpener: ProvidableCompositionLocal<((Int, MenuAnchorRect) -> Unit)?> =
    staticCompositionLocalOf { null }

// What:     `fun trackListPane(...)` draws the folder's flat list and keeps the playing row in view.
// Why:      The caller owns the entries and the playback action, so the pane keeps only its scroll state.
//
// In TS you'd write (pseudocode):
// ```ts
// function TrackListPane(props: { entries: TrackListEntry[]; onPlay: (indexInLibrary: number) => void }): UIElement;
// ```
/**
 * Draws track rows and subfolder headers in one scrolling list, playing a row by its library index when tapped.
 *
 * @param onOpenMenu Opens the track context menu for a row's library index on long press, secondary click, or the
 *     menu key; defaults to the opener the host provides through [LocalTrackRowMenuOpener], and null disables it.
 */
@Composable
fun trackListPane(
    entries: List<TrackListEntry>,
    onPlay: (Int) -> Unit,
    onOpenMenu: ((Int, MenuAnchorRect) -> Unit)? = LocalTrackRowMenuOpener.current,
    modifier: Modifier = Modifier,
) {
    /** Scroll state of the list, which the current-row effect moves. */
    val listState = rememberLazyListState()
    /** Position of the playing row among the entries, or null when no row in this list is playing. */
    val currentPosition: Int? = currentPositionOf(entries)
    LaunchedEffect(currentPosition) {
        if (currentPosition != null) {
            listState.animateScrollToItem(currentPosition)
        }
    }
    /** Count of reveal requests from the host, each of which scrolls to and focuses the playing row. */
    val revealToken: Int = HostKeyLocalReveal.current
    /** Reveal count when this list entered composition, so that entering the list never reveals by itself. */
    val revealAtEntry: Int = remember { revealToken }
    /** Focus requester attached to the playing row, so a reveal can focus it once the row is composed. */
    val currentRowFocus: FocusRequester = remember { FocusRequester() }
    LaunchedEffect(revealToken) {
        if (revealToken != revealAtEntry && currentPosition != null) {
            listState.scrollToItem(currentPosition)
            snapshotFlow { listState.layoutInfo.visibleItemsInfo.any { item -> item.index == currentPosition } }
                .first { visible -> visible }
            currentRowFocus.requestFocus()
        }
    }
    LazyColumn(state = listState, modifier = modifier) {
        items(items = entries, key = { entry -> keyOf(entry) }) { entry ->
            when (entry) {
                is TrackListEntry.RowEntry -> trackRow(
                    row = entry.row,
                    onPlay = onPlay,
                    onOpenMenu = onOpenMenu,
                    focus = if (entry.row.isCurrent) currentRowFocus else null,
                )
                is TrackListEntry.HeaderEntry -> subfolderHeader(name = entry.name, trackCount = entry.trackCount)
            }
        }
    }
}

// What:     `private fun currentPositionOf(entries: List<TrackListEntry>): Int?` finds the playing row's position.
// Why:      The scroll effect needs the list position of the current row, and a list with no current row has none.
//
// In TS you'd write (pseudocode):
// ```ts
// const currentPositionOf = (entries: TrackListEntry[]): number | null => {
//   const position = entries.findIndex((e) => e.kind === "row" && e.row.isCurrent);
//   return position < 0 ? null : position;
// };
// ```
/** Position of the current track row among the entries, or null when no row is current. */
private fun currentPositionOf(entries: List<TrackListEntry>): Int? {
    /** Index of the first current row, or a negative value when no row is current. */
    val position: Int = entries.indexOfFirst { entry ->
        entry is TrackListEntry.RowEntry && entry.row.isCurrent
    }
    if (position < 0) {
        return null
    }
    return position
}

// What:     `private fun menuAnchorOfRect(bounds: Rect): MenuAnchorRect` converts window bounds to whole pixels.
// Why:      The placement rule works on integer pixels, and rounding happens once here at the Compose boundary.
//
// In TS you'd write (pseudocode):
// ```ts
// const menuAnchorOfRect = (b: Rect): MenuAnchorRect => ({ left: Math.round(b.left), top: Math.round(b.top), ... });
// ```
/** Converts window-space float bounds of a row into the whole-pixel rectangle the menu placement reads. */
private fun menuAnchorOfRect(bounds: Rect): MenuAnchorRect = MenuAnchorRect(
    left = bounds.left.roundToInt(),
    top = bounds.top.roundToInt(),
    right = bounds.right.roundToInt(),
    bottom = bounds.bottom.roundToInt(),
)

// What:     `private fun keyOf(entry: TrackListEntry): String` gives each entry a stable list key.
// Why:      Keys keep row state with its track as the list changes, and the prefixes keep rows and headers apart.
//
// In TS you'd write (pseudocode):
// ```ts
// const keyOf = (entry: TrackListEntry): string =>
//   entry.kind === "row" ? `row-${entry.row.indexInLibrary}` : `header-${entry.name}`;
// ```
/** Stable key for one entry, built from the library index for rows and the subfolder name for headers. */
private fun keyOf(entry: TrackListEntry): String = when (entry) {
    is TrackListEntry.RowEntry -> "row-" + entry.row.indexInLibrary
    is TrackListEntry.HeaderEntry -> "header-" + entry.name
}

// What:     `@Composable private fun trackRow(...)` draws one playable track row.
// Why:      The current row gets the D42 surface background and a bold title, and every row plays on tap.
//
// In TS you'd write (pseudocode):
// ```ts
// function TrackRow(props: { row: TrackRowModel; onPlay: (index: number) => void }): UIElement;
// ```
/**
 * Draws one track row with its title, optional supporting line, and current-row treatment.
 * Tap plays the row; long press, a secondary-button press, or the menu key opens its context menu.
 */
@Composable
private fun trackRow(
    row: TrackRowModel,
    onPlay: (Int) -> Unit,
    onOpenMenu: ((Int, MenuAnchorRect) -> Unit)?,
    focus: FocusRequester?,
) {
    /** Surface role behind the current row (D42), and transparent behind every other row. */
    val rowBackground: Color = if (row.isCurrent) {
        MaterialTheme.colorScheme.surfaceContainerLow
    } else {
        Color.Transparent
    }
    /** Weight of the title, bold for the current row and the body default for the rest. */
    val titleWeight: FontWeight? = if (row.isCurrent) FontWeight.Bold else null
    /** Window-space bounds of this row from its last layout, or null before the row is first placed. */
    var rowBounds: MenuAnchorRect? by remember { mutableStateOf<MenuAnchorRect?>(null) }
    /** Action that opens this row's menu anchored to the row, or null when no menu opener is provided. */
    val openMenuForRow: (() -> Unit)? = onOpenMenu?.let { open ->
        {
            rowBounds?.let { bounds -> open(row.indexInLibrary, bounds) }
        }
    }
    /** Focus modifier that lets a reveal focus this row, or an empty modifier when no reveal targets it. */
    val focusModifier: Modifier = focus?.let { requester -> Modifier.focusRequester(requester) } ?: Modifier
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = ROW_MIN_HEIGHT)
            .onGloballyPositioned { coordinates -> rowBounds = menuAnchorOfRect(coordinates.boundsInWindow()) }
            .background(rowBackground)
            .then(focusModifier)
            .combinedClickable(
                role = Role.Button,
                onClick = { onPlay(row.indexInLibrary) },
                onLongClick = openMenuForRow,
            )
            .pointerInput(row.indexInLibrary, onOpenMenu) {
                awaitPointerEventScope {
                    while (true) {
                        /** Next pointer event on this row, read before the row's own tap handling sees it. */
                        val event: PointerEvent = awaitPointerEvent()
                        if (event.type == PointerEventType.Press && event.buttons.isSecondaryPressed) {
                            openMenuForRow?.invoke()
                        }
                    }
                }
            }
            .onKeyEvent { event ->
                if (event.key == Key.Menu && event.type == KeyEventType.KeyUp && openMenuForRow != null) {
                    openMenuForRow.invoke()
                    true
                } else {
                    false
                }
            }
            .semantics { selected = row.isCurrent }
            .padding(horizontal = ROW_HORIZONTAL_PADDING, vertical = ROW_VERTICAL_PADDING),
        verticalArrangement = Arrangement.spacedBy(TEXT_SPACING),
    ) {
        Text(
            text = row.title,
            color = MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = titleWeight,
        )
        if (row.supportingLine != null) {
            Text(
                text = row.supportingLine,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

// What:     `@Composable private fun subfolderHeader(...)` draws one subfolder's name and track count.
// Why:      The header is not clickable, and its primary-colored name and count line set it apart from track rows.
//
// In TS you'd write (pseudocode):
// ```ts
// function SubfolderHeader(props: { name: string; trackCount: number }): UIElement;
// ```
/** Draws a non-clickable subfolder header with its name and the number of tracks under it. */
@Composable
private fun subfolderHeader(name: String, trackCount: Int) {
    /** Count line that reads one track in the singular and any other count in the plural. */
    val countText: String = if (trackCount == 1) "1 track" else "$trackCount tracks"
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = ROW_MIN_HEIGHT)
            .padding(start = ROW_HORIZONTAL_PADDING, end = ROW_HORIZONTAL_PADDING, top = HEADER_TOP_PADDING)
            .semantics { heading() },
        verticalArrangement = Arrangement.spacedBy(TEXT_SPACING),
    ) {
        Text(
            text = name,
            color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.titleSmall,
        )
        Text(
            text = countText,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}
