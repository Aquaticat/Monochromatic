// This file is a debug-only visual and interaction prototype for D47 to D49.
// Folded cover and unfolded inner panel geometry come from the Android emulator,
// never from an invented desktop viewport. No result hits a real media library.
package dev.monochromatic.musicplayer

// What:     `BackHandler` consumes Android Back only while the Search page is open.
// Why:      The separate page returns to the player before the activity closes.
//
// In TS you'd write (pseudocode):
// ```ts
// onBack(() => setPageOpen(false));
// ```
import androidx.activity.compose.BackHandler

// What:     `BasicTextField` is a bare editable field without another container.
// Why:      Back, input and Clear must share one 72dp M3 Search header.
//
// In TS you'd write (pseudocode):
// ```ts
// <input type="search" value={query} onInput={updateQuery} />
// ```
import androidx.compose.foundation.text.BasicTextField
// `KeyboardOptions` marks the IME action as Search, not playback.
import androidx.compose.foundation.text.KeyboardOptions
// `verticalScroll` keeps results reachable without another page bar.
import androidx.compose.foundation.verticalScroll
// `rememberScrollState` owns the prototype list's current offset.
import androidx.compose.foundation.rememberScrollState
// `background` paints the exact M3 role behind each native page.
import androidx.compose.foundation.background
// `clickable` makes illustrative result rows real targets in the prototype.
import androidx.compose.foundation.clickable
// `Arrangement` distributes the empty-page content vertically.
import androidx.compose.foundation.layout.Arrangement
// `Box` places the search page content inside the real display bounds.
import androidx.compose.foundation.layout.Box
// `Column` stacks status inset, one header, divider and page content.
import androidx.compose.foundation.layout.Column
// `Row` places Back, query and Clear in one header line.
import androidx.compose.foundation.layout.Row
// `WindowInsets` reads actual Android system insets from the target panel.
import androidx.compose.foundation.layout.WindowInsets
// `fillMaxHeight` keeps the neutral connector empty over the whole inner panel.
import androidx.compose.foundation.layout.fillMaxHeight
// `fillMaxSize` preserves target display dimensions.
import androidx.compose.foundation.layout.fillMaxSize
// `fillMaxWidth` spans the current Fold panel instead of a desktop mock.
import androidx.compose.foundation.layout.fillMaxWidth
// `height` fixes the Search header at the baseline 72dp token.
import androidx.compose.foundation.layout.height
// `heightIn` keeps result targets at least their baseline list height.
import androidx.compose.foundation.layout.heightIn
// `navigationBars` protects the final result from Android's gesture bar.
import androidx.compose.foundation.layout.navigationBars
// `padding` applies page margins only to content, not to system bars.
import androidx.compose.foundation.layout.padding
// `size` makes every icon action a 48dp target.
import androidx.compose.foundation.layout.size
// `statusBars` keeps the top bar below real status icons.
import androidx.compose.foundation.layout.statusBars
// `RowScope` and `ColumnScope` expose weight within their layout lambdas.
// `windowInsetsPadding` consumes only Android's measured navigation inset.
import androidx.compose.foundation.layout.windowInsetsPadding
// `windowInsetsTopHeight` reserves the actual status-bar height on each panel.
import androidx.compose.foundation.layout.windowInsetsTopHeight
// `width` fixes each unfolded content pane and the 24dp neutral connector.
import androidx.compose.foundation.layout.width

// What:     `Icons` provides official Material vectors at 24dp.
// Why:      Search, Back, Clear, Folder and Track must not be text glyphs.
//
// In TS you'd write (pseudocode):
// ```ts
// import { SearchIcon, BackIcon, CloseIcon, FolderIcon, NoteIcon } from 'material-icons';
// ```
import androidx.compose.material.icons.Icons
// The Back arrow is a real Material navigation icon.
import androidx.compose.material.icons.filled.ArrowBack
// The clear affordance uses the official Close icon.
import androidx.compose.material.icons.filled.Close
// The folder result uses the same category icon as the player.
import androidx.compose.material.icons.filled.FolderOpen
// The track result has a separate music-note category cue.
import androidx.compose.material.icons.filled.MusicNote
// The empty state uses a Material Search icon.
import androidx.compose.material.icons.filled.Search
// `HorizontalDivider` is the baseline full-content Search header boundary.
import androidx.compose.material3.HorizontalDivider
// `Icon` renders category and action vectors with scheme-aware color roles.
import androidx.compose.material3.Icon
// `IconButton` supplies a native 48dp button target.
import androidx.compose.material3.IconButton
// `ListItem` supplies the baseline M3 two-line 72dp list anatomy.
import androidx.compose.material3.ListItem
// `ListItemDefaults` gives the native item a transparent page fill.
import androidx.compose.material3.ListItemDefaults
// `MaterialTheme` supplies the target wallpaper's M3 color and type roles.
import androidx.compose.material3.MaterialTheme
// `Text` uses baseline M3 type styles rather than a desktop fallback face.
import androidx.compose.material3.Text

// What:     `Composable` marks a function as a native Compose layout description.
// Why:      The design study must be rendered on each actual Android panel.
//
// In TS you'd write (pseudocode):
// ```ts
// type Component = () => JSX.Element;
// ```
import androidx.compose.runtime.Composable
// `mutableStateOf` redraws the separate page when the player Search action is used.
import androidx.compose.runtime.mutableStateOf
// `remember` retains only temporary study state during one activity visit.
import androidx.compose.runtime.remember
// `getValue` reads a Compose state behind a Kotlin property delegate.
import androidx.compose.runtime.getValue
// `setValue` writes the Compose state when Search or Back is used.
import androidx.compose.runtime.setValue
// `SolidColor` paints the cursor from the generated primary role.
import androidx.compose.ui.graphics.SolidColor
// `Color` supplies OLED black only where D41 already keeps structural black.
import androidx.compose.ui.graphics.Color
// `Alignment` centers the empty and unavailable page messages.
import androidx.compose.ui.Alignment
// `Modifier` describes layout without altering the production activity.
import androidx.compose.ui.Modifier
// `LocalConfiguration` distinguishes the measured folded and unfolded dp widths.
import androidx.compose.ui.platform.LocalConfiguration
// `Role` exposes result rows as tappable items in this prototype.
import androidx.compose.ui.semantics.Role
// `contentDescription` names the query field for assistive technology.
import androidx.compose.ui.semantics.contentDescription
// `semantics` attaches that name to the native input.
import androidx.compose.ui.semantics.semantics
// `FontWeight` marks the heading without inventing a new type scale.
import androidx.compose.ui.text.font.FontWeight
// `ImeAction` asks the Android keyboard for a Search action.
import androidx.compose.ui.text.input.ImeAction
// `dp` is density-independent size on the measured Android panel.
import androidx.compose.ui.unit.dp

/**
 * What:     The Search page prototype chooses an initial fixture state from its candidate key.
 * Why:      One installed debug activity can capture player, empty, results and error states.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function SearchPageStudy({ candidate }: { candidate: string }): UIElement;
 * ```
 */
@Composable
internal fun SearchPageStudy(candidate: String) {
    val light = candidate.endsWith("-light")
    val startOpen = !candidate.contains("-player")
    val startQuery = if (candidate.contains("-results")) "cam" else if (candidate.contains("-none")) "zzq" else ""
    val unavailable = candidate.contains("-unavailable")
    var pageOpen by remember(candidate) { mutableStateOf(startOpen) }
    var query by remember(candidate) { mutableStateOf(startQuery) }
    val cover = LocalConfiguration.current.screenWidthDp < 600
    val windowColor = if (light) MaterialTheme.colorScheme.surfaceContainerLowest else Color.Black
    BackHandler(enabled = pageOpen) {
        pageOpen = false
        query = ""
    }
    if (!pageOpen) {
        SearchPlayerPreview(isCover = cover, light = light, onSearch = {
            pageOpen = true
            query = ""
        })
        return
    }
    val onBack = {
        pageOpen = false
        query = ""
    }
    if (cover) {
        Column(modifier = Modifier.fillMaxSize().background(windowColor)) {
            Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
            SearchHeader(query = query, onQueryChange = { query = it }, onBack = onBack)
            HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
            SearchBody(query = query, unavailable = unavailable,
                modifier = Modifier.fillMaxWidth().weight(1f).windowInsetsPadding(WindowInsets.navigationBars))
        }
        return
    }
    // E2: only neutral paint, never header, divider, text, rows or targets in [414,438)dp.
    Row(modifier = Modifier.fillMaxSize().background(windowColor)) {
        Column(modifier = Modifier.width(414.dp).fillMaxHeight().background(windowColor)) {
            Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
            SearchHeader(query = query, onQueryChange = { query = it }, onBack = onBack)
            HorizontalDivider(thickness = 1.dp, color = MaterialTheme.colorScheme.outline)
            Box(modifier = Modifier.fillMaxWidth().weight(1f))
        }
        Box(modifier = Modifier.width(24.dp).fillMaxHeight().background(windowColor))
        Column(modifier = Modifier.weight(1f).fillMaxHeight().background(windowColor)) {
            Box(modifier = Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars))
            Box(modifier = Modifier.fillMaxWidth().height(73.dp))
            SearchBody(query = query, unavailable = unavailable,
                modifier = Modifier.fillMaxWidth().weight(1f).windowInsetsPadding(WindowInsets.navigationBars))
        }
    }
}

/** Keeps the same result or message state in one bounded pane on either posture. */
@Composable
private fun SearchBody(query: String, unavailable: Boolean, modifier: Modifier) {
    Box(modifier = modifier) {
        if (unavailable) {
            SearchPageMessage(title = "Library unavailable", detail = "Search returns when the library is available.")
        } else if (query.isEmpty()) {
            SearchPageMessage(title = "Search your music", detail = "Type a name to explore your library.")
        } else if (query == "cam") {
            SearchExampleResults()
        } else {
            SearchPageMessage(title = "No results for “$query”", detail = "Try another name.")
        }
    }
}

/** One 72dp page header combines Back, editable query and Clear. */
@Composable
private fun SearchHeader(query: String, onQueryChange: (String) -> Unit, onBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().height(72.dp).background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
            Icon(imageVector = Icons.Filled.ArrowBack, contentDescription = "Back to player")
        }
        BasicTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier.weight(1f).height(48.dp).semantics { contentDescription = "Search music" },
            singleLine = true,
            textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            decorationBox = { innerField ->
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.CenterStart) {
                    if (query.isEmpty()) {
                        Text("Search music", style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    innerField()
                }
            },
        )
        if (query.isNotEmpty()) {
            IconButton(onClick = { onQueryChange("") }, modifier = Modifier.size(48.dp)) {
                Icon(imageVector = Icons.Filled.Close, contentDescription = "Clear search")
            }
        }
    }
}

/** The native baseline list shows two illustrative types without deciding indexing. */
@Composable
private fun SearchExampleResults() {
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        Text("Results for “cam”", modifier = Modifier.padding(top = 16.dp, bottom = 8.dp),
            style = MaterialTheme.typography.titleSmall)
        SearchExampleRow(title = "Camellia", detail = "Folder · opens this folder", category = "Folder", folder = true)
        SearchExampleRow(title = "Another Xronixle", detail = "Track · Camellia · reveals track", category = "Track", folder = false)
    }
}

/** One two-line M3 list row carries a distinct folder or track role and an example effect. */
@Composable
private fun SearchExampleRow(title: String, detail: String, category: String, folder: Boolean) {
    ListItem(
        headlineContent = { Text(title) },
        supportingContent = { Text(detail) },
        leadingContent = {
            Icon(imageVector = if (folder) Icons.Filled.FolderOpen else Icons.Filled.MusicNote,
                contentDescription = null)
        },
        trailingContent = { Text(category, style = MaterialTheme.typography.labelSmall) },
        modifier = Modifier.fillMaxWidth().heightIn(min = 72.dp).clickable(role = Role.Button, onClick = {}),
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
    )
}

/** Empty, no-result and unavailable states stay inside the same full-page destination. */
@Composable
private fun SearchPageMessage(title: String, detail: String) {
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(imageVector = Icons.Filled.Search, contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(title, modifier = Modifier.padding(top = 24.dp), style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold)
        Text(detail, modifier = Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
