package dev.monochromatic.musicplayer

import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

// What:     `class SearchFieldValueTest` checks the rule that decides which value the Search field shows.
// Why:      The host keeps the query across a fold change while the field's own state is dropped, so a rebuilt field is
//           fed the kept query and must put its caret at the end (D126); a value that still holds the query must keep
//           the caret the person placed.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("searchFieldValue", () => { /* keep the value that holds the query, else caret at the end */ });
// ```
/** Pure cases of [searchFieldValue]; the rendered cases are in the wiring package. */
class SearchFieldValueTest {
    /** A value that already holds the query is returned as it is, with the caret where the person put it. */
    @Test
    fun aValueThatHoldsTheQueryKeepsItsCaret() {
        /** Value with the caret after the first character. */
        val kept = TextFieldValue(text = "lan", selection = TextRange(1))
        assertSame(kept, searchFieldValue(current = kept, query = "lan"))
    }

    /** With no value, the query is shown with the caret after its last character and nothing selected. */
    @Test
    fun noValueGivesTheQueryWithTheCaretAtTheEnd() {
        /** Value built for a rebuilt field. */
        val built: TextFieldValue = searchFieldValue(current = null, query = "lan")
        assertEquals("lan", built.text)
        assertEquals(TextRange(3), built.selection)
    }

    /** A value for another text is replaced by the query with the caret at its end. */
    @Test
    fun aValueForAnotherTextIsReplacedByTheQueryWithTheCaretAtTheEnd() {
        /** Value left over from before the query was cleared and typed again. */
        val stale = TextFieldValue(text = "old", selection = TextRange(0))
        /** Value built for the new query. */
        val built: TextFieldValue = searchFieldValue(current = stale, query = "new query")
        assertEquals("new query", built.text)
        assertEquals(TextRange(9), built.selection)
    }

    /** The empty query gives an empty value with the caret at zero. */
    @Test
    fun theEmptyQueryGivesAnEmptyValue() {
        assertEquals(TextFieldValue(text = "", selection = TextRange(0)), searchFieldValue(current = null, query = ""))
    }
}
