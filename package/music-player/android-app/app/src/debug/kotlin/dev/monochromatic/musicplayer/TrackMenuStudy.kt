//region Shared player with one replacement row input owner and a measured native menu anchor
// What: Package shares the isolated menu models and accepted player renderer.
// Why: The study never instantiates a production source, playback or analysis owner.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose native gestures, layout and state.
// Why: Long press and tap have one input owner rather than competing stacked click modifiers.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Box, combinedClickable, useState } from 'native-ui';
// ```
import androidx.compose.foundation.combinedClickable
// The existing theme follows Android appearance.
import androidx.compose.foundation.isSystemInDarkTheme
// Fixed-size overlay anchor shares the player's root coordinate system.
import androidx.compose.foundation.layout.Box
// Physical panel width selects the accepted cover or inner composition.
import androidx.compose.foundation.layout.BoxWithConstraints
// Consume only the system insets supplied by Scaffold.
import androidx.compose.foundation.layout.consumeWindowInsets
// Root study uses the full available area.
import androidx.compose.foundation.layout.fillMaxSize
// Offsetting an overlay does not move player content.
import androidx.compose.foundation.layout.offset
// Scaffold padding belongs to system bars and cutouts.
import androidx.compose.foundation.layout.padding
// The anchor matches the measured visible row rectangle.
import androidx.compose.foundation.layout.size
// System inset source.
import androidx.compose.foundation.layout.WindowInsets
// Safe drawing excludes status/navigation and display cutouts.
import androidx.compose.foundation.layout.safeDrawing
// The activity scaffold has no menu-owned layout reservation.
import androidx.compose.material3.Scaffold
// Native composition declaration.
import androidx.compose.runtime.Composable
// Entry diagnostics have a lifecycle owner.
import androidx.compose.runtime.LaunchedEffect
// Keep local study state across recomposition.
import androidx.compose.runtime.remember
// Immutable values are replaced through Compose state.
import androidx.compose.runtime.mutableStateOf
// Delegated state reads.
import androidx.compose.runtime.getValue
// Delegated state writes.
import androidx.compose.runtime.setValue
// A new target owns its own native menu state.
import androidx.compose.runtime.key
// Immutable layout configuration.
import androidx.compose.ui.Modifier
// Physical rectangles are distinct from glyph bounds.
import androidx.compose.ui.geometry.Rect
// Activity-root coordinates position the anchor overlay.
import androidx.compose.ui.layout.boundsInRoot
// Native layout callback supplies real row positions.
import androidx.compose.ui.layout.onGloballyPositioned
// Measured pixel distances convert using actual device density.
import androidx.compose.ui.platform.LocalDensity
// Preserve row button semantics with the replacement input owner.
import androidx.compose.ui.semantics.Role
// Literal layout distances.
import androidx.compose.ui.unit.dp

/**
 * What: A named composable receives a validated scene and a debug-only event callback.
 * Why: The actual authored row owns the menu identity while all production actions remain unreachable.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TrackMenuStudy(input: { scene: string; onEvent: (value: string) => void }): UIElement;
 * ```
 */
@Composable
internal fun TrackMenuStudy(scene: String, onEvent: (String) -> Unit) {
    // What: val retains one read-only fixture list for this render pass.
    // Why: Both the rendered rows and target lookup consume exactly the same data.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const tracks = trackMenuTracks(scene);
    // ```
    val tracks = trackMenuTracks(scene)
    val density = LocalDensity.current
    val light = !isSystemInDarkTheme()
    // What: by delegates replaceable var state to Compose; Rect? allows the not-yet-measured state.
    // Why: No guessed screen origin can position the menu before layout.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [rootBounds, setRootBounds] = useState<Rect | null>(null);
    // ```
    var rootBounds: Rect? by remember(scene) { mutableStateOf(null) }
    // Map is read-only rather than MutableMap; each layout callback replaces its immutable snapshot.
    var rowBounds: Map<Int, Rect> by remember(scene) { mutableStateOf(emptyMap()) }
    // Target survives the closing animation while expanded controls visibility.
    var selected: TrackMenuTarget? by remember(scene) { mutableStateOf(null) }
    var expanded: Boolean by remember(scene) { mutableStateOf(false) }
    LaunchedEffect(scene) { onEvent("TrackMenu.entry:$scene") }
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isCover: Boolean = maxWidth < 600.dp
        Scaffold(contentWindowInsets = WindowInsets.safeDrawing) { padding ->
            Box(modifier = Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)
                .trackMenuMeasure("root", onEvent)
                .onGloballyPositioned { coordinates -> rootBounds = coordinates.boundsInRoot() }) {
                SearchPlayerPreview(
                    isCover = isCover,
                    light = light,
                    onSearch = { onEvent("TrackMenu.search-intent:$scene") },
                    e2InformationStartInset = 12.dp,
                    trackInputs = tracks,
                    trackViewportModifier = Modifier.trackMenuMeasure("viewport", onEvent),
                    trackInteraction = { index, track ->
                        Modifier.trackMenuMeasure("row:$index", onEvent)
                            .onGloballyPositioned { coordinates ->
                                // What: to builds a key/value pair and + creates a new Map snapshot.
                                // Why: Measuring a row does not mutate a shared fixture or unrelated row data.
                                //
                                // In TS you'd write (pseudocode):
                                // ```ts
                                // setRows(new Map([...rows, [index, coordinates.boundsInRoot()]]));
                                // ```
                                rowBounds = rowBounds + (index to coordinates.boundsInRoot())
                            }
                            .combinedClickable(
                                role = Role.Button,
                                onClick = { onEvent("TrackMenu.row-tap:$scene:$index") },
                                onLongClickLabel = "Track actions",
                                onLongClick = {
                                    selected = trackMenuTarget(index = index, tracks = tracks)
                                    expanded = true
                                    onEvent("TrackMenu.opened:$scene:$index")
                                    onEvent("TrackMenu.target-title:${track.title}")
                                },
                            )
                    },
                )
                // Local immutable bindings make nullable state safe to use inside this render branch.
                val target = selected
                val root = rootBounds
                if (target != null && root != null) {
                    val anchor = rowBounds[target.sourceIndex]
                    if (anchor != null && anchor.width > 0 && anchor.height > 0) {
                        // What: with supplies density conversion helpers inside each lambda.
                        // Why: Popup anchor geometry is measured in pixels while layout distances use dp.
                        //
                        // In TS you'd write (pseudocode):
                        // ```ts
                        // const left = (anchor.left - root.left) / density;
                        // ```
                        val left = with(density) { (anchor.left - root.left).toDp() }
                        val top = with(density) { (anchor.top - root.top).toDp() }
                        val width = with(density) { anchor.width.toDp() }
                        val height = with(density) { anchor.height.toDp() }
                        Box(modifier = Modifier.offset(x = left, y = top).size(width = width, height = height)
                            .trackMenuMeasure("anchor", onEvent)) {
                            key(target.sourceIndex) {
                                TrackMenuPopup(
                                    target = target,
                                    expanded = expanded,
                                    informationStartInset = if (isCover) 0.dp else 12.dp,
                                    onDismiss = {
                                        expanded = false
                                        onEvent("TrackMenu.closed:outside-or-back:$scene:${target.sourceIndex}")
                                    },
                                    onIntent = { id ->
                                        val action = trackMenuAction(id)
                                        onEvent("TrackMenu.intent:$scene:${target.sourceIndex}:${action.id}")
                                        expanded = false
                                        onEvent("TrackMenu.closed:action:$scene:${target.sourceIndex}:${action.id}")
                                    },
                                    onEvent = onEvent,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
//endregion
