// Debug-only D50 comparison: the unfolded playback deck always stays visible.
// Question: should Search share left browse space, use right track space, or span both above the deck?
// The physical 7.5mm crease is approximately 110 panel px here; text avoids it, surfaces may cross.
package dev.monochromatic.musicplayer

// The throwaway probe reads the app's own platform insets without privileged window inspection.
import android.os.Build
import android.util.Log
import android.view.WindowInsets as AndroidWindowInsets
// The public system callback reports preparation and bounds for actual inset animations.
import android.view.WindowInsetsAnimation as AndroidWindowInsetsAnimation
// A parent View can observe without replacing ComposeView's own inset listener.
import android.view.View

// What:     BackHandler routes Android Back from temporary Search to the player.
// Why:      A separate D47 destination needs a visible and system Back path.
//
// In TS you'd write (pseudocode):
// ```ts
// onBack(() => setSearchOpen(false));
// ```
import androidx.activity.compose.BackHandler
// What:     BasicTextField edits a query without introducing a second outlined field.
// Why:      Back, text and Clear must share one D48 header.
//
// In TS you'd write (pseudocode):
// ```ts
// <input value={query} onInput={updateQuery} />
// ```
import androidx.compose.foundation.text.BasicTextField
// `KeyboardOptions` gives query input the Android Search IME action.
import androidx.compose.foundation.text.KeyboardOptions
// `background` paints app structure independently of informational marks.
import androidx.compose.foundation.background
// `verticalScroll` makes results and empty explanations reachable at 200% text.
import androidx.compose.foundation.verticalScroll
// `rememberScrollState` stores only this debug visit's scroll offset.
import androidx.compose.foundation.rememberScrollState
// `Box` reserves the system inset without adding an app title bar.
import androidx.compose.foundation.layout.Box
// `BoxWithConstraints` measures available width before placing query glyphs.
import androidx.compose.foundation.layout.BoxWithConstraints
// `Column` stacks Search header, results and the persistent deck.
import androidx.compose.foundation.layout.Column
// `Row` places related panes without banning paint from the crease.
import androidx.compose.foundation.layout.Row
// `Spacer` flexes decorative space between text regions.
import androidx.compose.foundation.layout.Spacer
// `WindowInsets` uses actual Android bar geometry.
import androidx.compose.foundation.layout.WindowInsets
// `fillMaxSize` paints the active Fold panel.
import androidx.compose.foundation.layout.fillMaxSize
// `fillMaxWidth` permits structural surfaces across the fold.
import androidx.compose.foundation.layout.fillMaxWidth
// `ime` reports the system input window, not a guessed keyboard height.
import androidx.compose.foundation.layout.ime
// `imePadding` lifts the bottom-anchored comparison above the actual keyboard.
import androidx.compose.foundation.layout.imePadding
// `height` gives divided Search its 72dp baseline header.
import androidx.compose.foundation.layout.height
// `heightIn` permits enlarged row text to wrap rather than crop.
import androidx.compose.foundation.layout.heightIn
// `navigationBars` protects the bottom of independently scrolling results.
import androidx.compose.foundation.layout.navigationBars
// `padding` moves only information-bearing glyphs clear of the dent.
import androidx.compose.foundation.layout.padding
// `size` fixes a minimum 48dp native icon-button layout target.
import androidx.compose.foundation.layout.size
// `safeDrawing` supplies the app's top inset if platform insets have not arrived.
import androidx.compose.foundation.layout.safeDrawing
// `statusBars` keeps the full-width header below native status UI.
import androidx.compose.foundation.layout.statusBars
// `windowInsetsPadding` consumes bottom navigation safe space.
import androidx.compose.foundation.layout.windowInsetsPadding
// `windowInsetsTopHeight` reserves the measured Android status region.
import androidx.compose.foundation.layout.windowInsetsTopHeight
// `width` limits query text to one safe side of the physical crease.
import androidx.compose.foundation.layout.width
// `Icons` supplies real Material vectors rather than glyph stand-ins.
import androidx.compose.material.icons.Icons
// Back and Clear are separate action icons with distinct names.
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
// Folder, track and Search icons accompany labels without replacing them.
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Search
// `HorizontalDivider` supplies the baseline divided Search boundary.
import androidx.compose.material3.HorizontalDivider
// `Icon` draws a Material vector in current scheme roles.
import androidx.compose.material3.Icon
// `IconButton` supplies actual 48dp native action targets.
import androidx.compose.material3.IconButton
// `MaterialTheme` supplies baseline color and typography.
import androidx.compose.material3.MaterialTheme
// `Surface` groups sample result cards and preserves color roles.
import androidx.compose.material3.Surface
// `Text` renders the information the user must perceive off the dent.
import androidx.compose.material3.Text
// `Composable` marks these functions as Compose UI descriptions.
import androidx.compose.runtime.Composable
// `DisposableEffect` attaches this debug probe only while its Search activity is shown.
import androidx.compose.runtime.DisposableEffect
// Log only after Compose applies an inset-triggered recomposition.
import androidx.compose.runtime.SideEffect
// `mutableIntStateOf` remembers the closed deck's measured height across IME frames.
import androidx.compose.runtime.mutableIntStateOf
// `mutableStateOf` holds throwaway query/navigation state.
import androidx.compose.runtime.mutableStateOf
// `remember` preserves that state during one activity visit.
import androidx.compose.runtime.remember
// The parent listener reads the latest state setter without reattaching on each recomposition.
import androidx.compose.runtime.rememberUpdatedState
// Kotlin delegates read and write observable state.
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
// `Alignment` keeps icon and text baselines on one header line.
import androidx.compose.ui.Alignment
// `Modifier` describes layout without production code changes.
import androidx.compose.ui.Modifier
// Focus changes precede or accompany the keyboard request in this debug comparison.
import androidx.compose.ui.focus.onFocusChanged
// `LocalConfiguration` distinguishes the cover from the inner panel.
import androidx.compose.ui.platform.LocalConfiguration
// `LocalDensity` converts physical pixels at runtime instead of storing a fixed dp crease.
import androidx.compose.ui.platform.LocalDensity
// `LocalView` exposes this app window's delivered platform insets.
import androidx.compose.ui.platform.LocalView
// `semantics` names the query field for native accessibility inspection.
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
// `FontWeight` gives a heading a second visible prominence cue.
import androidx.compose.ui.text.font.FontWeight
// `ImeAction` labels the keyboard action as Search.
import androidx.compose.ui.text.input.ImeAction
// `SolidColor` paints a scheme-aware query cursor.
import androidx.compose.ui.graphics.SolidColor
// `Color` supplies stable true-black structure under D41.
import androidx.compose.ui.graphics.Color
// `Dp` labels values converted from the current density only at rendering.
import androidx.compose.ui.unit.Dp
// `dp` sizes Material controls and nonphysical spacing.
import androidx.compose.ui.unit.dp

/** What: Physical inner-panel width in pixels from the target Fold display.
 *  Why: Convert only this debug study's proposed millimeter floors to device pixels.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const E2_REVIEW_PANEL_WIDTH_PX = 2076;
 * ```
 */
private const val E2_REVIEW_PANEL_WIDTH_PX = 2076f

/** What: Estimated active inner-panel width in millimeters from the published panel diagonal.
 *  Why: Keep the floor proposals in physical units instead of fixed Android dp.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const E2_REVIEW_PANEL_WIDTH_MM = 141.08;
 * ```
 */
private const val E2_REVIEW_PANEL_WIDTH_MM = 141.08f

/** What: Physical minimum stated by the user before requesting Search-closed views.
 *  Why: Show its present-device layout without yet recording a final E2 decision.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const E2_REVIEW_FLOOR_SEVEN_HALF_MM = 7.5;
 * ```
 */
private const val E2_REVIEW_FLOOR_SEVEN_HALF_MM = 7.5f

/** What: First visibly separated total-gap floor in the debug comparison.
 *  Why: Test one clearance target beyond the existing selected-A information boxes.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const E2_REVIEW_FLOOR_MIDDLE_MM = 14;
 * ```
 */
private const val E2_REVIEW_FLOOR_MIDDLE_MM = 14f

/** What: Second visibly separated total-gap floor in the debug comparison.
 *  Why: Expose a wider spacing tradeoff without editing the accepted Search design.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const E2_REVIEW_FLOOR_WIDE_MM = 20;
 * ```
 */
private const val E2_REVIEW_FLOOR_WIDE_MM = 20f

/** What: Predicted information-node separation with two uninterrupted half-screen player panes.
 *  Why: Anchor the throwaway player-floor study to meaning-bearing boxes, not panel backgrounds.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * const E2_REVIEW_CLOSED_BOX_PROXY_PX = 112;
 * ```
 */
private const val E2_REVIEW_CLOSED_BOX_PROXY_PX = 112f

/**
 * What:     Switch between deck-persistent Search arrangements in one debug activity.
 * Why:      Every native capture must preserve D50 while comparing visible composition.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function SearchPersistentDeckStudy({ candidate }: { candidate: string }): UIElement;
 * ```
 */
@Composable
internal fun SearchPersistentDeckStudy(candidate: String) {
    val light = candidate.endsWith("-light")
    val cover = LocalConfiguration.current.screenWidthDp < 600
    // The stress marker changes only sample result data, never accepted Search geometry.
    val overflowStudy = candidate.contains("-overflow-")
    if (cover) {
        val state = if (candidate.contains("-player")) "player" else if (candidate.contains("-results")) "results"
            else if (candidate.contains("-none")) "none" else if (candidate.contains("-unavailable")) "unavailable" else "empty"
        val overflowSuffix = if (overflowStudy) "-overflow" else ""
        // What:     The optional suffix selects the cover keyboard-viewport comparison.
        // Why:      The delegated cover candidate must preserve the incoming study marker.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const viewportSuffix = candidate.includes("-imeviewport-") ? "-imeviewport" : "";
        // ```
        val viewportSuffix = if (candidate.contains("-imeviewport-")) "-imeviewport" else ""
        SearchLayoutStudy(candidate = "search-layout-docked-$state$overflowSuffix$viewportSuffix${if (light) "-light" else ""}",
            hidePositiveHeading = true)
        return
    }
    val startsOpen = !candidate.contains("-player")
    val startsQuery = if (candidate.contains("-results")) "cam" else if (candidate.contains("-none")) "zzq" else ""
    val unavailable = candidate.contains("-unavailable")
    var opened by remember(candidate) { mutableStateOf(startsOpen) }
    var query by remember(candidate) { mutableStateOf(startsQuery) }
    val onBack = {
        opened = false
        query = ""
    }
    BackHandler(enabled = opened) { onBack() }
    val halfDent = with(LocalDensity.current) { (55f / density).dp }
    // What: These markers select a total physical floor only in the debug Compose candidate.
    // Why: Compare the user's stated 7.5mm minimum with wider floors on both sides of Search.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const floorMm = candidate.includes('-e2floor20-') ? 20 : candidate.includes('-e2floor14-') ? 14 : 7.5;
    // ```
    val e2FloorMillimeters = if (candidate.contains("-e2floor20-")) E2_REVIEW_FLOOR_WIDE_MM
        else if (candidate.contains("-e2floor14-")) E2_REVIEW_FLOOR_MIDDLE_MM
        else if (candidate.contains("-e2floor7p5-")) E2_REVIEW_FLOOR_SEVEN_HALF_MM else 0f
    // What: Compare the physical floor with the unshifted player text-node gap.
    // Why: Backgrounds and borders should span the fold even when text moves away from it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const targetGapPx = Math.max(110, floorMm / panelWidthMm * panelWidthPx);
    // ```
    val targetGapPx = maxOf(110f,
        e2FloorMillimeters / E2_REVIEW_PANEL_WIDTH_MM * E2_REVIEW_PANEL_WIDTH_PX)
    // What: Reserve a 12dp right-text inset in this fixture and add only any remaining floor demand.
    // Why: The unshifted heading approaches the estimated crease, but its surface may still cross.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const infoInsetDp = Math.max(12, Math.max(0, targetGapPx - baselineTextGapPx) / density + 1);
    // ```
    val e2ClosedInformationInset = if (candidate.contains("-e2floor")) {
        maxOf(12f,
            (targetGapPx - E2_REVIEW_CLOSED_BOX_PROXY_PX).coerceAtLeast(0f) /
                LocalDensity.current.density + 1f).dp
    } else 0.dp
    if (!opened) {
        SearchPlayerPreview(isCover = false, light = light, onSearch = {
            query = ""
            opened = true
        }, e2InformationStartInset = e2ClosedInformationInset)
        return
    }
    val pageColor = if (light) MaterialTheme.colorScheme.surfaceContainerLowest else Color.Black
    if (candidate.contains("-mirrored-")) {
        SearchDeckMirrored(query = query, onQueryChange = { query = it }, onBack = onBack,
            unavailable = unavailable, halfDent = halfDent, light = light, pageColor = pageColor)
    } else if (candidate.contains("-left-")) {
        SearchDeckLeft(query = query, onQueryChange = { query = it }, onBack = onBack,
            unavailable = unavailable, halfDent = halfDent, light = light, pageColor = pageColor)
    } else if (candidate.contains("-right-")) {
        SearchDeckRight(query = query, onQueryChange = { query = it }, onBack = onBack,
            unavailable = unavailable, halfDent = halfDent, light = light, pageColor = pageColor,
            liftWithIme = candidate.contains("-lift-"),
            bannerHeightStress = candidate.contains("-bannerfit-"),
            autoFitStudy = candidate.contains("-autofit-"),
            preclearStudy = candidate.contains("-preclear-") || candidate.contains("-scalereserve-"),
            // A separate comparison limits early reservation to the tested stress scale.
            scaleReserveStudy = candidate.contains("-scalereserve-"),
            // A separate comparison makes the compact deck ready before any IME rise.
            earlyInlineStudy = candidate.contains("-earlyinline-"),
            retainBrowser = candidate.contains("-retain-"),
            layerProbe = candidate.contains("-layerprobe-"),
            keepClearProbe = candidate.contains("-keepclear-"),
            overflowStudy = overflowStudy,
            e2FloorMillimeters = e2FloorMillimeters)
    } else {
        SearchDeckWide(query = query, onQueryChange = { query = it }, onBack = onBack,
            unavailable = unavailable, halfDent = halfDent, light = light, pageColor = pageColor)
    }
}

/** Shows Search in the left upper slot with its own results and the deck below. */
@Composable
private fun SearchDeckLeft(query: String, onQueryChange: (String) -> Unit,
    onBack: () -> Unit, unavailable: Boolean, halfDent: Dp, light: Boolean, pageColor: Color) {
    Row(modifier = Modifier.fillMaxSize().background(pageColor)) {
        SearchFoldDeckHost(light = light, modifier = Modifier.weight(1f)) { slot ->
            PersistentSearchPane(query = query, onQueryChange = onQueryChange, onBack = onBack,
                unavailable = unavailable, modifier = slot, startSafe = 16.dp,
                endSafe = halfDent + 16.dp, includeTopInset = false, pageColor = pageColor)
        }
        SearchFoldTracks(light = light, modifier = Modifier.weight(1f).padding(start = halfDent + 8.dp))
    }
}

/** Minimum reported physical inset used only to select the measured banner-height fixture. */
private const val BANNER_STRESS_INSET_PX = 1000

/** One-pixel-safe debug envelope above the observed y-1140 Gboard font banner. */
private val PRECLEAR_REVIEW_HEIGHT = 416.dp

/** What:     200% text is the measured scale whose vertical deck clips at 400dp.
 *  Why:      Keep the 100% comparison on the selected deck when it already fits.
 *
 *  In TS you'd write (pseudocode):
 *  ```ts
 *  const STRESS_TEXT_FONT_SCALE = 2;
 *  ```
 */
private const val STRESS_TEXT_FONT_SCALE = 2f

/** Android 17 SDK level used only to guard debug bounding-rectangle inspection. */
private const val BOUNDING_RECT_API_LEVEL = 37

/**
 * What: Log system IME animation events before proposing any pre-emptive layout change.
 * Why: A recorded in-place height jump clipped the deck despite an eventual compact decision.
 * In TS you'd write (pseudocode): observeImeAnimation(parentView, onEvent);
 */
@Composable
private fun ObserveImeAnimation(parentView: View, onAppliedIme: (Int) -> Unit) {
    if (Build.VERSION.SDK_INT < 30) return
    val latestOnAppliedIme by rememberUpdatedState(onAppliedIme)
    DisposableEffect(parentView) {
        val callback = object : AndroidWindowInsetsAnimation.Callback(
            AndroidWindowInsetsAnimation.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE,
        ) {
            override fun onPrepare(animation: AndroidWindowInsetsAnimation) {
                if ((animation.typeMask and AndroidWindowInsets.Type.ime()) != 0) {
                    Log.i("SearchAnimationProbe", "prepare ime")
                }
            }

            override fun onStart(animation: AndroidWindowInsetsAnimation,
                bounds: AndroidWindowInsetsAnimation.Bounds): AndroidWindowInsetsAnimation.Bounds {
                if ((animation.typeMask and AndroidWindowInsets.Type.ime()) != 0) {
                    Log.i("SearchAnimationProbe", "start lower=${bounds.lowerBound.bottom} " +
                        "upper=${bounds.upperBound.bottom}")
                }
                return bounds
            }

            override fun onProgress(insets: AndroidWindowInsets,
                runningAnimations: List<AndroidWindowInsetsAnimation>): AndroidWindowInsets {
                if (runningAnimations.any { animation ->
                    (animation.typeMask and AndroidWindowInsets.Type.ime()) != 0
                }) {
                    val imeBottom = insets.getInsets(AndroidWindowInsets.Type.ime()).bottom
                    Log.i("SearchAnimationProbe", "progress bottom=$imeBottom")
                }
                return insets
            }

            override fun onEnd(animation: AndroidWindowInsetsAnimation) {
                if ((animation.typeMask and AndroidWindowInsets.Type.ime()) != 0) {
                    Log.i("SearchAnimationProbe", "end ime")
                }
            }
        }
        parentView.setWindowInsetsAnimationCallback(callback)
        // Observe ordinary inset delivery as well: this IME's in-place resize
        // did not run an animation callback despite updating its frame.
        parentView.setOnApplyWindowInsetsListener { view, insets ->
            val bottom = insets.getInsets(AndroidWindowInsets.Type.ime()).bottom
            Log.i("SearchApplyProbe", "delivered bottom=$bottom")
            latestOnAppliedIme(bottom)
            view.onApplyWindowInsets(insets)
        }
        Log.i("SearchAnimationProbe", "installed on ${parentView.javaClass.name}")
        onDispose {
            parentView.setOnApplyWindowInsetsListener(null)
            parentView.setWindowInsetsAnimationCallback(null)
        }
    }
}

/** Shows Search in the right track slot while folders and the deck stay on the left. */
@Composable
private fun SearchDeckRight(query: String, onQueryChange: (String) -> Unit,
    onBack: () -> Unit, unavailable: Boolean, halfDent: Dp, light: Boolean, pageColor: Color,
    liftWithIme: Boolean, bannerHeightStress: Boolean, autoFitStudy: Boolean,
    preclearStudy: Boolean, scaleReserveStudy: Boolean, earlyInlineStudy: Boolean,
    retainBrowser: Boolean, layerProbe: Boolean,
    keepClearProbe: Boolean, overflowStudy: Boolean, e2FloorMillimeters: Float) {
    val density = LocalDensity.current
    // What: Convert the physical floor to pixels using the published active panel width.
    // Why: A chosen millimeter floor must not become a fixed dp gap across display scales.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const requiredGapPx = floorMm / panelWidthMm * panelWidthPx;
    // ```
    val requiredGapPx = e2FloorMillimeters / E2_REVIEW_PANEL_WIDTH_MM * E2_REVIEW_PANEL_WIDTH_PX
    // What: Sum the current opposing pane-safe insets, including the separate 8dp and 16dp minima.
    // Why: The debug floor adds space only beyond the existing selected-A inset budget.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const baselineGapPx = (halfDentDp * 2 + 8 + 16) * density;
    // ```
    val baselineGapPx = (halfDent.value * 2 + 8 + 16) * density.density
    // What: Add any needed separation to right-side information, including one dp for rounding.
    // Why: The accepted left browser and deck stay full-width; surface and hit bounds remain free to cross.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const rightInfoInsetDp = requiredGapPx > baselineGapPx ? (requiredGapPx - baselineGapPx) / density + 1 : 0;
    // ```
    val extraInsetDp = if (requiredGapPx > baselineGapPx) {
        ((requiredGapPx - baselineGapPx) / density.density).dp + 1.dp
    } else 0.dp
    val reportedImeInset = WindowInsets.ime.getBottom(density)
    var queryFocused by remember { mutableStateOf(false) }
    var initialFocusPending by remember { mutableStateOf(false) }
    var hasShownKeyboard by remember { mutableStateOf(false) }
    val observedView = LocalView.current
    var deliveredBottom by remember(density.density, density.fontScale, observedView.width) {
        mutableIntStateOf(0)
    }
    // The debug callback remains on the view above Compose and continues subtree dispatch.
    val animationHost = observedView.parent as? View
    if ((autoFitStudy || bannerHeightStress || preclearStudy) && animationHost != null) {
        ObserveImeAnimation(animationHost, onAppliedIme = { bottom ->
            if (deliveredBottom != bottom) deliveredBottom = bottom
        })
    }
    val platformInsets = observedView.rootWindowInsets
    val imeType = if (Build.VERSION.SDK_INT >= 30) AndroidWindowInsets.Type.ime() else 0
    val platformBottom = if (Build.VERSION.SDK_INT >= 30) {
        platformInsets?.getInsets(imeType)?.bottom ?: 0
    } else 0
    // What:     Public IME visibility and bottom inset select only a debug layering experiment.
    // Why:      The marker must appear for floating keys, not obscure normal docked-key tests.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const testLayer = layerProbe && imeVisible && platformBottom === 0;
    // ```
    val testLayer = layerProbe && platformInsets?.isVisible(imeType) == true && platformBottom == 0
    FoldAboveImeMarker(active = testLayer)
    // What:     The separate keep-clear candidate uses the same public visibility signal.
    // Why:      A docked keyboard already fits; only floating overlap tests this hint.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const testKeepClear = keepClearProbe && imeVisible && platformBottom === 0;
    // ```
    val testKeepClear = keepClearProbe && platformInsets?.isVisible(imeType) == true && platformBottom == 0
    FoldKeepClearProbe(active = testKeepClear)
    val targetBottom = if (autoFitStudy || preclearStudy) {
        maxOf(reportedImeInset, platformBottom, deliveredBottom)
    } else reportedImeInset
    val keyboardShown = targetBottom > 0
    // Compare an early inline deck only at the tested scale with a clipping control.
    // The alternate full reservation remains its own unaccepted candidate.
    // What:     This comparison names the tested enlarged text setting.
    // Why:      A 100% vertical deck already fitted the sampled 415dp keyboard.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const stressText = fontScale >= STRESS_TEXT_FONT_SCALE;
    // ```
    val stressText = density.fontScale >= STRESS_TEXT_FONT_SCALE
    // Keep the old reservation control and only gate its new scale-limited sibling.
    val anticipatoryLayout = (preclearStudy && (!scaleReserveStudy || stressText)) ||
        (earlyInlineStudy && stressText)
    // Keep the compact deck during the initial focus request and while the IME exists.
    // Once a seen IME is hidden, keep the focused query but restore closed A.
    val anticipatoryActive = anticipatoryLayout &&
        (keyboardShown || (queryFocused && initialFocusPending && !hasShownKeyboard))
    var restingDeckHeight by remember(density.density, density.fontScale, observedView.width) {
        mutableIntStateOf(0)
    }
    var openDeckHeight by remember(density.density, density.fontScale, observedView.width) {
        mutableIntStateOf(0)
    }
    val topSafe = if (Build.VERSION.SDK_INT >= 30) {
        platformInsets?.getInsets(AndroidWindowInsets.Type.statusBars())?.top
    } else null
    val topSafePx = topSafe ?: WindowInsets.safeDrawing.getTop(density)
    val availableAboveIme = (observedView.height - topSafePx - targetBottom).coerceAtLeast(0)
    val dividerPx = with(density) { 16.dp.roundToPx() }
    // Prefer the measured open, noncompact deck when available. A cold entry
    // without one falls back to the larger closed measurement, choosing safety.
    val requiredDeckHeight = if (openDeckHeight > 0) openDeckHeight else restingDeckHeight
    val measuredOverflow = requiredDeckHeight == 0 ||
        requiredDeckHeight + dividerPx > availableAboveIme
    val bannerFit = if (anticipatoryLayout) anticipatoryActive
        else if (autoFitStudy) keyboardShown && measuredOverflow
        else bannerHeightStress && reportedImeInset >= BANNER_STRESS_INSET_PX
    SideEffect {
        if (anticipatoryLayout && queryFocused) {
            if (keyboardShown && !hasShownKeyboard) hasShownKeyboard = true
            else if (!keyboardShown && hasShownKeyboard) {
                initialFocusPending = false
                hasShownKeyboard = false
            }
        }
        val visible = if (Build.VERSION.SDK_INT >= 30) platformInsets?.isVisible(imeType) else null
        val rectangles = if (Build.VERSION.SDK_INT >= BOUNDING_RECT_API_LEVEL) {
            platformInsets?.getBoundingRects(imeType)
        } else null
        Log.i("SearchInsetProbe", "composeBottom=$reportedImeInset platformBottom=$platformBottom " +
            "deliveredBottom=$deliveredBottom targetBottom=$targetBottom " +
            "rootHeight=${observedView.height} topSafe=$topSafePx " +
            "restingDeck=$restingDeckHeight openDeck=$openDeckHeight " +
            "available=$availableAboveIme " +
            "visible=$visible boundingRects=$rectangles stress=$bannerFit " +
            "queryFocused=$queryFocused focusPending=$initialFocusPending " +
            "seenKeyboard=$hasShownKeyboard anticipatory=$anticipatoryActive")
    }
    // The platform target selects the layout only. Layout-time imePadding owns
    // bottom reservation in ordinary studies; only preclear has a fixed owner.
    // Early inline instead keeps the current inset while selecting compact in advance.
    Row(modifier = Modifier.fillMaxSize().background(pageColor)
        .then(if (preclearStudy && anticipatoryActive) Modifier.padding(bottom = PRECLEAR_REVIEW_HEIGHT)
            else if (liftWithIme) Modifier.imePadding() else Modifier)) {
        SearchFoldDeckHost(light = light, modifier = Modifier.weight(1f),
            deckFirst = !liftWithIme, deckFullHeight = liftWithIme, bannerFit = bannerFit,
            compactForBrowser = retainBrowser && (keyboardShown || anticipatoryActive),
            reserveOwnsNavigation = preclearStudy && anticipatoryActive,
            onDeckMeasured = { heightPx ->
                if (autoFitStudy && !keyboardShown && heightPx > restingDeckHeight) {
                    restingDeckHeight = heightPx
                }
                // A shrinking callback sample can belong to a newer constrained layout
                // than the available height captured by this earlier composition.
                // Keep the largest fitting demand for this unchanged title and width.
                if (autoFitStudy && keyboardShown && !bannerFit &&
                    availableAboveIme > heightPx + dividerPx && heightPx > openDeckHeight) {
                    openDeckHeight = heightPx
                }
            }) { slot ->
            if (!keyboardShown || retainBrowser) {
                SearchFoldFolders(light = light,
                    modifier = slot.padding(end = halfDent + 8.dp))
            } else Box(modifier = slot)
        }
        PersistentSearchPane(query = query, onQueryChange = onQueryChange, onBack = onBack,
            unavailable = unavailable, modifier = Modifier.weight(1f),
            startSafe = halfDent + 16.dp + extraInsetDp, endSafe = 16.dp,
            includeTopInset = true, pageColor = pageColor,
            overflowStudy = overflowStudy,
            onQueryFocusChange = { focused ->
                if (anticipatoryLayout && focused && !queryFocused) initialFocusPending = true
                if (anticipatoryLayout && !focused) {
                    initialFocusPending = false
                    hasShownKeyboard = false
                }
                queryFocused = focused
            })
    }
}

/** Moves the unified Search pane left and anchors the crease-safe deck on the right. */
@Composable
private fun SearchDeckMirrored(query: String, onQueryChange: (String) -> Unit,
    onBack: () -> Unit, unavailable: Boolean, halfDent: Dp, light: Boolean, pageColor: Color) {
    Row(modifier = Modifier.fillMaxSize().background(pageColor)) {
        PersistentSearchPane(query = query, onQueryChange = onQueryChange, onBack = onBack,
            unavailable = unavailable, modifier = Modifier.weight(1f),
            startSafe = 16.dp, endSafe = halfDent + 16.dp,
            includeTopInset = true, pageColor = pageColor)
        val keyboardShown = WindowInsets.ime.getBottom(LocalDensity.current) > 0
        SearchFoldDeckHost(light = light,
            modifier = Modifier.weight(1f).padding(start = halfDent + 8.dp),
            deckFirst = true) { slot ->
            if (!keyboardShown) SearchFoldTracks(light = light, modifier = slot)
            else Box(modifier = slot)
        }
    }
}

/** Places a unified full-width Search header over two safe result cards and the left deck. */
@Composable
private fun SearchDeckWide(query: String, onQueryChange: (String) -> Unit,
    onBack: () -> Unit, unavailable: Boolean, halfDent: Dp, light: Boolean, pageColor: Color) {
    Column(modifier = Modifier.fillMaxSize().background(pageColor)) {
        Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            PersistentSearchHeader(query = query, onQueryChange = onQueryChange, onBack = onBack,
                startSafe = 16.dp, endSafe = 16.dp,
                queryWidth = maxWidth / 2 - halfDent - 72.dp)
        }
        HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
        val hasResults = query == "cam" && !unavailable
        Text(if (hasResults) "Results for “cam”" else if (unavailable) "Library unavailable" else if (query.isEmpty())
            "Search your music" else "No results for “$query”",
            modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 12.dp),
            style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Row(modifier = Modifier.weight(1f).fillMaxWidth()) {
            SearchFoldDeckHost(light = light, modifier = Modifier.weight(1f), includeTopInset = false) { slot ->
                Column(modifier = slot.verticalScroll(rememberScrollState())
                    .padding(start = 16.dp, end = halfDent + 16.dp, top = 8.dp)) {
                    if (hasResults) {
                        PersistentResultCard(title = "Camellia", detail = "Folder · opens this folder",
                            kind = "Folder", pageColor = pageColor)
                    } else {
                        PersistentMessage(detail = if (unavailable) "Search returns when the library is available."
                            else if (query.isEmpty()) "Type a name to explore your library." else "Try another name.")
                    }
                }
            }
            Column(modifier = Modifier.weight(1f).fillMaxSize()
                .verticalScroll(rememberScrollState()).windowInsetsPadding(WindowInsets.navigationBars)
                .padding(start = halfDent + 16.dp, end = 16.dp, top = 8.dp)) {
                if (hasResults) {
                    PersistentResultCard(title = "Another Xronixle", detail = "Track · Camellia · reveals track",
                        kind = "Track", pageColor = pageColor)
                }
            }
        }
    }
}

/** Keeps the query and its results within one persistent half-screen Search region. */
@Composable
private fun PersistentSearchPane(query: String, onQueryChange: (String) -> Unit,
    onBack: () -> Unit, unavailable: Boolean, modifier: Modifier,
    startSafe: Dp, endSafe: Dp, includeTopInset: Boolean, pageColor: Color,
    overflowStudy: Boolean = false, onQueryFocusChange: ((Boolean) -> Unit)? = null) {
    Column(modifier = modifier.fillMaxSize().background(pageColor)) {
        if (includeTopInset) Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
        PersistentSearchHeader(query = query, onQueryChange = onQueryChange, onBack = onBack,
            startSafe = startSafe, endSafe = endSafe, queryWidth = null,
            onQueryFocusChange = onQueryFocusChange)
        HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
        Column(modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(start = startSafe, end = endSafe)) {
            if (query == "cam" && !unavailable) {
                if (overflowStudy) {
                    PersistentResultLine(title = overflowFolderTitle,
                        detail = "Folder · opens this folder", kind = "Folder")
                    PersistentResultLine(title = overflowTrackTitle,
                        detail = overflowTrackDetail, kind = "Track")
                    // What: `repeat` invokes this block for each synthetic row index.
                    // Why: Enough fixture rows must exist to exercise vertical result scrolling.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // for (let index = 0; index < 18; index += 1) renderResult(index);
                    // ```
                    repeat(18) { index ->
                        PersistentResultLine(title = "Camellia archive ${index + 1}",
                            detail = "Folder · opens this folder", kind = "Folder")
                    }
                } else {
                    PersistentResultLine(title = "Camellia", detail = "Folder · opens this folder", kind = "Folder")
                    PersistentResultLine(title = "Another Xronixle", detail = "Track · Camellia · reveals track", kind = "Track")
                }
            } else {
                Text(if (unavailable) "Library unavailable" else if (query.isEmpty()) "Search your music"
                    else "No results for “$query”",
                    modifier = Modifier.padding(top = 72.dp),
                    style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                PersistentMessage(detail = if (unavailable) "Search returns when the library is available."
                    else if (query.isEmpty()) "Type a name to explore your library." else "Try another name.")
            }
        }
    }
}

/** One divided header keeps its text and action glyphs off the physical crease. */
@Composable
private fun PersistentSearchHeader(query: String, onQueryChange: (String) -> Unit,
    onBack: () -> Unit, startSafe: Dp, endSafe: Dp, queryWidth: Dp?,
    onQueryFocusChange: ((Boolean) -> Unit)? = null) {
    Row(modifier = Modifier.fillMaxWidth().height(72.dp)
        .background(MaterialTheme.colorScheme.surfaceContainerHigh)
        .padding(start = startSafe, end = endSafe), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
            Icon(imageVector = Icons.Filled.ArrowBack, contentDescription = "Back to player")
        }
        BasicTextField(value = query, onValueChange = onQueryChange,
            modifier = (if (queryWidth == null) Modifier.weight(1f) else Modifier.width(queryWidth.coerceAtLeast(120.dp)))
                .height(48.dp)
                .onFocusChanged { state -> onQueryFocusChange?.invoke(state.isFocused) }
                .semantics { contentDescription = "Search music" },
            singleLine = true,
            textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            decorationBox = { field ->
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.CenterStart) {
                    if (query.isEmpty()) {
                        Text("Search music", style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    field()
                }
            })
        if (queryWidth != null) Spacer(modifier = Modifier.weight(1f))
        if (query.isNotEmpty()) {
            IconButton(onClick = { onQueryChange("") }, modifier = Modifier.size(48.dp)) {
                Icon(imageVector = Icons.Filled.Close, contentDescription = "Clear search")
            }
        }
    }
}

/** Pairs result title and supporting meaning in one pane without a detached type label. */
@Composable
private fun PersistentResultLine(title: String, detail: String, kind: String) {
    Row(modifier = Modifier.fillMaxWidth().heightIn(min = 80.dp).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Icon(imageVector = if (kind == "Folder") Icons.Filled.FolderOpen else Icons.Filled.MusicNote,
            contentDescription = null, modifier = Modifier.size(24.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(detail, style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Gives a category result a bounded card while the deck remains pinned below. */
@Composable
private fun PersistentResultCard(title: String, detail: String, kind: String, pageColor: Color) {
    Surface(modifier = Modifier.fillMaxWidth().heightIn(min = 180.dp),
        color = if (pageColor == Color.Black) Color(0xFF1A1A1F) else MaterialTheme.colorScheme.surfaceContainerLow,
        shape = MaterialTheme.shapes.medium) {
        Column(modifier = Modifier.padding(16.dp)) {
            Icon(imageVector = if (kind == "Folder") Icons.Filled.FolderOpen else Icons.Filled.MusicNote,
                contentDescription = null, modifier = Modifier.size(24.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(kind, modifier = Modifier.padding(top = 12.dp), style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(title, modifier = Modifier.padding(top = 8.dp),
                style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(detail, modifier = Modifier.padding(top = 8.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Places one actionable explanation next to the empty Search region's header. */
@Composable
private fun PersistentMessage(detail: String) {
    Text(detail, modifier = Modifier.padding(top = 12.dp),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant)
}
