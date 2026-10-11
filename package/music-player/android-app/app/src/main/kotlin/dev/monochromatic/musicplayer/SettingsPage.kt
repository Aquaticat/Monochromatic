// What:     `package dev.monochromatic.musicplayer` places the Settings page beside the other player composables.
// Why:      The page is a stateless composable the host screen calls without reaching into MainActivity.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     Imports from `core` bring in the template kinds the page lists and the pure corner radii of each row.
// Why:      Each row opens the editor of one template kind, and each row's corners follow its place in the group.
//
// In TS you'd write (pseudocode):
// ```ts
// import { TemplateKind } from "core/TemplateEditorState";
// import { settingsRowRadii } from "core/SettingsLayout";
// ```
import dev.monochromatic.musicplayer.core.SettingsRowRadii
import dev.monochromatic.musicplayer.core.TemplateKind
import dev.monochromatic.musicplayer.core.settingsRowRadii

// What:     Imports from `androidx.compose.foundation` bring in backgrounds, clicks, scrolling and insets.
// Why:      The page scrolls its rows, keeps them clear of the navigation bar, and marks each row as a tappable button.
//
// In TS you'd write (pseudocode):
// ```ts
// import { clickable, verticalScroll } from "compose/foundation";
// ```
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll

// What:     Imports from `androidx.compose.material3` and `androidx.compose.ui` bring in the text, icon, colour,
//           clipping, alignment and semantics the page uses.
// Why:      The page draws its own header and grouped cards from the theme roles, and each row announces as a button.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Icon, MaterialTheme, Text } from "material3";
// import { Modifier, Role, heading } from "compose/ui";
// ```
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// What:     `private val SETTINGS_CONTENT_MAX_WIDTH: Dp = 640.dp` is the widest the page content grows.
// Why:      On wide windows the header and cards stay in one readable column centered on the page.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_CONTENT_MAX_WIDTH = 640;
// ```
/** Widest the header and card column grows before it centers on a wide window. */
private val SETTINGS_CONTENT_MAX_WIDTH: Dp = 640.dp

// What:     `private val SETTINGS_PAGE_INSET: Dp = 16.dp` is the margin between the page edge and each card.
// Why:      Stock Settings keeps its grouped cards 16 dp in from both page edges.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_PAGE_INSET = 16;
// ```
/** Margin between each grouped card and the page edge. */
private val SETTINGS_PAGE_INSET: Dp = 16.dp

// What:     `private val SETTINGS_HEADER_HEIGHT: Dp = 64.dp` is the height of the static top bar.
// Why:      The measured stock top bar is 64 dp, with no divider below it.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_HEADER_HEIGHT = 64;
// ```
/** Height of the static top bar that holds the Back button and the page title. */
private val SETTINGS_HEADER_HEIGHT: Dp = 64.dp

// What:     `private val SETTINGS_BACK_SIZE: Dp = 56.dp` is the diameter of the round Back button.
// Why:      The measured stock Back circle is 56 dp, which is also larger than the 48 dp minimum touch target.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_BACK_SIZE = 56;
// ```
/** Diameter of the round tonal Back button. */
private val SETTINGS_BACK_SIZE: Dp = 56.dp

// What:     `private val SETTINGS_TITLE_GAP: Dp = 24.dp` is the space between the Back circle and the page title.
// Why:      Places the title text origin at 96 dp from the page edge, which matches the measured title start
//           on the inner panel.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_TITLE_GAP = 24;
// ```
/** Space between the right edge of the Back button and the start of the page title. */
private val SETTINGS_TITLE_GAP: Dp = 24.dp

// What:     `private val SETTINGS_HEADING_INSET: Dp = 24.dp` is the inset of a section heading from the page edge.
// Why:      Stock Settings starts section headings 24 dp from the edge, which is 8 dp to the left of the card edge.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_HEADING_INSET = 24;
// ```
/** Distance from the page edge to the start of a section heading. */
private val SETTINGS_HEADING_INSET: Dp = 24.dp

// What:     `private val SETTINGS_HEADING_TOP: Dp = 16.dp` is the space above a section heading.
// Why:      Stock Settings puts 16 dp above each heading, so the heading reads as the start of its group.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_HEADING_TOP = 16;
// ```
/** Space above a section heading. */
private val SETTINGS_HEADING_TOP: Dp = 16.dp

// What:     `private val SETTINGS_HEADING_BOTTOM: Dp = 8.dp` is the space between a section heading and its cards.
// Why:      Stock Settings keeps the heading close to the first card it names.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_HEADING_BOTTOM = 8;
// ```
/** Space between a section heading and the first card under it. */
private val SETTINGS_HEADING_BOTTOM: Dp = 8.dp

// What:     `private val SETTINGS_ROW_MIN_HEIGHT: Dp = 72.dp` is the height of a two-line row at the default text size.
// Why:      The measured stock rows are 72 dp, and the minimum lets a row grow when the text is larger.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_ROW_MIN_HEIGHT = 72;
// ```
/** Minimum height of one grouped row, which grows when the text is larger than the default. */
private val SETTINGS_ROW_MIN_HEIGHT: Dp = 72.dp

// What:     `private val SETTINGS_ROW_TEXT_INSET: Dp = 16.dp` is the inset between a row's edge and its text.
// Why:      Stock Settings puts row text 16 dp inside the card.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_ROW_TEXT_INSET = 16;
// ```
/** Horizontal inset between a row's edge and its title and summary. */
private val SETTINGS_ROW_TEXT_INSET: Dp = 16.dp

// What:     `private val SETTINGS_ROW_VERTICAL_INSET: Dp = 12.dp` is the space above and below a row's two text lines.
// Why:      The two lines together are about 44 dp, so 12 dp above and below keeps the text off the card edges when
//           the text grows.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_ROW_VERTICAL_INSET = 12;
// ```
/** Vertical inset above and below the two text lines of a row. */
private val SETTINGS_ROW_VERTICAL_INSET: Dp = 12.dp

// What:     `private val SETTINGS_ROW_GAP: Dp = 2.dp` is the gap between two rows of one group.
// Why:      The gap shows the page background, which separates the rows without any divider line.
//
// In TS you'd write (pseudocode):
// ```ts
// const SETTINGS_ROW_GAP = 2;
// ```
/** Gap between two rows of one group, filled by the page background. */
private val SETTINGS_ROW_GAP: Dp = 2.dp

// What:     `fun settingsPageContent(...)` draws the Settings page with its header and the Templates rows.
// Why:      The page lists each template with the line it currently yields and opens that template's editor on tap.
//
// In TS you'd write (pseudocode):
// ```ts
// function SettingsPage(props: { templateLines: Record<TemplateKind, string>; onBack(): void;
//   onOpenTemplate(kind: TemplateKind): void; modifier?: Modifier }): UIElement;
// ```
/**
 * Draws the Settings page as a static header and the Templates grouped card on the page background,
 * with the content column centered and at most 640 dp wide.
 */
@Composable
fun settingsPageContent(
    templateLines: Map<TemplateKind, String>,
    onBack: () -> Unit,
    onOpenTemplate: (TemplateKind) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceContainer),
        contentAlignment = Alignment.TopCenter,
    ) {
        // What:     `Column` with `widthIn(max = 640.dp)` is the content column, centered by its parent box.
        // Why:      The column takes the window width up to 640 dp, so the header and cards share one readable width.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <div style={{ width: '100%', maxWidth: 640, height: '100%', margin: '0 auto' }}>{content}</div>
        // ```
        Column(modifier = Modifier.widthIn(max = SETTINGS_CONTENT_MAX_WIDTH).fillMaxSize()) {
            // What:     `Box` with `windowInsetsTopHeight` is an empty block as tall as the status bar.
            // Why:      The page draws edge to edge, so its header starts below the clock and icons.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <div style={{ height: 'env(safe-area-inset-top)' }}/>
            // ```
            Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
            settingsHeader(title = "Settings", backDescription = "Back to player", onBack = onBack)
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
                settingsSectionHeading(text = "Templates")
                // What:     `Column` with `spacedBy` stacks the template rows in one grouped card with 2 dp gaps.
                // Why:      The gap between rows shows the page background, so the group needs no divider lines.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 16px' }}>{rows}</div>
                // ```
                Column(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = SETTINGS_PAGE_INSET),
                    verticalArrangement = Arrangement.spacedBy(SETTINGS_ROW_GAP),
                ) {
                    TemplateKind.entries.forEachIndexed { index, template ->
                        settingsTemplateRow(
                            template = template,
                            line = templateLines[template].orEmpty(),
                            radii = settingsRowRadii(index = index, count = TemplateKind.entries.size),
                            onOpen = { onOpenTemplate(template) },
                        )
                    }
                }
            }
        }
    }
}

// What:     `@Composable private fun settingsHeader(...)` draws the static top bar with the round Back button
//           and the title.
// Why:      Stock Settings keeps the Back circle and the page title on the page background, with no divider below.
//
// In TS you'd write (pseudocode):
// ```ts
// function SettingsHeader(props: { title: string; backDescription: string; onBack(): void }): UIElement;
// ```
/** Draws the static top bar: a 56 dp round tonal Back button followed by the page title. */
@Composable
private fun settingsHeader(title: String, backDescription: String, onBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().height(SETTINGS_HEADER_HEIGHT).padding(start = SETTINGS_PAGE_INSET),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // What:     `Box` with `clip`, `background` and `clickable` is the round tonal Back button.
        // Why:      The clip bounds the ripple and hover indication to the circle, and the Back role
        //           announces the button.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <button style={{ width: 56, height: 56, borderRadius: '50%', background: tonal }}
        //   aria-label={backDescription}/>
        // ```
        /** Round tonal button that holds the Back arrow and returns to the player. */
        Box(
            modifier = Modifier.size(SETTINGS_BACK_SIZE).clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceContainerHighest)
                .clickable(role = Role.Button, onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = DESTINATION_BACK_ICON,
                contentDescription = backDescription,
                tint = MaterialTheme.colorScheme.onSurface,
            )
        }
        Text(
            text = title,
            modifier = Modifier.weight(1f).padding(start = SETTINGS_TITLE_GAP).semantics { heading() },
            color = MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.titleLarge,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

// What:     `@Composable private fun settingsSectionHeading(...)` draws the Templates heading on the page background.
// Why:      The heading names its group in the primary color, and is marked as a heading for assistive technology.
//
// In TS you'd write (pseudocode):
// ```ts
// function SectionHeading(props: { text: string }): UIElement;
// ```
/** Draws one section heading in the primary label role, 24 dp in from the page edge. */
@Composable
private fun settingsSectionHeading(text: String) {
    Text(
        text = text,
        modifier = Modifier.padding(
            start = SETTINGS_HEADING_INSET,
            top = SETTINGS_HEADING_TOP,
            end = SETTINGS_HEADING_INSET,
            bottom = SETTINGS_HEADING_BOTTOM,
        ).semantics { heading() },
        color = MaterialTheme.colorScheme.primary,
        style = MaterialTheme.typography.labelLarge,
    )
}

// What:     `@Composable private fun settingsTemplateRow(...)` draws one template as a tappable grouped card row.
// Why:      The row names the template and shows the line it yields, and the whole row opens its editor.
//
// In TS you'd write (pseudocode):
// ```ts
// function TemplateRow(props: { template: TemplateKind; line: string; radii: SettingsRowRadii;
//   onOpen(): void }): UIElement;
// ```
/** Draws one row: its label, the line it yields now, on a card whose corners follow its place in the group. */
@Composable
private fun settingsTemplateRow(template: TemplateKind, line: String, radii: SettingsRowRadii, onOpen: () -> Unit) {
    /** Corner shape of this row, with the group radius or the joint radius at each of its four corners. */
    val shape: RoundedCornerShape = RoundedCornerShape(
        topStart = radii.topDp.dp,
        topEnd = radii.topDp.dp,
        bottomStart = radii.bottomDp.dp,
        bottomEnd = radii.bottomDp.dp,
    )
    // What:     `Column` with `clip`, `background`, `clickable` and `padding` is one row card.
    // Why:      Clipping before the clickable bounds the ripple and hover indication to the row's own shape, and the
    //           padding after it keeps the whole card as the tap target.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <button style={{ minHeight: 72, padding: '12px 16px', borderRadius: radii, background: card }}/>
    // ```
    Column(
        modifier = Modifier.fillMaxWidth()
            .defaultMinSize(minHeight = SETTINGS_ROW_MIN_HEIGHT)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceBright)
            .clickable(role = Role.Button, onClick = onOpen)
            .padding(horizontal = SETTINGS_ROW_TEXT_INSET, vertical = SETTINGS_ROW_VERTICAL_INSET),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = template.label,
            color = MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.bodyLarge,
        )
        Text(
            text = line,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}
