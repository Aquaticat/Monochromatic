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
// TS map:   No 1:1 equivalent — TS module identity is the file path; no `package`.
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
// TS map:   `import { Intent } from "android/content";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Intent } from "android/content";
// ```
import android.content.Intent

// What:     `import android.net.Uri` pulls in `Uri`, Android's parsed URI type.
// Why:      `reloadFromRoot` takes a tree `Uri`.
// TS map:   `import { Uri } from "android/net";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Uri } from "android/net";
// ```
import android.net.Uri

// What:     `import android.os.Binder` pulls in `Binder`, the base class for a local
//           IPC stub. Subclassing it gives the activity a direct in-process handle.
// Why:      The inner `LocalBinder` extends `Binder`.
// TS map:   `import { Binder } from "android/os";` — a base class for a same-process
//           handle object.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Binder } from "android/os";
// ```
import android.os.Binder

// What:     `import android.os.IBinder` pulls in `IBinder`, the INTERFACE type a bound
//           service returns from `onBind`.
// Why:      `onBind`'s declared return type is `IBinder?`.
// TS map:   `import { IBinder } from "android/os";` — an interface type.
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
// TS map:   `import { Looper } from "android/os";` — "the event loop of a thread"; JS
//           has only one, so the per-thread part has no twin.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Looper } from "android/os";
// ```
import android.os.Looper

// What:     `import android.util.Log` pulls in `Log`, Android's logger
//           (`Log.i(tag, msg)`).
// Why:      We log lifecycle events and load counts.
// TS map:   `import { Log } from "android/util";` — `Log.i` ~ `console.info` with a tag.
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
// TS map:   `import { MediaSession } from "media3/session";`.
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
// TS map:   `import { MediaSessionService } from "media3/session";` — an abstract base
//           service class.
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
// TS map:   `import { CoroutineScope } from "kotlinx/coroutines";` — mentally "an
//           AbortController-like owner for a set of async tasks."
//
// In TS you'd write (pseudocode):
// ```ts
// import { CoroutineScope } from "kotlinx/coroutines"; // ~ owner of async tasks
// ```
import kotlinx.coroutines.CoroutineScope

// What:     `import kotlinx.coroutines.Dispatchers` pulls in `Dispatchers`; we use
//           `Dispatchers.Main` (the UI thread) for the scope.
// Why:      The load coroutine touches the controller/UI state, so it runs on Main.
// TS map:   No real TS equivalent — JS has one event loop. Mentally `Dispatchers.Main`
//           IS that single UI event loop.
//
// In TS you'd write (pseudocode):
// ```ts
// // no equivalent — Dispatchers.Main ~ the single UI event loop
// ```
import kotlinx.coroutines.Dispatchers

// What:     `import kotlinx.coroutines.Job` pulls in `Job`, the cancelable HANDLE to a
//           running coroutine (returned by `launch`).
// Why:      `loadJob` holds the in-flight load so a newer load can cancel it.
// TS map:   `import { Job } from "kotlinx/coroutines";` — like a cancelable task
//           handle / an `AbortController`.
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
// TS map:   No TS equivalent; mentally "an error boundary where one task's failure
//           doesn't abort the others."
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
// TS map:   No extension functions in TS; mentally `cancel(scope)` /
//           `abortController.abort()`. Import as
//           `import { cancel } from "kotlinx/coroutines";`.
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
// TS map:   No extension functions; mentally `launch(scope, async () => { ... })` —
//           like calling an async function WITHOUT awaiting (returns a cancelable
//           handle). Import as `import { launch } from "kotlinx/coroutines";`.
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
// TS map:   `class PlaybackService extends MediaSessionService { ... }` (the `()` is the
//           implicit `super()` call).
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
    // TS map:   `private controller!: PlayerController;` — TS's DEFINITE-ASSIGNMENT
    //           assertion (the `!`) is the closest analogue: "trust me, it's assigned
    //           before use."
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
    // TS map:   `private brainPlayer!: BrainPlayer;`.
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
    // TS map:   `private session: MediaSession | null = null;`.
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
    // TS map:   `private libraryLoaded = false;`.
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
    // TS map:   No clean TS equivalent. Mentally: `const scope = new CoroutineScope({ job: supervisorJob(), dispatcher: MAIN })`
    //           — an async-task owner pinned to the UI loop with an error boundary.
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
    // TS map:   `private loadJob: Job | null = null;` — a cancelable task handle or null.
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
    // TS map:   `private readonly localBinder: LocalBinder = new LocalBinder();`.
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
    // TS map:   TS has no `inner class`; the usual workaround is capturing the outer
    //           `this` (e.g. `const self = this`) or using arrow methods. Picture
    //           `class LocalBinder extends Binder { constructor(private outer: PlaybackService) {} }`.
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
        // TS map:   `get controller(): PlayerController { return this.outer.controller; }`
        //           — a getter that delegates to the captured outer instance.
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
        // TS map:   `ensureLibraryLoaded(): void { return this.outer.ensureLibraryLoaded(); }`.
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
        // TS map:   `reloadFromRoot(treeUri: Uri): void { return this.outer.reloadFromRoot(treeUri); }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // reloadFromRoot(treeUri: Uri): void {
        //   this.outer.reloadFromRoot(treeUri);
        // }
        // ```
        fun reloadFromRoot(treeUri: Uri) = this@PlaybackService.reloadFromRoot(treeUri)
    }

    // What:     `override fun onCreate() { ... }` overrides the service lifecycle hook
    //           Android calls when the service is first created. `override` is mandatory
    //           when replacing a base method.
    // Why:      Build the brain, the projection, and the session, start the notification
    //           machinery, and (if a grant persists) self-load the library.
    // TS map:   `override onCreate(): void { ... }`.
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
        // TS map:   `super.onCreate();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // super.onCreate();
        // ```
        super.onCreate()
        // What:     `Log.i(LOG_TAG, "PlaybackService.onCreate flavor=${BuildConfig.FLAVOR}")`
        //           logs an info line; `${BuildConfig.FLAVOR}` interpolates the build
        //           flavor (a generated constant). `LOG_TAG` is the shared tag declared in
        //           `MainActivity.kt`.
        // Why:      Record which flavor created the service, for verification.
        // TS map:   `console.info(`[${LOG_TAG}] PlaybackService.onCreate flavor=${BuildConfig.FLAVOR}`);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // console.info(`[${LOG_TAG}] PlaybackService.onCreate flavor=${BuildConfig.FLAVOR}`);
        // ```
        Log.i(LOG_TAG, "PlaybackService.onCreate flavor=${BuildConfig.FLAVOR}")
        // What:     `controller = PlayerController(createAudioEngine(this))` ASSIGNS the
        //           `lateinit` field. `PlayerController(...)` is a constructor call (no
        //           `new`); its argument `createAudioEngine(this)` is a flavor-specific
        //           factory that builds the audio engine, passed `this` (the service as a
        //           `Context`).
        // Why:      Create the one brain, wired to the flavor's audio engine.
        // TS map:   `this.controller = new PlayerController(createAudioEngine(this));`.
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
        // TS map:   `this.brainPlayer = new BrainPlayer(this.controller, Looper.getMainLooper());`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.brainPlayer = new BrainPlayer(this.controller, Looper.getMainLooper());
        // ```
        brainPlayer = BrainPlayer(controller, Looper.getMainLooper())
        // What:     `val built: MediaSession = MediaSession.Builder(this, brainPlayer).build()`
        //           declares a read-only `MediaSession` local `built`. `MediaSession.Builder(this, brainPlayer)`
        //           constructs a builder seeded with the service context and the projected
        //           player; `.build()` finalises it into the immutable `MediaSession`.
        // Why:      Create the session that exposes the brain to the system.
        // TS map:   `const built: MediaSession = new MediaSession.Builder(this, this.brainPlayer).build();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const built: MediaSession = new MediaSession.Builder(this, this.brainPlayer).build();
        // ```
        val built: MediaSession = MediaSession.Builder(this, brainPlayer).build()
        // What:     `session = built` stores the freshly built session into the nullable
        //           `session` field.
        // Why:      Keep the session so `onGetSession`/`onDestroy` can use it.
        // TS map:   `this.session = built;`.
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
        // TS map:   `this.addSession(built);`.
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
        // TS map:   `if (LibraryRoot.heldRoot(this) !== null || hasAudioPermission(this)) { ... }`.
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
            // TS map:   `this.ensureLibraryLoaded();`.
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
    // TS map:   `override onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession | null { return this.session; }`.
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
    // TS map:   `override onBind(intent: Intent | null): IBinder | null { return intent?.action === ACTION_LOCAL_BIND ? this.localBinder : super.onBind(intent); }`
    //           — Kotlin's `if/else` is the ternary; `intent?.action` is TS optional
    //           chaining.
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
    // TS map:   `ensureLibraryLoaded(): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // ensureLibraryLoaded(): void { ... }
    // ```
    fun ensureLibraryLoaded() {
        // What:     `if (libraryLoaded) { return }` is an early-return guard: if the load
        //           already happened, exit (returning `Unit`).
        // Why:      Keep the load to a single run no matter how many callers ask.
        // TS map:   `if (this.libraryLoaded) return;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.libraryLoaded) return;
        // ```
        if (libraryLoaded) {
            // What:     `return` exits the method early (bare `return`, returning `Unit`).
            // Why:      Nothing more to do; the library is already (being) loaded.
            // TS map:   `return;`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return;
            // ```
            return
        }
        // What:     `libraryLoaded = true` flips the one-time guard before starting work.
        // Why:      Mark the load as begun so a re-entrant call bails at the guard above.
        // TS map:   `this.libraryLoaded = true;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.libraryLoaded = true;
        // ```
        libraryLoaded = true
        // What:     `PeakSweepScheduler.enqueue(this)` schedules the background true-peak
        //           sweep (idempotent: enqueuing twice is a no-op).
        // Why:      A library exists now, so the charging-plus-idle sweep can be queued.
        // TS map:   `PeakSweepScheduler.enqueue(this);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // PeakSweepScheduler.enqueue(this);
        // ```
        PeakSweepScheduler.enqueue(this)
        // What:     `controller.beginLoad()` tells the brain a load is in progress so the
        //           screen shows a loading notice instead of the empty-library message.
        // Why:      Avoid flashing "no music" while a (possibly slow) scan runs.
        // TS map:   `this.controller.beginLoad();`.
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
        // TS map:   `this.loadJob?.cancel();` (or `this.loadJob?.abort();`).
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
        // TS map:   `this.loadJob = launch(this.scope, async () => { ... });` — like
        //           calling an async function without awaiting and keeping its cancelable
        //           handle.
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
            // TS map:   `const tracks = await LibrarySource.load(this);` — Kotlin's
            //           `this@PlaybackService` disambiguates which `this`, which TS arrow
            //           functions avoid by capturing the lexical `this`.
            // Gotcha:   `this@PlaybackService` is needed because the lambda's bare `this` is
            //           the coroutine receiver, not the service.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const tracks = await LibrarySource.load(this);
            // ```
            val tracks = LibrarySource.load(this@PlaybackService)
            // What:     `controller.openLibrary(tracks)` hands the loaded tracks to the
            //           brain, which repaginates and shows the first page.
            // Why:      Deliver the load result to the brain/UI.
            // TS map:   `this.controller.openLibrary(tracks);`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.controller.openLibrary(tracks);
            // ```
            controller.openLibrary(tracks)
            // What:     `Log.i(LOG_TAG, "PlaybackService loaded ${tracks.size} tracks")` logs
            //           the load count (`${tracks.size}` is the list length).
            // Why:      Record how many tracks loaded, for verification.
            // TS map:   `console.info(`[${LOG_TAG}] PlaybackService loaded ${tracks.length} tracks`);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info(`[${LOG_TAG}] PlaybackService loaded ${tracks.length} tracks`);
            // ```
            Log.i(LOG_TAG, "PlaybackService loaded ${tracks.size} tracks")
        }
    }

    // What:     `fun reloadFromRoot(treeUri: Uri) { ... }` declares a public method taking
    //           a tree `Uri`, block body, returning `Unit`.
    // Why:      Replace the library with a just-picked folder's contents, OVERRIDING the
    //           one-shot `libraryLoaded` guard because an explicit re-pick is meant to
    //           supersede whatever loaded first.
    // TS map:   `reloadFromRoot(treeUri: Uri): void { ... }`.
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
        // TS map:   `this.libraryLoaded = true;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.libraryLoaded = true;
        // ```
        libraryLoaded = true
        // What:     `PeakSweepScheduler.enqueue(this)` schedules the background peak sweep
        //           (idempotent).
        // Why:      A new library exists, so re-ensure the sweep is queued.
        // TS map:   `PeakSweepScheduler.enqueue(this);`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // PeakSweepScheduler.enqueue(this);
        // ```
        PeakSweepScheduler.enqueue(this)
        // What:     `controller.beginLoad()` marks the load in-progress for the UI.
        // Why:      Show the loading notice while the folder scan runs.
        // TS map:   `this.controller.beginLoad();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.controller.beginLoad();
        // ```
        controller.beginLoad()
        // What:     `loadJob?.cancel()` safe-calls cancel on any in-flight load Job.
        // Why:      The re-pick supersedes any running load; cancel it so its result cannot
        //           overwrite the chosen folder.
        // TS map:   `this.loadJob?.cancel();`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.loadJob?.cancel();
        // ```
        loadJob?.cancel()
        // What:     `loadJob = scope.launch { ... }` starts a new background coroutine and
        //           stores its `Job` (see the same pattern in `ensureLibraryLoaded`).
        // Why:      Scan the picked folder off the UI thread, with a cancelable handle.
        // TS map:   `this.loadJob = launch(this.scope, async () => { ... });`.
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
            // TS map:   `const tracks = await LibrarySource.scanRoot(this, treeUri);`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const tracks = await LibrarySource.scanRoot(this, treeUri);
            // ```
            val tracks = LibrarySource.scanRoot(this@PlaybackService, treeUri)
            // What:     `controller.openLibrary(tracks)` hands the picked folder's tracks to
            //           the brain.
            // Why:      Deliver the re-pick result to the brain/UI.
            // TS map:   `this.controller.openLibrary(tracks);`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.controller.openLibrary(tracks);
            // ```
            controller.openLibrary(tracks)
            // What:     `Log.i(LOG_TAG, "PlaybackService loaded ${tracks.size} tracks from picked folder")`
            //           logs the picked-folder load count.
            // Why:      Record the re-pick load for verification.
            // TS map:   `console.info(`[${LOG_TAG}] PlaybackService loaded ${tracks.length} tracks from picked folder`);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.info(`[${LOG_TAG}] PlaybackService loaded ${tracks.length} tracks from picked folder`);
            // ```
            Log.i(LOG_TAG, "PlaybackService loaded ${tracks.size} tracks from picked folder")
        }
    }

    // What:     `override fun onDestroy() { ... }` overrides the lifecycle hook Android
    //           calls when the service is being destroyed.
    // Why:      Release the session and its player, clear state, and cancel the load
    //           scope so nothing leaks.
    // TS map:   `override onDestroy(): void { ... }`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // override onDestroy(): void { ... }
    // ```
    override fun onDestroy() {
        // What:     `session?.run { player.release(); release() }` uses the SCOPE FUNCTION
        //           `run` after a SAFE-CALL `?.`: when `session` is non-null, `run { ... }`
        //           executes the trailing lambda WITH `session` as the lambda's `this`
        //           RECEIVER, so the unqualified `player` and `release()` inside resolve
        //           against the session. When `session` is null the whole thing is skipped.
        // Why:      Release the session's player and then the session itself, but only if a
        //           session exists.
        // TS map:   `if (this.session) { this.session.player.release(); this.session.release(); }`
        //           — `?.run { }` is "if non-null, run this block with the value as `this`."
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
            // TS map:   `this.session.player.release();`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // session.player.release();
            // ```
            player.release()
            // What:     `release()` releases the session itself (the receiver `session`).
            // Why:      Tear down the media session.
            // TS map:   `this.session.release();`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // session.release();
            // ```
            release()
        }
        // What:     `session = null` clears the nullable `session` field.
        // Why:      The session is gone; null it so nothing uses a released session.
        // TS map:   `this.session = null;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.session = null;
        // ```
        session = null
        // What:     `scope.cancel()` cancels the coroutine scope, stopping any in-flight
        //           library load (`cancel` is the imported extension function).
        // Why:      Don't leave a load coroutine running after the service is destroyed.
        // TS map:   `this.scope.cancel();` (or `abortController.abort();`).
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
        // TS map:   `super.onDestroy();`.
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
    // TS map:   `class PlaybackService { static readonly ACTION_LOCAL_BIND = "..."; }`.
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
        // TS map:   `static readonly ACTION_LOCAL_BIND = "dev.monochromatic.musicplayer.LOCAL_BIND";`
        //           — Kotlin `const` must be a compile-time literal (stricter than TS
        //           `const`).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // static readonly ACTION_LOCAL_BIND = "dev.monochromatic.musicplayer.LOCAL_BIND";
        // ```
        const val ACTION_LOCAL_BIND: String = "dev.monochromatic.musicplayer.LOCAL_BIND"
    }
}
