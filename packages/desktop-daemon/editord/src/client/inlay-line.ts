/**
 * Per-line annotation assembly for the inlay layer.
 *
 * Groups items by line number and builds combined annotation strings
 * from inlay hints and diagnostics for a single line div.
 */

import type { Diagnostic, InlayHint, } from '../protocol.ts';
import {
  findWorstSeverity, formatDiagnosticLabel, formatHintLabel,
} from './inlay-format.ts';

/**
 * Groups items by a numeric key extracted from each item.
 *
 * @param items - items to group
 *
 * @param keyFn - extracts grouping key from each item
 *
 * @returns map from key to grouped items
 */
export function groupByLine<T>({ items, keyFn, }: {
  items: T[];
  keyFn: (item: T,) => number;
}): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const key = keyFn(item,);
    let group = groups.get(key,);
    if (group === undefined) {
      group = [];
      groups.set(key, group,);
    }
    group.push(item,);
  }
  return groups;
}

/**
 * Builds the combined annotation string and sets attributes on a line div.
 *
 * Each hint and diagnostic occupies its own `\n`-delimited row within the
 * `::before` content. Leading Inter spaces indent each row to its character
 * column; `spaceRatio` compensates for the width difference between
 * Inter spaces and JetBrains Mono characters.
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
    for (const hint of lineHints) {
      const indent = ' '.repeat(Math.round(hint.position.character * spaceRatio,),);
      rows.push(`${indent}${formatHintLabel({ hint, },)}`,);
    }
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
