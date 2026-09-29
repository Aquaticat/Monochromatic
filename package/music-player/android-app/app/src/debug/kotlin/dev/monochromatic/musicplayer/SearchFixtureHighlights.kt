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

/** Stores the light-surface fraction toward white in the existing OKLCH mixer. */
private const val FIXTURE_LIGHT_WHITE_MIX: Float = 0.72f

/** Keeps some accent chroma while a light highlight approaches white. */
private const val FIXTURE_LIGHT_CHROMA_MIX: Float = 0.55f

/** Stores the dark-surface fraction toward black for readable light text. */
private const val FIXTURE_DARK_BLACK_MIX: Float = 0.62f

/** Keeps more accent chroma on black while moderating saturation. */
private const val FIXTURE_DARK_CHROMA_MIX: Float = 0.35f

/**
 * What: Derive a highlight fill from the runtime OS accent using the existing OKLCH neutral mixer.
 * Why: Search emphasis should stay in the selected theme's hue, not a tertiary purple unrelated to its accent.
 *
 * In TS you'd write (pseudocode):
 * ```ts
 * function fixtureMatchBackground(accent: Color, darkScene: boolean): Color {
 *   return mixOklchWithNeutral({ color: accent, neutralLightness: darkScene ? 0 : 1,
 *     lightnessFraction: darkScene ? 0.62 : 0.72, chromaFraction: darkScene ? 0.35 : 0.55 });
 * }
 * ```
 */
internal fun fixtureMatchBackground(accent: Color, darkScene: Boolean): Color {
    // What: `OklchNeutralMix` keeps source hue while lightness and chroma move toward neutral.
    // Why: Dynamic OS accent and selected light/dark scene determine the match fill at render time.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return mixOklchWithNeutral({ color: accent, neutralLightness: darkScene ? 0 : 1,
    //   lightnessFraction: darkScene ? 0.62 : 0.72, chromaFraction: darkScene ? 0.35 : 0.55 });
    // ```
    return mixOklchWithNeutral(
        OklchNeutralMix(
            color = accent,
            neutralLightness = if (darkScene) OKLCH_BLACK_LIGHTNESS else OKLCH_WHITE_LIGHTNESS,
            lightnessFraction = if (darkScene) FIXTURE_DARK_BLACK_MIX else FIXTURE_LIGHT_WHITE_MIX,
            chromaFraction = if (darkScene) FIXTURE_DARK_CHROMA_MIX else FIXTURE_LIGHT_CHROMA_MIX,
        ),
    )
}

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
