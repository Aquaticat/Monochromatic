// Authored renderer inputs only: these paths and fixture URIs are not media files.

// What: Share the production controller's namespace in the debug source set.
// Why: The actual renderer can receive literal filename data through its public seam.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the source path.
// ```
package dev.monochromatic.musicplayer

// What: Session is the existing immutable restored-state value.
// Why: A selected-row witness uses the real controller's paused restoration path.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Session } from './core/Session';
// ```
import dev.monochromatic.musicplayer.core.Session

/**
 * What: A data class is an immutable value record, unlike an identity-only class.
 * Why: One request keeps independent scene and selection parameters explicit.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type FilenameBaselineRequest = { readonly scene: string; readonly selection: string };
 * ```
 */
internal data class FilenameBaselineRequest(
    /** Bounded long or short authored name set. */
    val scene: String,
    /** Independent no-current, first-current or second-current condition. */
    val selection: String,
    // What: (FilenameBaselineEvent) -> Unit is a typed event-to-void function.
    // Why: The host supplies Android logging; JVM tests record identical events without platform calls.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly report: (event: FilenameBaselineEvent) => void;
    // ```
    val report: (FilenameBaselineEvent) -> Unit,
)

/**
 * What: A data class holds the seeded real controller, recording double and literal paths.
 * Why: The activity and host tests share one setup without copying production rendering.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * type FilenameBaselineFixture = { controller: PlayerController; engine: FilenameBaselineEngine;
 *   displayPaths: readonly string[]; selectedUri: string | null };
 * ```
 */
internal data class FilenameBaselineFixture(
    /** Real controller instance seeded only through public library/session calls. */
    val controller: PlayerController,
    /** Paused recording double with no media or native audio resource. */
    val engine: FilenameBaselineEngine,
    /** Authored source-relative paths before production common-root removal. */
    val displayPaths: List<String>,
    /** Authored selected identity, or null for the no-current-row witness. */
    val selectedUri: String?,
)

/**
 * What: Declare a function with one request value and an explicit fixture return type.
 * Why: Unknown scenes/selections fail instead of changing the intended baseline.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function filenameBaselineFixture(request: FilenameBaselineRequest): FilenameBaselineFixture;
 * ```
 */
internal fun filenameBaselineFixture(request: FilenameBaselineRequest): FilenameBaselineFixture {
    request.report(FilenameBaselineEvent("filenameBaselineFixture", "scene=${request.scene} selection=${request.selection}"))
    // What: Declare a String selected by ordinary if/else statements.
    // Why: Only the bounded long and short matched-name scenes enter the real renderer.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let variant: string;
    // if (request.scene === 'long') variant = 'rankfilelong';
    // else if (request.scene === 'short') variant = 'rankfileshort'; else throw new Error(request.scene);
    // ```
    val variant: String
    if (request.scene == "long") {
        variant = "rankfilelong"
    } else if (request.scene == "short") {
        variant = "rankfileshort"
    } else {
        throw IllegalArgumentException("Unknown actual-player filename scene: ${request.scene}")
    }
    // What: List holds ordered read-only results, unlike MutableList or a fixed Array.
    // Why: Reuse the exact synthetic titles already captured by the Search controls.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const hits: readonly SearchRankingHit[] = searchFilenameHits(variant);
    // ```
    val hits: List<SearchRankingHit> = searchFilenameHits(variant)
    // What: A String if/else expression keeps the declared parent path literal.
    // Why: The long pair includes Live while the short pair uses its existing parent.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const parent = request.scene === 'long' ? 'Cult of Luna/Live' : 'Cult of Luna';
    // ```
    val parent: String = if (request.scene == "long") "Cult of Luna/Live" else "Cult of Luna"
    // What: listOf constructs an ordered read-only List; interpolation inserts literal titles.
    // Why: An unrelated anchor keeps common-root trimming from swallowing the target parent.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const paths = [`StudyLibrary/${parent}/${hits[0].title}`,
    //   `StudyLibrary/${parent}/${hits[1].title}`, 'StudyLibrary/ZAnchor/Anchor.opus'];
    // ```
    val paths: List<String> = listOf(
        "StudyLibrary/$parent/${hits[0].title}",
        "StudyLibrary/$parent/${hits[1].title}",
        "StudyLibrary/ZAnchor/Anchor.opus",
    )
    // What: ArrayList supplies a mutable list at this owned construction boundary.
    // Why: Assign unique synthetic URIs without deriving audio formats from filename suffixes.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const tracks: Track[] = [];
    // ```
    val tracks: ArrayList<Track> = ArrayList<Track>()
    // What: A for loop iterates paths.indices, Kotlin's bounded index range.
    // Why: Preserve the pair's authored order and distinct URI identities.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (let index = 0; index < paths.length; index++) tracks.push({
    //   uri: `fixture://filename-player/${request.scene}/${index}`, displayPath: paths[index] });
    // ```
    for (index in paths.indices) {
        tracks.add(Track("fixture://filename-player/${request.scene}/$index", paths[index]))
    }
    // What: String? permits no selected URI, rather than inventing an index sentinel.
    // Why: Selection and current-row decoration are controlled independently of filenames.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let selectedUri: string | null;
    // ```
    val selectedUri: String?
    if (request.selection == "none") {
        selectedUri = null
    } else if (request.selection == "first") {
        selectedUri = tracks[0].uri
    } else if (request.selection == "second") {
        selectedUri = tracks[1].uri
    } else {
        throw IllegalArgumentException("Unknown actual-player filename selection: ${request.selection}")
    }
    // What: Construct the no-audio interface implementation and production controller.
    // Why: All displayed row/pager state follows the actual controller code path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engine = new FilenameBaselineEngine();
    // const controller = new PlayerController(engine);
    // ```
    val engine: FilenameBaselineEngine = FilenameBaselineEngine(request.report)
    // Reuse the controller constructor with the recording double, never a native engine.
    val controller: PlayerController = PlayerController(engine)
    if (selectedUri == null) {
        controller.openLibrary(tracks)
    } else {
        controller.finishLoad(tracks, Session(selected = selectedUri, positionSecs = 66.0))
    }
    // What: Int stores a bounded page index, rather than fractional Double or Long.
    // Why: Validate actual pagination before selecting the matched parent page.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const page = controller.uiState.pageLabels.indexOf('Cult of Luna');
    // if (page < 0) throw new Error('Authored parent page is absent.');
    // ```
    val page: Int = controller.uiState.pageLabels.indexOf("Cult of Luna")
    if (page < 0) throw IllegalStateException("Authored filename parent page is absent.")
    controller.selectPage(page)
    if (controller.uiState.pageItems.size != 2 || engine.playWhenReady()) {
        throw IllegalStateException("Actual-player filename fixture is not a paused matched pair.")
    }
    // What: Return the immutable record explicitly instead of an implicit tail expression.
    // Why: Capture metadata can inspect the seeded state without rendering copied rows.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { controller, engine, displayPaths: paths, selectedUri };
    // ```
    return FilenameBaselineFixture(controller, engine, paths, selectedUri)
}
