// What:     `package dev.monochromatic.musicplayer` declares the namespace this file's
//           declarations belong to. This file is in the `media3` FLAVOR source set,
//           merged with the shared `main` source set for the Media3 build variant.
// Why:      Keeps `Media3Engine` in the same package as the shared `AudioEngine`
//           interface it implements and the other Media3 classes it wires together.
// TS map:   No `package` keyword in TS; the file path is the module identity.
//
// In TS you'd write (pseudocode):
// ```ts
// // No keyword — file path is the module; this one is media3-flavor only.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` brings in Android's `Context` (the
//           app-environment handle) by short name.
// Why:      The constructor takes a `Context` to build the underlying ExoPlayer and to
//           derive the application context.
// TS map:   `import type { Context } from "android-framework";`
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Context } from "android-framework";
// ```
import android.content.Context

// What:     `import android.util.Log` brings in Android's `Log` class: static logging
//           methods `Log.i` (info), `Log.w` (warning), `Log.e` (error), each taking a
//           string tag and a message.
// Why:      The engine logs load events, resolved gains, and errors to logcat.
// TS map:   `import { Log } from "android-framework";` — mentally a tagged `console`
//           (`Log.i` ~ `console.info`, `Log.e` ~ `console.error`).
//
// In TS you'd write (pseudocode):
// ```ts
// // Mentally: a tagged console (Log.i/.w/.e ~ console.info/.warn/.error).
// ```
import android.util.Log

// What:     `import androidx.annotation.OptIn` brings in the `@OptIn` annotation used to
//           accept experimental/unstable APIs.
// Why:      The Media3 APIs touched here are `@UnstableApi`; the class carries
//           `@OptIn(UnstableApi::class)` to compile.
// TS map:   No equivalent; mentally a decorator suppressing an experimental-API error.
//
// In TS you'd write (pseudocode):
// ```ts
// // No import — TS has no compiler-enforced opt-in for unstable APIs.
// ```
import androidx.annotation.OptIn

// What:     `import androidx.core.net.toUri` brings in the EXTENSION function `toUri()`
//           that AndroidX adds to `String`. An extension function is one defined OUTSIDE
//           a class but callable as if it were a method on it (here, `someString.toUri()`).
//           It parses the string into an Android `Uri`.
// Why:      `resolveNormalizationGain` calls `uri.toUri()` to turn the string URI into a
//           parsed `Uri` for the cache key and the decoder.
// TS map:   `import { toUri } from "androidx-core";` then call it as `toUri(someString)`.
//           TS has no extension-function syntax, so `s.toUri()` becomes `toUri(s)` or
//           `new URL(s)`.
// Gotcha:   `toUri()` is an EXTENSION, not a real method on `String`; it only resolves
//           because this import is present. Remove the import and the call stops compiling.
//
// In TS you'd write (pseudocode):
// ```ts
// import { toUri } from "androidx-core"; // call as toUri(s), not s.toUri()
// ```
import androidx.core.net.toUri

// What:     `import androidx.media3.common.AudioAttributes` brings in Media3's
//           `AudioAttributes` value (usage/content-type metadata that tells the platform
//           how to route and focus audio). `AudioAttributes.DEFAULT` is a ready-made
//           instance with `usage=USAGE_MEDIA`.
// Why:      `setAudioAttributes(AudioAttributes.DEFAULT, ...)` configures the player for
//           media playback and enables focus handling.
// TS map:   `import { AudioAttributes } from "media3";` — `.DEFAULT` is a static instance.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AudioAttributes } from "media3";
// ```
import androidx.media3.common.AudioAttributes

// What:     `import androidx.media3.common.C` brings in Media3's constants bag `C`,
//           including `C.TIME_UNSET` (the sentinel a player reports when a duration is
//           unknown).
// Why:      `durationSec` checks `dur == C.TIME_UNSET` before dividing.
// TS map:   `import { C } from "media3";` — a namespace object of numeric constants.
//
// In TS you'd write (pseudocode):
// ```ts
// import { C } from "media3"; // C.TIME_UNSET sentinel
// ```
import androidx.media3.common.C

// What:     `import androidx.media3.common.MediaItem` brings in `MediaItem`, ExoPlayer's
//           description of one thing to play. `MediaItem.fromUri(uri)` builds one from a
//           URI string.
// Why:      `load` builds a `MediaItem` and hands it to the player.
// TS map:   `import { MediaItem } from "media3";` — `.fromUri` is a static factory.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MediaItem } from "media3";
// ```
import androidx.media3.common.MediaItem

// What:     `import androidx.media3.common.PlaybackException` brings in the error type
//           ExoPlayer raises for a playback failure.
// Why:      The listener's `onPlayerError(error: PlaybackException)` receives it and logs
//           the error code name.
// TS map:   `import { PlaybackException } from "media3";` — an `Error` subclass.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PlaybackException } from "media3";
// ```
import androidx.media3.common.PlaybackException

// What:     `import androidx.media3.common.Player` brings in the `Player` interface and
//           its nested `Player.Listener` (a callback interface for playback events) and
//           constants like `Player.STATE_ENDED`.
// Why:      The engine registers a `Player.Listener` and checks `Player.STATE_ENDED`.
// TS map:   `import { Player } from "media3";` — `Player.Listener` is a nested interface.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Player } from "media3";
// ```
import androidx.media3.common.Player

// What:     `import androidx.media3.common.util.UnstableApi` brings in the `@UnstableApi`
//           marker annotation.
// Why:      Names the opt-in marker passed to `@OptIn(UnstableApi::class)`.
// TS map:   No equivalent; mentally an `@experimental` tag.
//
// In TS you'd write (pseudocode):
// ```ts
// // No import — TS has no compiler-enforced unstable-API marker.
// ```
import androidx.media3.common.util.UnstableApi

// What:     `import androidx.media3.exoplayer.ExoPlayer` brings in the concrete
//           `ExoPlayer` class and its nested `ExoPlayer.Builder`.
// Why:      The engine wraps an `ExoPlayer`, built via `ExoPlayer.Builder(context)`.
// TS map:   `import { ExoPlayer } from "media3";` — `.Builder` is a nested builder class.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ExoPlayer } from "media3";
// ```
import androidx.media3.exoplayer.ExoPlayer

// What:     `import dev.monochromatic.musicplayer.core.normalizationGain` brings in the
//           shared core function `normalizationGain(peak)` from the `main` core package
//           (NOT this flavor). It maps a measured true-peak into an attenuate-only gain
//           in `0.0..1.0`.
// Why:      `resolveNormalizationGain` converts a cached/measured peak into the gain it
//           hands the processor.
// TS map:   `import { normalizationGain } from "../core/normalization";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { normalizationGain } from "../core/normalization";
// ```
import dev.monochromatic.musicplayer.core.normalizationGain

// What:     `import kotlinx.coroutines.CancellationException` brings in the special
//           exception coroutines throw to signal cancellation. Catching it and rethrowing
//           it (rather than swallowing) is how you keep structured cancellation working.
// Why:      `resolveNormalizationGain` catches `CancellationException` and RETHROWS it, so
//           a cancelled gain resolution unwinds cleanly instead of being treated as a
//           decode failure.
// TS map:   Loosely the `AbortError` a fetch throws when its `AbortSignal` fires; TS has no
//           built-in structured cancellation, so the analogy is approximate.
//
// In TS you'd write (pseudocode):
// ```ts
// // Mentally: the AbortError thrown when an AbortSignal cancels an async op.
// ```
import kotlinx.coroutines.CancellationException

// What:     `import kotlinx.coroutines.CoroutineScope` brings in `CoroutineScope`, an
//           object that OWNS a set of running coroutines (background async tasks) and can
//           cancel them all at once. Coroutines launched in a scope die when the scope is
//           cancelled.
// Why:      The engine owns a `resolveScope` so a pending gain measure can be cancelled in
//           `release()`.
// TS map:   No built-in equivalent. Closest is an `AbortController` whose `signal` is
//           threaded into every async task it owns; cancelling the scope ~ calling `.abort()`.
//
// In TS you'd write (pseudocode):
// ```ts
// // Mentally an AbortController that owns and can cancel its async tasks.
// ```
import kotlinx.coroutines.CoroutineScope

// What:     `import kotlinx.coroutines.Dispatchers` brings in `Dispatchers`, the set of
//           named THREAD POOLS coroutines run on: `Dispatchers.Default` (CPU work),
//           `Dispatchers.IO` (blocking I/O), `Dispatchers.Main` (the UI thread).
// Why:      `resolveScope` runs on `Dispatchers.Default` so gain resolution happens off
//           the main thread.
// TS map:   No equivalent. JS has ONE thread, so there is no pool to pick; mentally
//           "which background worker pool to run this on" (Web Workers, loosely).
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent — JS is single-threaded; there is no thread pool to choose.
// ```
import kotlinx.coroutines.Dispatchers

// What:     `import kotlinx.coroutines.SupervisorJob` brings in `SupervisorJob()`, a
//           coroutine "job" whose children fail INDEPENDENTLY: one child crashing does not
//           cancel its siblings or the scope. (A plain `Job` would cancel everything on the
//           first failure.)
// Why:      The resolve scope uses a `SupervisorJob` so one track's failed gain measure
//           does not kill the scope and break later tracks' measures.
// TS map:   No equivalent. Mentally `Promise.allSettled` semantics (one rejection does not
//           reject the others) baked into the task owner.
//
// In TS you'd write (pseudocode):
// ```ts
// // Mentally: one task's failure must not cancel its siblings (allSettled-like).
// ```
import kotlinx.coroutines.SupervisorJob

// What:     `import kotlinx.coroutines.cancel` brings in the `cancel()` EXTENSION on
//           `CoroutineScope` that cancels the scope and all coroutines it owns.
// Why:      `release()` calls `resolveScope.cancel()` so a pending measure cannot outlive
//           the engine.
// TS map:   Mentally `abortController.abort()`.
//
// In TS you'd write (pseudocode):
// ```ts
// // resolveScope.cancel() ~ abortController.abort()
// ```
import kotlinx.coroutines.cancel

// What:     `import kotlinx.coroutines.launch` brings in the `launch { ... }` EXTENSION on
//           `CoroutineScope`. It starts a coroutine that runs the block CONCURRENTLY and
//           returns immediately WITHOUT waiting for it (fire-and-forget).
// Why:      `load` uses `resolveScope.launch { ... }` to resolve the gain in the background
//           while playback starts right away.
// TS map:   Loosely `void (async () => { ... })()` — kick off an async IIFE and do not
//           await it. (Kotlin's `launch` also ties the task to the scope's lifetime, which
//           the bare IIFE does not.)
//
// In TS you'd write (pseudocode):
// ```ts
// // scope.launch { body } ~ void (async () => { body })(); (also scope-bound)
// ```
import kotlinx.coroutines.launch

// =============================================================================
// File summary (folds in the old KDoc's domain content)
// =============================================================================
//
// `Media3Engine` is the PURE-KOTLIN audio engine: a thin wrapper over ExoPlayer using
// its default renderers, so audio is decoded by the platform MediaCodec (no
// media3-decoder extension; the Pixel 6 decodes Opus and FLAC natively, verified on
// device). It is created and driven on the MAIN thread, which owns the player's
// application looper. It plays one track at a time; `PlayerController` (shared `main`
// code) owns the queue and advances on `setOnTrackEnded`.
//
// ExoPlayer handles audio focus and the "becoming noisy" (headphone unplug) broadcast
// ITSELF once enabled, so a phone call ducks/pauses this player and unplugging headphones
// pauses it, with no focus code of our own. Focus lives in the inner ExoPlayer (not the
// `MediaSession` wrapper or the session module), so it must be enabled here; a
// focus-induced pause surfaces through `setOnPlayingChanged` like any other pause, which
// is what keeps the notification/lockscreen state correct.
//
// It implements the shared `AudioEngine` interface (declared in `main`), the same
// contract the full-Rust `RustEngine` implements, so `PlayerController` drives either
// backend identically. Note `LOG_TAG` is defined in the shared `main` source set, not
// here. The per-track normalization gain is resolved off-thread (cache hit, else a full
// offline decode) and applied only when its load is still the current one.

// What:     `@OptIn(UnstableApi::class)` is an annotation on the class: "I accept the
//           unstable API `UnstableApi`". `UnstableApi::class` is a class-literal naming the
//           opt-in marker.
// Why:      The Media3 sink/renderer/player APIs used here are `@UnstableApi`; without this
//           the class will not compile.
// TS map:   No equivalent. Mentally a decorator suppressing an experimental-API error.
//
// In TS you'd write (pseudocode):
// ```ts
// // No annotation — TS has no compiler-enforced opt-in for unstable APIs.
// ```
@OptIn(UnstableApi::class)
// What:     `class Media3Engine(context: Context) : AudioEngine { ... }` declares a class
//           with a primary constructor taking one `Context` parameter (no `val`, so it is
//           NOT stored as a field; it is used during construction only) that IMPLEMENTS the
//           `AudioEngine` INTERFACE. In Kotlin the `:` after the constructor introduces the
//           supertype; because `AudioEngine` is an interface there is no `()` after it (you
//           implement an interface, you do not construct it).
// Why:      Provide the Media3/ExoPlayer implementation of the backend-agnostic
//           `AudioEngine` contract.
// TS map:   `class Media3Engine implements AudioEngine { constructor(context: Context) { ... } }`
//           — Kotlin's `: AudioEngine` (no parentheses) is TS's `implements AudioEngine`.
// Gotcha:   A supertype WITH `()` (like `BaseAudioProcessor()`) is a superclass constructor
//           call; a supertype WITHOUT `()` (like `AudioEngine`) is an interface being
//           implemented. The presence/absence of `()` is the tell.
//
// In TS you'd write (pseudocode):
// ```ts
// class Media3Engine implements AudioEngine {
//   constructor(context: Context) { /* ...fields below... */ }
// }
// ```
class Media3Engine(context: Context) : AudioEngine {
    // What:     `private val gainProcessor: GainNormalizationProcessor = GainNormalizationProcessor()`
    //           declares a private, read-only (`val`) PROPERTY initialised to a fresh
    //           `GainNormalizationProcessor` (constructor call, no `new`).
    // Why:      The true-peak normalization stage installed in the ExoPlayer pipeline (via
    //           `GainRenderersFactory`); the engine sets its per-track `gain` when a track
    //           loads. It starts at unity (passthrough) until a gain is resolved.
    // TS map:   `private readonly gainProcessor = new GainNormalizationProcessor();`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly gainProcessor = new GainNormalizationProcessor();
    // ```
    private val gainProcessor: GainNormalizationProcessor = GainNormalizationProcessor()

    // What:     `private val player: ExoPlayer = ExoPlayer.Builder(context)....apply { ... }`
    //           declares a private read-only `player` property built by a FLUENT BUILDER
    //           CHAIN ending in an `.apply { ... }` block. The whole right-hand side is one
    //           expression spanning the next lines, each step commented below:
    //           - `ExoPlayer.Builder(context)` constructs the builder (no `new`).
    //           - `.setRenderersFactory(...)` / `.setHandleAudioBecomingNoisy(true)` / `.build()`
    //             configure and finalise the player.
    //           - `.apply { ... }` is a SCOPE FUNCTION: it runs the block with the just-built
    //             player as the receiver (`this` inside the block IS the player) and RETURNS
    //             that same player. It is used here to call a setter as part of the
    //             initialisation expression.
    // Why:      Build the ExoPlayer with our normalization renderers factory and
    //           becoming-noisy handling, then enable audio focus via `setAudioAttributes`,
    //           all in one initialiser.
    // TS map:   `private readonly player: ExoPlayer = (() => { const p = new ExoPlayer.Builder(context).setRenderersFactory(...).setHandleAudioBecomingNoisy(true).build(); p.setAudioAttributes(AudioAttributes.DEFAULT, true); return p; })();`
    //           — Kotlin's `.apply { }` is TS's "build it, run some setup on it, return it"
    //           IIFE; `this` inside `apply` is the object being configured.
    // Gotcha:   `.apply { }` returns the SAME object (the receiver), not the block's last
    //           value. (Its sibling `.let { }` returns the block's value instead.)
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly player: ExoPlayer = (() => {
    //   const p = new ExoPlayer.Builder(context)
    //     .setRenderersFactory(new GainRenderersFactory(context, this.gainProcessor))
    //     .setHandleAudioBecomingNoisy(true)
    //     .build();
    //   p.setAudioAttributes(AudioAttributes.DEFAULT, /* handleAudioFocus */ true);
    //   return p;
    // })();
    // ```
    private val player: ExoPlayer = ExoPlayer.Builder(context)
        // What:     `.setRenderersFactory(GainRenderersFactory(context, gainProcessor))`
        //           tells the builder to use our custom renderers factory, constructed
        //           inline (`GainRenderersFactory(context, gainProcessor)`, no `new`) with
        //           the engine's `gainProcessor` instance.
        // Why:      Apply per-track true-peak normalization inside ExoPlayer's own audio
        //           pipeline (the factory installs the gain stage in the sink).
        // TS map:   `.setRenderersFactory(new GainRenderersFactory(context, this.gainProcessor))`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // .setRenderersFactory(new GainRenderersFactory(context, this.gainProcessor))
        // ```
        .setRenderersFactory(GainRenderersFactory(context, gainProcessor))
        // What:     `.setHandleAudioBecomingNoisy(true)` opts the player into the framework's
        //           "audio becoming noisy" handling (the broadcast fired when headphones are
        //           unplugged), passing the boolean literal `true`.
        // Why:      Pause/resume around a headphone unplug; without it audio keeps blaring on
        //           the speaker.
        // TS map:   `.setHandleAudioBecomingNoisy(true)`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // .setHandleAudioBecomingNoisy(true)
        // ```
        .setHandleAudioBecomingNoisy(true)
        // What:     `.build()` finalises the builder and returns the constructed `ExoPlayer`.
        // Why:      Produce the actual player instance the `.apply { }` then configures.
        // TS map:   `.build()`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // .build()
        // ```
        .build()
        // What:     `.apply { ... }` runs the block with the built player as `this` and
        //           returns that same player (the value assigned to `player`).
        // Why:      Configure audio attributes / focus on the player as part of building it.
        // TS map:   The "run setup, return the same object" IIFE shown in the property block.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // p => { p.setAudioAttributes(AudioAttributes.DEFAULT, true); return p; }
        // ```
        .apply {
            // What:     `setAudioAttributes(AudioAttributes.DEFAULT, /* handleAudioFocus = */ true)`
            //           calls the player's `setAudioAttributes` (unqualified because `this`
            //           inside `apply` is the player). `AudioAttributes.DEFAULT` is the
            //           ready-made media-usage attributes; the `/* handleAudioFocus = */ true`
            //           is the second positional argument with an INLINE BLOCK COMMENT naming
            //           it (a Kotlin idiom for documenting a bare boolean argument).
            // Why:      `handleAudioFocus=true` makes ExoPlayer request focus and pause/duck on
            //           loss (phone call, another media app) by itself. `AudioAttributes.DEFAULT`
            //           already carries `usage=USAGE_MEDIA`, which the focus path requires, so
            //           this cannot throw.
            // TS map:   `p.setAudioAttributes(AudioAttributes.DEFAULT, /* handleAudioFocus */ true);`
            //           — the `/* name = */` inline comment is just argument documentation; TS
            //           would more likely use an options object `{ handleAudioFocus: true }`.
            // Gotcha:   `/* handleAudioFocus = */` is a COMMENT, not a named-argument syntax;
            //           the call is purely positional. It only documents what the `true` means.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // p.setAudioAttributes(AudioAttributes.DEFAULT, /* handleAudioFocus */ true);
            // ```
            setAudioAttributes(AudioAttributes.DEFAULT, /* handleAudioFocus = */ true)
        }
    // What:     `private var onPlayingChanged: ((Boolean) -> Unit)? = null` declares a
    //           private, reassignable (`var`) property whose type is `((Boolean) -> Unit)?`:
    //           a NULLABLE FUNCTION TYPE. `(Boolean) -> Unit` is "a function taking a
    //           `Boolean` and returning `Unit` (void)"; the trailing `?` makes it nullable
    //           (a function OR `null`). Initial value `null`.
    // Why:      Holds the play/pause-state callback the controller registers, or `null` when
    //           none is set yet.
    // TS map:   `private onPlayingChanged: ((playing: boolean) => void) | null = null;` — the
    //           `?` suffix is TS's `| null`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private onPlayingChanged: ((playing: boolean) => void) | null = null;
    // ```
    private var onPlayingChanged: ((Boolean) -> Unit)? = null
    // What:     `private var onTrackEnded: (() -> Unit)? = null` declares a private,
    //           reassignable nullable callback taking NO arguments and returning `Unit`,
    //           initial `null`. `() -> Unit` = "no-arg void function".
    // Why:      Holds the natural-end callback, or `null` until set.
    // TS map:   `private onTrackEnded: (() => void) | null = null;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private onTrackEnded: (() => void) | null = null;
    // ```
    private var onTrackEnded: (() -> Unit)? = null

    // What:     `private val appContext: Context = context.applicationContext` declares a
    //           private read-only `Context` property holding the APPLICATION context
    //           (`context.applicationContext`), which lives for the whole process.
    // Why:      The off-thread gain resolution (cache + measure) needs a context; using the
    //           application context holds it WITHOUT leaking the (short-lived) activity.
    // TS map:   `private readonly appContext: Context = context.applicationContext;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly appContext: Context = context.applicationContext;
    // ```
    private val appContext: Context = context.applicationContext

    // What:     `private val resolveScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)`
    //           declares a private read-only `CoroutineScope`. Pieces:
    //           - `SupervisorJob()` constructs a supervisor job (children fail independently).
    //           - `+` here COMBINES two coroutine-context elements (job and dispatcher) into
    //             one context. This `+` is OPERATOR OVERLOADING: Kotlin lets `CoroutineContext`
    //             define what `+` means; it is NOT numeric addition.
    //           - `Dispatchers.Default` picks the CPU-work thread pool.
    //           - `CoroutineScope(...)` wraps that context into a scope.
    // Why:      A scope to launch per-track gain resolution on a background pool; cancelled in
    //           `release()` so a pending measure cannot outlive the engine.
    // TS map:   No clean equivalent. Mentally `const resolveScope = new AbortController();`
    //           plus "run its tasks on a background worker, and one failing task must not
    //           cancel the others".
    // Gotcha:   `+` on coroutine contexts is OVERLOADED (context merge), not arithmetic. A TS
    //           reader must not read it as adding numbers.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // Mentally: an AbortController owning background tasks; siblings fail independently.
    // const resolveScope = new AbortController();
    // ```
    private val resolveScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // What:     `@Volatile` annotates the field below so cross-thread reads always see the
    //           latest write (no per-thread caching, no reordering).
    // Why:      `loadGeneration` is written on the MAIN thread (`load`) and read on a
    //           BACKGROUND thread (the resolution coroutine); `@Volatile` keeps that read
    //           current.
    // TS map:   No equivalent (single-threaded JS); mentally "shared across threads, read fresh".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // No annotation — single-threaded JS needs no volatile.
    // ```
    @Volatile
    // What:     `private var loadGeneration: Int = 0` declares a private, reassignable
    //           32-bit `Int` counter starting at 0. Sibling `Long` (64-bit) is unnecessary:
    //           a session never loads anywhere near 2 billion tracks.
    // Why:      Monotonic load counter. Each `load` bumps it; a resolved gain is applied only
    //           when the load that requested it is still current, so a measure that finishes
    //           after the user skipped ahead cannot retag the new track with the old gain.
    // TS map:   `private loadGeneration = 0;` (TS `number`).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private loadGeneration = 0;
    // ```
    private var loadGeneration: Int = 0

    // What:     `init { ... }` is an INITIALIZER BLOCK: code that runs as part of constructing
    //           the instance, after the property initialisers above. A class may have several;
    //           they run in source order.
    // Why:      Register the player listener once at construction so the engine starts
    //           receiving playback events immediately.
    // TS map:   The body of the TS `constructor(...)` after the field initialisers.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // (inside the constructor body)
    // ```
    init {
        // What:     `player.addListener(object : Player.Listener { ... })` registers a
        //           listener. `object : Player.Listener { ... }` is an OBJECT EXPRESSION: it
        //           creates a one-off anonymous instance that implements the `Player.Listener`
        //           interface inline, overriding the callbacks we care about. (Kotlin's
        //           equivalent of an anonymous class / inline interface implementation.)
        // Why:      Bridge ExoPlayer's events to our callbacks without a separately named
        //           listener class.
        // TS map:   `player.addListener({ onIsPlayingChanged(p) {...}, onPlaybackStateChanged(s) {...}, onPlayerError(e) {...} });`
        //           — an object literal implementing the listener interface inline.
        // Gotcha:   `object : Type { }` is an anonymous instance, NOT a type declaration; it is
        //           created right here and passed as an argument.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // player.addListener({
        //   onIsPlayingChanged: (isPlaying) => this.onPlayingChanged?.(isPlaying),
        //   onPlaybackStateChanged: (state) => { if (state === Player.STATE_ENDED) this.onTrackEnded?.(); },
        //   onPlayerError: (error) => Log.e(LOG_TAG, `ExoPlayer error: ${error.errorCodeName}`, error),
        // });
        // ```
        player.addListener(object : Player.Listener {
            // What:     `override fun onIsPlayingChanged(isPlaying: Boolean) { ... }` overrides
            //           the listener callback fired when play/pause state flips. `override` is
            //           mandatory.
            // Why:      Forward the new playing state to our registered callback.
            // TS map:   `onIsPlayingChanged(isPlaying: boolean) { ... }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // onIsPlayingChanged(isPlaying: boolean) { this.onPlayingChanged?.(isPlaying); }
            // ```
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                // What:     `onPlayingChanged?.invoke(isPlaying)` calls the nullable callback.
                //           `?.` is the SAFE-CALL operator: invoke only if `onPlayingChanged`
                //           is non-null, otherwise do nothing. `.invoke(x)` is how you CALL a
                //           value of function type (Kotlin also allows `onPlayingChanged(x)`,
                //           but on a nullable you must write `?.invoke(x)`).
                // Why:      Notify the controller of the play-state change, safely skipping when
                //           no callback is registered.
                // TS map:   `this.onPlayingChanged?.(isPlaying);` — TS's `?.()` optional call is
                //           Kotlin's `?.invoke(...)`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.onPlayingChanged?.(isPlaying);
                // ```
                onPlayingChanged?.invoke(isPlaying)
            }

            // What:     `override fun onPlaybackStateChanged(playbackState: Int) { ... }`
            //           overrides the callback fired on a playback-state transition; the state
            //           is an `Int` constant.
            // Why:      Detect the end-of-track state and fire our natural-end callback.
            // TS map:   `onPlaybackStateChanged(playbackState: number) { ... }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // onPlaybackStateChanged(playbackState: number) { ... }
            // ```
            override fun onPlaybackStateChanged(playbackState: Int) {
                // What:     `if (playbackState == Player.STATE_ENDED) { ... }` checks whether the
                //           new state equals the `Player.STATE_ENDED` constant (the track ran to
                //           its natural end). `==` on `Int`s is value comparison.
                // Why:      Only a natural end should fire `onTrackEnded`.
                // TS map:   `if (playbackState === Player.STATE_ENDED) { ... }`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (playbackState === Player.STATE_ENDED) { ... }
                // ```
                if (playbackState == Player.STATE_ENDED) {
                    // What:     `onTrackEnded?.invoke()` safe-calls the nullable no-arg callback:
                    //           invoke it only if non-null.
                    // Why:      Tell the controller the track ended naturally so it can advance.
                    // TS map:   `this.onTrackEnded?.();`
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // this.onTrackEnded?.();
                    // ```
                    onTrackEnded?.invoke()
                }
            }

            // What:     `override fun onPlayerError(error: PlaybackException) { ... }` overrides
            //           the error callback; `error` is the `PlaybackException` ExoPlayer raised.
            // Why:      Log playback errors to logcat for diagnosis.
            // TS map:   `onPlayerError(error: PlaybackException) { ... }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // onPlayerError(error: PlaybackException) { ... }
            // ```
            override fun onPlayerError(error: PlaybackException) {
                // What:     `Log.e(LOG_TAG, "ExoPlayer error: ${error.errorCodeName}", error)`
                //           logs at ERROR level. `LOG_TAG` is the logcat tag (defined in the
                //           shared `main` source set, not this file). `"... ${error.errorCodeName}"`
                //           is a STRING TEMPLATE: `${...}` interpolates the error's human-readable
                //           code name. The third argument is the throwable, so logcat prints its
                //           stack trace.
                // Why:      Record what went wrong without crashing playback.
                // TS map:   ``console.error(`ExoPlayer error: ${error.errorCodeName}`, error);`` —
                //           Kotlin's `${...}` interpolation equals TS template-literal `${...}`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // console.error(`ExoPlayer error: ${error.errorCodeName}`, error);
                // ```
                Log.e(LOG_TAG, "ExoPlayer error: ${error.errorCodeName}", error)
            }
        })
    }

    // What:     `override fun load(uri: String, play: Boolean) { ... }` implements the
    //           `AudioEngine.load` method: load a track by URI and optionally start playing.
    //           `override` because it satisfies the interface.
    // Why:      Point the player at a new track, start playback immediately (so start latency
    //           stays low), and resolve the normalization gain in the background.
    // TS map:   `load(uri: string, play: boolean): void { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // load(uri: string, play: boolean): void { ... }
    // ```
    override fun load(uri: String, play: Boolean) {
        // What:     `Log.i(LOG_TAG, "Media3Engine.load ${uri.substringAfterLast('/')} play=$play")`
        //           logs at INFO level. `uri.substringAfterLast('/')` returns the part of the
        //           string after the last `'/'` (the filename); `'/'` is a CHAR literal (single
        //           quotes), distinct from a `"/"` String. `$play` is shorthand string-template
        //           interpolation of the `play` variable.
        // Why:      Record which track is loading and whether it auto-plays.
        // TS map:   ``console.info(`Media3Engine.load ${uri.split("/").at(-1)} play=${play}`);`` —
        //           `substringAfterLast('/')` ~ "text after the last slash".
        // Gotcha:   `'/'` is a single CHARACTER (`Char`), not a `String`; Kotlin distinguishes
        //           them. `$play` and `${...}` are both template interpolation.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.info(`Media3Engine.load ${uri.split("/").at(-1)} play=${play}`);
        // ```
        Log.i(LOG_TAG, "Media3Engine.load ${uri.substringAfterLast('/')} play=$play")
        // What:     `gainProcessor.gain = GainNormalizationProcessor.UNITY_GAIN` writes the
        //           companion constant `UNITY_GAIN` (1.0) into the processor's `gain` field.
        // Why:      Reset to unity so the new track never plays at the previous track's gain.
        // TS map:   `this.gainProcessor.gain = GainNormalizationProcessor.UNITY_GAIN;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.gainProcessor.gain = GainNormalizationProcessor.UNITY_GAIN;
        // ```
        gainProcessor.gain = GainNormalizationProcessor.UNITY_GAIN
        // What:     `val generation: Int = ++loadGeneration` declares a read-only `Int` local
        //           `generation`. `++loadGeneration` is PRE-INCREMENT: it adds 1 to the field
        //           AND evaluates to the NEW value, which is captured in `generation`.
        // Why:      Tag this particular load with a fresh generation number so the background
        //           resolver can tell whether its result is still current.
        // TS map:   `const generation: number = ++this.loadGeneration;`
        // Gotcha:   `++x` (pre-increment) yields the value AFTER incrementing; `x++` (post)
        //           would yield the value before. Here pre-increment is intended.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const generation: number = ++this.loadGeneration;
        // ```
        val generation: Int = ++loadGeneration
        // What:     `player.setMediaItem(MediaItem.fromUri(uri))` builds a `MediaItem` from the
        //           URI (`MediaItem.fromUri(uri)`, a static factory) and sets it as the player's
        //           single item.
        // Why:      Tell the player what to play.
        // TS map:   `this.player.setMediaItem(MediaItem.fromUri(uri));`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.player.setMediaItem(MediaItem.fromUri(uri));
        // ```
        player.setMediaItem(MediaItem.fromUri(uri))
        // What:     `player.prepare()` tells the player to start buffering the set item.
        // Why:      Required before playback; kicks off decoding/buffering.
        // TS map:   `this.player.prepare();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.player.prepare();
        // ```
        player.prepare()
        // What:     `player.playWhenReady = play` ASSIGNS to the player's `playWhenReady`
        //           PROPERTY (a Kotlin property setter; under the hood `setPlayWhenReady(play)`).
        // Why:      Start playback immediately (so start latency stays well under a second) and
        //           resolve the gain in parallel. ExoPlayer buffers for a few hundred
        //           milliseconds before the first audible sample, and a cache hit or fast
        //           measure resolves within that window, so a cached or fast track is already at
        //           its correct gain from the first sound (the desktop's "measure before playing"
        //           effect without delaying the start). A slow miss plays at unity until its
        //           measurement lands, then a brief one-time level correction. Delaying the start
        //           to block on the gain was tried and rejected: it pushed start past a second
        //           because ExoPlayer buffers after the deferred start.
        // TS map:   `this.player.playWhenReady = play;` — Kotlin property assignment is the same
        //           shape; it just dispatches to a setter.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.player.playWhenReady = play;
        // ```
        player.playWhenReady = play
        // What:     `resolveScope.launch { ... }` starts a coroutine on `resolveScope` that runs
        //           the trailing lambda CONCURRENTLY and returns immediately (fire-and-forget).
        //           The `{ ... }` is a TRAILING LAMBDA (the block passed as the last argument).
        // Why:      Resolve the normalization gain off the main thread without blocking playback.
        // TS map:   `void (async () => { ... })();` — kick off background async work, do not await.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // void (async () => {
        //   const resolved = await this.resolveNormalizationGain(uri);
        //   if (generation === this.loadGeneration) {
        //     this.gainProcessor.gain = resolved;
        //     console.info(`normalization gain ${resolved} for ${uri.split("/").at(-1)}`);
        //   }
        // })();
        // ```
        resolveScope.launch {
            // What:     `val resolved: Float = resolveNormalizationGain(uri)` declares a read-only
            //           `Float` local and calls the SUSPEND function `resolveNormalizationGain`.
            //           Calling a suspend function SUSPENDS this coroutine until it completes
            //           (like `await`), without blocking the thread.
            // Why:      Get this track's gain (cache hit or fresh measure).
            // TS map:   `const resolved: number = await this.resolveNormalizationGain(uri);` —
            //           a suspend call is Kotlin's `await`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const resolved: number = await this.resolveNormalizationGain(uri);
            // ```
            val resolved: Float = resolveNormalizationGain(uri)
            // What:     `if (generation == loadGeneration) { ... }` compares the captured
            //           `generation` against the current `loadGeneration` field.
            // Why:      Apply only if this load is still current; the measurement was cached
            //           regardless, so a superseded load's work is not wasted.
            // TS map:   `if (generation === this.loadGeneration) { ... }`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (generation === this.loadGeneration) { ... }
            // ```
            if (generation == loadGeneration) {
                // What:     `gainProcessor.gain = resolved` writes the resolved gain into the
                //           processor's `@Volatile` `gain` field (read by the audio thread).
                // Why:      Apply this track's normalization.
                // TS map:   `this.gainProcessor.gain = resolved;`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // this.gainProcessor.gain = resolved;
                // ```
                gainProcessor.gain = resolved
                // What:     `Log.i(LOG_TAG, "normalization gain $resolved for ${uri.substringAfterLast('/')}")`
                //           logs the applied gain and filename (string-template interpolation).
                // Why:      Make the resolved gain observable in logcat.
                // TS map:   ``console.info(`normalization gain ${resolved} for ${uri.split("/").at(-1)}`);``
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // console.info(`normalization gain ${resolved} for ${uri.split("/").at(-1)}`);
                // ```
                Log.i(LOG_TAG, "normalization gain $resolved for ${uri.substringAfterLast('/')}")
            }
        }
    }

    // What:     `private suspend fun resolveNormalizationGain(uri: String): Float { ... }`
    //           declares a PRIVATE SUSPEND function taking a `String` and returning a `Float`.
    //           `suspend` marks it as a function that can pause/await without blocking a
    //           thread; only other suspend functions or coroutines may call it.
    // Why:      Resolve the track's true-peak normalization gain: a `PeakCacheStore` hit
    //           returns immediately; a miss measures the track now (a full offline decode via
    //           `Media3TruePeakDecoder`), caches the peak unconditionally, and returns the gain.
    //           A track whose size cannot be fingerprinted, or whose decode fails, plays at
    //           unity gain (the downstream clamp still guards against clipping). The
    //           cancellation of a superseded load is propagated so structured cancellation
    //           still works.
    // TS map:   `private async resolveNormalizationGain(uri: string): Promise<number> { ... }`
    //           — Kotlin's `suspend` is TS's `async`; the return type stays `Float`/`number`
    //           (Kotlin does not write `Promise<>` in the signature).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private async resolveNormalizationGain(uri: string): Promise<number> { ... }
    // ```
    private suspend fun resolveNormalizationGain(uri: String): Float {
        // What:     `val parsed = uri.toUri()` declares a read-only local `parsed` (type
        //           inferred as `Uri`) by calling the `toUri()` EXTENSION on the string.
        // Why:      The cache key and decoder need a parsed `Uri`, not the raw string.
        // TS map:   `const parsed = toUri(uri);` (or `new URL(uri)`).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const parsed = toUri(uri);
        // ```
        val parsed = uri.toUri()
        // What:     `val key: String = TrackFingerprint.of(appContext, parsed) ?: return GainNormalizationProcessor.UNITY_GAIN`
        //           declares a read-only `String` `key`. `TrackFingerprint.of(...)` (a shared
        //           `main` helper) returns a nullable `String?` fingerprint, or `null` when the
        //           track cannot be fingerprinted. `?:` is the ELVIS operator: use the left
        //           value if non-null, otherwise evaluate the right side, which here is
        //           `return GainNormalizationProcessor.UNITY_GAIN` (returns unity from the whole
        //           function).
        // Why:      Without a fingerprint we cannot cache or look up a peak, so fall back to
        //           unity gain immediately.
        // TS map:   `const fp = TrackFingerprint.of(this.appContext, parsed); if (fp === null) return GainNormalizationProcessor.UNITY_GAIN; const key = fp;`
        // Gotcha:   `?: return X` is Kotlin's "unwrap-or-bail": the Elvis right side can be a
        //           `return`, so this both null-checks and early-returns in one line. `key` is
        //           non-null `String` afterward.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const fp = TrackFingerprint.of(this.appContext, parsed);
        // if (fp === null) return GainNormalizationProcessor.UNITY_GAIN;
        // const key: string = fp;
        // ```
        val key: String = TrackFingerprint.of(appContext, parsed)
            ?: return GainNormalizationProcessor.UNITY_GAIN
        // What:     `PeakCacheStore.get(appContext, key)?.let { cachedPeak -> return normalizationGain(cachedPeak) }`
        //           looks up a cached peak and, if present, returns its gain. Pieces:
        //           - `PeakCacheStore.get(appContext, key)` returns a nullable cached peak
        //             (`Float?`).
        //           - `?.let { ... }` runs the lambda ONLY when the lookup is non-null
        //             (safe-call + scope function); `cachedPeak` is the NAMED lambda parameter
        //             (the non-null peak).
        //           - `return normalizationGain(cachedPeak)` inside the lambda returns from the
        //             WHOLE function (a non-local return, legal because `let` is inline).
        // Why:      A cache hit short-circuits: convert the cached peak to a gain and return it
        //           without measuring.
        // TS map:   `const cachedPeak = PeakCacheStore.get(this.appContext, key); if (cachedPeak !== null) return normalizationGain(cachedPeak);`
        // Gotcha:   The `return` inside `?.let { }` returns from `resolveNormalizationGain`, not
        //           just from the lambda. This NON-LOCAL return works because `let` is an inline
        //           function; it would surprise a TS reader expecting the `return` to exit only
        //           the callback.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const cachedPeak = PeakCacheStore.get(this.appContext, key);
        // if (cachedPeak !== null) return normalizationGain(cachedPeak);
        // ```
        PeakCacheStore.get(appContext, key)?.let { cachedPeak ->
            return normalizationGain(cachedPeak)
        }
        // What:     `val peak: Float = try { ... } catch (...) { ... } catch (...) { ... }`
        //           declares a read-only `Float` `peak` from a TRY EXPRESSION: in Kotlin
        //           `try/catch` is an EXPRESSION whose value is the `try` block's result (or a
        //           catch block's result if it throws). Here:
        //           - the `try` body `Media3TruePeakDecoder.measure(appContext, parsed)` is the
        //             value when it succeeds;
        //           - the first `catch (cancellation: CancellationException)` RETHROWS, so it
        //             produces no value;
        //           - the second `catch (failure: Exception)` logs and `return`s unity (also no
        //             value for the expression).
        // Why:      Measure the track now (a full offline decode), but treat a cancellation as a
        //           real cancellation (rethrow) and any other failure as "use unity gain".
        // TS map:   `let peak: number; try { peak = await Media3TruePeakDecoder.measure(...); } catch (e) { if (e is CancellationException) throw e; log; return UNITY_GAIN; }`
        // Gotcha:   Kotlin `try` can be an EXPRESSION assigned to a `val`; TS `try` is only a
        //           statement, so the TS version needs a separate `let` first.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let peak: number;
        // try {
        //   peak = await Media3TruePeakDecoder.measure(this.appContext, parsed);
        // } catch (e) {
        //   if (e instanceof CancellationException) throw e;
        //   console.warn(`true-peak measure failed for ${uri}; using unity gain`, e);
        //   return GainNormalizationProcessor.UNITY_GAIN;
        // }
        // ```
        val peak: Float = try {
            // What:     `Media3TruePeakDecoder.measure(appContext, parsed)` calls the suspend
            //           `measure` on the decoder object; it returns the track's true peak. This
            //           is the `try` block's tail value (the value of `peak` on success).
            // Why:      Perform the actual offline decode + measurement on a cache miss.
            // TS map:   `peak = await Media3TruePeakDecoder.measure(this.appContext, parsed);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // peak = await Media3TruePeakDecoder.measure(this.appContext, parsed);
            // ```
            Media3TruePeakDecoder.measure(appContext, parsed)
        } catch (cancellation: CancellationException) {
            // What:     `throw cancellation` RETHROWS the caught `CancellationException` unchanged.
            // Why:      A cancelled measurement must propagate as cancellation (structured
            //           cancellation), NOT be swallowed as a decode failure.
            // TS map:   `if (e instanceof CancellationException) throw e;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // throw e; // it was a CancellationException
            // ```
            throw cancellation
        } catch (failure: Exception) {
            // What:     `Log.w(LOG_TAG, "true-peak measure failed for $uri; using unity gain", failure)`
            //           logs at WARN level with the throwable, then the next line returns unity.
            //           `catch (failure: Exception)` catches any non-cancellation exception.
            // Why:      A genuine decode failure should not crash; fall back to unity gain.
            // TS map:   `console.warn(`true-peak measure failed for ${uri}; using unity gain`, e);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.warn(`true-peak measure failed for ${uri}; using unity gain`, e);
            // ```
            Log.w(LOG_TAG, "true-peak measure failed for $uri; using unity gain", failure)
            // What:     `return GainNormalizationProcessor.UNITY_GAIN` returns unity from the
            //           whole function (the catch block's escape).
            // Why:      Play the track unprocessed rather than failing the load.
            // TS map:   `return GainNormalizationProcessor.UNITY_GAIN;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return GainNormalizationProcessor.UNITY_GAIN;
            // ```
            return GainNormalizationProcessor.UNITY_GAIN
        }
        // What:     `PeakCacheStore.put(appContext, key, peak)` stores the freshly measured peak
        //           under the fingerprint key.
        // Why:      Cache the measurement so future loads of this track skip the decode.
        // TS map:   `PeakCacheStore.put(this.appContext, key, peak);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // PeakCacheStore.put(this.appContext, key, peak);
        // ```
        PeakCacheStore.put(appContext, key, peak)
        // What:     `PeakCacheStore.flush(appContext)` persists the cache to disk.
        // Why:      Make the new cache entry durable across app restarts.
        // TS map:   `PeakCacheStore.flush(this.appContext);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // PeakCacheStore.flush(this.appContext);
        // ```
        PeakCacheStore.flush(appContext)
        // What:     `return normalizationGain(peak)` converts the measured peak into the gain and
        //           returns it. Explicit `return` (block body).
        // Why:      Hand back the gain for this track.
        // TS map:   `return normalizationGain(peak);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return normalizationGain(peak);
        // ```
        return normalizationGain(peak)
    }

    // What:     `override fun play() { ... }` implements `AudioEngine.play`.
    // Why:      Resume playback.
    // TS map:   `play(): void { this.player.play(); }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // play(): void { this.player.play(); }
    // ```
    override fun play() {
        // What:     `player.play()` tells ExoPlayer to start/resume.
        // Why:      Begin audible playback.
        // TS map:   `this.player.play();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.player.play();
        // ```
        player.play()
    }

    // What:     `override fun pause() { ... }` implements `AudioEngine.pause`.
    // Why:      Pause playback.
    // TS map:   `pause(): void { this.player.pause(); }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // pause(): void { this.player.pause(); }
    // ```
    override fun pause() {
        // What:     `player.pause()` tells ExoPlayer to pause.
        // Why:      Stop audible playback without releasing the track.
        // TS map:   `this.player.pause();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.player.pause();
        // ```
        player.pause()
    }

    // What:     `override fun seekTo(positionSec: Double) { ... }` implements
    //           `AudioEngine.seekTo`, taking a position in SECONDS as a `Double` (64-bit
    //           float). Sibling `Float` (32-bit) is declined because seconds with sub-millisecond
    //           precision benefit from the wider type and the API speaks `Double`.
    // Why:      Jump to a time position.
    // TS map:   `seekTo(positionSec: number): void { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // seekTo(positionSec: number): void { this.player.seekTo(positionSec * MILLIS_PER_SEC); }
    // ```
    override fun seekTo(positionSec: Double) {
        // What:     `player.seekTo((positionSec * MILLIS_PER_SEC).toLong())` converts seconds to
        //           milliseconds and seeks. `positionSec * MILLIS_PER_SEC` is `Double * Double`
        //           = `Double`; `.toLong()` is a type-CONVERSION truncating the `Double` to a
        //           64-bit `Long` (the unit ExoPlayer's `seekTo` expects: integer milliseconds).
        //           Sibling `.toInt()` (32-bit) would overflow for long media positions.
        // Why:      ExoPlayer seeks in `Long` milliseconds, not seconds.
        // TS map:   `this.player.seekTo(positionSec * MILLIS_PER_SEC);` — TS `number` covers
        //           both, so no explicit `.toLong()`; the seek truncates to an integer ms.
        // Gotcha:   `.toLong()` TRUNCATES toward zero (drops the fraction), it does not round.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.player.seekTo(Math.trunc(positionSec * MILLIS_PER_SEC));
        // ```
        player.seekTo((positionSec * MILLIS_PER_SEC).toLong())
    }

    // What:     `override fun setVolume(volume: Float) { ... }` implements
    //           `AudioEngine.setVolume`, taking a `Float` 0..1 volume.
    // Why:      Set the user volume (applied downstream of normalization).
    // TS map:   `setVolume(volume: number): void { this.player.volume = volume; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setVolume(volume: number): void { this.player.volume = volume; }
    // ```
    override fun setVolume(volume: Float) {
        // What:     `player.volume = volume` assigns the player's `volume` PROPERTY (setter).
        // Why:      The platform `AudioTrack` applies user volume after the gain stage.
        // TS map:   `this.player.volume = volume;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.player.volume = volume;
        // ```
        player.volume = volume
    }

    // What:     `override fun positionSec(): Double { ... }` implements `AudioEngine.positionSec`,
    //           returning the current position in seconds as a `Double`.
    // Why:      Report playback position to the UI poller.
    // TS map:   `positionSec(): number { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // positionSec(): number {
    //   const pos = this.player.currentPosition;
    //   return pos < 0 ? 0.0 : pos / MILLIS_PER_SEC;
    // }
    // ```
    override fun positionSec(): Double {
        // What:     `val pos = player.currentPosition` declares a read-only local `pos` (type
        //           inferred `Long`) holding the player's current position in milliseconds.
        // Why:      Read the raw ms position before converting to seconds.
        // TS map:   `const pos = this.player.currentPosition;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const pos = this.player.currentPosition;
        // ```
        val pos = player.currentPosition
        // What:     `return if (pos < 0L) 0.0 else pos / MILLIS_PER_SEC` returns the value of an
        //           IF/ELSE EXPRESSION (like a ternary). `0L` is a `Long` literal (the `L` suffix
        //           marks 64-bit). When `pos` is negative (unknown), return `0.0`; otherwise
        //           `pos / MILLIS_PER_SEC` is `Long / Double` = `Double` seconds.
        // Why:      A negative position means "unknown"; report 0 rather than a bogus negative
        //           time.
        // TS map:   `return pos < 0 ? 0.0 : pos / MILLIS_PER_SEC;`
        // Gotcha:   `0L` is a `Long`, not an `Int`; the suffix matters because `pos` is `Long`.
        //           `Long / Double` promotes to `Double`, so the division is floating-point.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return pos < 0 ? 0.0 : pos / MILLIS_PER_SEC;
        // ```
        return if (pos < 0L) 0.0 else pos / MILLIS_PER_SEC
    }

    // What:     `override fun durationSec(): Double { ... }` implements `AudioEngine.durationSec`,
    //           returning the track duration in seconds as a `Double`.
    // Why:      Report track length to the UI.
    // TS map:   `durationSec(): number { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // durationSec(): number {
    //   const dur = this.player.duration;
    //   return (dur === C.TIME_UNSET || dur < 0) ? 0.0 : dur / MILLIS_PER_SEC;
    // }
    // ```
    override fun durationSec(): Double {
        // What:     `val dur = player.duration` declares a read-only `Long` local `dur` holding
        //           the player's reported duration in milliseconds (or `C.TIME_UNSET` when
        //           unknown).
        // Why:      Read the raw duration before validating/converting.
        // TS map:   `const dur = this.player.duration;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const dur = this.player.duration;
        // ```
        val dur = player.duration
        // What:     `return if (dur == C.TIME_UNSET || dur < 0L) 0.0 else dur / MILLIS_PER_SEC`
        //           returns an if/else expression. `dur == C.TIME_UNSET` checks the
        //           unknown-duration sentinel; `||` is logical OR; `dur < 0L` guards negatives.
        //           Otherwise `dur / MILLIS_PER_SEC` (`Long / Double` = `Double`) gives seconds.
        // Why:      Report 0 for an unknown or negative duration rather than a bogus value.
        // TS map:   `return (dur === C.TIME_UNSET || dur < 0) ? 0.0 : dur / MILLIS_PER_SEC;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return (dur === C.TIME_UNSET || dur < 0) ? 0.0 : dur / MILLIS_PER_SEC;
        // ```
        return if (dur == C.TIME_UNSET || dur < 0L) 0.0 else dur / MILLIS_PER_SEC
    }

    // What:     `override fun playWhenReady(): Boolean = player.playWhenReady` implements
    //           `AudioEngine.playWhenReady` as an EXPRESSION BODY: it reads and returns the
    //           player's `playWhenReady` property (the boolean "should play once ready").
    // Why:      Expose the intended play/pause state to the controller.
    // TS map:   `playWhenReady(): boolean { return this.player.playWhenReady; }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // playWhenReady(): boolean { return this.player.playWhenReady; }
    // ```
    override fun playWhenReady(): Boolean = player.playWhenReady

    // What:     `override fun setOnPlayingChanged(callback: (Boolean) -> Unit) { ... }` implements
    //           the setter for the play-state callback. `callback: (Boolean) -> Unit` is a
    //           NON-nullable function-type parameter (takes a `Boolean`, returns `Unit`).
    // Why:      Let the controller register its play-state handler.
    // TS map:   `setOnPlayingChanged(callback: (playing: boolean) => void): void { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setOnPlayingChanged(callback: (playing: boolean) => void): void { this.onPlayingChanged = callback; }
    // ```
    override fun setOnPlayingChanged(callback: (Boolean) -> Unit) {
        // What:     `onPlayingChanged = callback` stores the callback in the nullable field.
        // Why:      Remember it so the listener can invoke it on state changes.
        // TS map:   `this.onPlayingChanged = callback;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.onPlayingChanged = callback;
        // ```
        onPlayingChanged = callback
    }

    // What:     `override fun setOnTrackEnded(callback: () -> Unit) { ... }` implements the setter
    //           for the natural-end callback. `callback: () -> Unit` is a no-arg void function.
    // Why:      Let the controller register its track-ended handler.
    // TS map:   `setOnTrackEnded(callback: () => void): void { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // setOnTrackEnded(callback: () => void): void { this.onTrackEnded = callback; }
    // ```
    override fun setOnTrackEnded(callback: () -> Unit) {
        // What:     `onTrackEnded = callback` stores the callback in the nullable field.
        // Why:      Remember it so the listener can invoke it on a natural end.
        // TS map:   `this.onTrackEnded = callback;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.onTrackEnded = callback;
        // ```
        onTrackEnded = callback
    }

    // What:     `override fun release() { ... }` implements `AudioEngine.release`: tear the
    //           engine down.
    // Why:      Cancel any pending gain measure and free the player when the engine is no longer
    //           needed.
    // TS map:   `release(): void { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // release(): void { this.resolveScope.cancel(); this.player.release(); }
    // ```
    override fun release() {
        // What:     `resolveScope.cancel()` cancels the coroutine scope and every coroutine it
        //           owns.
        // Why:      So a pending gain measurement cannot outlive the engine.
        // TS map:   `this.resolveScope.cancel();` ~ `abortController.abort();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.resolveScope.cancel(); // ~ abortController.abort()
        // ```
        resolveScope.cancel()
        // What:     `player.release()` releases the ExoPlayer's resources (codecs, buffers,
        //           audio output).
        // Why:      Free native/audio resources; the engine is done.
        // TS map:   `this.player.release();`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.player.release();
        // ```
        player.release()
    }

    // What:     `companion object { ... }` declares the class's static-like member bag.
    // Why:      Hosts the milliseconds-per-second constant shared by the time conversions.
    // TS map:   `static` members on the class.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // static readonly MILLIS_PER_SEC = 1000.0; on the class
    // ```
    companion object {
        // What:     `private const val MILLIS_PER_SEC: Double = 1000.0` declares a private
        //           compile-time `Double` constant. No `f` suffix, so it is a `Double` (64-bit),
        //           matching the `Double` seconds math; a `Float` here would force casts.
        // Why:      Milliseconds per second, the unit ExoPlayer reports position/duration in.
        // TS map:   `private static readonly MILLIS_PER_SEC = 1000.0;`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // private static readonly MILLIS_PER_SEC = 1000.0;
        // ```
        private const val MILLIS_PER_SEC: Double = 1000.0
    }
}
