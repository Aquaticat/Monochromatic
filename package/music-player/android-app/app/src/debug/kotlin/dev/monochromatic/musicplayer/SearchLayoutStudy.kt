// Debug-only comparison, not a production Search implementation.
// Question: which coherent unfolded Search composition survives the 7.5mm physical dent?
// Docked context, continuous list and two-column categories are distinct alternatives.
package dev.monochromatic.musicplayer

// What:     BackHandler maps system Back to the temporary Search destination.
// Why:      The design study needs the same exit path as its visible Back action.
//
// In TS you'd write (pseudocode):
// ```ts
// onBack(() => setSearchOpen(false));
// ```
import androidx.activity.compose.BackHandler
// What:     BasicTextField supplies editable query glyphs without another field border.
// Why:      One header owns Back, query, and Clear under D48.
//
// In TS you'd write (pseudocode):
// ```ts
// <input value={query} onInput={updateQuery} />
// ```
import androidx.compose.foundation.text.BasicTextField
// `KeyboardOptions` asks the Android keyboard for a Search action.
import androidx.compose.foundation.text.KeyboardOptions
// `background` paints continuous structure even where information cannot sit.
import androidx.compose.foundation.background
// `verticalScroll` permits the result region to grow at 200% text.
import androidx.compose.foundation.verticalScroll
// `rememberScrollState` keeps this temporary result offset in memory.
import androidx.compose.foundation.rememberScrollState
// `Box` overlays docked Search on actual accepted player context.
import androidx.compose.foundation.layout.Box
// `BoxWithConstraints` gives the available unfolded width without a desktop guess.
import androidx.compose.foundation.layout.BoxWithConstraints
// `Column` stacks one query header above its own results.
import androidx.compose.foundation.layout.Column
// `Row` places the alternative content groups side by side.
import androidx.compose.foundation.layout.Row
// `Spacer` reserves room between information-bearing regions without painting a gap.
import androidx.compose.foundation.layout.Spacer
// `WindowInsets` supplies the device's actual system-bar boundaries.
import androidx.compose.foundation.layout.WindowInsets
// `fillMaxHeight` fills the current physical panel vertically.
import androidx.compose.foundation.layout.fillMaxHeight
// `fillMaxSize` fills the active screen behind real system bars.
import androidx.compose.foundation.layout.fillMaxSize
// `fillMaxWidth` permits backgrounds and hit regions across the fold.
import androidx.compose.foundation.layout.fillMaxWidth
// `height` fixes the baseline divided header to 72dp.
import androidx.compose.foundation.layout.height
// `heightIn` sets the minimum native result height without truncating enlarged text.
import androidx.compose.foundation.layout.heightIn
// `navigationBars` protects scrolled results from the gesture bar.
import androidx.compose.foundation.layout.navigationBars
// `padding` keeps actual glyphs away from device and crease bounds.
import androidx.compose.foundation.layout.padding
// `size` makes Back and Clear explicit 48dp targets.
import androidx.compose.foundation.layout.size
// `statusBars` positions the one header below native status UI.
import androidx.compose.foundation.layout.statusBars
// `weight` is a Row/Column scope modifier for flexible space.
import androidx.compose.foundation.layout.weight
// `windowInsetsPadding` applies measured bottom safe space.
import androidx.compose.foundation.layout.windowInsetsPadding
// `windowInsetsTopHeight` reserves the top system-bar region.
import androidx.compose.foundation.layout.windowInsetsTopHeight
// `width` bounds informative labels within a safe physical half.
import androidx.compose.foundation.layout.width
// `Icons` supplies Material glyphs instead of text characters.
import androidx.compose.material.icons.Icons
// Official Back icon communicates the return action.
import androidx.compose.material.icons.filled.ArrowBack
// Official Close icon communicates clearing the query.
import androidx.compose.material.icons.filled.Close
// Folder and track icons distinguish result kinds from their labels.
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.MusicNote
// Search glyph marks an empty illustrative state.
import androidx.compose.material.icons.filled.Search
// `HorizontalDivider` supplies the baseline divided Search anatomy.
import androidx.compose.material3.HorizontalDivider
// `Icon` draws a vector in the current theme colors.
import androidx.compose.material3.Icon
// `IconButton` supplies a native action target and semantic role.
import androidx.compose.material3.IconButton
// `MaterialTheme` keeps type and color roles on the accepted baseline.
import androidx.compose.material3.MaterialTheme
// `Surface` distinguishes result cards without changing dark structural black.
import androidx.compose.material3.Surface
// `Text` renders sample query, result, and empty-state copy.
import androidx.compose.material3.Text
// `Composable` marks the following functions as Compose UI descriptions.
import androidx.compose.runtime.Composable
// `mutableStateOf` updates the screen only during the installed debug visit.
import androidx.compose.runtime.mutableStateOf
// `remember` retains this temporary page state within the activity.
import androidx.compose.runtime.remember
// Kotlin delegates read and write the temporary Compose state.
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
// `Alignment` places content without changing the native safe insets.
import androidx.compose.ui.Alignment
// `Modifier` describes each view's layout and background.
import androidx.compose.ui.Modifier
// `LocalConfiguration` distinguishes the folded cover from the inner display.
import androidx.compose.ui.platform.LocalConfiguration
// `LocalDensity` converts the physical-pixel dent only for current Android scaling.
import androidx.compose.ui.platform.LocalDensity
// `semantics` gives the query a stable accessibility name.
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
// `FontWeight` distinguishes result title and supporting copy.
import androidx.compose.ui.text.font.FontWeight
// `ImeAction` marks this as a query rather than playback text.
import androidx.compose.ui.text.input.ImeAction
// `SolidColor` paints the cursor from Material's primary role.
import androidx.compose.ui.graphics.SolidColor
// `Color` keeps the accepted true-black dark structure.
import androidx.compose.ui.graphics.Color
// `dp` supplies layout values only after physical clearance is converted.
import androidx.compose.ui.unit.dp

/** What:     A captured alternative starts at player or a canned Search state.
 *  Why:      Each layout can be compared in the same native Fold context.
 *
 *  In TS you'd write (pseudocode):
 *  ```ts
 *  function SearchLayoutStudy({ candidate }: { candidate: string }): UIElement;
 *  ```
 */
@Composable
internal fun SearchLayoutStudy(candidate: String) {
    val light = candidate.endsWith("-light")
    val cover = LocalConfiguration.current.screenWidthDp < 600
    val variant = if (candidate.contains("-docked-")) "docked" else if (candidate.contains("-wide-list-")) "wide-list" else "wide-grid"
    val initiallyOpen = !candidate.contains("-player")
    val initialQuery = if (candidate.contains("-results")) "cam" else if (candidate.contains("-none")) "zzq" else ""
    val unavailable = candidate.contains("-unavailable")
    var opened by remember(candidate) { mutableStateOf(initiallyOpen) }
    var query by remember(candidate) { mutableStateOf(initialQuery) }
    val onBack = {
        opened = false
        query = ""
    }
    BackHandler(enabled = opened) { onBack() }
    if (!opened) {
        SearchPlayerPreview(isCover = cover, light = light, onSearch = {
            query = ""
            opened = true
        })
        return
    }
    val pageColor = if (light) MaterialTheme.colorScheme.surfaceContainerLowest else Color.Black
    if (cover) {
        SearchLayoutCover(query = query, onQueryChange = { query = it }, onBack = onBack,
            unavailable = unavailable, pageColor = pageColor)
        return
    }
    // What:     110px is this panel's approximation of the user's physical 7.5mm dent.
    // Why:      Divide by current density instead of freezing the crease as dp.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const halfClearanceDp = 55 / currentPixelsPerDp;
    // ```
    val halfClearance = with(LocalDensity.current) { (55f / density).dp }
    if (variant == "docked") {
        SearchLayoutDocked(query = query, onQueryChange = { query = it }, onBack = onBack,
            unavailable = unavailable, light = light, pageColor = pageColor, halfClearance = halfClearance)
    } else if (variant == "wide-list") {
        SearchLayoutWide(query = query, onQueryChange = { query = it }, onBack = onBack,
            unavailable = unavailable, pageColor = pageColor, halfClearance = halfClearance, cards = false)
    } else {
        SearchLayoutWide(query = query, onQueryChange = { query = it }, onBack = onBack,
            unavailable = unavailable, pageColor = pageColor, halfClearance = halfClearance, cards = true)
    }
}

/** Keeps the folded design shared while unfolded alternatives answer the open layout question. */
@Composable
private fun SearchLayoutCover(query: String, onQueryChange: (String) -> Unit,
    onBack: () -> Unit, unavailable: Boolean, pageColor: Color) {
    Column(modifier = Modifier.fillMaxSize().background(pageColor)) {
        Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
        SearchLayoutHeader(query = query, onQueryChange = onQueryChange, onBack = onBack,
            halfClearance = null)
        HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
        SearchLayoutRows(query = query, unavailable = unavailable,
            modifier = Modifier.fillMaxWidth().weight(1f).windowInsetsPadding(WindowInsets.navigationBars),
            halfClearance = null, fullWidth = false)
    }
}

/** Keeps a complete docked query and result list together while player context remains visible. */
@Composable
private fun SearchLayoutDocked(query: String, onQueryChange: (String) -> Unit,
    onBack: () -> Unit, unavailable: Boolean, light: Boolean, pageColor: Color,
    halfClearance: androidx.compose.ui.unit.Dp) {
    Box(modifier = Modifier.fillMaxSize().background(pageColor)) {
        SearchPlayerPreview(isCover = false, light = light, onSearch = {})
        Row(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.weight(1f).fillMaxHeight().background(pageColor)) {
                Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
                SearchLayoutHeader(query = query, onQueryChange = onQueryChange, onBack = onBack,
                    halfClearance = halfClearance)
                HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
                SearchLayoutRows(query = query, unavailable = unavailable,
                    modifier = Modifier.fillMaxWidth().weight(1f).windowInsetsPadding(WindowInsets.navigationBars),
                    halfClearance = halfClearance, fullWidth = false)
            }
            Box(modifier = Modifier.weight(1f).fillMaxHeight().background(
                if (light) Color.White.copy(alpha = 0.35f) else Color.Black.copy(alpha = 0.35f)))
        }
    }
}

/** Compares a continuous full-width list with two-column result cards. */
@Composable
private fun SearchLayoutWide(query: String, onQueryChange: (String) -> Unit,
    onBack: () -> Unit, unavailable: Boolean, pageColor: Color,
    halfClearance: androidx.compose.ui.unit.Dp, cards: Boolean) {
    Column(modifier = Modifier.fillMaxSize().background(pageColor)) {
        Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
        SearchLayoutHeader(query = query, onQueryChange = onQueryChange, onBack = onBack,
            halfClearance = halfClearance)
        HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
        if (cards) {
            SearchLayoutCards(query = query, unavailable = unavailable,
                modifier = Modifier.fillMaxWidth().weight(1f).windowInsetsPadding(WindowInsets.navigationBars),
                halfClearance = halfClearance)
        } else {
            SearchLayoutRows(query = query, unavailable = unavailable,
                modifier = Modifier.fillMaxWidth().weight(1f).windowInsetsPadding(WindowInsets.navigationBars),
                halfClearance = halfClearance, fullWidth = true)
        }
    }
}

/** Draws one Back/query/Clear header; only informative glyphs avoid the physical dent. */
@Composable
private fun SearchLayoutHeader(query: String, onQueryChange: (String) -> Unit,
    onBack: () -> Unit, halfClearance: androidx.compose.ui.unit.Dp?) {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(72.dp)
        .background(MaterialTheme.colorScheme.surfaceContainerHigh)) {
        val narrow = halfClearance != null && maxWidth < 600.dp
        val endPadding = if (narrow) halfClearance!! + 8.dp else 16.dp
        Row(modifier = Modifier.fillMaxSize().padding(start = 16.dp, end = endPadding),
            verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                Icon(imageVector = Icons.Filled.ArrowBack, contentDescription = "Back to player")
            }
            if (halfClearance != null && !narrow) {
                val safeInputWidth = (maxWidth / 2 - halfClearance - 72.dp).coerceAtLeast(120.dp)
                SearchLayoutInput(query = query, onQueryChange = onQueryChange,
                    modifier = Modifier.width(safeInputWidth))
                Spacer(modifier = Modifier.weight(1f))
            } else {
                SearchLayoutInput(query = query, onQueryChange = onQueryChange,
                    modifier = Modifier.weight(1f))
            }
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }, modifier = Modifier.size(48.dp)) {
                    Icon(imageVector = Icons.Filled.Close, contentDescription = "Clear search")
                }
            }
        }
    }
}

/** Keeps editable text in its own bounded subregion even when the header surface spans the fold. */
@Composable
private fun SearchLayoutInput(query: String, onQueryChange: (String) -> Unit, modifier: Modifier) {
    BasicTextField(value = query, onValueChange = onQueryChange,
        modifier = modifier.height(48.dp).semantics { contentDescription = "Search music" },
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        decorationBox = { field ->
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.CenterStart) {
                if (query.isEmpty()) {
                    Text("Search music", color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge)
                }
                field()
            }
        })
}

/** Shows compact list states directly under the input in cover, docked, or wide-list form. */
@Composable
private fun SearchLayoutRows(query: String, unavailable: Boolean, modifier: Modifier,
    halfClearance: androidx.compose.ui.unit.Dp?, fullWidth: Boolean) {
    Column(modifier = modifier.verticalScroll(rememberScrollState())) {
        if (query != "cam" || unavailable) {
            SearchLayoutEmpty(query = query, unavailable = unavailable,
                halfClearance = halfClearance, fullWidth = fullWidth)
            return@Column
        }
        Text("Results for “cam”", modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 8.dp),
            style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        SearchLayoutRow(title = "Camellia", detail = "Folder · opens this folder", kind = "Folder",
            halfClearance = halfClearance, fullWidth = fullWidth)
        SearchLayoutRow(title = "Another Xronixle", detail = "Track · Camellia · reveals track", kind = "Track",
            halfClearance = halfClearance, fullWidth = fullWidth)
    }
}

/** Puts result details in a safe leading region while the row surface may cross the dent. */
@Composable
private fun SearchLayoutRow(title: String, detail: String, kind: String,
    halfClearance: androidx.compose.ui.unit.Dp?, fullWidth: Boolean) {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth().heightIn(min = 80.dp)) {
        val safeEnd = if (halfClearance != null) maxWidth / 2 - halfClearance - 16.dp else maxWidth - 24.dp
        val labelWidth = if (fullWidth) safeEnd - 88.dp else maxWidth - (halfClearance ?: 0.dp) - 88.dp
        Row(modifier = Modifier.fillMaxWidth().heightIn(min = 80.dp)
            .padding(start = 16.dp, end = if (!fullWidth && halfClearance != null) halfClearance + 8.dp else 16.dp,
                top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Icon(imageVector = if (kind == "Folder") Icons.Filled.FolderOpen else Icons.Filled.MusicNote,
                contentDescription = null, modifier = Modifier.size(24.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.width(labelWidth.coerceAtLeast(160.dp))) {
                Text(title, style = MaterialTheme.typography.bodyLarge)
                Text(detail, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (fullWidth) {
                Spacer(modifier = Modifier.weight(1f))
                Text(kind, style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

/** Keeps empty-state explanation adjacent to its query rather than across an empty pane. */
@Composable
private fun SearchLayoutEmpty(query: String, unavailable: Boolean,
    halfClearance: androidx.compose.ui.unit.Dp?, fullWidth: Boolean) {
    val title = if (unavailable) "Library unavailable" else if (query.isEmpty()) "Search your music" else "No results for “$query”"
    val detail = if (unavailable) "Search returns when the library is available." else if (query.isEmpty())
        "Type a name to explore your library." else "Try another name."
    BoxWithConstraints(modifier = Modifier.fillMaxWidth().heightIn(min = 240.dp)) {
        val width = if (halfClearance != null && fullWidth) maxWidth / 2 - halfClearance - 32.dp else
            maxWidth - (halfClearance ?: 0.dp) - 32.dp
        Column(modifier = Modifier.width(width.coerceAtLeast(220.dp)).padding(start = 16.dp, top = 72.dp),
            horizontalAlignment = Alignment.Start) {
            Icon(imageVector = Icons.Filled.Search, contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(24.dp))
            Text(title, modifier = Modifier.padding(top = 16.dp),
                style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text(detail, modifier = Modifier.padding(top = 8.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Arranges a folder result and a track result as two bounded information groups. */
@Composable
private fun SearchLayoutCards(query: String, unavailable: Boolean, modifier: Modifier,
    halfClearance: androidx.compose.ui.unit.Dp) {
    Column(modifier = modifier.verticalScroll(rememberScrollState())) {
        if (query != "cam" || unavailable) {
            SearchLayoutEmpty(query = query, unavailable = unavailable,
                halfClearance = halfClearance, fullWidth = true)
            return@Column
        }
        Text("Results for “cam”", modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 12.dp),
            style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            SearchLayoutCard(title = "Camellia", detail = "Folder · opens this folder",
                kind = "Folder", modifier = Modifier.weight(1f).padding(start = 16.dp, end = halfClearance + 8.dp))
            SearchLayoutCard(title = "Another Xronixle", detail = "Track · Camellia · reveals track",
                kind = "Track", modifier = Modifier.weight(1f).padding(start = halfClearance + 8.dp, end = 16.dp))
        }
    }
}

/** A tonal card is structural paint; its complete text remains outside the central dent. */
@Composable
private fun SearchLayoutCard(title: String, detail: String, kind: String, modifier: Modifier) {
    Surface(modifier = modifier.heightIn(min = 180.dp),
        color = if (MaterialTheme.colorScheme.background == Color.Black) Color(0xFF1A1A1F)
            else MaterialTheme.colorScheme.surfaceContainerLow,
        shape = MaterialTheme.shapes.medium) {
        Column(modifier = Modifier.padding(16.dp)) {
            Icon(imageVector = if (kind == "Folder") Icons.Filled.FolderOpen else Icons.Filled.MusicNote,
                contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(24.dp))
            Text(kind, modifier = Modifier.padding(top = 12.dp),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(title, modifier = Modifier.padding(top = 8.dp),
                style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(detail, modifier = Modifier.padding(top = 8.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
