// Host of the production player screen. It owns the route between the player, the Search page, the Settings page,
// and the template editor, the Search query, the folder picker flag, and the template texts. It sends each action
// to the controller or to its own state, and it saves a template only when the edited text applies.

// What:     `package dev.monochromatic.musicplayer` places the host beside the controller and the screens it hosts.
// Why:      The host calls the screens and the controller from this package without imports.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` types the context the template preferences are read through.
// Why:      The host loads and saves templates through `SessionStore`, which takes a Context.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Context } from "android/content";
// ```
import android.content.Context

// What:     `import android.util.Log` writes the route and template decisions to the log.
// Why:      Every route change and template save is logged, so a device run shows which destination was reached.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util";
// ```
import android.util.Log

// What:     `import androidx.activity.compose.BackHandler` intercepts system Back while the host is off the player.
// Why:      Back on Search or Settings returns to the player, and Back in the editor returns to Settings.
//
// In TS you'd write (pseudocode):
// ```ts
// import { BackHandler } from "androidx/activity/compose";
// ```
import androidx.activity.compose.BackHandler

// What:     `import androidx.compose.foundation.layout.Box` and `fillMaxSize` lay out the player and its notice.
// Why:      The player and its notice share one box that fills the screen.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Box } from "compose/foundation/layout";
// ```
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding

// What:     `import androidx.compose.runtime.LaunchedEffect` runs the feedback expiry keyed on the next expiry.
// Why:      Expiry must wait for the next due message and restart when a message is shown or dismissed.
//
// In TS you'd write (pseudocode):
// ```ts
// import { useEffect } from "react";
// ```
import androidx.compose.runtime.LaunchedEffect

// What:     `import androidx.compose.runtime.Composable` marks the host as a function that emits UI.
// Why:      The host emits the screens for the current route.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Composable } from "compose/runtime";
// ```
import androidx.compose.runtime.Composable

// What:     `import androidx.compose.runtime.getValue` and `setValue` let delegated state be read and written.
// Why:      The host keeps the query, the picker flag, and the templates in delegated state.
//
// In TS you'd write (pseudocode):
// ```ts
// // Delegated state is read and written by property access.
// ```
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue

// What:     `import androidx.compose.runtime.mutableStateOf` and `remember` hold state across recompositions.
// Why:      The templates are loaded once per host, and each edit replaces them.
//
// In TS you'd write (pseudocode):
// ```ts
// import { useState } from "react";
// ```
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember

// What:     `import androidx.compose.runtime.saveable.rememberSaveable` keeps state across configuration changes.
// Why:      The route, the query, and the picker flag survive a rotation.
//
// In TS you'd write (pseudocode):
// ```ts
// // A state hook whose value survives a configuration change.
// ```
import androidx.compose.runtime.saveable.rememberSaveable

// What:     Imports for the track menu, its actions, and the trash Undo flow.
// Why:      The host opens the menu, runs its actions on a coroutine scope, and shows each result in the overlay.
//
// In TS you'd write (pseudocode):
// ```ts
// import { trackMenuPopup, trashRouteFor, trashUndoMessage } from "./track-menu";
// ```
import android.net.Uri
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.onFocusChanged
import dev.monochromatic.musicplayer.core.TrackActionFailure
import dev.monochromatic.musicplayer.core.libraryDisplayName
import dev.monochromatic.musicplayer.core.TrackMenuAction
import dev.monochromatic.musicplayer.core.TrashRecord
import dev.monochromatic.musicplayer.core.TrashRoute
import dev.monochromatic.musicplayer.core.trackFileNameOf
import dev.monochromatic.musicplayer.core.mimeTypeFor
import dev.monochromatic.musicplayer.core.trackActionFailureMessage
import dev.monochromatic.musicplayer.core.trackMenuActionsFor
import dev.monochromatic.musicplayer.core.trashRouteFor
import dev.monochromatic.musicplayer.core.trashUndoMessage
import dev.monochromatic.musicplayer.core.TRACK_REANALYSE_ID
import dev.monochromatic.musicplayer.core.TrackMeasure
import dev.monochromatic.musicplayer.core.measureDetailsValue
import dev.monochromatic.musicplayer.core.measuresByIndex
import dev.monochromatic.musicplayer.core.trackReanalysingMessage
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// What:     `import androidx.compose.ui.Alignment` aligns the feedback overlay to the bottom start edge.
// Why:      The overlay floats at the bottom of the player, and it never reflows the content.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Alignment } from "compose/ui";
// ```
import androidx.compose.ui.Alignment

// What:     `import androidx.compose.ui.unit.Dp` and `dp` size the feedback overlay inset.
// Why:      The overlay sits 16dp from the edges, and the inset is a named constant.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Dp } from "compose/ui/unit";
// ```
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// What:     `import androidx.compose.ui.Modifier` sizes the player box.
// Why:      The box fills the screen so the player content lays out in full.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Modifier } from "compose/ui";
// ```
import androidx.compose.ui.Modifier

// What:     `import androidx.compose.ui.platform.LocalContext` reads the current Android context.
// Why:      The template preferences need a Context, and the composition provides one.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LocalContext } from "compose/ui/platform";
// ```
import androidx.compose.ui.platform.LocalContext

// What:     `import dev.monochromatic.musicplayer.core.PlayerHostModel` and the core types the host reads.
// Why:      The pure rules and the core values live in the core package and are shared with the tests.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PlayerHostModel, SearchActivation } from "./core/PlayerHostModel";
// ```
import dev.monochromatic.musicplayer.core.PlayerContentModel
import dev.monochromatic.musicplayer.core.HostKeyActions
import dev.monochromatic.musicplayer.core.HostKeyContext
import dev.monochromatic.musicplayer.core.HostKeyDispatcher
import dev.monochromatic.musicplayer.core.HostKeyLayout
import dev.monochromatic.musicplayer.core.MenuAnchorRect
import dev.monochromatic.musicplayer.core.PlayingPlace
import dev.monochromatic.musicplayer.core.playingPlaceOf
import androidx.compose.ui.platform.LocalConfiguration
import dev.monochromatic.musicplayer.core.HostKeyRoute
import dev.monochromatic.musicplayer.core.PlaybackMode
import dev.monochromatic.musicplayer.core.PlayerHostModel
import dev.monochromatic.musicplayer.core.SearchActivation
import dev.monochromatic.musicplayer.core.SearchResult
import dev.monochromatic.musicplayer.core.SearchState
import dev.monochromatic.musicplayer.core.TemplateEditorState
import dev.monochromatic.musicplayer.core.TemplateKind
import dev.monochromatic.musicplayer.core.FeedbackMessage
import dev.monochromatic.musicplayer.core.buildPlayerContent
import dev.monochromatic.musicplayer.core.searchLibrary

// What:     `sealed interface PlayerRoute` names the four destinations the host can show.
// Why:      One closed type lets the host draw exactly one destination and makes Back a total function.
//
// In TS you'd write (pseudocode):
// ```ts
// type PlayerRoute = { kind: "player" } | { kind: "search" } | { kind: "settings" }
//   | { kind: "templateEditor"; template: TemplateKind };
// ```
/** The destinations of the player host. */
sealed interface PlayerRoute {
    // What:     `data object Player` is the player screen with the folder picker and the track list.
    // Why:      The player is the start destination and the one Back returns to.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "player" }
    // ```
    /** The player screen, which shows the folder picker or the track list. */
    data object Player : PlayerRoute

    // What:     `data object Search` is the Search page reached from the Search button.
    // Why:      Search is a separate destination with its own query, and Back returns to the player.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "search" }
    // ```
    /** The Search page, reached from the Search button. */
    data object Search : PlayerRoute

    // What:     `data object Settings` is the Settings page that lists the two templates.
    // Why:      Settings is a destination of its own, and Back returns to the player.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "settings" }
    // ```
    /** The Settings page that lists the track-row and playing-track templates. */
    data object Settings : PlayerRoute

    // What:     `data class TemplateEditor(val kind: TemplateKind)` is the editor of one template.
    // Why:      Each template has its own editor, opened from Settings, and Back returns to Settings.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "templateEditor"; template: TemplateKind }
    // ```
    /** The editor of one template, reached from Settings. */
    data class TemplateEditor(
        /** The template the editor is open on. */
        val kind: TemplateKind,
    ) : PlayerRoute
}

// What:     `internal object PlayerRouteRules` holds the pure route rules: Back and the saved text of each route.
// Why:      The rules are testable on the JVM, and the saved text keeps the route across a configuration change
//           without making every route Parcelable.
//
// In TS you'd write (pseudocode):
// ```ts
// const PlayerRouteRules = { backFrom, encode, decode };
// ```
/** Pure route rules: where Back leads, and how a route is saved in the instance state as text. */
internal object PlayerRouteRules {
    // What:     `private const val TOKEN_PLAYER: String = "player"` names the player route in the saved state.
    // Why:      A fixed token keeps the saved text stable across builds.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const TOKEN_PLAYER = "player";
    // ```
    /** Saved token of the player route. */
    private const val TOKEN_PLAYER: String = "player"

    // What:     `private const val TOKEN_SEARCH: String = "search"` names the Search route in the saved state.
    // Why:      A fixed token keeps the saved text stable across builds.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const TOKEN_SEARCH = "search";
    // ```
    /** Saved token of the Search route. */
    private const val TOKEN_SEARCH: String = "search"

    // What:     `private const val TOKEN_SETTINGS: String = "settings"` names the Settings route in the saved state.
    // Why:      A fixed token keeps the saved text stable across builds.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const TOKEN_SETTINGS = "settings";
    // ```
    /** Saved token of the Settings route. */
    private const val TOKEN_SETTINGS: String = "settings"

    // What:     `private const val TOKEN_TEMPLATE_PREFIX: String = "template:"` starts the saved token of an editor.
    // Why:      The template kind's name follows the prefix, so one prefix covers every editor.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const TOKEN_TEMPLATE_PREFIX = "template:";
    // ```
    /** Prefix of the saved token of a template editor, followed by the template kind's name. */
    private const val TOKEN_TEMPLATE_PREFIX: String = "template:"

    // What:     `fun backFrom(route: PlayerRoute): PlayerRoute` names the route Back leads to.
    // Why:      Search and Settings return to the player, and an editor returns to Settings.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function backFrom(route: PlayerRoute): PlayerRoute { /* editor -> settings; others -> player */ }
    // ```
    /** Returns the route Back leads to from one route. */
    fun backFrom(route: PlayerRoute): PlayerRoute = when (route) {
        PlayerRoute.Player -> PlayerRoute.Player
        PlayerRoute.Search -> PlayerRoute.Player
        PlayerRoute.Settings -> PlayerRoute.Player
        is PlayerRoute.TemplateEditor -> PlayerRoute.Settings
    }

    // What:     `fun encode(route: PlayerRoute): String` writes one route as its saved token.
    // Why:      The instance state keeps text, so each route is saved as a stable token.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function encode(route: PlayerRoute): string { /* token per route */ }
    // ```
    /** Returns the saved token of one route. */
    fun encode(route: PlayerRoute): String = when (route) {
        PlayerRoute.Player -> TOKEN_PLAYER
        PlayerRoute.Search -> TOKEN_SEARCH
        PlayerRoute.Settings -> TOKEN_SETTINGS
        is PlayerRoute.TemplateEditor -> TOKEN_TEMPLATE_PREFIX + route.kind.name
    }

    // What:     `fun decode(token: String): PlayerRoute` reads one route from its saved token.
    // Why:      An unknown token restores the player, the same way an unknown stored playback mode falls back
    //           to its default, so a stale saved state never blocks the screen.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function decode(token: string): PlayerRoute { /* unknown -> player */ }
    // ```
    /** Returns the route of one saved token, or the player route when the token names no route. */
    fun decode(token: String): PlayerRoute = when {
        token == TOKEN_SEARCH -> PlayerRoute.Search
        token == TOKEN_SETTINGS -> PlayerRoute.Settings
        token.startsWith(TOKEN_TEMPLATE_PREFIX) -> templateRouteFor(token)
        else -> PlayerRoute.Player
    }

    // What:     `private fun templateRouteFor(token: String): PlayerRoute` reads the editor route of one token.
    // Why:      A template token names a kind, and a name no kind carries falls back to the player route.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function templateRouteFor(token: string): PlayerRoute { /* kind by name, else player */ }
    // ```
    /** Returns the editor route of one template token, or the player route when the kind name is unknown. */
    private fun templateRouteFor(token: String): PlayerRoute {
        /** Name of the template kind that follows the token prefix. */
        val kindName: String = token.removePrefix(TOKEN_TEMPLATE_PREFIX)
        /** Template kind with that name, or null when no kind has it. */
        val kind: TemplateKind? = TemplateKind.entries.firstOrNull { entry -> entry.name == kindName }
        if (kind == null) {
            return PlayerRoute.Player
        }
        return PlayerRoute.TemplateEditor(kind)
    }
}

// What:     `private fun loadStoredTemplates(context: Context): Map<TemplateKind, String>` reads every template.
// Why:      The host starts with the saved text of each template, so the rows and Settings show what the user saved.
//
// In TS you'd write (pseudocode):
// ```ts
// function loadStoredTemplates(context: Context): Record<TemplateKind, string> { /* each kind from the store */ }
// ```
/** Reads the stored text of every template, each falling back to its default when nothing valid is stored. */
private fun loadStoredTemplates(context: Context): Map<TemplateKind, String> =
    TemplateKind.entries.associateWith { kind -> SessionStore.loadTemplate(context, kind) }

// What:     `private val PLAYER_HOST_FEEDBACK_INSET: Dp = 16.dp` is the gap between the overlay and the screen edges.
// Why:      The feedback overlay keeps this inset from the start, end, and bottom edges.
//
// In TS you'd write (pseudocode):
// ```ts
// const PLAYER_HOST_FEEDBACK_INSET = 16; // dp
// ```
/** Inset between the feedback overlay and the start, end, and bottom edges of the player. */
private val PLAYER_HOST_FEEDBACK_INSET: Dp = 16.dp

// What:     `private val TRACK_MENU_INNER_INSET: Dp = 12.dp` is the track menu's start inset on the inner panes.
// Why:      The inner panes keep 12dp at their start edge, so the menu's leftmost position leaves that inset clear.
//
// In TS you'd write (pseudocode):
// ```ts
// const TRACK_MENU_INNER_INSET = 12; // dp
// ```
/** Start inset of the track menu on the unfolded inner panes, where the cover uses no inset. */
private val TRACK_MENU_INNER_INSET: Dp = 12.dp

// What:     `private fun hostKeyRouteOf(route: PlayerRoute): HostKeyRoute` names the keyboard route of a host route.
// Why:      The keyboard rules have their own route kinds, so each host route maps to one of them here.
//
// In TS you'd write (pseudocode):
// ```ts
// const hostKeyRouteOf = (route: PlayerRoute): HostKeyRoute => (route.kind === "template" ? "editor" : route.kind);
// ```
/** Maps a host route to the route kind that the keyboard rules use. */
private fun hostKeyRouteOf(route: PlayerRoute): HostKeyRoute = when (route) {
    PlayerRoute.Player -> HostKeyRoute.PLAYER
    PlayerRoute.Search -> HostKeyRoute.SEARCH
    PlayerRoute.Settings -> HostKeyRoute.SETTINGS
    is PlayerRoute.TemplateEditor -> HostKeyRoute.EDITOR
}

// What:     `@Composable fun playerHost(...)` draws the destination of the current route over the controller state.
// Why:      The player, Search, Settings, and the editor share one route and one set of template texts, so the host
//           holds them together and routes each action to the controller or to its own state.
//
// In TS you'd write (pseudocode):
// ```ts
// function PlayerHost(props: { controller: PlayerController; onChooseFolder: () => void }): UIElement { /* ... */ }
// ```
/**
 * Draws the player host: the route, the Search query, the folder picker flag, the template texts, the scan
 * indicator, and the feedback overlay.
 *
 * @param feedback Feedback queue that the host draws above the player and expires on time.
 * @param emptyNotice Draws the notice over the player while the library is loading or holds no track.
 * @param firstRunContent Draws the first-run pane over the player when the open source needs it, given the
 *     callback that opens the Settings route; null when the player shows.
 * @param libraryName Name of the opened folder, or of the MediaStore library, shown above the unfolded folders.
 */
@Composable
fun playerHost(
    controller: PlayerController,
    feedback: FeedbackHostState,
    onChooseFolder: () -> Unit,
    emptyNotice: @Composable (PlayerUiState) -> Unit = {},
    firstRunContent: (@Composable (onSettings: () -> Unit) -> Unit)? = null,
    libraryName: String = libraryDisplayName(null),
) {
    /** Android context that the template preferences are read and written through. */
    val context: Context = LocalContext.current
    /** Saved token of the route the host shows, which survives a configuration change. */
    var routeToken: String by rememberSaveable { mutableStateOf(PlayerRouteRules.encode(PlayerRoute.Player)) }
    /** Route the host shows, decoded from the saved token. */
    val route: PlayerRoute = PlayerRouteRules.decode(routeToken)
    /** Text typed into the Search query, which starts empty on each visit. */
    var query: String by rememberSaveable { mutableStateOf("") }
    /** Whether the folder picker is open on the folded cover. */
    var pickerOpen: Boolean by rememberSaveable { mutableStateOf(false) }
    /** Whether the playback area, which is the host's own focusable root, holds focus itself. */
    var rootFocused: Boolean by remember { mutableStateOf(false) }
    /** Whether the host root or any control inside it holds focus. */
    var hostHasFocus: Boolean by remember { mutableStateOf(false) }
    /** Whether the Search query field holds focus, as the Search page reports it. */
    var searchFieldFocused: Boolean by remember { mutableStateOf(false) }
    /** Count of same-visit Search refocus requests, read by the Search page's query field. */
    var searchFocusToken: Int by remember { mutableIntStateOf(0) }
    /** Count of reveal requests, read by the track list to scroll to and focus the playing row. */
    var revealToken: Int by remember { mutableIntStateOf(0) }
    /** Count of folder reveal requests, read by the track list to scroll to the playing track's folder header. */
    var folderRevealToken: Int by remember { mutableIntStateOf(0) }
    /** Focus requester of the host root, which takes the player's keys when no control holds focus. */
    val rootFocusRequester: FocusRequester = remember { FocusRequester() }
    /** Callback that the Search query field reports its focus through, kept across frames so readers stay valid. */
    val reportSearchFieldFocus: (Boolean) -> Unit = remember { { focused: Boolean -> searchFieldFocused = focused } }
    /** Both templates as typed and as last applied, loaded from the store when the host first composes. */
    var templates: TemplateEditorState by remember {
        mutableStateOf(PlayerHostModel.restoredEditor(stored = loadStoredTemplates(context)))
    }
    /** Controller snapshot the host draws this frame. */
    val state: PlayerUiState = controller.uiState
    /** Playback position and duration sampled for this frame. */
    val playbackProgress: PlaybackProgress = rememberPlaybackProgress(controller)
    /** Player model built from the controller snapshot and the sampled progress, before the templates apply. */
    val builtModel: PlayerContentModel = buildPlayerContent(
        pageLabels = state.pageLabels,
        selectedPage = state.selectedPage,
        pageItems = state.pageItems,
        playingItems = state.playingItems,
        playingPageIndex = state.playingPageIndex,
        currentIndex = state.currentIndex,
        playing = state.playing,
        mode = state.playbackMode,
        positionSec = playbackProgress.position,
        durationSec = playbackProgress.duration,
        libraryName = libraryName,
    )
    /** Library tracks of the selected page, each keyed by the URI that its measure is stored under. */
    val pageTracks: List<Track> = state.pageItems.mapNotNull { entry ->
        controller.uriAt(entry.index)?.let { uri -> Track(uri = uri, displayPath = entry.name) }
    }
    /** Measures of the selected page's tracks keyed by load-order index, which is how the rows name their tracks. */
    val pageMeasures: Map<Int, TrackMeasure> = measuresByIndex(
        pageIndices = state.pageItems.map { entry -> entry.index },
        uriAt = controller::uriAt,
        measures = state.measures,
    )
    // What:     `LaunchedEffect(pageTracks, SweepProgress.snapshot.done)` reads the page's unmeasured tracks.
    // Why:      A new page or a sweep step (the sweep reports every few tracks) re-checks the peaks shown on the page,
    //           and the batches land on screen as each one is read.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => { refreshPage(pageTracks, () => measures, publish); }, [pageTracks, sweepDone]);
    // ```
    LaunchedEffect(pageTracks, SweepProgress.snapshot.done) {
        TrackMeasures.refreshPage(
            context = context,
            tracks = pageTracks,
            known = { controller.uiState.measures },
            publish = { updates -> controller.mergeMeasures(updates) },
        )
    }
    /** Playing track and its place in its own folder, which the deck reads even when that folder is not on screen. */
    val playingPlace: PlayingPlace = playingPlaceOf(
        folderTitle = state.playingPageIndex?.let { index -> state.pageLabels.getOrNull(index) }.orEmpty(),
        playingItems = state.playingItems,
        currentIndex = state.currentIndex,
    )
    /** Measure of the playing track, read from the library-wide measures so the deck shows it on any folder. */
    val playingMeasure: TrackMeasure? = state.currentIndex
        ?.let { index -> controller.uriAt(index) }
        ?.let { uri -> state.measures[uri] }
    /** Player model with the saved track-row and playing-track templates applied. */
    val model: PlayerContentModel = PlayerHostModel.contentWithTemplates(
        base = builtModel,
        pageItems = state.pageItems,
        currentIndex = state.currentIndex,
        durationSec = playbackProgress.duration,
        trackRowsTemplate = templates.lastValid.getValue(TemplateKind.TRACK_ROWS),
        playingTemplate = templates.lastValid.getValue(TemplateKind.PLAYING_TRACK),
        playingPlace = playingPlace,
        playingMeasure = playingMeasure,
        measuresByIndex = pageMeasures,
    )
    /** Editor view with the preview drawn from the selected page and its measured durations and peaks, for Settings. */
    val editor: TemplateEditorState = PlayerHostModel.editorWithPreview(
        editor = templates,
        pageItems = state.pageItems,
        measuresByIndex = pageMeasures,
    )

    // What:     `fun go(next: PlayerRoute)` moves the host to one destination and saves its token.
    // Why:      Every route change goes through here, so each one is logged and saved the same way.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const go = (next: PlayerRoute) => setRouteToken(encode(next));
    // ```
    /** Moves the host to one destination and saves the destination in the instance state. */
    fun go(next: PlayerRoute) {
        Log.i(LOG_TAG, "player host route=${PlayerRouteRules.encode(next)}")
        routeToken = PlayerRouteRules.encode(next)
    }

    // What:     `fun applyTemplateChange(next: TemplateEditorState)` keeps an edited template and saves it when valid.
    // Why:      The rows follow the typed text while it applies, and the store only ever receives a valid template.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const applyTemplateChange = (next: EditorState) => { setTemplates(next); if (next.isValid) save(next); };
    // ```
    /** Keeps one edited template state and saves the open template when its text applies to every preview track. */
    fun applyTemplateChange(next: TemplateEditorState) {
        templates = next
        if (!next.isValid) {
            Log.i(LOG_TAG, "template draft kept unsaved kind=${next.kind.name}")
            return
        }
        SessionStore.saveTemplate(context = context, kind = next.kind, text = next.text)
        Log.i(LOG_TAG, "template saved kind=${next.kind.name}")
    }

    // What:     `fun selectFolder(folder: String)` selects a folder by its name without starting a track.
    // Why:      Picking a folder shows its tracks and never autoplays, and the picker closes on the player.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const selectFolder = (folder: string) => { controller.selectPage(labels.indexOf(folder)); };
    // ```
    /** Selects the folder with the given name, and closes the picker when a page with that name exists. */
    fun selectFolder(folder: String) {
        /** Tab-order index of the chosen folder, or -1 when no page has that name. */
        val page: Int = state.pageLabels.indexOf(folder)
        if (page >= 0) {
            controller.selectPage(page)
        }
        pickerOpen = false
    }

    // What:     `fun openTemplate(kind: TemplateKind)` opens one template in its editor.
    // Why:      The editor opens on the chosen template with its caret at the end, as the editor state defines.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const openTemplate = (kind) => { setTemplates(editor.open(kind)); go(templateEditor(kind)); };
    // ```
    /** Opens the template editor on one template and moves the host to it. */
    fun openTemplate(kind: TemplateKind) {
        templates = editor.open(kind)
        go(PlayerRoute.TemplateEditor(kind))
    }

    // What:     `fun openSearchResult(result: SearchResult)` acts on one Search result and returns to the player.
    // Why:      A track starts or pauses, a folder selects its page, and each one returns to the player (D72 to D74);
    //           a result the player cannot open stays on Search so the page can say so.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const openSearchResult = (result: SearchResult) => { /* activation, then back to player */ };
    // ```
    /** Acts on one Search result, then returns to the player unless the result could not be opened. */
    fun openSearchResult(result: SearchResult) {
        /** What activating this result does to the player, decided from the result and the playing track. */
        val activation: SearchActivation = PlayerHostModel.searchActivationFor(
            result = result,
            pageLabels = state.pageLabels,
            currentIndex = state.currentIndex,
        )
        when (activation) {
            is SearchActivation.PlayTrack -> controller.playIndex(activation.indexInLibrary)
            SearchActivation.TogglePlayback -> controller.togglePlay()
            is SearchActivation.OpenFolder -> {
                controller.selectPage(activation.page)
                pickerOpen = false
            }
            SearchActivation.StayInSearch -> {
                Log.w(LOG_TAG, "search result not opened kind=${result.kind.name}")
                return
            }
        }
        query = ""
        go(PlayerRoute.Player)
    }

    // What:     `fun returnFocusToPlayback()` gives focus back to the playback area after a tap on the player.
    // Why:      Shortcuts reach the host only along the focused path, so a tapped row or control must not keep focus.
    //           Search and the editor keep their own focus, so the request runs only on the player route.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function returnFocusToPlayback(): void { if (route === "player") rootRef.focus(); }
    // ```
    /** Gives focus to the playback area after a tap on the player, and leaves focus alone on other routes. */
    fun returnFocusToPlayback() {
        if (route == PlayerRoute.Player) {
            rootFocusRequester.requestFocus()
        }
    }

    // What:     `val showPlayingFolder` closes the picker and selects the playing track's page.
    // Why:      The picker replaces the list, and the playing track may sit in another folder, so the folder is
    //           selected first. The row reveal and the folder reveal both need this step before they ask the list
    //           to move.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const showPlayingFolder = () => {
    //   setPickerOpen(false); if (page changed) selectPage(playing);
    // };
    // ```
    /** Closes the folder picker and selects the playing track's page when another page is selected. */
    val showPlayingFolder: () -> Unit = {
        pickerOpen = false
        /** Tab-order page of the playing track, or null when no track is playing. */
        val playingPage: Int? = controller.uiState.playingPageIndex
        if (playingPage != null && playingPage != controller.uiState.selectedPage) {
            Log.i(LOG_TAG, "player host reveal shows playing folder page=$playingPage")
            controller.selectPage(playingPage)
        }
    }

    // What:     `val revealPlayingTrack` shows the playing track's folder and asks its list to focus the row.
    // Why:      The picker replaces the list, and the playing track may sit in another folder, so the folder is
    //           selected first, without starting a track, and then the row can take focus. Ctrl+G and a tap on the
    //           deck's title both run it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const revealPlayingTrack = () => {
    //   showPlayingFolder(); bumpRevealToken();
    // };
    // ```
    /** Shows the playing track's folder, then focuses the playing row without starting a track. */
    val revealPlayingTrack: () -> Unit = {
        showPlayingFolder()
        revealToken += 1
    }

    // What:     `val revealPlayingFolder` shows the playing track's folder and asks its list to scroll to the folder.
    // Why:      A tap on the folder part of the deck heading runs it. The list scrolls to the subfolder header that
    //           holds the playing track, or to its top when the track sits directly in the folder, and no row takes
    //           focus.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const revealPlayingFolder = () => {
    //   showPlayingFolder(); bumpFolderRevealToken();
    // };
    // ```
    /** Shows the playing track's folder, then scrolls its list to the playing track's subfolder header. */
    val revealPlayingFolder: () -> Unit = {
        showPlayingFolder()
        folderRevealToken += 1
    }

    // What:     `val deckActions` routes the transport actions to the controller.
    // Why:      The player deck and the deck under the Search page send the same actions, and a tapped control
    //           returns focus to the playback area.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const deckActions = { onSeek: (s) => controller.seek(s), onPrevious: () => controller.prev(), ... };
    // ```
    /** Transport actions the player deck and the Search deck send to the controller. */
    val deckActions = TransportDeckActions(
        onSeek = { position -> controller.seek(position) },
        onPrevious = {
            controller.prev()
            returnFocusToPlayback()
        },
        onTogglePlay = {
            controller.togglePlay()
            returnFocusToPlayback()
        },
        onNext = {
            controller.next()
            returnFocusToPlayback()
        },
        onSelectMode = { mode ->
            controller.setPlaybackMode(mode)
            returnFocusToPlayback()
        },
        onRevealPlaying = revealPlayingTrack,
        onRevealFolder = revealPlayingFolder,
    )

    // What:     `val playerActions` routes the player screen's actions.
    // Why:      The folder picker, Settings, Search, and track rows act on the host or the controller.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const playerActions = { onSearch: () => go("search"), onSettings: () => go("settings"), ... };
    // ```
    /** Actions the player screen invokes, routed to the controller or to the host's own state. */
    val playerActions = PlayerContentActions(
        onToggleFolderPicker = {
            pickerOpen = !pickerOpen
            returnFocusToPlayback()
        },
        onSelectFolder = { folder ->
            selectFolder(folder)
            returnFocusToPlayback()
        },
        onOpen = onChooseFolder,
        onSettings = { go(PlayerRoute.Settings) },
        onPlay = { index ->
            controller.playIndex(index)
            returnFocusToPlayback()
        },
        deck = deckActions,
        onSearch = {
            query = ""
            go(PlayerRoute.Search)
        },
    )

    // What:     `val scope: CoroutineScope` runs the library reads and the file operations of the track actions.
    // Why:      The file work suspends, and the scope lets it finish off the main thread while the host keeps drawing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const scope = useCoroutineScope();
    // ```
    /** Coroutine scope of the host, which runs the track actions and the library reads they need. */
    val scope: CoroutineScope = rememberCoroutineScope()
    /** Media-library trash request launcher that the activity provides, or null when none is provided. */
    val mediaStoreTrash: TrashMediaStoreRequest? = LocalTrashMediaStoreRequest.current
    /** Track whose context menu is open, bound to its URI at open time, or null when no menu is open. */
    var menuTarget: TrackMenuTarget? by remember { mutableStateOf<TrackMenuTarget?>(null) }
    /** Window-space bounds of the row that opened the menu, or null when no row has reported its bounds. */
    var menuAnchor: MenuAnchorRect? by remember { mutableStateOf<MenuAnchorRect?>(null) }

    // What:     `fun openMenu(index: Int)` binds the menu to the track at a library index.
    // Why:      The track is read once here, so a later rescan that moves the index cannot redirect the action.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // openMenu(index: number): void { menuTarget = { indexInLibrary: index, track: library[index] }; }
    // ```
    /**
     * Opens the context menu for the track at the given library index, anchored to the row's window bounds, and
     * logs when the index is out of range.
     */
    fun openMenu(index: Int, anchor: MenuAnchorRect) {
        /** Track at the index in load order, or null when the index is out of range. */
        val track: Track? = controller.libraryTracks().getOrNull(index)
        if (track == null) {
            Log.w(LOG_TAG, "player host menu index out of range index=$index")
            return
        }
        Log.i(LOG_TAG, "player host menu opened index=$index")
        menuTarget = TrackMenuTarget(indexInLibrary = index, track = track)
        menuAnchor = anchor
    }

    // What:     `fun showFailure(failure: TrackActionFailure, name: String)` shows one failure in the overlay.
    // Why:      Every failure of a track action reaches the user through the same overlay message.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // showFailure(failure, name): void { feedback.showFeedback(trackActionFailureMessage(failure, name)); }
    // ```
    /** Shows the failure message for one track action in the feedback overlay. */
    fun showFailure(failure: TrackActionFailure, name: String) {
        feedback.showFeedback(trackActionFailureMessage(failure, name))
    }

    // What:     `fun attempt(name: String, block: () -> Unit)` runs one synchronous action and shows its failure.
    // Why:      The menu actions that do not move files throw TrackActionException, and this keeps the catch in one
    //           place.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function attempt(name: string, block: () => void): void { try { block(); } catch (e) { showFailure(e.failure,
    //   name); } }
    // ```
    /** Runs one track action, logging and showing its failure when it throws a track action exception. */
    fun attempt(name: String, block: () -> Unit) {
        try {
            block()
        } catch (expectedFailure: TrackActionException) {
            Log.w(LOG_TAG, "player host track action failed failure=${expectedFailure.failure}", expectedFailure)
            showFailure(expectedFailure.failure, name)
        }
    }

    // What:     `fun commitTrash(record: TrashRecord)` makes one trash the pending Undo and shows its message.
    // Why:      The record is stored before the message is shown, so the cleanup check always sees it as offered.
    //           A replaced record's copy is removed, because its Undo message is gone.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // commitTrash(record: TrashRecord): void { const old = store.replace(record); remove(old); show(undo(record)); }
    // ```
    /** Stores one trash as the pending Undo, removes the copy of any record it replaces, and shows its Undo message. */
    fun commitTrash(record: TrashRecord) {
        /** Record that this one replaces, whose Undo message is no longer offered. */
        val replaced: TrashRecord? = TrashUndoStore.replace(record)
        if (replaced != null) {
            Log.i(LOG_TAG, "player host replaced pending trash id=${replaced.id}")
            scope.launch(Dispatchers.IO) { removeCopy(replaced) }
        }
        feedback.showFeedback(trashUndoMessage(record))
        Log.i(LOG_TAG, "player host trash undo offered id=${record.id} route=${record.route.name}")
    }

    // What:     `suspend fun reconcile()` reloads the library and reconciles the controller with it.
    // Why:      A trashed track must leave the list, and a restored track must return to it, so the host rescans after
    //           each change.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // async function reconcile(): Promise<void> { controller.reconcileLibrary(await loadLibrary()); }
    // ```
    /** Reloads the library off the main thread, then reconciles the controller on the main thread. */
    suspend fun reconcile() {
        /** Tracks read from the current library after the change. */
        val tracks: List<Track> = withContext(Dispatchers.IO) { LibrarySource.load(context) }
        controller.reconcileLibrary(tracks)
        Log.i(LOG_TAG, "player host library reconciled tracks=${tracks.size}")
    }

    // What:     `suspend fun trashWithCopy(...)` runs the picked-folder trash and reports its outcome.
    // Why:      The copy-back needs the held grant, and any failure before the delete leaves the file where it was.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // async function trashWithCopy(target, tree): Promise<void> { ... }
    // ```
    /**
     * Trashes one picked-folder track through the copy route, then reconciles and offers Undo, or shows the failure.
     */
    suspend fun trashWithCopy(target: TrackMenuTarget, treeUri: Uri) {
        /** Unique key for this trash, which names its cache folder and its Undo message. */
        val id: String = UUID.randomUUID().toString()
        try {
            /** Trash record of the picked-folder trash, which the Undo message needs. */
            val record: TrashRecord = trashSaf(context = context, track = target.track, treeUri = treeUri, id = id)
            commitTrash(record)
            reconcile()
        } catch (expectedFailure: TrackActionException) {
            Log.w(LOG_TAG, "player host trash failed failure=${expectedFailure.failure}", expectedFailure)
            showFailure(expectedFailure.failure, trackFileNameOf(target.track.displayPath))
        }
    }

    // What:     `fun handleMediaStoreTrashResult(...)` decides what the system's trash answer means for the library.
    // Why:      A confirmed trash is checked against the trashed flag before the app offers Undo, because Android can
    //           report
    //           success before the item moves.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function handleTrashResult(track, accepted: boolean, uri): void { ... }
    // ```
    /** Offers Undo when the item is now trashed, shows a failure when it is not, and logs a declined confirmation. */
    fun handleMediaStoreTrashResult(track: Track, accepted: Boolean, uri: Uri) {
        /** Name of the track, used in any failure message. */
        val name: String = trackFileNameOf(track.displayPath)
        if (!accepted) {
            Log.i(LOG_TAG, "player host media store trash declined by user")
            return
        }
        if (isMediaStoreTrashed(context = context, uri = uri) != true) {
            Log.w(LOG_TAG, "player host media store trash accepted but item not trashed")
            showFailure(TrackActionFailure.MEDIASTORE_FAILED, name)
            return
        }
        commitTrash(
            TrashRecord(
                id = UUID.randomUUID().toString(),
                displayName = name,
                route = TrashRoute.MEDIASTORE_TRASH_REQUEST,
                trackUri = track.uri,
                treeUri = null,
                parentDocumentId = null,
                mimeType = mimeTypeFor(name),
                copyPath = null,
                sizeBytes = 0L,
            ),
        )
        scope.launch { reconcile() }
    }

    // What:     `fun trashInMediaStore(target: TrackMenuTarget)` starts Android's trash request for a media item.
    // Why:      The device-wide library has its own trash, so the app asks Android and waits for its result.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function trashInMediaStore(target: TrackMenuTarget): void { system.requestTrash(target.uri, onResult); }
    // ```
    /**
     * Launches Android's trash request for the media item, or shows a failure when no launcher or request is available.
     */
    fun trashInMediaStore(target: TrackMenuTarget) {
        /** Name of the track, used in any failure message. */
        val name: String = trackFileNameOf(target.track.displayPath)
        /** Launcher the activity registered for the media trash request, or null when none is provided. */
        val request: TrashMediaStoreRequest = mediaStoreTrash ?: run {
            Log.w(LOG_TAG, "player host has no media store trash launcher")
            showFailure(TrackActionFailure.MEDIASTORE_FAILED, name)
            return
        }
        /** URI of the media item to trash. */
        val uri: Uri = Uri.parse(target.track.uri)
        try {
            /** Pending intent of Android's trash request for this item. */
            val pending = mediaStoreRequest(context = context, uri = uri, trash = true)
            request.launch(pending.intentSender) { accepted ->
                handleMediaStoreTrashResult(track = target.track, accepted = accepted, uri = uri)
            }
        } catch (expectedFailure: TrackActionException) {
            Log.w(LOG_TAG, "player host media store trash could not start", expectedFailure)
            showFailure(expectedFailure.failure, name)
        }
    }

    // What:     `fun moveToTrash(target: TrackMenuTarget)` chooses the trash route for the target and runs it.
    // Why:      The route depends on the source of the track, so the decision is made here from the held grant.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function moveToTrash(target: TrackMenuTarget): void { switch (trashRouteFor(...)) { ... } }
    // ```
    /** Chooses the trash route of the target track from its URI and the held folder grant, then runs that route. */
    fun moveToTrash(target: TrackMenuTarget) {
        /** Name of the track, used in any failure message. */
        val name: String = trackFileNameOf(target.track.displayPath)
        /** Tree of the held folder grant, or null when no folder is held. */
        val heldTree: Uri? = LibraryRoot.heldRoot(context)
        /** Whether the held grant can still change files. */
        val writable: Boolean = writableGrantCovers(context = context, treeUri = heldTree)
        /** Route chosen for this track from its URI and the grant. */
        val route: TrashRoute = trashRouteFor(
            trackUri = target.track.uri,
            treeUri = heldTree?.toString(),
            writableGrant = writable,
        )
        Log.i(LOG_TAG, "player host trash route=${route.name} index=${target.indexInLibrary}")
        when (route) {
            TrashRoute.UNAVAILABLE -> showFailure(TrackActionFailure.ROUTE_UNAVAILABLE, name)
            TrashRoute.SAF_DELETE_WITH_COPY_BACK -> {
                if (heldTree == null) {
                    showFailure(TrackActionFailure.ROUTE_UNAVAILABLE, name)
                    return
                }
                scope.launch { trashWithCopy(target = target, treeUri = heldTree) }
            }
            TrashRoute.MEDIASTORE_TRASH_REQUEST -> trashInMediaStore(target)
        }
    }

    // What:     `fun handleMediaStoreRestoreResult(...)` reports the system restore answer and keeps Undo when it was
    //           declined.
    // Why:      A declined restore leaves the item in the system trash, so the Undo offer must come back rather than be
    //           lost.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function handleRestoreResult(original, restoring, accepted, uri): void { ... }
    // ```
    /** Finishes the restore as restored or failed, or re-offers Undo when the user declined the system confirmation. */
    fun handleMediaStoreRestoreResult(
        original: TrashRecord,
        restoring: TrashRecord,
        accepted: Boolean,
        uri: Uri,
    ) {
        if (!accepted) {
            Log.i(LOG_TAG, "player host media store restore declined, offering Undo again id=${original.id}")
            commitTrash(original)
            return
        }
        /** Whether the item left the system trash, or null when the flag cannot be read. */
        val stillTrashed: Boolean? = isMediaStoreTrashed(context = context, uri = uri)
        if (stillTrashed != false) {
            Log.w(LOG_TAG, "player host media store restore accepted but item still trashed id=${original.id}")
            restoring.finishRestore(restored = false)
            showFailure(TrackActionFailure.MEDIASTORE_RESTORE_FAILED, restoring.displayName)
            return
        }
        /** Restoring record, whose outcome is recorded once the restore answer arrives. */
        val finished: TrashRecord = restoring.finishRestore(restored = true)
        Log.i(LOG_TAG, "player host undo finished state=${finished.state.name} id=${original.id}")
        scope.launch { reconcile() }
    }

    // What:     `fun restoreInMediaStore(...)` starts Android's restore request for a media item in the system trash.
    // Why:      The system trash owns the restore, so the app asks Android and waits for its answer before it reports
    //           success.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function restoreInMediaStore(record: TrashRecord): void { system.requestRestore(record.uri, onResult); }
    // ```
    /** Launches Android's restore request for the trashed media item, and offers Undo again when the user declines. */
    fun restoreInMediaStore(original: TrashRecord, restoring: TrashRecord) {
        /** Launcher the activity registered for media requests, or null when none is provided. */
        val request: TrashMediaStoreRequest = mediaStoreTrash ?: run {
            Log.w(LOG_TAG, "player host has no media store restore launcher")
            showFailure(TrackActionFailure.MEDIASTORE_RESTORE_FAILED, restoring.displayName)
            return
        }
        /** URI of the trashed media item. */
        val uri: Uri = Uri.parse(restoring.trackUri)
        try {
            /** Pending intent of Android's restore request for this item. */
            val pending = mediaStoreRequest(context = context, uri = uri, trash = false)
            request.launch(pending.intentSender) { accepted ->
                handleMediaStoreRestoreResult(
                    original = original,
                    restoring = restoring,
                    accepted = accepted,
                    uri = uri,
                )
            }
        } catch (expectedFailure: TrackActionException) {
            Log.w(LOG_TAG, "player host media store restore could not start", expectedFailure)
            showFailure(TrackActionFailure.MEDIASTORE_RESTORE_FAILED, restoring.displayName)
        }
    }

    // What:     `suspend fun restoreFromCopy(...)` recreates a picked-folder file from its cache copy.
    // Why:      The copy is the only copy of the bytes, so a failed restore keeps it and says so.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // async function restoreFromCopy(original, restoring): Promise<void> { ... }
    // ```
    /** Restores one picked-folder file, reconciles the library on success, and shows the failure otherwise. */
    suspend fun restoreFromCopy(original: TrashRecord, restoring: TrashRecord) {
        try {
            restoreSaf(context = context, record = restoring)
            /** Restoring record, whose outcome is recorded once the restore finishes. */
            val finished: TrashRecord = restoring.finishRestore(restored = true)
            Log.i(LOG_TAG, "player host undo finished state=${finished.state.name} id=${original.id}")
            reconcile()
        } catch (expectedFailure: TrackActionException) {
            restoring.finishRestore(restored = false)
            Log.w(LOG_TAG, "player host undo failed failure=${expectedFailure.failure}", expectedFailure)
            showFailure(expectedFailure.failure, original.displayName)
        }
    }

    // What:     `fun startUndo(messageId: String)` runs the Undo of the pending trash whose message carries the id.
    // Why:      The record leaves the store before its restore starts, so the cleanup check cannot delete its copy
    //           mid-restore.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // startUndo(messageId: string): void { const record = store.takeForRestore(messageId); ... }
    // ```
    /** Takes the pending record whose message carries the id, dismisses its message, and runs its restore by route. */
    fun startUndo(messageId: String) {
        /** Pending record taken for the restore, or null when the id matches no pending Undo. */
        val original: TrashRecord = TrashUndoStore.takeForRestore(messageId) ?: run {
            Log.w(LOG_TAG, "player host undo ignored, no pending trash for id=$messageId")
            return
        }
        feedback.dismiss(messageId)
        /** The record in the restoring state, whose outcome is recorded once the restore finishes. */
        val restoring: TrashRecord = original.beginRestore()
        Log.i(LOG_TAG, "player host undo started id=${original.id} route=${original.route.name}")
        when (original.route) {
            TrashRoute.SAF_DELETE_WITH_COPY_BACK ->
                scope.launch { restoreFromCopy(original = original, restoring = restoring) }
            TrashRoute.MEDIASTORE_TRASH_REQUEST -> restoreInMediaStore(original = original, restoring = restoring)
            TrashRoute.UNAVAILABLE -> showFailure(TrackActionFailure.ROUTE_UNAVAILABLE, original.displayName)
        }
    }

    // What:     `fun reanalyseTrack(target: TrackMenuTarget)` measures one track again and reports the outcome.
    // Why:     The user asked for a fresh peak, so the notice shows while the file is read and the row updates when
    //           done.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // async function reanalyseTrack(target: TrackMenuTarget): Promise<void> { ... }
    // ```
    /**
     * Shows a re-analysing notice, measures the track again on the host scope, then publishes its measure or a failure.
     */
    fun reanalyseTrack(target: TrackMenuTarget) {
        /** Name of the track, used in the notice and any failure message. */
        val name: String = trackFileNameOf(target.track.displayPath)
        feedback.showFeedback(trackReanalysingMessage(name))
        scope.launch {
            /** New measure of the track, or null when the file could not be measured again. */
            val measure: TrackMeasure? = TrackMeasures.reanalyse(context = context, track = target.track)
            feedback.dismiss(TRACK_REANALYSE_ID)
            if (measure == null) {
                Log.w(LOG_TAG, "player host re-analysis failed index=${target.indexInLibrary}")
                showFailure(TrackActionFailure.REANALYSE_FAILED, name)
                return@launch
            }
            controller.mergeMeasures(mapOf(target.track.uri to measure))
            Log.i(LOG_TAG, "player host re-analysis published index=${target.indexInLibrary}")
        }
    }

    // What:     `fun runMenuAction(...)` routes one selected menu action to its implementation.
    // Why:      Each action has one owner, and the two file-moving actions run on the host's scope while the rest run
    //           here.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function runMenuAction(action: TrackMenuAction, target: TrackMenuTarget): void { switch (action) { ... } }
    // ```
    /** Runs the implementation of one selected menu action for the bound target track. */
    fun runMenuAction(action: TrackMenuAction, target: TrackMenuTarget) {
        Log.i(LOG_TAG, "player host menu action=${action.name} index=${target.indexInLibrary}")
        /** Name of the bound track, used in any failure message. */
        val name: String = trackFileNameOf(target.track.displayPath)
        when (action) {
            TrackMenuAction.PLAY -> controller.playIndex(target.indexInLibrary)
            TrackMenuAction.SHUFFLE_FROM_HERE ->
                shuffleFromHere(controller = controller, indexInLibrary = target.indexInLibrary)
            TrackMenuAction.DETAILS ->
                Log.i(LOG_TAG, "player host file details shown inline index=${target.indexInLibrary}")
            TrackMenuAction.REANALYSE_TRUE_PEAK -> reanalyseTrack(target)
            TrackMenuAction.SHOW_IN_FILE_MANAGER ->
                attempt(name) { showInFileManager(context = context, track = target.track) }
            TrackMenuAction.COPY_FILENAME -> attempt(name) { copyFilename(context = context, track = target.track) }
            TrackMenuAction.MOVE_TO_TRASH -> moveToTrash(target)
        }
    }

    // What:     `val visibleIds: Set<String>` holds the ids of the feedback messages shown this frame.
    // Why:      A pending trash whose message is gone has no Undo left, so its copy is released by the effect below.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const visibleIds = new Set(feedback.visible().map(m => m.id));
    // ```
    /** Ids of the feedback messages visible in this frame. */
    val visibleIds: Set<String> = feedback.queue.visible().map { message -> message.id }.toSet()
    // What:     `LaunchedEffect(visibleIds)` releases the pending trash when its Undo message is no longer visible.
    // Why:      Expiry, dismissal, and replacement all remove the message, and only then is the copy no longer needed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => { const dropped = store.dropIfHidden(visibleIds); if (dropped) remove(dropped); }, [visibleIds]);
    // ```
    LaunchedEffect(visibleIds) {
        /** Pending record whose message is gone, or null when its message is still visible or none is pending. */
        val dropped: TrashRecord? = TrashUndoStore.dropIfHidden(visibleIds)
        if (dropped != null) {
            Log.i(LOG_TAG, "player host undo expired, releasing copy id=${dropped.id}")
            withContext(Dispatchers.IO) { removeCopy(dropped) }
        }
    }
    // What:     `LaunchedEffect(Unit)` runs the startup sweep of earlier copies once per process.
    // Why:      Copies left by an earlier process have no Undo message, so they are removed before any new trash.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => { if (claimStartupSweep()) purge(); }, []);
    // ```
    LaunchedEffect(Unit) {
        if (TrashUndoStore.claimStartupSweep()) {
            withContext(Dispatchers.IO) { purgeTrashCopies(context) }
        }
    }

    // What:     `val keyLayout: HostKeyLayout` names the layout the screen draws at the current width.
    // Why:      Ctrl+O opens the folder picker only on the folded cover, so the keyboard rules need the layout.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const keyLayout = isCoverLayout(window.innerWidth) ? "folded-cover" : "unfolded";
    // ```
    /** Layout the screen draws at the current window width, which the keyboard rules read. */
    val keyLayout: HostKeyLayout = if (isCoverLayout(LocalConfiguration.current.screenWidthDp.toFloat())) {
        HostKeyLayout.FOLDED_COVER
    } else {
        HostKeyLayout.UNFOLDED
    }
    // What:     `val keyContext: HostKeyContext` is the host state that the keyboard rules read for this frame.
    // Why:      The owner, the route rules, the layout, and the mode cycle each need the route, popup, focus, and mode.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const keyContext = { route, menuOpen: menu != null, rootFocused, textFieldFocused, layout, mode };
    // ```
    /** Host state that the keyboard rules read for each key-down in this frame. */
    val keyContext = HostKeyContext(
        route = hostKeyRouteOf(route),
        menuOpen = menuTarget != null,
        textFieldFocused = (route == PlayerRoute.Search && searchFieldFocused) ||
            (route is PlayerRoute.TemplateEditor && templates.fieldFocused),
        rootFocused = rootFocused,
        playbackMode = state.playbackMode,
        layout = keyLayout,
    )

    // What:     `val keyActions: HostKeyActions` runs each keyboard command through its on-screen control's path.
    // Why:      A shortcut must do exactly what its button does, so each operation reuses that control's own call.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const keyActions = { togglePlayback: () => controller.togglePlay(), openSearch: () => go("search"), ... };
    // ```
    /** Host operations that the keyboard commands run, each through the same path as its on-screen control. */
    val keyActions: HostKeyActions = object : HostKeyActions {
        // What:     `override fun togglePlayback()` runs the deck's play and pause call.
        // Why:      Space and the deck's play button share one controller call.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // togglePlayback(): void { controller.togglePlay(); }
        // ```
        /** Plays or pauses the player, as the deck's play button does. */
        override fun togglePlayback() {
            controller.togglePlay()
        }

        // What:     `override fun previousTrack()` runs the deck's previous call.
        // Why:      The backward chord and the deck's previous button share one controller call.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // previousTrack(): void { controller.prev(); }
        // ```
        /** Moves to the previous track, as the deck's previous button does. */
        override fun previousTrack() {
            controller.prev()
        }

        // What:     `override fun nextTrack()` runs the deck's next call.
        // Why:      The forward chord and the deck's next button share one controller call.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // nextTrack(): void { controller.next(); }
        // ```
        /** Moves to the next track, as the deck's next button does. */
        override fun nextTrack() {
            controller.next()
        }

        // What:     `override fun cycleMode(mode: PlaybackMode)` runs the deck's mode call with the computed mode.
        // Why:      The mode segments and the chord both set the mode through the same controller call.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // cycleMode(mode: PlaybackMode): void { controller.setPlaybackMode(mode); }
        // ```
        /** Applies the end-of-track mode that the chord computed. */
        override fun cycleMode(mode: PlaybackMode) {
            controller.setPlaybackMode(mode)
        }

        // What:     `override fun openSearch()` starts a new Search visit with an empty query.
        // Why:      The Search button clears the query and opens Search, and the chord must do the same.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // openSearch(): void { setQuery(""); go("search"); }
        // ```
        /** Opens Search as a new visit with an empty query, as the Search button does. */
        override fun openSearch() {
            query = ""
            go(PlayerRoute.Search)
        }

        // What:     `override fun focusSearch()` asks the Search page to refocus its field without clearing it.
        // Why:      A repeated Search chord keeps the query, so only the focus moves.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // focusSearch(): void { searchFocusToken += 1; }
        // ```
        /** Asks the open Search page to refocus its query field, keeping the query text. */
        override fun focusSearch() {
            searchFocusToken += 1
        }

        // What:     `override fun toggleFolderPicker()` flips the picker flag, as the folder button does.
        // Why:      The picker button and the chord share one flag, so either one closes what the other opened.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // toggleFolderPicker(): void { setPickerOpen(!pickerOpen); }
        // ```
        /** Opens or closes the folder picker, as the folder button does. */
        override fun toggleFolderPicker() {
            pickerOpen = !pickerOpen
        }

        // What:     `override fun openSettings()` moves the host to the Settings route.
        // Why:      The Settings button and the chord move to the same destination.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // openSettings(): void { go("settings"); }
        // ```
        /** Opens the Settings page, as the Settings button does. */
        override fun openSettings() {
            go(PlayerRoute.Settings)
        }

        // What:     `override fun revealCurrent()` shows the playing track's folder and asks its list to focus the row.
        // Why:      The picker replaces the list, and the playing track may sit in another folder, so the folder is
        //           selected first, without starting a track, and then the row can take focus.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // revealCurrent(): void { setPickerOpen(false); if (page changed) selectPage(playing); bumpRevealToken(); }
        // ```
        /** Shows the playing track's folder, then focuses the playing row without starting a track. */
        override fun revealCurrent() {
            revealPlayingTrack()
        }

        // What:     `override fun backFromSearch()` leaves Search by the same route rule as the system Back button.
        // Why:      Escape and Back must lead to the same destination, so both call the one route rule.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // backFromSearch(): void { go(backFrom(route)); }
        // ```
        /** Leaves Search by the route rule that the system Back handler uses. */
        override fun backFromSearch() {
            go(PlayerRouteRules.backFrom(route))
        }

        // What:     `override fun closePopup()` clears the bound track so the menu closes.
        // Why:      The menu closes the same way when its dismiss callback runs.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // closePopup(): void { setMenuTarget(null); }
        // ```
        /** Closes the open track menu, as its dismiss callback does. */
        override fun closePopup() {
            menuTarget = null
        }
    }

    // What:     `val keyDispatcher: HostKeyDispatcher` runs the command that each consumed key-down resolves to.
    // Why:      The root keyboard modifier hands each command to this dispatcher, which calls the actions above.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const keyDispatcher = new HostKeyDispatcher(keyActions);
    // ```
    /** Runs the host command for each consumed key-down. */
    val keyDispatcher = HostKeyDispatcher(actions = keyActions)

    // What:     `val keyBinding: HostKeyBinding` joins the root requester, the host state, and the dispatcher.
    // Why:      The root modifier reads one binding per frame, so each key-down sees the current state.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const keyBinding = { focusRequester: rootRef, context: keyContext, dispatcher: keyDispatcher };
    // ```
    /** Focus requester, host state, and dispatcher that the root keyboard modifier reads. */
    val keyBinding = HostKeyBinding(
        focusRequester = rootFocusRequester,
        context = keyContext,
        dispatcher = keyDispatcher,
    )

    // What:     `LaunchedEffect(route, menuTarget == null)` gives focus to the playback area when the player shows.
    // Why:      Key events reach the host only along the focused path, so the root must hold focus on the player.
    //           It takes focus only when no control holds it, so buttons and rows keep their own focus, and it is
    //           declared before the page, so a page that asks for focus (the Search field) still wins.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => { if (route === "player" && !hostHasFocus) rootRef.focus(); }, [route, menuOpen]);
    // ```
    /** Requests focus for the playback area when the player is shown and no control holds focus. */
    LaunchedEffect(route, menuTarget == null) {
        if (route == PlayerRoute.Player && !hostHasFocus) {
            rootFocusRequester.requestFocus()
        }
    }

    BackHandler(enabled = route != PlayerRoute.Player) {
        go(PlayerRouteRules.backFrom(route))
    }

    // What:     `LaunchedEffect(nextExpiry)` waits until the earliest visible message is due and then expires it.
    // Why:      The effect restarts whenever the earliest expiry changes, so a shown or dismissed message is timed
    //           again.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // useEffect(() => { if (nextExpiry != null) feedback.expireAt(nextExpiry); }, [nextExpiry]);
    // ```
    /** Clock value at which the earliest visible message expires, or null when no message is visible. */
    val nextExpiry: Long? = feedback.queue.nextExpiryMs()
    LaunchedEffect(nextExpiry) {
        if (nextExpiry != null) {
            feedback.expireAt(nextExpiry)
        }
    }

    // Root of the player host: it holds the playback-area focus and the keyboard rules, and it provides the
    // Search refocus, reveal, and field-focus locals that the pages read.
    Box(
        modifier = Modifier
            .fillMaxSize()
            .onFocusChanged { focusState ->
                rootFocused = focusState.isFocused
                hostHasFocus = focusState.hasFocus
            }
            .hostKeyboard(binding = keyBinding),
    ) {
        CompositionLocalProvider(
            HostKeyLocalSearchFocus provides searchFocusToken,
            HostKeyLocalReveal provides revealToken,
            HostKeyLocalRevealFolder provides folderRevealToken,
            HostKeyLocalSearchField provides reportSearchFieldFocus,
        ) {
            when (route) {
                PlayerRoute.Player -> {
                    Box(modifier = Modifier.fillMaxSize()) {
                        if (firstRunContent != null) {
                            firstRunContent { go(PlayerRoute.Settings) }
                        } else {
                            CompositionLocalProvider(
                                LocalTrackRowMenuOpener provides { index, anchor -> openMenu(index, anchor) },
                            ) {
                                playerContent(model = model, pickerOpen = pickerOpen, actions = playerActions)
                            }
                            emptyNotice(state)
                        }
                        /** Start inset of the track menu: none on the folded cover, the inner-pane inset otherwise. */
                        val menuStartInset: Dp = if (keyLayout == HostKeyLayout.FOLDED_COVER) {
                            0.dp
                        } else {
                            TRACK_MENU_INNER_INSET
                        }
                        /** Track whose context menu is open in this frame, or null when no menu is shown. */
                        val openTarget: TrackMenuTarget? = menuTarget
                        if (openTarget != null) {
                            // The menu sits under the row it opened from, and the window origin stands in when no row
                            // has reported its bounds.
                            trackMenuPopup(
                                actions = trackMenuActionsFor(),
                                title = trackFileNameOf(openTarget.track.displayPath),
                                detailsValue = measureDetailsValue(state.measures[openTarget.track.uri]),
                                anchor = menuAnchor ?: MenuAnchorRect(left = 0, top = 0, right = 0, bottom = 0),
                                startInset = menuStartInset,
                                onSelect = { action ->
                                    menuTarget = null
                                    runMenuAction(action = action, target = openTarget)
                                },
                                onDismiss = { menuTarget = null },
                            )
                        }
                        // The feedback overlay floats at the bottom edge and never changes the layout beneath it.
                        // True-peak analysis shows no in-app indicator (D107): its progress is a system notification,
                        // so nothing here reserves space for it.
                        Column(modifier = Modifier.align(Alignment.BottomStart).fillMaxWidth()) {
                            /**
                             * Messages in display order, Undo above Error, drawn only while at least one is visible.
                             */
                            val messages: List<FeedbackMessage> = feedback.queue.visible()
                            if (messages.isNotEmpty()) {
                                feedbackOverlay(
                                    messages = messages,
                                    onDismiss = { id -> feedback.dismiss(id) },
                                    onAction = { id ->
                                        Log.i(LOG_TAG, "feedback action id=$id")
                                        startUndo(id)
                                    },
                                    modifier = Modifier.padding(
                                        start = PLAYER_HOST_FEEDBACK_INSET,
                                        end = PLAYER_HOST_FEEDBACK_INSET,
                                        bottom = PLAYER_HOST_FEEDBACK_INSET,
                                    ),
                                )
                            }
                        }
                    }
                }
                PlayerRoute.Search -> {
                    /**
                     * Library tracks in load order, rebuilt once per controller snapshot so each index is a load index.
                     */
                    val tracks: List<Track> = remember(state) { controller.libraryTracks() }
                    /** Search state for the typed query over the library tracks. */
                    val results: SearchState = remember(query, tracks) {
                        searchLibrary(query = query, tracks = tracks, available = true)
                    }
                    searchPage(
                        state = results,
                        query = query,
                        onQueryChange = { text -> query = text },
                        onBack = { go(PlayerRoute.Player) },
                        onClear = { query = "" },
                        onOpenResult = { result -> openSearchResult(result) },
                        currentTrackIndex = state.currentIndex,
                        deck = {
                            transportDeck(
                                model = model.deck,
                                actions = deckActions.copy(onRevealPlaying = null, onRevealFolder = null),
                            )
                        },
                        isPlaying = state.playing,
                        folderBrowser = { browserModifier ->
                            folderPickerPane(
                                sections = model.sections,
                                currentFolder = model.currentFolder,
                                onSelectFolder = { folder -> selectFolder(folder) },
                                modifier = browserModifier,
                            )
                        },
                    )
                }
                PlayerRoute.Settings -> settingsPageContent(
                    templateLines = editor.settingsLines,
                    onBack = { go(PlayerRoute.Player) },
                    onOpenTemplate = { kind -> openTemplate(kind) },
                )
                is PlayerRoute.TemplateEditor -> {
                    /**
                     * Editor view opened on the route's template, which differs from the stored editor after a restore.
                     */
                    val opened: TemplateEditorState = if (editor.kind == route.kind) editor else editor.open(route.kind)
                    templateEditor(
                        state = opened,
                        actions = TemplateEditorActions(
                            onEdit = { edit -> applyTemplateChange(opened.withEdit(edit)) },
                            onFocusChanged = { focused -> templates = opened.withFocus(focused) },
                            onInsertField = { mode -> applyTemplateChange(opened.insertField(mode)) },
                            onReset = { applyTemplateChange(opened.resetToDefault()) },
                            onBack = { go(PlayerRoute.Settings) },
                        ),
                    )
                }
            }
        }
    }
}
