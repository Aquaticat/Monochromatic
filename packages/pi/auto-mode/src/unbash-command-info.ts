/**
 * Convert `unbash` AST output into auto-mode command signals.
 *
 * @module
 */

import type { Script as UnbashScript, } from 'unbash';
import { statementWorkItems, } from './unbash-command-info-items.ts';
import { scriptHasErrors, } from './unbash-command-info-nested.ts';
import { visitNode, } from './unbash-command-info-work.ts';
import { visitRedirectsItem, } from './unbash-command-info-work-remaining.ts';
import {
  visitArithmetic,
  visitParts,
  visitTest,
  visitWord,
} from './unbash-command-info-expansion.ts';
import type {
  CommandCollection,
  WorkItem,
} from './unbash-command-info-types.ts';
import type { CommandInfo, } from './types.ts';

/**
 * Convert a parsed `unbash` script to auto-mode command info.
 *
 * @param script - parsed script from `unbash.parse`
 *
 * @param paramRefs - parameter references pre-scanned from raw command text
 *
 * @returns command collection for guardrail signal checks
 *
 * @example
 * ```typescript
 * collectCommandInfoFromScript({ script, paramRefs: ['API_KEY'] });
 * ```
 */
function collectCommandInfoFromScript(
  {
    script,
    paramRefs,
  }: {
    readonly script: UnbashScript;
    readonly paramRefs: readonly string[];
  },
): CommandCollection {
  /**
   * Parsed command records accumulated in traversal order.
   */
  const commands: CommandInfo[] = [];
  /**
   * Mutable boolean boxes used by the iterative traversal loop.
   */
  const flags = {
    isPipeline: false,
    hasParseErrors: scriptHasErrors(script,),
  };
  /**
   * LIFO work stack seeded with top-level statements.
   */
  const stack: WorkItem[] = statementWorkItems(script.commands,)
    .toReversed();

  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    /**
     * Result emitted by the current traversal item.
     */
    const result = item.kind === 'node'
      ? visitNode({
        node: item.node,
        redirects: item.redirects,
        paramRefs,
      },)
      : item.kind === 'word'
      ? visitWord(item.word,)
      : item.kind === 'parts'
      ? visitParts(item.parts,)
      : item.kind === 'arithmetic'
      ? visitArithmetic(item.expression,)
      : item.kind === 'test'
      ? visitTest(item.expression,)
      : visitRedirectsItem({
        redirects: item.redirects,
        paramRefs,
      },);
    commands.push(...result.commands,);
    flags.isPipeline ||= result.isPipeline;
    flags.hasParseErrors ||= result.hasParseErrors;
    for (let loopIndex = result.workItems
      .length
      - 1; loopIndex >= 0; loopIndex -= 1) {
      /**
       * Work item to push, guarded because `.at()` returns undefined out of range.
       */
      const workItem = result.workItems
        .at(loopIndex,);
      if (workItem !== undefined)
        stack.push(workItem,);
    }
  }

  return {
    commands,
    isPipeline: flags.isPipeline,
    hasParseErrors: flags.hasParseErrors,
  };
}

export { collectCommandInfoFromScript, };
