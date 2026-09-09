// Production unfolded player presentation accepted by the native design review.
package dev.monochromatic.musicplayer

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.systemGestures
import dev.monochromatic.musicplayer.core.PageEntry

/** Minimum width that fits the measured 414dp, 24dp, 414dp unfolded geometry. */
internal val unfoldedPlayerMinimumWidth = 852.dp

/** Width reserved between equal unfolded panes. */
private val unfoldedCenterSpacerWidth = 24.dp

/** Height reserved between folder browsing and playback deck. */
private val unfoldedSectionDividerHeight = 16.dp

/** Maximum accepted deck height before its contents scroll vertically. */
private val unfoldedDeckMaximumHeight = 440.dp

/** Returns the selected page label used by the app bar and Shuffle segment. */
private fun unfoldedCurrentPage(state: PlayerUiState): String {
    return state.pageLabels.getOrNull(state.selectedPage).orEmpty()
}

/** Returns the writing-system label corresponding to the currently selected page. */
private fun unfoldedSelectedLetter(state: PlayerUiState): String {
    /** Holds current page label, or empty text for an invalid selection. */
    val currentPage = unfoldedCurrentPage(state)
    if (currentPage.isEmpty()) {
        return ""
    }
    if (state.selectedPage in state.folderPageIndices) {
        return currentPage.first().uppercaseChar().toString()
    }
    return currentPage.uppercase()
}

/** Draws the folder icon and explicit label retained by accepted tonal Open treatment. */
@Composable
private fun RowScope.openActionContent() {
    Icon(
        imageVector = Icons.Filled.FolderOpen,
        contentDescription = null,
        modifier = Modifier.size(ButtonDefaults.IconSize),
    )
    Box(modifier = Modifier.width(ButtonDefaults.IconSpacing))
    Text(text = "Open")
}

/** Renders one full-size plain folder target with redundant selected cues. */
@Composable
private fun unfoldedFolderTarget(
    target: UnfoldedPageTarget,
    selectedPage: Int,
    onSelectPage: (Int) -> Unit,
) {
    /** Records whether this folder owns the visible track pane. */
    val isSelected = target.pageIndex == selectedPage
    Box(
        modifier = Modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .selectable(
                selected = isSelected,
                onClick = { onSelectPage(target.pageIndex) },
                role = Role.RadioButton,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = target.label,
            modifier = Modifier.padding(horizontal = 4.dp),
            color = if (isSelected) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.onSurface
            },
            style = if (isSelected) {
                MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium)
            } else {
                MaterialTheme.typography.bodyLarge
            },
        )
        if (isSelected) {
            HorizontalDivider(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth(),
                thickness = 2.dp,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/** Packs actual top-level folder pages into independently scrollable plain targets. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RowScope.unfoldedFolderNames(
    state: PlayerUiState,
    onSelectPage: (Int) -> Unit,
) {
    /** Holds identity-preserving folder targets derived from controller state. */
    val targets = unfoldedFolderTargets(state)
    Column(modifier = Modifier.weight(1f)) {
        Text(
            text = unfoldedSelectedLetter(state),
            modifier = Modifier.padding(start = 16.dp, top = 8.dp, end = 16.dp, bottom = 2.dp),
            color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.titleLarge,
        )
        if (targets.isEmpty()) {
            Text(
                text = "No subfolders",
                modifier = Modifier.padding(16.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            return@Column
        }
        FlowRow(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(start = 12.dp, end = 16.dp, bottom = 16.dp)
                .selectableGroup(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            for (target in targets) {
                unfoldedFolderTarget(
                    target = target,
                    selectedPage = state.selectedPage,
                    onSelectPage = onSelectPage,
                )
            }
        }
    }
}

/** Draws one independently scrolling 48dp writing-system rail. */
@Composable
private fun unfoldedLetterRail(
    state: PlayerUiState,
    onSelectPage: (Int) -> Unit,
) {
    /** Holds each distinct folder initial or root bucket once. */
    val letters = unfoldedLetterTargets(state)
    /** Holds current page's matching visible rail label. */
    val selectedLetter = unfoldedSelectedLetter(state)
    Column(
        modifier = Modifier
            .width(48.dp)
            .fillMaxHeight()
            .verticalScroll(rememberScrollState())
            .selectableGroup(),
    ) {
        for (letter in letters) {
            /** Records whether this rail target corresponds to current page. */
            val isSelected = letter == selectedLetter
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .selectable(
                        selected = isSelected,
                        onClick = {
                            /** Resolves the visible label to a real page index. */
                            val pageIndex = unfoldedPageForLetter(state, letter)
                            if (pageIndex != null) {
                                onSelectPage(pageIndex)
                            }
                        },
                        role = Role.RadioButton,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                if (isSelected) {
                    Surface(
                        modifier = Modifier.size(32.dp),
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.secondaryContainer,
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = letter,
                                color = MaterialTheme.colorScheme.onSecondaryContainer,
                                style = MaterialTheme.typography.labelLarge,
                            )
                        }
                    }
                } else {
                    Text(
                        text = letter,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
            }
        }
    }
}

/** Renders folder app bar, rail boundary, and real folder targets. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun unfoldedFolderPicker(
    modifier: Modifier,
    state: PlayerUiState,
    onOpen: () -> Unit,
    onSelectPage: (Int) -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceContainerLowest),
    ) {
        TopAppBar(
            title = { Text(text = "Folders") },
            actions = {
                FilledTonalButton(onClick = onOpen) {
                    openActionContent()
                }
            },
            modifier = Modifier.windowInsetsPadding(
                WindowInsets.systemGestures.only(WindowInsetsSides.Start),
            ),
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
                scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
            ),
            windowInsets = WindowInsets(0, 0, 0, 0),
        )
        Row(modifier = Modifier.weight(1f)) {
            unfoldedLetterRail(state = state, onSelectPage = onSelectPage)
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .fillMaxHeight()
                    .background(MaterialTheme.colorScheme.outlineVariant),
            )
            unfoldedFolderNames(state = state, onSelectPage = onSelectPage)
        }
    }
}

/** Renders accepted outlined skip actions and filled play/pause action. */
@Composable
private fun unfoldedTransportControls(
    playing: Boolean,
    onPrevious: () -> Unit,
    onTogglePlay: () -> Unit,
    onNext: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedIconButton(onClick = onPrevious) {
            Icon(imageVector = Icons.Filled.SkipPrevious, contentDescription = "Previous track")
        }
        FilledIconButton(onClick = onTogglePlay) {
            Icon(
                imageVector = if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                contentDescription = if (playing) "Pause" else "Play",
            )
        }
        OutlinedIconButton(onClick = onNext) {
            Icon(imageVector = Icons.Filled.SkipNext, contentDescription = "Next track")
        }
    }
}

/** Renders centered title, live seek, transport 1B, and adaptive playback modes. */
@Composable
private fun unfoldedTransportDeck(
    modifier: Modifier,
    state: PlayerUiState,
    progress: PlaybackProgress,
    controller: PlayerController,
) {
    /** Holds current display path as a clean title, or an explicit empty-state label. */
    val currentTitle = state.currentTrackName?.let(::unfoldedTrackTitle) ?: "No track selected"
    /** Holds stable load-order ordinal for current track, or zero without a selection. */
    val currentOrdinal = state.currentIndex?.plus(1) ?: 0
    /** Holds positive slider maximum while native duration is unavailable. */
    val maximumPosition = if (progress.duration > 0.0) progress.duration.toFloat() else 1.0f
    /** Holds Material numeric time style with tabular figures. */
    val timeStyle = MaterialTheme.typography.labelMedium.copy(fontFeatureSettings = "tnum")
    /** Holds current page label shared by app bar and adaptive Shuffle segment. */
    val currentPage = unfoldedCurrentPage(state)

    Column(
        modifier = modifier
            .heightIn(max = unfoldedDeckMaximumHeight)
            .background(MaterialTheme.colorScheme.surfaceContainerLow)
            .windowInsetsPadding(WindowInsets.systemGestures.only(WindowInsetsSides.Horizontal))
            .verticalScroll(rememberScrollState())
            .padding(vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = currentTitle, style = MaterialTheme.typography.titleMedium)
            Text(
                text = "$currentOrdinal of ${state.queueSize}",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = formatTime(progress.position),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = timeStyle,
            )
            Slider(
                value = progress.position.toFloat().coerceIn(0.0f, maximumPosition),
                onValueChange = { controller.seek(it.toDouble()) },
                valueRange = 0.0f..maximumPosition,
                modifier = Modifier
                    .weight(1f)
                    .semantics {
                        contentDescription = "Track position"
                    },
            )
            Text(
                text = formatTime(progress.duration),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = timeStyle,
            )
        }
        unfoldedTransportControls(
            playing = state.playing,
            onPrevious = { controller.prev() },
            onTogglePlay = { controller.togglePlay() },
            onNext = { controller.next() },
        )
        adaptivePlaybackModeControl(
            currentPage = currentPage,
            selectedMode = state.playbackMode,
            onSelectMode = { controller.setPlaybackMode(it) },
        )
    }
}

/** Builds the accepted folder-over-transport pane. */
@Composable
private fun unfoldedFolderAndTransportPane(
    modifier: Modifier,
    state: PlayerUiState,
    progress: PlaybackProgress,
    controller: PlayerController,
    onOpen: () -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surfaceContainerLowest),
    ) {
        unfoldedFolderPicker(
            modifier = Modifier.weight(1f),
            state = state,
            onOpen = onOpen,
            onSelectPage = { controller.selectPage(it) },
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(unfoldedSectionDividerHeight)
                .background(Color.White),
        )
        unfoldedTransportDeck(
            modifier = Modifier.fillMaxWidth(),
            state = state,
            progress = progress,
            controller = controller,
        )
    }
}

/** Renders one accepted T3 track row with full-width title and current-state semantics. */
@Composable
private fun unfoldedTrackRow(
    item: PageEntry,
    state: PlayerUiState,
    progress: PlaybackProgress,
    controller: PlayerController,
) {
    /** Records whether this entry is current across the complete queue. */
    val isCurrent = item.index == state.currentIndex
    /** Holds title without page prefix or final filename extension. */
    val title = unfoldedTrackTitle(item.name)
    ListItem(
        headlineContent = {
            Text(
                text = title,
                style = if (isCurrent) {
                    MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold)
                } else {
                    MaterialTheme.typography.bodyLarge
                },
            )
        },
        supportingContent = if (isCurrent && progress.duration > 0.0) {
            {
                Text(
                    text = formatTime(progress.duration),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        } else {
            null
        },
        colors = ListItemDefaults.colors(
            containerColor = if (isCurrent) {
                MaterialTheme.colorScheme.surfaceContainerLow
            } else {
                Color.Transparent
            },
            headlineColor = MaterialTheme.colorScheme.onSurface,
            supportingColor = MaterialTheme.colorScheme.onSurfaceVariant,
        ),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp)
            .clickable(role = Role.Button) {
                if (isCurrent) {
                    controller.togglePlay()
                } else {
                    controller.playIndex(item.index)
                }
            }
            .semantics {
                selected = isCurrent
                if (isCurrent) {
                    contentDescription = "Current track: $title"
                }
            },
    )
}

/** Renders current page app bar, settings action, and independently scrolling track list. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun unfoldedTrackPane(
    modifier: Modifier,
    state: PlayerUiState,
    progress: PlaybackProgress,
    controller: PlayerController,
    onSettings: () -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surfaceContainerLowest)
            .windowInsetsPadding(WindowInsets.systemGestures.only(WindowInsetsSides.End)),
    ) {
        TopAppBar(
            title = { Text(text = unfoldedCurrentPage(state)) },
            actions = {
                IconButton(onClick = onSettings) {
                    Icon(imageVector = Icons.Filled.Settings, contentDescription = "Settings")
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
                scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainer,
            ),
            windowInsets = WindowInsets(0, 0, 0, 0),
        )
        if (state.queueSize == 0) {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (state.loading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp))
                    Text(text = "Loading your library…")
                } else {
                    Text(text = "No music found in your audio library.")
                }
            }
            return@Column
        }
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(state.pageItems) { item ->
                unfoldedTrackRow(
                    item = item,
                    state = state,
                    progress = progress,
                    controller = controller,
                )
            }
        }
    }
}

/** Renders equal 414dp panes around the protected 24dp spacer at the 852dp target width. */
@Composable
internal fun unfoldedPlayerScreen(
    state: PlayerUiState,
    progress: PlaybackProgress,
    controller: PlayerController,
    onOpen: () -> Unit,
    onSettings: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surfaceDim),
    ) {
        unfoldedFolderAndTransportPane(
            modifier = Modifier.weight(1f),
            state = state,
            progress = progress,
            controller = controller,
            onOpen = onOpen,
        )
        Box(
            modifier = Modifier
                .width(unfoldedCenterSpacerWidth)
                .fillMaxHeight()
                .background(Color.White),
        )
        unfoldedTrackPane(
            modifier = Modifier.weight(1f),
            state = state,
            progress = progress,
            controller = controller,
            onSettings = onSettings,
        )
    }
}
