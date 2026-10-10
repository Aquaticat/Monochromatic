// What:     `package dev.monochromatic.musicplayer` places the track menu popup beside the other player composables.
// Why:      The popup is a stateless composable that the track list imports without reaching into MainActivity.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     Imports from `dev.monochromatic.musicplayer.core` bring in the action type and its wording.
// Why:      The popup renders the closed action list and the accepted labels without owning either.
//
// In TS you'd write (pseudocode):
// ```ts
// import { TrackMenuAction, label } from "core/TrackMenuAction";
// ```
import dev.monochromatic.musicplayer.core.TrackMenuAction
import dev.monochromatic.musicplayer.core.label

// What:     Imports from `androidx.compose.foundation` bring in the layout size and shape helpers.
// Why:      The popup caps its width, gives each row a 48dp target, and rounds the menu container.
//
// In TS you'd write (pseudocode):
// ```ts
// import { widthIn, heightIn, padding, roundedCorners } from "compose/foundation";
// ```
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape

// What:     Imports from `androidx.compose.foundation.layout` bring in the row content padding type.
// Why:      Each row reads its content with the 16dp side and 8dp vertical insets of the accepted study.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PaddingValues } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.PaddingValues

// What:     Imports from `androidx.compose.material3` bring in the classic dropdown menu and its item defaults.
// Why:      The classic menu provides native popup placement, scrolling, and outside or Back dismissal.
//
// In TS you'd write (pseudocode):
// ```ts
// import { DropdownMenu, DropdownMenuItem, HorizontalDivider, Icon, Text } from "material3";
// ```
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.Text

// What:     Imports from `androidx.compose.runtime` bring in the composable declaration marker.
// Why:      The popup emits UI and therefore must be a composable function.
//
// In TS you'd write (pseudocode):
// ```ts
// // Composable functions are plain functions in pseudocode.
// ```
import androidx.compose.runtime.Composable

// What:     Imports from `androidx.compose.ui` bring in the modifier and the Dp layout distance type.
// Why:      The popup accepts a caller modifier and converts its named constants to density-independent units.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier, Dp } from "compose/ui";
// ```
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// What:     Imports from `androidx.compose.ui.window` bring in the popup properties.
// Why:      The popup states its focus and dismissal flags explicitly so Escape and Back cannot be turned off silently.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PopupProperties } from "compose/ui/window";
// ```
import androidx.compose.ui.window.PopupProperties

// What:     Imports from `androidx.compose.ui.text` bring in annotated text, a color span, and ellipsis overflow.
// Why:      The File details row draws its dB value in the secondary role; the heading ends in one ellipsized line.
//
// In TS you'd write (pseudocode):
// ```ts
// import { buildAnnotatedString, withStyle, SpanStyle, TextOverflow } from "compose/ui/text";
// ```
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle

// What:     Import of `fillMaxWidth` lets the heading span the full menu width.
// Why:      The heading must wrap or ellipsize against the menu width, not its intrinsic width.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fillMaxWidth } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.fillMaxWidth

// What:     `private val MENU_MAX_WIDTH: Dp = 280.dp` caps the menu width.
// Why:      The accepted candidate keeps the menu narrower than the full panel.
//
// In TS you'd write (pseudocode):
// ```ts
// const MENU_MAX_WIDTH = 280;
// ```
/** Maximum width of the popup container in density-independent units. */
private val MENU_MAX_WIDTH: Dp = 280.dp

// What:     `private val MENU_CORNER_RADIUS: Dp = 12.dp` rounds the menu container.
// Why:      The accepted candidate uses a 12dp container radius.
//
// In TS you'd write (pseudocode):
// ```ts
// const MENU_CORNER_RADIUS = 12;
// ```
/** Corner radius of the popup container. */
private val MENU_CORNER_RADIUS: Dp = 12.dp

// What:     `private val ITEM_MIN_TARGET: Dp = 48.dp` is the minimum touch target of one action row.
// Why:      Every action keeps a 48dp minimum target, matching the touch-target rule of the design study.
//
// In TS you'd write (pseudocode):
// ```ts
// const ITEM_MIN_TARGET = 48;
// ```
/** Minimum width and height of one action row. */
private val ITEM_MIN_TARGET: Dp = 48.dp

// What:     `private val ROW_HORIZONTAL_PADDING: Dp = 16.dp` insets the row content from both sides.
// Why:      The accepted study uses 16dp on the start and end of each action row.
//
// In TS you'd write (pseudocode):
// ```ts
// const ROW_HORIZONTAL_PADDING = 16;
// ```
/** Start and end inset of the content of one action row. */
private val ROW_HORIZONTAL_PADDING: Dp = 16.dp

// What:     `private val ROW_VERTICAL_PADDING: Dp = 8.dp` insets the row content from top and bottom.
// Why:      The accepted study uses 8dp above and below the content of each action row.
//
// In TS you'd write (pseudocode):
// ```ts
// const ROW_VERTICAL_PADDING = 8;
// ```
/** Top and bottom inset of the content of one action row. */
private val ROW_VERTICAL_PADDING: Dp = 8.dp

// What:     `private val DIVIDER_HORIZONTAL_INSET: Dp = 8.dp` insets a divider from the container edges.
// Why:      The accepted candidate keeps dividers short of the menu edges.
//
// In TS you'd write (pseudocode):
// ```ts
// const DIVIDER_HORIZONTAL_INSET = 8;
// ```
/** Horizontal inset of a group divider from the container edges. */
private val DIVIDER_HORIZONTAL_INSET: Dp = 8.dp

// What:     `private val DIVIDER_VERTICAL_INSET: Dp = 5.dp` spaces a divider between action rows.
// Why:      The accepted candidate separates groups with a small vertical margin around the rule.
//
// In TS you'd write (pseudocode):
// ```ts
// const DIVIDER_VERTICAL_INSET = 5;
// ```
/** Vertical margin above and below a group divider. */
private val DIVIDER_VERTICAL_INSET: Dp = 5.dp

// What:     `internal fun trackMenuDividerFlags(actions: List<TrackMenuAction>): List<Boolean>` marks group starts.
// Why:      A divider belongs before an action whose group differs from the one before it, never before the first.
//
// In TS you'd write (pseudocode):
// ```ts
// function trackMenuDividerFlags(actions: readonly TrackMenuAction[]): boolean[] {
//   return actions.map((action, index) => index > 0 && action.group !== actions[index - 1].group);
// }
// ```
/** Returns for each action whether a divider is drawn immediately before it. */
internal fun trackMenuDividerFlags(actions: List<TrackMenuAction>): List<Boolean> =
    actions.mapIndexed { index, action -> index > 0 && action.group != actions[index - 1].group }

// What:     `internal fun trackMenuDetailsSuffix(detailsValue: String?): String` builds the text after File details.
// Why:      The dB value joins the label with a middle dot, and an absent or blank value adds no text at all.
//
// In TS you'd write (pseudocode):
// ```ts
// function trackMenuDetailsSuffix(detailsValue: string | null): string {
//   return detailsValue === null || detailsValue.trim() === "" ? "" : ` · ${detailsValue}`;
// }
// ```
/** Returns the separator and value appended to File details, or an empty string when no value is present. */
internal fun trackMenuDetailsSuffix(detailsValue: String?): String =
    if (detailsValue.isNullOrBlank()) "" else " · $detailsValue"

// What:     `fun trackMenuPopup(...)` draws the stateless track menu anchored at its call site.
// Why:      The caller decides when the menu is open and where it anchors; this composable only renders and reports.
//
// In TS you'd write (pseudocode):
// ```ts
// function trackMenuPopup(input: {
//   actions: readonly TrackMenuAction[];
//   onSelect: (action: TrackMenuAction) => void;
//   onDismiss: () => void;
// }): UIElement;
// ```
/**
 * Draws the track context menu over the composable that encloses this call.
 *
 * Escape and Back dismiss through the popup window, which calls `PopupLayout.dispatchKeyEvent` in
 * `ui-android` 1.11.2 and then `onDismissRequest` when `dismissOnBackPress` is true, as set here.
 * Outside taps dismiss through `dismissOnClickOutside`. Selecting an action only reports it.
 *
 * @param title Track name shown as the one-line heading; longer text ends in an ellipsis.
 * @param detailsValue Peak value drawn after File details in the secondary role; null draws nothing.
 * @param startInset Extra start inset for the heading, rows, and dividers; 12dp on the inner panel, 0 on the cover.
 * @param expanded Opens or closes the menu; keep the composable composed while false so the exit animation runs.
 */
@Composable
fun trackMenuPopup(
    actions: List<TrackMenuAction>,
    title: String,
    detailsValue: String?,
    onSelect: (TrackMenuAction) -> Unit,
    onDismiss: () -> Unit,
    startInset: Dp = 0.dp,
    expanded: Boolean = true,
    modifier: Modifier = Modifier,
) {
    // What:     `val dividers` holds one divider flag per action for this render pass.
    // Why:      Each row reads its own flag, so the divider decision is computed once.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const dividers = trackMenuDividerFlags(actions);
    // ```
    /** Divider flags aligned with the action list, computed once per composition. */
    val dividers = trackMenuDividerFlags(actions)
    // What:     `val secondary` is the role for the File details value.
    // Why:      The peak reads as secondary text so the action label stays primary.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const secondary = scheme.onSurfaceVariant;
    // ```
    /** Secondary text color used for the dB value on the File details row. */
    val secondary = MaterialTheme.colorScheme.onSurfaceVariant
    DropdownMenu(
        expanded = expanded,
        onDismissRequest = onDismiss,
        modifier = modifier.widthIn(max = MENU_MAX_WIDTH),
        shape = RoundedCornerShape(MENU_CORNER_RADIUS),
        properties = PopupProperties(focusable = true, dismissOnBackPress = true, dismissOnClickOutside = true),
    ) {
        // What:     `Text` draws the track name as the heading above the action rows.
        // Why:      D7 headed the menu with the track name, kept to one line with an ellipsis.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // heading({ text: title, maxLines: 1, overflow: "ellipsis" });
        // ```
        Text(
            text = title,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth().padding(
                start = ROW_HORIZONTAL_PADDING + startInset,
                end = ROW_HORIZONTAL_PADDING,
                top = ROW_VERTICAL_PADDING,
                bottom = ROW_VERTICAL_PADDING,
            ),
        )
        for ((index, action) in actions.withIndex()) {
            if (dividers[index]) {
                HorizontalDivider(
                    modifier = Modifier.padding(
                        start = DIVIDER_HORIZONTAL_INSET + startInset,
                        end = DIVIDER_HORIZONTAL_INSET,
                        top = DIVIDER_VERTICAL_INSET,
                        bottom = DIVIDER_VERTICAL_INSET,
                    ),
                )
            }
            // What:     `val foreground` selects the text and icon role for one row.
            // Why:      The destructive row uses the error role in addition to its label and trash glyph.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const foreground = action.destructive ? scheme.error : scheme.onSurface;
            // ```
            /** Text and icon color role of this row; the error role marks the destructive action. */
            val foreground = if (action.destructive) {
                MaterialTheme.colorScheme.error
            } else {
                MaterialTheme.colorScheme.onSurface
            }
            // What:     `val rowText` appends the dB value to File details in the secondary role.
            // Why:      Other rows have a single plain label, so only the details row builds a span.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const rowText = [label(action), action === "details" ? span(secondary, suffix) : null];
            // ```
            /** Visible text of this row, with the File details value in the secondary role. */
            val rowText = buildAnnotatedString {
                append(label(action))
                if (action == TrackMenuAction.DETAILS) {
                    withStyle(SpanStyle(color = secondary)) {
                        append(trackMenuDetailsSuffix(detailsValue))
                    }
                }
            }
            DropdownMenuItem(
                text = { Text(text = rowText) },
                onClick = { onSelect(action) },
                leadingIcon = { Icon(imageVector = trackMenuIcon(action), contentDescription = null) },
                colors = MenuDefaults.itemColors(textColor = foreground, leadingIconColor = foreground),
                contentPadding = PaddingValues(
                    start = ROW_HORIZONTAL_PADDING + startInset,
                    end = ROW_HORIZONTAL_PADDING,
                    top = ROW_VERTICAL_PADDING,
                    bottom = ROW_VERTICAL_PADDING,
                ),
                modifier = Modifier.widthIn(min = ITEM_MIN_TARGET).heightIn(min = ITEM_MIN_TARGET),
            )
        }
    }
}
