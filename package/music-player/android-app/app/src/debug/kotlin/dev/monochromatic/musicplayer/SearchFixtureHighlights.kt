// What: Keep literal match painting in the debug Search result study, not the production player.
// Why: The user can review highlighted occurrences without adopting a search algorithm or result action.
package dev.monochromatic.musicplayer

// What: `Color` holds the foreground and background colors for one painted match span.
// Why: The caller's current light or dark Material scheme supplies both colors.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Color } from './ui-colors';
// ```
import androidx.compose.ui.graphics.Color

// What: `AnnotatedString` is text with optional styled ranges; a plain `String` has no range styles.
// Why: The result must preserve the original text while painting each visible match in place.
//
// In TS you'd write (pseudocode):
// ```ts
// type AnnotatedString = { text: string; spans: readonly StyledRange[] };
// ```
import androidx.compose.ui.text.AnnotatedString

// What: `SpanStyle` describes color, background and weight for a specific substring.
// Why: A match needs more than a global text style while other characters stay unchanged.
//
// In TS you'd write (pseudocode):
// ```ts
// type SpanStyle = { color: Color; background: Color; fontWeight: 'bold' };
// ```
import androidx.compose.ui.text.SpanStyle

// What: `buildAnnotatedString` constructs styled text from appended characters and ranges.
// Why: We can paint every literal `cam` occurrence without splitting a result into separate Text nodes.
//
// In TS you'd write (pseudocode):
// ```ts
// const result = { text, spans: [] as StyledRange[] };
// ```
import androidx.compose.ui.text.buildAnnotatedString

// What: `FontWeight` supplies a bold weight as a second visual cue alongside the background.
// Why: Match salience should not depend on color alone.
//
// In TS you'd write (pseudocode):
// ```ts
// const weight = 'bold' as const;
// ```
import androidx.compose.ui.text.font.FontWeight

/**
 * What: Keep original fixture lettering while highlighting every non-overlapping literal query occurrence.
 * Why: Search membership and ordering remain undecided, but every visible title and parent detail needs an honest `cam` cue.
 * Gotcha: Kotlin's case-insensitive `indexOf` here is only a bounded visual fixture rule, not a Unicode search contract.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function highlightFixtureMatches(text: string, query: string, foreground: Color, background: Color): AnnotatedString {
 *   const spans: StyledRange[] = [];
 *   for (let from = 0, at = text.toLowerCase().indexOf(query.toLowerCase(), from);
 *        at >= 0; from = at + query.length, at = text.toLowerCase().indexOf(query.toLowerCase(), from)) {
 *     spans.push({ start: at, end: at + query.length, color: foreground, background, fontWeight: 'bold' });
 *   }
 *   return { text, spans };
 * }
 * ```
 */
internal fun highlightFixtureMatches(text: String, query: String, foreground: Color,
    background: Color): AnnotatedString {
    // What: `buildAnnotatedString` appends the unchanged text before assigning matching ranges.
    // Why: UI Automator still sees the original title and parent detail for comparison.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result = { text, spans: [] as StyledRange[] };
    // ```
    return buildAnnotatedString {
        append(text)
        if (query.isNotEmpty()) {
            // What: `indexOf(ignoreCase = true)` finds the next simple case-insensitive literal occurrence.
            // Why: The fixture query `cam` must paint `Cam` in every relevant title and detail.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // let index = text.toLowerCase().indexOf(query.toLowerCase());
            // ```
            var index = text.indexOf(query, ignoreCase = true)
            while (index >= 0) {
                // What: `SpanStyle` paints just the matching character range with background and bold text.
                // Why: Adjacent title and context characters should keep their baseline style.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // result.spans.push({ start: index, end: index + query.length, color: foreground, background, fontWeight: 'bold' });
                // ```
                addStyle(SpanStyle(color = foreground, background = background,
                    fontWeight = FontWeight.Bold), index, index + query.length)
                // Continue after this occurrence so repeated matches are painted once each.
                index = text.indexOf(query, startIndex = index + query.length, ignoreCase = true)
            }
        }
    }
}
