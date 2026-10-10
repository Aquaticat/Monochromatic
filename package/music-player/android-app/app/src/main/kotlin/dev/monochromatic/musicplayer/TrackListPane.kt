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
import androidx.compose.foundation.clickable
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

// What:     Imports from `androidx.compose.ui` bring in the modifier, color, font weight, semantics, and dp units.
// Why:      The current row is bold, uses the surface role as its background, and publishes its selected state.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier, Color, FontWeight, Role, Dp } from "compose/ui";
// ```
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
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

// What:     `fun trackListPane(...)` draws the folder's flat list and keeps the playing row in view.
// Why:      The caller owns the entries and the playback action, so the pane keeps only its scroll state.
//
// In TS you'd write (pseudocode):
// ```ts
// function TrackListPane(props: { entries: TrackListEntry[]; onPlay: (indexInLibrary: number) => void }): UIElement;
// ```
/** Draws track rows and subfolder headers in one scrolling list, playing a row by its library index when tapped. */
@Composable
fun trackListPane(
    entries: List<TrackListEntry>,
    onPlay: (Int) -> Unit,
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
    LazyColumn(state = listState, modifier = modifier) {
        items(items = entries, key = { entry -> keyOf(entry) }) { entry ->
            when (entry) {
                is TrackListEntry.RowEntry -> trackRow(row = entry.row, onPlay = onPlay)
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
/** Draws one track row with its title, optional supporting line, and current-row treatment. */
@Composable
private fun trackRow(row: TrackRowModel, onPlay: (Int) -> Unit) {
    /** Surface role behind the current row (D42), and transparent behind every other row. */
    val rowBackground: Color = if (row.isCurrent) {
        MaterialTheme.colorScheme.surfaceContainerLow
    } else {
        Color.Transparent
    }
    /** Weight of the title, bold for the current row and the body default for the rest. */
    val titleWeight: FontWeight? = if (row.isCurrent) FontWeight.Bold else null
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = ROW_MIN_HEIGHT)
            .background(rowBackground)
            .clickable(role = Role.Button, onClick = { onPlay(row.indexInLibrary) })
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
