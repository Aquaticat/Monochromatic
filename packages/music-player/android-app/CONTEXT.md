# music-player-android

Android port of the music-player product.
It shares the product glossary in `../desktop-app/CONTEXT.md`
(Source Root,
 Track,
 Queue,
 Selected Track,
 Session,
 Live Updating,
 Restore Auto-Correction);
 this file records only the terms whose Android referent differs.

## Language (Android-specific referents)

**Source Root**:
The dynamically resolved source,
 never persisted:
 a held SAF document-tree grant,
 else the device-wide MediaStore
collection,
 else empty.
_Avoid_:
 library folder,
 the path.

**Track identity**:
A content URI (a SAF document URI or a MediaStore item URI),
 not a filesystem path.
_Avoid_:
 path,
 filename.

**Live Updating**:
On Android,
 a re-scan on app foreground and at launch,
 not a real-time watcher.

## Relationships

- The **Session** on Android persists only the **Selected Track** (by URI),
   settings,
   and resume position;
 the **Source Root** is re-resolved by `LibrarySource.load` each launch rather than stored.

## Flagged ambiguities

- "watch the folder" has no literal Android implementation;
 it is resolved to the ON_RESUME re-scan above,
   not a filesystem watcher.
