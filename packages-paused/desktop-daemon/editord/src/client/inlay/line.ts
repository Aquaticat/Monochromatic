/**
 * Per-line annotation assembly for the inlay layer.
 *
 * Groups items by line number and builds combined annotation strings
 * from inlay hints and diagnostics for a single line div.
 *
 * **Proportional-font gap pitfall:**
 * When multiple hints share a row, the gap between them cannot be computed
 * from character counts alone. The hint labels are rendered in Inter
 * (proportional) while the code below is in JetBrains Mono (monospace).
 * A label like "actual" (6 chars) occupies fewer pixels in Inter than
 * 6 monospace characters, so naively subtracting `label.length` from the
 * cursor (in mono units) under-counts the remaining pixel distance,
 * placing subsequent hints too far left. The fix is to measure the
 * accumulated row text's actual pixel width via `canvas.measureText()`
 * and derive the space count from the pixel-level gap; see
 * {@link interSpacesForGap} in `measure.ts`.
 */

import type {
  Diagnostic,
  InlayHint,
} from '../../../protocol.ts';
import {
  findWorstSeverity,
  formatDiagnosticLabel,
  formatHintLabel,
} from './format.ts';
import { groupByLine, } from './group-by-line.ts';
import { interSpacesForGap, } from './measure.ts';

export { groupByLine, };

/**
 * Builds the combined annotation string and sets attributes on a line div.
 *
 * Hints are sorted by character position and greedily packed onto rows:
 * if the next hint starts at or past the previous hint's visual end,
 * it shares the same row with Inter-space padding between them.
 * Otherwise it starts a new row. Diagnostics always get their own rows.
 *
 * `spaceRatio` compensates for the width difference between Inter spaces
 * and JetBrains Mono characters.
 *
 * @param div - line div element
 *
 * @param lineHints - inlay hints for this line, or undefined
 *
 * @param lineDiags - diagnostics for this line, or undefined
 *
 * @param spaceRatio - mono-to-inter space width ratio from {@link measureSpaceRatio}
 *
 * @example
 * ```ts
 * applyLineAnnotation({ div: lineDiv, lineHints: [{ position: { line: 0, character: 10 }, label: ": string" }], lineDiags: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } }, severity: "warning", message: "Unused", source: "oxlint" }], spaceRatio: 0.6, });
 * ```
 */
export function applyLineAnnotation({
  div,
  lineHints,
  lineDiags,
  spaceRatio,
}: {
  readonly div: HTMLElement;
  readonly lineHints: readonly InlayHint[] | undefined;
  readonly lineDiags: readonly Diagnostic[] | undefined;
  readonly spaceRatio: number;
},): void {
  /**
   * Accumulator for the inlay rows joined into the dataset attribute below.
   */
  const rows: string[] = [];

  if (lineHints !== undefined) {
    /**
     * Without toSorted: no-array-sort lint error since sort() mutates in place.
     */
    const sorted = lineHints.toSorted(
      function byChar(
        left,
        right,
      ) {
        return left.position
          .character
          - right
          .position
          .character;
      },
    );

    /**
     * Mutated as hints are appended; flushed to {@link rows} on overlap.
     */
    let rowText = '';
    /**
     * Cursor in monospace character units, used only for the overlap
     * check and as fallback when canvas measurement is unavailable.
     */
    let cursor = 0;

    for (const hint of sorted) {
      /**
       * Rendered hint string; used for both row append and cursor advance.
       */
      const label = formatHintLabel({ hint, },);
      /**
       * Column the hint anchors to; compared against {@link cursor} for overlap.
       */
      const charPos = hint.position
        .character;

      if ((rowText === '') || (charPos >= cursor)) {
        /**
         * Fits on the current row.
         * Measure the actual pixel width of the current row content
         * to compute the exact number of Inter spaces needed.
         */
        const spaces = interSpacesForGap({
          charPos,
          rowText,
          fallbackCursor: cursor,
          spaceRatio,
        },);
        rowText += ' '.repeat(spaces,)
          + label;
      }
      else {
        /**
         * Overlaps previous hint; flush current row and start fresh.
         */
        rows.push(rowText,);
        /**
         * Approximates the column offset using {@link spaceRatio} from canvas measurement.
         */
        const indent = ' '.repeat(Math.round(charPos * spaceRatio,),);
        rowText = indent + label;
      }
      cursor = charPos + label
        .length;
    }

    if (rowText !== '')
      rows.push(rowText,);
  }

  if (lineDiags !== undefined) {
    for (const diagnostic of lineDiags) {
      /**
       * Approximates the diagnostic's column using {@link spaceRatio}.
       */
      const indent = ' '.repeat(
        Math.round(diagnostic.range
          .start
          .character
          * spaceRatio,),
      );
      rows.push(`${indent}${formatDiagnosticLabel({ diagnostic, },)}`,);
    }
  }

  div.dataset
    .inlay = rows.join('\n',);

  if ((lineDiags !== undefined) && (lineDiags.length
    > 0))
    div.dataset
      .inlaySeverity = findWorstSeverity({ diagnostics: lineDiags, },);
  else
    delete div.dataset
      .inlaySeverity;
}
