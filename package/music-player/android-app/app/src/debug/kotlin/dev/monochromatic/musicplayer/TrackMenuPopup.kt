//region Native classic menu content with explicit authored target and no production callbacks
// What: Package shares the isolated fixture and screen-coordinate diagnostics.
// Why: A menu action cannot escape into the production player controller.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose native layout floors, the classic menu and text roles.
// Why: Reuse the installed Material menu's window, scrolling and dismissal behavior.
//
// In TS you'd write (pseudocode):
// ```ts
// import { DropdownMenu, DropdownMenuItem, Text } from 'material3';
// ```
import androidx.compose.foundation.layout.PaddingValues
// Heading consumes the menu content width without making the popup wider.
import androidx.compose.foundation.layout.fillMaxWidth
// Action layout has an explicit minimum height.
import androidx.compose.foundation.layout.heightIn
// Content spacing does not shrink touch layout bounds.
import androidx.compose.foundation.layout.padding
// Intrinsic heading width cannot expand the menu beyond its native maximum.
import androidx.compose.foundation.layout.widthIn
// Preserve the accepted candidate's rounded menu container.
import androidx.compose.foundation.shape.RoundedCornerShape
// Classic popup with focusable native window behavior.
import androidx.compose.material3.DropdownMenu
// Classic action row with its own click owner.
import androidx.compose.material3.DropdownMenuItem
// Separators distinguish the accepted groups.
import androidx.compose.material3.HorizontalDivider
// Decorative vectors accompany visible action text.
import androidx.compose.material3.Icon
// Current theme supplies foreground and destructive roles.
import androidx.compose.material3.MaterialTheme
// Default action colors preserve native enabled/disabled role handling.
import androidx.compose.material3.MenuDefaults
// Native text reports its actual layout separately from row bounds.
import androidx.compose.material3.Text
// Native composition declaration.
import androidx.compose.runtime.Composable
// Immutable layout configuration.
import androidx.compose.ui.Modifier
// Dp is a density-independent layout distance, distinct from physical pixels.
import androidx.compose.ui.unit.Dp
// Literal layout distance conversion.
import androidx.compose.ui.unit.dp
// Styled text keeps the peak inline without a competing fixed-width trailing column.
import androidx.compose.ui.text.buildAnnotatedString
// A span changes the secondary value's role without changing the whole action.
import androidx.compose.ui.text.SpanStyle
// Apply that span while appending the peak text.
import androidx.compose.ui.text.withStyle

/**
 * What: A named composable receives one immutable target and callbacks returning Unit, Kotlin's void.
 * Why: Opening or selecting a menu does not itself claim playback, clipboard or storage success.
 * Native popup content scrolls if its complete heading and action rows exceed the available height.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function TrackMenuPopup(input: {
 *   target: TrackMenuTarget; expanded: boolean; informationStartInset: number;
 *   onDismiss: () => void; onIntent: (id: string) => void; onEvent: (event: string) => void;
 * }): UIElement;
 * ```
 */
@Composable
internal fun TrackMenuPopup(
    target: TrackMenuTarget,
    expanded: Boolean,
    informationStartInset: Dp,
    onDismiss: () -> Unit,
    onIntent: (String) -> Unit,
    onEvent: (String) -> Unit,
) {
    DropdownMenu(
        expanded = expanded,
        onDismissRequest = onDismiss,
        modifier = Modifier.widthIn(max = 280.dp).trackMenuMeasure("menu", onEvent),
        shape = RoundedCornerShape(12.dp),
    ) {
        Text(
            text = target.track.title,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth()
                .padding(start = 16.dp + informationStartInset, end = 16.dp, top = 8.dp, bottom = 8.dp)
                .trackMenuMeasure("heading", onEvent),
            onTextLayout = { result ->
                // What: A trailing lambda receives the actual native text layout result.
                // Why: A rectangle alone does not prove that the full heading was laid out without overflow.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // onTextLayout(result => log({ lines: result.lineCount, overflow: result.hasVisualOverflow }));
                // ```
                onEvent("TrackMenu.text:heading:lines=${result.lineCount},overflow=${result.hasVisualOverflow}")
            },
        )
        // What: withIndex exposes each record together with its source position.
        // Why: Group separators compare adjacent accepted actions, not display labels.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // for (const [index, action] of trackMenuActions.entries()) { ... }
        // ```
        for ((index, action) in trackMenuActions.withIndex()) {
            if (index > 0 && action.group != trackMenuActions[index - 1].group) {
                HorizontalDivider(modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp))
            }
            // What: An if expression selects a color value instead of mutating theme state.
            // Why: Destructive meaning has an error color plus an explicit label and trash icon.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const foreground = action.destructive ? scheme.error : scheme.onSurface;
            // ```
            val foreground = if (action.destructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
            val secondary = MaterialTheme.colorScheme.onSurfaceVariant
            DropdownMenuItem(
                text = {
                    // What: A builder appends literal text and one styled span.
                    // Why: Large text can wrap the inline peak naturally rather than crushing the File details label.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // const label = [text(action.label), action.id === 'details' ? span(secondary, ' · ' + peak) : null];
                    // ```
                    val label = buildAnnotatedString {
                        append(action.label)
                        if (action.id == "details") {
                            withStyle(SpanStyle(color = secondary)) { append(" · ${target.track.peak}") }
                        }
                    }
                    Text(text = label, onTextLayout = { result ->
                        onEvent("TrackMenu.text:${action.id}:lines=${result.lineCount},overflow=${result.hasVisualOverflow}")
                    })
                },
                onClick = { onIntent(action.id) },
                leadingIcon = {
                    // Decorative icon has no duplicate accessibility announcement.
                    Icon(imageVector = trackMenuActionIcon(action.id), contentDescription = null)
                },
                colors = MenuDefaults.itemColors(textColor = foreground, leadingIconColor = foreground),
                contentPadding = PaddingValues(start = 16.dp + informationStartInset, end = 16.dp, top = 8.dp, bottom = 8.dp),
                modifier = Modifier.widthIn(min = 48.dp).heightIn(min = 48.dp)
                    .trackMenuMeasure("action:${action.id}", onEvent),
            )
        }
    }
}
//endregion
