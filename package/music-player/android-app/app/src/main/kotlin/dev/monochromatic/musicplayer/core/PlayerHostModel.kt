// Pure rules behind the player host: the library rebuild, the Search result activation, and the template texts
// applied to the track rows, the playing line, and the template editor preview. This file has no Compose imports,
// so every rule is unit-tested on the JVM.

// What:     `package dev.monochromatic.musicplayer.core` places the rules beside the page, Search, and template types.
// Why:      The rules use those types directly, so they share this package and need no extra imports.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.core

// What:     `import dev.monochromatic.musicplayer.Track` brings in the library track type.
// Why:      The library rebuild returns tracks, and Search reads them through the same type.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Track } from "dev.monochromatic.musicplayer/Track";
// ```
import dev.monochromatic.musicplayer.Track

// What:     `class LibraryRebuildError(message: String) : IllegalStateException(message)` reports a library whose
//           URIs and page entries do not line up.
// Why:      A mismatch means the controller's two stores disagree, so the rebuild must not guess a track.
//
// In TS you'd write (pseudocode):
// ```ts
// class LibraryRebuildError extends Error {}
// ```
/** Thrown when the stored URIs and the page entries do not describe the same library in load order. */
class LibraryRebuildError(message: String) : IllegalStateException(message)

// What:     `sealed interface SearchActivation` names what activating one Search result does.
// Why:      The host decides the player action from the result alone, so the decision is pure and testable.
//
// In TS you'd write (pseudocode):
// ```ts
// type SearchActivation =
//   | { kind: "playTrack"; indexInLibrary: number }
//   | { kind: "togglePlayback" }
//   | { kind: "openFolder"; page: number }
//   | { kind: "stayInSearch" };
// ```
/** What activating one Search result does to the player. */
sealed interface SearchActivation {
    // What:     `data class PlayTrack(val indexInLibrary: Int)` starts a track that is not the playing one.
    // Why:      A different track starts from its load-order index, as a player row does (D73).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "playTrack"; indexInLibrary: number }
    // ```
    /** Starts the track at one load-order index. */
    data class PlayTrack(
        /** Load-order index of the track to start. */
        val indexInLibrary: Int,
    ) : SearchActivation

    // What:     `data object TogglePlayback` pauses or resumes the track that is already playing.
    // Why:      Playing the current track again would restart it, so the current result keeps the row toggle (D73).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "togglePlayback" }
    // ```
    /** Pauses the playing track, or resumes it, for a result that is the playing track. */
    data object TogglePlayback : SearchActivation

    // What:     `data class OpenFolder(val page: Int)` selects one page of the library without starting a track.
    // Why:      A folder result shows its folder and never autoplays (D72).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "openFolder"; page: number }
    // ```
    /** Selects one page without autoplay, for a folder result. */
    data class OpenFolder(
        /** Tab-order index of the page to select. */
        val page: Int,
    ) : SearchActivation

    // What:     `data object StayInSearch` keeps the Search page open when the result cannot be opened.
    // Why:      A result that names no index or no page must not claim that playback or navigation succeeded (D74).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // { kind: "stayInSearch" }
    // ```
    /** Keeps the Search page open, for a result the player cannot open. */
    data object StayInSearch : SearchActivation
}

// What:     `object PlayerHostModel` groups the pure rules the player host applies.
// Why:      One named object keeps the rules out of the top-level namespace and lets tests call them by name.
//
// In TS you'd write (pseudocode):
// ```ts
// const PlayerHostModel = { libraryTracksFrom, searchActivationFor, contentWithTemplates, ... } as const;
// ```
/** Pure rules the player host applies to the library, Search results, and template texts. */
object PlayerHostModel {
    // What:     `private const val PATH_SEPARATOR: Char = '/'` separates the segments of a display path.
    // Why:      The template fields split a display path into its file name and folder, so the separator is named once.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const PATH_SEPARATOR = "/";
    // ```
    /** Separator between the segments of a display path. */
    private const val PATH_SEPARATOR: Char = '/'

    // What:     `private const val EXTENSION_SEPARATOR: Char = '.'` separates a file name from its extension.
    // Why:      The `ext` field is the text after the last dot, and a dot at the start marks a hidden file.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const EXTENSION_SEPARATOR = ".";
    // ```
    /** Separator between a file name and its extension. */
    private const val EXTENSION_SEPARATOR: Char = '.'

    // What:     `fun libraryTracksFrom(uris, pages): List<Track>` rebuilds every library track in load order.
    // Why:      The controller keeps the URIs in load order and the display paths only inside the pages, so the
    //           page entries' load indices link the two.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function libraryTracksFrom(uris: string[], pages: Page[]): Track[] { /* name by index, then zip */ }
    // ```
    /** Rebuilds every library track in load order from the URIs and the page entries' display paths. */
    fun libraryTracksFrom(uris: List<String>, pages: List<Page>): List<Track> {
        /** Display path of each load-order index, taken from the page entries of every page. */
        val namesByIndex: Map<Int, String> = pages
            .flatMap { page -> page.entries }
            .associate { entry -> entry.index to entry.name }
        if (namesByIndex.size != uris.size) {
            throw LibraryRebuildError(
                "The library holds ${uris.size} URIs but ${namesByIndex.size} page entries.",
            )
        }
        return uris.mapIndexed { index, uri ->
            Track(
                uri = uri,
                displayPath = namesByIndex[index]
                    ?: throw LibraryRebuildError("No page entry has load index $index."),
            )
        }
    }

    // What:     `fun searchActivationFor(...)` decides what one Search result does.
    // Why:      A track result plays its index unless it is the playing track, and a folder result selects its page
    //           without autoplay; any result that names nothing the player can reach stays on Search.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function searchActivationFor(result, pageLabels, currentIndex): SearchActivation { /* ... */ }
    // ```
    /** Decides what activating one Search result does, from the result, the page names, and the playing index. */
    fun searchActivationFor(
        result: SearchResult,
        pageLabels: List<String>,
        currentIndex: Int?,
    ): SearchActivation {
        if (result.kind == SearchResultKind.TRACK) {
            if (isCurrentTrackResult(result, currentIndex)) {
                return SearchActivation.TogglePlayback
            }
            /** Load-order index of the track the result names, or null when the result names no index. */
            val index: Int = result.indexInLibrary ?: return SearchActivation.StayInSearch
            return SearchActivation.PlayTrack(index)
        }
        /** Top-level folder the result names, or null when the result names no folder. */
        val folder: String = result.folderName ?: return SearchActivation.StayInSearch
        /** Tab-order index of the page with that folder name, or -1 when no page has it. */
        val page: Int = pageLabels.indexOf(folder)
        if (page < 0) {
            return SearchActivation.StayInSearch
        }
        return SearchActivation.OpenFolder(page)
    }

    // What:     `fun contentWithTemplates(...)` applies the saved track-row and playing-track templates to a model.
    // Why:      The built model uses the default template, so the host replaces its rows and deck line with the
    //           saved texts; a refused playing template keeps the built "N of M" line.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function contentWithTemplates(base, page, current, duration, rowsTpl, playingTpl): Model { /* ... */ }
    // ```
    /** Applies the saved track-row and playing-track templates to a screen model built from the controller. */
    fun contentWithTemplates(
        base: PlayerContentModel,
        pageItems: List<PageEntry>,
        currentIndex: Int?,
        durationSec: Double,
        trackRowsTemplate: String,
        playingTemplate: String,
    ): PlayerContentModel {
        /** Track rows and subfolder headers of the selected page, each row carrying its template supporting line. */
        val entries: List<TrackListEntry> = trackListEntries(
            folder = pageFolderFor(folderTitle = base.folderTitle, pageItems = pageItems),
            currentIndexInLibrary = currentIndex,
            template = trackRowsTemplate,
        )
        /** Position of the playing row among the track rows, or -1 when the playing track is not on this page. */
        val rowPosition: Int = entries
            .filterIsInstance<TrackListEntry.RowEntry>()
            .indexOfFirst { entry -> entry.row.isCurrent }
        /** Page entry of the playing track, or null when the playing track is not on this page. */
        val playingEntry: PageEntry? = pageItems.firstOrNull { item -> item.index == currentIndex }
        /** Deck subtitle from the playing template, or the built line when the template is refused. */
        val subtitle: String = deckSubtitleFor(
            playingEntry = playingEntry,
            rowPosition = rowPosition,
            pageTrackCount = pageItems.size,
            durationSec = durationSec,
            template = playingTemplate,
            fallback = base.deck.subtitle,
        )
        return base.copy(entries = entries, deck = base.deck.copy(subtitle = subtitle))
    }

    // What:     `fun restoredEditor(stored: Map<TemplateKind, String>): TemplateEditorState` starts the editor from
    //           the saved texts.
    // Why:      The rows and Settings must show the saved template, so both the draft and the last applied text
    //           come from the store.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function restoredEditor(stored: Record<TemplateKind, string>): EditorState { /* drafts = lastValid = stored */ }
    // ```
    /** Starts the template editor with each template's stored text as both its draft and its last applied text. */
    fun restoredEditor(stored: Map<TemplateKind, String>): TemplateEditorState =
        TemplateEditorState.initial(emptyList()).copy(drafts = stored, lastValid = stored)

    // What:     `fun editorWithPreview(...)` sets the editor's preview to the first track rows of the selected page.
    // Why:      The editor previews the user's own tracks, and it shows stand-in values only while the page is empty.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function editorWithPreview(editor, page): EditorState { /* first two rows, or stand-ins */ }
    // ```
    /** Sets the editor preview to the first track rows of the selected page, or to the stand-ins for an empty page. */
    fun editorWithPreview(editor: TemplateEditorState, pageItems: List<PageEntry>): TemplateEditorState {
        /** Preview fields of the first track rows of the page, each with its place in the page. */
        val fields: List<PlayingTrackFields> = pageItems
            .take(TEMPLATE_PREVIEW_ROW_COUNT)
            .mapIndexed { index, entry ->
                playingFieldsOf(
                    displayPath = entry.name,
                    placeInFolder = index + 1,
                    tracksInFolder = pageItems.size,
                    lengthSec = null,
                )
            }
        if (fields.isEmpty()) {
            return editor.copy(previewTracks = TEMPLATE_SAMPLE_TRACKS, usesSampleValues = true)
        }
        return editor.copy(previewTracks = fields, usesSampleValues = false)
    }

    // What:     `fun playingFieldsOf(...)` builds the playing-track fields of one track.
    // Why:      The playing template reads the track fields plus its place and the folder total, and the duration
    //           is known only for the playing track.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function playingFieldsOf(path, place, total, len): PlayingTrackFields { /* ... */ }
    // ```
    /** Builds the template fields of one track with its place, the folder total, and an optional duration. */
    fun playingFieldsOf(
        displayPath: String,
        placeInFolder: Int?,
        tracksInFolder: Int?,
        lengthSec: Double?,
    ): PlayingTrackFields = PlayingTrackFields(
        track = trackFieldsOf(displayPath = displayPath, lengthSec = lengthSec),
        placeInFolder = placeInFolder,
        tracksInFolder = tracksInFolder,
    )

    // What:     `private fun deckSubtitleFor(...)` evaluates the playing template for the playing track.
    // Why:      The deck line shows the playing template's text, and it shows the built "N of M" line when the
    //           template is refused, so a broken template never blanks the deck.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function deckSubtitleFor(...): string { /* evaluate; refused -> fallback */ }
    // ```
    /** Returns the deck line of the playing track, or the fallback when the template is refused. */
    private fun deckSubtitleFor(
        playingEntry: PageEntry?,
        rowPosition: Int,
        pageTrackCount: Int,
        durationSec: Double,
        template: String,
        fallback: String,
    ): String {
        if (playingEntry == null || rowPosition < 0) {
            return ""
        }
        /** Fields of the playing track: its place among the track rows, the page total, and the known duration. */
        val fields: PlayingTrackFields = playingFieldsOf(
            displayPath = playingEntry.name,
            placeInFolder = rowPosition + 1,
            tracksInFolder = pageTrackCount,
            lengthSec = lengthOf(durationSec),
        )
        /** Outcome of evaluating the playing template for the playing track. */
        val result: TemplateResult = evaluateTemplate(template, fields, TemplateKind.PLAYING_TRACK.fields)
        return when (result) {
            is TemplateResult.Shown -> result.text.trim()
            is TemplateResult.Refused -> fallback
        }
    }

    // What:     `private fun lengthOf(durationSec: Double): Double?` treats a zero duration as unknown.
    // Why:      The player reports zero until a track loads, and a zero length must not show as "0:00".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const lengthOf = (sec: number): number | undefined => (sec > 0 ? sec : undefined);
    // ```
    /** The duration when it is positive, or null when the duration is not known yet. */
    private fun lengthOf(durationSec: Double): Double? = if (durationSec > 0.0) durationSec else null

    // What:     `private fun trackFieldsOf(...)` gathers the template fields of one track from its display path.
    // Why:      The playing template needs the same fields as a track row, and the peak is not known to the host.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function trackFieldsOf(path: string, len?: number): TrackFields { /* title, file, ext, folder, path */ }
    // ```
    /** Builds the template fields of one track from its display path, with the peak left unknown. */
    private fun trackFieldsOf(displayPath: String, lengthSec: Double?): TrackFields {
        /** File name, which is the last segment of the display path. */
        val fileName: String = displayPath.substringAfterLast(PATH_SEPARATOR)
        /** Folder path that holds the file, empty for a file at the library root. */
        val parentPath: String = displayPath.substringBeforeLast(PATH_SEPARATOR, "")
        /** Innermost folder name, which is the last segment of the parent path. */
        val folderName: String = parentPath.substringAfterLast(PATH_SEPARATOR)
        /** File name without its extension, which the row title shows too. */
        val title: String = trackTitleFor(displayPath)
        return TrackFields(
            title = title,
            file = title,
            ext = extensionOf(fileName),
            folder = folderName,
            path = displayPath,
            len = lengthSec,
            peak = null,
        )
    }

    // What:     `private fun extensionOf(fileName: String): String` returns the extension without its dot.
    // Why:      The `ext` field shows the text after the last dot, and a leading dot marks a hidden file with none.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const extensionOf = (name: string) => (name.lastIndexOf(".") > 0 ? name.slice(name.lastIndexOf(".") + 1) : "");
    // ```
    /** Extension of a file name without its dot, or an empty text when the name has none. */
    private fun extensionOf(fileName: String): String {
        /** Position of the last dot in the file name, where a dot at the start marks a hidden file. */
        val dotIndex: Int = fileName.lastIndexOf(EXTENSION_SEPARATOR)
        if (dotIndex <= 0) {
            return ""
        }
        return fileName.substring(dotIndex + 1)
    }
}
