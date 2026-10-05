//region Accepted scan-F geometry and authored text, no analysis owner
// What: Package connects the native bar to the pure authored state.
// Why: Rendering never reads library or worker state.
//
// In TS you'd write (pseudocode):
// ```ts
// // Source-folder module namespace.
// ```
package dev.monochromatic.musicplayer

// What: Named imports expose native rows, explicit dimensions and Material controls.
// Why: The accepted count label and stable Pause/Resume slot use actual Compose layout.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Row, OutlinedButton, Text } from 'native-ui';
// ```
import androidx.compose.foundation.background
// Horizontal spacing remains independent from label length.
import androidx.compose.foundation.layout.Arrangement
// A native row retains the control's fixed slot.
import androidx.compose.foundation.layout.Row
// The separator remains inside the settled 56dp bar height.
import androidx.compose.foundation.layout.Column
// Explicit native button content padding.
import androidx.compose.foundation.layout.PaddingValues
// Full-width scan row belongs at the bottom edge.
import androidx.compose.foundation.layout.fillMaxWidth
// A 56dp bar is the settled scan-F height.
import androidx.compose.foundation.layout.height
// Native control owns at least 48dp, not only an expanded hit region.
import androidx.compose.foundation.layout.heightIn
// Logical edge padding preserves the accepted row placement.
import androidx.compose.foundation.layout.padding
// The control width never follows Pause versus Resume text.
import androidx.compose.foundation.layout.width
// Current scheme supplies light and dark role colors.
import androidx.compose.material3.MaterialTheme
// A visible seam separates the scan bar without relying on color alone.
import androidx.compose.material3.HorizontalDivider
// Actual native control rather than an imitation pointer region.
import androidx.compose.material3.OutlinedButton
// Native text rendering and layout diagnostics.
import androidx.compose.material3.Text
// Native composition registration.
import androidx.compose.runtime.Composable
// Row children share a vertical center.
import androidx.compose.ui.Alignment
// Immutable native layout configuration.
import androidx.compose.ui.Modifier
// The status label preserves the accepted single-line ellipsis.
import androidx.compose.ui.text.style.TextOverflow
// Literal native layout distances.
import androidx.compose.ui.unit.dp
// Locale-pinned grouping belongs only to authored English study text.
import java.text.NumberFormat
// English fixture counts mirror the accepted source, not a product locale default.
import java.util.Locale

/**
 * What: A named composable accepts immutable state plus an event callback and diagnostic callback.
 * Why: Native Pause/Resume changes only the authored record, with no decoder or persistence access.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function ScanIndicatorBar(input: { state: ScanIndicatorState; onAction: (event: string) => void; onMeasure: (event: string) => void }): UIElement;
 * ```
 */
@Composable
internal fun ScanIndicatorBar(state: ScanIndicatorState, onAction: (String) -> Unit, onMeasure: (String) -> Unit,
    controlPaddingDp: Int = 0) {
    // What: val is a read-only binding; Java's locale-aware integer formatter emits grouped whole counts.
    // Why: Wider-count probes change actual status text without estimating analysis duration or locale policy.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    // ```
    val numbers = NumberFormat.getIntegerInstance(Locale.US)
    val label = "Analysing true peak · ${numbers.format(state.done)} of ${numbers.format(state.total)}"
    val control = scanIndicatorControl(state)
    // What: A trailing lambda supplies row children; modifier calls return combined layout instructions.
    // Why: Count width cannot steal the fixed button width or alter the 56dp active row.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // <Row height={56} gap={12}><Text flex={1}/><Button width={100}/></Row>
    // ```
    Column(modifier = Modifier.fillMaxWidth().height(56.dp)
        .background(MaterialTheme.colorScheme.surfaceContainerLow)
        .scanIndicatorMeasure("bar", onMeasure)) {
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Row(modifier = Modifier.fillMaxWidth().weight(1f).padding(start = 16.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(text = label, modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.bodySmall.copy(fontFeatureSettings = "tnum"),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
                onTextLayout = { layout ->
                    onMeasure("ScanIndicator.text:status:lines=${layout.lineCount},overflow=${layout.hasVisualOverflow}")
                })
            OutlinedButton(onClick = {
                // What: An if expression selects the matching checked event, not a worker command.
                // Why: The one visible control cannot accidentally dispatch both actions.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // onAction(state.phase === 'paused' ? 'resume' : 'pause');
                // ```
                onAction(if (state.phase == "paused") "resume" else "pause")
            }, modifier = Modifier.width(100.dp).heightIn(min = 48.dp)
                .scanIndicatorMeasure("control", onMeasure),
                contentPadding = PaddingValues(horizontal = controlPaddingDp.dp, vertical = 8.dp)) {
                Text(text = control, maxLines = 1,
                    onTextLayout = { layout ->
                        onMeasure("ScanIndicator.text:control:$control:lines=${layout.lineCount},overflow=${layout.hasVisualOverflow}")
                        // What: Native layout exposes its constrained size, intrinsic text width and overflow axes.
                        // Why: The paired padding probe can distinguish wrapping/clipping from a guessed font-width problem.
                        //
                        // In TS you\'d write (pseudocode):
                        // ```ts
                        // log({ size: layout.size, intrinsic: layout.paragraph.maxIntrinsicWidth, overflowWidth, overflowHeight });
                        // ```
                        onMeasure("ScanIndicator.control-fit:$control:padding=$controlPaddingDp,size=${layout.size}," +
                            "intrinsic=${layout.multiParagraph.maxIntrinsicWidth},widthOverflow=${layout.didOverflowWidth}," +
                            "heightOverflow=${layout.didOverflowHeight}")
                    })
            }
        }
    }
}
//endregion
