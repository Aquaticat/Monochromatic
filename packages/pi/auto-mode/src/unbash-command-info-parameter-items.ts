/**
 * Parameter-expansion work-item builders for `unbash` command-info traversal.
 *
 * @module
 */

import type { ParameterExpansionPart as UnbashParameterExpansionPart, } from 'unbash';
import {
  wordWorkItems,
  wordsWorkItems,
} from './unbash-command-info-items.ts';
import type { WorkItem, } from './unbash-command-info-types.ts';

/**
 * Build nested word items from a parameter expansion.
 *
 * @param part - parameter expansion part
 *
 * @returns word work items in source order
 *
 * @example
 * ```typescript
 * parameterWordItems(part);
 * ```
 */
function parameterWordItems(
  part: UnbashParameterExpansionPart,
): WorkItem[] {
  return [
    ...(part.operand === undefined ? [] : wordWorkItems(part.operand,)),
    ...(part.slice === undefined
      ? []
      : [
        ...wordWorkItems(part.slice
          .offset,),
        ...(part.slice
          .length
          === undefined ? [] : wordWorkItems(part.slice
            .length,)),
      ]),
    ...(part.replace === undefined
      ? []
      : [
        ...wordWorkItems(part.replace
          .pattern,),
        ...wordWorkItems(part.replace
          .replacement,),
      ]),
  ];
}

export { parameterWordItems, };
