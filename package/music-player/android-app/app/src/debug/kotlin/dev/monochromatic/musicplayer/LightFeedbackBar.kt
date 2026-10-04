//region Native feedback surfaces, no storage or playback operations
// What: Package shares the namespace of the isolated debug host.
// Why: The host can compose these surfaces without a production operation owner.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose native layout functions and their immutable Modifier configuration.
// Why: Real Material measurement, rather than an HTML replica, determines wrapping and button size.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Row, Modifier } from 'native-ui';
// ```
import androidx.compose.foundation.layout.Row
// BoxWithConstraints supplies the available native width.
import androidx.compose.foundation.layout.BoxWithConstraints
// Minimum measured dimensions do not rely on expanded touch regions.
import androidx.compose.foundation.layout.defaultMinSize
// Error background spans the owning window.
import androidx.compose.foundation.layout.fillMaxWidth
// Padding reserves content space inside each surface.
import androidx.compose.foundation.layout.padding
// Icon layout size is explicit and noninteractive.
import androidx.compose.foundation.layout.size
// The toast's maximum width permits wrapping instead of overflowing.
import androidx.compose.foundation.layout.widthIn
// The bottom bar owns its navigation inset; Scaffold does not pad custom bottom-bar content.
import androidx.compose.foundation.layout.WindowInsets
// Actual system navigation-bar geometry, not a copied height.
import androidx.compose.foundation.layout.navigationBars
// Reserve this inset inside the bar background, keeping Dismiss out of the system region.
import androidx.compose.foundation.layout.windowInsetsPadding
// Accepted content-width toast uses a rounded surface.
import androidx.compose.foundation.shape.RoundedCornerShape
// Native icon catalogue, not an imported image.
import androidx.compose.material.icons.Icons
// Warning adds an evidence channel beyond error color.
import androidx.compose.material.icons.filled.Warning
// Material icon renders a decorative warning beside literal error copy.
import androidx.compose.material3.Icon
// System theme supplies semantic foreground and background roles.
import androidx.compose.material3.MaterialTheme
// Surface draws the background separately from layout content.
import androidx.compose.material3.Surface
// Text renders native font metrics at the system font scale.
import androidx.compose.material3.Text
// TextButton provides named native actions with explicit layout floors.
import androidx.compose.material3.TextButton
// A composable function emits native UI inside composition.
import androidx.compose.runtime.Composable
// Alignment keeps controls centered beside wrapped copy.
import androidx.compose.ui.Alignment
// Modifier describes immutable native layout changes.
import androidx.compose.ui.Modifier
// Bold weight marks the Undo action without relying on color.
import androidx.compose.ui.text.font.FontWeight
// Dp is density-independent distance, unlike raw pixels or font-scaled Sp.
import androidx.compose.ui.unit.Dp
// dp converts literal distances into native layout units.
import androidx.compose.ui.unit.dp

/**
 * What: A composable named function receives copy, a physical content inset and a callback.
 * Why: D9's dismissible bar names the authored failure without adding unowned recovery actions.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function LightFeedbackErrorBar(input: { message: string; isCover: boolean; onDismiss: () => void }): UIElement;
 * ```
 */
@Composable
internal fun LightFeedbackErrorBar(message: String, isCover: Boolean, onDismiss: () -> Unit,
    onMeasure: (String) -> Unit) {
    Surface(color = MaterialTheme.colorScheme.errorContainer,
        modifier = lightFeedbackMeasurement("error-surface", onMeasure)) {
        BoxWithConstraints(modifier = Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.navigationBars)) {
            // What: val is an immutable binding; an if expression selects a Dp distance.
            // Why: Inner-panel error information stays on the track side of the physical crease.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const start = isCover ? 16 : width / 2 + 32;
            // ```
            val start: Dp = if (isCover) 16.dp else maxWidth / 2 + 32.dp
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = start, end = 16.dp, top = 8.dp, bottom = 8.dp)
                    .then(lightFeedbackMeasurement("error-content", onMeasure)),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(imageVector = Icons.Filled.Warning, contentDescription = null,
                    modifier = Modifier.size(24.dp), tint = MaterialTheme.colorScheme.onErrorContainer)
                Text(text = message, color = MaterialTheme.colorScheme.onErrorContainer,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f).padding(start = 8.dp, end = 8.dp))
                TextButton(onClick = onDismiss, modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    .then(lightFeedbackMeasurement("dismiss-button", onMeasure))) {
                    Text(text = "Dismiss", color = MaterialTheme.colorScheme.onErrorContainer,
                        fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/**
 * What: A content-width native toast accepts a finite width and a debug-only intent callback.
 * Why: D8/D29's Undo surface can wrap at large font scales without pushing the player layout.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function LightFeedbackUndoToast(input: { maximumWidth: number; onUndo: () => void }): UIElement;
 * ```
 */
@Composable
internal fun LightFeedbackUndoToast(maximumWidth: Dp, onUndo: () -> Unit, onMeasure: (String) -> Unit) {
    Surface(shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surfaceContainerHigh,
        modifier = lightFeedbackMeasurement("undo-surface", onMeasure), shadowElevation = 3.dp) {
        Row(modifier = Modifier.widthIn(max = maximumWidth).padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically) {
            // What: weight with fill=false allocates remaining width without forcing short text to stretch.
            // Why: The unweighted Undo button keeps its layout floor; the message wraps inside the remainder.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // renderText({ maxWidth: remainingWidth, grow: false });
            // ```
            Text(text = "Ghost moved to trash", style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f, fill = false).padding(end = 8.dp))
            TextButton(onClick = onUndo, modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                .then(lightFeedbackMeasurement("undo-button", onMeasure))) {
                Text(text = "Undo", fontWeight = FontWeight.Bold)
            }
        }
    }
}
//endregion
