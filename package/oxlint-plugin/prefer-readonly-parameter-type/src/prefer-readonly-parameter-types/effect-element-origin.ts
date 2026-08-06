/**
 * Which parameter origins a binding takes from an expression's elements.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import {
  containerElementReceiver,
  NOT_A_RECEIVER_CONTAINER,
} from './effect-container-element-origin.ts';
import { expressionValueOrigins, } from './effect-expression-provenance.ts';
import type { SlotOrigins, } from './effect-summary-model.ts';

/**
 * Resolves parameter origins a binding takes from an expression's elements.
 *
 * The spelling of an element step decides nothing about its meaning, and three of the four
 * spellings carry no element-access node at all: `const [first] = copy`, `for (const row of
 * copy)` and `[...copy]` all reach an element without writing one. Resolving those as values
 * asks the container question where the element question was meant, and for a fresh
 * container the container answer is empty, which is a write attributed to nothing.
 *
 * The union is what makes it correct for both shapes. Iterating a parameter directly, `for
 * (const row of rows)`, reaches the parameter's own elements and the value origins already
 * answer it; iterating a container built from that parameter has empty value origins and the
 * container relation answers instead. Neither case has to know which it is.
 *
 * @param project - TypeScript project resolving declarations and symbols.
 *
 * @param bindingOriginBySymbolId - Known parameter and alias origins.
 *
 * @param node - Expression whose elements a binding receives.
 *
 * @returns origins reachable through the expression's elements.
 *
 * @example
 * ```ts
 * expressionElementOrigins({ project, bindingOriginBySymbolId, node: statement.expression });
 * ```
 */
export function expressionElementOrigins({
  project,
  bindingOriginBySymbolId,
  node,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly node: Node;
},): SlotOrigins {
  /**
   * Origins the expression's own value carries.
   */
  const valueOrigins = expressionValueOrigins({
    project,
    bindingOriginBySymbolId,
    node,
  },);
  /**
   * Receiver whose elements this expression holds, when that relation is verified.
   */
  const elementReceiver = containerElementReceiver({
    project,
    checker: project.checker,
    node,
  },);
  if (elementReceiver === NOT_A_RECEIVER_CONTAINER)
    return valueOrigins;
  /**
   * Origins reached through the container's receiver.
   */
  const receiverOrigins = expressionValueOrigins({
    project,
    bindingOriginBySymbolId,
    node: elementReceiver,
  },);
  if (receiverOrigins.size === 0)
    return valueOrigins;
  return new Set([
    ...valueOrigins,
    ...receiverOrigins,
  ],);
}
