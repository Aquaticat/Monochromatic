// What:     `package dev.monochromatic.musicplayer` places vertical-layout folding beside player UI.
// Why:      Portrait-specific state and horizontal scrolling stay outside already-large MainActivity.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies module namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `Configuration` exposes Android's current portrait and landscape constants.
// Why:      Only portrait uses folded page controls.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Configuration } from "android/content/res";
// ```
import android.content.res.Configuration

// What:     `ScrollState` stores current and maximum horizontal strip offsets.
// Why:      Fold owner shares actual scroll geometry with selected reveal helper.
//
// In TS you'd write (pseudocode):
// ```ts
// type ScrollState = { value: number; maxValue: number; scrollTo(value: number): Promise<void> };
// ```
import androidx.compose.foundation.ScrollState

// What:     Foundation paint, click, and scroll modifiers compose neutral disclosure and strip behavior.
// Why:      One row needs native touch handling and user-driven horizontal scrolling.
//
// In TS you'd write (pseudocode):
// ```ts
// import { background, clickable, horizontalScroll, rememberScrollState } from "compose/foundation";
// ```
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState

// What:     Compose layout primitives arrange disclosure beside constrained page-control viewport.
// Why:      Leading control owns fixed target while strip consumes remaining width.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Box, BoxWithConstraints, Row } from "compose/layout";
// ```
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size

// What:     `RoundedCornerShape` supplies reference-like neutral disclosure silhouette.
// Why:      Chevron target stays visually separate from every selectable page style.
//
// In TS you'd write (pseudocode):
// ```ts
// import { RoundedCornerShape } from "compose/shapes";
// ```
import androidx.compose.foundation.shape.RoundedCornerShape

// What:     `MaterialTheme` supplies adaptive neutral disclosure pigments.
// Why:      Shared affordance must remain legible in dark and light scenes.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MaterialTheme } from "compose/material";
// ```
import androidx.compose.material3.MaterialTheme

// What:     Compose runtime state and effect APIs retain measured geometry and apply scroll destinations.
// Why:      Selected item is measured after composition, then synchronously revealed.
//
// In TS you'd write (pseudocode):
// ```ts
// import { useEffect, useState } from "compose/runtime";
// ```
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

// What:     `Alignment` and `Modifier` describe immutable layout and interaction configuration.
// Why:      Disclosure and viewport share top alignment without mutable view objects.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Alignment, Modifier } from "compose/ui";
// ```
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

// What:     `drawBehind` paints chevron strokes inside owned target bounds.
// Why:      Shape does not depend on font glyph availability.
//
// In TS you'd write (pseudocode):
// ```ts
// import { drawBehind } from "compose/draw";
// ```
import androidx.compose.ui.draw.drawBehind

// What:     `Offset` stores chevron line endpoints in physical pixels.
// Why:      Density-aware canvas receives exact points for down and up states.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Offset } from "compose/geometry";
// ```
import androidx.compose.ui.geometry.Offset

// What:     `StrokeCap` rounds chevron line ends.
// Why:      Neutral disclosure follows supplied browser reference.
//
// In TS you'd write (pseudocode):
// ```ts
// import { StrokeCap } from "compose/graphics";
// ```
import androidx.compose.ui.graphics.StrokeCap

// What:     Layout callbacks report selected target and viewport geometry after placement.
// Why:      Pure reveal helper needs physical content coordinates and viewport width.
//
// In TS you'd write (pseudocode):
// ```ts
// import { onLayout, positionInParent } from "compose/layout";
// ```
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInParent

// What:     `LocalConfiguration` reads current orientation from Compose environment.
// Why:      Landscape retains existing fully wrapped controls.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LocalConfiguration } from "compose/platform";
// ```
import androidx.compose.ui.platform.LocalConfiguration

// What:     Semantics properties name disclosure action and role for accessibility services.
// Why:      Custom-drawn chevron must announce standard button behavior.
//
// In TS you'd write (pseudocode):
// ```ts
// import { contentDescription, Role, role, semantics } from "compose/semantics";
// ```
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics

// What:     `Dp` and `dp` express density-independent target and spacing values.
// Why:      Android requires explicit 48dp interactive dimensions.
//
// In TS you'd write (pseudocode):
// ```ts
// type Dp = number & { unit: "dp" };
// ```
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// What:     `roundToInt` converts measured floating content coordinate to scroll state's integer pixels.
// Why:      ScrollState and pure reveal helper use exact integer offsets.
//
// In TS you'd write (pseudocode):
// ```ts
// const roundToInt = Math.round;
// ```
import kotlin.math.roundToInt

/** Stores Android minimum disclosure target side. */
private val pageDisclosureSize: Dp = 48.dp

/** Stores gap between disclosure and page-control viewport. */
private val pageDisclosureGap: Dp = 8.dp

/** Stores disclosure corner radius matching neutral reference control. */
private val pageDisclosureRadius: Dp = 16.dp

/** Groups portrait fold state and page-selection boundary. */
internal data class FoldablePageControlsOptions(
    /** Holds current page labels and selected page. */
    val state: PlayerUiState,
    /** Holds selected visual page-control treatment. */
    val style: PageControlStyle,
    /** Records explicit disclosure state retained by player screen. */
    val expanded: Boolean,
    /** Updates explicit disclosure state. */
    val onExpandedChange: (Boolean) -> Unit,
    /** Selects one page index. */
    val onSelectPage: (Int) -> Unit,
)

/** Groups custom disclosure state and action. */
private data class PageControlDisclosureOptions(
    /** Records whether complete rows are visible. */
    val expanded: Boolean,
    /** Toggles disclosure state. */
    val onClick: () -> Unit,
)

/** Displays neutral 48dp disclosure with state-specific accessibility label. */
@Composable
private fun pageControlDisclosure(options: PageControlDisclosureOptions) {
    /** Selects accessibility action text matching current state. */
    val actionLabel: String = if (options.expanded) "Show fewer pages" else "Show all pages"
    /** Selects up or down chevron point ordering. */
    val pointsDown: Boolean = !options.expanded
    /** Captures adaptive button fill before entering non-composable draw scope. */
    val containerColor = MaterialTheme.colorScheme.surfaceVariant
    /** Captures adaptive chevron pigment before entering non-composable draw scope. */
    val chevronColor = MaterialTheme.colorScheme.onSurfaceVariant
    Box(
        modifier = Modifier
            .size(pageDisclosureSize)
            .background(containerColor, RoundedCornerShape(pageDisclosureRadius))
            .semantics {
                contentDescription = actionLabel
                role = Role.Button
            }
            .clickable(role = Role.Button, onClick = options.onClick)
            .drawBehind {
                /** Stores horizontal chevron inset. */
                val insetPx: Float = size.width * 0.30f
                /** Stores chevron midpoint horizontal coordinate. */
                val middleXPx: Float = size.width / 2f
                /** Stores upper chevron y coordinate. */
                val upperYPx: Float = size.height * 0.42f
                /** Stores lower chevron y coordinate. */
                val lowerYPx: Float = size.height * 0.58f
                /** Selects outer endpoint y for current direction. */
                val outerYPx: Float = if (pointsDown) upperYPx else lowerYPx
                /** Selects center endpoint y for current direction. */
                val centerYPx: Float = if (pointsDown) lowerYPx else upperYPx
                drawLine(
                    color = chevronColor,
                    start = Offset(x = insetPx, y = outerYPx),
                    end = Offset(x = middleXPx, y = centerYPx),
                    strokeWidth = 2.dp.toPx(),
                    cap = StrokeCap.Round,
                )
                drawLine(
                    color = chevronColor,
                    start = Offset(x = middleXPx, y = centerYPx),
                    end = Offset(x = size.width - insetPx, y = outerYPx),
                    strokeWidth = 2.dp.toPx(),
                    cap = StrokeCap.Round,
                )
            },
    )
}

/** Groups rendered portrait row with scroll and selected-geometry boundaries. */
private data class PortraitPageControlRowOptions(
    /** Holds shared fold state and page action. */
    val fold: FoldablePageControlsOptions,
    /** Owns manual and programmatic horizontal offset. */
    val scrollState: ScrollState,
    /** Reports selected control geometry. */
    val selectedModifier: Modifier,
    /** Reports visible viewport width. */
    val onViewportWidth: (Int) -> Unit,
)

/** Displays disclosure beside expanded rows or one horizontally scrollable row. */
@Composable
private fun portraitPageControlRow(options: PortraitPageControlRowOptions) {
    /** Shows toggle for measured overflow or retained explicit expansion. */
    val showDisclosure: Boolean = options.fold.expanded || options.scrollState.maxValue > 0
    Row(
        horizontalArrangement = Arrangement.spacedBy(pageDisclosureGap),
        verticalAlignment = Alignment.Top,
        modifier = Modifier.fillMaxWidth(),
    ) {
        if (showDisclosure) {
            pageControlDisclosure(
                PageControlDisclosureOptions(
                    expanded = options.fold.expanded,
                    onClick = { options.fold.onExpandedChange(!options.fold.expanded) },
                ),
            )
        }
        BoxWithConstraints(
            modifier = Modifier
                .weight(1f)
                .onSizeChanged { options.onViewportWidth(it.width) },
        ) {
            /** Captures finite viewport before collapsed child receives horizontal infinity. */
            val pageMaximumWidth: Dp = maxWidth
            /** Shares stable page values between wrapped and one-row branches. */
            val commonOptions = PageTabsOptions(
                state = options.fold.state,
                style = options.fold.style,
                wrap = options.fold.expanded,
                maximumWidth = pageMaximumWidth,
                selectedModifier = if (options.fold.expanded) Modifier else options.selectedModifier,
                onSelectPage = options.fold.onSelectPage,
            )
            if (options.fold.expanded) {
                pageTabs(commonOptions)
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(options.scrollState),
                ) {
                    pageTabs(commonOptions)
                }
            }
        }
    }
}

/** Owns portrait measurement state and selected-control reveal effect. */
@Composable
private fun portraitFoldablePageControls(options: FoldablePageControlsOptions) {
    /** Owns manual and programmatic horizontal strip offset. */
    val scrollState: ScrollState = rememberScrollState()
    /** Stores selected control's source-coordinate start. */
    var selectedStartPx: Int by remember { mutableIntStateOf(0) }
    /** Stores selected control's source-coordinate end. */
    var selectedEndPx: Int by remember { mutableIntStateOf(0) }
    /** Stores visible horizontal viewport width. */
    var viewportWidthPx: Int by remember { mutableIntStateOf(0) }
    /** Attaches geometry reporting only to currently selected control. */
    val selectedModifier: Modifier = Modifier.onGloballyPositioned { coordinates ->
        /** Recovers stable source coordinate by adding current scroll translation. */
        val sourceStartPx: Int = coordinates.positionInParent().x.roundToInt() + scrollState.value
        selectedStartPx = sourceStartPx
        selectedEndPx = sourceStartPx + coordinates.size.width
    }
    LaunchedEffect(
        options.expanded,
        options.state.selectedPage,
        options.style,
        selectedStartPx,
        selectedEndPx,
        viewportWidthPx,
        scrollState.maxValue,
    ) {
        if (!options.expanded && viewportWidthPx > 0 && selectedEndPx > selectedStartPx) {
            scrollState.scrollTo(
                horizontalRevealOffset(
                    HorizontalRevealOptions(
                        currentOffsetPx = scrollState.value,
                        viewportWidthPx = viewportWidthPx,
                        itemStartPx = selectedStartPx,
                        itemEndPx = selectedEndPx,
                        maximumOffsetPx = scrollState.maxValue,
                    ),
                ),
            )
        }
    }
    portraitPageControlRow(
        PortraitPageControlRowOptions(
            fold = options,
            scrollState = scrollState,
            selectedModifier = selectedModifier,
            onViewportWidth = { viewportWidthPx = it },
        ),
    )
}

/** Displays portrait fold or unchanged fully wrapped landscape controls. */
@Composable
internal fun foldablePageControls(options: FoldablePageControlsOptions) {
    if (LocalConfiguration.current.orientation == Configuration.ORIENTATION_PORTRAIT) {
        portraitFoldablePageControls(options)
        return
    }
    pageTabs(
        PageTabsOptions(
            state = options.state,
            style = options.style,
            wrap = true,
            maximumWidth = null,
            selectedModifier = Modifier,
            onSelectPage = options.onSelectPage,
        ),
    )
}
