//region Measured Settings rectangles, private diagnostics rather than layout decisions
// What: Package shares the diagnostic helper with the Settings pane and its study host.
// Why: Fit claims come from rectangles the device reported, not from expected dp arithmetic.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose the layout-configuration type, a rectangle value and position-reading helpers.
// Why: A modifier can report where its element was actually placed without changing that placement.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier, Rect, boundsInRoot, onGloballyPositioned, positionInRoot } from 'native-ui';
// ```
import androidx.compose.ui.Modifier
// Four floating-point edges: left, top, right, bottom.
import androidx.compose.ui.geometry.Rect
// The visible rectangle relative to the window content root, clipped by scrolling ancestors.
import androidx.compose.ui.layout.boundsInRoot
// Calls back after layout with the element's final coordinates.
import androidx.compose.ui.layout.onGloballyPositioned
// The element's unclipped top-left corner relative to the window content root.
import androidx.compose.ui.layout.positionInRoot

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
    // Why: Both rectangles are in physical pixels of the window root, the same space as a screenshot.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return modifier.onPositioned(coordinates => { onEvent(`SettingsPane.rect:${name}:${visible}`); onEvent(`SettingsPane.full:${name}:${full}`); });
    // ```
    return this.onGloballyPositioned { coordinates ->
        // The visible part: a row scrolled partly out of its viewport reports only what shows.
        onEvent("SettingsPane.rect:$name:${coordinates.boundsInRoot()}")
        // What: val binds the unclipped corner; `Rect(...)` constructs a rectangle from four edges;
        // `coordinates.size` holds whole-pixel width and height, added to the fractional corner.
        // Why: A scrolled-away row would otherwise look shorter than it is; sizes are judged on the
        // whole element and visibility on the clipped rectangle, kept as two separate lines.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const origin = positionInRoot(coordinates);
        // const full = { left: origin.x, top: origin.y, right: origin.x + size.width, bottom: origin.y + size.height };
        // ```
        val origin = coordinates.positionInRoot()
        val full = Rect(origin.x, origin.y, origin.x + coordinates.size.width, origin.y + coordinates.size.height)
        onEvent("SettingsPane.full:$name:$full")
    }
}
//endregion
