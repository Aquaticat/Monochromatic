// ============================================================================
// File summary (folds in the old KDoc that sat on `class PlaybackService`)
// ============================================================================
//
// This file HOSTS the player so audio survives the activity being backgrounded
// or destroyed. It owns the one `PlayerController` brain and the flavor's
// `AudioEngine` (built via `createAudioEngine`), projects the brain to a
// `MediaSession` through `BrainPlayer`, and registers that session with the
// media notification manager itself (`addSession`) so the system notification,
// lockscreen, headset buttons, and foreground-on-play work without any app-side
// `MediaController`.
//
// The in-app activity reaches the SAME brain through a private `LocalBinder`
// (single process), so it reads the brain's page/scope UI state and drives
// actions directly while the session projects the very same brain to the
// system; one source of truth, two views. The audio-read permission can only be
// obtained by the activity, so the library loads either here on a headless
// restart (the grant persists) or on the activity's signal after a fresh grant,
// whichever comes first.
//
// Threading note for a TS reader: this service does real multithreading that
// has no clean JS analogue. It keeps a coroutine SCOPE on the main thread for
// the library-load work and cancels it on destroy; treat the `scope`/`launch`/
// `Job` machinery as "a cancelable async task tied to the UI thread."
// ============================================================================

// What:     `package dev.monochromatic.musicplayer` names the namespace this service
//           lives in, reachable elsewhere as
//           `dev.monochromatic.musicplayer.PlaybackService`.
// Why:      So the manifest and the activity can refer to the service class.
//
// In TS you'd write (pseudocode):
// ```ts
// // No `package` line in TS; the file path is the module identity.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Intent` pulls in `Intent`, Android's "what to do /
//           how I was started" message object. `onBind` receives one; `onStart`-style
//           binds compare its action.
// Why:      `onBind` inspects the binding `Intent`'s action.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Intent } from "android/content";
// ```
import android.content.Intent

// What:     `import android.net.Uri` pulls in `Uri`, Android's parsed URI type.
// Why:      `reloadFromRoot` takes a tree `Uri`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Uri } from "android/net";
// ```
import android.net.Uri

// What:     `import android.os.Binder` pulls in `Binder`, the base class for a local
//           IPC stub. Subclassing it gives the activity a direct in-process handle.
// Why:      The inner `LocalBinder` extends `Binder`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Binder } from "android/os";
// ```
import android.os.Binder

// What:     `import android.os.IBinder` pulls in `IBinder`, the INTERFACE type a bound
//           service returns from `onBind`.
// Why:      `onBind`'s declared return type is `IBinder?`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { IBinder } from "android/os";
// ```
import android.os.IBinder

// What:     `import android.os.Looper` pulls in `Looper`, the object owning a thread's
//           message loop. `Looper.getMainLooper()` is the main/UI thread's looper.
// Why:      `BrainPlayer` is built on the main looper so its callbacks run on the UI
//           thread.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Looper } from "android/os";
// ```
import android.os.Looper

// What:     `import android.util.Log` pulls in `Log`, Android's logger
//           (`Log.i(tag, msg)`).
// Why:      We log lifecycle events and load counts.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Log } from "android/util";
// ```
import android.util.Log

// What:     `import androidx.media3.session.MediaSession` pulls in `MediaSession`, the
//           media3 object that exposes a player to the system (notification,
//           lockscreen, external controllers).
// Why:      The service builds and owns one `MediaSession`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MediaSession } from "media3/session";
// ```
import androidx.media3.session.MediaSession

// What:     `import androidx.media3.session.MediaSessionService` pulls in
//           `MediaSessionService`, the media3 BASE CLASS for a service that hosts one
//           or more sessions (it wires up the foreground notification machinery).
// Why:      `PlaybackService` EXTENDS `MediaSessionService`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { MediaSessionService } from "media3/session";
// ```
import androidx.media3.session.MediaSessionService

// What:     `import kotlinx.coroutines.CoroutineScope` pulls in `CoroutineScope`, the
//           type that bounds the lifetime of a group of coroutines (cancel the scope,
//           cancel all its coroutines).
// Why:      The service keeps a `scope` for its library-load coroutines.
//
// In TS you'd write (pseudocode):
// ```ts
// import { CoroutineScope } from "kotlinx/coroutines"; // ~ owner of async tasks
// ```
import kotlinx.coroutines.CoroutineScope

// What:     `import kotlinx.coroutines.Dispatchers` pulls in `Dispatchers`; we use
//           `Dispatchers.Main` (the UI thread) for the scope.
// Why:      The load coroutine touches the controller/UI state, so it runs on Main.
//
// In TS you'd write (pseudocode):
// ```ts
// // no equivalent — Dispatchers.Main ~ the single UI event loop
// ```
import kotlinx.coroutines.Dispatchers

// What:     `import kotlinx.coroutines.Job` pulls in `Job`, the cancelable HANDLE to a
//           running coroutine (returned by `launch`).
// Why:      `loadJob` holds the in-flight load so a newer load can cancel it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Job } from "kotlinx/coroutines"; // ~ cancelable task handle
// ```
import kotlinx.coroutines.Job

// What:     `import kotlinx.coroutines.SupervisorJob` pulls in `SupervisorJob()`, a
//           factory for a parent `Job` whose CHILDREN fail INDEPENDENTLY (one child's
//           failure does not cancel its siblings or the scope).
// Why:      The scope uses a `SupervisorJob` so a failed load does not tear down the
//           scope for future loads.
//
// In TS you'd write (pseudocode):
// ```ts
// import { SupervisorJob } from "kotlinx/coroutines"; // children fail independently
// ```
import kotlinx.coroutines.SupervisorJob

// What:     `import kotlinx.coroutines.cancel` imports an EXTENSION FUNCTION `cancel()`
//           usable on a `CoroutineScope` (cancels all its coroutines). It is a free
//           function called with dot-syntax; you must import it for `scope.cancel()`
//           to resolve.
// Why:      `onDestroy` calls `scope.cancel()` to stop any in-flight load.
//
// In TS you'd write (pseudocode):
// ```ts
// import { cancel } from "kotlinx/coroutines"; // call as scope.cancel() ~ abort()
// ```
import kotlinx.coroutines.cancel

// What:     `import kotlinx.coroutines.launch` imports the EXTENSION FUNCTION `launch`
//           on `CoroutineScope`: a fire-and-forget coroutine builder that starts a new
//           coroutine and returns a `Job` handle. Importing the function enables the
//           `scope.launch { ... }` call.
// Why:      The two load methods use `scope.launch { ... }` to do the source scan in
//           the background.
//
// In TS you'd write (pseudocode):
// ```ts
// import { launch } from "kotlinx/coroutines"; // scope.launch { } ~ fire-and-forget async
// ```
import kotlinx.coroutines.launch

// What:     `class PlaybackService : MediaSessionService() { ... }` declares a class
//           named `PlaybackService` that EXTENDS `MediaSessionService`. The `: Super()`
//           after the name means "extend `MediaSessionService` and call its no-argument
//           constructor." There is no explicit primary constructor here because
//           Android instantiates the service for us.
// Why:      Subclassing `MediaSessionService` is what makes this a hostable media
//           service with the foreground-notification machinery.
//
// In TS you'd write (pseudocode):
// ```ts
// class PlaybackService extends MediaSessionService {
//   // ...fields and lifecycle methods below...
// }
// ```
class PlaybackService : MediaSessionService() {
    // What:     `private lateinit var controller: PlayerController` declares a private,
    //           REASSIGNABLE (`var`) field whose type is the NON-NULLABLE
    //           `PlayerController`. `lateinit` is the special modifier that says "I
    //           promise to assign this before anyone reads it, so do NOT require an
    //           initializer here and do NOT make the type nullable." It exists for
    //           fields set in a lifecycle callback (`onCreate`) rather than at
    //           construction.
    // Why:      The controller is created in `onCreate` (Android calls that after
    //           construction), so we cannot initialize it on the declaration line, yet
    //           we want it to stay non-null everywhere it is used.
    // Gotcha:   Reading a `lateinit` field BEFORE it is assigned throws
    //           `UninitializedPropertyAccessException` at runtime (it is not null; it is
    //           "not yet set"). `lateinit` only works on non-null `var`s of reference
    //           types.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private controller!: PlayerController; // assigned in onCreate, asserted non-null
    // ```
    private lateinit var controller: PlayerController
    // What:     `private lateinit var brainPlayer: BrainPlayer` declares another private,
    //           deferred-init non-null field (see `controller` for what `lateinit`
    //           means): the media3 projection of the brain.
    // Why:      Also built in `onCreate`, so it needs `lateinit` for the same reason.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private brainPlayer!: BrainPlayer;
    // ```
    private lateinit var brainPlayer: BrainPlayer
    // What:     `private var session: MediaSession? = null` declares a private,
    //           reassignable field whose type is the NULLABLE `MediaSession?` (the
    //           trailing `?` = "a `MediaSession` OR null"), initialised to `null`.
    // Why:      The session exists only between `onCreate` and `onDestroy`; modelling it
    //           as nullable lets `onDestroy` clear it and lets `onGetSession` return it
    //           (possibly null).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private session: MediaSession | null = null;
    // ```
    private var session: MediaSession? = null

    // What:     `private var libraryLoaded: Boolean = false` declares a private,
    //           reassignable boolean field, initialised `false`.
    // Why:      Guards the one-time library load so the activity signal and the headless
    //           self-load do not double it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private libraryLoaded: boolean = false;
    // ```
    private var libraryLoaded: Boolean = false

    // What:     `private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)`
    //           declares a private read-only `CoroutineScope` field. The value is built
    //           by `CoroutineScope(context)`, where the context is
    //           `SupervisorJob() + Dispatchers.Main`. The `+` here is COROUTINE-CONTEXT
    //           COMBINATION (an overloaded operator on `CoroutineContext`), merging two
    //           pieces: a `SupervisorJob()` (children fail independently) and
    //           `Dispatchers.Main` (run on the UI thread).
    // Why:      A main-thread scope for the cursor I/O of the initial library query; the
    //           supervisor job keeps one failed load from killing the scope.
    // Gotcha:   The `+` is NOT numeric addition; it is operator overloading that MERGES
    //           coroutine-context elements. TS has no such operator overloading.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly scope: CoroutineScope = newScope({
    //   job: supervisorJob(),     // children fail independently
    //   dispatcher: Dispatchers.Main, // run on the UI thread
    // });
    // ```
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    // What:     `private var loadJob: Job? = null` declares a private, reassignable field
    //           of the NULLABLE handle type `Job?` (a running coroutine, or null),
    //           initialised `null`.
    // Why:      Holds the in-flight library load so a newer load (a folder re-pick
    //           superseding the initial self-load) can cancel it first; without this a
    //           slow MediaStore self-load could deliver after a fast folder scan and
    //           wrongly overwrite the chosen library.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private loadJob: Job | null = null;
    // ```
    private var loadJob: Job? = null

    // What:     `private val localBinder: LocalBinder = LocalBinder()` declares a private
    //           read-only field holding one `LocalBinder` instance, built by calling its
    //           constructor `LocalBinder()` (no `new` keyword).
    // Why:      `onBind` hands this same instance to the activity for direct
    //           (same-process) access to the brain.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private readonly localBinder: LocalBinder = new LocalBinder();
    // ```
    private val localBinder: LocalBinder = LocalBinder()

    // What:     `inner class LocalBinder : Binder() { ... }` declares a NESTED class
    //           `LocalBinder` that EXTENDS `Binder`. The `inner` keyword is the crucial
    //           part: an `inner` class holds an implicit reference to its OUTER
    //           `PlaybackService` instance, so it can reach the outer's members (via
    //           `this@PlaybackService`). A plain nested `class` (without `inner`) would
    //           NOT have that outer reference.
    // Why:      It hands the in-app activity a direct handle to the service-owned brain
    //           (same process), plus a permission-gated library-load trigger; being
    //           `inner` is what lets it forward to the outer service's `controller` and
    //           methods.
    // Gotcha:   Inside `LocalBinder`, bare `this` is the BINDER, not the service; the
    //           service is `this@PlaybackService` (see the qualified-this lines below).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // class LocalBinder extends Binder {
    //   // (conceptually carries a reference `outer` to the PlaybackService)
    // }
    // ```
    inner class LocalBinder : Binder() {
        // What:     `val controller: PlayerController get() = this@PlaybackService.controller`
        //           declares a read-only property `controller` with a CUSTOM GETTER: the
        //           `get() = <expr>` means "every read of this property runs `<expr>`."
        //           The expression `this@PlaybackService.controller` is a QUALIFIED `this`:
        //           `this@PlaybackService` is the OUTER service instance (not the binder),
        //           and `.controller` reads its field.
        // Why:      It exposes the service-owned brain to the activity, always reflecting
        //           the service's current `controller` (recomputed on each access, so it
        //           is never a stale snapshot).
        // Gotcha:   `this@PlaybackService` is REQUIRED because bare `this` here is the
        //           `LocalBinder`; the `@Name` qualifies which `this` you mean.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // get controller(): PlayerController {
        //   return this.outer.controller;
        // }
        // ```
        val controller: PlayerController get() = this@PlaybackService.controller

        // What:     `fun ensureLibraryLoaded() = this@PlaybackService.ensureLibraryLoaded()`
        //           declares a method with an EXPRESSION body (`= <expr>` is the return)
        //           that simply FORWARDS to the outer service's `ensureLibraryLoaded()`
        //           via qualified `this`.
        // Why:      The activity calls this (once it has the audio grant) to ask the
        //           service to load the library; the binder just relays it inward.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // ensureLibraryLoaded(): void {
        //   this.outer.ensureLibraryLoaded();
        // }
        // ```
        fun ensureLibraryLoaded() = this@PlaybackService.ensureLibraryLoaded()

        // What:     `fun reloadFromRoot(treeUri: Uri) = this@PlaybackService.reloadFromRoot(treeUri)`
        //           declares an expression-body method forwarding to the outer service's
        //           `reloadFromRoot(treeUri)`.
        // Why:      The activity calls this after taking a persistable grant for a picked
        //           folder; the binder relays the chosen tree URI to the service.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // reloadFromRoot(treeUri: Uri): void {
        //   this.outer.reloadFromRoot(treeUri);
        // }
        // ```
        fun reloadFromRoot(treeUri: Uri) = this@PlaybackService.reloadFromRoot(treeUri)

        // What:     `fun rescan() = this@PlaybackService.rescan()` declares an
        //           expression-body method forwarding to the outer service's `rescan()`.
        // Why:      The activity calls this when it comes to the foreground (on rebind), so
        //           the service re-scans the source and reconciles the queue (live update),
        //           preserving the playing track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // rescan(): void { this.outer.rescan(); }
        // ```
        fun rescan() = this@PlaybackService.rescan()

        // What:     `fun saveSession() = this@PlaybackService.saveSession()` declares an
        //           expression-body method forwarding to the outer service's `saveSession()`.
        // Why:      The activity calls this in `onStop` (before unbinding) so the live resume
        //           position is captured even when the user backgrounds mid-track while
        //           playing (no state-change event fires then, so `onPersist` would miss it).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // saveSession(): void { this.outer.saveSession(); }
        // ```
        fun saveSession() = this@PlaybackService.saveSession()
    }

    // What:     `override fun onCreate() { ... }` overrides the service lifecycle hook
    //           Android calls when the service is first created. `override` is mandatory
    //           when replacing a base method.
    // Why:      Build the brain, the projection, and the session, start the notification
    //           machinery, and (if a grant persists) self-load the library.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onCreate(): void { ... }
    // ```
    override fun onCreate() {
        // What:     `super.onCreate()` calls the BASE class's `onCreate` first.
        //           `super` refers to `MediaSessionService`; this runs its setup before
        //           ours.
        // Why:      The framework must do its own initialization before we add a session.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // super.onCreate();
        // ```
        super.onCreate()
        // What:     `Log.i(LOG_TAG, "PlaybackService.onCreate")` logs an info line. `LOG_TAG`
        //           is the shared tag declared in `MainActivity.kt`. (Dropped the old
        //           `flavor=${BuildConfig.FLAVOR}` suffix: the media3/hybrid flavors are gone,
        //           so there is one engine and no FLAVOR constant.)
        // Why:      Record service creation in logcat, for verification.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.info(`[${LOG_TAG}] PlaybackService.onCreate`);
        // ```
        Log.i(LOG_TAG, "PlaybackService.onCreate")
        // What:     `controller = PlayerController(createAudioEngine(this))` ASSIGNS the
        //           `lateinit` field. `PlayerController(...)` is a constructor call (no
        //           `new`); its argument `createAudioEngine(this)` is a flavor-specific
        //           factory that builds the audio engine, passed `this` (the service as a
        //           `Context`).
        // Why:      Create the one brain, wired to the flavor's audio engine.
        // Gotcha:   This is the assignment the `lateinit` promised; reading `controller`
        //           before this line would throw.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.controller = new PlayerController(createAudioEngine(this));
        // ```
        controller = PlayerController(createAudioEngine(this))
        // What:     `brainPlayer = BrainPlayer(controller, Looper.getMainLooper())` assigns
        //           the other `lateinit` field by constructing a `BrainPlayer` from the
        //           brain and the MAIN looper (`Looper.getMainLooper()` returns the UI
        //           thread's looper).
        // Why:      Build the media3 projection of the brain, pinned to the UI thread.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.brainPlayer = new BrainPlayer(this.controller, Looper.getMainLooper());
        // ```
        brainPlayer = BrainPlayer(controller, Looper.getMainLooper())
        // What:     `controller.onPersist = { saveSession() }` wires the controller's persist
        //           callback to this service's `saveSession`. The lambda is invoked at the end
        //           of every `refresh` (selection/settings/play-state changes).
        // Why:      Persist the session on any meaningful change so a later kill keeps the
        //           latest selection/settings. This is SEPARATE from `onStateChanged`, which
        //           `BrainPlayer` already owns for the MediaSession projection.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.controller.onPersist = () => this.saveSession();
        // ```
        controller.onPersist = { saveSession() }
        // What:     `val built: MediaSession = MediaSession.Builder(this, brainPlayer).build()`
        //           declares a read-only `MediaSession` local `built`. `MediaSession.Builder(this, brainPlayer)`
        //           constructs a builder seeded with the service context and the projected
        //           player; `.build()` finalises it into the immutable `MediaSession`.
        // Why:      Create the session that exposes the brain to the system.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const built: MediaSession = new MediaSession.Builder(this, this.brainPlayer).build();
        // ```
        val built: MediaSession = MediaSession.Builder(this, brainPlayer).build()
        // What:     `session = built` stores the freshly built session into the nullable
        //           `session` field.
        // Why:      Keep the session so `onGetSession`/`onDestroy` can use it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.session = built;
        // ```
        session = built
        // What:     `addSession(built)` calls the base class method that registers the
        //           session with the media notification manager. (Folds in the old inline
        //           note: start the notification/foreground machinery now, without waiting
        //           for an external controller; `addSession` registers the media
        //           notification manager's own player listener for this session.)
        // Why:      Make the system notification/foreground work without any app-side
        //           `MediaController`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.addSession(built);
        // ```
        addSession(built)
        // What:     `if (LibraryRoot.heldRoot(this) != null || hasAudioPermission(this)) { ... }`
        //           is a control-flow check. `LibraryRoot.heldRoot(this)` returns a
        //           persisted folder URI or null; `!= null` tests "we still hold a chosen
        //           folder grant." `||` is logical OR; `hasAudioPermission(this)` tests the
        //           device-wide audio permission. (Folds in the old inline note: both a
        //           chosen-folder grant and the audio permission persist across process
        //           death, so a headless restart can self-load from whichever the user set
        //           up.)
        // Why:      On a headless restart (no activity yet) we can self-load the library if
        //           either grant persists.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (LibraryRoot.heldRoot(this) !== null || hasAudioPermission(this)) {
        //   this.ensureLibraryLoaded();
        // }
        // ```
        if (LibraryRoot.heldRoot(this) != null || hasAudioPermission(this)) {
            // What:     `ensureLibraryLoaded()` calls this service's own load method
            //           (implicit `this`).
            // Why:      Kick off the headless self-load.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.ensureLibraryLoaded();
            // ```
            ensureLibraryLoaded()
        }
    }

    // What:     `override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session`
    //           overrides the base hook the framework calls to ask which session a
    //           connecting controller should get. It takes a `ControllerInfo` (the
    //           caller's identity, unused here) and returns the nullable `MediaSession?`,
    //           as an EXPRESSION body returning the `session` field directly.
    // Why:      We expose our single session to any controller that connects.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession | null {
    //   return this.session;
    // }
    // ```
    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    // What:     `override fun onBind(intent: Intent?): IBinder? = if (intent?.action == ACTION_LOCAL_BIND) localBinder else super.onBind(intent)`
    //           overrides the bind hook with an EXPRESSION body whose value is an
    //           `if/else` EXPRESSION. `intent` is a nullable `Intent?`; `intent?.action`
    //           SAFE-CALLs `.action` (null if `intent` is null); `== ACTION_LOCAL_BIND`
    //           tests the in-app bind action. When it matches we return our `localBinder`;
    //           otherwise we delegate to `super.onBind(intent)` (the base behaviour for
    //           system/media binds).
    // Why:      The in-app activity uses a private action to obtain the `LocalBinder`;
    //           every other binder request falls through to the framework.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onBind(intent: Intent | null): IBinder | null {
    //   return intent?.action === ACTION_LOCAL_BIND
    //     ? this.localBinder
    //     : super.onBind(intent);
    // }
    // ```
    override fun onBind(intent: Intent?): IBinder? =
        if (intent?.action == ACTION_LOCAL_BIND) localBinder else super.onBind(intent)

    // What:     `fun ensureLibraryLoaded() { ... }` declares a public (Kotlin default)
    //           method, block body, returning `Unit` (void).
    // Why:      Load the library and hand it to the brain, ONCE. Safe to call from both
    //           the headless self-load and the activity's post-grant signal; the
    //           `libraryLoaded` guard keeps it to a single load. A library is available at
    //           this point, so the charging-plus-idle peak sweep is enqueued here too
    //           (`PeakSweepScheduler.enqueue` is idempotent).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // ensureLibraryLoaded(): void { ... }
    // ```
    fun ensureLibraryLoaded() {
        // What:     `if (libraryLoaded) { return }` is an early-return guard: if the load
        //           already happened, exit (returning `Unit`).
        // Why:      Keep the load to a single run no matter how many callers ask.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.libraryLoaded) return;
        // ```
        if (libraryLoaded) {
            // What:     `return` exits the method early (bare `return`, returning `Unit`).
            // Why:      Nothing more to do; the library is already (being) loaded.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return;
            // ```
            return
        }
        // What:     `libraryLoaded = true` flips the one-time guard before starting work.
        // Why:      Mark the load as begun so a re-entrant call bails at the guard above.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.libraryLoaded = true;
        // ```
        libraryLoaded = true
        // What:     `PeakSweepScheduler.enqueue(this)` schedules the background true-peak
        //           sweep (idempotent: enqueuing twice is a no-op).
        // Why:      A library exists now, so the charging-plus-idle sweep can be queued.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // PeakSweepScheduler.enqueue(this);
        // ```
        PeakSweepScheduler.enqueue(this)
        // What:     `controller.beginLoad()` tells the brain a load is in progress so the
        //           screen shows a loading notice instead of the empty-library message.
        // Why:      Avoid flashing "no music" while a (possibly slow) scan runs.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.controller.beginLoad();
        // ```
        controller.beginLoad()
        // What:     `loadJob?.cancel()` SAFE-CALLs `.cancel()` on the nullable `loadJob`:
        //           if a previous load coroutine is still running, cancel it; if `loadJob`
        //           is null, do nothing.
        // Why:      A newer load supersedes an older in-flight one, so we cancel the old
        //           Job first to avoid a stale result overwriting the new library.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.loadJob?.cancel();
        // ```
        loadJob?.cancel()
        // What:     `loadJob = scope.launch { ... }` starts a new coroutine on `scope` and
        //           stores its `Job` handle in `loadJob`. `scope.launch { ... }` is the
        //           FIRE-AND-FORGET coroutine builder: it runs the trailing lambda
        //           asynchronously on the scope's (Main) thread and immediately returns a
        //           `Job` (it does NOT block or await here).
        // Why:      Do the source scan in the background while keeping a handle so a later
        //           load can cancel this one.
        // Gotcha:   `launch { }` returns immediately with a `Job`; the lambda runs later.
        //           It is NOT `await` (that would be `withContext`/`async { }.await()`).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.loadJob = launch(this.scope, async () => {
        //   const tracks = await LibrarySource.load(this);
        //   this.controller.openLibrary(tracks);
        //   console.info(`[${LOG_TAG}] PlaybackService loaded ${tracks.length} tracks`);
        // });
        // ```
        loadJob = scope.launch {
            // What:     `val tracks = LibrarySource.load(this@PlaybackService)` declares a
            //           read-only local `tracks` (type INFERRED as `List<Track>`).
            //           `LibrarySource.load(...)` is a `suspend` call (awaited implicitly
            //           inside the coroutine). `this@PlaybackService` is QUALIFIED `this`:
            //           inside the `launch` lambda bare `this` is the coroutine scope, so we
            //           name the service explicitly to pass it as the context.
            // Why:      Fetch the active library off the UI thread's coroutine.
            // Gotcha:   `this@PlaybackService` is needed because the lambda's bare `this` is
            //           the coroutine receiver, not the service.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const tracks = await LibrarySource.load(this);
            // ```
            val tracks = LibrarySource.load(this@PlaybackService)
            // What:     `val session = SessionStore.load(this@PlaybackService)` reads the
            //           persisted session (selected track URI + settings + position), or the
            //           model defaults when none was saved.
            // Why:      The self-load is the RESTORE path: it must reapply the saved settings
            //           and reselect the saved track, not start blank.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const session = SessionStore.load(this);
            // ```
            val session = SessionStore.load(this@PlaybackService)
            // What:     `controller.restoreLibrary(tracks, session)` hands the freshly scanned
            //           tracks AND the saved session to the brain, which re-derives the queue,
            //           reapplies settings, and reselects the saved track by URI (paused at the
            //           saved position). This re-scan-and-reselect IS the restore
            //           auto-correction.
            // Why:      Resume where the user left off, self-correcting for files added,
            //           removed, or renamed since the last run.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.controller.restoreLibrary(tracks, session);
            // ```
            controller.restoreLibrary(tracks, session)
            // What:     `Log.i(LOG_TAG, "PlaybackService restored ${tracks.size} tracks")` logs
            //           the load count (`${tracks.size}` is the list length).
            // Why:      Record how many tracks loaded, for verification.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info(`[${LOG_TAG}] PlaybackService restored ${tracks.length} tracks`);
            // ```
            Log.i(LOG_TAG, "PlaybackService restored ${tracks.size} tracks")
        }
    }

    // What:     `fun reloadFromRoot(treeUri: Uri) { ... }` declares a public method taking
    //           a tree `Uri`, block body, returning `Unit`.
    // Why:      Replace the library with a just-picked folder's contents, OVERRIDING the
    //           one-shot `libraryLoaded` guard because an explicit re-pick is meant to
    //           supersede whatever loaded first.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // reloadFromRoot(treeUri: Uri): void { ... }
    // ```
    fun reloadFromRoot(treeUri: Uri) {
        // What:     `libraryLoaded = true` sets the guard (an explicit re-pick is also a
        //           "load has happened").
        // Why:      Mark a load as active; unlike `ensureLibraryLoaded` there is no early
        //           guard here because a re-pick intentionally supersedes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.libraryLoaded = true;
        // ```
        libraryLoaded = true
        // What:     `PeakSweepScheduler.enqueue(this)` schedules the background peak sweep
        //           (idempotent).
        // Why:      A new library exists, so re-ensure the sweep is queued.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // PeakSweepScheduler.enqueue(this);
        // ```
        PeakSweepScheduler.enqueue(this)
        // What:     `controller.beginLoad()` marks the load in-progress for the UI.
        // Why:      Show the loading notice while the folder scan runs.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.controller.beginLoad();
        // ```
        controller.beginLoad()
        // What:     `loadJob?.cancel()` safe-calls cancel on any in-flight load Job.
        // Why:      The re-pick supersedes any running load; cancel it so its result cannot
        //           overwrite the chosen folder.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.loadJob?.cancel();
        // ```
        loadJob?.cancel()
        // What:     `loadJob = scope.launch { ... }` starts a new background coroutine and
        //           stores its `Job` (see the same pattern in `ensureLibraryLoaded`).
        // Why:      Scan the picked folder off the UI thread, with a cancelable handle.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.loadJob = launch(this.scope, async () => {
        //   const tracks = await LibrarySource.scanRoot(this, treeUri);
        //   this.controller.openLibrary(tracks);
        //   console.info(`[${LOG_TAG}] PlaybackService loaded ${tracks.length} tracks from picked folder`);
        // });
        // ```
        loadJob = scope.launch {
            // What:     `val tracks = LibrarySource.scanRoot(this@PlaybackService, treeUri)`
            //           declares `tracks` (inferred `List<Track>`) from the `suspend` call
            //           `scanRoot`, scanning the picked tree. `this@PlaybackService` is
            //           qualified `this` (the service, not the coroutine receiver).
            // Why:      Fetch the chosen folder's tracks off the UI thread.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const tracks = await LibrarySource.scanRoot(this, treeUri);
            // ```
            val tracks = LibrarySource.scanRoot(this@PlaybackService, treeUri)
            // What:     `controller.openLibrary(tracks)` hands the picked folder's tracks to
            //           the brain.
            // Why:      Deliver the re-pick result to the brain/UI.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.controller.openLibrary(tracks);
            // ```
            controller.openLibrary(tracks)
            // What:     `Log.i(LOG_TAG, "PlaybackService loaded ${tracks.size} tracks from picked folder")`
            //           logs the picked-folder load count.
            // Why:      Record the re-pick load for verification.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info(`[${LOG_TAG}] PlaybackService loaded ${tracks.length} tracks from picked folder`);
            // ```
            Log.i(LOG_TAG, "PlaybackService loaded ${tracks.size} tracks from picked folder")
        }
    }

    // What:     `fun rescan() { ... }` declares a public method, no params, `Unit` return,
    //           block body. The LIVE-UPDATE entry point (the desktop "Rescan" analog).
    // Why:      Called when the app returns to the foreground: re-resolve the current source
    //           and reconcile the queue, preserving the playing track. Two guards make it
    //           safe: it does nothing before the first load, and it does NOTHING WHILE A LOAD
    //           IS IN FLIGHT, so a foreground arriving during the cold-start restore does not
    //           cancel that restore (the in-flight load already yields fresh state).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // rescan(): void {
    //   if (!this.libraryLoaded) return;
    //   if (this.loadJob?.isActive) return;
    //   this.loadJob = launch(this.scope, async () => {
    //     this.controller.reconcileLibrary(await LibrarySource.load(this));
    //   });
    // }
    // ```
    fun rescan() {
        // What:     `if (!libraryLoaded) return` bails before the first load.
        // Why:      Nothing to reconcile until a library has been loaded; the first load is
        //           `ensureLibraryLoaded`'s job, not a rescan's.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!this.libraryLoaded) return;
        // ```
        if (!libraryLoaded) return
        // What:     `if (loadJob?.isActive == true) return` bails when a load/reload/restore (or
        //           a prior rescan) is still running. `loadJob?.isActive` is the coroutine's
        //           live flag (true from `launch` until completion), null-safe via `?.`.
        // Why:      CRITICAL: the cold-start `ensureLibraryLoaded` launches the restore, then a
        //           foreground bind fires `rescan`; without this guard `rescan` would cancel the
        //           restore mid-scan and reconcile with `loadedUri == null`, clearing the
        //           restored selection. The in-flight load already produces fresh state, so
        //           skipping is correct (also de-dupes rapid double-foregrounds).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.loadJob?.isActive) return;
        // ```
        if (loadJob?.isActive == true) return
        // What:     `loadJob = scope.launch { ... }` runs the reconcile off the UI thread,
        //           keeping the `Job` handle. Inside: scan the source, then reconcile.
        // Why:      Re-derive the queue from disk now and reconcile it, preserving playback.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.loadJob = launch(this.scope, async () => { ... });
        // ```
        loadJob = scope.launch {
            // What:     `val tracks = LibrarySource.load(this@PlaybackService)` re-resolves the
            //           CURRENT source (held SAF root, else MediaStore) and scans it.
            // Why:      The live state of the source on this foreground.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const tracks = await LibrarySource.load(this);
            // ```
            val tracks = LibrarySource.load(this@PlaybackService)
            // What:     `controller.reconcileLibrary(tracks)` reconciles the queue with the
            //           scan, preserving the playing track by URI WITHOUT restarting playback.
            // Why:      The live update: added/removed/renamed files show up, the current track
            //           keeps playing if it survives.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.controller.reconcileLibrary(tracks);
            // ```
            controller.reconcileLibrary(tracks)
            // What:     `Log.i(...)` records the reconcile count for verification.
            // Why:      Trace the live-update path.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info(`[${LOG_TAG}] PlaybackService reconciled ${tracks.length} tracks (live update)`);
            // ```
            Log.i(LOG_TAG, "PlaybackService reconciled ${tracks.size} tracks (live update)")
        }
    }

    // What:     `fun saveSession() { ... }` declares a public method, no params, `Unit` return,
    //           block body.
    // Why:      Persist the current session (selected track URI + settings + live position) via
    //           `SessionStore`. Called from the controller's `onPersist` on state changes, from
    //           the activity's `onStop` (to capture a mid-track-background position), and from
    //           `onDestroy` (final save). No-op before a library is loaded so it cannot
    //           overwrite a good saved session with an empty one during startup.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // saveSession(): void {
    //   if (!this.libraryLoaded) return;
    //   SessionStore.save(this, this.controller.currentSession());
    // }
    // ```
    fun saveSession() {
        // What:     `if (!libraryLoaded) return` guards against saving before the library has
        //           loaded.
        // Why:      During startup the controller has no real selection yet; saving then would
        //           clobber the persisted session with defaults.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!this.libraryLoaded) return;
        // ```
        if (!libraryLoaded) return
        // What:     `SessionStore.save(this, controller.currentSession())` writes the snapshot.
        //           `controller.currentSession()` builds a `core.Session` from the live queue +
        //           engine; `this` is the service `Context`.
        // Why:      Durably record where the user is, for the next launch's restore.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // SessionStore.save(this, this.controller.currentSession());
        // ```
        SessionStore.save(this, controller.currentSession())
    }

    // What:     `override fun onDestroy() { ... }` overrides the lifecycle hook Android
    //           calls when the service is being destroyed.
    // Why:      Release the session and its player, clear state, and cancel the load
    //           scope so nothing leaks.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onDestroy(): void { ... }
    // ```
    override fun onDestroy() {
        // What:     `saveSession()` persists the final session BEFORE anything is released.
        // Why:      Capture the latest selection/settings/position while the controller and
        //           engine are still alive (`currentSession()` reads `engine.positionSec()`);
        //           the releases below tear the engine down, so this must run first. No-op if
        //           the library never loaded.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.saveSession();
        // ```
        saveSession()
        // What:     `session?.run { player.release(); release() }` uses the SCOPE FUNCTION
        //           `run` after a SAFE-CALL `?.`: when `session` is non-null, `run { ... }`
        //           executes the trailing lambda WITH `session` as the lambda's `this`
        //           RECEIVER, so the unqualified `player` and `release()` inside resolve
        //           against the session. When `session` is null the whole thing is skipped.
        // Why:      Release the session's player and then the session itself, but only if a
        //           session exists.
        // Gotcha:   Inside `run { }` the receiver is `session`, so bare `player`/`release()`
        //           are `session.player`/`session.release()`; this is Kotlin's
        //           receiver-scoped block, with no TS equivalent beyond an explicit `if`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.session) {
        //   this.session.player.release();
        //   this.session.release();
        // }
        // ```
        session?.run {
            // What:     `player.release()` releases the session's underlying player (frees
            //           audio focus, buffers, file handles). `player` resolves against the
            //           `run` receiver (`session`).
            // Why:      Free the engine the session was driving.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // session.player.release();
            // ```
            player.release()
            // What:     `release()` releases the session itself (the receiver `session`).
            // Why:      Tear down the media session.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // session.release();
            // ```
            release()
        }
        // What:     `session = null` clears the nullable `session` field.
        // Why:      The session is gone; null it so nothing uses a released session.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.session = null;
        // ```
        session = null
        // What:     `scope.cancel()` cancels the coroutine scope, stopping any in-flight
        //           library load (`cancel` is the imported extension function).
        // Why:      Don't leave a load coroutine running after the service is destroyed.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.scope.cancel();
        // ```
        scope.cancel()
        // What:     `super.onDestroy()` calls the base class teardown LAST, after our own
        //           cleanup.
        // Why:      Let `MediaSessionService` finish its destruction once we have released
        //           our resources.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // super.onDestroy();
        // ```
        super.onDestroy()
    }

    // What:     `companion object { ... }` declares the single static-like object attached
    //           to `PlaybackService`; its member is read as
    //           `PlaybackService.ACTION_LOCAL_BIND`.
    // Why:      Hold the private bind-action constant the activity uses to obtain the
    //           `LocalBinder`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // static member of PlaybackService:
    // //   static readonly ACTION_LOCAL_BIND = "dev.monochromatic.musicplayer.LOCAL_BIND";
    // ```
    companion object {
        // What:     `const val ACTION_LOCAL_BIND: String = "dev.monochromatic.musicplayer.LOCAL_BIND"`
        //           declares a PUBLIC (no modifier = Kotlin default public) compile-time
        //           `String` constant (`const` = compile-time + inlined; `val` = never
        //           reassigned).
        // Why:      The private bind action the in-app activity uses to obtain the
        //           `LocalBinder`; public so the activity (same package) can reference it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // static readonly ACTION_LOCAL_BIND = "dev.monochromatic.musicplayer.LOCAL_BIND";
        // ```
        const val ACTION_LOCAL_BIND: String = "dev.monochromatic.musicplayer.LOCAL_BIND"
    }
}
