// Wiring cases of the player host, rendered for real under Robolectric over a controller that drives a fake engine:
// the host provides the playing index and the line source to the track list and builds the rows of the page it shows.

// What:     `package ...wiring` groups the Robolectric Compose tests, which share the fixtures of this package.
// Why:      The cases reach `playerHost`, `PlayerController` and `SessionStore` of the app module.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.wiring

import android.content.Context
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isNotSelected
import androidx.compose.ui.test.isSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.core.app.ApplicationProvider
import dev.monochromatic.musicplayer.FakeAudioEngine
import dev.monochromatic.musicplayer.FeedbackHostState
import dev.monochromatic.musicplayer.PlayerController
import dev.monochromatic.musicplayer.SessionStore
import dev.monochromatic.musicplayer.SweepProgress
import dev.monochromatic.musicplayer.Track
import dev.monochromatic.musicplayer.core.TemplateKind
import dev.monochromatic.musicplayer.playerHost
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

// What:     `class PlayerHostWiringTest` groups the cases of the real player host.
// Why:      The host passes `state.currentIndex` to the list through `LocalPlayingIndex`, builds the rows of the shown
//           page in a `remember` block with its own keys, and hands the list a line source; a mistake at any of those
//           sites keeps every pure-function test green, so each case here pins one through what the screen shows.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("PlayerHost wiring", () => { /* cases rendered with a test renderer */ });
// ```
/** Renders [playerHost] over invented tracks and asserts the playing marker, the opening scroll and the rows. */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
class PlayerHostWiringTest {
    /** Compose test rule that hosts each case's content in an empty activity. */
    @get:Rule
    val composeTestRule = createComposeRule()

    /** Controller over a fake engine, so no native library or audio device is involved. */
    private val controller = PlayerController(FakeAudioEngine())

    // What:     `@Before fun resetProcessState()` puts the process-wide state of the app into a known shape.
    // Why:      Robolectric keeps the app's classes loaded across the cases of a run, so the template cache of
    //           `SessionStore` and the sweep progress carry over; each case starts from a template that shows every
    //           track's file extension and from an idle sweep.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // beforeEach(() => { sessionStore.saveTemplate("track rows", "$mi(ext)$"); sweepProgress.reset(); });
    // ```
    /** Saves the extension template for the track rows and clears the sweep progress. */
    @Before
    fun resetProcessState() {
        /** Application context that the host reads the saved templates through. */
        val context: Context = ApplicationProvider.getApplicationContext()
        SessionStore.saveTemplate(context, TemplateKind.TRACK_ROWS, EXTENSION_TEMPLATE)
        SweepProgress.reset()
    }

    /** Invented tracks of one folder, `Alpha/Track NN.mp3`, with content URIs that name nothing real. */
    private fun alpha(count: Int): List<Track> = (0 until count).map { track ->
        Track(uri = "content://invented/alpha/$track", displayPath = "Alpha/${titleOf(track)}.mp3")
    }

    /** Shows the real host over [controller] and waits until its first frames are composed. */
    private fun showHost() {
        composeTestRule.setContent {
            MaterialTheme {
                playerHost(controller = controller, feedback = FeedbackHostState(), onChooseFolder = { })
            }
        }
        composeTestRule.waitForIdle()
    }

    /** Runs [change] on the UI thread, where the controller expects its calls, and waits for the frames it causes. */
    private fun change(change: () -> Unit) {
        composeTestRule.runOnIdle(change)
        composeTestRule.waitForIdle()
    }

    /** Count of nodes whose text list holds exactly [text], zero when no composed row shows it. */
    private fun countNodesWithText(text: String): Int =
        composeTestRule.onAllNodes(hasText(text)).fetchSemanticsNodes().size

    // What:     `@Test fun thePlayingRowIsTheOnlySelectedRow()` checks the host's playing index reaches the rows.
    // Why:      The host provides `LocalPlayingIndex provides state.currentIndex`; with any other value the rows get
    //           no marker, because the rows the host builds carry none of their own.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("one selected row", () => { render(host, { playing: 3 }); expect(selectedRows()).toEqual(["Track 03"]); });
    // ```
    /** With the fourth track playing, exactly the row titled `Track 03` is selected and its neighbours are not. */
    @Test(timeout = CASE_LIMIT_MS)
    fun thePlayingRowIsTheOnlySelectedRow() {
        controller.openLibrary(alpha(count = 8))
        controller.playIndex(3)
        showHost()
        composeTestRule.onAllNodes(hasText(titleOf(3)) and isSelected()).assertCountEquals(1)
        composeTestRule.onAllNodes(hasText(titleOf(2)) and isNotSelected()).assertCountEquals(1)
        composeTestRule.onAllNodes(hasText(titleOf(4)) and isNotSelected()).assertCountEquals(1)
        composeTestRule.onAllNodes(hasText("Track", substring = true) and isSelected()).assertCountEquals(1)
    }

    // What:     `@Test fun theMarkerFollowsNextAndPrevious()` checks the host updates the marker on a track change.
    // Why:      The rows of the page are not rebuilt on a track change, so the only way the marker moves is the playing
    //           index that the host re-provides each time the controller's state changes.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("marker follows next", () => { render(host, { playing: 3 }); next(); expect(selectedRows()).toEqual(["Track 04"]); });
    // ```
    /** Next moves the selected row from `Track 03` to `Track 04`, and previous moves it back. */
    @Test(timeout = CASE_LIMIT_MS)
    fun theMarkerFollowsNextAndPrevious() {
        controller.openLibrary(alpha(count = 8))
        controller.playIndex(3)
        showHost()
        change { controller.next() }
        composeTestRule.onAllNodes(hasText(titleOf(4)) and isSelected()).assertCountEquals(1)
        composeTestRule.onAllNodes(hasText(titleOf(3)) and isNotSelected()).assertCountEquals(1)
        change { controller.prev() }
        composeTestRule.onAllNodes(hasText(titleOf(3)) and isSelected()).assertCountEquals(1)
        composeTestRule.onAllNodes(hasText(titleOf(4)) and isNotSelected()).assertCountEquals(1)
    }

    // What:     `@Test fun theHostOpensTheListOnThePlayingRow()` checks the page entry scroll through the whole host.
    // Why:      The pane scrolls to the playing row on entry only if the host's playing index reaches it, so this case
    //           fails when the host provides no index even though the pane's own cases pass.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("opens on playing", () => { render(host, { rows: 60, playing: 40 }); expect(visible("Track 40")).toBe(true); });
    // ```
    /** A sixty-row folder with track 40 playing opens on that row, and the first row is not composed. */
    @Test(timeout = CASE_LIMIT_MS)
    fun theHostOpensTheListOnThePlayingRow() {
        controller.openLibrary(alpha(count = 60))
        controller.playIndex(40)
        showHost()
        composeTestRule.waitUntil(timeoutMillis = WAIT_LIMIT_MS) {
            composeTestRule.onAllNodes(hasText(titleOf(40)) and isSelected()).fetchSemanticsNodes().size == 1
        }
        assertEquals(0, countNodesWithText(titleOf(0)))
    }

    // What:     `@Test fun aTrackAddedToTheShownFolderAppearsAsARow()` checks the rows are rebuilt when the page changes.
    // Why:      The host builds the rows in a `remember` block keyed on the page's entries; a rescan that adds a track
    //           to the folder keeps the folder's name, so only the entries key can make the new row appear.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("new row", () => { render(host, { rows: 5 }); rescan(6); expect(visible("Track 05")).toBe(true); });
    // ```
    /** After a rescan adds `Track 05` to a folder of five tracks, the list shows a row for it. */
    @Test(timeout = CASE_LIMIT_MS)
    fun aTrackAddedToTheShownFolderAppearsAsARow() {
        controller.openLibrary(alpha(count = 5))
        showHost()
        assertEquals(0, countNodesWithText(titleOf(5)))
        change { controller.reconcileLibrary(alpha(count = 6)) }
        assertEquals(1, countNodesWithText(titleOf(5)))
    }

    // What:     `@Test fun aTrackAddedToTheShownFolderShowsItsSupportingLine()` checks the line source is rebuilt too.
    // Why:      The host hands the rows a source built from the page's entries in a `remember` block; a source that
    //           kept the old entries finds no path for the new track and leaves its row without a line.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("new row has its line", () => { render(host, { rows: 5 }); rescan(6); expect(rowText("Track 05")).toContain("mp3"); });
    // ```
    /** The row of the added track shows the extension line like every other row. */
    @Test(timeout = CASE_LIMIT_MS)
    fun aTrackAddedToTheShownFolderShowsItsSupportingLine() {
        controller.openLibrary(alpha(count = 5))
        showHost()
        assertEquals(5, countNodesWithText(EXTENSION_LINE))
        change { controller.reconcileLibrary(alpha(count = 6)) }
        composeTestRule.onAllNodes(hasText(titleOf(5)) and hasText(EXTENSION_LINE)).assertCountEquals(1)
        assertEquals(6, countNodesWithText(EXTENSION_LINE))
    }

    /** Template of the track rows that shows only the file extension, so every row has a line without a measure. */
    private companion object {
        /** Template text, in the app's formula syntax, that prints the extension field. */
        const val EXTENSION_TEMPLATE: String = "\$mi(ext)\$"

        /** The line that template gives each of the invented `.mp3` tracks. */
        const val EXTENSION_LINE: String = "mp3"
    }
}
