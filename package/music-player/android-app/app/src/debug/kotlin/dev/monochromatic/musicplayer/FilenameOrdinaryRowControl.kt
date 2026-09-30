// What: Keep this nonfunctional row replica in the existing debug namespace.
// Why: Exercise the ordinary source's text mechanism without changing production code.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module location supplies the namespace.
// ```
package dev.monochromatic.musicplayer

// What: padding adds layout space around text, with named horizontal and vertical arguments.
// Why: Copy the ordinary trackRow's measured input spacing rather than Search's icon slot.
//
// In TS you'd write (pseudocode):
// ```ts
// import { padding } from 'layout';
// ```
import androidx.compose.foundation.layout.padding
// fillMaxWidth gives this text the caller's complete available row width.
import androidx.compose.foundation.layout.fillMaxWidth
// MaterialTheme supplies the same default text style and named color roles used by ordinary source.
import androidx.compose.material3.MaterialTheme
// Text draws one literal filename label; it does not index or activate anything.
import androidx.compose.material3.Text
// What: Composable marks a function that may emit UI during a Compose render.
// Why: This source-shaped row remains a nonfunctional visual control.
//
// In TS you'd write (pseudocode):
// ```ts
// function RowControl(props: { title: string }): UIElement;
// ```
import androidx.compose.runtime.Composable
// Modifier carries width and padding instructions for the emitted text.
import androidx.compose.ui.Modifier
// What: TextOverflow names clipping behavior; Ellipsis draws a trailing omission mark.
// Why: Test whether single-line ordinary-source clipping exposes distinguishing suffixes.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ellipsis } from 'text-layout';
// ```
import androidx.compose.ui.text.style.TextOverflow
// dp expresses layout spacing in density-independent units, not physical screenshot pixels.
import androidx.compose.ui.unit.dp
// rowDisplay is the real prefix-removal utility, not an extension parser.
import dev.monochromatic.musicplayer.core.rowDisplay

/**
 * What: Render a source-shaped ordinary track-row control, not the live player's private component.
 * Why: MainActivity.trackRow is private; copying its text primitive avoids reflection or production edits.
 * Click behavior, current-track decoration and complete player chrome are intentionally absent.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function FilenameOrdinaryRowControl(title: string): UIElement;
 * ```
 */
@Composable
internal fun FilenameOrdinaryRowControl(title: String) {
    // What: rowDisplay removes the active folder's slash-terminated prefix from a synthetic relative path.
    // Why: Preserve the real ordinary-source mechanism, including its remaining Live/ path and suffix.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const label = rowDisplay('Cult of Luna', `Cult of Luna/Live/${title}`);
    // ```
    val label: String = rowDisplay("Cult of Luna", "Cult of Luna/Live/$title")
    // What: Text is one UI call with named arguments, width/padding instructions and one-line ellipsis.
    // Why: The controlled draw follows MainActivity.trackRow's text, color and padding shape.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return <Text color="onSurface" maxLines={1} overflow="ellipsis" padding={{ horizontal: 8, vertical: 8 }}>{label}</Text>;
    // ```
    Text(text = label, color = MaterialTheme.colorScheme.onSurface,
        maxLines = 1, overflow = TextOverflow.Ellipsis,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp))
}
