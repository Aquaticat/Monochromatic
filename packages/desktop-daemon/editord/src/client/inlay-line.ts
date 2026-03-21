/**
 * Per-line annotation assembly for the inlay layer.
 *
 * Groups items by line number and builds combined annotation strings
 * from inlay hints and diagnostics for a single line div.
 */

import type { Diagnostic, InlayHint, } from '../protocol.ts';
import {
  DIAGNOSTIC_SEPARATOR, findWorstSeverity, formatDiagnosticLabel,
  formatHintLabel, HINT_SEPARATOR, SECTION_SEPARATOR,
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
 * @param div - line div element
 *
 * @param lineHints - inlay hints for this line, or undefined
 *
 * @param lineDiags - diagnostics for this line, or undefined
 */
export function applyLineAnnotation({ div, lineHints, lineDiags, }: {
  div: HTMLElement;
  lineHints: InlayHint[] | undefined;
  lineDiags: Diagnostic[] | undefined;
}): void {
  const hintPart = lineHints !== undefined
    ? lineHints.map(function fmtHint(hint,) { return formatHintLabel({ hint, },); },).join(HINT_SEPARATOR,)
    : '';
  const diagPart = lineDiags !== undefined
    ? lineDiags.map(function fmtDiag(diagnostic,) { return formatDiagnosticLabel({ diagnostic, },); },).join(DIAGNOSTIC_SEPARATOR,)
    : '';

  div.dataset.inlay = hintPart !== '' && diagPart !== ''
    ? hintPart + SECTION_SEPARATOR + diagPart
    : (hintPart !== '' ? hintPart : diagPart);

  /** Set CSS custom property for column-aligned indentation via margin. */
  const indentCh = lineHints !== undefined && lineHints.length > 0
    ? lineHints[0]?.position.character ?? 0
    : 0;
  if (indentCh > 0) {
    div.style.setProperty('--inlay-indent', `${String(indentCh,)}ch`,);
  }
  else {
    div.style.removeProperty('--inlay-indent',);
  }

  if (lineDiags !== undefined && lineDiags.length > 0)
    div.dataset.inlaySeverity = findWorstSeverity({ diagnostics: lineDiags, },);
  else
    delete div.dataset.inlaySeverity;
}
