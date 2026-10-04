//region Private layout rectangles, never ink, activation or operation-success evidence
// What: Package shares the isolated feedback study's namespace.
// Why: Measurement events stay inside the owned debug host.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports provide immutable Modifier configuration and position callbacks.
// Why: Actual native layout dimensions can be checked without mistaking semantic bounds for layout.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier, boundsInRoot } from 'native-ui';
// ```
import androidx.compose.ui.Modifier
// boundsInRoot reports pixel edges in the same root coordinate system as the player viewport.
import androidx.compose.ui.layout.boundsInRoot
// This callback runs after native layout, not after a storage or pointer operation.
import androidx.compose.ui.layout.onGloballyPositioned

/**
 * What: A named function returns one position-observing Modifier and accepts a callback.
 * Why: Fit verification retains measured surface/control rectangles rather than assuming declared minima.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function lightFeedbackMeasurement(name: string, onEvent: (event: string) => void): Modifier;
 * ```
 */
internal fun lightFeedbackMeasurement(name: String, onEvent: (String) -> Unit): Modifier {
    // What: A trailing lambda supplies the callback; return passes the Modifier to the caller.
    // Why: Events report only layout edges and cannot perform or assert successful trash/restore.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return observePosition(rect => onEvent(`measurement:${name}:${rect.left},${rect.top},${rect.right},${rect.bottom}`));
    // ```
    return Modifier.onGloballyPositioned { coordinates ->
        // What: val is a read-only binding holding the measured rectangle for this callback.
        // Why: All edges in the event belong to the same layout observation.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const rect = boundsInRoot(coordinates);
        // ```
        val rect = coordinates.boundsInRoot()
        onEvent("LightFeedbackMeasurement.$name:${rect.left},${rect.top},${rect.right},${rect.bottom}")
    }
}
//endregion
