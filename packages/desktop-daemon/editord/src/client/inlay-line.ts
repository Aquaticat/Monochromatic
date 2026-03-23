/**
 * Per-line annotation assembly for the inlay layer.
 *
 * Groups items by line number and builds combined annotation strings
 * from inlay hints and diagnostics for a single line div.
 */

import type { Diagnostic, InlayHint, } from '../protocol.ts';
import { groupByLine, } from './group-by-line.ts';
import {
  findWorstSeverity, formatDiagnosticLabel, formatHintLabel,
} from './inlay-format.ts';

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
 */
export function applyLineAnnotation({ div, lineHints, lineDiags, spaceRatio, }: {
  div: HTMLElement;
  lineHints: InlayHint[] | undefined;
  lineDiags: Diagnostic[] | undefined;
  spaceRatio: number;
}): void {
  const rows: string[] = [];

  if (lineHints !== undefined) {
    /** Without toSorted: no-array-sort lint error since sort() mutates in place. */
    const sorted = lineHints.toSorted(
      function byChar(left, right,) { return left.position.character - right.position.character; },
    );

    let rowText = '';
    /** Current position in monospace character units. */
    let cursor = 0;

    for (const hint of sorted) {
      const label = formatHintLabel({ hint, },);
      const charPos = hint.position.character;

      if (rowText === '' || charPos >= cursor) {
        /** Fits on the current row; pad from cursor to this hint's column. */
        const gap = charPos - cursor;
        rowText += ' '.repeat(Math.round(gap * spaceRatio,),) + label;
        cursor = charPos + label.length;
      }
      else {
        /** Overlaps previous hint; flush current row and start fresh. */
        rows.push(rowText,);
        const indent = ' '.repeat(Math.round(charPos * spaceRatio,),);
        rowText = indent + label;
        cursor = charPos + label.length;
      }
    }

    if (rowText !== '')
      rows.push(rowText,);
  }

  if (lineDiags !== undefined) {
    for (const diagnostic of lineDiags) {
      const indent = ' '.repeat(Math.round(diagnostic.range.start.character * spaceRatio,),);
      rows.push(`${indent}${formatDiagnosticLabel({ diagnostic, },)}`,);
    }
  }

  div.dataset.inlay = rows.join('\n',);

  if (lineDiags !== undefined && lineDiags.length > 0)
    div.dataset.inlaySeverity = findWorstSeverity({ diagnostics: lineDiags, },);
  else
    delete div.dataset.inlaySeverity;
}
