# music-player: Session stores the Source Root, not a materialized Queue

Status:
 decisions accepted;
 implementation not yet started.
 Date:
 2026-06-13.
Applies to both `package/music-player/desktop-app` and `package/music-player/android-app`.

## Context

The Session used to persist the entire Queue as a frozen list of track paths,
 plus cursor,
 position,
 and
settings.
On restore it pruned whatever had vanished (`prune_unplayable` on desktop,
 `pruneUnplayable` on Android).
The saved list and the on-disk reality drift apart over time,
 and pruning is a band-aid over that drift.

## Decision

The Session persists the **Source Root** (the opened directory) and the optional **Selected Track**,
 plus playback
settings (volume,
 shuffle mode,
 repeat-track) and the Selected Track's resume position.
It does not persist the Queue.
On launch the Source Root is re-scanned to rebuild a fresh Queue,
 and the Selected Track is re-selected by path
(by content URI on Android) if it is still present.

Supporting choices:

- The **Source Root is total**:
   exactly one always exists.
  A single file argument resolves to its parent directory with that file pre-selected,
   so there is no rootless-queue
  state to design around.
- The multi-path CLI (multiple files or folders in one invocation) is removed;
 the binary accepts at most one path (a directory,
   or a file that resolves to its parent).
- If the saved Source Root is gone at launch,
   desktop falls back to the XDG music directory and persists it as the
  new root.
  Android already resolves SAF grant,
   then MediaStore,
   then empty,
   so it needs no separate fallback.
- If the Selected Track's path or URI is absent from the fresh scan,
   the selection is cleared (no filename or
  content-hash re-identification);
 the Queue rescan is the correction,
   and the single cued track is the only casualty.

## Consequences

- Restore Auto-Correction falls out for free:
   a re-scan reflects added,
   removed,
   and renamed files inside the root
  with no stale list.
- The persisted format changes,
   so this is hard to reverse once shipped;
 old sessions storing a track list are read as "no usable root" and fall through to the launch default.
- Resuming into a file that changed in place may need the saved position clamped to the new duration.
