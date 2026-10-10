// Debug-only host that renders the production player screen over authored sample data, for screenshots.
// It starts no service, engine, or sweep, and it does not touch the production controller.

// What:     `package dev.monochromatic.musicplayer` places the host beside the production screen it renders.
// Why:      The host calls `playerContent`, `isCoverLayout`, and `LOG_TAG` from the same module.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.os.Bundle` types the saved instance state that `onCreate` receives.
// Why:      The activity lifecycle hands its saved state to `onCreate` as a Bundle.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Bundle } from "android/os";
// ```
import android.os.Bundle

// What:     `import android.os.Build` reads the API level before using dynamic color.
// Why:      Dynamic color exists from Android 12, so older devices use the static scheme.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Build } from "android/os";
// ```
import android.os.Build

// What:     `import android.util.Log` writes the composition line the debug run is checked against.
// Why:      The screenshot run confirms which layout and picker state the host composed.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util";
// ```
import android.util.Log

// What:     `import android.content.Context` types the context that dynamic color needs.
// Why:      The dynamic color APIs take a Context, which the composition supplies.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Context } from "android/content";
// ```
import android.content.Context

// What:     `import androidx.activity.ComponentActivity` is the base class of the host activity.
// Why:      The host uses Compose through the same base class as the production activity.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { ComponentActivity } from "androidx/activity";
// ```
import androidx.activity.ComponentActivity

// What:     `import androidx.activity.enableEdgeToEdge` draws the host behind the system bars.
// Why:      The production activity does the same, so the screenshots show the same edges.
//
// In TS you'd write (pseudocode):
// ```ts
// import { enableEdgeToEdge } from "androidx/activity";
// ```
import androidx.activity.enableEdgeToEdge

// What:     `import androidx.activity.compose.setContent` mounts the Compose tree in the activity.
// Why:      The host draws its screen inside `setContent`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { setContent } from "androidx/activity/compose";
// ```
import androidx.activity.compose.setContent

// What:     `import androidx.compose.foundation.layout.BoxWithConstraints` measures the width the layout uses.
// Why:      The host logs the same cover or unfolded choice the production screen makes for that width.
//
// In TS you'd write (pseudocode):
// ```ts
// import { BoxWithConstraints } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.BoxWithConstraints

// What:     `import androidx.compose.foundation.layout.fillMaxSize` makes the host fill the screen.
// Why:      The production screen expects the full window as its space.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fillMaxSize } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.fillMaxSize

// What:     `import androidx.compose.material3.ColorScheme` names the color scheme type.
// Why:      The host builds the same scheme as the production activity and passes it to the theme.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { ColorScheme } from "material3";
// ```
import androidx.compose.material3.ColorScheme

// What:     `import androidx.compose.material3.MaterialTheme` applies the color scheme to the host content.
// Why:      The production screen reads its colors from the theme.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MaterialTheme } from "material3";
// ```
import androidx.compose.material3.MaterialTheme

// What:     `import androidx.compose.material3.darkColorScheme` and `lightColorScheme` are the pre-Android-12 schemes.
// Why:      The production activity falls back to these schemes on older devices, and the host must match it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { darkColorScheme, lightColorScheme } from "material3";
// ```
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme

// What:     `import androidx.compose.material3.dynamicDarkColorScheme` and `dynamicLightColorScheme` are the
//           wallpaper schemes.
// Why:      The production activity uses these schemes on Android 12 and later, and the host must match it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { dynamicDarkColorScheme, dynamicLightColorScheme } from "material3";
// ```
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme

// What:     `import androidx.compose.runtime.Composable` marks the functions that emit UI.
// Why:      The host's screen function emits UI.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Composable } from "compose/runtime";
// ```
import androidx.compose.runtime.Composable

// What:     `import androidx.compose.runtime.getValue` and `setValue` let a delegated state be read and written.
// Why:      The host keeps the picker and the selected page in delegated state.
//
// In TS you'd write (pseudocode):
// ```ts
// // State delegates are read and written by property access.
// ```
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

// What:     `import androidx.compose.foundation.isSystemInDarkTheme` reads the system appearance.
// Why:      The host picks the dark or light scheme from the same appearance as the production activity.
//
// In TS you'd write (pseudocode):
// ```ts
// import { isSystemInDarkTheme } from "compose/foundation";
// ```
import androidx.compose.foundation.isSystemInDarkTheme

// What:     `import androidx.compose.ui.graphics.Color` names the true-black scheme color.
// Why:      The dark scheme uses true black for its background and surface, as the production activity does.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Color } from "compose/ui/graphics";
// ```
import androidx.compose.ui.graphics.Color

// What:     `import androidx.compose.ui.Modifier` sizes the host's outer box.
// Why:      The outer box fills the window so the width measurement matches the production screen.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Modifier } from "compose/ui";
// ```
import androidx.compose.ui.Modifier

// What:     `import androidx.compose.ui.platform.LocalContext` supplies the Android context to the scheme helper.
// Why:      The dynamic color APIs need a Context, and the composition provides one.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LocalContext } from "compose/ui/platform";
// ```
import androidx.compose.ui.platform.LocalContext

// What:     `import dev.monochromatic.musicplayer.core.Page` and `paginate` build the authored pages.
// Why:      The sample library goes through the same pagination the production controller uses.
//
// In TS you'd write (pseudocode):
// ```ts
// import { paginate, type Page } from "./core/Pagination";
// ```
import dev.monochromatic.musicplayer.core.Page
import dev.monochromatic.musicplayer.core.PlaybackMode
import dev.monochromatic.musicplayer.core.PlayerContentModel
import dev.monochromatic.musicplayer.core.buildPlayerContent
import dev.monochromatic.musicplayer.core.paginate

// What:     `const val EXTRA_PICKER: String = "picker"` is the intent extra that starts the cover picker open.
// Why:      The screenshot runs need the picker open without tapping, so the extra sets the starting state.
//
// In TS you'd write (pseudocode):
// ```ts
// const EXTRA_PICKER = "picker";
// ```
/** Intent extra name for opening the folder picker at launch. */
private const val EXTRA_PICKER: String = "picker"

// What:     `private const val SAMPLE_POSITION_SEC: Double = 66.0` is the fixed playhead of the sample track.
// Why:      The screenshots show the first track one minute and six seconds in.
//
// In TS you'd write (pseudocode):
// ```ts
// const SAMPLE_POSITION_SEC = 66;
// ```
/** Fixed playhead position in seconds of the sample playing track, one minute and six seconds in. */
private const val SAMPLE_POSITION_SEC: Double = 66.0

// What:     `private const val SAMPLE_DURATION_SEC: Double = 275.0` is the length of the sample track.
// Why:      The screenshots show the first track four minutes and thirty-five seconds long.
//
// In TS you'd write (pseudocode):
// ```ts
// const SAMPLE_DURATION_SEC = 275;
// ```
/** Fixed length in seconds of the sample playing track, four minutes and thirty-five seconds. */
private const val SAMPLE_DURATION_SEC: Double = 275.0

// What:     `private val CAMELLIA_TITLES: List<String>` are the authored tracks of the Camellia folder.
// Why:      Camellia is the folder the captures show, so its titles match the reference screenshots.
//
// In TS you'd write (pseudocode):
// ```ts
// const CAMELLIA_TITLES = ["Another Xronixle", "Burning Aquamarine", ...];
// ```
/** Own-folder track titles of the Camellia sample folder, in the order the captures show them. */
private val CAMELLIA_TITLES: List<String> = listOf(
    "Another Xronixle",
    "Burning Aquamarine",
    "Dokuhebi",
    "ENÛMAVELIŠ",
    "Ghost",
    "Hyperflux",
    "Idol Corruption",
    "KillerToy",
    "Nacreous Snowmelt",
    "Mirage Rain",
    "Glasshouse",
    "Halcyon Drift",
    "Paper Lantern",
)

// What:     `private val CAMELLIA_LIVE_TITLES: List<String>` are the tracks of the Camellia/Live subfolder.
// Why:      A subfolder with its own tracks shows a header row between the folder's own tracks and its
//           subfolder tracks.
//
// In TS you'd write (pseudocode):
// ```ts
// const CAMELLIA_LIVE_TITLES = ["Ghost (Live)", "Hyperflux (Live)", "KillerToy (Live)"];
// ```
/** Tracks of the Camellia/Live subfolder, which the track list shows under a subfolder header. */
private val CAMELLIA_LIVE_TITLES: List<String> = listOf("Ghost (Live)", "Hyperflux (Live)", "KillerToy (Live)")

// What:     `private val SAMPLE_FOLDER_NAMES: List<String>` are the other sample folders, spanning the rail
//           from A to M.
// Why:      The rail shows several writing-system cells, so the sample library needs folders under many letters.
//
// In TS you'd write (pseudocode):
// ```ts
// const SAMPLE_FOLDER_NAMES = ["Adele", "Aphex Twin", ...];
// ```
/** Other sample folders, each holding two tracks, so the rail shows letters from A to M and beyond. */
private val SAMPLE_FOLDER_NAMES: List<String> = listOf(
    "Adele",
    "Aphex Twin",
    "Boards of Canada",
    "Burial",
    "C418",
    "Carpenter Brut",
    "Casiopea",
    "Celldweller",
    "Chicane",
    "CHON",
    "Clark",
    "Clown Core",
    "Coaltar of the Deepers",
    "Com Truise",
    "Cornelius",
    "Covet",
    "Crumb",
    "Crystal Castles",
    "Cult of Luna",
    "Current Value",
    "Cynic",
    "Cö shu Nie",
    "capsule",
    "Charisma.com",
    "Cornelius Live",
    "Cytus Sound Team",
    "Daft Punk",
    "Deadmau5",
    "Enya",
    "Gorillaz",
    "Igorrr",
    "Justice",
    "Kraftwerk",
    "Lamb",
    "Massive Attack",
    "Mogwai",
)

// What:     `private val SAMPLE_LIBRARY_PATHS: List<String>` is the authored library in load order.
// Why:      Camellia comes first so its first track is load index zero, the track the screenshots show playing.
//
// In TS you'd write (pseudocode):
// ```ts
// const SAMPLE_LIBRARY_PATHS = [...camellia, ...others];
// ```
/** Full display paths of the authored library in load order, with Camellia first. */
private val SAMPLE_LIBRARY_PATHS: List<String> = buildSampleLibraryPaths()

// What:     `private fun buildSampleLibraryPaths(): List<String>` writes the display paths of every sample track.
// Why:      The paths are generated from the folder lists so the library stays consistent with those lists.
//
// In TS you'd write (pseudocode):
// ```ts
// function buildSampleLibraryPaths(): string[] { /* camellia, then each folder's two tracks */ }
// ```
/** Builds the authored display paths: Camellia and its subfolder first, then two tracks in each other folder. */
private fun buildSampleLibraryPaths(): List<String> {
    /** Own tracks of Camellia, given their full display paths. */
    val camellia: List<String> = CAMELLIA_TITLES.map { title -> "Camellia/$title.flac" }
    /** Subfolder tracks of Camellia, given their full display paths. */
    val live: List<String> = CAMELLIA_LIVE_TITLES.map { title -> "Camellia/Live/$title.flac" }
    /** Two tracks in each other folder, given their full display paths. */
    val others: List<String> = SAMPLE_FOLDER_NAMES.flatMap { folder ->
        listOf("$folder/01 Song.flac", "$folder/02 Song.flac")
    }
    return camellia + live + others
}

// What:     `private val SAMPLE_PAGES: List<Page>` are the pages the production pagination makes from the
//           sample library.
// Why:      Using the real pagination keeps the rail, the tab order, and the load indices the same as in production.
//
// In TS you'd write (pseudocode):
// ```ts
// const SAMPLE_PAGES: Page[] = paginate(SAMPLE_LIBRARY_PATHS);
// ```
/** Pages of the authored library, built by the production pagination. */
private val SAMPLE_PAGES: List<Page> = paginate(SAMPLE_LIBRARY_PATHS)

// What:     `private val SAMPLE_PAGE_LABELS: List<String>` are the page names in tab order.
// Why:      The builder takes the page names, and the picker lists them in this order.
//
// In TS you'd write (pseudocode):
// ```ts
// const SAMPLE_PAGE_LABELS = SAMPLE_PAGES.map((page) => page.label);
// ```
/** Page names of the authored library in tab order. */
private val SAMPLE_PAGE_LABELS: List<String> = SAMPLE_PAGES.map { page -> page.label }

// What:     `private val SAMPLE_SELECTED_PAGE: Int` is the index of the Camellia page.
// Why:      The screenshots open on Camellia, so the selected page starts at its index.
//
// In TS you'd write (pseudocode):
// ```ts
// const SAMPLE_SELECTED_PAGE = SAMPLE_PAGE_LABELS.indexOf("Camellia");
// ```
/** Index of the Camellia page in tab order, which the host shows at launch. */
private val SAMPLE_SELECTED_PAGE: Int = SAMPLE_PAGE_LABELS.indexOf("Camellia")

// What:     `private val SAMPLE_CURRENT_INDEX: Int` is the load index of the first Camellia track.
// Why:      The first track is the one playing in the screenshots, so its load index marks the playing row.
//
// In TS you'd write (pseudocode):
// ```ts
// const SAMPLE_CURRENT_INDEX = SAMPLE_LIBRARY_PATHS.indexOf("Camellia/Another Xronixle.flac");
// ```
/** Load-order index of the first Camellia track, which plays at launch. */
private val SAMPLE_CURRENT_INDEX: Int = SAMPLE_LIBRARY_PATHS.indexOf("Camellia/Another Xronixle.flac")

// What:     `class ProductionScreenActivity : ComponentActivity()` is the debug host activity.
// Why:      A separate debug activity lets the screenshot runs render the production screen without the service.
//
// In TS you'd write (pseudocode):
// ```ts
// class ProductionScreenActivity extends ComponentActivity { /* ... */ }
// ```
/** Debug-only activity that renders the production player screen over authored sample data. */
class ProductionScreenActivity : ComponentActivity() {
    // What:     `override fun onCreate(savedInstanceState: Bundle?)` mounts the sample screen.
    // Why:      The host reads its launch extra and applies the same edge-to-edge and theme setup as the
    //           production activity.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // onCreate(savedInstanceState: Bundle | null): void { /* ... */ }
    // ```
    /** Enables edge-to-edge drawing and mounts the production screen with the launch picker state. */
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        /** Whether the folder picker starts open, from the `picker` intent extra. */
        val startWithPicker: Boolean = intent.getBooleanExtra(EXTRA_PICKER, false)
        setContent {
            /** Color scheme matching the production activity for the current appearance. */
            val colorScheme: ColorScheme = sampleColorScheme()
            MaterialTheme(colorScheme = colorScheme) {
                ProductionScreenHost(startWithPicker = startWithPicker)
            }
        }
    }
}

// What:     `@Composable private fun ProductionScreenHost(startWithPicker: Boolean)` draws the sample screen.
// Why:      The host keeps the picker and the selected page as local state and builds the model from fixed values.
//
// In TS you'd write (pseudocode):
// ```ts
// function ProductionScreenHost(props: { startWithPicker: boolean }): UIElement { /* ... */ }
// ```
/** Renders the production player screen over the authored library with fixed playback values. */
@Composable
private fun ProductionScreenHost(startWithPicker: Boolean) {
    /** Whether the folder picker is open on the folded cover, starting from the launch extra. */
    var pickerOpen: Boolean by remember { mutableStateOf(startWithPicker) }
    /** Index of the page the host shows, starting on Camellia. */
    var selectedPage: Int by remember { mutableIntStateOf(SAMPLE_SELECTED_PAGE) }
    /** Screen model built from the authored pages and the fixed playback values. */
    val model: PlayerContentModel = buildPlayerContent(
        pageLabels = SAMPLE_PAGE_LABELS,
        selectedPage = selectedPage,
        pageItems = SAMPLE_PAGES.getOrNull(selectedPage)?.entries.orEmpty(),
        currentIndex = SAMPLE_CURRENT_INDEX,
        playing = true,
        mode = PlaybackMode.IN_ORDER,
        positionSec = SAMPLE_POSITION_SEC,
        durationSec = SAMPLE_DURATION_SEC,
    )
    /** Actions that change only the host's own picker and page state; playback actions are inert here. */
    val actions = PlayerContentActions(
        onToggleFolderPicker = { pickerOpen = !pickerOpen },
        onSelectFolder = { folder ->
            /** Page index of the chosen folder in tab order, or -1 when no page has that name. */
            val page: Int = SAMPLE_PAGE_LABELS.indexOf(folder)
            if (page >= 0) {
                selectedPage = page
            }
            pickerOpen = false
        },
        onOpen = {},
        onSettings = {},
        onPlay = {},
        deck = TransportDeckActions(
            onSeek = {},
            onPrevious = {},
            onTogglePlay = {},
            onNext = {},
            onSelectMode = {},
        ),
    )
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        /** Layout name the production screen would choose at this width, for the composition log. */
        val layout: String = if (isCoverLayout(maxWidth.value)) "cover" else "unfolded"
        Log.i(LOG_TAG, "ProductionScreen.composed layout=$layout pickerOpen=$pickerOpen")
        playerContent(model = model, pickerOpen = pickerOpen, actions = actions)
    }
}

// What:     `@Composable private fun sampleColorScheme(): ColorScheme` picks the scheme the production activity uses.
// Why:      The host copies the production scheme so the screenshots show the same colors, including
//           true black in dark mode.
//
// In TS you'd write (pseudocode):
// ```ts
// function sampleColorScheme(): ColorScheme { /* dynamic on Android 12+, true black in dark mode */ }
// ```
/** Returns dynamic Material roles with a true-black background and surface in dark mode. */
@Composable
private fun sampleColorScheme(): ColorScheme {
    /** Whether the system is in dark mode. */
    val dark: Boolean = isSystemInDarkTheme()
    /** Android context that the dynamic color APIs need. */
    val context: Context = LocalContext.current
    /** Scheme from the wallpaper on Android 12 and later, or the static scheme on older devices. */
    val scheme: ColorScheme = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    } else {
        if (dark) darkColorScheme() else lightColorScheme()
    }
    if (!dark) {
        return scheme
    }
    return scheme.copy(background = Color.Black, surface = Color.Black)
}
