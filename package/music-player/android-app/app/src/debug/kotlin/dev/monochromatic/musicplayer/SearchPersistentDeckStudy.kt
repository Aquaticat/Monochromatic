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
    if (cover) {
        val state = if (candidate.contains("-player")) "player" else if (candidate.contains("-results")) "results"
            else if (candidate.contains("-none")) "none" else if (candidate.contains("-unavailable")) "unavailable" else "empty"
        SearchLayoutStudy(candidate = "search-layout-docked-$state${if (light) "-light" else ""}",
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
    if (!opened) {
        SearchPlayerPreview(isCover = false, light = light, onSearch = {
            query = ""
            opened = true
        })
        return
    }
    val halfDent = with(LocalDensity.current) { (55f / density).dp }
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
            preclearStudy = candidate.contains("-preclear-"),
            retainBrowser = candidate.contains("-retain-"))
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
    preclearStudy: Boolean, retainBrowser: Boolean) {
    val density = LocalDensity.current
    val reportedImeInset = WindowInsets.ime.getBottom(density)
    var queryFocused by remember { mutableStateOf(false) }
    val preclearActive = preclearStudy && queryFocused
    val observedView = LocalView.current
    var deliveredBottom by remember(density.density, density.fontScale, observedView.width) {
        mutableIntStateOf(0)
    }
    // The debug callback remains on the view above Compose and continues subtree dispatch.
    val animationHost = observedView.parent as? View
    if ((autoFitStudy || bannerHeightStress) && animationHost != null) {
        ObserveImeAnimation(animationHost, onAppliedIme = { bottom ->
            if (deliveredBottom != bottom) deliveredBottom = bottom
        })
    }
    val platformInsets = observedView.rootWindowInsets
    val imeType = if (Build.VERSION.SDK_INT >= 30) AndroidWindowInsets.Type.ime() else 0
    val platformBottom = if (Build.VERSION.SDK_INT >= 30) {
        platformInsets?.getInsets(imeType)?.bottom ?: 0
    } else 0
    val targetBottom = if (autoFitStudy) maxOf(reportedImeInset, platformBottom, deliveredBottom)
        else reportedImeInset
    val keyboardShown = targetBottom > 0
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
    val bannerFit = if (preclearStudy) preclearActive
        else if (autoFitStudy) keyboardShown && measuredOverflow
        else bannerHeightStress && reportedImeInset >= BANNER_STRESS_INSET_PX
    SideEffect {
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
            "queryFocused=$queryFocused preclear=$preclearActive")
    }
    // The platform target selects the layout only. Layout-time imePadding owns
    // bottom reservation in ordinary studies; preclear has one fixed debug owner.
    Row(modifier = Modifier.fillMaxSize().background(pageColor)
        .then(if (preclearActive) Modifier.padding(bottom = PRECLEAR_REVIEW_HEIGHT)
            else if (liftWithIme) Modifier.imePadding() else Modifier)) {
        SearchFoldDeckHost(light = light, modifier = Modifier.weight(1f),
            deckFirst = !liftWithIme, deckFullHeight = liftWithIme, bannerFit = bannerFit,
            compactForBrowser = retainBrowser && (keyboardShown || preclearActive),
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
            startSafe = halfDent + 16.dp, endSafe = 16.dp,
            includeTopInset = true, pageColor = pageColor,
            onQueryFocusChange = { focused -> queryFocused = focused })
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
    onQueryFocusChange: ((Boolean) -> Unit)? = null) {
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
                PersistentResultLine(title = "Camellia", detail = "Folder · opens this folder", kind = "Folder")
                PersistentResultLine(title = "Another Xronixle", detail = "Track · Camellia · reveals track", kind = "Track")
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
