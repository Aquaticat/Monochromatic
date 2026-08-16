// What:     `package dev.monochromatic.musicplayer` places LED page controls beside the player UI.
// Why:      The reference-driven hardware renderer is large enough to own a focused source file.
//
// In TS you'd write (pseudocode):
// ```ts
// // File path supplies the module namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `background` paints solid colors or shapes behind a composable.
// Why:      Shared plate, opening, and cap pigments need rigid silhouettes.
//
// In TS you'd write (pseudocode):
// ```ts
// import { background } from "compose/foundation";
// ```
import androidx.compose.foundation.background

// What:     `Box` is Compose's overlay container, comparable to a positioned `div`.
// Why:      Plate, cap, depth cues, and labels occupy stacked layers.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Box } from "compose/layout";
// ```
import androidx.compose.foundation.layout.Box

// What:     `fillMaxSize` makes a visual layer use all constraints from its measured parent.
// Why:      Plate and cap paint must cover their exact hardware bounds.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fillMaxSize } from "compose/layout";
// ```
import androidx.compose.foundation.layout.fillMaxSize

// What:     `height` fixes a target or cap to one density-independent height.
// Why:      Reference geometry pins caps to 44 units and owned touch targets to 48 units.
//
// In TS you'd write (pseudocode):
// ```ts
// import { height } from "compose/layout";
// ```
import androidx.compose.foundation.layout.height

// What:     `padding` insets selected cap paint by one unit without deforming its body.
// Why:      Latched caps need the reference's CNC clearance.
//
// In TS you'd write (pseudocode):
// ```ts
// import { padding } from "compose/layout";
// ```
import androidx.compose.foundation.layout.padding

// What:     `widthIn` keeps natural label width between a 48-unit target and row capacity.
// Why:      Labels remain content-width and pathological labels ellipsize.
//
// In TS you'd write (pseudocode):
// ```ts
// import { widthIn } from "compose/layout";
// ```
import androidx.compose.foundation.layout.widthIn

// What:     `selectable` gives a cap one selected state, radio semantics, and click action.
// Why:      Every hardware cap remains an accessible page selector.
//
// In TS you'd write (pseudocode):
// ```ts
// import { selectable } from "compose/selection";
// ```
import androidx.compose.foundation.selection.selectable

// What:     `selectableGroup` marks the complete control as one mutually exclusive set.
// Why:      Accessibility services announce page caps as related radio choices.
//
// In TS you'd write (pseudocode):
// ```ts
// import { selectableGroup } from "compose/selection";
// ```
import androidx.compose.foundation.selection.selectableGroup

// What:     `RoundedCornerShape` stores independent start and end corner radii.
// Why:      Exposed ends use radius 9 while inner-facing corners use radius 2.
//
// In TS you'd write (pseudocode):
// ```ts
// import { RoundedCornerShape } from "compose/shapes";
// ```
import androidx.compose.foundation.shape.RoundedCornerShape

// What:     `MaterialTheme` exposes runtime primary and on-primary accent colors.
// Why:      Reference purple is replaced by scene-safe colors derived from live accent.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MaterialTheme } from "compose/material";
// ```
import androidx.compose.material3.MaterialTheme

// What:     `Text` paints one hardware legend.
// Why:      Cap labels need one-line ellipsis and emitted selected ink.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Text } from "compose/material";
// ```
import androidx.compose.material3.Text

// What:     `Composable` marks functions that emit or inspect Compose UI.
// Why:      Hardware rows read theme, density, and layout composition state.
//
// In TS you'd write (pseudocode):
// ```ts
// type Composable = () => UiNode;
// ```
import androidx.compose.runtime.Composable

// What:     `Alignment` supplies named center placement inside each target.
// Why:      A 44-unit cap sits centrally inside its 48-unit owned target.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Alignment } from "compose/ui";
// ```
import androidx.compose.ui.Alignment

// What:     `Modifier` is Compose's immutable layout and paint descriptor.
// Why:      Hardware layers compose size, shadows, clipping, paint, and semantics.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Modifier } from "compose/ui";
// ```
import androidx.compose.ui.Modifier

// What:     `clip` confines cap gradients to rigid per-corner silhouettes.
// Why:      Bloom may escape, but plastic form shading must not.
//
// In TS you'd write (pseudocode):
// ```ts
// import { clip } from "compose/draw";
// ```
import androidx.compose.ui.draw.clip

// What:     `drawWithCache` builds size-dependent brushes once per geometry or color change.
// Why:      Offset dome and hot-layer centers depend on measured cap dimensions.
//
// In TS you'd write (pseudocode):
// ```ts
// import { drawWithCache } from "compose/draw";
// ```
import androidx.compose.ui.draw.drawWithCache

// What:     `dropShadow` paints selected emission or raised-cap cast shadow outside a cap.
// Why:      Depth differs redundantly between latched and unlatched hardware.
//
// In TS you'd write (pseudocode):
// ```ts
// import { dropShadow } from "compose/draw";
// ```
import androidx.compose.ui.draw.dropShadow

// What:     `innerShadow` paints opening occlusion and plate shoulder falloff.
// Why:      Recessed caps and machined metal need directional depth.
//
// In TS you'd write (pseudocode):
// ```ts
// import { innerShadow } from "compose/draw";
// ```
import androidx.compose.ui.draw.innerShadow

// What:     `Offset` stores pixel coordinates for gradients and text glow.
// Why:      Reference key light and emission centers are not geometric-center spotlights.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Offset } from "compose/geometry";
// ```
import androidx.compose.ui.geometry.Offset

// What:     `Size` stores measured pixel width and height for cached cap brushes.
// Why:      Offset dome and glow geometry depends on actual content-width cap bounds.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Size } from "compose/geometry";
// ```
import androidx.compose.ui.geometry.Size

// What:     `Brush` creates continuous linear and radial paint ramps.
// Why:      Rigid plastic and bead-blasted metal use smooth material shading.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Brush } from "compose/graphics";
// ```
import androidx.compose.ui.graphics.Brush

// What:     `Color` stores scene pigment and light-transport values.
// Why:      Dark and light scenes share cap materials but change their surroundings.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Color } from "compose/graphics";
// ```
import androidx.compose.ui.graphics.Color

// What:     `Shape` is Compose's reusable outline interface.
// Why:      Same connected outline feeds every material and shadow modifier.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Shape } from "compose/graphics";
// ```
import androidx.compose.ui.graphics.Shape

// What:     `lerp` interpolates two colors by a normalized fraction.
// Why:      Selected hot, edge, and glow colors derive from runtime accent.
//
// In TS you'd write (pseudocode):
// ```ts
// import { lerpColor } from "compose/graphics";
// ```
import androidx.compose.ui.graphics.lerp

// What:     `HardwareShadow` aliases surface shadow configuration.
// Why:      Surface shadows stay distinct from legend text glow.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Shadow as HardwareShadow } from "compose/graphics/shadow";
// ```
import androidx.compose.ui.graphics.shadow.Shadow as HardwareShadow

// What:     `Placeable` is a measured composable ready for explicit positioning.
// Why:      Row wrapping must use actual target widths rather than guessed text widths.
//
// In TS you'd write (pseudocode):
// ```ts
// type Placeable = { width: number; height: number; place(x: number, y: number): void };
// ```
import androidx.compose.ui.layout.Placeable

// What:     `MeasureResult` returns constrained dimensions and deferred placement.
// Why:      Extracted row measurement keeps layout logic below method-length limits.
//
// In TS you'd write (pseudocode):
// ```ts
// type MeasureResult = { width: number; height: number; place(): void };
// ```
import androidx.compose.ui.layout.MeasureResult

// What:     `SubcomposeLayout` measures cap targets before creating one plate per resulting row.
// Why:      Standard FlowRow cannot expose wrapped-row bounds to a shared backdrop.
//
// In TS you'd write (pseudocode):
// ```ts
// import { SubcomposeLayout } from "compose/layout";
// ```
import androidx.compose.ui.layout.SubcomposeLayout

// What:     `SubcomposeMeasureScope` exposes density, subcomposition, and layout result creation.
// Why:      Focused measurement helpers share Compose's exact child-measure boundary.
//
// In TS you'd write (pseudocode):
// ```ts
// type SubcomposeMeasureScope = MeasureScope & { subcompose(key: unknown, content: UiNode): UiNode[] };
// ```
import androidx.compose.ui.layout.SubcomposeMeasureScope

// What:     `LocalDensity` converts the 15-unit engraved legend size into a `TextUnit`.
// Why:      Hardware ink keeps reference geometry instead of inheriting device font enlargement.
//
// In TS you'd write (pseudocode):
// ```ts
// import { density } from "compose/platform";
// ```
import androidx.compose.ui.platform.LocalDensity

// What:     `Role` labels each selectable cap as one radio choice.
// Why:      Custom visual hardware retains standard accessibility meaning.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Role } from "compose/semantics";
// ```
import androidx.compose.ui.semantics.Role

// What:     `TextStyle` captures identical selected and inactive measurement metrics.
// Why:      Changing state must never move a cap to another wrapped row.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { TextStyle } from "compose/text";
// ```
import androidx.compose.ui.text.TextStyle

// What:     `FontWeight` supplies the reference's semibold legend weight.
// Why:      Hardware ink uses weight 600 in both states.
//
// In TS you'd write (pseudocode):
// ```ts
// import { FontWeight } from "compose/text";
// ```
import androidx.compose.ui.text.font.FontWeight

// What:     `TextOverflow` supplies one-line ellipsis at constrained row width.
// Why:      No label wraps inside a hardware cap.
//
// In TS you'd write (pseudocode):
// ```ts
// import { TextOverflow } from "compose/text";
// ```
import androidx.compose.ui.text.style.TextOverflow

// What:     `TextShadow` aliases legend-emission shadow configuration.
// Why:      Selected ink glows independently from cap surface shadows.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Shadow as TextShadow } from "compose/graphics";
// ```
import androidx.compose.ui.graphics.Shadow as TextShadow

// What:     `Constraints` stores minimum and maximum measured pixel dimensions.
// Why:      Cap targets are measured against row capacity and one plate uses exact geometry.
//
// In TS you'd write (pseudocode):
// ```ts
// type Constraints = { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number };
// ```
import androidx.compose.ui.unit.Constraints

// What:     `Dp` names density-independent hardware geometry.
// Why:      Generator pixels map one-to-one to logical Compose units.
//
// In TS you'd write (pseudocode):
// ```ts
// type Dp = number & { readonly unit: "dp" };
// ```
import androidx.compose.ui.unit.Dp

// What:     `DpOffset` stores density-independent shadow displacement.
// Why:      Raised caps cast down-right while selected emission remains centered.
//
// In TS you'd write (pseudocode):
// ```ts
// type DpOffset = { x: Dp; y: Dp };
// ```
import androidx.compose.ui.unit.DpOffset

// What:     `TextUnit` stores a font dimension whose physical size follows the chosen density conversion.
// Why:      The hardware legend stays exactly 15 logical units across user font scales.
//
// In TS you'd write (pseudocode):
// ```ts
// type TextUnit = number & { readonly unit: "sp" };
// ```
import androidx.compose.ui.unit.TextUnit

// What:     `constrainHeight` clamps requested content height to parent bounds.
// Why:      Empty and multi-row controls must return a legal layout height.
//
// In TS you'd write (pseudocode):
// ```ts
// import { constrainHeight } from "compose/units";
// ```
import androidx.compose.ui.unit.constrainHeight

// What:     `dp` converts numeric literals into density-independent dimensions.
// Why:      Every geometry constant maps directly from the authoritative generator.
//
// In TS you'd write (pseudocode):
// ```ts
// const dp = (value: number): Dp => value as Dp;
// ```
import androidx.compose.ui.unit.dp

/** Stores reference's shared plate margin and inter-cap channel. */
private val ledChannel: Dp = 8.dp

/** Stores reference cap height. */
private val ledCapHeight: Dp = 44.dp

/** Stores explicit Android-owned target height around one 44-unit cap. */
private val ledTargetHeight: Dp = 48.dp

/** Stores one cap-row plate height: 8 + 44 + 8. */
private val ledPlateHeight: Dp = 60.dp

/** Stores hardware legend's reference visual size. */
private val ledLegendSize: Dp = 15.dp

/** Stores label inset that yields source widths for representative reference labels. */
private val ledLegendHorizontalInset: Dp = 24.dp

/** Stores exposed end-cap radius. */
private val ledEndRadius: Dp = 9.dp

/** Stores inner-facing cap radius. */
private val ledInnerRadius: Dp = 2.dp

/** Stores shared plate radius concentric with cap end plus margin. */
private val ledPlateRadius: Dp = 17.dp

/** Stores runtime accent's away-edge darkening mix. */
private const val LED_ACCENT_EDGE_MIX: Float = 0.28f

/** Stores runtime accent's hot-layer foreground mix. */
private const val LED_ACCENT_HOT_MIX: Float = 0.22f

/** Stores runtime accent's emitted-ink foreground mix. */
private const val LED_ACCENT_INK_GLOW_MIX: Float = 0.72f

/** Stores first-quarter shoulder transition. */
private const val LED_GRADIENT_QUARTER: Float = 0.25f

/** Stores highlight-to-neutral shoulder transition. */
private const val LED_GRADIENT_NEAR_MIDDLE: Float = 0.45f

/** Stores neutral-to-shadow material transition. */
private const val LED_GRADIENT_MIDDLE: Float = 0.55f

/** Stores broad edge-falloff transition. */
private const val LED_GRADIENT_THREE_QUARTERS: Float = 0.75f

/** Stores dome's first edge-shadow transition. */
private const val LED_DOME_EDGE_START: Float = 0.86f

/** Stores dome's final edge-shadow transition. */
private const val LED_DOME_EDGE_END: Float = 0.93f

/** Describes measured cap indexes sharing one wrapped row. */
internal data class LedLine(
    /** Lists source page indexes in visual row order. */
    val pageIndexes: List<Int>,
    /** Stores occupied cap extent including both horizontal plate margins. */
    val widthPx: Int,
)

/** Groups pure row-packing inputs. */
internal data class LedPackingOptions(
    /** Stores actual measured target widths in physical pixels. */
    val capWidthsPx: List<Int>,
    /** Stores available row width in physical pixels. */
    val maximumWidthPx: Int,
    /** Stores plate margin on each horizontal side. */
    val marginPx: Int,
    /** Stores channel width between adjacent caps. */
    val gapPx: Int,
)

/** Groups measured legend width with cap width limits. */
internal data class LedCapWidthOptions(
    /** Stores natural measured legend width. */
    val labelWidthPx: Int,
    /** Stores horizontal legend inset on one side. */
    val insetPx: Int,
    /** Stores visible and owned minimum target width. */
    val minimumWidthPx: Int,
    /** Stores row-capacity maximum after plate margins. */
    val maximumWidthPx: Int,
)

/** Groups one-piece multi-line plate height inputs. */
internal data class LedMultilineHeightOptions(
    /** Stores count of wrapped control rows. */
    val lineCount: Int,
    /** Stores full plate height for one row. */
    val plateHeightPx: Int,
    /** Stores vertical pitch between cap rows. */
    val rowPitchPx: Int,
)

/** Groups state and selection action for complete wrapping LED control. */
internal data class LedPageControlsOptions(
    /** Holds current pages and selected page index. */
    val state: PlayerUiState,
    /** Selects one page index. */
    val onSelectPage: (Int) -> Unit,
)

/** Stores runtime-derived selected colors and invariant inactive pigments. */
private data class LedPalette(
    /** Fills active translucent cap from current accent. */
    val selectedFill: Color,
    /** Shades active cap's away-from-light edge. */
    val selectedEdge: Color,
    /** Lights active cap's gentle hot layer. */
    val selectedHot: Color,
    /** Emits active cap bloom into its clearance. */
    val selectedGlow: Color,
    /** Paints active legend for accent contrast. */
    val selectedInk: Color,
    /** Emits light behind active legend. */
    val selectedInkGlow: Color,
)

/** Groups target content, geometry, scene, and action. */
private data class LedTargetOptions(
    /** Holds one page label. */
    val label: String,
    /** Records page selection. */
    val selected: Boolean,
    /** Records first logical cap in this row. */
    val first: Boolean,
    /** Records last logical cap in this row. */
    val last: Boolean,
    /** Records bright ambient scene. */
    val lightScene: Boolean,
    /** Holds dynamic accent-derived colors. */
    val palette: LedPalette,
    /** Holds fixed legend measurement style. */
    val labelStyle: TextStyle,
    /** Selects this page. */
    val onSelect: () -> Unit,
)

/** Groups cap state with its rigid per-corner shapes. */
private data class LedCapOptions(
    /** Records selected latch state. */
    val selected: Boolean,
    /** Records bright ambient scene. */
    val lightScene: Boolean,
    /** Holds opening silhouette. */
    val openingShape: RoundedCornerShape,
    /** Holds cap silhouette after selected clearance. */
    val capShape: RoundedCornerShape,
    /** Holds runtime accent-derived colors. */
    val palette: LedPalette,
)

/** Groups ambient scene with full-width one-piece plate silhouette. */
private data class LedPlateOptions(
    /** Records bright ambient scene. */
    val lightScene: Boolean,
    /** Holds complete rounded rectangular plate shape. */
    val shape: Shape,
)

/** Groups legend content with selected-state-invariant measurement style. */
private data class LedProbeLabelOptions(
    /** Holds one page label. */
    val label: String,
    /** Holds fixed legend measurement style. */
    val style: TextStyle,
)

/** Groups cap brush bounds with state-dependent pigment. */
private data class LedBrushOptions(
    /** Holds measured cap bounds in physical pixels. */
    val size: Size,
    /** Records selected latch state. */
    val selected: Boolean,
    /** Holds runtime accent-derived colors. */
    val palette: LedPalette,
)

/** Groups stable scene and state read by every measured row child. */
private data class LedLayoutOptions(
    /** Holds current pages and selected page index. */
    val state: PlayerUiState,
    /** Selects one page index. */
    val onSelectPage: (Int) -> Unit,
    /** Records bright ambient scene. */
    val lightScene: Boolean,
    /** Holds runtime accent-derived colors. */
    val palette: LedPalette,
    /** Holds selected-state-invariant legend metrics. */
    val labelStyle: TextStyle,
)

/** Groups incoming constraints with physical row geometry. */
private data class LedMeasureOptions(
    /** Holds stable scene and player state. */
    val layout: LedLayoutOptions,
    /** Holds parent measurement bounds. */
    val constraints: Constraints,
    /** Stores physical plate margin. */
    val marginPx: Int,
    /** Stores physical inter-cap and inter-row cap channel. */
    val gapPx: Int,
    /** Stores physical plate height. */
    val plateHeightPx: Int,
    /** Stores physical owned target height. */
    val targetHeightPx: Int,
    /** Stores target's vertical origin inside plate. */
    val targetOffsetYPx: Int,
)

/** Groups one target's source page and position within a packed row. */
private data class LedTargetFactoryOptions(
    /** Holds stable scene and player state. */
    val layout: LedLayoutOptions,
    /** Identifies source page index. */
    val page: Int,
    /** Records first logical cap in row. */
    val first: Boolean,
    /** Records last logical cap in row. */
    val last: Boolean,
)

/** Groups inputs for row-position-aware cap measurement. */
private data class LedPositionedMeasureOptions(
    /** Holds physical geometry and stable state. */
    val measure: LedMeasureOptions,
    /** Holds packed row membership and widths. */
    val lines: List<LedLine>,
    /** Holds target widths derived from measured legends. */
    val capWidthsPx: List<Int>,
)

/** Groups full-width plate measurement inputs. */
private data class LedPlateMeasureOptions(
    /** Holds physical geometry and ambient scene. */
    val measure: LedMeasureOptions,
    /** Stores complete available control width. */
    val widthPx: Int,
    /** Stores complete multi-line height. */
    val heightPx: Int,
)

/** Groups exact layers and geometry for deferred placement. */
private data class LedPlacementOptions(
    /** Holds packed row membership and widths. */
    val lines: List<LedLine>,
    /** Holds row-position-aware target layers. */
    val positionedCaps: List<List<Placeable>>,
    /** Holds one complete multi-line plate layer. */
    val plate: Placeable,
    /** Stores physical plate margin. */
    val marginPx: Int,
    /** Stores inter-cap and inter-row cap channel. */
    val gapPx: Int,
    /** Stores physical plate height. */
    val plateHeightPx: Int,
    /** Stores target vertical origin inside plate. */
    val targetOffsetYPx: Int,
)

/**
 * Packs measured cap widths into content-width rows.
 *
 * @param options Actual widths and source-derived spacing.
 * @return Immutable rows whose widths include both plate margins.
 *
 * @example
 * ```kotlin
 * packLedLines(LedPackingOptions(listOf(56, 104), 184, 8, 8))
 * ```
 */
internal fun packLedLines(options: LedPackingOptions): List<LedLine> =
    options.capWidthsPx.foldIndexed(emptyList()) { pageIndex, lines, capWidthPx ->
        /** Stores width of this cap as a one-cap plate. */
        val singleWidthPx: Int = options.marginPx * 2 + capWidthPx
        /** Reads current final row when one exists. */
        val currentLine: LedLine? = lines.lastOrNull()
        if (currentLine == null || currentLine.widthPx + options.gapPx + capWidthPx > options.maximumWidthPx) {
            lines + LedLine(pageIndexes = listOf(pageIndex), widthPx = singleWidthPx)
        } else {
            lines.dropLast(1) + currentLine.copy(
                pageIndexes = currentLine.pageIndexes + pageIndex,
                widthPx = currentLine.widthPx + options.gapPx + capWidthPx,
            )
        }
    }

/** Returns content-width cap width from actual legend measurement. */
internal fun ledCapWidth(options: LedCapWidthOptions): Int =
    (options.labelWidthPx + options.insetPx * 2)
        .coerceAtLeast(options.minimumWidthPx)
        .coerceAtMost(options.maximumWidthPx)

/** Returns total height of one stepped multi-line plate. */
internal fun ledMultilineHeight(options: LedMultilineHeightOptions): Int = if (options.lineCount == 0) {
    0
} else {
    options.plateHeightPx + (options.lineCount - 1) * options.rowPitchPx
}

/** Returns selected LED colors derived from runtime Material accent. */
@Composable
private fun ledPalette(): LedPalette {
    /** Reads current runtime accent pigment. */
    val accent: Color = MaterialTheme.colorScheme.primary
    /** Records scene so both schemes select a similarly deep accent tone. */
    val darkScene: Boolean = androidx.compose.foundation.isSystemInDarkTheme()
    /** Uses dark container or light primary to preserve one deep cap-pigment treatment. */
    val accentBody: Color = if (darkScene) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.primary
    }
    /** Selects readable ink paired with chosen deep accent role. */
    val onAccentBody: Color = if (darkScene) {
        MaterialTheme.colorScheme.onPrimaryContainer
    } else {
        MaterialTheme.colorScheme.onPrimary
    }
    return LedPalette(
        selectedFill = accentBody,
        selectedEdge = lerp(accentBody, Color.Black, LED_ACCENT_EDGE_MIX),
        selectedHot = lerp(accent, onAccentBody, LED_ACCENT_HOT_MIX),
        selectedGlow = accent,
        selectedInk = Color.White,
        selectedInkGlow = lerp(accent, Color.White, LED_ACCENT_INK_GLOW_MIX),
    )
}

/** Returns 15-logical-unit semibold legend style independent of user font enlargement. */
@Composable
private fun ledLabelStyle(): TextStyle {
    /** Reads current device density and font scale. */
    val density = LocalDensity.current
    /** Converts 15dp visual geometry into compensating text units. */
    val fixedFontSize: TextUnit = with(density) { ledLegendSize.toSp() }
    return MaterialTheme.typography.bodyMedium.copy(
        fontSize = fixedFontSize,
        fontWeight = FontWeight.SemiBold,
    )
}

/** Returns per-corner opening shape for one position inside its row. */
private fun ledOpeningShape(options: LedTargetOptions): RoundedCornerShape = RoundedCornerShape(
    topStart = if (options.first) ledEndRadius else ledInnerRadius,
    topEnd = if (options.last) ledEndRadius else ledInnerRadius,
    bottomEnd = if (options.last) ledEndRadius else ledInnerRadius,
    bottomStart = if (options.first) ledEndRadius else ledInnerRadius,
)

/** Returns selected or raised cap shape while preserving rigid corner relationships. */
private fun ledCapShape(options: LedTargetOptions): RoundedCornerShape {
    /** Reduces every selected radius by one-unit clearance. */
    val clearance: Dp = if (options.selected) 1.dp else 0.dp
    return RoundedCornerShape(
        topStart = if (options.first) ledEndRadius - clearance else ledInnerRadius - clearance,
        topEnd = if (options.last) ledEndRadius - clearance else ledInnerRadius - clearance,
        bottomEnd = if (options.last) ledEndRadius - clearance else ledInnerRadius - clearance,
        bottomStart = if (options.first) ledEndRadius - clearance else ledInnerRadius - clearance,
    )
}

/** Returns scene-specific one-piece metal plate styling. */
private fun ledPlateModifier(options: LedPlateOptions): Modifier {
    /** Selects brighter-than-ground silver or near-black anodized base. */
    val plateColor: Color = if (options.lightScene) Color(0xFFF7F8FA) else Color(0xFF111111)
    /** Selects subtle key-light-to-away-side metal sheen. */
    val sheen: Brush = Brush.linearGradient(
        colorStops = arrayOf(
            0f to Color.White.copy(alpha = if (options.lightScene) 0.16f else 0.06f),
            0.30f to Color.White.copy(alpha = if (options.lightScene) 0.06f else 0.02f),
            0.55f to Color.Transparent,
            1f to Color.Black.copy(alpha = if (options.lightScene) 0.12f else 0.14f),
        ),
    )
    /** Selects broad bottom-right plate shoulder darkness. */
    val shoulderColor: Color = if (options.lightScene) Color(0x30000000) else Color(0x57000000)
    /** Adds attached contact shadow only where light-scene ground can receive it. */
    val contactShadow: Modifier = if (options.lightScene) {
        Modifier.dropShadow(
            shape = options.shape,
            shadow = HardwareShadow(
                radius = 1.6.dp,
                color = Color(0x73000000),
                offset = DpOffset(x = 1.dp, y = 1.dp),
            ),
        )
    } else {
        Modifier
    }
    return contactShadow
        .clip(options.shape)
        .background(plateColor)
        .drawWithCache {
            onDrawBehind { drawRect(brush = sheen) }
        }
        .innerShadow(
            shape = options.shape,
            shadow = HardwareShadow(
                radius = 6.dp,
                color = shoulderColor,
                offset = DpOffset(x = 3.dp, y = 3.dp),
            ),
        )
}

/** Returns near-flat offset dome with falloff concentrated near cap edge. */
private fun ledDomeBrush(size: Size): Brush = Brush.radialGradient(
    colorStops = arrayOf(
        0f to Color.White.copy(alpha = 0.03f),
        LED_GRADIENT_MIDDLE to Color.White.copy(alpha = 0.015f),
        LED_GRADIENT_THREE_QUARTERS to Color.Transparent,
        LED_DOME_EDGE_START to Color.Black.copy(alpha = 0.07f),
        LED_DOME_EDGE_END to Color.Black.copy(alpha = 0.13f),
        1f to Color.Black.copy(alpha = 0.22f),
    ),
    center = Offset(x = size.width * 0.38f, y = size.height * 0.30f),
    radius = size.maxDimension * 0.95f,
)

/** Returns selected cap's gentle accent-derived top-left hot layer. */
private fun ledHotBrush(options: LedBrushOptions): Brush = Brush.radialGradient(
    colors = listOf(options.palette.selectedHot.copy(alpha = 0.11f), Color.Transparent),
    center = Offset(x = options.size.width * 0.40f, y = options.size.height * 0.34f),
    radius = options.size.maxDimension * 0.60f,
)

/** Returns directional plastic shoulder from reference's 315-degree key light. */
private fun ledShoulderBrush(options: LedBrushOptions): Brush = Brush.linearGradient(
    colorStops = arrayOf(
        0f to Color.White.copy(alpha = 0.22f),
        LED_GRADIENT_QUARTER to Color.White.copy(alpha = 0.12f),
        LED_GRADIENT_NEAR_MIDDLE to Color.White.copy(alpha = 0.03f),
        LED_GRADIENT_MIDDLE to Color.Black.copy(alpha = 0.04f),
        LED_GRADIENT_THREE_QUARTERS to if (options.selected) {
            options.palette.selectedEdge.copy(alpha = 0.18f)
        } else {
            Color.Black.copy(alpha = 0.18f)
        },
        1f to if (options.selected) {
            options.palette.selectedEdge.copy(alpha = 0.32f)
        } else {
            Color.Black.copy(alpha = 0.32f)
        },
    ),
)

/** Returns rigid cap surface with source-derived material ramps. */
private fun Modifier.ledFaceModifier(options: LedCapOptions): Modifier {
    /** Selects accent-derived lit pigment or invariant unlit plastic. */
    val fill: Color = if (options.selected) options.palette.selectedFill else Color(0xFFAAAAAA)
    /** Selects emission or raised cast shadow. */
    val outerShadow: HardwareShadow = if (options.selected) {
        HardwareShadow(
            radius = 7.dp,
            spread = 1.dp,
            color = options.palette.selectedGlow.copy(alpha = if (options.lightScene) 0.16f else 0.28f),
        )
    } else {
        HardwareShadow(
            radius = 2.6.dp,
            color = if (options.lightScene) Color(0x6B000000) else Color(0x99000000),
            offset = DpOffset(x = 2.5.dp, y = 3.5.dp),
        )
    }
    /** Selects source ambient-share occlusion. */
    val occlusion: Color = if (options.selected) {
        Color.Black.copy(alpha = if (options.lightScene) 0.60f else 0.45f)
    } else {
        Color.Black.copy(alpha = 0.22f)
    }
    return this.padding(if (options.selected) 1.dp else 0.dp)
        .dropShadow(shape = options.capShape, shadow = outerShadow)
        .clip(options.capShape)
        .background(fill)
        .drawWithCache {
            /** Groups measured bounds and state for material brushes. */
            val brushOptions = LedBrushOptions(size = size, selected = options.selected, palette = options.palette)
            /** Caches dome layer for current cap size. */
            val dome: Brush = ledDomeBrush(size)
            /** Caches active hot layer even when inactive draw omits it. */
            val hot: Brush = ledHotBrush(brushOptions)
            /** Caches directional shoulder layer. */
            val shoulder: Brush = ledShoulderBrush(brushOptions)
            onDrawBehind {
                drawRect(brush = dome)
                if (options.selected) drawRect(brush = hot)
                drawRect(brush = shoulder)
            }
        }
        .innerShadow(
            shape = options.capShape,
            shadow = HardwareShadow(
                radius = 4.dp,
                color = occlusion,
                offset = DpOffset(x = 3.dp, y = 3.dp),
            ),
        )
}

/** Paints selected opening's lit bottom and right cut arris. */
@Composable
private fun androidx.compose.foundation.layout.BoxScope.ledCutLip(lightScene: Boolean) {
    /** Selects brighter arris on silver plate. */
    val lipColor: Color = Color.White.copy(alpha = if (lightScene) 0.45f else 0.30f)
    Box(
        modifier = Modifier
            .align(Alignment.BottomStart)
            .fillMaxSize()
            .drawWithCache {
                onDrawBehind {
                    drawLine(
                        color = lipColor,
                        start = Offset(x = 0f, y = size.height - 1.dp.toPx()),
                        end = Offset(x = size.width, y = size.height - 1.dp.toPx()),
                        strokeWidth = 1.dp.toPx(),
                    )
                    drawLine(
                        color = lipColor,
                        start = Offset(x = size.width - 1.dp.toPx(), y = 0f),
                        end = Offset(x = size.width - 1.dp.toPx(), y = size.height),
                        strokeWidth = 1.dp.toPx(),
                    )
                }
            },
    )
}

/** Displays one opening, rigid cap, and selected cut arris. */
@Composable
private fun ledHardwareCap(options: LedCapOptions) {
    /** Selects lifted light-scene opening or true-dark void. */
    val openingColor: Color = if (options.lightScene) {
        if (options.selected) Color(0xFF6E7075) else Color(0xFF85878C)
    } else {
        if (options.selected) Color(0xFF050508) else Color(0xFF050506)
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(openingColor, options.openingShape),
    ) {
        Box(modifier = Modifier.fillMaxSize().ledFaceModifier(options))
        if (options.selected) {
            ledCutLip(options.lightScene)
        }
    }
}

/** Displays one measured target, visual cap, and hardware legend. */
@Composable
private fun ledCapTarget(options: LedTargetOptions) {
    /** Derives source per-corner opening silhouette. */
    val openingShape: RoundedCornerShape = ledOpeningShape(options)
    /** Derives selected or raised cap silhouette. */
    val capShape: RoundedCornerShape = ledCapShape(options)
    /** Selects reflective ink or accent-contrasting emitted ink. */
    val labelColor: Color = if (options.selected) options.palette.selectedInk else Color(0xFF3D3F45)
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .widthIn(min = ledTargetHeight)
            .height(ledTargetHeight)
            .selectable(selected = options.selected, role = Role.RadioButton, onClick = options.onSelect),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(vertical = 2.dp),
        ) {
            ledHardwareCap(
                LedCapOptions(
                    selected = options.selected,
                    lightScene = options.lightScene,
                    openingShape = openingShape,
                    capShape = capShape,
                    palette = options.palette,
                ),
            )
        }
        Text(
            text = options.label,
            color = labelColor,
            maxLines = 1,
            softWrap = false,
            overflow = TextOverflow.Ellipsis,
            style = options.labelStyle.copy(
                shadow = if (options.selected) {
                    TextShadow(
                        color = options.palette.selectedInkGlow.copy(alpha = 0.90f),
                        offset = Offset.Zero,
                        blurRadius = 4f,
                    )
                } else {
                    null
                },
            ),
            modifier = Modifier
                .padding(horizontal = ledLegendHorizontalInset)
                .padding(top = if (options.selected) 2.dp else 0.dp),
        )
    }
}

/** Displays one machined plate whose path contains every wrapped row. */
@Composable
private fun ledMultilinePlate(options: LedPlateOptions) {
    Box(modifier = Modifier.fillMaxSize().then(ledPlateModifier(options)))
}

/** Builds one target descriptor from shared layout state and packed position. */
private fun ledTargetOptions(options: LedTargetFactoryOptions): LedTargetOptions = LedTargetOptions(
    label = options.layout.state.pageLabels[options.page],
    selected = options.page == options.layout.state.selectedPage,
    first = options.first,
    last = options.last,
    lightScene = options.layout.lightScene,
    palette = options.layout.palette,
    labelStyle = options.layout.labelStyle,
    onSelect = { options.layout.onSelectPage(options.page) },
)

/** Displays unpadded legend solely for actual intrinsic measurement. */
@Composable
private fun ledProbeLabel(options: LedProbeLabelOptions) {
    Text(
        text = options.label,
        maxLines = 1,
        softWrap = false,
        overflow = TextOverflow.Ellipsis,
        style = options.style,
    )
}

/** Measures natural legend widths and derives content-width cap targets. */
private fun SubcomposeMeasureScope.measureLedProbeWidths(options: LedMeasureOptions): List<Int> {
    /** Caps one target to row width after both plate margins. */
    val maximumCapWidthPx: Int =
        (options.constraints.maxWidth - options.marginPx * 2).coerceAtLeast(1)
    /** Converts per-side legend inset to physical pixels. */
    val insetPx: Int = ledLegendHorizontalInset.roundToPx()
    /** Leaves both label insets inside maximum cap width. */
    val maximumLabelWidthPx: Int = (maximumCapWidthPx - insetPx * 2).coerceAtLeast(1)
    return options.layout.state.pageLabels.mapIndexed { page, label ->
        /** Measures only legend so greedy cap paint cannot claim whole row. */
        val labelPlaceable: Placeable = subcompose("led-label-$page") {
            ledProbeLabel(LedProbeLabelOptions(label = label, style = options.layout.labelStyle))
        }.single().measure(
            Constraints(minWidth = 0, maxWidth = maximumLabelWidthPx),
        )
        ledCapWidth(
            LedCapWidthOptions(
                labelWidthPx = labelPlaceable.width,
                insetPx = insetPx,
                minimumWidthPx = options.targetHeightPx,
                maximumWidthPx = maximumCapWidthPx,
            ),
        )
    }
}

/** Measures target layers again with row-position-aware corner silhouettes. */
private fun SubcomposeMeasureScope.measureLedPositionedCaps(
    options: LedPositionedMeasureOptions,
): List<List<Placeable>> = options.lines.mapIndexed { rowIndex, line ->
    line.pageIndexes.mapIndexed { position, page ->
        subcompose("led-positioned-$rowIndex-$page") {
            ledCapTarget(
                ledTargetOptions(
                    LedTargetFactoryOptions(
                        layout = options.measure.layout,
                        page = page,
                        first = position == 0,
                        last = position == line.pageIndexes.lastIndex,
                    ),
                ),
            )
        }.single().measure(
            Constraints.fixed(
                width = options.capWidthsPx[page],
                height = options.measure.targetHeightPx,
            ),
        )
    }
}

/** Measures one rounded plate across complete available control width. */
private fun SubcomposeMeasureScope.measureLedPlate(options: LedPlateMeasureOptions): Placeable {
    /** Uses 17-unit source radius on every exposed plate corner. */
    val shape: Shape = RoundedCornerShape(ledPlateRadius)
    return subcompose("led-multiline-plate") {
        ledMultilinePlate(
            LedPlateOptions(
                lightScene = options.measure.layout.lightScene,
                shape = shape,
            ),
        )
    }.single().measure(Constraints.fixed(width = options.widthPx, height = options.heightPx))
}

/** Places one plate first, then non-overlapping targets over each row. */
private fun Placeable.PlacementScope.placeLedRows(options: LedPlacementOptions) {
    options.plate.placeRelative(x = 0, y = 0)
    options.lines.forEachIndexed { rowIndex, line ->
        /** Computes this cap row's vertical origin inside one plate. */
        val rowYPx: Int = rowIndex * (options.plateHeightPx - options.gapPx)
        line.pageIndexes.foldIndexed(options.marginPx) { position, capXPx, _ ->
            /** Places measured target over shared plate. */
            val cap: Placeable = options.positionedCaps[rowIndex][position]
            cap.placeRelative(x = capXPx, y = rowYPx + options.targetOffsetYPx)
            capXPx + cap.width + options.gapPx
        }
    }
}

/** Measures content-width caps over one full-width hardware plate. */
private fun SubcomposeMeasureScope.measureLedControl(options: LedMeasureOptions): MeasureResult {
    /** Measures real legends before deciding target and row widths. */
    val capWidthsPx: List<Int> = measureLedProbeWidths(options)
    /** Packs actual content widths into immutable rows. */
    val lines: List<LedLine> = packLedLines(
        LedPackingOptions(
            capWidthsPx = capWidthsPx,
            maximumWidthPx = options.constraints.maxWidth,
            marginPx = options.marginPx,
            gapPx = options.gapPx,
        ),
    )
    /** Composes targets once with row-position corner geometry. */
    val positionedCaps: List<List<Placeable>> = measureLedPositionedCaps(
        LedPositionedMeasureOptions(measure = options, lines = lines, capWidthsPx = capWidthsPx),
    )
    /** Expands plate and outer layout to complete incoming width. */
    val layoutWidthPx: Int = options.constraints.maxWidth
    /** Computes one continuous plate height from source cap-row pitch. */
    val contentHeightPx: Int = ledMultilineHeight(
        LedMultilineHeightOptions(
            lineCount = lines.size,
            plateHeightPx = options.plateHeightPx,
            rowPitchPx = options.plateHeightPx - options.gapPx,
        ),
    )
    /** Measures one exact plate after complete geometry is known. */
    val plate: Placeable = measureLedPlate(
        LedPlateMeasureOptions(
            measure = options,
            widthPx = layoutWidthPx,
            heightPx = contentHeightPx,
        ),
    )
    return layout(
        width = layoutWidthPx,
        height = options.constraints.constrainHeight(contentHeightPx),
    ) {
        placeLedRows(
            LedPlacementOptions(
                lines = lines,
                positionedCaps = positionedCaps,
                plate = plate,
                marginPx = options.marginPx,
                gapPx = options.gapPx,
                plateHeightPx = options.plateHeightPx,
                targetOffsetYPx = options.targetOffsetYPx,
            ),
        )
    }
}

/** Displays wrapped content-width caps over one continuous full-width plate. */
@Composable
internal fun ledPageControls(options: LedPageControlsOptions) {
    /** Reads stable scene and state shared by every measured layer. */
    val layoutOptions = LedLayoutOptions(
        state = options.state,
        onSelectPage = options.onSelectPage,
        lightScene = !androidx.compose.foundation.isSystemInDarkTheme(),
        palette = ledPalette(),
        labelStyle = ledLabelStyle(),
    )
    SubcomposeLayout(modifier = Modifier.selectableGroup()) { constraints ->
        measureLedControl(
            LedMeasureOptions(
                layout = layoutOptions,
                constraints = constraints,
                marginPx = ledChannel.roundToPx(),
                gapPx = ledChannel.roundToPx(),
                plateHeightPx = ledPlateHeight.roundToPx(),
                targetHeightPx = ledTargetHeight.roundToPx(),
                targetOffsetYPx = (ledPlateHeight - ledTargetHeight).roundToPx() / 2,
            ),
        )
    }
}
