// Keyboard focus indicator of the player: a 2 dp ring in the primary role plus a state layer, two visible channels at
// 3 to 1 or better against every surface (the primary role is derived for AA text contrast, D108). Material controls
// get the ring through the theme's ripple configuration, and the one-stop lists (the folder rail and the track list),
// whose entries cannot take focus one by one, draw the same ring on the entry under their own focus ring.

// What:     `package dev.monochromatic.musicplayer` places the indicator beside the theme that provides it.
// Why:      The theme and the list composables share this package.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     Imports bring in Compose drawing, the Material theme and the ripple configuration.
// Why:      The ring is a stroked rounded rectangle drawn over the content with a translucent fill under it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { drawWithContent, MaterialTheme, RippleThemeConfiguration } from "compose";
// ```
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RippleThemeConfiguration
import androidx.compose.material3.LocalRippleThemeConfiguration
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// What:     `internal val FOCUS_RING_WIDTH: Dp = 2.dp` is the thickness of the focus ring.
// Why:      The review asked for a 2 dp ring in the primary role on every focus indicator.
//
// In TS you'd write (pseudocode):
// ```ts
// const FOCUS_RING_WIDTH = "2dp";
// ```
/** Thickness of the keyboard focus ring. */
internal val FOCUS_RING_WIDTH: Dp = 2.dp

// What:     `internal const val FOCUS_LAYER_ALPHA: Float = 0.10f` is the focus state layer's opacity.
// Why:      Material 3 draws the focus state layer at ten percent of the content color over the surface.
//
// In TS you'd write (pseudocode):
// ```ts
// const FOCUS_LAYER_ALPHA = 0.1;
// ```
/** Opacity of the on-surface layer drawn under the ring on a focused entry. */
internal const val FOCUS_LAYER_ALPHA: Float = 0.10f

// What:     `internal val FOCUS_RING_CORNER: Dp = 8.dp` is the corner radius of the ring on a list entry.
// Why:      Entries are rows and 48 dp cells, and a small radius keeps the ring from looking like a button outline.
//
// In TS you'd write (pseudocode):
// ```ts
// const FOCUS_RING_CORNER = "8dp";
// ```
/** Corner radius of the focus ring drawn on a list entry. */
internal val FOCUS_RING_CORNER: Dp = 8.dp

// What:     `@Composable internal fun Modifier.keyboardFocusRing(visible, cornerRadius)` draws the ring and layer.
// Why:      An entry of a one-stop list cannot be focused by itself, so the list marks the entry under its ring with
//           the same two channels a focused button shows: the on-surface layer and a 2 dp primary ring inside the
//           entry's bounds, drawn over the content so nothing hides it.
//
// In TS you'd write (pseudocode):
// ```ts
// const keyboardFocusRing = (visible: boolean, radius: number) => visible ? withRingAndLayer(theme.primary) : none;
// ```
/**
 * Draws a state layer and a 2 dp primary ring over the content when [visible] is true, and nothing otherwise.
 *
 * @param visible whether the entry holds the focus ring of a focused list.
 * @param cornerRadius corner radius of the ring and the layer.
 */
@Composable
internal fun Modifier.keyboardFocusRing(visible: Boolean, cornerRadius: Dp = FOCUS_RING_CORNER): Modifier {
    if (!visible) {
        return this
    }
    /** Ring color, the primary role. */
    val ringColor: Color = MaterialTheme.colorScheme.primary
    /** State layer color, the on-surface role at the focus opacity. */
    val layerColor: Color = MaterialTheme.colorScheme.onSurface.copy(alpha = FOCUS_LAYER_ALPHA)
    return this.drawWithContent {
        drawContent()
        /** Corner radius in pixels. */
        val radius = CornerRadius(cornerRadius.toPx())
        drawRoundRect(color = layerColor, cornerRadius = radius)
        /** Stroke width in pixels. */
        val width: Float = FOCUS_RING_WIDTH.toPx()
        drawRoundRect(
            color = ringColor,
            topLeft = Offset(width / 2f, width / 2f),
            size = Size(size.width - width, size.height - width),
            cornerRadius = radius,
            style = Stroke(width = width),
        )
    }
}

// What:     `@Composable internal fun focusRingTheme(content)` gives every Material control the ring in its focus.
// Why:      Material 3 reads the focus appearance from the ripple theme configuration, so providing the inset ring
//           there gives buttons, icon buttons, menu rows and clickable rows the ring in the secondary role, which
//           the theme maps to the primary role, without touching each control.
//
// In TS you'd write (pseudocode):
// ```ts
// const FocusRingTheme = ({ children }) => <RippleConfig focus={insetRing(2)}>{children}</RippleConfig>;
// ```
/** Provides [content] with a 2 dp inset focus ring from the Material ripple theme configuration. */
@Composable
internal fun focusRingTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(
        LocalRippleThemeConfiguration provides RippleThemeConfiguration(
            focus = RippleThemeConfiguration.Focus.InsetRing(
                outerStrokeInset = 0.dp,
                outerStrokeWidth = FOCUS_RING_WIDTH,
                innerStrokeInset = FOCUS_RING_WIDTH,
                innerStrokeWidth = 0.dp,
            ),
        ),
        content = content,
    )
}
