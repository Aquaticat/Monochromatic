# Streaming library load and a resume-persistence fix for the Android music player

Status: plan, not yet implemented.
Audience: someone seeing this product for the first time.
It introduces the app, then proposes one focused change with two interlocking parts.

## What this document is

The Android music player opens to a blank "loading" spinner for several seconds on every launch
while it scans your music folder,
then shows the whole library at once.
This plan replaces that with a list that fills in as the scan discovers tracks,
so you see music almost immediately.

While investigating that, we found a second, separate bug:
the app erases its own "resume where you left off" state on every launch.
The two are caused by code in the same area and share one fix,
so this plan folds them together.

## The product, in brief

Monochromatic is a multi-package workspace.
One of its apps is a music player,
which exists as a desktop build (written in Rust)
and as this Android port.

The Android port is built from three layers:

- A Jetpack Compose user interface (Kotlin), the screen you see and tap.
- A media3 `MediaSession`, which gives the system the lock-screen and notification controls,
  and keeps audio playing when the app is in the background.
- A Rust audio engine that does the real decoding and output,
  called from Kotlin over JNI (the Java-to-native bridge).

It plays a local music library.
The library comes from one of two sources:

- A folder you grant through Android's folder picker
  (the Storage Access Framework, "SAF"),
  which the app scans recursively.
- Or, if you grant audio permission and have not picked a folder,
  the device-wide media collection ("MediaStore").

Tracks are grouped into browsable pages shown as tabs:
one page per top-level folder,
plus A to Z pages for loose files at the root,
plus a single catch-all page for digits and symbols.
You tap a row to play it.

The app remembers where you left off
(the selected track, its playback position, and your volume, shuffle, and repeat settings)
and restores that on the next launch.
It also re-scans the source when you bring the app back to the foreground,
so files added, removed, or renamed since last time self-correct.

For deeper background, see the existing notes:

- [Android port decision](../decisions/music-player-android-port.md)
- [Live-update rescan decision](../decisions/music-player-live-update-rescan.md)
- [Session source-root decision](../decisions/music-player-session-source-root.md)
- [Package context](../../packages/android-app/music-player/CONTEXT.md)

## The two problems

### Problem one: the cold-start load blocks the whole library

When the app launches,
it scans the source end to end,
collects every track,
sorts them,
and only then hands the finished list to the screen.
Until that finishes, the screen shows a spinner and nothing else.
On a real device with a library of about 3,600 tracks,
the prior on-device logs showed that scan completing several seconds after launch.

The user's framing:
if the folder holds artists Ado, Bruno, and Charon,
the screen should show each as it is read,
not make you wait for the full scan before showing anything.

### Problem two: launching the app erases your resume state

On every cold start,
the saved "where you left off" state
(selected track, position, volume, shuffle, repeat)
is overwritten with blank defaults
before it is ever read back.
The library itself still loads,
but the per-session resume is lost on each launch.

This is an ordering bug, walked through under "How resume state is persisted" below.

## How the relevant parts work today

### The scan pipeline

Both sources follow the same shape.
They accumulate every track on a background thread,
sort the whole list by display path at the very end,
and return the finished list:

```kotlin
// packages/android-app/music-player/app/src/main/kotlin/dev/monochromatic/musicplayer/SafTreeSource.kt
suspend fun query(resolver: ContentResolver, treeUri: Uri): List<Track> = withContext(Dispatchers.IO) {
    // walk every directory under treeUri, appending audio files to `tracks`
    // ...
    tracks.sortedWith { left, right -> compareByCodePoint(left.displayPath, right.displayPath) }
}
```

The service launches that scan and hands the result to the controller (the "brain"),
through one of three entry points:

- `restoreLibrary` on cold start, which also reselects the saved track.
- `openLibrary` after you pick a new folder.
- `reconcileLibrary` on foreground re-scan,
  which preserves the currently playing track by its URI and does not show a loading state.

The controller then rebuilds a single immutable snapshot, `PlayerUiState`,
which Compose observes and repaints from.

### How the UI decides what to show

The track list renders whenever the queue is non-empty.
The spinner only appears while the queue is empty and a load is in progress:

```kotlin
// packages/android-app/music-player/app/src/main/kotlin/dev/monochromatic/musicplayer/MainActivity.kt
if (state.queueSize == 0) {
    if (state.loading) {
        LoadingNotice()
    } else {
        Text("No music found in your audio library.")
    }
    return
}
// otherwise: render the LazyColumn of pages and rows
```

This is the key lever:
the screen already knows how to show a partial library.
If tracks arrive a batch at a time,
the queue becomes non-empty on the first batch
and the list grows on each repaint,
with no change to this gate.

One ordering detail matters.
Pagination groups rows into pages but keeps each page's rows in the order they arrive,
sorting only the pages themselves.
So the incoming list must already be sorted for rows to land in the right place.

### How resume state is persisted

The controller calls a persist callback at the end of every repaint.
The service wires that callback in `onCreate`,
and then, a few lines later, starts the load:

```kotlin
// packages/android-app/music-player/app/src/main/kotlin/dev/monochromatic/musicplayer/PlaybackService.kt
controller.onPersist = { saveSession() }   // line 467
// ...
ensureLibraryLoaded()                      // line 527
```

`ensureLibraryLoaded` sets `libraryLoaded = true`, then calls `controller.beginLoad()`,
which sets the loading flag and repaints.
That repaint fires `onPersist`, which calls `saveSession()`:

```kotlin
// packages/android-app/music-player/app/src/main/kotlin/dev/monochromatic/musicplayer/PlaybackService.kt
fun saveSession() {
    if (!libraryLoaded) return                          // line 903: passes, libraryLoaded is already true
    SessionStore.save(this, controller.currentSession())
}
```

At that instant the controller is still empty,
so `currentSession()` reports nothing selected, position zero, and default volume.
`SessionStore.save` writes those blanks unconditionally,
erasing the real saved values.
Only after the multi-second scan does the load coroutine call `SessionStore.load`,
which now reads back the blanks it just wrote,
so the restore restores nothing.

The guard's intent is right:
do not save before a library is loaded, so startup cannot overwrite a good session.
But `libraryLoaded` flips at load start, not at load delivery,
so the guard passes too early to protect anything.

## The plan

### Part one: stream the cold-start load

Make the scan emit the library in growing, already-sorted batches
instead of one final list.
Each source gains an optional progress callback;
when it has accumulated enough new tracks (a threshold of roughly 128),
it sorts what it has so far and emits that:

```kotlin
// shape only, both sources gain `onBatch` (default null, so existing callers are unaffected)
suspend fun query(
    resolver: ContentResolver,
    treeUri: Uri,
    onBatch: (suspend (List<Track>) -> Unit)? = null,
): List<Track>
```

For the SAF source, the batch is emitted from the outer directory loop,
never from inside the per-directory helper,
because that helper swallows exceptions and would also swallow the cancellation
thrown when a newer load supersedes an older one.

The scan runs on a background thread,
so the callback hops to the main thread before touching the screen state:

```kotlin
// packages/android-app/music-player/app/src/main/kotlin/dev/monochromatic/musicplayer/PlaybackService.kt
val tracks = LibrarySource.load(this@PlaybackService) { batch ->
    withContext(Dispatchers.Main) { controller.reconcileLibrary(batch) }
}
```

Each batch reuses the existing `reconcileLibrary`.
That method already does the right thing for a growing list:
it adopts the new track set,
re-points the playing track by its URI if one is set,
and leaves the loading flag untouched.
A subtle point makes this safe:
on a cold start nothing is selected until you tap a row,
and a row you can tap is, by definition, already discovered,
so it is present in every later batch.
The "track is gone" branch in `reconcileLibrary` therefore never fires on a real selection during streaming.

When the scan finishes, the source returns the complete sorted list as before,
and the service finalizes:

```kotlin
// new controller method; `session` is the saved state read after the scan
fun finishLoad(tracks: List<Track>, session: Session) {
    if (loadedUri != null) {
        // you tapped a track while it was still loading: keep your choice, just adopt the full list
        isLoading = false
        reconcileLibrary(tracks)
    } else {
        // no tap during the load: apply the saved restore (this also clears the loading flag)
        restoreLibrary(tracks, session)
    }
}
```

The tap branch must clear the loading flag itself,
because `reconcileLibrary` does not,
otherwise a library that finished empty would be stuck on the spinner.

### Part two: stop the resume clobber

Replace the wrong guard with the right one.
Add a flag that becomes true only when a library has actually been delivered to the controller,
and gate `saveSession` on that instead of on `libraryLoaded`:

```kotlin
// packages/android-app/music-player/app/src/main/kotlin/dev/monochromatic/musicplayer/PlaybackService.kt
private var sessionRestored: Boolean = false

fun saveSession() {
    if (!sessionRestored) return   // do not write until the saved session has been read and applied
    SessionStore.save(this, controller.currentSession())
}
```

Set `sessionRestored = true` right after the saved session has been read,
just before the terminal `finishLoad`,
and likewise after a folder pick delivers its library.
`libraryLoaded` stays as it is for its other jobs
(keeping the load to a single run, and gating the foreground re-scan).

Now `beginLoad`'s repaint, and every streaming batch's repaint,
find `sessionRestored` still false and skip the write.
The saved session survives untouched until `SessionStore.load` reads it.
After that the flag flips true,
and your tap, the restored selection, volume changes, and the background position save all persist normally.

### How the two parts interlock

Part one adds repaints during the load, one per batch.
Without part two, each of those would re-trigger the same clobber that `beginLoad` already triggers once today.
Part two's single flag covers both:
it neutralizes the original cold-start clobber
and prevents the new streaming batches from re-introducing it.
That is why they belong in one change rather than two.

## Design choices and trade-offs

- Emit sorted-so-far, not raw discovery order.
  Pagination keeps each page's rows in arrival order,
  so an unsorted stream would show rows in a scrambled order and then jerk into place at the end.
  Sorting the accumulated list on each batch keeps the growing list stable and correct.
  Re-sorting a few thousand items a couple dozen times happens on the background thread and is negligible.

- Reuse `reconcileLibrary` for batches rather than writing a bespoke "append" method.
  It already preserves a tapped selection by URI and leaves the loading flag alone,
  which is exactly the streaming behaviour, with no new branch to maintain.

- A count threshold, not per-file or per-folder emits.
  Per-file would repaint thousands of times;
  per-folder could still emit hundreds of times on a deep tree.
  A threshold of around 128 tracks keeps the batch count low
  while still showing the first rows quickly.

- Gate persistence on delivery, not on load start.
  This matches the guard's original intent and is the smallest change that fixes the clobber
  without detaching the persist callback (which streaming needs attached, so a mid-load tap can be saved).

## Scope and non-goals

- Stream only the cold-start load (`ensureLibraryLoaded`).
  That is the "several seconds on every launch" pain.

- Keep the foreground re-scan (`rescan`) atomic.
  There the previous library is already on screen,
  so streaming would shrink the visible list to the first batch and then regrow it, a visible flicker.
  Streaming only helps when there is nothing on screen yet.

- Leave the folder-pick load (`reloadFromRoot`) blocking for now.
  It can share the same machinery later,
  but reusing `reconcile` there changes how old playback stops when the new folder lacks the old track,
  which is its own decision and not part of this change.

## Edge cases the plan handles

- Empty library: no batches emit, the terminal restore clears the loading flag,
  and the screen correctly shows "No music found" rather than a stuck spinner.

- You tap a track mid-load: the tap is preserved across later batches
  (re-pointed by URI), and the terminal step keeps it instead of overriding it with the saved track.

- A newer load supersedes an older one (for example a folder pick during a scan):
  the cancellation propagates through the batch callback rather than being swallowed,
  because batches emit from the outer loop, not the exception-swallowing helper.

- A saved track was deleted since last run:
  the existing restore auto-correction still applies (the URI lookup fails and nothing is selected),
  unchanged by this plan.

## How we will verify

This runs on a real connected device,
so the build is installed and the user drives it.

- Streaming: rows appear in the list before the "scan complete" log line,
  and the first rows show within a fraction of the old full-scan wait.
  A new per-batch log line makes the incremental emission visible in logcat.

- Resume fix: with a track selected and a non-default volume set,
  fully relaunch the app and confirm the selection, position, and volume come back.
  This is the exact behaviour the clobber breaks
  and that a "did rows appear" check would not catch,
  so it is tested on its own.

## Files this will touch

- `packages/android-app/music-player/app/src/main/kotlin/dev/monochromatic/musicplayer/SafTreeSource.kt`:
  add the batch callback and emit sorted-so-far from the outer directory loop.
- `packages/android-app/music-player/app/src/main/kotlin/dev/monochromatic/musicplayer/MediaStoreSource.kt`:
  add the batch callback and emit sorted-so-far from the cursor loop.
- `packages/android-app/music-player/app/src/main/kotlin/dev/monochromatic/musicplayer/LibrarySource.kt`:
  forward the callback through `load` and `scanRoot`.
- `packages/android-app/music-player/app/src/main/kotlin/dev/monochromatic/musicplayer/PlayerController.kt`:
  add `finishLoad` (the terminal tap-versus-restore branch).
- `packages/android-app/music-player/app/src/main/kotlin/dev/monochromatic/musicplayer/PlaybackService.kt`:
  stream the cold-start load, add the `sessionRestored` flag, and re-gate `saveSession`.
