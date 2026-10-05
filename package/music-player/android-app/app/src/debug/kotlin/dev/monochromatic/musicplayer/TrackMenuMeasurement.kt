//region Screen-coordinate diagnostics for separate native popup windows
// What: Package connects the isolated menu renderer and its measurement hooks.
// Why: A popup's local root is not the activity's root, so their coordinates cannot be mixed.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose immutable modifiers and native coordinate conversion.
// Why: Pointer probes use measured physical screen positions, not popup-local guesses.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier, Offset, onLayout } from 'native-ui';
// ```
import androidx.compose.ui.Modifier
// Offset holds a two-dimensional position.
import androidx.compose.ui.geometry.Offset
// The callback runs when native layout coordinates are available.
import androidx.compose.ui.layout.onGloballyPositioned

/**
 * What: An extension function returns a modifier with a native layout callback.
 * Its trailing lambda receives coordinates; val makes each sampled value read-only.
 * Why: Converting both corners to screen space preserves the popup's actual window offset and transform.
 * These rectangles are layout diagnostics, not visible-glyph or successful-touch proof.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function trackMenuMeasure(input: { modifier: Modifier; name: string; onEvent: (value: string) => void }): Modifier {
 *   return onLayout(input.modifier, coordinates => logScreenCorners(coordinates));
 * }
 * ```
 */
internal fun Modifier.trackMenuMeasure(name: String, onEvent: (String) -> Unit): Modifier =
    onGloballyPositioned { coordinates ->
        val topLeft = coordinates.localToScreen(Offset.Zero)
        // What: toFloat converts Int dimensions to the Float coordinates required by Offset.
        // Why: Screen conversion must include any native transform on the opposite corner too.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const bottomRight = coordinates.localToScreen({ x: coordinates.width, y: coordinates.height });
        // ```
        val bottomRight = coordinates.localToScreen(Offset(coordinates.size.width.toFloat(), coordinates.size.height.toFloat()))
        onEvent("TrackMenu.rect:$name:${topLeft.x},${topLeft.y},${bottomRight.x},${bottomRight.y}")
    }
//endregion
