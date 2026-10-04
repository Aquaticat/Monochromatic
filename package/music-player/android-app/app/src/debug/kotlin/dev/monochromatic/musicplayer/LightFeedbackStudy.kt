//region Authored overlay study, no player-space reservation or storage/playback mutation
// What: Package connects the isolated host, outcome fixtures and floating notices.
// Why: Feedback can be exercised without constructing a production operation owner.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose native layout, snackbar lifecycle and measured coordinates.
// Why: The player remains unchanged while feedback is placed inside its existing track viewport.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Box, SnackbarHost } from 'native-ui';
// ```
import androidx.compose.foundation.layout.Box
// Native constraints distinguish the two physical panels.
import androidx.compose.foundation.layout.BoxWithConstraints
// Column stacks simultaneous authored notices within the overlay only.
import androidx.compose.foundation.layout.Column
// Arrangement reserves separation between simultaneous overlays, never in the player.
import androidx.compose.foundation.layout.Arrangement
// Consume only the Scaffold-owned system insets.
import androidx.compose.foundation.layout.consumeWindowInsets
// Native study fills its available area.
import androidx.compose.foundation.layout.fillMaxSize
// Offset changes overlay placement, not player layout.
import androidx.compose.foundation.layout.offset
// Padding gives the overlay its existing 16dp edge separation.
import androidx.compose.foundation.layout.padding
// Explicit size matches the measured track viewport.
import androidx.compose.foundation.layout.size
// Window system-inset source.
import androidx.compose.foundation.layout.WindowInsets
// Safe drawing keeps controls out of system bars and cutouts.
import androidx.compose.foundation.layout.safeDrawing
// Actual system appearance selects the existing player palette.
import androidx.compose.foundation.isSystemInDarkTheme
// Scaffold supplies system-inset handling only; it has no feedback bottomBar.
import androidx.compose.material3.Scaffold
// The host performs native timed/manual dismissal and animation.
import androidx.compose.material3.SnackbarHost
// Host state owns one notice lifecycle, separate from storage outcomes.
import androidx.compose.material3.SnackbarHostState
// Short is the actual transient path; Indefinite is an explicitly authored capture hold only.
import androidx.compose.material3.SnackbarDuration
// Native composition marker.
import androidx.compose.runtime.Composable
// Lifecycle effect can call the native suspending snackbar API.
import androidx.compose.runtime.LaunchedEffect
// Retain local presentation state for a scene.
import androidx.compose.runtime.remember
// Coordinate state triggers overlay placement after measurement.
import androidx.compose.runtime.mutableStateOf
// Delegated state reads.
import androidx.compose.runtime.getValue
// Delegated state writes.
import androidx.compose.runtime.setValue
// BottomStart anchors the overlay to its measured owner.
import androidx.compose.ui.Alignment
// Immutable layout configuration.
import androidx.compose.ui.Modifier
// Four measured pixel edges, not glyph or pointer-activation evidence.
import androidx.compose.ui.geometry.Rect
// Shared root-coordinate measurement.
import androidx.compose.ui.layout.boundsInRoot
// Callback after native layout.
import androidx.compose.ui.layout.onGloballyPositioned
// Physical pixels convert into native dp at actual density.
import androidx.compose.ui.platform.LocalDensity
// Literal layout distance conversion.
import androidx.compose.ui.unit.dp

/**
 * What: A named composable retains the accepted player and overlays independent transient notice hosts.
 * Why: D83 feedback appearance, expiry and manual dismissal never resize the browser, list or deck.
 * Capture hold is an explicit debug pose, not the default runtime duration or timeout acceptance.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function LightFeedbackStudy(input: { scene: string; onEvent: (event: string) => void; holdForCapture?: boolean }): UIElement;
 * ```
 */
@Composable
internal fun LightFeedbackStudy(scene: String, onAction: (String) -> Unit, holdForCapture: Boolean = false) {
    // What: val is a read-only binding, unlike replaceable var.
    // Why: Each render pass is tied to one validated authored outcome, never a fallback operation result.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const fixture = lightFeedbackFixture(scene);
    // ```
    val fixture = lightFeedbackFixture(scene)
    val density = LocalDensity.current
    val light = !isSystemInDarkTheme()
    val errorHost = remember(scene) { SnackbarHostState() }
    val undoHost = remember(scene) { SnackbarHostState() }
    // What: An if expression chooses a native enum value rather than a descriptor or timer command.
    // Why: Real transient behavior stays default; static fit capture explicitly declares a held pose.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const duration = holdForCapture ? 'held-debug-pose' : 'native-short';
    // ```
    val duration = if (holdForCapture) SnackbarDuration.Indefinite else SnackbarDuration.Short
    // What: Rect? permits null before native layout; by delegates state reads/writes to Compose.
    // Why: No guessed panel or deck dimensions become placement evidence.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [rootBounds, setRootBounds] = useState<Rect | null>(null);
    // ```
    var rootBounds: Rect? by remember(scene) { mutableStateOf(null) }
    // Track viewport has the same measured-only initial state.
    var trackBounds: Rect? by remember(scene) { mutableStateOf(null) }
    // What: LaunchedEffect supplies a lifecycle callback; showSnackbar is suspending native work.
    // Why: The platform host owns expiry and accessibility-adjusted timeout, not an invented fixed timer.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // onMount(async () => { log(fullDetails); await showNativeNotice({ duration }); log('ended'); });
    // ```
    LaunchedEffect(scene, holdForCapture) {
        onAction("LightFeedbackStudy.entry:$scene,captureHold=$holdForCapture")
        if (fixture.error.isNotEmpty()) {
            onAction("LightFeedbackStudy.operation-details:$scene:${fixture.error}")
            val result = errorHost.showSnackbar(message = fixture.error, actionLabel = "Dismiss message",
                withDismissAction = true, duration = duration)
            onAction("LightFeedbackStudy.error-ended:$scene:$result")
        }
    }
    LaunchedEffect(scene, holdForCapture) {
        if (fixture.undo) {
            val result = undoHost.showSnackbar(message = "Ghost moved to trash", actionLabel = "Undo",
                withDismissAction = true, duration = duration)
            onAction("LightFeedbackStudy.undo-ended:Ghost:$result")
        }
    }
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isCover: Boolean = maxWidth < 600.dp
        Scaffold(contentWindowInsets = WindowInsets.safeDrawing) { padding ->
            Box(modifier = Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)
                .onGloballyPositioned { coordinates ->
                    rootBounds = coordinates.boundsInRoot()
                    onAction("LightFeedbackStudy.root:$rootBounds")
                }) {
                SearchPlayerPreview(isCover = isCover, light = light,
                    onSearch = { onAction("LightFeedbackStudy.search-intent:$scene") },
                    omittedTitles = fixture.omittedTitles,
                    trackViewportModifier = Modifier.onGloballyPositioned { coordinates ->
                        trackBounds = coordinates.boundsInRoot()
                        onAction("LightFeedbackStudy.viewport:$trackBounds")
                    })
                // Preserve explicitly nullable measured values for this render branch.
                val root: Rect? = rootBounds
                val tracks: Rect? = trackBounds
                if (root != null && tracks != null) {
                    // What: with supplies density conversion functions only within each callback.
                    // Why: Measurements are pixels while overlay placement uses dp.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const left = (tracks.left - root.left) / density;
                    // ```
                    val left = with(density) { (tracks.left - root.left).toDp() }
                    // Convert the remaining measured dimensions with the same density.
                    val top = with(density) { (tracks.top - root.top).toDp() }
                    val width = with(density) { tracks.width.toDp() }
                    val height = with(density) { tracks.height.toDp() }
                    val bothVisible = errorHost.currentSnackbarData != null && undoHost.currentSnackbarData != null
                    Box(modifier = Modifier.offset(x = left, y = top).size(width = width, height = height)) {
                        Column(modifier = Modifier.align(Alignment.BottomStart).padding(start = 16.dp, bottom = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(if (bothVisible) 16.dp else 0.dp)) {
                            SnackbarHost(hostState = undoHost) { data ->
                                LightFeedbackUndoNotice(maximumWidth = width - 32.dp, data = data, onEvent = onAction)
                            }
                            SnackbarHost(hostState = errorHost) { data ->
                                LightFeedbackErrorNotice(scene = scene, message = fixture.error,
                                    maximumWidth = width - 32.dp, data = data, onEvent = onAction)
                            }
                        }
                    }
                }
            }
        }
    }
}
//endregion
