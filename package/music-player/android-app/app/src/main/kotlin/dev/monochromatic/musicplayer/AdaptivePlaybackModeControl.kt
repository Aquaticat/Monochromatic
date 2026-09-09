// Adaptive connected playback-mode control accepted for the unfolded player.
package dev.monochromatic.musicplayer

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RectangleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selectableGroup
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.monochromatic.musicplayer.core.PlaybackMode

/** Maximum visible page-name exemplar accepted for every Shuffle segment. */
private const val MAXIMUM_SHUFFLE_PAGE_NAME: String = "Camellia"

/** Minimum width where measuring a one-row arrangement is useful. */
private val minimumOneRowModeWidth: Dp = 189.dp

/** Minimum width where measuring a two-column arrangement is useful. */
private val minimumTwoRowModeWidth: Dp = 95.dp

/** Returns the visible current-page label, including the root-page fallback. */
private fun visibleModePageName(currentPage: String): String {
    if (currentPage.isNotBlank()) {
        return currentPage
    }
    return "page"
}

/** Returns playback modes in their accepted visible order. */
private fun playbackModes(): List<PlaybackMode> = listOf(
    PlaybackMode.REPEAT,
    PlaybackMode.IN_ORDER,
    PlaybackMode.SHUFFLE_PAGE,
    PlaybackMode.SHUFFLE_ALL,
)

/** Returns visible labels in the same order as [playbackModes]. */
private fun playbackModeLabels(currentPage: String): List<String> = listOf(
    "Repeat",
    "In order",
    "Shuffle ${visibleModePageName(currentPage)}",
    "Shuffle all",
)

/** Returns expanded accessibility labels in the same order as [playbackModes]. */
private fun playbackModeAccessibilityLabels(currentPage: String): List<String> = listOf(
    "Repeat track",
    "Play in order",
    "Shuffle ${visibleModePageName(currentPage)}",
    "Shuffle all folders",
)

/** Renders the fixed Shuffle prefix beside a middle-ellipsized, exemplar-capped page name. */
@Composable
private fun ShuffleModeLabel(
    currentPage: String,
    onUnexpectedOverflow: () -> Unit,
) {
    /** Uses the Material button-label typeface for width measurement and rendering. */
    val textStyle = MaterialTheme.typography.labelLarge
    /** Measures rendered text with the current Android font scale. */
    val textMeasurer = rememberTextMeasurer()
    /** Converts measured pixels into density-independent layout width. */
    val density = LocalDensity.current
    /** Holds rendered cap width for the accepted `Camellia` exemplar. */
    val maximumPageWidthPixels = remember(textMeasurer, textStyle) {
        textMeasurer.measure(text = MAXIMUM_SHUFFLE_PAGE_NAME, style = textStyle).size.width
    }
    /** Holds natural rendered width for the actual page label. */
    val naturalPageWidthPixels = remember(currentPage, textMeasurer, textStyle) {
        textMeasurer.measure(text = currentPage, style = textStyle).size.width
    }
    /** Holds actual page-name width without ever exceeding the accepted exemplar. */
    val desiredPageWidthPixels = minOf(naturalPageWidthPixels, maximumPageWidthPixels)
    /** Holds the pixel-derived Compose width used by the page-name text. */
    val desiredPageWidth = with(density) { desiredPageWidthPixels.toDp() }

    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = "Shuffle ",
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
            text = currentPage,
            modifier = Modifier.width(desiredPageWidth),
            maxLines = 1,
            overflow = TextOverflow.MiddleEllipsis,
            style = textStyle,
            onTextLayout = { result ->
                if (result.size.width < desiredPageWidthPixels) {
                    onUnexpectedOverflow()
                }
            },
        )
    }
}

/** Renders one label while keeping Shuffle prefix and accessibility behavior specialized. */
@Composable
private fun PlaybackModeLabel(
    index: Int,
    labels: List<String>,
    currentPage: String,
    onUnexpectedOverflow: () -> Unit,
) {
    if (index == 2) {
        ShuffleModeLabel(
            currentPage = visibleModePageName(currentPage),
            onUnexpectedOverflow = onUnexpectedOverflow,
        )
        return
    }
    Text(
        text = labels[index],
        maxLines = 1,
        overflow = TextOverflow.Clip,
        onTextLayout = { result ->
            if (result.hasVisualOverflow) {
                onUnexpectedOverflow()
            }
        },
    )
}

/** Renders one intrinsic-width Material-style segment for the one-row arrangement. */
@Composable
private fun VariableWidthModeSegment(
    index: Int,
    modes: List<PlaybackMode>,
    labels: List<String>,
    accessibilityLabels: List<String>,
    currentPage: String,
    selectedMode: PlaybackMode,
    contentPadding: PaddingValues,
    onSelectMode: (PlaybackMode) -> Unit,
    onUnexpectedOverflow: () -> Unit,
) {
    /** Records whether this segment represents current playback mode. */
    val isSelected = modes[index] == selectedMode
    /** Uses accepted neutral selected fill and transparency otherwise. */
    val containerColor = if (isSelected) {
        MaterialTheme.colorScheme.secondaryContainer
    } else {
        Color.Transparent
    }
    /** Uses paired Material ink for selected and ordinary surfaces. */
    val contentColor = if (isSelected) {
        MaterialTheme.colorScheme.onSecondaryContainer
    } else {
        MaterialTheme.colorScheme.onSurface
    }

    OutlinedButton(
        onClick = { onSelectMode(modes[index]) },
        shape = SegmentedButtonDefaults.itemShape(index = index, count = labels.size),
        modifier = Modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .semantics {
                contentDescription = accessibilityLabels[index]
                role = Role.RadioButton
                selected = isSelected
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
                imageVector = Icons.Filled.Check,
                contentDescription = null,
                modifier = Modifier
                    .padding(end = 8.dp)
                    .size(SegmentedButtonDefaults.IconSize),
            )
        }
        PlaybackModeLabel(
            index = index,
            labels = labels,
            currentPage = currentPage,
            onUnexpectedOverflow = onUnexpectedOverflow,
        )
    }
}

/** Composes four content-sized segments as one connected horizontal group. */
@Composable
private fun OneRowModeControl(
    modes: List<PlaybackMode>,
    labels: List<String>,
    accessibilityLabels: List<String>,
    currentPage: String,
    selectedMode: PlaybackMode,
    contentPadding: PaddingValues,
    onSelectMode: (PlaybackMode) -> Unit,
    onUnexpectedOverflow: () -> Unit,
) {
    Row(
        modifier = Modifier.selectableGroup(),
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy((-1).dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        for (index in labels.indices) {
            VariableWidthModeSegment(
                index = index,
                modes = modes,
                labels = labels,
                accessibilityLabels = accessibilityLabels,
                currentPage = currentPage,
                selectedMode = selectedMode,
                contentPadding = contentPadding,
                onSelectMode = onSelectMode,
                onUnexpectedOverflow = onUnexpectedOverflow,
            )
        }
    }
}

/** Returns the outside-corner shape for one segment in a connected two-by-two group. */
private fun twoRowSegmentShape(index: Int): RoundedCornerShape {
    if (index == 0) {
        return RoundedCornerShape(topStart = 20.dp)
    }
    if (index == 1) {
        return RoundedCornerShape(topEnd = 20.dp)
    }
    if (index == 2) {
        return RoundedCornerShape(bottomStart = 20.dp)
    }
    return RoundedCornerShape(bottomEnd = 20.dp)
}

/** Composes four real Material segments as one connected two-by-two group. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TwoRowModeControl(
    modes: List<PlaybackMode>,
    labels: List<String>,
    accessibilityLabels: List<String>,
    currentPage: String,
    selectedMode: PlaybackMode,
    contentPadding: PaddingValues,
    onSelectMode: (PlaybackMode) -> Unit,
    onUnexpectedOverflow: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .selectableGroup(),
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy((-1).dp),
    ) {
        for (rowIndex in 0..1) {
            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                for (columnIndex in 0..1) {
                    /** Holds linear mode index represented by this grid position. */
                    val index = rowIndex * 2 + columnIndex
                    SegmentedButton(
                        selected = modes[index] == selectedMode,
                        onClick = { onSelectMode(modes[index]) },
                        shape = twoRowSegmentShape(index),
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                            .semantics {
                                contentDescription = accessibilityLabels[index]
                            },
                        contentPadding = contentPadding,
                    ) {
                        PlaybackModeLabel(
                            index = index,
                            labels = labels,
                            currentPage = currentPage,
                            onUnexpectedOverflow = onUnexpectedOverflow,
                        )
                    }
                }
            }
        }
    }
}

/** Returns the outside-corner shape for one segment in the connected vertical group. */
private fun fourRowSegmentShape(index: Int, lastIndex: Int): androidx.compose.ui.graphics.Shape {
    if (index == 0) {
        return RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    }
    if (index == lastIndex) {
        return RoundedCornerShape(bottomStart = 20.dp, bottomEnd = 20.dp)
    }
    return RectangleShape
}

/** Composes four real Material segments as one connected vertical group. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FourRowModeControl(
    modes: List<PlaybackMode>,
    labels: List<String>,
    accessibilityLabels: List<String>,
    currentPage: String,
    selectedMode: PlaybackMode,
    onSelectMode: (PlaybackMode) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .selectableGroup(),
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy((-1).dp),
    ) {
        for (index in labels.indices) {
            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                SegmentedButton(
                    selected = modes[index] == selectedMode,
                    onClick = { onSelectMode(modes[index]) },
                    shape = fourRowSegmentShape(index = index, lastIndex = labels.lastIndex),
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                        .semantics {
                            contentDescription = accessibilityLabels[index]
                        },
                ) {
                    PlaybackModeLabel(
                        index = index,
                        labels = labels,
                        currentPage = currentPage,
                        onUnexpectedOverflow = {},
                    )
                }
            }
        }
    }
}

/** Chooses the first connected arrangement that fits with the strict 12dp content-padding floor. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AdaptivePlaybackModeControl(
    currentPage: String,
    selectedMode: PlaybackMode,
    onSelectMode: (PlaybackMode) -> Unit,
) {
    /** Holds modes in accepted visible order. */
    val modes = playbackModes()
    /** Holds visible labels aligned with [modes]. */
    val labels = playbackModeLabels(currentPage)
    /** Holds expanded assistive labels aligned with [modes]. */
    val accessibilityLabels = playbackModeAccessibilityLabels(currentPage)
    /** Supplies live density and Android user font scale to layout-state keys. */
    val density = LocalDensity.current

    BoxWithConstraints(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center,
    ) {
        /** Remembers whether the one-row measurement clipped at these live constraints. */
        val oneRowOverflow: MutableState<Boolean> = remember(maxWidth, density.fontScale, currentPage) {
            mutableStateOf(false)
        }
        /** Remembers whether the two-row measurement clipped at these live constraints. */
        val twoRowOverflow: MutableState<Boolean> = remember(maxWidth, density.fontScale, currentPage) {
            mutableStateOf(false)
        }
        if (maxWidth >= minimumOneRowModeWidth && !oneRowOverflow.value) {
            OneRowModeControl(
                modes = modes,
                labels = labels,
                accessibilityLabels = accessibilityLabels,
                currentPage = currentPage,
                selectedMode = selectedMode,
                contentPadding = SegmentedButtonDefaults.ContentPadding,
                onSelectMode = onSelectMode,
                onUnexpectedOverflow = { oneRowOverflow.value = true },
            )
            return@BoxWithConstraints
        }
        if (maxWidth >= minimumTwoRowModeWidth && !twoRowOverflow.value) {
            TwoRowModeControl(
                modes = modes,
                labels = labels,
                accessibilityLabels = accessibilityLabels,
                currentPage = currentPage,
                selectedMode = selectedMode,
                contentPadding = SegmentedButtonDefaults.ContentPadding,
                onSelectMode = onSelectMode,
                onUnexpectedOverflow = { twoRowOverflow.value = true },
            )
            return@BoxWithConstraints
        }
        FourRowModeControl(
            modes = modes,
            labels = labels,
            accessibilityLabels = accessibilityLabels,
            currentPage = currentPage,
            selectedMode = selectedMode,
            onSelectMode = onSelectMode,
        )
    }
}
