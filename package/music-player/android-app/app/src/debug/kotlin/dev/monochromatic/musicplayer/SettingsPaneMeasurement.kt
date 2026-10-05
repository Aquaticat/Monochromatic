//region Measured Settings rectangles, private diagnostics rather than layout decisions
// What: Package shares the diagnostic helper with the Settings pane and its study host.
// Why: Fit claims come from rectangles the device reported, not from expected dp arithmetic.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose the layout-configuration type and two position-reading helpers.
// Why: A modifier can report where its element was actually placed without changing that placement.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier, boundsInRoot, onGloballyPositioned } from 'native-ui';
// ```
import androidx.compose.ui.Modifier
// Converts placed coordinates into a rectangle relative to the window content root.
import androidx.compose.ui.layout.boundsInRoot
// Calls back after layout with the element's final coordinates.
import androidx.compose.ui.layout.onGloballyPositioned

/**
 * What: `fun Modifier.settingsPaneMeasure(...)` is an extension function: it is called as
 * `modifier.settingsPaneMeasure(name, onEvent)` and `this` inside it is that modifier.
 * `(String) -> Unit` is a function type taking one string and returning nothing.
 * Why: Every measured element reports through one named, tagged line format that the capture
 * scripts parse, so a renamed or missing measurement fails loudly instead of being guessed.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function settingsPaneMeasure(input: { modifier: Modifier; name: string; onEvent: (line: string) => void }): Modifier;
 * ```
 */
internal fun Modifier.settingsPaneMeasure(name: String, onEvent: (String) -> Unit): Modifier {
    // What: `{ coordinates -> ... }` is a lambda (an arrow function) run after each layout pass;
    // `$name` and `${...}` splice values into the string like a TypeScript template literal.
    // Why: The rectangle is in physical pixels of the window root, the same space as a screenshot.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return modifier.onPositioned(coordinates => onEvent(`SettingsPane.rect:${name}:${boundsInRoot(coordinates)}`));
    // ```
    return this.onGloballyPositioned { coordinates ->
        onEvent("SettingsPane.rect:$name:${coordinates.boundsInRoot()}")
    }
}
//endregion
