//region Floating notice content, measured two-line fallback and debug-only actions
// What: Package shares the isolated native feedback namespace.
// Why: These surfaces cannot create a production storage or recovery owner.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports supply native composition, layout and Material presentation APIs.
// Why: Real font measurement and controls establish fit instead of copying historical HTML geometry.
//
// In TS you'd write (pseudocode):
// ```ts
// import { BoxWithConstraints, Text } from 'native-ui';
// ```
import androidx.compose.foundation.layout.BoxWithConstraints
// Column stacks a bounded message row and optional diagnostic action without resizing the player.
import androidx.compose.foundation.layout.Column
// Row places the warning, text and immediate-dismiss control together.
import androidx.compose.foundation.layout.Row
// Controls retain explicit measured layout minima.
import androidx.compose.foundation.layout.defaultMinSize
// Padding describes message breathing room rather than a player-space reservation.
import androidx.compose.foundation.layout.padding
// Decorative warning size is explicit.
import androidx.compose.foundation.layout.size
// Finite content width follows the owning viewport.
import androidx.compose.foundation.layout.widthIn
// Rounded surface belongs to the floating notice only.
import androidx.compose.foundation.shape.RoundedCornerShape
// Native icon catalogue.
import androidx.compose.material.icons.Icons
// Close names immediate dismissal through its description.
import androidx.compose.material.icons.filled.Close
// Warning gives failure evidence a second channel beyond color.
import androidx.compose.material.icons.filled.Warning
// Material icon presentation.
import androidx.compose.material3.Icon
// IconButton provides immediate dismissal without adding a message line.
import androidx.compose.material3.IconButton
// Actual system semantic color and typography roles.
import androidx.compose.material3.MaterialTheme
// SnackbarData supplies the host-owned manual dismissal operation.
import androidx.compose.material3.SnackbarData
// Surface is overlaid, never Scaffold bottom-bar content.
import androidx.compose.material3.Surface
// Native text metrics.
import androidx.compose.material3.Text
// TextButton names diagnostic and Undo intents.
import androidx.compose.material3.TextButton
// Composable functions run within the native UI tree.
import androidx.compose.runtime.Composable
// LaunchedEffect records a measured copy decision once per presentation input.
import androidx.compose.runtime.LaunchedEffect
// Alignment centers controls beside wrapped text.
import androidx.compose.ui.Alignment
// Immutable layout configuration.
import androidx.compose.ui.Modifier
// Density converts the finite available text width into physical pixels.
import androidx.compose.ui.platform.LocalDensity
// Bold weight marks actions independently of color.
import androidx.compose.ui.text.font.FontWeight
// Retained native measurer follows actual density, font scale and writing direction.
import androidx.compose.ui.text.rememberTextMeasurer
// Ellipsis prevents a fallback from silently growing beyond its two-line contract.
import androidx.compose.ui.text.style.TextOverflow
// Constraints bounds native text measurement to the actual message slot.
import androidx.compose.ui.unit.Constraints
// Dp is layout distance, not raw pixels or font-scaled Sp.
import androidx.compose.ui.unit.Dp
// Literal distance conversion.
import androidx.compose.ui.unit.dp

/**
 * What: A named composable measures full authored copy and renders a bounded floating error notice.
 * Why: D83 redirects extra detail to Android logs instead of allocating player space or extra message lines.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function LightFeedbackErrorNotice(input: { scene: string; message: string; width: number; data: SnackbarData; onEvent: (event: string) => void }): UIElement;
 * ```
 */
@Composable
internal fun LightFeedbackErrorNotice(scene: String, message: String, maximumWidth: Dp,
    data: SnackbarData, onEvent: (String) -> Unit) {
    BoxWithConstraints(modifier = Modifier.widthIn(max = maximumWidth)) {
        // What: val is immutable; a native measurer owns the current font-resolution context.
        // Why: The same literal message can need different line counts across cover and enlarged-text views.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const measurer = createNativeTextMeasurer();
        // ```
        val measurer = rememberTextMeasurer()
        val density = LocalDensity.current
        val textWidth = maxWidth - 128.dp
        // What: with supplies density conversion; roundToPx returns the required whole-pixel constraint.
        // Why: Reserve known warning, gaps, horizontal padding and 48dp dismissal before measuring text.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const textPixels = Math.round(textWidth * density);
        // ```
        val textPixels = with(density) { textWidth.roundToPx() }
        if (textPixels <= 0) throw IllegalArgumentException("Feedback message slot has no usable width.")
        val measured = measurer.measure(text = message, style = MaterialTheme.typography.bodyMedium,
            maxLines = 3, constraints = Constraints(maxWidth = textPixels))
        val needsLogs = lightFeedbackNeedsLogs(measured.lineCount, measured.hasVisualOverflow)
        val brief = lightFeedbackBriefMessage(scene)
        val briefMeasured = measurer.measure(text = brief, style = MaterialTheme.typography.bodyMedium,
            maxLines = 3, constraints = Constraints(maxWidth = textPixels))
        // What: A conditional expression returns visible copy rather than mutating the full diagnostic input.
        // Why: Even a narrow summary keeps the log-capture direction rather than enlarging the message.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const visible = needsLogs ? (briefFits ? brief : 'Capture Android logs.') : message;
        // ```
        val visible = if (!needsLogs) message else if (briefMeasured.lineCount <= 2 && !briefMeasured.hasVisualOverflow) brief else "Capture Android logs."
        LaunchedEffect(scene, visible, needsLogs) {
            onEvent("LightFeedbackErrorNotice.copy:lines=${measured.lineCount},logs=$needsLogs,visible=$visible")
        }
        Surface(shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.errorContainer,
            modifier = lightFeedbackMeasurement("error-notice", onEvent), shadowElevation = 3.dp) {
            Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(imageVector = Icons.Filled.Warning, contentDescription = null,
                        modifier = Modifier.size(24.dp), tint = MaterialTheme.colorScheme.onErrorContainer)
                    Text(text = visible, maxLines = 2, overflow = TextOverflow.Ellipsis,
                        color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f, fill = false).padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 8.dp))
                    // What: Trailing lambda passes a callback to the native control.
                    // Why: Manual dismissal changes only host-owned presentation, never the file outcome.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // renderDismissButton(() => { onEvent('dismiss'); data.dismiss(); });
                    // ```
                    IconButton(onClick = { onEvent("LightFeedbackErrorNotice.manual-dismiss:$scene"); data.dismiss() },
                        modifier = Modifier.size(48.dp).then(lightFeedbackMeasurement("dismiss-button", onEvent))) {
                        Icon(imageVector = Icons.Filled.Close, contentDescription = "Dismiss message",
                            tint = MaterialTheme.colorScheme.onErrorContainer)
                    }
                }
                if (needsLogs) {
                    TextButton(onClick = { onEvent("LightFeedbackErrorNotice.capture-android-logs-intent:$scene") },
                        modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                            .then(lightFeedbackMeasurement("capture-logs-button", onEvent))) {
                        Text(text = "Capture Android logs", color = MaterialTheme.colorScheme.onErrorContainer,
                            fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/**
 * What: A content-width floating native action emits an authored Undo intent and uses host dismissal.
 * Why: Undo availability remains separate from trash requests, while the message never reserves player space.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function LightFeedbackUndoNotice(input: { width: number; data: SnackbarData; onEvent: (event: string) => void }): UIElement;
 * ```
 */
@Composable
internal fun LightFeedbackUndoNotice(maximumWidth: Dp, data: SnackbarData, onEvent: (String) -> Unit) {
    Surface(shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surfaceContainerHigh,
        modifier = lightFeedbackMeasurement("undo-notice", onEvent), shadowElevation = 3.dp) {
        Row(modifier = Modifier.widthIn(max = maximumWidth).padding(start = 16.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Text(text = "Ghost moved to trash", maxLines = 2, overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f, fill = false).padding(end = 8.dp, top = 8.dp, bottom = 8.dp))
            TextButton(onClick = { onEvent("LightFeedbackUndoNotice.undo-intent:Ghost"); data.performAction() },
                modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    .then(lightFeedbackMeasurement("undo-button", onEvent))) {
                Text(text = "Undo", fontWeight = FontWeight.Bold)
            }
            IconButton(onClick = { onEvent("LightFeedbackUndoNotice.manual-dismiss:Ghost"); data.dismiss() },
                modifier = Modifier.size(48.dp).then(lightFeedbackMeasurement("undo-dismiss-button", onEvent))) {
                Icon(imageVector = Icons.Filled.Close, contentDescription = "Dismiss Undo message")
            }
        }
    }
}
//endregion
