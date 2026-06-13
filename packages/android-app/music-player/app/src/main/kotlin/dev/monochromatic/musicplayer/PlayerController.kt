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
// TS map:   No 1:1 equivalent — TS module identity is the file path; no `package`.
//
// In TS you'd write (pseudocode):
// ```ts
// // No `package` line in TS; the file path is the module identity.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.util.Log` pulls in `Log`, Android's logger.
// Why:      We log when a track ends and we advance.
// TS map:   `import { Log } from "android/util";` — `Log.i` ~ `console.info` with a tag.
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
// TS map:   No TS equivalent. Mentally it is the machinery behind a `get` accessor that
//           forwards to a backing signal; you never import it in TS.
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
// TS map:   `import { signal } from "some-reactive-lib";` — `mutableStateOf(x)` ~
//           `signal(x)` / `ref(x)`: a reactive box whose `.value` changes trigger
//           re-render.
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
// TS map:   No TS equivalent — it is the machinery behind a `set` accessor forwarding to
//           a backing signal.
//
// In TS you'd write (pseudocode):
// ```ts
// // no import — TS setters don't need an operator function in scope
// ```
import androidx.compose.runtime.setValue

// What:     `import dev.monochromatic.musicplayer.core.Page` imports the `Page` type from
//           the `.core` package: one browsable tab (a label plus its entries).
// Why:      `pages` is a `List<Page>`.
// TS map:   `import { Page } from "./core/Page";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Page } from "./core/Page";
// ```
import dev.monochromatic.musicplayer.core.Page

// What:     `import dev.monochromatic.musicplayer.core.Queue` imports the ported `Queue`
//           type (the play queue: ordered tracks plus a cursor, with shuffle/repeat).
// Why:      The controller owns a `Queue`.
// TS map:   `import { Queue } from "./core/Queue";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Queue } from "./core/Queue";
// ```
import dev.monochromatic.musicplayer.core.Queue

// What:     `import dev.monochromatic.musicplayer.core.ShuffleMode` imports the
//           three-value enum `ShuffleMode` (`OFF`/`WITHIN_PAGE`/`ALL`).
// Why:      `setShuffle` takes a `ShuffleMode`.
// TS map:   `import { ShuffleMode } from "./core/ShuffleMode";` — like a string union.
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
// TS map:   `import { pageOfIndex } from "./core/Pagination";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { pageOfIndex } from "./core/Pagination";
// ```
import dev.monochromatic.musicplayer.core.pageOfIndex

// What:     `import dev.monochromatic.musicplayer.core.paginate` imports the
//           `paginate(names)` FUNCTION that groups display strings into `Page`s.
// Why:      `openLibrary` paginates the queue's display paths.
// TS map:   `import { paginate } from "./core/Pagination";`.
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
// Why:      The controller drives a flavor-specific `AudioEngine`; storing it as a
//           private field lets every method reach it.
// TS map:   `class PlayerController { constructor(private readonly engine: AudioEngine) {} }`
//           — TS's parameter-property shorthand.
//
// In TS you'd write (pseudocode):
// ```ts
// class PlayerController {
//   constructor(private readonly engine: AudioEngine) {}
//   // ...state and methods below...
// }
// ```
class PlayerController(private val engine: AudioEngine) {
    // What:     `private val queue: Queue = Queue.new()` declares a private read-only
    //           field `queue`, built by the FACTORY `Queue.new()` (a companion-object
    //           function on `Queue`, not a constructor; no `new` keyword in Kotlin).
    // Why:      The controller owns one play queue seeded from the wall clock.
    // TS map:   `private readonly queue: Queue = Queue.new();`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly queue: Queue = Queue.new();
    // ```
    private val queue: Queue = Queue.new()
    // What:     `private var pages: List<Page> = emptyList()` declares a private,
    //           REASSIGNABLE (`var`) field of read-only list type `List<Page>` (sibling
    //           `MutableList<Page>`), initialised to the shared empty list `emptyList()`.
    // Why:      The current paginated view; replaced wholesale on each load.
    // TS map:   `private pages: readonly Page[] = [];`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private pages: readonly Page[] = [];
    // ```
    private var pages: List<Page> = emptyList()
    // What:     `private var loadedIndex: Int? = null` declares a private, reassignable
    //           field of NULLABLE `Int?` (the trailing `?` = "an `Int` OR null"),
    //           initialised `null`.
    // Why:      The load-order index currently loaded in the engine, or null when nothing
    //           is loaded; lets `togglePlay` tell "resume" from "load and play".
    // TS map:   `private loadedIndex: number | null = null;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private loadedIndex: number | null = null;
    // ```
    private var loadedIndex: Int? = null
    // What:     `private var isPlaying: Boolean = false` declares a private, reassignable
    //           boolean field, initialised `false`.
    // Why:      Mirrors the engine's playing state for the UI snapshot.
    // TS map:   `private isPlaying = false;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private isPlaying: boolean = false;
    // ```
    private var isPlaying: Boolean = false

    // What:     `private var isLoading: Boolean = true` declares a private, reassignable
    //           boolean field initialised `true`.
    // Why:      Whether a library load or folder scan is in flight. It STARTS true because
    //           the owning service begins loading as soon as it creates this controller,
    //           so the screen shows a loading notice from the first frame instead of
    //           flashing the empty-library message; `openLibrary` clears it.
    // TS map:   `private isLoading = true;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private isLoading: boolean = true;
    // ```
    private var isLoading: Boolean = true

    // What:     `private var uris: List<String> = emptyList()` declares a private,
    //           reassignable read-only `List<String>` field, initialised empty.
    // Why:      Playback URIs aligned by load-order index with the display paths fed to
    //           `queue`; the queue never reorders its track list (shuffle permutes a
    //           separate index list), so `uris[index]` is always the URI for the track the
    //           queue reports at that load-order index.
    // TS map:   `private uris: readonly string[] = [];`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private uris: readonly string[] = [];
    // ```
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
    // TS map:   Back the property with a reactive signal:
    //           `private readonly _uiState = signal(makePlayerUiState({ loading: true }));`
    //           `get uiState(): PlayerUiState { return this._uiState.value; }`
    //           `private set uiState(v: PlayerUiState) { this._uiState.value = v; }`. The
    //           `by` line collapses all of that into one declaration.
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
    var uiState: PlayerUiState by mutableStateOf(PlayerUiState(loading = true))
        // What:     `private set` restricts the SETTER of `uiState` to this class while the
        //           GETTER stays public. It is written on its own indented line directly
        //           under the property. There is no setter BODY; `private` just narrows
        //           visibility of the (delegated) setter.
        // Why:      Outside code may READ `uiState` (the UI does) but only the controller
        //           may REPLACE it, so the brain stays the single writer.
        // TS map:   Make the setter private: `private set uiState(v) { this._uiState.value = v; }`
        //           with a public `get uiState()`.
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
    // TS map:   `onStateChanged: (() => void) | null = null;` — Kotlin's `() -> Unit` is
    //           TS's `() => void`; `Unit` is `void`.
    // Gotcha:   The parentheses matter: `(() -> Unit)?` is a nullable function; `() -> Unit?`
    //           would be a function returning a nullable `Unit` (a different type).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // onStateChanged: (() => void) | null = null;
    // ```
    var onStateChanged: (() -> Unit)? = null

    // What:     `init { ... }` is Kotlin's INITIALIZER BLOCK: code that runs once as part
    //           of constructing every instance, after the field initializers above. It has
    //           no method name.
    // Why:      Wire the engine's callbacks (playing-changed and track-ended) at
    //           construction so the controller reacts to engine events.
    // TS map:   The body of the class `constructor(...) { ... }`, after the field setup.
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
        // TS map:   `this.engine.setOnPlayingChanged((playing) => { ... });`.
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
            // TS map:   `this.isPlaying = playing;`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.isPlaying = playing;
            // ```
            isPlaying = playing
            // What:     `refresh()` rebuilds `uiState` from the queue and pages.
            // Why:      Repaint the UI with the new playing state.
            // TS map:   `this.refresh();`.
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
        // TS map:   `this.engine.setOnTrackEnded(() => { ... });`.
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
            // TS map:   `console.info(`[${LOG_TAG}] track ended; advancing`);`
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
            // TS map:   `this.queue.advance(true);` — TS has no named args, so pass
            //           positionally.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.queue.advance(true);
            // ```
            queue.advance(natural = true)
            // What:     `playCurrent()` loads and plays the queue's now-current track.
            // Why:      Actually start whatever `advance` selected.
            // TS map:   `this.playCurrent();`.
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
    // TS map:   `beginLoad(): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // beginLoad(): void { this.isLoading = true; this.refresh(); }
    // ```
    fun beginLoad() {
        // What:     `isLoading = true` sets the loading flag.
        // Why:      Tell the next snapshot a scan is running.
        // TS map:   `this.isLoading = true;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.isLoading = true;
        // ```
        isLoading = true
        // What:     `refresh()` rebuilds the snapshot so the loading notice shows now.
        // Why:      Repaint immediately with the loading state.
        // TS map:   `this.refresh();`.
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
    // TS map:   `openLibrary(tracks: readonly Track[]): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // openLibrary(tracks: readonly Track[]): void { ... }
    // ```
    fun openLibrary(tracks: List<Track>) {
        // What:     `uris = tracks.map { it.uri }` reassigns `uris`. `tracks.map { ... }`
        //           builds a new list by transforming each element; the trailing lambda
        //           `{ it.uri }` uses `it`, Kotlin's IMPLICIT name for a single-parameter
        //           lambda's argument (here one `Track`), and reads its `uri`.
        // Why:      Keep the playback URIs aligned by load-order index with the queue.
        // TS map:   `this.uris = tracks.map((it) => it.uri);` — Kotlin's implicit `it` is a
        //           named arrow parameter in TS.
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
        // TS map:   `this.queue.setTracks(tracks.map((t) => t.displayPath));`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.setTracks(tracks.map((t) => t.displayPath));
        // ```
        queue.setTracks(tracks.map { it.displayPath })
        // What:     `pages = paginate(queue.displayPaths())` reassigns `pages` from the
        //           paginator over the queue's display paths.
        // Why:      Rebuild the page tabs for the new library.
        // TS map:   `this.pages = paginate(this.queue.displayPaths());`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.pages = paginate(this.queue.displayPaths());
        // ```
        pages = paginate(queue.displayPaths())
        // What:     `loadedIndex = null` clears the loaded-track index.
        // Why:      Nothing is loaded in the engine yet for the new library.
        // TS map:   `this.loadedIndex = null;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.loadedIndex = null;
        // ```
        loadedIndex = null
        // What:     `isLoading = false` clears the loading flag.
        // Why:      The load has been delivered, so the empty-library message (if any) is
        //           now meaningful.
        // TS map:   `this.isLoading = false;`.
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
        // TS map:   `this.refresh(true);` — TS passes positionally.
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
    // TS map:   `playIndex(index: number): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // playIndex(index: number): void { this.queue.playIndex(index); this.playCurrent(); }
    // ```
    fun playIndex(index: Int) {
        // What:     `queue.playIndex(index)` selects that track in the queue (switching
        //           scope if it is on another page).
        // Why:      Make the tapped track current.
        // TS map:   `this.queue.playIndex(index);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.playIndex(index);
        // ```
        queue.playIndex(index)
        // What:     `playCurrent()` loads and plays the now-current track.
        // Why:      Start playback of the tapped track.
        // TS map:   `this.playCurrent();`.
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
    // TS map:   `seekToScopeIndex(scopeIndex: number, positionSec: number = 0): void { ... }`
    //           — default parameters work the same way in TS.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // seekToScopeIndex(scopeIndex: number, positionSec: number = 0): void { ... }
    // ```
    fun seekToScopeIndex(scopeIndex: Int, positionSec: Double = 0.0) {
        // What:     `if (queue.moveCursorTo(scopeIndex) == null) { return }`. `moveCursorTo`
        //           returns `Int?` (the now-current index, or null for out-of-range);
        //           `== null` tests that; `return` bails out (returning `Unit`).
        // Why:      An out-of-range target moves nothing, so we exit early.
        // TS map:   `if (this.queue.moveCursorTo(scopeIndex) === null) return;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.queue.moveCursorTo(scopeIndex) === null) return;
        // ```
        if (queue.moveCursorTo(scopeIndex) == null) {
            // What:     `return` exits the method early (bare `return`, `Unit`).
            // Why:      Nothing to play for an out-of-range index.
            // TS map:   `return;`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return;
            // ```
            return
        }
        // What:     `playCurrent()` loads and plays the newly-current track.
        // Why:      Start the track the cursor moved to.
        // TS map:   `this.playCurrent();`.
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
        // TS map:   `if (positionSec > 0) this.engine.seekTo(positionSec);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (positionSec > 0) this.engine.seekTo(positionSec);
        // ```
        if (positionSec > 0.0) {
            // What:     `engine.seekTo(positionSec)` moves the playhead to `positionSec`
            //           seconds.
            // Why:      Start the new track at the requested offset.
            // TS map:   `this.engine.seekTo(positionSec);`.
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
    // TS map:   `togglePlay(): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // togglePlay(): void { ... }
    // ```
    fun togglePlay() {
        // What:     `if (isPlaying) { ... } else if (loadedIndex != null && loadedIndex == queue.currentIndex()) { ... } else { ... }`
        //           is an if / else-if / else CHAIN. `loadedIndex != null` is a null check;
        //           `&&` is logical AND; `loadedIndex == queue.currentIndex()` compares the
        //           loaded index to the queue's current index (both `Int?`; `==` is
        //           null-safe value equality).
        // Why:      Three cases: currently playing -> pause; the current track is already
        //           loaded -> resume; otherwise -> load and play.
        // TS map:   `if (this.isPlaying) { ... } else if (this.loadedIndex !== null && this.loadedIndex === this.queue.currentIndex()) { ... } else { ... }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.isPlaying) this.engine.pause();
        // else if (this.loadedIndex !== null && this.loadedIndex === this.queue.currentIndex()) this.engine.play();
        // else this.playCurrent();
        // ```
        if (isPlaying) {
            // What:     `engine.pause()` pauses playback.
            // Why:      We were playing; the toggle pauses.
            // TS map:   `this.engine.pause();`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.engine.pause();
            // ```
            engine.pause()
        } else if (loadedIndex != null && loadedIndex == queue.currentIndex()) {
            // What:     `engine.play()` resumes the already-loaded track.
            // Why:      The current track is loaded, so just resume it (no reload).
            // TS map:   `this.engine.play();`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.engine.play();
            // ```
            engine.play()
        } else {
            // What:     `playCurrent()` loads and plays the current track.
            // Why:      Nothing relevant is loaded, so load and play from scratch.
            // TS map:   `this.playCurrent();`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.playCurrent();
            // ```
            playCurrent()
        }
        // What:     `refresh()` rebuilds the snapshot after the play/pause change.
        // Why:      Repaint the play/pause icon.
        // TS map:   `this.refresh();`.
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
    // TS map:   `setPlayWhenReady(play: boolean): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setPlayWhenReady(play: boolean): void { ... }
    // ```
    fun setPlayWhenReady(play: Boolean) {
        // What:     `if (play) { ... } else { engine.pause() }` branches on the requested
        //           intent: play vs pause.
        // Why:      Apply exactly the named state.
        // TS map:   `if (play) { ... } else { this.engine.pause(); }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (play) { ... } else { this.engine.pause(); }
        // ```
        if (play) {
            // What:     `if (loadedIndex != null && loadedIndex == queue.currentIndex()) { engine.play() } else { playCurrent() }`
            //           is the same "already-loaded?" check as in `togglePlay`: resume if
            //           the current track is loaded, else load and play.
            // Why:      Resume cheaply when possible; otherwise load and play.
            // TS map:   `if (this.loadedIndex !== null && this.loadedIndex === this.queue.currentIndex()) this.engine.play(); else this.playCurrent();`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (this.loadedIndex !== null && this.loadedIndex === this.queue.currentIndex()) this.engine.play();
            // else this.playCurrent();
            // ```
            if (loadedIndex != null && loadedIndex == queue.currentIndex()) {
                // What:     `engine.play()` resumes the loaded track.
                // Why:      The current track is already loaded.
                // TS map:   `this.engine.play();`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.engine.play();
                // ```
                engine.play()
            } else {
                // What:     `playCurrent()` loads and plays the current track.
                // Why:      The current track is not loaded, so load and play.
                // TS map:   `this.playCurrent();`.
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
            // TS map:   `this.engine.pause();`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.engine.pause();
            // ```
            engine.pause()
        }
        // What:     `refresh()` rebuilds the snapshot after the intent change.
        // Why:      Repaint to reflect the new play/pause state.
        // TS map:   `this.refresh();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.refresh();
        // ```
        refresh()
    }

    // What:     `fun next() { ... }` declares a public method, block body, `Unit`.
    // Why:      Skip to the next track in scope and play it (user pressed Next).
    // TS map:   `next(): void { this.queue.advance(false); this.playCurrent(); }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // next(): void { this.queue.advance(false); this.playCurrent(); }
    // ```
    fun next() {
        // What:     `queue.advance(natural = false)` advances the queue with the `natural`
        //           argument by NAME as `false` (a manual Next does NOT honour repeat-track).
        // Why:      Move forward one track on an explicit Next.
        // TS map:   `this.queue.advance(false);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.advance(false);
        // ```
        queue.advance(natural = false)
        // What:     `playCurrent()` loads and plays the next track.
        // Why:      Start whatever `advance` selected.
        // TS map:   `this.playCurrent();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.playCurrent();
        // ```
        playCurrent()
    }

    // What:     `fun prev() { ... }` declares a public method, block body, `Unit`.
    // Why:      Skip to the previous track in scope and play it (user pressed Prev).
    // TS map:   `prev(): void { this.queue.prev(); this.playCurrent(); }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // prev(): void { this.queue.prev(); this.playCurrent(); }
    // ```
    fun prev() {
        // What:     `queue.prev()` moves the cursor to the previous track in scope.
        // Why:      Step backward on an explicit Prev.
        // TS map:   `this.queue.prev();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.prev();
        // ```
        queue.prev()
        // What:     `playCurrent()` loads and plays the previous track.
        // Why:      Start the track `prev` selected.
        // TS map:   `this.playCurrent();`.
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
    // TS map:   `setShuffle(mode: ShuffleMode): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setShuffle(mode: ShuffleMode): void { this.queue.setShuffle(mode); this.refresh(); }
    // ```
    fun setShuffle(mode: ShuffleMode) {
        // What:     `queue.setShuffle(mode)` applies the new shuffle/scope mode in the queue.
        // Why:      Change the mode while keeping the playing track current.
        // TS map:   `this.queue.setShuffle(mode);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.setShuffle(mode);
        // ```
        queue.setShuffle(mode)
        // What:     `refresh()` rebuilds the snapshot after the mode change.
        // Why:      Repaint the shuffle radios and any reordering.
        // TS map:   `this.refresh();`.
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
    // TS map:   `setRepeatTrack(on: boolean): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setRepeatTrack(on: boolean): void { this.queue.setRepeatTrack(on); this.refresh(); }
    // ```
    fun setRepeatTrack(on: Boolean) {
        // What:     `queue.setRepeatTrack(on)` stores the repeat-track flag in the queue.
        // Why:      Record the new repeat-track state.
        // TS map:   `this.queue.setRepeatTrack(on);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.queue.setRepeatTrack(on);
        // ```
        queue.setRepeatTrack(on)
        // What:     `refresh()` rebuilds the snapshot after the toggle.
        // Why:      Repaint the repeat-track checkbox.
        // TS map:   `this.refresh();`.
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
    // TS map:   `selectPage(page: number): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // selectPage(page: number): void { ... }
    // ```
    fun selectPage(page: Int) {
        // What:     `if (page in pages.indices) { ... }` uses Kotlin's `in` operator for
        //           RANGE MEMBERSHIP: `pages.indices` is the `0 until pages.size` range, and
        //           `page in <range>` tests whether `page` is a valid index.
        // Why:      Only switch to a real page; ignore out-of-range requests.
        // TS map:   `if (page >= 0 && page < this.pages.length) { ... }` — TS has no
        //           `in`-range operator (its `in` checks object keys), so write the bounds
        //           check explicitly.
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
            // TS map:   `this.uiState = { ...this.uiState, selectedPage: page, pageItems: this.pages[page].entries };`
            //           — `.copy(...)` is the spread-with-overrides idiom.
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
    // TS map:   `seek(positionSec: number): void { this.engine.seekTo(positionSec); }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // seek(positionSec: number): void { this.engine.seekTo(positionSec); }
    // ```
    fun seek(positionSec: Double) {
        // What:     `engine.seekTo(positionSec)` moves the playhead within the current track.
        // Why:      Scrub to the requested position.
        // TS map:   `this.engine.seekTo(positionSec);`.
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
    // TS map:   `setVolume(volume: number): void { ... }` — TS has one `number`, so the
    //           Float/Double choice vanishes.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setVolume(volume: number): void { ... }
    // ```
    fun setVolume(volume: Float) {
        // What:     `engine.setVolume(volume)` applies the gain to the engine.
        // Why:      Change the actual output level.
        // TS map:   `this.engine.setVolume(volume);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.engine.setVolume(volume);
        // ```
        engine.setVolume(volume)
        // What:     `uiState = uiState.copy(volume = volume)` reassigns `uiState` to a copy
        //           with the new `volume` (via the data-class `copy` + the Compose delegate).
        // Why:      Reflect the new volume in the UI snapshot without rebuilding everything.
        // TS map:   `this.uiState = { ...this.uiState, volume };`.
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
    // TS map:   `positionSec(): number { return this.engine.positionSec(); }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // positionSec(): number { return this.engine.positionSec(); }
    // ```
    fun positionSec(): Double = engine.positionSec()

    // What:     `fun durationSec(): Double = engine.durationSec()` declares a public method
    //           returning a `Double`, expression body, returning the engine's track
    //           duration (0.0 when unknown).
    // Why:      Live track duration for the seek bar.
    // TS map:   `durationSec(): number { return this.engine.durationSec(); }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // durationSec(): number { return this.engine.durationSec(); }
    // ```
    fun durationSec(): Double = engine.durationSec()

    // What:     `fun snapshot(): PlaybackSnapshot { ... }` declares a public method, block
    //           body, returning a `PlaybackSnapshot`.
    // Why:      Point-in-time view of the current scope and transport for the `MediaSession`
    //           projection (`BrainPlayer`). The scope's tracks are reported in playback
    //           order so the session's framework-computed Next/Previous matches this queue;
    //           position and duration are sampled here and extrapolated by the session
    //           between pulls.
    // TS map:   `snapshot(): PlaybackSnapshot { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // snapshot(): PlaybackSnapshot { ... }
    // ```
    fun snapshot(): PlaybackSnapshot {
        // What:     `val order: List<Int> = queue.playbackOrder()` declares a read-only
        //           `List<Int>` local `order`: the current scope's load-order indices in
        //           playback order.
        // Why:      The timeline reports tracks in this order.
        // TS map:   `const order: readonly number[] = this.queue.playbackOrder();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const order: readonly number[] = this.queue.playbackOrder();
        // ```
        val order: List<Int> = queue.playbackOrder()
        // What:     `val display: List<String> = queue.displayPaths()` declares a read-only
        //           `List<String>` local `display`: the per-track display strings in load
        //           order.
        // Why:      We title each timeline row with the track's display path.
        // TS map:   `const display: readonly string[] = this.queue.displayPaths();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const display: readonly string[] = this.queue.displayPaths();
        // ```
        val display: List<String> = queue.displayPaths()
        // What:     `val items: List<SnapshotItem> = order.map { loadIndex -> SnapshotItem(...) }`
        //           builds the timeline rows. `order.map { ... }` transforms each element;
        //           the trailing lambda names its parameter `loadIndex` (a load-order index)
        //           before `->`. `SnapshotItem(uri = ..., title = ..., loadIndex = ...)` is a
        //           constructor call with NAMED arguments: `uris[loadIndex]` is the playback
        //           URI, `display[loadIndex]` the title, `loadIndex` the index itself.
        // Why:      Produce one `SnapshotItem` per scope track for the session timeline.
        // TS map:   `const items: SnapshotItem[] = order.map((loadIndex) => ({ uri: this.uris[loadIndex], title: display[loadIndex], loadIndex }));`
        //           — named constructor args become object-literal fields.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const items: SnapshotItem[] = order.map((loadIndex) => ({
        //   uri: this.uris[loadIndex],
        //   title: display[loadIndex],
        //   loadIndex,
        // }));
        // ```
        val items: List<SnapshotItem> = order.map { loadIndex ->
            // What:     `SnapshotItem(uri = uris[loadIndex], title = display[loadIndex], loadIndex = loadIndex)`
            //           constructs one timeline item (no `new`) with named args. It is the
            //           lambda's tail expression, so it is the value `map` collects.
            // Why:      One scope track described for the session.
            // TS map:   `({ uri: this.uris[loadIndex], title: display[loadIndex], loadIndex })` returned from the map callback.
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
        // TS map:   `return { items, currentIndex: this.queue.cursorPosition(), playWhenReady: this.engine.playWhenReady(), volume: this.uiState.volume, durationMs: Math.trunc(this.durationSec() * MILLIS_PER_SEC), positionMs: Math.trunc(this.positionSec() * MILLIS_PER_SEC) };`
        //           — `.toLong()` is "truncate to a 64-bit integer", `Math.trunc` in TS.
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
            // TS map:   `items`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // items,
            // ```
            items = items,
            // What:     `currentIndex = queue.cursorPosition()` passes the current scope
            //           position (an `Int?`) by name.
            // Why:      Which timeline row is current.
            // TS map:   `currentIndex: this.queue.cursorPosition()`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // currentIndex: this.queue.cursorPosition(),
            // ```
            currentIndex = queue.cursorPosition(),
            // What:     `playWhenReady = engine.playWhenReady()` passes the engine's play
            //           intent (a `Boolean`) by name.
            // Why:      The notification's play/pause state follows this.
            // TS map:   `playWhenReady: this.engine.playWhenReady()`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // playWhenReady: this.engine.playWhenReady(),
            // ```
            playWhenReady = engine.playWhenReady(),
            // What:     `volume = uiState.volume` passes the current gain by name.
            // Why:      Informational volume for external surfaces.
            // TS map:   `volume: this.uiState.volume`.
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
            // TS map:   `durationMs: Math.trunc(this.durationSec() * MILLIS_PER_SEC)`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // durationMs: Math.trunc(this.durationSec() * MILLIS_PER_SEC),
            // ```
            durationMs = (durationSec() * MILLIS_PER_SEC).toLong(),
            // What:     `positionMs = (positionSec() * MILLIS_PER_SEC).toLong()` converts the
            //           position seconds to a `Long` milliseconds (same multiply + truncate).
            // Why:      media3 reports positions in milliseconds.
            // TS map:   `positionMs: Math.trunc(this.positionSec() * MILLIS_PER_SEC)`.
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
    // TS map:   `currentScopeIndex(): number | null { return this.queue.cursorPosition(); }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // currentScopeIndex(): number | null { return this.queue.cursorPosition(); }
    // ```
    fun currentScopeIndex(): Int? = queue.cursorPosition()

    // What:     `fun release() { ... }` declares a public method, block body, `Unit`.
    // Why:      Release the underlying engine.
    // TS map:   `release(): void { this.engine.release(); }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // release(): void { this.engine.release(); }
    // ```
    fun release() {
        // What:     `engine.release()` releases the engine's resources.
        // Why:      Free audio focus, buffers, and file handles.
        // TS map:   `this.engine.release();`.
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
    // TS map:   `private playCurrent(): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private playCurrent(): void { ... }
    // ```
    private fun playCurrent() {
        // What:     `val index = queue.currentIndex()` declares a read-only local `index`
        //           (type INFERRED as `Int?`) from the queue's current load-order index.
        // Why:      Decide whether there is a track to play.
        // TS map:   `const index = this.queue.currentIndex(); // number | null`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const index = this.queue.currentIndex();
        // ```
        val index = queue.currentIndex()
        // What:     `if (index == null) { refresh(); return }` handles the empty-queue case:
        //           when there is no current track, repaint idle state and bail.
        // Why:      Nothing to load when the queue is empty.
        // TS map:   `if (index === null) { this.refresh(); return; }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (index === null) { this.refresh(); return; }
        // ```
        if (index == null) {
            // What:     `refresh()` rebuilds the (idle) snapshot.
            // Why:      Show idle state when nothing is current.
            // TS map:   `this.refresh();`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.refresh();
            // ```
            refresh()
            // What:     `return` exits early (bare `return`, `Unit`).
            // Why:      No track to load.
            // TS map:   `return;`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return;
            // ```
            return
        }
        // What:     `loadedIndex = index` records which load-order index is being loaded.
        //           Inside this block `index` is smart-cast to a non-null `Int` (the null
        //           case returned above), so assigning it to the `Int?` field is fine.
        // Why:      Remember the loaded track so `togglePlay`/`setPlayWhenReady` can resume
        //           it without reloading.
        // TS map:   `this.loadedIndex = index;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.loadedIndex = index;
        // ```
        loadedIndex = index
        // What:     `engine.load(uris[index], play = true)` loads the URI at `index` and
        //           starts it. `uris[index]` reads the parallel URI list; `play = true` is a
        //           NAMED argument meaning "begin playing immediately."
        // Why:      Actually open and play the current track.
        // TS map:   `this.engine.load(this.uris[index], true);` — named arg becomes
        //           positional in TS.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.engine.load(this.uris[index], true);
        // ```
        engine.load(uris[index], play = true)
        // What:     `refresh(followCurrent = true)` rebuilds the snapshot, switching to the
        //           current track's page (named arg `followCurrent = true`).
        // Why:      Keep the highlighted row on screen after loading a track.
        // TS map:   `this.refresh(true);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.refresh(true);
        // ```
        refresh(followCurrent = true)
    }

    // What:     `private fun refresh(followCurrent: Boolean = false) { ... }` declares a
    //           PRIVATE method with one DEFAULT-VALUED parameter (`followCurrent` defaults
    //           to `false`), block body, `Unit`.
    // Why:      Rebuild `uiState` from the queue and pages. When `followCurrent` is true,
    //           switch the visible page to the current track's page so the highlighted row
    //           stays on screen; otherwise keep the user's selected page.
    // TS map:   `private refresh(followCurrent: boolean = false): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private refresh(followCurrent: boolean = false): void { ... }
    // ```
    private fun refresh(followCurrent: Boolean = false) {
        // What:     `val current = queue.currentIndex()` declares a read-only local `current`
        //           (inferred `Int?`) from the queue's current index.
        // Why:      Used both to pick the page and to fill the snapshot's `currentIndex`.
        // TS map:   `const current = this.queue.currentIndex(); // number | null`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const current = this.queue.currentIndex();
        // ```
        val current = queue.currentIndex()
        // What:     `val selected = if (followCurrent && current != null) { ... } else { ... }`
        //           declares `selected` from an `if/else` EXPRESSION. The condition combines
        //           `followCurrent` with a null check `current != null` via `&&` (the null
        //           check also SMART-CASTS `current` to non-null `Int` inside the `then`
        //           branch).
        // Why:      Choose the page to show: follow the current track's page, or keep the
        //           user's selection clamped into range.
        // TS map:   `const selected = (followCurrent && current !== null) ? ... : ...;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const selected = (followCurrent && current !== null)
        //   ? (pageOfIndex(this.pages, current) ?? this.uiState.selectedPage)
        //   : clamp(this.uiState.selectedPage, 0, Math.max(0, this.pages.length - 1));
        // ```
        val selected = if (followCurrent && current != null) {
            // What:     `pageOfIndex(pages, current) ?: uiState.selectedPage` is the `then`
            //           branch value. `pageOfIndex(...)` returns the page holding `current`
            //           (an `Int?`); the ELVIS `?:` falls back to the existing
            //           `uiState.selectedPage` when that is null.
            // Why:      Follow the current track's page, but keep the old selection if the
            //           track is on no page.
            // TS map:   `pageOfIndex(this.pages, current) ?? this.uiState.selectedPage`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // pageOfIndex(this.pages, current) ?? this.uiState.selectedPage
            // ```
            pageOfIndex(pages, current) ?: uiState.selectedPage
        } else {
            // What:     `uiState.selectedPage.coerceIn(0, maxOf(0, pages.size - 1))` is the
            //           `else` branch value. `coerceIn(min, max)` CLAMPS the current selected
            //           page into the range; `maxOf(0, pages.size - 1)` computes the last
            //           valid page index but never goes below 0 (so an empty `pages` clamps
            //           to 0).
            // Why:      Keep the user's selected page, but never out of bounds after the
            //           pages changed.
            // TS map:   `clamp(this.uiState.selectedPage, 0, Math.max(0, this.pages.length - 1))`
            //           — `coerceIn` is a clamp; `maxOf` is `Math.max`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // clamp(this.uiState.selectedPage, 0, Math.max(0, this.pages.length - 1))
            // ```
            uiState.selectedPage.coerceIn(0, maxOf(0, pages.size - 1))
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
        // TS map:   `this.uiState = { pageLabels: this.pages.map((p) => p.label), selectedPage: selected, pageItems: this.pages[selected]?.entries ?? [], currentIndex: current, playing: this.isPlaying, shuffle: this.queue.shuffleMode(), repeatTrack: this.queue.repeatTrack(), volume: this.uiState.volume, queueSize: this.queue.len(), loading: this.isLoading };`
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
            // TS map:   `pageLabels: this.pages.map((p) => p.label)`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // pageLabels: this.pages.map((p) => p.label),
            // ```
            pageLabels = pages.map { it.label },
            // What:     `selectedPage = selected` passes the chosen page index by name.
            // Why:      Which tab is active.
            // TS map:   `selectedPage: selected`.
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
            // TS map:   `pageItems: this.pages[selected]?.entries ?? []`.
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
            // TS map:   `currentIndex: current`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // currentIndex: current,
            // ```
            currentIndex = current,
            // What:     `playing = isPlaying` passes the play/pause flag by name.
            // Why:      The play vs pause icon.
            // TS map:   `playing: this.isPlaying`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // playing: this.isPlaying,
            // ```
            playing = isPlaying,
            // What:     `shuffle = queue.shuffleMode()` passes the current shuffle mode by
            //           name.
            // Why:      The shuffle radio group.
            // TS map:   `shuffle: this.queue.shuffleMode()`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // shuffle: this.queue.shuffleMode(),
            // ```
            shuffle = queue.shuffleMode(),
            // What:     `repeatTrack = queue.repeatTrack()` passes the repeat-track flag by
            //           name.
            // Why:      The repeat-track checkbox.
            // TS map:   `repeatTrack: this.queue.repeatTrack()`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // repeatTrack: this.queue.repeatTrack(),
            // ```
            repeatTrack = queue.repeatTrack(),
            // What:     `volume = uiState.volume` carries the current volume forward by name
            //           (reading the OLD snapshot's volume).
            // Why:      Preserve the gain across the rebuild.
            // TS map:   `volume: this.uiState.volume`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // volume: this.uiState.volume,
            // ```
            volume = uiState.volume,
            // What:     `queueSize = queue.len()` passes the total track count by name.
            // Why:      Lets the UI tell "empty" from "has tracks".
            // TS map:   `queueSize: this.queue.len()`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // queueSize: this.queue.len(),
            // ```
            queueSize = queue.len(),
            // What:     `loading = isLoading` passes the loading flag by name.
            // Why:      Show the loading notice while a scan runs.
            // TS map:   `loading: this.isLoading`.
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
        // TS map:   `this.onStateChanged?.();` — TS optional-call; Kotlin's `.invoke()` is the
        //           explicit "call this function value" form.
        // Gotcha:   `?.invoke()` is the null-safe way to call a nullable function; bare
        //           `onStateChanged()` would not compile on a nullable function type.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.onStateChanged?.();
        // ```
        onStateChanged?.invoke()
    }

    // What:     `companion object { ... }` declares the static-like object on
    //           `PlayerController`; its member is read as `PlayerController.MILLIS_PER_SEC`
    //           (within the class, just `MILLIS_PER_SEC`).
    // Why:      Hold the milliseconds-per-second constant used by `snapshot`.
    // TS map:   `class PlayerController { static readonly MILLIS_PER_SEC = 1000; }`.
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
        // TS map:   `private static readonly MILLIS_PER_SEC = 1000;` — one `number` type, so
        //           no Float/Double choice.
        // Gotcha:   `1000.0` is a `Double` literal on purpose; `Double * Double` keeps the
        //           fraction, which the later `.toLong()` then truncates.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly MILLIS_PER_SEC = 1000;
        // ```
        private const val MILLIS_PER_SEC: Double = 1000.0
    }
}
