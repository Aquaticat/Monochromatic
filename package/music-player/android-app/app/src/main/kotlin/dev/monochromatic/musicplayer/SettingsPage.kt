// What:     `package dev.monochromatic.musicplayer` places the Settings page beside the other player composables.
// Why:      The page is a stateless composable the host screen calls without reaching into MainActivity.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     Imports from `core` bring in the template kinds the page lists.
// Why:      Each row opens the editor of one template kind, and the page lists the kinds in order.
//
// In TS you'd write (pseudocode):
// ```ts
// import { TemplateKind } from "core/TemplateEditorState";
// ```
import dev.monochromatic.musicplayer.core.TemplateKind

// What:     Imports from `androidx.compose.foundation` bring in backgrounds, clicks, scrolling and insets.
// Why:      The page scrolls its rows and keeps them clear of the navigation bar.
//
// In TS you'd write (pseudocode):
// ```ts
// import { clickable, verticalScroll } from "compose/foundation";
// ```
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll

// What:     Imports from `androidx.compose.material3` and `androidx.compose.ui` bring in the list row, divider,
//           colour, and semantics the page uses.
// Why:      The rows are the platform's own list items, so they follow the theme and announce as buttons.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ListItem, HorizontalDivider, MaterialTheme, Modifier, Color, Role } from "material3";
// ```
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role

// What:     `fun settingsPageContent(...)` draws the Settings page with its header and the Templates rows.
// Why:      The page lists each template with the line it currently yields and opens that template's editor on tap.
//
// In TS you'd write (pseudocode):
// ```ts
// function SettingsPage(props: { templateLines: Record<TemplateKind, string>; onBack(): void;
//   onOpenTemplate(kind: TemplateKind): void; modifier?: Modifier }): UIElement;
// ```
/**
 * Draws the Settings page: the header with its way back, then the Templates heading and one row per template.
 * The row's tap calls onOpenTemplate with that template's kind.
 */
@Composable
fun settingsPageContent(
    templateLines: Map<TemplateKind, String>,
    onBack: () -> Unit,
    onOpenTemplate: (TemplateKind) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
        // What:     `Box` with `windowInsetsTopHeight` is an empty block as tall as the status bar.
        // Why:      The page draws edge to edge, so its header starts below the clock and icons.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <div style={{ height: 'env(safe-area-inset-top)' }}/>
        // ```
        Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
        destinationHeader(title = "Settings", backDescription = "Back to player", onBack = onBack)
        HorizontalDivider(thickness = DESTINATION_HAIRLINE, color = MaterialTheme.colorScheme.outline)
        // What:     `verticalScroll` lets the rows move when text is large, and the navigation-bar inset keeps the
        //           last row clear of the system bar.
        // Why:      Larger text grows the rows, so the list must scroll rather than clip.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom)' }}>{rows}</div>
        // ```
        Column(
            modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())
                .windowInsetsPadding(WindowInsets.navigationBars),
        ) {
            destinationSectionHeading(text = "Templates", bottom = DESTINATION_HEADING_GAP)
            for (template in TemplateKind.entries) {
                settingsTemplateRow(
                    template = template,
                    line = templateLines[template].orEmpty(),
                    onOpen = { onOpenTemplate(template) },
                )
                HorizontalDivider(thickness = DESTINATION_HAIRLINE, color = MaterialTheme.colorScheme.outlineVariant)
            }
        }
    }
}

// What:     `@Composable private fun settingsTemplateRow(...)` draws one template as a tappable list row.
// Why:      The row names the template and shows the line it yields, and the whole row opens its editor.
//
// In TS you'd write (pseudocode):
// ```ts
// function TemplateRow(props: { template: TemplateKind; line: string; onOpen(): void }): UIElement;
// ```
/** Draws one template row: its label, the line it yields now, and a tap target that opens its editor. */
@Composable
private fun settingsTemplateRow(template: TemplateKind, line: String, onOpen: () -> Unit) {
    ListItem(
        modifier = Modifier.fillMaxWidth()
            .defaultMinSize(minHeight = DESTINATION_TOUCH_TARGET)
            .clickable(role = Role.Button, onClick = onOpen)
            .padding(
                start = DESTINATION_SIDE_INSET - DESTINATION_ROW_INSET,
                end = DESTINATION_SIDE_INSET - DESTINATION_ROW_INSET,
            ),
        supportingContent = { Text(text = line) },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
    ) {
        Text(text = template.label)
    }
}
