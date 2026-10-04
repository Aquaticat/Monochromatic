//region Authored native fit study, no source discovery, playback or storage mutation
// What: Package connects this isolated renderer to its debug fixture and host.
// Why: No production activity or operation owner is constructed.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports supply native layout functions and measured coordinates.
// Why: The Undo overlay follows the existing track viewport instead of copying a deck layout.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Box, boundsInRoot } from 'native-ui';
// ```
import androidx.compose.foundation.layout.Box
// Width/height constraints distinguish the cover panel from the inner panel.
import androidx.compose.foundation.layout.BoxWithConstraints
// Consume Scaffold-owned insets before the shared player handles its local insets.
import androidx.compose.foundation.layout.consumeWindowInsets
// Fill the study's available native area.
import androidx.compose.foundation.layout.fillMaxSize
// Offset relocates only the overlay, not any player content.
import androidx.compose.foundation.layout.offset
// Padding gives the overlay its accepted 16dp edge separation.
import androidx.compose.foundation.layout.padding
// Explicit size reproduces the measured track viewport for the overlay's local coordinates.
import androidx.compose.foundation.layout.size
// Safe drawing avoids system bars and cutouts.
import androidx.compose.foundation.layout.WindowInsets
// Platform safe-drawing inset source.
import androidx.compose.foundation.layout.safeDrawing
// Native system appearance selects the existing player palette.
import androidx.compose.foundation.isSystemInDarkTheme
// Scaffold owns the error bar and remaining player area.
import androidx.compose.material3.Scaffold
// Composable functions emit native UI.
import androidx.compose.runtime.Composable
// LaunchedEffect records one authored scene entry, without an operation or timer.
import androidx.compose.runtime.LaunchedEffect
// remember keeps local presentation state for this isolated scene.
import androidx.compose.runtime.remember
// Mutable state triggers layout after measurements or error dismissal.
import androidx.compose.runtime.mutableStateOf
// Delegated state getter unwraps the stored presentation value.
import androidx.compose.runtime.getValue
// Corresponding setter writes only the local presentation value.
import androidx.compose.runtime.setValue
// BottomStart aligns the toast to its measured list owner.
import androidx.compose.ui.Alignment
// Modifier is immutable native layout configuration.
import androidx.compose.ui.Modifier
// Rect stores four floating-point pixel edges, not glyph or action bounds.
import androidx.compose.ui.geometry.Rect
// boundsInRoot uses one coordinate system for player viewport and enclosing study.
import androidx.compose.ui.layout.boundsInRoot
// Position callbacks report settled layout bounds, not storage or gesture outcomes.
import androidx.compose.ui.layout.onGloballyPositioned
// Density converts measured physical pixels into layout dp.
import androidx.compose.ui.platform.LocalDensity
// dp converts literal layout distances.
import androidx.compose.ui.unit.dp

/**
 * What: A named composable combines authored feedback with the accepted shared player renderer.
 * Why: Row omission and toast/bar placement can be inspected without real operation results.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function LightFeedbackStudy(input: { scene: string; onAction: (event: string) => void }): UIElement;
 * ```
 */
@Composable
internal fun LightFeedbackStudy(scene: String, onAction: (String) -> Unit) {
    // What: val is immutable for this render pass, unlike replaceable var.
    // Why: Every rendered state is bound to the exact validated scene, never a fallback.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const fixture = lightFeedbackFixture(scene);
    // ```
    val fixture = lightFeedbackFixture(scene)
    val density = LocalDensity.current
    val light = !isSystemInDarkTheme()
    // What: by delegates reads/writes to Compose state; remember retains it for this scene.
    // Why: Dismiss removes only the authored error bar, not a file or error source.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [errorVisible, setErrorVisible] = useState(fixture.error !== '');
    // ```
    var errorVisible by remember(scene) { mutableStateOf(fixture.error.isNotEmpty()) }
    // What: Rect? permits null until native layout reports its first measured rectangle.
    // Why: No guessed deck height or panel position is promoted into placement evidence.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [rootBounds, setRootBounds] = useState<Rect | null>(null);
    // ```
    var rootBounds: Rect? by remember(scene) { mutableStateOf(null) }
    // The viewport begins unknown for the same reason as the root.
    var trackBounds: Rect? by remember(scene) { mutableStateOf(null) }
    // What: Trailing lambdas supply callbacks rather than execute a descriptor or command.
    // Why: Entry logging remains a private event, with no native service launch.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // onMount(() => onAction('LightFeedbackStudy.entry:' + scene));
    // ```
    LaunchedEffect(scene) { onAction("LightFeedbackStudy.entry:$scene") }
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isCover: Boolean = maxWidth < 600.dp
        Scaffold(contentWindowInsets = WindowInsets.safeDrawing, bottomBar = {
            if (errorVisible) {
                LightFeedbackErrorBar(message = fixture.error, isCover = isCover, onDismiss = {
                    errorVisible = false
                    onAction("LightFeedbackStudy.dismiss:$scene")
                }, onMeasure = onAction)
            }
        }) { padding ->
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
                // Explicit nullable bindings preserve the measured values for this branch.
                val root: Rect? = rootBounds
                val tracks: Rect? = trackBounds
                if (fixture.undo && root != null && tracks != null) {
                    // What: with(density) temporarily supplies pixel-to-dp conversion functions.
                    // Why: Root and viewport measurements are physical pixels; overlay layout uses dp.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const left = (tracks.left - root.left) / density;
                    // ```
                    val left = with(density) { (tracks.left - root.left).toDp() }
                    // Convert the remaining measured edges with the same density.
                    val top = with(density) { (tracks.top - root.top).toDp() }
                    val width = with(density) { tracks.width.toDp() }
                    val height = with(density) { tracks.height.toDp() }
                    Box(modifier = Modifier.offset(x = left, y = top).size(width = width, height = height)) {
                        Box(modifier = Modifier.align(Alignment.BottomStart).padding(start = 16.dp, bottom = 16.dp)) {
                            LightFeedbackUndoToast(maximumWidth = width - 32.dp, onUndo = {
                                // An intent event is not a successful restore; rows are not returned by this callback.
                                onAction("LightFeedbackStudy.undo-intent:Ghost")
                            }, onMeasure = onAction)
                        }
                    }
                }
            }
        }
    }
}
//endregion
