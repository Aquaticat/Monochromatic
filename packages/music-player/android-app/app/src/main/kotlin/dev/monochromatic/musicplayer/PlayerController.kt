// ============================================================================
// File summary (folds in the old KDoc that sat on `class PlayerController`)
// ============================================================================
//
// This file is the BRAIN. `PlayerController` orchestrates the queue,
// pagination, shuffle/scope, and transport on top of an `AudioEngine`,
// mirroring the desktop's controller. It owns the ported `Queue` and the
// paginated view, drives the engine to play the current track, follows the
// playing track's page, and advances on a natural end. The state the UI renders
// is exposed as the Compose-observable `uiState`; position/duration are read
// live via `positionSec`/`durationSec`. It is created and called on the main
// thread.
//
// One thing to keep in mind as a TS reader: `uiState` is a PROPERTY-DELEGATED
// Compose state (the `by mutableStateOf(...)` line). Reading it gives the
// current snapshot; assigning a new snapshot makes the UI recompose. Treat it
// as a reactive signal/ref whose get/set are transparent.
// ============================================================================

// What:     `package dev.monochromatic.musicplayer` names the namespace this brain
//           lives in, reachable elsewhere as
//           `dev.monochromatic.musicplayer.PlayerController`.
// Why:      So the service, the UI, and `BrainPlayer` can refer to it.
//
// In TS you'd write (pseudocode):
// ```ts
// // No `package` line in TS; the file path is the module identity.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.util.Log` pulls in `Log`, Android's logger.
// Why:      We log when a track ends and we advance.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util";
// ```
import android.util.Log

// What:     `import androidx.compose.runtime.getValue` imports the `getValue` OPERATOR
//           function. It is what makes the `by mutableStateOf(...)` property DELEGATION
//           READABLE: when a property is delegated with `by`, reading it calls the
//           delegate's `getValue`, and that operator must be in scope.
// Why:      The `uiState` property below uses `by`, so reading `uiState` needs this
//           import to resolve.
//
// In TS you'd write (pseudocode):
// ```ts
// // no import — TS getters don't need an operator function in scope
// ```
import androidx.compose.runtime.getValue

// What:     `import androidx.compose.runtime.mutableStateOf` imports `mutableStateOf(x)`,
//           the Compose factory that creates an OBSERVABLE state holder seeded with `x`.
//           When its value changes, any Compose UI that read it recomposes.
// Why:      `uiState` is delegated to a `mutableStateOf(...)` so the screen re-renders
//           when the brain swaps in a new snapshot.
//
// In TS you'd write (pseudocode):
// ```ts
// import { signal } from "@reactive/core"; // mutableStateOf(x) ~ signal(x)
// ```
import androidx.compose.runtime.mutableStateOf

// What:     `import androidx.compose.runtime.setValue` imports the `setValue` OPERATOR
//           function, the WRITE counterpart of `getValue`: assigning to a `by`-delegated
//           property calls the delegate's `setValue`, and that operator must be in scope.
// Why:      We ASSIGN new snapshots to `uiState`, which (because of `by`) needs this
//           import to resolve.
//
// In TS you'd write (pseudocode):
// ```ts
// // no import — TS setters don't need an operator function in scope
// ```
import androidx.compose.runtime.setValue

// What:     `import dev.monochromatic.musicplayer.core.Page` imports the `Page` type from
//           the `.core` package: one browsable tab (a label plus its entries).
// Why:      `pages` is a `List<Page>`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Page } from "./core/Page";
// ```
import dev.monochromatic.musicplayer.core.Page

// What:     `import dev.monochromatic.musicplayer.core.Queue` imports the ported `Queue`
//           type (the play queue: ordered tracks plus a cursor, with shuffle/repeat).
// Why:      The controller owns a `Queue`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Queue } from "./core/Queue";
// ```
import dev.monochromatic.musicplayer.core.Queue

// What:     `import dev.monochromatic.musicplayer.core.Session` imports the pure
//           "where the user left off" model (selected track + settings + position).
// Why:      `currentSession` returns one and `applySettings`/`finishLoad` take one, so the
//           service can persist and restore via `SessionStore`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Session } from "./core/Session";
// ```
import dev.monochromatic.musicplayer.core.Session

// What:     `import dev.monochromatic.musicplayer.core.ShuffleMode` imports the
//           three-value enum `ShuffleMode` (`OFF`/`WITHIN_PAGE`/`ALL`).
// Why:      `setShuffle` takes a `ShuffleMode`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ShuffleMode } from "./core/ShuffleMode";
// ```
import dev.monochromatic.musicplayer.core.ShuffleMode

// What:     `import dev.monochromatic.musicplayer.core.pageOfIndex` imports the
//           `pageOfIndex(pages, index)` FUNCTION: returns the page position holding a
//           load-order index, or null.
// Why:      `refresh` uses it to follow the current track's page.
//
// In TS you'd write (pseudocode):
// ```ts
// import { pageOfIndex } from "./core/Pagination";
// ```
import dev.monochromatic.musicplayer.core.pageOfIndex

// What:     `import dev.monochromatic.musicplayer.core.paginate` imports the
//           `paginate(names)` FUNCTION that groups display strings into `Page`s.
// Why:      `openLibrary` paginates the queue's display paths.
//
// In TS you'd write (pseudocode):
// ```ts
// import { paginate } from "./core/Pagination";
// ```
import dev.monochromatic.musicplayer.core.paginate

// What:     `class PlayerController(private val engine: AudioEngine) { ... }` declares a
//           class with a PRIMARY CONSTRUCTOR. `private val engine: AudioEngine` is a
//           constructor parameter that is ALSO a private read-only PROPERTY (the `val`
//           on a constructor param is Kotlin shorthand for "store this argument as a
//           field"); `private` hides it outside the class.
// Why:      The controller drives the concrete `AudioEngine` it is handed; storing it as a
//           private field lets every method reach it.
//
// In TS you'd write (pseudocode):
// ```ts
// class PlayerController {
//   constructor(private readonly engine: AudioEngine) {}
//   // ...state and methods below...
// }
// ```
/**
 * Defines player controller type for this music-player component; the TypeScript-oriented notes above explain
 * its role.
 */
class PlayerController(private val engine: AudioEngine) {
    // What:     `private val queue: Queue = Queue.new()` declares a private read-only
    //           field `queue`, built by the FACTORY `Queue.new()` (a companion-object
    //           function on `Queue`, not a constructor; no `new` keyword in Kotlin).
    // Why:      The controller owns one play queue seeded from the wall clock.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly queue: Queue = Queue.new();
    // ```
    /**
     * Defines queue value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private val queue: Queue = Queue.new()
    // What:     `private var pages: List<Page> = emptyList()` declares a private,
    //           REASSIGNABLE (`var`) field of read-only list type `List<Page>` (sibling
    //           `MutableList<Page>`), initialised to the shared empty list `emptyList()`.
    // Why:      The current paginated view; replaced wholesale on each load.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private pages: readonly Page[] = [];
    // ```
    /**
     * Defines pages value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private var pages: List<Page> = emptyList()
    // What:     `private var loadedUri: String? = null` declares a private, reassignable
    //           field of NULLABLE `String?` (the trailing `?` = "a `String` OR null"),
    //           initialised `null`.
    // Why:      The content URI of the track currently loaded in the engine, or null when
    //           nothing is loaded; lets `togglePlay` tell "resume" from "load and play".
    //           Deliberately the URI (a STABLE identity), NOT a load-order index: a live
    //           rescan re-derives the queue from disk, so the same track's index shifts.
    //           Keying on the URI survives that shift, where a stored index would silently
    //           point at the wrong track after `reconcileLibrary`. (Desktop's
    //           "reselect by identity, not index" decision, applied to Android URIs.)
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private loadedUri: string | null = null;
    // ```
    /**
     * Defines loaded uri value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private var loadedUri: String? = null
    // What:     `private var isPlaying: Boolean = false` declares a private, reassignable
    //           boolean field, initialised `false`.
    // Why:      Mirrors the engine's playing state for the UI snapshot.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private isPlaying: boolean = false;
    // ```
    /**
     * Defines is playing value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private var isPlaying: Boolean = false

    // What:     `private var isLoading: Boolean = true` declares a private, reassignable
    //           boolean field initialised `true`.
    // Why:      Whether a library load or folder scan is in flight. It STARTS true because
    //           the owning service begins loading as soon as it creates this controller,
    //           so the screen shows a loading notice from the first frame instead of
    //           flashing the empty-library message; `openLibrary` clears it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private isLoading: boolean = true;
    // ```
    /**
     * Defines is loading value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private var isLoading: Boolean = true

    // What:     `private var uris: List<String> = emptyList()` declares a private,
    //           reassignable read-only `List<String>` field, initialised empty.
    // Why:      Playback URIs aligned by load-order index with the display paths fed to
    //           `queue`; the queue never reorders its track list (shuffle permutes a
    //           separate index list), so `uris[index]` is always the URI for the track the
    //           queue reports at that load-order index.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private uris: readonly string[] = [];
    // ```
    /**
     * Defines uris value for this music-player component; the TypeScript-oriented notes above explain its source
     * and use.
     */
    private var uris: List<String> = emptyList()

    // What:     `var uiState: PlayerUiState by mutableStateOf(PlayerUiState(loading = true))`
    //           declares a PROPERTY whose storage is DELEGATED, via the `by` keyword, to a
    //           Compose `mutableStateOf(...)` holder. With `by`, reading `uiState` runs the
    //           delegate's `getValue` (the imported operator) to fetch the current value,
    //           and ASSIGNING `uiState = x` runs the delegate's `setValue` to store `x` AND
    //           trigger Compose recomposition. The initial value is
    //           `PlayerUiState(loading = true)` (a constructor call with the `loading`
    //           named argument).
    // Why:      It is the Compose-observable snapshot the screen renders; reassigning it by
    //           `refresh` is what repaints the UI. Seeding `loading = true` makes the first
    //           frame show the loading notice.
    // Gotcha:   `by` is PROPERTY DELEGATION, not assignment: `uiState` has no plain backing
    //           field; every get/set goes through the `mutableStateOf` holder. This is why
    //           `getValue`/`setValue` are imported at the top.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly _uiState = signal<PlayerUiState>(makePlayerUiState({ loading: true }));
    // get uiState(): PlayerUiState { return this._uiState.value; }
    // // (setter is restricted to this class — see `private set` below)
    // ```
    /**
     * Defines ui state value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    var uiState: PlayerUiState by mutableStateOf(PlayerUiState(loading = true))
        // What:     `private set` restricts the SETTER of `uiState` to this class while the
        //           GETTER stays public. It is written on its own indented line directly
        //           under the property. There is no setter BODY; `private` just narrows
        //           visibility of the (delegated) setter.
        // Why:      Outside code may READ `uiState` (the UI does) but only the controller
        //           may REPLACE it, so the brain stays the single writer.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private set uiState(v: PlayerUiState) { this._uiState.value = v; }
        // ```
        private set

    // What:     `var onStateChanged: (() -> Unit)? = null` declares a public, reassignable
    //           field whose type is a NULLABLE FUNCTION TYPE: `(() -> Unit)` is "a function
    //           taking no args and returning `Unit` (void)", and the outer `?` makes the
    //           whole thing nullable (a function OR null). Initialised `null`.
    // Why:      Invoked at the end of every `refresh` so a `MediaSession` projection
    //           (`BrainPlayer`) can re-pull its state on a discontinuity. Left null when no
    //           session is attached; the callback must POST `invalidateState` to the looper
    //           rather than run it synchronously, since some refreshes happen inside a
    //           player command.
    // Gotcha:   The parentheses matter: `(() -> Unit)?` is a nullable function; `() -> Unit?`
    //           would be a function returning a nullable `Unit` (a different type).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // onStateChanged: (() => void) | null = null;
    // ```
    /**
     * Defines on state changed value for this music-player component; the TypeScript-oriented notes above
     * explain its source and use.
     */
    var onStateChanged: (() -> Unit)? = null

    // What:     `var onPersist: (() -> Unit)? = null` declares a SECOND public, reassignable
    //           nullable no-arg callback, initialised `null`.
    // Why:      Invoked alongside `onStateChanged` at the end of every `refresh` so the
    //           service can persist the session (selected track + settings + position) on
    //           any meaningful change. It is SEPARATE from `onStateChanged` because that one
    //           is already owned by `BrainPlayer` (the MediaSession projection); a single
    //           callback cannot serve both, and overwriting `onStateChanged` would freeze the
    //           MediaSession. Left null when no persister is attached.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // onPersist: (() => void) | null = null;
    // ```
    /**
     * Defines on persist value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    var onPersist: (() -> Unit)? = null

    // What:     `init { ... }` is Kotlin's INITIALIZER BLOCK: code that runs once as part
    //           of constructing every instance, after the field initializers above. It has
    //           no method name.
    // Why:      Wire the engine's callbacks (playing-changed and track-ended) at
    //           construction so the controller reacts to engine events.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // (inside the constructor body)
    // ```
    init {
        // What:     `engine.setOnPlayingChanged { playing -> ... }` registers a callback by
        //           passing a TRAILING LAMBDA. `{ playing -> ... }` is the lambda; its
        //           single parameter `playing` (a `Boolean`) is named before `->`. Because
        //           the lambda is the last (only) argument, Kotlin lets it sit outside the
        //           parentheses.
        // Why:      Keep `isPlaying` in sync with the engine and repaint when it flips.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.engine.setOnPlayingChanged((playing) => {
        //   this.isPlaying = playing;
        //   this.refresh();
        // });
        // ```
        engine.setOnPlayingChanged { playing ->
            // What:     `isPlaying = playing` stores the engine's new playing flag into the
            //           field.
            // Why:      Record the play/pause change for the next snapshot.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.isPlaying = playing;
            // ```
            isPlaying = playing
            // What:     `refresh()` rebuilds `uiState` from the queue and pages.
            // Why:      Repaint the UI with the new playing state.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.refresh();
            // ```
            refresh()
        }
        // What:     `engine.setOnTrackEnded { ... }` registers a no-argument trailing-lambda
        //           callback for when a track finishes on its own.
        // Why:      A natural end should advance the queue and play the next track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.engine.setOnTrackEnded(() => {
        //   Log.i(LOG_TAG, "track ended; advancing");
        //   this.queue.advance(true);
        //   this.playCurrent();
        // });
        // ```
        engine.setOnTrackEnded {
            // What:     `Log.i(LOG_TAG, "track ended; advancing")` logs the natural end.
            // Why:      Trace auto-advance for verification.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info(`[${LOG_TAG}] track ended; advancing`);
            // ```
            Log.i(LOG_TAG, "track ended; advancing")
            // What:     `queue.advance(natural = true)` advances the queue, passing the
            //           `natural` argument by NAME as `true` (a natural end honours
            //           "repeat track").
            // Why:      Move to the next track (or replay under repeat-track) on a natural
            //           end.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.queue.advance(true);
            // ```
            queue.advance(natural = true)
            // What:     `playCurrent()` loads and plays the queue's now-current track.
            // Why:      Actually start whatever `advance` selected.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.playCurrent();
            // ```
            playCurrent()
        }
    }

    // What:     `fun beginLoad() { ... }` declares a public method, block body, returning
    //           `Unit`.
    // Why:      Mark a library load as in progress so the screen shows a loading notice
    //           instead of the empty-library message while a source scan runs. The owning
    //           service calls this before launching a (possibly slow) query or folder scan;
    //           `openLibrary` clears it on delivery.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // beginLoad(): void { this.isLoading = true; this.refresh(); }
    // ```
    /**
     * Defines begin load behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    fun beginLoad() {
        // What:     `isLoading = true` sets the loading flag.
        // Why:      Tell the next snapshot a scan is running.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.isLoading = true;
        // ```
        isLoading = true
        // What:     `refresh()` rebuilds the snapshot so the loading notice shows now.
        // Why:      Repaint immediately with the loading state.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.refresh();
        // ```
        refresh()
    }

    // What:     `fun openLibrary(tracks: List<Track>) { ... }` declares a public method
    //           taking a read-only `List<Track>` (load order), block body, `Unit` return.
    // Why:      Replace the library with `tracks`: keep their playback URIs in `uris`, feed
    //           their display paths to the queue (whose pagination trims the shared root
    //           and groups by folder, exactly as on the desktop), repaginate, and show the
    //           first page without starting playback (Android is tap-to-play). Clears the
    //           loading state, since this is a load's delivery.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // openLibrary(tracks: readonly Track[]): void { ... }
    // ```
    /**
     * Defines open library behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    fun openLibrary(tracks: List<Track>) {
        // What:     `uris = tracks.map { it.uri }` reassigns `uris`. `tracks.map { ... }`
        //           builds a new list by transforming each element; the trailing lambda
        //           `{ it.uri }` uses `it`, Kotlin's IMPLICIT name for a single-parameter
        //           lambda's argument (here one `Track`), and reads its `uri`.
        // Why:      Keep the playback URIs aligned by load-order index with the queue.
        // Gotcha:   `it` is the auto-named single lambda parameter; there is no `it` keyword
        //           in TS, so you name the arrow parameter explicitly.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.uris = tracks.map((t) => t.uri);
        // ```
        uris = tracks.map { it.uri }
        // What:     `queue.setTracks(tracks.map { it.displayPath })` feeds the queue the
        //           display paths. `tracks.map { it.displayPath }` maps each `Track` to its
        //           `displayPath` (the implicit `it` again).
        // Why:      The queue paginates on display paths (folder grouping), like the
        //           desktop.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.setTracks(tracks.map((t) => t.displayPath));
        // ```
        queue.setTracks(tracks.map { it.displayPath })
        // What:     `queue.clearSelection()` drops the cursor that `setTracks` anchored on the
        //           first track, so no track is current.
        // Why:      Disable auto-selecting a track: a freshly opened library highlights nothing
        //           until the user taps a row (Android is tap-to-play).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.clearSelection();
        // ```
        queue.clearSelection()
        // What:     `pages = paginate(queue.displayPaths())` reassigns `pages` from the
        //           paginator over the queue's display paths.
        // Why:      Rebuild the page tabs for the new library.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pages = paginate(this.queue.displayPaths());
        // ```
        pages = paginate(queue.displayPaths())
        // What:     `loadedUri = null` clears the loaded-track URI.
        // Why:      Nothing is loaded in the engine yet for the new library.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.loadedUri = null;
        // ```
        loadedUri = null
        // What:     `isLoading = false` clears the loading flag.
        // Why:      The load has been delivered, so the empty-library message (if any) is
        //           now meaningful.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.isLoading = false;
        // ```
        isLoading = false
        // What:     `refresh(followCurrent = true)` rebuilds the snapshot, passing
        //           `followCurrent` by NAME as `true` (switch the visible page to the
        //           current track's page).
        // Why:      Show the first page and the current row after a load.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.refresh(true);
        // ```
        refresh(followCurrent = true)
    }

    // What:     `private fun currentUri(): String? = queue.currentIndex()?.let { uris[it] }`
    //           declares a private helper returning the current track's content URI, or null,
    //           expression body.
    //           - `queue.currentIndex()` is the current load-order index (or null).
    //           - `?.let { uris[it] }` runs only when non-null, mapping the index through the
    //             parallel `uris` list; null short-circuits to null.
    // Why:      The engine is keyed by URI (a stable identity), so "is the current track the
    //           one loaded?" and "what should the session save as selected?" both need the
    //           current URI, not its shifting index.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private currentUri(): string | null {
    //   const i = this.queue.currentIndex();
    //   return i === null ? null : this.uris[i];
    // }
    // ```
    /**
     * Defines current uri behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    private fun currentUri(): String? = queue.currentIndex()?.let { uris[it] }

    // What:     `fun currentSession(): Session { ... }` declares a public method returning a
    //           snapshot of the persistable state as a `core.Session`, expression body.
    // Why:      The service calls this to persist via `SessionStore`: the selected track URI,
    //           the live resume position, and the settings. The Source Root is NOT included
    //           (Android re-resolves it each launch via `LibrarySource`).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // currentSession(): Session {
    //   return makeSession({
    //     selected: this.currentUri(),
    //     positionSecs: this.engine.positionSec(),
    //     volume: this.uiState.volume,
    //     shuffle: this.queue.shuffleMode(),
    //     repeatTrack: this.queue.repeatTrack(),
    //   });
    // }
    // ```
    /**
     * Defines current session behavior for this music-player component; the TypeScript-oriented notes above
     * explain its call shape and effects.
     */
    fun currentSession(): Session = Session(
        selected = currentUri(),
        positionSecs = engine.positionSec(),
        volume = uiState.volume,
        shuffle = queue.shuffleMode(),
        repeatTrack = queue.repeatTrack(),
    )

    // What:     `fun applySettings(session: Session) { ... }` declares a public method taking a
    //           saved session, block body, `Unit` return.
    // Why:      The settings-only half of the old `restoreLibrary`, applied EARLY (before the
    //           streaming load starts) so shuffle, repeat, and volume are correct from the first
    //           frame and serve as the baseline the user can override mid-load. This is safe to
    //           apply before any tracks exist and before the terminal track load because: volume
    //           is a persistent gain on the engine that a later `engine.load` does not reset, and
    //           shuffle is a stored mode field the queue re-reads on every `setTracks`/`playIndex`,
    //           so setting the mode on an empty queue still yields the correct scope once tracks
    //           arrive.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // applySettings(session) {
    //   this.queue.setRepeatTrack(session.repeatTrack);
    //   this.queue.setShuffle(session.shuffle);
    //   this.engine.setVolume(session.volume);
    //   this.uiState = { ...this.uiState, volume: session.volume };
    // }
    // ```
    /**
     * Defines apply settings behavior for this music-player component; the TypeScript-oriented notes above
     * explain its call shape and effects.
     */
    fun applySettings(session: Session) {
        // What:     `queue.setRepeatTrack(session.repeatTrack)` then `queue.setShuffle(session.shuffle)`
        //           store the saved settings in the queue's mode fields.
        // Why:      Restore the user's shuffle/repeat choices up front; the queue re-reads these
        //           when tracks later arrive, so the eventual scope is correct.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.setRepeatTrack(session.repeatTrack); this.queue.setShuffle(session.shuffle);
        // ```
        queue.setRepeatTrack(session.repeatTrack)
        queue.setShuffle(session.shuffle)
        // What:     `engine.setVolume(session.volume)` applies the saved gain to the engine.
        // Why:      Restore the user's volume from the first frame; this persistent gain survives
        //           the terminal `engine.load`, so applying it early is safe.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.engine.setVolume(session.volume);
        // ```
        engine.setVolume(session.volume)
        // What:     `uiState = uiState.copy(volume = session.volume)` reassigns `uiState` to a copy
        //           with the saved volume (via the data-class `copy` + the Compose delegate).
        // Why:      Make the slider match the engine immediately; `beginLoad`'s following `refresh`
        //           carries this volume into the loading snapshot.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.uiState = { ...this.uiState, volume: session.volume };
        // ```
        uiState = uiState.copy(volume = session.volume)
    }

    // What:     `private fun restoreSelectedTrack(tracks: List<Track>, session: Session) { ... }`
    //           declares a PRIVATE method taking the full scanned library and the saved session,
    //           block body, `Unit` return.
    // Why:      The track-only half of the old `restoreLibrary`: adopt the full track set, reselect
    //           the saved track BY URI if it still exists, and cue it PAUSED at the saved position.
    //           It deliberately does NOT touch settings (those were applied early by `applySettings`
    //           and the user may have changed them during the load), and it clears `isLoading`
    //           because this is the load's terminal delivery. Re-scanning and reselecting by
    //           identity IS the restore auto-correction: a moved/removed saved track simply fails
    //           the URI lookup and leaves nothing selected.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private restoreSelectedTrack(tracks, session) {
    //   this.uris = tracks.map((t) => t.uri);
    //   this.queue.setTracks(tracks.map((t) => t.displayPath));
    //   this.pages = paginate(this.queue.displayPaths());
    //   this.loadedUri = null; this.isLoading = false;
    //   const i = session.selected ? this.uris.indexOf(session.selected) : -1;
    //   if (i >= 0) { this.queue.playIndex(i); this.loadedUri = this.uris[i]; this.engine.load(this.uris[i], false); if
    //   (session.positionSecs > 0) this.engine.seekTo(session.positionSecs); }
    //   else this.queue.clearSelection();
    //   this.refresh(true);
    // }
    // ```
    /**
     * Defines restore selected track behavior for this music-player component; the TypeScript-oriented notes
     * above explain its call shape and effects.
     */
    private fun restoreSelectedTrack(tracks: List<Track>, session: Session) {
        // What:     `uris = tracks.map { it.uri }` and `queue.setTracks(tracks.map { it.displayPath })`
        //           adopt the full scanned tracks: URIs in `uris`, display paths into the queue's
        //           pagination. `setTracks` re-reads the shuffle mode set earlier, so the scope is
        //           correct.
        // Why:      Rebuild the library from the authoritative full list once the scan finishes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.uris = tracks.map((t) => t.uri); this.queue.setTracks(tracks.map((t) => t.displayPath));
        // ```
        uris = tracks.map { it.uri }
        queue.setTracks(tracks.map { it.displayPath })
        // What:     `pages = paginate(queue.displayPaths())` rebuilds the page tabs; `loadedUri = null`
        //           and `isLoading = false` reset load state and clear the loading flag.
        // Why:      Fresh pagination for the full library; nothing loaded yet; the scan is now
        //           delivered, so the spinner gate must release.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pages = paginate(this.queue.displayPaths()); this.loadedUri = null; this.isLoading = false;
        // ```
        pages = paginate(queue.displayPaths())
        loadedUri = null
        isLoading = false
        // What:     `val savedIndex: Int = session.selected?.let { uris.indexOf(it) } ?: -1`
        //           locates the saved track's URI in the full scan, or `-1`.
        //           - `session.selected?.let { uris.indexOf(it) }` runs `indexOf` only when a
        //             selection was saved; `?: -1` covers both "nothing saved" and "not found".
        // Why:      Reselect by stable identity; a moved/removed track is simply not found.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const savedIndex = session.selected ? this.uris.indexOf(session.selected) : -1;
        // ```
        /**
         * Defines saved index value for this music-player component; the TypeScript-oriented notes above explain
         * its source and use.
         */
        val savedIndex: Int = session.selected?.let { uris.indexOf(it) } ?: -1
        // What:     `if (savedIndex >= 0) { ... } else { queue.clearSelection() }` branches on
        //           whether the saved track survived.
        // Why:      Reselect and cue it paused if present; otherwise leave nothing selected (the
        //           restore auto-correction for a vanished track).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (savedIndex >= 0) { ... } else { this.queue.clearSelection(); }
        // ```
        if (savedIndex >= 0) {
            // What:     `queue.playIndex(savedIndex)` selects the saved track (building its scope),
            //           then `loadedUri = uris[savedIndex]` and `engine.load(uris[savedIndex], play = false)`
            //           cue it WITHOUT playing.
            // Why:      Resume where the user left off, paused (Android is tap-to-play; restore must
            //           not auto-start audio).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.queue.playIndex(savedIndex); this.loadedUri = this.uris[savedIndex];
            // this.engine.load(this.uris[savedIndex], false);
            // ```
            queue.playIndex(savedIndex)
            loadedUri = uris[savedIndex]
            engine.load(uris[savedIndex], play = false)
            // What:     `if (session.positionSecs > 0.0) { engine.seekTo(session.positionSecs) }`
            //           seeks to the saved position when it is past the start.
            // Why:      Resume mid-track; skip a needless seek to 0. (The engine applies this seek
            //           on its worker thread shortly after; the service deliberately does not save
            //           during this branch, so the on-disk position is not overwritten with 0 in the
            //           meantime.)
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (session.positionSecs > 0) this.engine.seekTo(session.positionSecs);
            // ```
            if (session.positionSecs > 0.0) {
                engine.seekTo(session.positionSecs)
            }
        } else {
            // What:     `queue.clearSelection()` leaves nothing selected.
            // Why:      No saved selection, or the saved track is gone.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.queue.clearSelection();
            // ```
            queue.clearSelection()
        }
        // What:     `refresh(followCurrent = true)` rebuilds the snapshot, switching to the restored
        //           track's page (named arg `followCurrent = true`). Note: NO `uiState.copy(volume)`
        //           here, because settings (including volume) were applied early and may have been
        //           changed by the user during the load.
        // Why:      Reflect the restored selection in the UI without re-stamping the settings.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.refresh(true);
        // ```
        refresh(followCurrent = true)
    }

    // What:     `fun finishLoad(tracks: List<Track>, session: Session): FinishLoadResult { ... }`
    //           declares a public method taking the full scanned library and the saved session,
    //           returning a `FinishLoadResult` tag, block body.
    // Why:      The terminal step of a streaming cold-start load. Because the list was interactive
    //           while it filled in, there are two outcomes: if the user tapped a track during the
    //           load, KEEP that choice and only adopt the full list; otherwise reselect the saved
    //           track and seek to the saved position. The returned tag tells the service which
    //           path ran so it can persist correctly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // finishLoad(tracks, session): FinishLoadResult {
    //   if (this.loadedUri !== null) {
    //     this.isLoading = false;
    //     this.reconcileLibrary(tracks);
    //     return "KeptUserSelectionDuringLoad";
    //   }
    //   this.restoreSelectedTrack(tracks, session);
    //   return "RestoredSavedSession";
    // }
    // ```
    /**
     * Defines finish load behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    fun finishLoad(tracks: List<Track>, session: Session): FinishLoadResult {
        // What:     `if (loadedUri != null) { ... }` tests whether a track is loaded in the engine,
        //           which on a cold start means "the user tapped a row while it was loading."
        // Why:      That tap must win over the saved track; we keep it and just grow the list.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.loadedUri !== null) { ... }
        // ```
        if (loadedUri != null) {
            // What:     `isLoading = false` clears the loading flag BEFORE the reconcile, because
            //           `reconcileLibrary` does not touch it; without this an empty terminal would
            //           stay stuck on the spinner.
            // Why:      Release the spinner gate as part of this terminal delivery.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.isLoading = false;
            // ```
            isLoading = false
            // What:     `reconcileLibrary(tracks)` adopts the full list while preserving the tapped
            //           track by URI (it is present, since a tappable row was already discovered) and
            //           leaving the engine playing.
            // Why:      Grow to the complete library without disturbing the user's mid-load choice.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.reconcileLibrary(tracks);
            // ```
            reconcileLibrary(tracks)
            // What:     `return FinishLoadResult.KeptUserSelectionDuringLoad` returns the kept-tap
            //           tag. `FinishLoadResult.KeptUserSelectionDuringLoad` reads a named constant
            //           off the enum type (the `.` selects an enum member, not a method call).
            // Why:      Tell the service this path ran so it saves immediately (the tapped track's
            //           position is already real).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return "KeptUserSelectionDuringLoad";
            // ```
            return FinishLoadResult.KeptUserSelectionDuringLoad
        }
        // What:     `restoreSelectedTrack(tracks, session)` runs the no-tap path: reselect the saved
        //           track, seek to the saved position, and clear `isLoading`.
        // Why:      With nothing tapped, restore where the user left off.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.restoreSelectedTrack(tracks, session);
        // ```
        restoreSelectedTrack(tracks, session)
        // What:     `return FinishLoadResult.RestoredSavedSession` returns the no-tap tag (a named
        //           enum constant).
        // Why:      Tell the service this path ran so it does NOT save immediately (the engine has
        //           not applied the async seek yet, so saving now would write position 0).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return "RestoredSavedSession";
        // ```
        return FinishLoadResult.RestoredSavedSession
    }

    // What:     `fun reconcileLibrary(tracks: List<Track>) { ... }` declares a public method
    //           taking a freshly-scanned library, block body, `Unit` return.
    // Why:      The live-update path (the desktop "Rescan" analog), driven by the app coming to
    //           the foreground. It re-derives the queue from the fresh scan while PRESERVING the
    //           currently-loaded track by URI and NOT restarting playback: if the playing track
    //           still exists, it re-points the cursor to it (engine untouched, audio keeps
    //           playing); if it is gone, it stops (pause) and clears the selection.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // reconcileLibrary(tracks) {
    //   const playingUri = this.loadedUri;
    //   this.uris = tracks.map((t) => t.uri);
    //   this.queue.setTracks(tracks.map((t) => t.displayPath));
    //   this.pages = paginate(this.queue.displayPaths());
    //   const i = playingUri ? this.uris.indexOf(playingUri) : -1;
    //   if (i >= 0) this.queue.playIndex(i);
    //   else { if (playingUri) this.engine.pause(); this.loadedUri = null; this.queue.clearSelection(); }
    //   this.refresh(true);
    // }
    // ```
    /**
     * Defines reconcile library behavior for this music-player component; the TypeScript-oriented notes above
     * explain its call shape and effects.
     */
    fun reconcileLibrary(tracks: List<Track>) {
        // What:     `val playingUri: String? = loadedUri` snapshots the loaded URI BEFORE the
        //           track list is replaced.
        // Why:      It is the identity to preserve across the rescan.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const playingUri = this.loadedUri;
        // ```
        /**
         * Defines playing uri value for this music-player component; the TypeScript-oriented notes above explain
         * its source and use.
         */
        val playingUri: String? = loadedUri
        // What:     `uris = tracks.map { it.uri }`, `queue.setTracks(tracks.map { it.displayPath })`,
        //           `pages = paginate(queue.displayPaths())` adopt the fresh scan and repaginate.
        //           Note: NO `beginLoad()`/`isLoading`, so the UI does not flash a loading state
        //           on a routine foreground rescan.
        // Why:      Re-derive the queue from what is on disk now.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.uris = tracks.map((t) => t.uri); this.queue.setTracks(tracks.map((t) => t.displayPath)); this.pages =
        // paginate(this.queue.displayPaths());
        // ```
        uris = tracks.map { it.uri }
        queue.setTracks(tracks.map { it.displayPath })
        pages = paginate(queue.displayPaths())
        // What:     `val newIndex: Int = playingUri?.let { uris.indexOf(it) } ?: -1` finds the
        //           preserved track's NEW load-order index in the fresh scan, or `-1`.
        // Why:      The same track may sit at a different index after the rescan; locate it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const newIndex = playingUri ? this.uris.indexOf(playingUri) : -1;
        // ```
        /**
         * Defines new index value for this music-player component; the TypeScript-oriented notes above explain
         * its source and use.
         */
        val newIndex: Int = playingUri?.let { uris.indexOf(it) } ?: -1
        // What:     `if (newIndex >= 0) { queue.playIndex(newIndex) } else { ... }` branches on
        //           whether the playing track survived.
        // Why:      Survives -> re-point the cursor/scope to it WITHOUT touching the engine, so
        //           playback continues uninterrupted (this is why we call `queue.playIndex`, not
        //           `this.playIndex`/`playCurrent`, which would reload). Gone -> stop and clear.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (newIndex >= 0) this.queue.playIndex(newIndex); else { ... }
        // ```
        if (newIndex >= 0) {
            // What:     `queue.playIndex(newIndex)` re-points the cursor/scope to the same track
            //           (under shuffle this resets the cycle at it, the accepted reset). The
            //           engine and `loadedUri` are left untouched, so the audio keeps playing.
            // Why:      Preserve the selection by identity without restarting playback.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.queue.playIndex(newIndex);
            // ```
            queue.playIndex(newIndex)
        } else {
            // What:     `if (playingUri != null) { engine.pause() }` stops playback when a
            //           previously-loaded track has vanished. There is no `engine.stop()`, so
            //           `pause()` is the stop analog (the stale decoder sits paused, harmless).
            // Why:      The "stop + clear selection" behavior when the playing track is gone.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (playingUri !== null) this.engine.pause();
            // ```
            if (playingUri != null) {
                engine.pause()
            }
            // What:     `loadedUri = null` then `queue.clearSelection()` clear the loaded track
            //           and the cursor.
            // Why:      Nothing is loaded or selected after the playing track vanished (or when
            //           nothing was playing and the list just changed).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.loadedUri = null; this.queue.clearSelection();
            // ```
            loadedUri = null
            queue.clearSelection()
        }
        // What:     `refresh(followCurrent = true)` rebuilds the snapshot from the reconciled
        //           queue, switching to the (preserved or cleared) current track's page.
        // Why:      Repaint the live-updated list and selection.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.refresh(true);
        // ```
        refresh(followCurrent = true)
    }

    // What:     `fun playIndex(index: Int) { ... }` declares a public method taking a
    //           load-order `Int` index, block body, `Unit` return.
    // Why:      Load and play the track at load-order index `index` (a tap on a non-current
    //           row).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // playIndex(index: number): void { this.queue.playIndex(index); this.playCurrent(); }
    // ```
    /**
     * Defines play index behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    fun playIndex(index: Int) {
        // What:     `queue.playIndex(index)` selects that track in the queue (switching
        //           scope if it is on another page).
        // Why:      Make the tapped track current.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.playIndex(index);
        // ```
        queue.playIndex(index)
        // What:     `playCurrent()` loads and plays the now-current track.
        // Why:      Start playback of the tapped track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.playCurrent();
        // ```
        playCurrent()
    }

    // What:     `fun seekToScopeIndex(scopeIndex: Int, positionSec: Double = 0.0) { ... }`
    //           declares a public method with two params, the second having a DEFAULT VALUE
    //           (`= 0.0`): callers may omit `positionSec` and it defaults to `0.0` (a 64-bit
    //           `Double`; sibling `Float` is 32-bit). Block body, `Unit` return.
    // Why:      Move to scope position `scopeIndex` (a `MediaSession` timeline window index
    //           the framework computed for Next/Previous or a queue-item jump) and play it;
    //           an out-of-range index does nothing, matching the framework's no-op. When
    //           `positionSec` is positive the new track starts there instead of at 0.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // seekToScopeIndex(scopeIndex: number, positionSec: number = 0): void { ... }
    // ```
    /**
     * Defines seek to scope index behavior for this music-player component; the TypeScript-oriented notes above
     * explain its call shape and effects.
     */
    fun seekToScopeIndex(scopeIndex: Int, positionSec: Double = 0.0) {
        // What:     `if (queue.moveCursorTo(scopeIndex) == null) { return }`. `moveCursorTo`
        //           returns `Int?` (the now-current index, or null for out-of-range);
        //           `== null` tests that; `return` bails out (returning `Unit`).
        // Why:      An out-of-range target moves nothing, so we exit early.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.queue.moveCursorTo(scopeIndex) === null) return;
        // ```
        if (queue.moveCursorTo(scopeIndex) == null) {
            // What:     `return` exits the method early (bare `return`, `Unit`).
            // Why:      Nothing to play for an out-of-range index.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return;
            // ```
            return
        }
        // What:     `playCurrent()` loads and plays the newly-current track.
        // Why:      Start the track the cursor moved to.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.playCurrent();
        // ```
        playCurrent()
        // What:     `if (positionSec > 0.0) { engine.seekTo(positionSec) }` seeks within the
        //           new track only when a positive start position was requested.
        // Why:      An external controller may seek to a specific item AND position; honour
        //           the position when given.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (positionSec > 0) this.engine.seekTo(positionSec);
        // ```
        if (positionSec > 0.0) {
            // What:     `engine.seekTo(positionSec)` moves the playhead to `positionSec`
            //           seconds.
            // Why:      Start the new track at the requested offset.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.engine.seekTo(positionSec);
            // ```
            engine.seekTo(positionSec)
        }
    }

    // What:     `fun togglePlay() { ... }` declares a public method, block body, `Unit`.
    // Why:      Toggle play/pause: pause if playing, resume the loaded track, else load and
    //           play the current track.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // togglePlay(): void { ... }
    // ```
    /**
     * Defines toggle play behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    fun togglePlay() {
        // What:     `if (isPlaying) { ... } else if (loadedUri != null && loadedUri == currentUri()) { ... } else { ...
        //           }`
        //           is an if / else-if / else CHAIN. `loadedUri != null` is a null check;
        //           `&&` is logical AND; `loadedUri == currentUri()` compares the URI loaded
        //           in the engine to the current track's URI (both `String?`; `==` is
        //           null-safe value equality). Comparing URIs, not indices, keeps "is the
        //           current track already loaded?" correct after a rescan shifts indices.
        // Why:      Three cases: currently playing -> pause; the current track is already
        //           loaded -> resume; otherwise -> load and play.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.isPlaying) this.engine.pause();
        // else if (this.loadedUri !== null && this.loadedUri === this.currentUri()) this.engine.play();
        // else this.playCurrent();
        // ```
        if (isPlaying) {
            // What:     `engine.pause()` pauses playback.
            // Why:      We were playing; the toggle pauses.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.engine.pause();
            // ```
            engine.pause()
        } else if (loadedUri != null && loadedUri == currentUri()) {
            // What:     `engine.play()` resumes the already-loaded track.
            // Why:      The current track is loaded, so just resume it (no reload).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.engine.play();
            // ```
            engine.play()
        } else {
            // What:     `playCurrent()` loads and plays the current track.
            // Why:      Nothing relevant is loaded, so load and play from scratch.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.playCurrent();
            // ```
            playCurrent()
        }
        // What:     `refresh()` rebuilds the snapshot after the play/pause change.
        // Why:      Repaint the play/pause icon.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.refresh();
        // ```
        refresh()
    }

    // What:     `fun setPlayWhenReady(play: Boolean) { ... }` declares a public method
    //           taking a `Boolean`, block body, `Unit`.
    // Why:      Set the play intent EXPLICITLY (the `MediaSession`'s play/pause command and
    //           the system media buttons): resume/start the current track, or pause it.
    //           Unlike `togglePlay` the caller names the target state, so a duplicate
    //           command (pause while already paused) is a safe no-op.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setPlayWhenReady(play: boolean): void { ... }
    // ```
    /**
     * Defines set play when ready behavior for this music-player component; the TypeScript-oriented notes above
     * explain its call shape and effects.
     */
    fun setPlayWhenReady(play: Boolean) {
        // What:     `if (play) { ... } else { engine.pause() }` branches on the requested
        //           intent: play vs pause.
        // Why:      Apply exactly the named state.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (play) { ... } else { this.engine.pause(); }
        // ```
        if (play) {
            // What:     `if (loadedUri != null && loadedUri == currentUri()) { engine.play() } else { playCurrent() }`
            //           is the same "already-loaded?" check as in `togglePlay`: resume if
            //           the current track's URI is the one loaded, else load and play.
            // Why:      Resume cheaply when possible; otherwise load and play. URI identity
            //           (not index) survives a rescan reshuffling the load order.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (this.loadedUri !== null && this.loadedUri === this.currentUri()) this.engine.play();
            // else this.playCurrent();
            // ```
            if (loadedUri != null && loadedUri == currentUri()) {
                // What:     `engine.play()` resumes the loaded track.
                // Why:      The current track is already loaded.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.engine.play();
                // ```
                engine.play()
            } else {
                // What:     `playCurrent()` loads and plays the current track.
                // Why:      The current track is not loaded, so load and play.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.playCurrent();
                // ```
                playCurrent()
            }
        } else {
            // What:     `engine.pause()` pauses playback.
            // Why:      The named intent is "pause".
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.engine.pause();
            // ```
            engine.pause()
        }
        // What:     `refresh()` rebuilds the snapshot after the intent change.
        // Why:      Repaint to reflect the new play/pause state.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.refresh();
        // ```
        refresh()
    }

    // What:     `fun next() { ... }` declares a public method, block body, `Unit`.
    // Why:      Skip to the next track in scope and play it (user pressed Next).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // next(): void { this.queue.advance(false); this.playCurrent(); }
    // ```
    /**
     * Defines next behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    fun next() {
        // What:     `queue.advance(natural = false)` advances the queue with the `natural`
        //           argument by NAME as `false` (a manual Next does NOT honour repeat-track).
        // Why:      Move forward one track on an explicit Next.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.advance(false);
        // ```
        queue.advance(natural = false)
        // What:     `playCurrent()` loads and plays the next track.
        // Why:      Start whatever `advance` selected.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.playCurrent();
        // ```
        playCurrent()
    }

    // What:     `fun prev() { ... }` declares a public method, block body, `Unit`.
    // Why:      Skip to the previous track in scope and play it (user pressed Prev).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // prev(): void { this.queue.prev(); this.playCurrent(); }
    // ```
    /**
     * Defines prev behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    fun prev() {
        // What:     `queue.prev()` moves the cursor to the previous track in scope.
        // Why:      Step backward on an explicit Prev.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.prev();
        // ```
        queue.prev()
        // What:     `playCurrent()` loads and plays the previous track.
        // Why:      Start the track `prev` selected.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.playCurrent();
        // ```
        playCurrent()
    }

    // What:     `fun setShuffle(mode: ShuffleMode) { ... }` declares a public method taking
    //           a `ShuffleMode` enum, block body, `Unit`.
    // Why:      Change shuffle/scope, keeping the current track current.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setShuffle(mode: ShuffleMode): void { this.queue.setShuffle(mode); this.refresh(); }
    // ```
    /**
     * Defines set shuffle behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    fun setShuffle(mode: ShuffleMode) {
        // What:     `queue.setShuffle(mode)` applies the new shuffle/scope mode in the queue.
        // Why:      Change the mode while keeping the playing track current.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.setShuffle(mode);
        // ```
        queue.setShuffle(mode)
        // What:     `refresh()` rebuilds the snapshot after the mode change.
        // Why:      Repaint the shuffle radios and any reordering.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.refresh();
        // ```
        refresh()
    }

    // What:     `fun setRepeatTrack(on: Boolean) { ... }` declares a public method taking a
    //           `Boolean`, block body, `Unit`.
    // Why:      Toggle "repeat track".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setRepeatTrack(on: boolean): void { this.queue.setRepeatTrack(on); this.refresh(); }
    // ```
    /**
     * Defines set repeat track behavior for this music-player component; the TypeScript-oriented notes above
     * explain its call shape and effects.
     */
    fun setRepeatTrack(on: Boolean) {
        // What:     `queue.setRepeatTrack(on)` stores the repeat-track flag in the queue.
        // Why:      Record the new repeat-track state.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.setRepeatTrack(on);
        // ```
        queue.setRepeatTrack(on)
        // What:     `refresh()` rebuilds the snapshot after the toggle.
        // Why:      Repaint the repeat-track checkbox.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.refresh();
        // ```
        refresh()
    }

    // What:     `fun selectPage(page: Int) { ... }` declares a public method taking an `Int`
    //           page index, block body, `Unit`.
    // Why:      Show a different page tab without moving playback.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // selectPage(page: number): void { ... }
    // ```
    /**
     * Defines select page behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    fun selectPage(page: Int) {
        // What:     `if (page in pages.indices) { ... }` uses Kotlin's `in` operator for
        //           RANGE MEMBERSHIP: `pages.indices` is the `0 until pages.size` range, and
        //           `page in <range>` tests whether `page` is a valid index.
        // Why:      Only switch to a real page; ignore out-of-range requests.
        // Gotcha:   `page in pages.indices` is RANGE membership, NOT JS's `key in object`
        //           property check.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (page >= 0 && page < this.pages.length) {
        //   this.uiState = { ...this.uiState, selectedPage: page, pageItems: this.pages[page].entries };
        // }
        // ```
        if (page in pages.indices) {
            // What:     `uiState = uiState.copy(selectedPage = page, pageItems = pages[page].entries)`
            //           reassigns `uiState` to a near-duplicate built by `copy(...)`. `.copy`
            //           is the data-class method that returns a NEW value with the named
            //           fields replaced (here `selectedPage` and `pageItems`) and all others
            //           kept. Assigning goes through the Compose delegate (recompose).
            // Why:      Change only the visible page and its rows, leaving playback alone.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.uiState = { ...this.uiState, selectedPage: page, pageItems: this.pages[page].entries };
            // ```
            uiState = uiState.copy(selectedPage = page, pageItems = pages[page].entries)
        }
    }

    // What:     `fun seek(positionSec: Double) { ... }` declares a public method taking a
    //           `Double` seconds value, block body, `Unit`.
    // Why:      Seek within the current track.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // seek(positionSec: number): void { this.engine.seekTo(positionSec); }
    // ```
    /**
     * Defines seek behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    fun seek(positionSec: Double) {
        // What:     `engine.seekTo(positionSec)` moves the playhead within the current track.
        // Why:      Scrub to the requested position.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.engine.seekTo(positionSec);
        // ```
        engine.seekTo(positionSec)
    }

    // What:     `fun setVolume(volume: Float) { ... }` declares a public method taking a
    //           `Float` gain (32-bit; sibling `Double` is 64-bit, but the audio API works in
    //           32-bit floats), block body, `Unit`.
    // Why:      Set the output gain.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setVolume(volume: number): void { ... }
    // ```
    /**
     * Defines set volume behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    fun setVolume(volume: Float) {
        // What:     `engine.setVolume(volume)` applies the gain to the engine.
        // Why:      Change the actual output level.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.engine.setVolume(volume);
        // ```
        engine.setVolume(volume)
        // What:     `uiState = uiState.copy(volume = volume)` reassigns `uiState` to a copy
        //           with the new `volume` (via the data-class `copy` + the Compose delegate).
        // Why:      Reflect the new volume in the UI snapshot without rebuilding everything.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.uiState = { ...this.uiState, volume };
        // ```
        uiState = uiState.copy(volume = volume)
    }

    // What:     `fun positionSec(): Double = engine.positionSec()` declares a public method
    //           returning a `Double`, as an EXPRESSION body that returns the engine's
    //           current position.
    // Why:      Live playback position for the seek bar.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // positionSec(): number { return this.engine.positionSec(); }
    // ```
    /**
     * Defines position sec behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    fun positionSec(): Double = engine.positionSec()

    // What:     `fun durationSec(): Double = engine.durationSec()` declares a public method
    //           returning a `Double`, expression body, returning the engine's track
    //           duration (0.0 when unknown).
    // Why:      Live track duration for the seek bar.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // durationSec(): number { return this.engine.durationSec(); }
    // ```
    /**
     * Defines duration sec behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    fun durationSec(): Double = engine.durationSec()

    // What:     `fun snapshot(): PlaybackSnapshot { ... }` declares a public method, block
    //           body, returning a `PlaybackSnapshot`.
    // Why:      Point-in-time view of the current scope and transport for the `MediaSession`
    //           projection (`BrainPlayer`). The scope's tracks are reported in playback
    //           order so the session's framework-computed Next/Previous matches this queue;
    //           position and duration are sampled here and extrapolated by the session
    //           between pulls.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // snapshot(): PlaybackSnapshot { ... }
    // ```
    /**
     * Defines snapshot behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    fun snapshot(): PlaybackSnapshot {
        // What:     `val order: List<Int> = queue.playbackOrder()` declares a read-only
        //           `List<Int>` local `order`: the current scope's load-order indices in
        //           playback order.
        // Why:      The timeline reports tracks in this order.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const order: readonly number[] = this.queue.playbackOrder();
        // ```
        /**
         * Defines order value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val order: List<Int> = queue.playbackOrder()
        // What:     `val display: List<String> = queue.displayPaths()` declares a read-only
        //           `List<String>` local `display`: the per-track display strings in load
        //           order.
        // Why:      We title each timeline row with the track's display path.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const display: readonly string[] = this.queue.displayPaths();
        // ```
        /**
         * Defines display value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val display: List<String> = queue.displayPaths()
        // What:     `val items: List<SnapshotItem> = order.map { loadIndex -> SnapshotItem(...) }`
        //           builds the timeline rows. `order.map { ... }` transforms each element;
        //           the trailing lambda names its parameter `loadIndex` (a load-order index)
        //           before `->`. `SnapshotItem(uri = ..., title = ..., loadIndex = ...)` is a
        //           constructor call with NAMED arguments: `uris[loadIndex]` is the playback
        //           URI, `display[loadIndex]` the title, `loadIndex` the index itself.
        // Why:      Produce one `SnapshotItem` per scope track for the session timeline.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const items: SnapshotItem[] = order.map((loadIndex) => ({
        //   uri: this.uris[loadIndex],
        //   title: display[loadIndex],
        //   loadIndex,
        // }));
        // ```
        /**
         * Defines items value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val items: List<SnapshotItem> = order.map { loadIndex ->
            // What:     `SnapshotItem(uri = uris[loadIndex], title = display[loadIndex], loadIndex = loadIndex)`
            //           constructs one timeline item (no `new`) with named args. It is the
            //           lambda's tail expression, so it is the value `map` collects.
            // Why:      One scope track described for the session.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // ({ uri: this.uris[loadIndex], title: display[loadIndex], loadIndex })
            // ```
            SnapshotItem(uri = uris[loadIndex], title = display[loadIndex], loadIndex = loadIndex)
        }
        // What:     `return PlaybackSnapshot( ... )` constructs and returns the snapshot with
        //           NAMED arguments. Two of them convert seconds to milliseconds:
        //           `(durationSec() * MILLIS_PER_SEC).toLong()` multiplies a `Double` by the
        //           `Double` constant `1000.0` (real division/multiplication), then
        //           `.toLong()` truncates to a 64-bit `Long` (milliseconds). Same for
        //           `positionMs`.
        // Why:      Hand the session a complete, immutable picture of scope + transport, with
        //           position/duration in the milliseconds the framework expects.
        // Gotcha:   `.toLong()` TRUNCATES toward zero (drops the fraction), it does not
        //           round; `Double * Double` is float math, then the cast narrows to `Long`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return {
        //   items,
        //   currentIndex: this.queue.cursorPosition(),
        //   playWhenReady: this.engine.playWhenReady(),
        //   volume: this.uiState.volume,
        //   durationMs: Math.trunc(this.durationSec() * MILLIS_PER_SEC),
        //   positionMs: Math.trunc(this.positionSec() * MILLIS_PER_SEC),
        // };
        // ```
        return PlaybackSnapshot(
            // What:     `items = items` passes the built timeline rows by name.
            // Why:      The snapshot's track list.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // items,
            // ```
            items = items,
            // What:     `currentIndex = queue.cursorPosition()` passes the current scope
            //           position (an `Int?`) by name.
            // Why:      Which timeline row is current.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // currentIndex: this.queue.cursorPosition(),
            // ```
            currentIndex = queue.cursorPosition(),
            // What:     `playWhenReady = engine.playWhenReady()` passes the engine's play
            //           intent (a `Boolean`) by name.
            // Why:      The notification's play/pause state follows this.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // playWhenReady: this.engine.playWhenReady(),
            // ```
            playWhenReady = engine.playWhenReady(),
            // What:     `volume = uiState.volume` passes the current gain by name.
            // Why:      Informational volume for external surfaces.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // volume: this.uiState.volume,
            // ```
            volume = uiState.volume,
            // What:     `durationMs = (durationSec() * MILLIS_PER_SEC).toLong()` converts the
            //           duration seconds to a `Long` milliseconds (multiply by 1000.0, then
            //           `.toLong()` truncates).
            // Why:      media3 reports durations in milliseconds.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // durationMs: Math.trunc(this.durationSec() * MILLIS_PER_SEC),
            // ```
            durationMs = (durationSec() * MILLIS_PER_SEC).toLong(),
            // What:     `positionMs = (positionSec() * MILLIS_PER_SEC).toLong()` converts the
            //           position seconds to a `Long` milliseconds (same multiply + truncate).
            // Why:      media3 reports positions in milliseconds.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // positionMs: Math.trunc(this.positionSec() * MILLIS_PER_SEC),
            // ```
            positionMs = (positionSec() * MILLIS_PER_SEC).toLong(),
        )
    }

    // What:     `fun currentScopeIndex(): Int? = queue.cursorPosition()` declares a public
    //           method returning a NULLABLE `Int?`, expression body, returning the queue's
    //           cursor position directly.
    // Why:      Current scope position (timeline window index), cheaply, without building a
    //           full `snapshot`; the `MediaSession` projection uses it to tell an in-place
    //           seek from a jump to another track. Null when the queue is empty.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // currentScopeIndex(): number | null { return this.queue.cursorPosition(); }
    // ```
    /**
     * Defines current scope index behavior for this music-player component; the TypeScript-oriented notes above
     * explain its call shape and effects.
     */
    fun currentScopeIndex(): Int? = queue.cursorPosition()

    // What:     `fun release() { ... }` declares a public method, block body, `Unit`.
    // Why:      Release the underlying engine.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // release(): void { this.engine.release(); }
    // ```
    /**
     * Defines release behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    fun release() {
        // What:     `engine.release()` releases the engine's resources.
        // Why:      Free audio focus, buffers, and file handles.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.engine.release();
        // ```
        engine.release()
    }

    // What:     `private fun playCurrent() { ... }` declares a PRIVATE method (this-class
    //           only), block body, `Unit`.
    // Why:      Load the queue's current track and play it, or refresh idle state when the
    //           queue is empty.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private playCurrent(): void { ... }
    // ```
    /**
     * Defines play current behavior for this music-player component; the TypeScript-oriented notes above explain
     * its call shape and effects.
     */
    private fun playCurrent() {
        // What:     `val index = queue.currentIndex()` declares a read-only local `index`
        //           (type INFERRED as `Int?`) from the queue's current load-order index.
        // Why:      Decide whether there is a track to play.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const index = this.queue.currentIndex();
        // ```
        /**
         * Defines index value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val index = queue.currentIndex()
        // What:     `if (index == null) { refresh(); return }` handles the empty-queue case:
        //           when there is no current track, repaint idle state and bail.
        // Why:      Nothing to load when the queue is empty.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (index === null) { this.refresh(); return; }
        // ```
        if (index == null) {
            // What:     `refresh()` rebuilds the (idle) snapshot.
            // Why:      Show idle state when nothing is current.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.refresh();
            // ```
            refresh()
            // What:     `return` exits early (bare `return`, `Unit`).
            // Why:      No track to load.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return;
            // ```
            return
        }
        // What:     `loadedUri = uris[index]` records the URI being loaded (the stable
        //           identity), not the index. Inside this block `index` is smart-cast to a
        //           non-null `Int` (the null case returned above), so `uris[index]` is safe.
        // Why:      Remember the loaded track by URI so `togglePlay`/`setPlayWhenReady` can
        //           resume it without reloading, and so the check survives a rescan that
        //           shifts indices (the same URI keeps matching).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.loadedUri = this.uris[index];
        // ```
        loadedUri = uris[index]
        // What:     `engine.load(uris[index], play = true)` loads the URI at `index` and
        //           starts it. `uris[index]` reads the parallel URI list; `play = true` is a
        //           NAMED argument meaning "begin playing immediately."
        // Why:      Actually open and play the current track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.engine.load(this.uris[index], true);
        // ```
        engine.load(uris[index], play = true)
        // What:     `refresh(followCurrent = true)` rebuilds the snapshot, switching to the
        //           current track's page (named arg `followCurrent = true`).
        // Why:      Keep the highlighted row on screen after loading a track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.refresh(true);
        // ```
        refresh(followCurrent = true)
    }

    // What:     `private fun resolveViewedPage(): Int { ... }` declares a PRIVATE helper, block
    //           body, returning an `Int` page index. It is declared BEFORE `refresh` (which calls
    //           it) so the file reads top-down.
    // Why:      When `refresh` is not following a current track, it must decide which page tab to
    //           show. Plain index-clamping breaks during a streaming load, because newly
    //           discovered earlier-sorting folders shift every page's index, so the tab the user
    //           was looking at would jump. Resolving by LABEL keeps the same tab; only when that
    //           label no longer exists do we fall back to the clamp.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private resolveViewedPage(): number {
    //   const previousLabel = this.uiState.pageLabels[this.uiState.selectedPage] ?? null;
    //   const byLabel = previousLabel === null
    //     ? -1
    //     : this.pages.findIndex((p) => p.label === previousLabel);
    //   return byLabel >= 0 ? byLabel : clamp(this.uiState.selectedPage, 0, Math.max(0, this.pages.length - 1));
    // }
    // ```
    /**
     * Defines resolve viewed page behavior for this music-player component; the TypeScript-oriented notes above
     * explain its call shape and effects.
     */
    private fun resolveViewedPage(): Int {
        // What:     `val previousLabel: String? = uiState.pageLabels.getOrNull(uiState.selectedPage)`
        //           reads the label of the tab the user was on, or null. `getOrNull(i)` returns the
        //           element or null for an out-of-range index (no throw); the result type `String?`
        //           is "a String OR null".
        // Why:      The label is the stable identity of the viewed tab across a re-pagination; we
        //           need it to find where that tab moved to.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const previousLabel: string | null = this.uiState.pageLabels[this.uiState.selectedPage] ?? null;
        // ```
        /**
         * Defines previous label value for this music-player component; the TypeScript-oriented notes above
         * explain its source and use.
         */
        val previousLabel: String? = uiState.pageLabels.getOrNull(uiState.selectedPage)
        // What:     `val byLabel: Int = previousLabel?.let { label -> pages.indexOfFirst { it.label == label } } ?: -1`
        //           finds the new index of that label, or -1.
        //           - `previousLabel?.let { label -> ... }` runs the block only when the label is
        //             non-null, binding it as `label`.
        //           - `pages.indexOfFirst { it.label == label }` returns the index of the first page
        //             whose `label` matches (`it` is the implicit single-lambda parameter, here a
        //             `Page`), or -1 if none.
        //           - `?: -1` covers the "no previous label at all" case.
        // Why:      Locate where the viewed tab landed after the pages shifted.
        // Gotcha:   `indexOfFirst` already returns -1 when nothing matches, so both "no label" and
        //           "label vanished" collapse to the same -1 sentinel handled below.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const byLabel = previousLabel === null ? -1 : this.pages.findIndex((p) => p.label === previousLabel);
        // ```
        /**
         * Defines by label value for this music-player component; the TypeScript-oriented notes above explain
         * its source and use.
         */
        val byLabel: Int = previousLabel?.let { label -> pages.indexOfFirst { it.label == label } } ?: -1
        // What:     `if (byLabel >= 0) { return byLabel }` returns the resolved index early when the
        //           label was found.
        // Why:      The viewed tab still exists; keep showing it at its new position.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (byLabel >= 0) return byLabel;
        // ```
        if (byLabel >= 0) {
            return byLabel
        }
        // What:     `return uiState.selectedPage.coerceIn(0, maxOf(0, pages.size - 1))` is the
        //           fallback. `coerceIn(min, max)` CLAMPS the old numeric index into range;
        //           `maxOf(0, pages.size - 1)` is the last valid index but never below 0 (so an
        //           empty `pages` clamps to 0).
        // Why:      The viewed label is gone (or there was none), so fall back to the old
        //           index-keeping behaviour, never out of bounds.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return clamp(this.uiState.selectedPage, 0, Math.max(0, this.pages.length - 1));
        // ```
        return uiState.selectedPage.coerceIn(0, maxOf(0, pages.size - 1))
    }

    // What:     `private fun refresh(followCurrent: Boolean = false) { ... }` declares a
    //           PRIVATE method with one DEFAULT-VALUED parameter (`followCurrent` defaults
    //           to `false`), block body, `Unit`.
    // Why:      Rebuild `uiState` from the queue and pages. When `followCurrent` is true,
    //           switch the visible page to the current track's page so the highlighted row
    //           stays on screen; otherwise keep the user's selected page.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private refresh(followCurrent: boolean = false): void { ... }
    // ```
    /**
     * Defines refresh behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    private fun refresh(followCurrent: Boolean = false) {
        // What:     `val current = queue.currentIndex()` declares a read-only local `current`
        //           (inferred `Int?`) from the queue's current index.
        // Why:      Used both to pick the page and to fill the snapshot's `currentIndex`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const current = this.queue.currentIndex();
        // ```
        /**
         * Defines current value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val current = queue.currentIndex()
        // What:     `val selected = if (followCurrent && current != null) { ... } else { ... }`
        //           declares `selected` from an `if/else` EXPRESSION. The condition combines
        //           `followCurrent` with a null check `current != null` via `&&` (the null
        //           check also SMART-CASTS `current` to non-null `Int` inside the `then`
        //           branch).
        // Why:      Choose the page to show: follow the current track's page, or keep the
        //           user's selection clamped into range.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const selected = (followCurrent && current !== null)
        //   ? (pageOfIndex(this.pages, current) ?? this.uiState.selectedPage)
        //   : clamp(this.uiState.selectedPage, 0, Math.max(0, this.pages.length - 1));
        // ```
        /**
         * Defines selected value for this music-player component; the TypeScript-oriented notes above explain
         * its source and use.
         */
        val selected = if (followCurrent && current != null) {
            // What:     `pageOfIndex(pages, current) ?: uiState.selectedPage` is the `then`
            //           branch value. `pageOfIndex(...)` returns the page holding `current`
            //           (an `Int?`); the ELVIS `?:` falls back to the existing
            //           `uiState.selectedPage` when that is null.
            // Why:      Follow the current track's page, but keep the old selection if the
            //           track is on no page.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // pageOfIndex(this.pages, current) ?? this.uiState.selectedPage
            // ```
            pageOfIndex(pages, current) ?: uiState.selectedPage
        } else {
            // What:     `resolveViewedPage()` is the `else` branch value: the page index to keep
            //           when we are NOT following a current track. It preserves the page the user
            //           was viewing by its LABEL (re-resolving its index against the new pages),
            //           falling back to a clamp when the label is gone.
            // Why:      During a streaming load the pages shift as earlier-sorting folders are
            //           discovered late, so a numeric index would point at a different tab; keying
            //           on the label keeps the viewed tab stable while the list fills in.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.resolveViewedPage()
            // ```
            resolveViewedPage()
        }
        // What:     `uiState = PlayerUiState( ... )` reassigns `uiState` to a brand-new
        //           snapshot built with NAMED constructor arguments (the assignment goes
        //           through the Compose delegate, triggering recompose). Two arguments use
        //           helpers: `pages.map { it.label }` builds the tab labels (implicit-`it`
        //           lambda), and `pages.getOrNull(selected)?.entries ?: emptyList()` reads the
        //           selected page's entries safely (`getOrNull` returns null for an
        //           out-of-range index, `?.entries` reads its entries if present, and `?:`
        //           falls back to the empty list).
        // Why:      Produce the fresh immutable snapshot the UI renders.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.uiState = {
        //   pageLabels: this.pages.map((p) => p.label),
        //   selectedPage: selected,
        //   pageItems: this.pages[selected]?.entries ?? [],
        //   currentIndex: current,
        //   playing: this.isPlaying,
        //   shuffle: this.queue.shuffleMode(),
        //   repeatTrack: this.queue.repeatTrack(),
        //   volume: this.uiState.volume,
        //   queueSize: this.queue.len(),
        //   loading: this.isLoading,
        // };
        // ```
        uiState = PlayerUiState(
            // What:     `pageLabels = pages.map { it.label }` passes the page-tab labels by
            //           name; `pages.map { it.label }` maps each `Page` to its `label`
            //           (implicit `it`).
            // Why:      The tab captions.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // pageLabels: this.pages.map((p) => p.label),
            // ```
            pageLabels = pages.map { it.label },
            // What:     `selectedPage = selected` passes the chosen page index by name.
            // Why:      Which tab is active.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // selectedPage: selected,
            // ```
            selectedPage = selected,
            // What:     `pageItems = pages.getOrNull(selected)?.entries ?: emptyList()` passes
            //           the visible page's rows. `getOrNull(selected)` returns the `Page` or
            //           null (no throw on a bad index); `?.entries` reads its entries if
            //           present; `?: emptyList()` falls back to the empty list.
            // Why:      The rows for the active page, safely defaulting to none.
            // Gotcha:   `getOrNull` is the no-throw indexed read (vs `pages[selected]` which
            //           would throw out of range); chained with `?.`/`?:` for a total result.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // pageItems: this.pages[selected]?.entries ?? [],
            // ```
            pageItems = pages.getOrNull(selected)?.entries ?: emptyList(),
            // What:     `currentIndex = current` passes the current track's load-order index
            //           (`Int?`) by name.
            // Why:      Drives the current-row highlight.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // currentIndex: current,
            // ```
            currentIndex = current,
            // What:     `playing = isPlaying` passes the play/pause flag by name.
            // Why:      The play vs pause icon.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // playing: this.isPlaying,
            // ```
            playing = isPlaying,
            // What:     `shuffle = queue.shuffleMode()` passes the current shuffle mode by
            //           name.
            // Why:      The shuffle radio group.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // shuffle: this.queue.shuffleMode(),
            // ```
            shuffle = queue.shuffleMode(),
            // What:     `repeatTrack = queue.repeatTrack()` passes the repeat-track flag by
            //           name.
            // Why:      The repeat-track checkbox.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // repeatTrack: this.queue.repeatTrack(),
            // ```
            repeatTrack = queue.repeatTrack(),
            // What:     `volume = uiState.volume` carries the current volume forward by name
            //           (reading the OLD snapshot's volume).
            // Why:      Preserve the gain across the rebuild.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // volume: this.uiState.volume,
            // ```
            volume = uiState.volume,
            // What:     `queueSize = queue.len()` passes the total track count by name.
            // Why:      Lets the UI tell "empty" from "has tracks".
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // queueSize: this.queue.len(),
            // ```
            queueSize = queue.len(),
            // What:     `loading = isLoading` passes the loading flag by name.
            // Why:      Show the loading notice while a scan runs.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // loading: this.isLoading,
            // ```
            loading = isLoading,
        )
        // What:     `onStateChanged?.invoke()` SAFE-CALLs `.invoke()` on the nullable
        //           function field `onStateChanged`: if a callback is attached, call it (a
        //           function value is invoked with `.invoke()` or `()`); if null, do nothing.
        // Why:      Notify a `MediaSession` projection that the state changed so it can
        //           re-pull.
        // Gotcha:   `?.invoke()` is the null-safe way to call a nullable function; bare
        //           `onStateChanged()` would not compile on a nullable function type.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.onStateChanged?.();
        // ```
        onStateChanged?.invoke()
        // What:     `onPersist?.invoke()` SAFE-CALLs the separate persist callback: if a
        //           persister is attached (the service), call it; if null, do nothing.
        // Why:      Save the session on any state change (selection, settings, play/pause), so
        //           a later kill does not lose it. Distinct from `onStateChanged` because that
        //           one is reserved for the MediaSession projection.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.onPersist?.();
        // ```
        onPersist?.invoke()
    }

    /**
     * Defines companion object for this music-player component; the TypeScript-oriented notes above explain its
     * shared role.
     */
    // What:     `companion object { ... }` declares the static-like object on
    //           `PlayerController`; its member is read as `PlayerController.MILLIS_PER_SEC`
    //           (within the class, just `MILLIS_PER_SEC`).
    // Why:      Hold the milliseconds-per-second constant used by `snapshot`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // static member of PlayerController:
    // //   private static readonly MILLIS_PER_SEC = 1000;
    // ```
    companion object {
        // What:     `private const val MILLIS_PER_SEC: Double = 1000.0` declares a private
        //           compile-time `Double` constant (64-bit float; sibling `Float` is 32-bit).
        //           The literal `1000.0` is a `Double` (a bare `1000` would be an `Int`).
        // Why:      Milliseconds per second, for the snapshot's millisecond position/
        //           duration. It is a `Double` so `seconds * MILLIS_PER_SEC` stays
        //           floating-point before the `.toLong()` truncation.
        // Gotcha:   `1000.0` is a `Double` literal on purpose; `Double * Double` keeps the
        //           fraction, which the later `.toLong()` then truncates.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly MILLIS_PER_SEC = 1000;
        // ```
        /**
         * Defines millis per sec value for this music-player component; the TypeScript-oriented notes above
         * explain its source and use.
         */
        private const val MILLIS_PER_SEC: Double = 1000.0
    }
}
