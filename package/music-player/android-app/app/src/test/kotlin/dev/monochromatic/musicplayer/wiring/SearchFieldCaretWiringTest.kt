// Wiring cases of the Search query field's caret, rendered for real under Robolectric: the query is kept by the host
// across a fold change, so the rebuilt header must put the caret after the kept text and typing must continue there.

// What:     `package ...wiring` groups the Robolectric Compose tests, which share the fixtures of this package.
// Why:      The cases reach `searchPage` and the focus local of the host keyboard.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer.wiring

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextInputSelection
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.unit.dp
import dev.monochromatic.musicplayer.HostKeyLocalSearchFocus
import dev.monochromatic.musicplayer.core.SEARCH_FIELD_LABEL
import dev.monochromatic.musicplayer.core.SearchState
import dev.monochromatic.musicplayer.searchPage
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Qualifier of the unfolded inner panel: 851 dp wide at three physical pixels per dp. */
private const val INNER_PANEL = "w851dp-h700dp-xxhdpi"

/** Width in dp of the folded cover, which a narrower box gives the page so it draws the cover arrangement. */
private const val COVER_WIDTH_DP: Int = 411

// What:     `class SearchFieldCaretWiringTest` groups the cases of the Search field's caret.
// Why:      The field was fed a bare `String`, so its caret lived in state that the other panel's header dropped; the
//           query stayed (it is kept by the host) but typing after a fold change landed before it (D126).
//
// In TS you'd write (pseudocode):
// ```ts
// describe("Search field caret", () => { /* type, rebuild the header, type again, read the text and the caret */ });
// ```
/** Renders [searchPage] over a kept query and asserts where typed text lands after a rebuild or a refocus request. */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = INNER_PANEL)
class SearchFieldCaretWiringTest {
    /** Compose test rule that hosts each case's content in an empty activity. */
    @get:Rule
    val composeTestRule = createComposeRule()

    /** Query the host keeps, written by the field and read back by the assertions. */
    private var query: String by mutableStateOf("")

    /** Whether the page is given the folded cover width; flipping it rebuilds the header, as a fold change does. */
    private var onCover: Boolean by mutableStateOf(false)

    /** Count of Search shortcut presses that the host provides to the page. */
    private var focusToken: Int by mutableIntStateOf(0)

    /** Draws the page over the kept query, with a header that a width change rebuilds. */
    @Composable
    private fun page(keptQuery: String, onQuery: (String) -> Unit) {
        MaterialTheme {
            CompositionLocalProvider(HostKeyLocalSearchFocus provides focusToken) {
                Box(modifier = if (onCover) Modifier.width(COVER_WIDTH_DP.dp) else Modifier) {
                    searchPage(
                        creaseWidthPx = null,
                        state = SearchState.EmptyQuery,
                        query = keptQuery,
                        onQueryChange = onQuery,
                        onBack = { },
                        onClear = { onQuery("") },
                        onOpenResult = { },
                        currentTrackIndex = null,
                        deck = { Box(modifier = Modifier) },
                    )
                }
            }
        }
    }

    /** Shows the page with the host-kept [query] and waits for its first frames. */
    private fun show() {
        composeTestRule.setContent { page(keptQuery = query, onQuery = { text -> query = text }) }
        composeTestRule.waitForIdle()
    }

    /** Types [text] into the field at its caret, as a keyboard does, and waits for the frames. */
    private fun type(text: String) {
        composeTestRule.onNodeWithContentDescription(SEARCH_FIELD_LABEL).performTextInput(text)
        composeTestRule.waitForIdle()
    }

    /** Selection of the field as its semantics report it, or null when it reports none. */
    private fun selection(): TextRange? =
        composeTestRule.onNodeWithContentDescription(SEARCH_FIELD_LABEL).fetchSemanticsNode().config
            .getOrNull(SemanticsProperties.TextSelectionRange)

    // What:     `@Test fun typingAfterAFoldChangeContinuesAfterTheKeptQuery()` is the reported failure.
    // Why:      "lan" typed again after a fold change gave "lanlan" with the caret at the start (D126); the rebuilt
    //           header must start the field with the caret after the kept query.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("caret after fold", () => { type("lan"); fold(); type("x"); expect(query).toBe("lanx"); });
    // ```
    /** After the header is rebuilt for the cover, the next typed character lands after "lan" and the caret follows. */
    @Test(timeout = CASE_LIMIT_MS)
    fun typingAfterAFoldChangeContinuesAfterTheKeptQuery() {
        show()
        type("lan")
        assertEquals("lan", query)
        composeTestRule.runOnIdle { onCover = true }
        composeTestRule.waitForIdle()
        assertEquals("the fold change keeps the query", "lan", query)
        assertEquals("the rebuilt field puts the caret at the end", TextRange(3), selection())
        type("x")
        assertEquals("lanx", query)
        assertEquals(TextRange(4), selection())
    }

    // What:     `@Test fun theSearchShortcutOnAnOpenPagePutsTheCaretAtTheEndAndSelectsNothing()` is the Ctrl+F case.
    // Why:      A second "lan" typed after Ctrl+F landed in front of the first; the shortcut only refocused the field.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("ctrl+f caret", () => {
    //   type("lan"); setCaret(0); pressSearchShortcut(); type("x");
    //   expect(query).toBe("lanx");
    // });
    // ```
    /** After a caret at the start and a Search shortcut, the next typed character lands after "lan" and replaces none. */
    @Test(timeout = CASE_LIMIT_MS)
    fun theSearchShortcutOnAnOpenPagePutsTheCaretAtTheEndAndSelectsNothing() {
        show()
        type("lan")
        composeTestRule.onNodeWithContentDescription(SEARCH_FIELD_LABEL).performTextInputSelection(TextRange(0))
        composeTestRule.waitForIdle()
        assertEquals(TextRange(0), selection())
        composeTestRule.runOnIdle { focusToken += 1 }
        composeTestRule.waitForIdle()
        assertEquals("the shortcut puts a caret and no selection at the end", TextRange(3), selection())
        type("x")
        assertEquals("lanx", query)
    }

    // What:     `@Test fun aCaretTheUserPlacedInTheMiddleIsKeptWhileTheQueryIsNotRebuilt()` is the control.
    // Why:      A field that put the caret at the end on every frame would pass the two cases above and break editing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("caret stays", () => { type("lan"); setCaret(1); type("x"); expect(query).toBe("lxan"); });
    // ```
    /** With the caret moved to offset 1, a typed character lands there, not at the end. */
    @Test(timeout = CASE_LIMIT_MS)
    fun aCaretTheUserPlacedInTheMiddleIsKeptWhileTheQueryIsNotRebuilt() {
        show()
        type("lan")
        composeTestRule.onNodeWithContentDescription(SEARCH_FIELD_LABEL).performTextInputSelection(TextRange(1))
        composeTestRule.waitForIdle()
        type("x")
        assertEquals("lxan", query)
        assertEquals(TextRange(2), selection())
    }

    // What:     `@Test fun clearingTheQueryThenTypingStartsAFreshQuery()` checks the reset from outside the field.
    // Why:      Clear changes the query without the field's help (D66 keeps new visits empty the same way); the field
    //           must show the empty query and take the next characters from its start.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("clear then type", () => { type("lan"); clear(); type("ab"); expect(query).toBe("ab"); });
    // ```
    /** After the host clears the query, typing "ab" gives "ab" with the caret after it. */
    @Test(timeout = CASE_LIMIT_MS)
    fun clearingTheQueryThenTypingStartsAFreshQuery() {
        show()
        type("lan")
        composeTestRule.runOnIdle { query = "" }
        composeTestRule.waitForIdle()
        type("ab")
        assertEquals("ab", query)
        assertEquals(TextRange(2), selection())
    }

    // What:     `@Test fun aRecreatedActivityKeepsTheCaretTheUserPlaced()` restores the saved field value.
    // Why:      The query survives a recreation in the host through saved state; the caret should come back with it
    //           instead of jumping to the end.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // test("recreation keeps the caret", () => {
    //   type("lan"); setCaret(1); recreate(); type("x");
    //   expect(query).toBe("lxan");
    // });
    // ```
    /** With the caret at offset 1 and the state saved and restored, the next typed character lands at offset 1. */
    @Test(timeout = CASE_LIMIT_MS)
    fun aRecreatedActivityKeepsTheCaretTheUserPlaced() {
        /** Restores saved state the way a recreated activity does. */
        val restoration = StateRestorationTester(composeTestRule)
        restoration.setContent {
            /** Query kept as the host keeps it, across recreation. */
            var saved: String by rememberSaveable { mutableStateOf("") }
            page(keptQuery = saved, onQuery = { text -> saved = text; query = text })
        }
        composeTestRule.waitForIdle()
        type("lan")
        composeTestRule.onNodeWithContentDescription(SEARCH_FIELD_LABEL).performTextInputSelection(TextRange(1))
        composeTestRule.waitForIdle()
        restoration.emulateSavedInstanceStateRestore()
        composeTestRule.waitForIdle()
        assertEquals(TextRange(1), selection())
        type("x")
        assertEquals("lxan", query)
    }
}
