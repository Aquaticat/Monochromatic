# music-player

Shared glossary for the music-player product (desktop here;
 the Android sibling at `package/music-player/android-app`
shares this language,
 with the platform deltas noted below).
This file is a glossary of the product's language,
 not a spec and not an implementation record;
 decisions live in `doc/adr/`.

## Language

**Source Root**:
The single directory that identifies what is loaded:
 the directory a user opened,
 the auto-loaded music directory,
or the parent directory of a single file argument.
Exactly one always exists (it is total),
 and the Queue is its scan.
_Avoid_:
 library,
 watch root,
 folder,
 playlist.

**Track**:
One playable audio file found under a Source Root (extension in the audio allowlist).
_Avoid_:
 song,
 item,
 media.

**Queue**:
The in-memory,
 ordered,
 ad-hoc list of Tracks projected from the current Source Root.
It is derived from disk,
 never persisted as a materialized list.
_Avoid_:
 library,
 playlist,
 database.

**Selected Track**:
The one Track the user has cued,
 if any (a Source Root can be loaded with nothing selected).
It is both highlighted and followed in the list,
 and is the thing that plays.
_Avoid_:
 current track,
 now-playing.

**Session**:
The persisted snapshot used to restore on launch:
 the Source Root,
 the optional Selected Track,
 and playback
settings (volume,
 shuffle mode,
 repeat-track) plus the Selected Track's resume position.
It does not store the Queue.
_Avoid_:
 playlist file,
 saved queue,
 state file.

**Live Updating**:
Keeping the Queue in sync with on-disk changes to the Source Root while the app runs.

**Restore Auto-Correction**:
Re-deriving the Queue by re-scanning the Source Root at launch,
 so Tracks added,
 removed,
 or renamed inside the
root are reflected without a stale saved list;
 only the Selected Track can need explicit repair when its file moved.

## Relationships

- A **Session** references exactly one **Source Root** and at most one **Selected Track**.
- Every loaded state has exactly one **Source Root**;
   a single file argument resolves to its parent directory.
- A **Source Root** projects to one **Queue** of zero or more **Tracks**.
- A **Selected Track** is one of the **Tracks** in the current **Queue**,
   or none.
- **Live Updating** and **Restore Auto-Correction** are the same projection (Queue = scan of Source Root) applied
  while running and at launch.

## Platform deltas (Android)

- **Source Root** on Android is resolved dynamically rather than stored:
   a held SAF document-tree grant,
   else the
  device-wide MediaStore collection,
   else empty.
- A **Track** on Android is identified by a content URI,
   not a filesystem path.
- **Live Updating** on Android happens on app foreground and at launch,
   not in real time.

## Example dialogue

> **Dev:
> ** "On restore,
>  do we reload the **Queue** we saved last time?
> "
> **Maintainer:
> ** "No. We save the **Source Root**,
>  then re-scan it to build a fresh **Queue**.
>  The only saved track
> is the **Selected Track**,
>  and if its file moved we try to repair just that one.
> "

## Flagged ambiguities

- "Session should only save the opened dir and the selected track" was resolved to mean stop materializing the Queue,
  not discard settings:
 volume,
   shuffle,
   repeat,
   and the Selected Track's resume position still persist.
- "current" was used for both the **Selected Track** and the array index of the playing track;
 the domain term is **Selected Track**.
