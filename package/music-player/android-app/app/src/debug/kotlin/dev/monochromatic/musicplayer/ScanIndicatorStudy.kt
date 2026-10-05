//region Non-permanent scan-F below the unchanged accepted player components
// What: Package joins the pure state, native bar and shared E2 player renderer.
// Why: The isolated surface does not need production playback or analysis callbacks.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose the native content tree and measured system insets.
// Why: The study reuses the accepted inner/cover player without replacing it with a replica.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Box, Column, Scaffold } from 'native-ui';
// ```
import androidx.compose.foundation.layout.Box
// Available native width chooses the existing inner versus cover route.
import androidx.compose.foundation.layout.BoxWithConstraints
// Stack the accepted bar after the full player instead of making it an error overlay.
import androidx.compose.foundation.layout.Column
// Consume Scaffold's system padding once.
import androidx.compose.foundation.layout.consumeWindowInsets
// The study and player use their available region.
import androidx.compose.foundation.layout.fillMaxSize
// Apply only measured system padding at the outer boundary.
import androidx.compose.foundation.layout.padding
// Native system inset source.
import androidx.compose.foundation.layout.WindowInsets
// Controls stay outside system bars and cutouts.
import androidx.compose.foundation.layout.safeDrawing
// Select the same player palette as the verified menu/overlay studies.
import androidx.compose.foundation.isSystemInDarkTheme
// Scaffold owns system insets, not production navigation.
import androidx.compose.material3.Scaffold
// Native function registration.
import androidx.compose.runtime.Composable
// Emit the state after it enters composition, separate from an input callback.
import androidx.compose.runtime.LaunchedEffect
// Immutable native layout configuration.
import androidx.compose.ui.Modifier
// Native density-independent literal distance.
import androidx.compose.ui.unit.dp

/**
 * What: A composable takes the current immutable record and separate action/diagnostic callbacks.
 * Why: State transitions are observable without triggering a scan, saving progress or touching audio.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function ScanIndicatorStudy(input: { state: ScanIndicatorState; onAction: (event: string) => void; onMeasure: (event: string) => void }): UIElement;
 * ```
 */
@Composable
internal fun ScanIndicatorStudy(state: ScanIndicatorState, onAction: (String) -> Unit, onMeasure: (String) -> Unit,
    controlPaddingDp: Int = 0) {
    // What: val binds this render's native theme; LaunchedEffect runs when the immutable state changes.
    // Why: A logged callback alone does not establish that its resulting state was composed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const light = !systemDark(); useEffect(() => log(state), [state]);
    // ```
    val light = !isSystemInDarkTheme()
    LaunchedEffect(state) {
        onMeasure("ScanIndicator.composed:${state.phase}:${state.done}:${state.total}:visible=${scanIndicatorVisible(state)}")
    }
    // What: Nested trailing lambdas supply the children of native layout components.
    // Why: Bar appearance reserves its own bottom row, while pause/count updates retain the same player slot.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <SafeColumn><Box flex={1}><AcceptedPlayer/></Box>{visible && <ScanBar/>}</SafeColumn>
    // ```
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isCover: Boolean = maxWidth < 600.dp
        Scaffold(contentWindowInsets = WindowInsets.safeDrawing) { padding ->
            Column(modifier = Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)
                .scanIndicatorMeasure("root", onMeasure)) {
                Box(modifier = Modifier.weight(1f).fillMaxSize().scanIndicatorMeasure("player", onMeasure)) {
                    SearchPlayerPreview(isCover = isCover, light = light,
                        onSearch = { onMeasure("ScanIndicator.search-intent-only") },
                        e2InformationStartInset = 12.dp,
                        trackViewportModifier = Modifier.scanIndicatorMeasure("viewport", onMeasure))
                }
                if (scanIndicatorVisible(state)) {
                    ScanIndicatorBar(state = state, onAction = onAction, onMeasure = onMeasure,
                        controlPaddingDp = controlPaddingDp)
                }
            }
        }
    }
}
//endregion
