/**
 * Attribution for a write whose target is rooted at a parameter or one of its aliases.
 *
 * Split from `direct-effect-summary.ts` for the line budget, and the split falls on a
 * seam rather than an arbitrary cut. This answers which parameter a write lands on, while
 * `effect-assignment-store.ts` answers where an assigned value went, and the two run over
 * the same assignment nodes without sharing anything else.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import { isIdentifier, } from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { expressionOrigins, } from './effect-binding-origins.ts';
import {
  addEffectSlots,
  type MutableEffectSummary,
  type SlotOrigins,
} from './effect-summary-model.ts';

/**
 * Records direct write rooted at callable parameter or alias.
 *
 * @param project - TypeScript project resolving root symbol.
 *
 * @param bindingOriginBySymbolId - Local binding origins by symbol identity.
 *
 * @param summary - Summary receiving direct mutation.
 *
 * @param node - Write target expression.
 *
 * @mutates summary - Adds direct caller-observable write target.
 *
 * @example
 * ```ts
 * inspectDirectWrite({ project, bindingOriginBySymbolId, summary, node: assignment.left });
 * ```
 */
export function inspectDirectWrite({
  project,
  bindingOriginBySymbolId,
  summary,
  node,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly summary: MutableEffectSummary;
  readonly node: Node;
},): void {
  if (isIdentifier(node,))
    return;
  addEffectSlots({
    target: summary.directMutated,
    values: expressionOrigins({
      project,
      bindingOriginBySymbolId,
      node,
    },),
  },);
}
