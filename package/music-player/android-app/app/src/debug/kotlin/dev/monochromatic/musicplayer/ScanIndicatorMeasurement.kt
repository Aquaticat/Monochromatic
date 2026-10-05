//region Native application-coordinate rectangles, not glyph bounds or activation proof
// What: Package connects private study diagnostics to the isolated host.
// Why: Geometry can be compared without querying production UI state.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose the immutable layout chain and post-layout coordinates.
// Why: Measurements come from the native renderer rather than predicted dp positions.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier, boundsInRoot, onLayout } from 'native-ui';
// ```
import androidx.compose.ui.Modifier
// Measure all study elements relative to the same application root.
import androidx.compose.ui.layout.boundsInRoot
// Observe the result after native layout has placed the element.
import androidx.compose.ui.layout.onGloballyPositioned

/**
 * What: A Modifier extension returns the receiver with a post-layout callback; this names that receiver.
 * Why: Each measured region retains the caller's existing native layout and input owner.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function measure(input: { modifier: Modifier; name: string; log: (event: string) => void }): Modifier;
 * ```
 */
internal fun Modifier.scanIndicatorMeasure(name: String, onEvent: (String) -> Unit): Modifier {
    // What: The trailing lambda receives native coordinates and forwards their root-relative rectangle.
    // Why: The private log distinguishes player reservation, viewport, bar and actual button dimensions.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return modifier.onLayout(coordinates => log('ScanIndicator.rect:' + name + ':' + boundsInRoot(coordinates)));
    // ```
    return this.onGloballyPositioned { coordinates ->
        onEvent("ScanIndicator.rect:$name:${coordinates.boundsInRoot()}")
    }
}
//endregion
