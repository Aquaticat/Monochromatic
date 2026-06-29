# music-player: Live updating is one rescan-and-diff projection

Status:
 decisions accepted;
 implementation not yet started.
 Date:
 2026-06-13.
Applies to both `packages/music-player/desktop-app` and `packages/music-player/android-app`.

## Context

The app should keep its Queue in sync with on-disk changes to the Source Root while running,
 and repair the
session at launch.
An incremental approach (splice each create/remove/rename event into the Queue) was considered first,
 chosen to
preserve the precomputed shuffle order.
That justification disappeared once shuffle moved to just-in-time with no precomputed order
(see `music-player-jit-shuffle.md`).

## Decision

There is one projection everywhere:
 **Queue = a debounced scan of the Source Root,
 diffed against the current
Queue to preserve the Selected Track by path (by content URI on Android)**.
The same scan-and-diff serves launch/restore,
 the desktop live watcher,
 and the Android resume refresh.

- Desktop watches the Source Root with the `notify` crate and a short debounce
  (`notify-debouncer-mini` suffices;
 the watcher only needs a coarse "something under the root changed" signal,
   so rename pairing and a file-ID cache
  are unnecessary).
  `notify`'s `need_rescan()` (dropped or coarsened events) is not a special case;
 it is just another "rescan now.
  "
- Android re-scans on app foreground (ON_RESUME) and at launch.
  Real-time watching is not possible on the SAF Source Root:
   AOSP `ExternalStorageProvider` only notifies for
  operations it performs itself (no external create/delete/rename events),
   and `FileObserver` (inotify,
   path-based)
  cannot reach the shared library under scoped storage.
  Verified against the AOSP `master` sources for `ExternalStorageProvider` and `FileObserver`.
- When a track is added live it appears at its natural sorted position (shuffle-off) or as an eligible just-in-time
  pick (shuffle-on);
 `collect_dir_files` already sorts,
   so a rescan is deterministic and does not reorder unchanged tracks.
- When the currently playing track's file leaves the Source Root,
   playback stops and the selection clears.
- The playing track is owned by the decoder,
   not the Queue,
   so a rescan never interrupts audio.
- A file modified in place self-heals:
   its `(path, size, mtime)` peak-cache fingerprint changes,
   so the next decode
  is a cache miss and re-measures.

## Consequences

- One code path to build and test instead of two that would produce identical Queues.
- At the owner's measured library size (3857 files) a debounced directory walk is milliseconds,
   so there is no
  performance reason to avoid a full rescan.
- Sub-debounce-latency updates are out of scope;
 a change shows up after the debounce window (desktop) or on the next foreground (Android).
