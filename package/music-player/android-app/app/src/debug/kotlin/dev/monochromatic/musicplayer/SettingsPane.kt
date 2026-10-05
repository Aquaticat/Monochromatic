//region D11 Settings pane drawn with platform Material 3 rows and switches, authored state only
// What: Package joins the pure Settings record with its native presentation.
// Why: The pane renders three accepted rows without reading or writing any real preference.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose native layout containers, system inset sources and Material 3 components.
// Why: The pane is assembled from the platform's own list item and switch, not hand-drawn copies of the mock.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Box, Column, Row, ListItem, Switch, Text } from 'native-ui';
// ```
import androidx.compose.foundation.background
// Empty sized element, here the status-bar spacer.
import androidx.compose.foundation.layout.Box
// Vertical stack.
import androidx.compose.foundation.layout.Column
// Horizontal stack for the page header.
import androidx.compose.foundation.layout.Row
// Native system inset source.
import androidx.compose.foundation.layout.WindowInsets
// Fill the offered region.
import androidx.compose.foundation.layout.fillMaxSize
// Fill the offered width only.
import androidx.compose.foundation.layout.fillMaxWidth
// Fixed header height.
import androidx.compose.foundation.layout.height
// Bottom system navigation inset.
import androidx.compose.foundation.layout.navigationBars
// Explicit content insets.
import androidx.compose.foundation.layout.padding
// Square Back target.
import androidx.compose.foundation.layout.size
// Top system status inset.
import androidx.compose.foundation.layout.statusBars
// Pads content by a system inset.
import androidx.compose.foundation.layout.windowInsetsPadding
// A spacer exactly as tall as a top system inset.
import androidx.compose.foundation.layout.windowInsetsTopHeight
// Remembered scroll position for the row list.
import androidx.compose.foundation.rememberScrollState
// Makes a whole row one two-state control.
import androidx.compose.foundation.selection.toggleable
// Lets the row list scroll when it is taller than its viewport.
import androidx.compose.foundation.verticalScroll
// Material icon namespace.
import androidx.compose.material.icons.Icons
// The Back arrow glyph already used by the accepted Search header.
import androidx.compose.material.icons.filled.ArrowBack
// One-pixel-class separators.
import androidx.compose.material3.HorizontalDivider
// Icon renderer.
import androidx.compose.material3.Icon
// Icon-only button with ripple and semantics.
import androidx.compose.material3.IconButton
// Platform Material 3 list row.
import androidx.compose.material3.ListItem
// Colour overrides for that row.
import androidx.compose.material3.ListItemDefaults
// Shared colour and type roles.
import androidx.compose.material3.MaterialTheme
// Platform Material 3 switch.
import androidx.compose.material3.Switch
// Text renderer.
import androidx.compose.material3.Text
// Native function registration.
import androidx.compose.runtime.Composable
// Runs a diagnostic when a remembered value changes.
import androidx.compose.runtime.LaunchedEffect
// Cross-axis alignment constants.
import androidx.compose.ui.Alignment
// Immutable native layout configuration.
import androidx.compose.ui.Modifier
// Opaque colour value.
import androidx.compose.ui.graphics.Color
// Accessibility role names.
import androidx.compose.ui.semantics.Role
// Marks the page title as a heading for assistive technology.
import androidx.compose.ui.semantics.heading
// Attaches accessibility properties.
import androidx.compose.ui.semantics.semantics
// Single-line truncation policy for the title.
import androidx.compose.ui.text.style.TextOverflow
// Density-independent distance type.
import androidx.compose.ui.unit.Dp
// Density-independent literal distance.
import androidx.compose.ui.unit.dp

/**
 * What: A composable draws the whole page: status spacer, header, separator, three switch rows and
 * the closing paragraph. `Dp` is a density-independent distance; `Color` is an opaque colour value.
 * `startSafe` and `endSafe` are the horizontal insets that keep text clear of the fold connector.
 * Why: The same pane serves the cover's full-width page and the inner panel's right half; only the
 * caller-supplied insets differ, so no row is redrawn per panel.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function SettingsPane(input: { state: SettingsPaneState; onEvent: (event: string) => void; onBack: () => void;
 *   onMeasure: (line: string) => void; modifier: Modifier; startSafe: number; endSafe: number; pageColor: Color }): UIElement;
 * ```
 */
@Composable
internal fun SettingsPane(state: SettingsPaneState, onEvent: (String) -> Unit, onBack: () -> Unit,
    onMeasure: (String) -> Unit, modifier: Modifier, startSafe: Dp, endSafe: Dp, pageColor: Color) {
    // What: val binds one remembered scroll-state object for this pane.
    // Why: Its maxValue says how many pixels of rows lie outside the viewport, which a screenshot cannot.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const scroll = useScrollState();
    // ```
    val scroll = rememberScrollState()
    // What: LaunchedEffect reruns its block whenever the listed value changes.
    // Why: The hidden extent is logged once per layout change instead of on every frame.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => onMeasure(`SettingsPane.scroll:max=${scroll.maxValue}`), [scroll.maxValue]);
    // ```
    LaunchedEffect(scroll.maxValue) {
        onMeasure("SettingsPane.scroll:max=${scroll.maxValue}")
    }
    // What: Nested trailing lambdas supply the children of native layout components.
    // Why: Header and rows stay one page, mirroring the accepted Search page's header-over-content order.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Column><StatusSpacer/><Header/><Divider/><ScrollColumn>{rows}<Closing/></ScrollColumn></Column>
    // ```
    Column(modifier = modifier.fillMaxSize().background(pageColor).settingsPaneMeasure("pane", onMeasure)) {
        Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
        SettingsPaneHeader(onBack = onBack, onMeasure = onMeasure, startSafe = startSafe, endSafe = endSafe)
        HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
        Column(modifier = Modifier.weight(1f).fillMaxWidth().settingsPaneMeasure("viewport", onMeasure)
            .verticalScroll(scroll).windowInsetsPadding(WindowInsets.navigationBars)) {
            // A `for (row in rows)` loop emits one row per list element, like `rows.map(...)` in JSX.
            for (row in settingsPaneRows(state)) {
                SettingsPaneSwitchRow(row = row, onEvent = onEvent, onMeasure = onMeasure,
                    startSafe = startSafe, endSafe = endSafe)
                HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outlineVariant)
            }
            Text(text = settingsPaneClosing(),
                modifier = Modifier.fillMaxWidth()
                    .padding(start = startSafe, end = endSafe, top = 22.dp, bottom = 22.dp)
                    .settingsPaneMeasure("closing", onMeasure),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                onTextLayout = { layout ->
                    onMeasure("SettingsPane.text:closing:lines=${layout.lineCount},overflow=${layout.hasVisualOverflow}")
                })
        }
    }
}

/**
 * What: A private composable draws the page-level header: a 48dp Back target and the page title.
 * Why: It follows the accepted Search page's single integrated header, so a Settings page reads as
 * the same kind of destination and returns the same way.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function SettingsPaneHeader(input: { onBack: () => void; onMeasure: (line: string) => void; startSafe: number; endSafe: number }): UIElement;
 * ```
 */
@Composable
private fun SettingsPaneHeader(onBack: () -> Unit, onMeasure: (String) -> Unit, startSafe: Dp, endSafe: Dp) {
    Row(modifier = Modifier.fillMaxWidth().height(72.dp).settingsPaneMeasure("header", onMeasure)
        .background(MaterialTheme.colorScheme.surfaceContainerHigh)
        .padding(start = startSafe, end = endSafe), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onBack, modifier = Modifier.size(48.dp).settingsPaneMeasure("back", onMeasure)) {
            // What: `tint` is the colour the glyph is drawn in; `onSurface` is the theme's text-on-page role.
            // Why: Without it the glyph takes an inherited default that stays black in the dark theme,
            // where a fresh inspection found the arrow unreadable on the dark header.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // <ArrowBackIcon aria-label="Back to player" style={{ color: scheme.onSurface }}/>
            // ```
            Icon(imageVector = Icons.Filled.ArrowBack, contentDescription = "Back to player",
                tint = MaterialTheme.colorScheme.onSurface)
        }
        // What: `semantics { heading() }` marks this text as a heading; `weight(1f)` gives it the remaining width.
        // Why: The title truncates on one line inside the fixed header instead of pushing the Back target.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <h1 style={{ flex: 1, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{settingsPaneTitle()}</h1>
        // ```
        Text(text = settingsPaneTitle(),
            modifier = Modifier.weight(1f).padding(start = 8.dp).semantics { heading() }
                .settingsPaneMeasure("title", onMeasure),
            // The title names its own theme colour for the same reason as the Back glyph.
            color = MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis,
            onTextLayout = { layout ->
                onMeasure("SettingsPane.text:title:lines=${layout.lineCount},overflow=${layout.hasVisualOverflow}")
            })
    }
}

/**
 * What: A private composable draws one setting as a Material 3 list item with a trailing switch.
 * `toggleable` makes the entire row one two-state control with the Switch role;
 * the Switch itself gets `onCheckedChange = null`, which means "display only, the row owns input".
 * Why: The row, not the 40dp switch state layer, supplies the 48dp target floor, and both text lines
 * may wrap freely at large text instead of being shrunk or truncated.
 * Gotcha: `startSafe - 16.dp` subtracts two Dp values. Kotlin lets a type define what `-` means
 * (operator overloading); TypeScript has no such mechanism, so read it as plain number subtraction.
 * The subtraction assumes the list item's own 16dp side padding; the study measures the title's
 * rectangle rather than trusting that assumption.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function SettingsPaneSwitchRow(input: { row: SettingsPaneRow; onEvent: (event: string) => void; onMeasure: (line: string) => void;
 *   startSafe: number; endSafe: number }): UIElement;
 * // <ListItem role="switch" aria-checked={row.checked} onClick={() => onEvent('toggle:' + row.id)} .../>
 * ```
 */
@Composable
private fun SettingsPaneSwitchRow(row: SettingsPaneRow, onEvent: (String) -> Unit, onMeasure: (String) -> Unit,
    startSafe: Dp, endSafe: Dp) {
    ListItem(
        headlineContent = {
            Text(text = row.title, modifier = Modifier.settingsPaneMeasure("row-title:" + row.id, onMeasure),
                onTextLayout = { layout ->
                    onMeasure("SettingsPane.text:row-title:${row.id}:lines=${layout.lineCount},overflow=${layout.hasVisualOverflow}")
                })
        },
        modifier = Modifier.fillMaxWidth().settingsPaneMeasure("row:" + row.id, onMeasure)
            .toggleable(value = row.checked, role = Role.Switch, onValueChange = { onEvent("toggle:" + row.id) })
            .padding(start = startSafe - 16.dp, end = endSafe - 16.dp),
        supportingContent = {
            Text(text = row.supporting, modifier = Modifier.settingsPaneMeasure("row-supporting:" + row.id, onMeasure),
                onTextLayout = { layout ->
                    onMeasure("SettingsPane.text:row-supporting:${row.id}:lines=${layout.lineCount},overflow=${layout.hasVisualOverflow}")
                })
        },
        trailingContent = {
            Switch(checked = row.checked, onCheckedChange = null,
                modifier = Modifier.settingsPaneMeasure("switch:" + row.id, onMeasure))
        },
        // What: `Color.Transparent` gives the row no fill of its own, so the page colour behind it shows.
        // Why: An opaque row fill starts after the fold-connector inset and covered the soft edge of the
        // separator above it only from there on, leaving that line one pixel different across the connector.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // <ListItem style={{ background: 'transparent' }}/>
        // ```
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
    )
}
//endregion
