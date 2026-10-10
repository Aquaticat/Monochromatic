// Track list entries for one top-level folder's flat list (D5 and D6). The track list pane draws these
// entries as rows and subfolder headers in the order the folder index gives them. This file is pure logic
// with no Compose imports, so it is unit-tested on the JVM.

// What:     `package dev.monochromatic.musicplayer.core` places these entries beside the folder index they consume.
// Why:      The entries are derived from `FolderEntry`, so they share its package and need no import.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.core

// What:     `private const val TRACK_PATH_SEPARATOR: Char = '/'` separates the segments of a display path.
// Why:      Display paths use `/`, so the file name and the folder name are cut on the same character.
//
// In TS you'd write (pseudocode):
// ```ts
// const TRACK_PATH_SEPARATOR = "/";
// ```
/** Separator between the segments of a relative display path. */
private const val TRACK_PATH_SEPARATOR: Char = '/'

// What:     `private const val EXTENSION_SEPARATOR: Char = '.'` separates a file name from its extension.
// Why:      Only the text after the last dot is the extension, so the title and the `ext` field cut on this character.
//
// In TS you'd write (pseudocode):
// ```ts
// const EXTENSION_SEPARATOR = ".";
// ```
/** Separator between a file name and its extension. */
private const val EXTENSION_SEPARATOR: Char = '.'

// What:     `data class TrackRowModel(...)` is one track row as the track list pane draws it.
// Why:      The pane needs only the library index, the title, the optional supporting line, and the current flag.
//
// In TS you'd write (pseudocode):
// ```ts
// type TrackRowModel = { indexInLibrary: number; title: string; supportingLine: string | null; isCurrent: boolean };
// ```
/** One track row: its library position, title, optional supporting line, and whether it is the playing track. */
data class TrackRowModel(
    /** Position of the track in the library list, passed back when the row is played. */
    val indexInLibrary: Int,
    /** File name without its extension and without the folder part. */
    val title: String,
    /** Template text under the title, or null when the template shows no text for this track. */
    val supportingLine: String?,
    /** Whether this row is the track that is playing now. */
    val isCurrent: Boolean,
)

// What:     `sealed interface TrackListEntry` is one entry of a folder's flat track list. Its two variants are a
//           track row and a subfolder header.
// Why:      A sealed type lets the pane render both entry kinds exhaustively, as the folder index does.
//
// In TS you'd write (pseudocode):
// ```ts
// type TrackListEntry = { kind: "row"; row: TrackRowModel } | { kind: "header"; name: string; trackCount: number };
// ```
/** One entry of a folder's flat track list, either a track row or a subfolder header. */
sealed interface TrackListEntry {
    // What:     `data class RowEntry(val row: TrackRowModel) : TrackListEntry` is a playable track row.
    // Why:      Wrapping the row lets the pane tell it apart from headers.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "row", row };
    // ```
    /** A playable track row inside the folder's list. */
    data class RowEntry(
        /** The row to draw. */
        val row: TrackRowModel,
    ) : TrackListEntry

    // What:     `data class HeaderEntry(val name: String, val trackCount: Int) : TrackListEntry` is the header
    //           row for one subfolder.
    // Why:      The header names the subfolder and counts the tracks directly under it, and its tracks follow it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "header", name, trackCount };
    // ```
    /** A header row that names a subfolder and counts the tracks listed directly under it. */
    data class HeaderEntry(
        /** Subfolder path between the top-level folder and the tracks, such as `Album/Disc 1`. */
        val name: String,
        /** Number of tracks listed directly under this header. */
        val trackCount: Int,
    ) : TrackListEntry
}

// What:     `fun trackTitleFor(displayPath: String): String` returns the file name without its last extension.
// Why:      The row title shows the file name only, so the folder part and the extension are removed.
//
// In TS you'd write (pseudocode):
// ```ts
// const trackTitleFor = (displayPath: string): string => {
//   const name = displayPath.split("/").pop() ?? "";
//   const dot = name.lastIndexOf(".");
//   return dot > 0 ? name.slice(0, dot) : name;
// };
// ```
/** File name of a display path with its last extension removed, keeping the name of a hidden file whole. */
fun trackTitleFor(displayPath: String): String {
    /** The file name, which is the last segment of the display path. */
    val fileName: String = displayPath.substringAfterLast(TRACK_PATH_SEPARATOR)
    /** Position of the last dot in the file name, where a dot at the start marks a hidden file. */
    val dotIndex: Int = fileName.lastIndexOf(EXTENSION_SEPARATOR)
    if (dotIndex <= 0) {
        return fileName
    }
    return fileName.substring(0, dotIndex)
}

// What:     `private fun extensionOf(fileName: String): String` returns the text after the last dot of a file name.
// Why:      The template's `ext` field shows the extension without its dot, and a name without one has none.
//
// In TS you'd write (pseudocode):
// ```ts
// const extensionOf = (fileName: string): string => {
//   const dot = fileName.lastIndexOf(".");
//   return dot > 0 ? fileName.slice(dot + 1) : "";
// };
// ```
/** Extension of a file name without its dot, or an empty text when the name has no extension. */
private fun extensionOf(fileName: String): String {
    /** Position of the last dot in the file name, where a dot at the start marks a hidden file. */
    val dotIndex: Int = fileName.lastIndexOf(EXTENSION_SEPARATOR)
    if (dotIndex <= 0) {
        return ""
    }
    return fileName.substring(dotIndex + 1)
}

// What:     `private fun trackFieldsFor(displayPath: String): TrackFields` gathers the template fields of one track.
// Why:      The supporting line reads its fields from `TrackFields`, and duration and true peak are unknown per row,
//           so both are passed as null.
//
// In TS you'd write (pseudocode):
// ```ts
// function trackFieldsFor(displayPath: string): TrackFields {
//   return { title, file: title, ext, folder, path: displayPath, len: undefined, peak: undefined };
// }
// ```
/** Builds the template fields of one track from its display path, with duration and peak left unknown. */
private fun trackFieldsFor(displayPath: String): TrackFields {
    /** The file name, which is the last segment of the display path. */
    val fileName: String = displayPath.substringAfterLast(TRACK_PATH_SEPARATOR)
    /** The folder path that holds the file, empty for a file at the library root. */
    val parentPath: String = displayPath.substringBeforeLast(TRACK_PATH_SEPARATOR, "")
    /** The innermost folder name, which is the last segment of the parent path. */
    val folderName: String = parentPath.substringAfterLast(TRACK_PATH_SEPARATOR)
    /** The file name without its extension, which is also the row title. */
    val title: String = trackTitleFor(displayPath)
    return TrackFields(
        title = title,
        file = title,
        ext = extensionOf(fileName),
        folder = folderName,
        path = displayPath,
        len = null,
        peak = null,
    )
}

// What:     `private fun supportingLineFor(template: String, fields: TrackFields): String?` evaluates the template
//           for one track and returns its trimmed text, or null when nothing is shown.
// Why:      A refused template must show no error text, and an unknown field leaves blanks that would otherwise
//           show as a stray space, so both cases give null and the row has no second line.
//
// In TS you'd write (pseudocode):
// ```ts
// function supportingLineFor(template: string, fields: TrackFields): string | null {
//   const result = evaluateTemplate(template, fields);
//   if (!result.valid) return null;
//   return result.text.trim() || null;
// }
// ```
/** Trimmed template text for one track, or null when the template is refused or shows only blanks. */
private fun supportingLineFor(template: String, fields: TrackFields): String? {
    /** Outcome of evaluating the template for this track. */
    val result: TemplateResult = evaluateTemplate(template, fields)
    if (result !is TemplateResult.Shown) {
        return null
    }
    /** Shown text with the blanks left by unknown fields removed from both ends. */
    val text: String = result.text.trim()
    if (text.isEmpty()) {
        return null
    }
    return text
}

// What:     `private fun rowFor(row: FolderTrackRow, currentIndexInLibrary: Int?, template: String): TrackRowModel`
//           maps one folder track to its row model.
// Why:      The title, supporting line, and current flag are all derived from the track and the playing index.
//
// In TS you'd write (pseudocode):
// ```ts
// function rowFor(row: FolderTrackRow, current: number | null, template: string): TrackRowModel { /* ... */ }
// ```
/** Maps one folder track to a row with its title, supporting line, and current flag. */
private fun rowFor(row: FolderTrackRow, currentIndexInLibrary: Int?, template: String): TrackRowModel {
    /** Display path of the track, which supplies the title and the template fields. */
    val displayPath: String = row.track.displayPath
    return TrackRowModel(
        indexInLibrary = row.indexInLibrary,
        title = trackTitleFor(displayPath),
        supportingLine = supportingLineFor(template, trackFieldsFor(displayPath)),
        isCurrent = row.indexInLibrary == currentIndexInLibrary,
    )
}

// What:     `private fun entryFor(item: FolderListItem, currentIndexInLibrary: Int?, template: String): TrackListEntry`
//           maps one folder list item to a track list entry.
// Why:      Track items become rows and subfolder headers become headers, in the same position.
//
// In TS you'd write (pseudocode):
// ```ts
// function entryFor(item: FolderListItem, current: number | null, template: string): TrackListEntry {
//   return item.kind === "track" ? { kind: "row", row: rowFor(item.row, current, template) }
//     : { kind: "header", name: item.name, trackCount: item.trackCount };
// }
// ```
/** Maps one folder list item to a track row or a subfolder header entry. */
private fun entryFor(item: FolderListItem, currentIndexInLibrary: Int?, template: String): TrackListEntry =
    when (item) {
        is FolderListItem.TrackItem -> TrackListEntry.RowEntry(rowFor(item.row, currentIndexInLibrary, template))
        is FolderListItem.SubfolderHeader -> TrackListEntry.HeaderEntry(item.name, item.trackCount)
    }

// What:     `fun trackListEntries(...)` maps one folder's flat list to track list entries in the same order.
// Why:      The pane draws entries in order, so the folder index's own-tracks-first order (D5) and the playback order
//           (D6) carry through unchanged.
//
// In TS you'd write (pseudocode):
// ```ts
// export function trackListEntries(folder: FolderEntry, current: number | null, template = DEFAULT): TrackListEntry[] {
//   return folder.items.map((item) => entryFor(item, current, template));
// }
// ```
/** Maps a folder's flat list to track rows and headers, flagging the playing row and its supporting line. */
fun trackListEntries(
    folder: FolderEntry,
    currentIndexInLibrary: Int?,
    template: String = DEFAULT_TRACK_TEMPLATE,
): List<TrackListEntry> = folder.items.map { item -> entryFor(item, currentIndexInLibrary, template) }
