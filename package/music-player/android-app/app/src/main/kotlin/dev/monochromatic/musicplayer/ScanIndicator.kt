// What:     `package dev.monochromatic.musicplayer` places the scan indicator beside the other
//           player composables.
// Why:      The indicator is a stateless composable that the caller overlays at the bottom edge.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     Imports from `androidx.compose.foundation` bring in the background and layout helpers.
// Why:      The bar paints its tinted ground and reserves a fixed 56dp row at the bottom edge.
//
// In TS you'd write (pseudocode):
// ```ts
// import { background, Box, Column } from "compose/foundation";
// ```
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding

// What:     Imports from `androidx.compose.material3` bring in the progress line, theme, and text.
// Why:      The indicator uses Material 3 roles so it follows the app theme in light and dark.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LinearProgressIndicator, MaterialTheme, Text } from "material3";
// ```
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text

// What:     Imports from `androidx.compose.runtime` and `ui` bring in the composable marker,
//           modifiers, alignment, and ellipsis.
// Why:      The composable is annotated, takes a modifier, and clips its one-line status text.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier, Alignment, TextOverflow } from "compose/ui";
// ```
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// What:     Imports from the core package bring in the indicator model and status text rule.
// Why:      The composable renders what the pure model describes and never reads sweep state.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ScanIndicatorModel, scanIndicatorStatusText } from "core/ScanIndicatorModel";
// ```
import dev.monochromatic.musicplayer.core.ScanIndicatorModel
import dev.monochromatic.musicplayer.core.ScanIndicatorPhase
import dev.monochromatic.musicplayer.core.scanIndicatorStatusText

// What:     `private val BAR_HEIGHT: Dp = 56.dp` names the fixed height of the bar.
// Why:      A constant height means showing or hiding the bar never changes the caller's layout.
//
// In TS you'd write (pseudocode):
// ```ts
// const BAR_HEIGHT = 56;
// ```
/** Fixed total height of the bar, including the progress line and the status row. */
private val BAR_HEIGHT: Dp = 56.dp

// What:     `private val BAR_HORIZONTAL_PADDING: Dp = 16.dp` names the inset of the status text.
// Why:      The accepted study places the status line 16dp from each side of the bar.
//
// In TS you'd write (pseudocode):
// ```ts
// const BAR_HORIZONTAL_PADDING = 16;
// ```
/** Horizontal inset between the bar edges and the status text. */
private val BAR_HORIZONTAL_PADDING: Dp = 16.dp

// What:     `internal fun scanIndicatorFraction(...)` computes the determinate progress fraction.
// Why:      Only the measuring phase with a known total has a fraction; every other phase is indeterminate.
//
// In TS you'd write (pseudocode):
// ```ts
// function scanIndicatorFraction(model: ScanIndicatorModel): number | null;
// ```
/**
 * Returns the completed share of the true-peak measurement, or null when the bar is indeterminate.
 *
 * @param model indicator state to measure
 * @return a fraction from zero to one, or null when no known total exists
 */
internal fun scanIndicatorFraction(model: ScanIndicatorModel): Float? {
    if (model.phase != ScanIndicatorPhase.MEASURING_TRUE_PEAK) {
        return null
    }
    if (model.total <= 0) {
        return null
    }
    /** Done count clamped into the total, so an overshooting model still yields a fraction up to one. */
    val clampedDone: Int = model.done.coerceIn(0, model.total)
    return clampedDone.toFloat() / model.total.toFloat()
}

// What:     `@Composable fun scanIndicator(...)` draws the bottom-edge scan bar for the model.
// Why:      A stateless bar at a fixed height can be overlaid by the caller without reflowing content.
//
// In TS you'd write (pseudocode):
// ```ts
// function scanIndicator(model: ScanIndicatorModel, modifier?: Modifier): UIElement;
// ```
/**
 * Draws the scan status bar with a progress line and one status line, or nothing when hidden.
 *
 * @param model indicator state to render
 * @param modifier outer modifier supplied by the caller, which should align the bar to the bottom
 */
@Composable
fun scanIndicator(model: ScanIndicatorModel, modifier: Modifier = Modifier) {
    if (!model.visible) {
        return
    }
    /** Determinate fraction for the measuring phase, or null when the progress line is indeterminate. */
    val fraction: Float? = scanIndicatorFraction(model)
    /** Single status line, already formatted with grouped ASCII digits. */
    val statusText: String = scanIndicatorStatusText(model)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .height(BAR_HEIGHT)
            .background(MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        if (fraction == null) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        } else {
            LinearProgressIndicator(progress = { fraction }, modifier = Modifier.fillMaxWidth())
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(horizontal = BAR_HORIZONTAL_PADDING),
            contentAlignment = Alignment.CenterStart,
        ) {
            Text(
                text = statusText,
                style = MaterialTheme.typography.bodySmall.copy(fontFeatureSettings = "tnum"),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
