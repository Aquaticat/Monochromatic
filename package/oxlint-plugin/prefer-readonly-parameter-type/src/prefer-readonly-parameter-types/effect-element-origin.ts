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
import {
  expressionValueOrigins,
  selectedOperandSuccessors,
} from './effect-expression-provenance.ts';
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
   * Origins found so far, starting from what the expression's own value carries.
   */
  const origins = new Set(expressionValueOrigins({
    project,
    bindingOriginBySymbolId,
    node,
  },),);
  /**
   * Expressions already queued, so a declaration hop cannot revisit its own subject.
   *
   * A visited set rather than a hop count, and the distinction is a soundness one rather
   * than a tidiness one. `containerElementReceiver` follows an identifier to its
   * declaration initializer, which is not a descendant of the node it started from, so
   * this walk leaves its own subtree and the descendant argument that bounds
   * `expressionValueOrigins` does not hold here. What does hold is that a file has
   * finitely many nodes and no node is examined twice.
   *
   * The count it replaces truncated silently, and truncation is the unsafe direction for
   * this rule rather than a neutral one. Every consumer of the returned set only ever adds
   * a charge, so a withheld origin is a withheld charge and a withheld charge is an offer.
   * Measured 2026-08-07: eight composed `slice` calls recorded the parameter and nine
   * recorded nothing, and at twelve the parameter came back with no opacity at all, which
   * is the state a read-only offer is minted from. Nine composed calls do not appear in the
   * corpus, so this cleared nothing; it removes a way to be wrong rather than a report.
   */
  const visited = new Set<Node>([node,],);
  /**
   * Expressions still to examine for a container relation.
   */
  const pending: Node[] = [node,];
  while (pending.length > 0) {
    /**
     * Next expression whose container relation is examined.
     */
    const current = pending.pop();
    if (current === undefined)
      continue;
    /* Selection has to be traversed before the relation is asked for, because a selector
     * carries no relation of its own and the value inside it does. `return (rows.slice(0,));`
     * and `return cond ? rows.slice(0,) : [];` recorded nothing while `return (rows);` and
     * `return cond ? rows : [];` recorded correctly, because value provenance already saw
     * through these forms and the container relation did not. Sharing one definition of the
     * family with `expressionValueOrigins` is what keeps the two walks from disagreeing.
     *
     * Their own origins are not collected here on purpose: `expressionValueOrigins` descends
     * through the same family internally, so the root call above already carries them, and
     * asking again would only repeat the work. */
    for (const successor of selectedOperandSuccessors({ node: current, },))
      if (!visited.has(successor,)) {
        visited.add(successor,);
        pending.push(successor,);
      }
    /**
     * Receiver whose elements the current value holds, when that relation is verified.
     *
     * Queued as well as collected, because container members compose and the corpus
     * composes them. `panes.filter(rootLike,).toSorted(bySpawnOrder,)` in
     * `package/desktop-app/file-manager-electron/src/strip.ts` is the shape: the outer
     * member's receiver is the inner call, whose own value origins are empty because the
     * array it returns is fresh.
     */
    const elementReceiver = containerElementReceiver({
      project,
      checker: project.checker,
      node: current,
    },);
    if ((elementReceiver === NOT_A_RECEIVER_CONTAINER)
      || visited.has(elementReceiver,))
      continue;
    visited.add(elementReceiver,);
    for (
      const slot of expressionValueOrigins({
        project,
        bindingOriginBySymbolId,
        node: elementReceiver,
      },)
    )
      origins.add(slot,);
    pending.push(elementReceiver,);
  }
  return origins;
}
