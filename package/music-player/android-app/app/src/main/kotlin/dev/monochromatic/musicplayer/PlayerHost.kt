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

// What:     `import androidx.compose.ui.Alignment` aligns the feedback overlay and scan bar to the bottom start edge.
// Why:      The overlay stacks above the scan bar at the bottom of the player, and it never reflows the content.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Alignment } from "compose/ui";
// ```
import androidx.compose.ui.Alignment

// What:     `import androidx.compose.ui.unit.Dp` and `dp` size the feedback overlay inset.
// Why:      The overlay sits 16dp from the edges and from the scan bar, and the inset is a named constant.
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
import dev.monochromatic.musicplayer.core.PlayerHostModel
import dev.monochromatic.musicplayer.core.SearchActivation
import dev.monochromatic.musicplayer.core.SearchResult
import dev.monochromatic.musicplayer.core.SearchState
import dev.monochromatic.musicplayer.core.TemplateEditorState
import dev.monochromatic.musicplayer.core.TemplateKind
import dev.monochromatic.musicplayer.core.FeedbackMessage
import dev.monochromatic.musicplayer.core.ScanIndicatorModel
import dev.monochromatic.musicplayer.core.buildPlayerContent
import dev.monochromatic.musicplayer.core.scanIndicatorFor
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
// Why:      The feedback overlay keeps this inset from the start, end, and bottom edges, and from the scan bar.
//
// In TS you'd write (pseudocode):
// ```ts
// const PLAYER_HOST_FEEDBACK_INSET = 16; // dp
// ```
/** Inset between the feedback overlay and the start, end, and bottom edges of the player, and above the scan bar. */
private val PLAYER_HOST_FEEDBACK_INSET: Dp = 16.dp

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
 */
@Composable
fun playerHost(
    controller: PlayerController,
    feedback: FeedbackHostState,
    onChooseFolder: () -> Unit,
    emptyNotice: @Composable (PlayerUiState) -> Unit = {},
    firstRunContent: (@Composable (onSettings: () -> Unit) -> Unit)? = null,
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
        currentIndex = state.currentIndex,
        playing = state.playing,
        mode = state.playbackMode,
        positionSec = playbackProgress.position,
        durationSec = playbackProgress.duration,
    )
    /** Player model with the saved track-row and playing-track templates applied. */
    val model: PlayerContentModel = PlayerHostModel.contentWithTemplates(
        base = builtModel,
        pageItems = state.pageItems,
        currentIndex = state.currentIndex,
        durationSec = playbackProgress.duration,
        trackRowsTemplate = templates.lastValid.getValue(TemplateKind.TRACK_ROWS),
        playingTemplate = templates.lastValid.getValue(TemplateKind.PLAYING_TRACK),
    )
    /** Editor view with the preview drawn from the selected page, for Settings and the editor. */
    val editor: TemplateEditorState = PlayerHostModel.editorWithPreview(templates, state.pageItems)

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

    // What:     `val deckActions` routes the transport actions to the controller.
    // Why:      The player deck and the deck under the Search page send the same actions.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const deckActions = { onSeek: (s) => controller.seek(s), onPrevious: () => controller.prev(), ... };
    // ```
    /** Transport actions the player deck and the Search deck send to the controller. */
    val deckActions = TransportDeckActions(
        onSeek = { position -> controller.seek(position) },
        onPrevious = { controller.prev() },
        onTogglePlay = { controller.togglePlay() },
        onNext = { controller.next() },
        onSelectMode = { mode -> controller.setPlaybackMode(mode) },
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
        onToggleFolderPicker = { pickerOpen = !pickerOpen },
        onSelectFolder = { folder -> selectFolder(folder) },
        onOpen = onChooseFolder,
        onSettings = { go(PlayerRoute.Settings) },
        onPlay = { index -> controller.playIndex(index) },
        deck = deckActions,
        onSearch = {
            query = ""
            go(PlayerRoute.Search)
        },
    )

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

    when (route) {
        PlayerRoute.Player -> {
            /**
             * Scan indicator for this frame, idle while the first-run pane holds the screen because no sweep runs then.
             */
            val scanModel: ScanIndicatorModel = scanIndicatorFor(
                loading = state.loading && firstRunContent == null,
                measured = SweepProgress.snapshot.done,
                total = SweepProgress.snapshot.total,
            )
            Box(modifier = Modifier.fillMaxSize()) {
                if (firstRunContent != null) {
                    firstRunContent { go(PlayerRoute.Settings) }
                } else {
                    playerContent(model = model, pickerOpen = pickerOpen, actions = playerActions)
                    emptyNotice(state)
                }
                // The overlay and the scan bar share one bottom column, so the overlay sits above the bar and
                // neither one changes the layout of the player beneath.
                Column(modifier = Modifier.align(Alignment.BottomStart).fillMaxWidth()) {
                    /** Messages in display order, Undo above Error, drawn only while at least one is visible. */
                    val messages: List<FeedbackMessage> = feedback.queue.visible()
                    if (messages.isNotEmpty()) {
                        feedbackOverlay(
                            messages = messages,
                            onDismiss = { id -> feedback.dismiss(id) },
                            onAction = { id -> Log.i(LOG_TAG, "feedback action id=$id") },
                            modifier = Modifier.padding(
                                start = PLAYER_HOST_FEEDBACK_INSET,
                                end = PLAYER_HOST_FEEDBACK_INSET,
                                bottom = PLAYER_HOST_FEEDBACK_INSET,
                            ),
                        )
                    }
                    scanIndicator(model = scanModel, modifier = Modifier.fillMaxWidth())
                }
            }
        }
        PlayerRoute.Search -> {
            /** Library tracks in load order, rebuilt once per controller snapshot so each index is a load index. */
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
                deck = { transportDeck(model = model.deck, actions = deckActions) },
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
            /** Editor view opened on the route's template, which differs from the stored editor after a restore. */
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
