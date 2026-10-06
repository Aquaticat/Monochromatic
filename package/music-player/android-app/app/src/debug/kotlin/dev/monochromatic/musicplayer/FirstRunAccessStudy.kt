//region Debug-only Compose fit surface, actions emit diagnostics and cannot touch real state
// What: This package shares only the namespace, not the production activity's lifecycle.
// Why: Calling the study never starts discovery, playback, permission or analysis code.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose Compose layouts, controls and read-only theme values.
// Why: Use native UI rather than an HTML imitation for panel/text-scale evidence.
//
// In TS you'd write (pseudocode):
// ```ts
// import { BoxWithConstraints } from 'compose/layout';
// ```
import androidx.compose.foundation.layout.BoxWithConstraints
// Column lays content vertically.
import androidx.compose.foundation.layout.Column
// Arrangement supplies explicit spacing between children.
import androidx.compose.foundation.layout.Arrangement
// Full-window layout keeps the Scaffold responsible for system insets.
import androidx.compose.foundation.layout.fillMaxSize
// Native action minimum height, not inferred text rectangles.
import androidx.compose.foundation.layout.heightIn
// Native action minimum width for explicit 48dp layout bounds.
import androidx.compose.foundation.layout.widthIn
// Padding is applied to the scrolling child after system-bar insets.
import androidx.compose.foundation.layout.padding
// Each new scene starts at the top of its own owned scroll state.
import androidx.compose.foundation.rememberScrollState
// Native scrolling exposes oversized 200% text instead of clipping it silently.
import androidx.compose.foundation.verticalScroll
// Filled primary action follows D10.
import androidx.compose.material3.Button
// Outlined actions: the optional folder alternative and the subordinate Settings action,
// which is not a permission-recovery promise.
import androidx.compose.material3.OutlinedButton
// Material theme provides system appearance and text roles.
import androidx.compose.material3.MaterialTheme
// Scaffold supplies the actual Android system-bar insets.
import androidx.compose.material3.Scaffold
// Text paints the authored scene copy.
import androidx.compose.material3.Text
// What: Composable marks native render functions, not ordinary data functions.
// Why: Layout and theme reads occur within a Compose render pass.
//
// In TS you'd write (pseudocode):
// ```ts
// // A component function returns UI.
// ```
import androidx.compose.runtime.Composable
// Modifier is an immutable layout instruction value.
import androidx.compose.ui.Modifier
// What: dp converts numeric literals to Android logical layout dimensions.
// Why: Action minima and crease-aware spacing use the platform's density.
//
// In TS you'd write (pseudocode):
// ```ts
// import { dp } from 'compose/units';
// ```
import androidx.compose.ui.unit.dp

/**
 * What: A composable takes one scene and a callback; () -> Unit means a no-result function.
 * Why: Callback ownership belongs to the debug activity, not production recovery code.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function FirstRunAccessStudy(scene: string, onAction: (action: string) => void): UI { ... }
 * ```
 */
@Composable
internal fun FirstRunAccessStudy(scene: String, onAction: (String) -> Unit) {
    // What: val is a read-only binding, unlike reassignable var.
    // Why: One exact scene determines every visible label in this render pass.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const fixture = firstRunAccessFixture(scene);
    // ```
    val fixture: FirstRunAccessFixture = firstRunAccessFixture(scene)
    // What: A trailing lambda is the final function argument; insets is its supplied parameter.
    // Why: Scaffold computes native system-bar spacing instead of hard-coded status heights.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return Scaffold({ modifier: fillMaxSize(), content: (insets) => ... });
    // ```
    Scaffold(modifier = Modifier.fillMaxSize()) { insets ->
        // BoxWithConstraints exposes the actual available logical width.
        BoxWithConstraints(modifier = Modifier.fillMaxSize().padding(insets)) {
            // What: if/else is an expression assigned to a read-only dimension.
            // Why: Inner text stays wholly beyond the measured central dent; cover uses full width.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const start = maxWidth >= dp(600) ? maxWidth / 2 + dp(24) : dp(24);
            // ```
            val start = if (maxWidth >= 600.dp) maxWidth / 2 + 24.dp else 24.dp
            // What: Named arguments set the scrolling parent's layout; the final lambda contains UI.
            // Why: Content can extend vertically at 200% without an artificial compact-spacing fallback.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return Column({ modifier: ..., verticalArrangement: spacedBy(dp(24)), children: ... });
            // ```
            Column(
                modifier = Modifier.fillMaxSize().padding(start = start, end = 24.dp)
                    .verticalScroll(rememberScrollState()).padding(top = 24.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                Text(fixture.title, style = MaterialTheme.typography.headlineSmall)
                Text(fixture.body, style = MaterialTheme.typography.bodyLarge)
                // What: The click lambda forwards the fixture's authored event name to the callback.
                // Why: The debug activity logs the primary event (allow-access or open-folder) without
                // requesting permission, opening a picker or changing source.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // Button({ onClick: () => onAction(fixture.primaryEvent), children: Text(fixture.primary) });
                // ```
                Button(
                    onClick = { onAction(fixture.primaryEvent) },
                    modifier = Modifier.widthIn(min = 48.dp).heightIn(min = 48.dp),
                ) { Text(fixture.primary) }
                // What: A local val copies the nullable label so the null check narrows it to String.
                // Why: Only scenes with an authored folder alternative draw this button, between the
                // filled action and Settings; its debug event never opens a picker.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const secondary = fixture.secondary;
                // if (secondary !== null) OutlinedButton({ onClick: () => onAction('open-folder'), children: Text(secondary) });
                // ```
                val secondary: String? = fixture.secondary
                if (secondary != null) {
                    OutlinedButton(
                        onClick = { onAction("open-folder") },
                        modifier = Modifier.widthIn(min = 48.dp).heightIn(min = 48.dp),
                    ) { Text(secondary) }
                }
                // Settings is in-app Settings; this debug action does not open Android permission settings.
                OutlinedButton(
                    onClick = { onAction("settings") },
                    modifier = Modifier.widthIn(min = 48.dp).heightIn(min = 48.dp),
                ) { Text("Settings") }
                if (fixture.analysis) {
                    Text("About true-peak analysis", style = MaterialTheme.typography.titleMedium)
                    // D84 makes analysis automatic and not optional, so no choice is offered; when it runs is undecided.
                    // The wording is study copy that no decision chose.
                    Text(
                        "True peak is measured automatically for every audio file. Analysis uses CPU and battery; playback remains available while it runs.",
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
        }
    }
}
//endregion
