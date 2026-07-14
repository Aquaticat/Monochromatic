import type { ReadonlyDeep, } from 'type-fest';
import type { Code, } from 'mdast';

import { isFencedCode, } from '../code.ts';
import {
  diagnose,
  offsetsOf,
} from '../node-source.ts';
import type {
  Diagnostic,
  Rule,
  RuleContext,
} from '../types.ts';
import { walk, } from '../walk.ts';

/**
 * Rule id.
 */
const ID = 'MD040';

/**
 * Parameters for {@link languageInsertOffset}.
 */
type LanguageInsertOffsetParams = {
  /**
   * Code node whose opening fence needs a language label.
   */
  readonly node: Code;
  /**
   * Original source.
   */
  readonly source: string;
};

/**
 * Measure the run of opening fence marker characters.
 *
 * @param markerAndRest - opening line from the first fence marker onward
 *
 * @returns number of marker characters in the opening fence
 */
function fenceMarkerLength(markerAndRest: string,): number {
  /**
   * Fence marker character, either backtick or tilde.
   */
  const marker = markerAndRest.charAt(0,);
  for (let offset = 0; offset < markerAndRest.length; offset += 1) {
    if (markerAndRest.charAt(offset,) !== marker) {
      return offset;
    }
  }
  return markerAndRest.length;
}

/**
 * Offset immediately after the opening fence marker. The info string belongs
 * there, before any trailing whitespace on the opening line.
 *
 * @param node - code node whose opening fence needs a language label
 *
 * @param source - original source
 *
 * @returns source offset where the default language should be inserted
 */
function languageInsertOffset({
  node,
  source,
}: ReadonlyDeep<LanguageInsertOffsetParams>,): number {
  /**
   * Opening fence start offset.
   */
  const { start, } = offsetsOf(node,);
  /**
   * End offset of the opening fence line.
   */
  const lineEnd = source.indexOf(
    '\n',
    start,
  );
  /**
   * Opening fence line without its trailing newline.
   */
  const opener = source.slice(
    start,
    lineEnd === (-1)
      ? source.length
      : lineEnd,
  );
  /**
   * Number of indentation characters before the fence marker.
   */
  const indentLength = opener.length
    - opener.trimStart()
    .length;
  /**
   * Opening line from the first fence marker onward.
   */
  const markerAndRest = opener.slice(indentLength,);
  /**
   * Full marker length; CommonMark allows fences longer than three chars.
   */
  const markerLength = fenceMarkerLength(markerAndRest,);
  return start
    + indentLength
    + markerLength;
}

/**
 * Flag fenced code blocks with no language label. Indented code blocks carry no
 * language and are never flagged. The fixer inserts a conservative `text` info
 * string, matching markdownlint's common default for unknown/plain snippets.
 *
 * @param tree - mdast tree under lint
 *
 * @param source - original source, to tell fenced from indented blocks
 *
 * @returns one diagnostic per unlabeled fenced block
 */
function checkFencedCodeLanguage({
  tree,
  source,
}: RuleContext,): readonly Diagnostic[] {
  /**
   * Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  for (const { node, } of walk(tree,)) {
    if (node.type !== 'code') {
      continue;
    }
    if ((node.lang !== null) && (node.lang !== '')) {
      continue;
    }
    if (!isFencedCode({
      node,
      source,
    },)) {
      continue;
    }
    /**
     * Offset where the default language label should be inserted.
     */
    const insertAt = languageInsertOffset({
      node,
      source,
    },);
    diagnostics.push(diagnose({
      ruleId: ID,
      message: 'Fenced code block has no language label.',
      node,
      fix: {
        start: insertAt,
        end: insertAt,
        insertText: 'text',
      },
    },),);
  }
  return diagnostics;
}

/**
 * MD040 fenced-code-language: fenced code blocks must declare a language.
 * Fixable by inserting `text` for unknown/plain snippets.
 */
export const fencedCodeLanguage: Rule = {
  id: ID,
  fixable: true,
  check: checkFencedCodeLanguage,
};
