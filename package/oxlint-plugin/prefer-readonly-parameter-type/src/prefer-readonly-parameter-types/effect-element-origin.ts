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
 * Container relations the element walk composes before it stops.
 *
 * A backstop rather than the terminator: the walk ends when a step finds no verified
 * relation, and each step consumes one member call, so authored chains end far sooner.
 */
const CONTAINER_CHAIN_HOP_LIMIT = 8;

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
   * Origins found so far, starting from what the expression's own value carries.
   */
  const origins = new Set(valueOrigins,);
  /**
   * Cursor descending one container relation at a time toward a named receiver.
   *
   * A loop rather than one resolution, because container members compose and the corpus
   * composes them. `panes.filter(rootLike,).toSorted(bySpawnOrder,)` in
   * `package/desktop-app/file-manager-electron/src/strip.ts` is the shape: the outer
   * member's receiver is the inner call, whose own value origins are empty because the
   * array it returns is fresh. Resolving once answered `rows.slice(0,)` and answered
   * nothing at all for `rows.slice(0,).toReversed()`, so a chain of relations each of
   * which holds reported no origin between them.
   *
   * Bounded rather than recursive, per `ITR`, and the bound is a backstop: each step
   * consumes one syntactic member call, so a chain in real source ends long before it.
   */
  const walk = {
    current: node,
    hops: 0,
  };
  while (walk.hops < CONTAINER_CHAIN_HOP_LIMIT) {
    /**
     * Receiver whose elements the cursor's value holds, when that relation is verified.
     */
    const elementReceiver = containerElementReceiver({
      project,
      checker: project.checker,
      node: walk.current,
    },);
    if (elementReceiver === NOT_A_RECEIVER_CONTAINER)
      break;
    for (
      const slot of expressionValueOrigins({
        project,
        bindingOriginBySymbolId,
        node: elementReceiver,
      },)
    )
      origins.add(slot,);
    walk.current = elementReceiver;
    walk.hops += 1;
  }
  return origins;
}
