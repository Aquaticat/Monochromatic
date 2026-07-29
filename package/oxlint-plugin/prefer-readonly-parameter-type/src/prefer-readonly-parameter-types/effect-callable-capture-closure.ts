/**
 * Caller origins a callable can reach, including through calls to callables beside it.
 *
 * `packagedCallableOrigins` is lexical: it names every binding the packaged body mentions and
 * follows no call out of it. That answers the question for a closure that reads what it
 * captured directly, and misses one that reaches caller state only by calling a sibling:
 *
 * ```ts
 * const read = (): Row => config.row;
 * holder.produce = (): Row => read();
 * ```
 *
 * The stored arrow names only `read`, and a local bound to a function expression carries no
 * parameter origin, so the lexical scan came back empty and the parameter was offered.
 * Falsified: the annotation applied, type-checked clean beside a control whose direct write was
 * rejected, and the driver changed the caller's row through the stored closure.
 *
 * Same cause as the over-reporting in the other direction, pointing the other way. A lexical
 * scanner is answering a call-graph question, so it is wrong twice: it names bindings a
 * read-only body merely mentions, and it misses captures that leave through a call.
 *
 * The bound is the source file, and that is a soundness condition rather than a budget. A
 * declaration can only capture the bindings of the callable being summarised if it is written
 * inside it, so it is necessarily in the same file. A cross-file callee names symbols absent
 * from this callable's origin map and would contribute nothing even if followed, so refusing to
 * follow it loses no attribution and stops the walk from crossing the workspace.
 *
 * @module
 */

import type {
  CallExpression,
  Node,
} from 'typescript/unstable/ast';
import { isCallExpression, } from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { callableDeclaration, } from './effect-call-resolution.ts';
import { packagedCallableOrigins, } from './effect-packaged-callable-origins.ts';
import type { EffectSlot, } from './effect-slot-identity.ts';
import {
  collectAstNodes,
  OWNED_CALLABLE_UNAVAILABLE,
  type SlotOrigins,
} from './effect-summary-model.ts';

/**
 * Builds a stable identity for any node, callable declaration or not.
 *
 * `callableKey` is the usual identity here and it accepts only a callable declaration, while a
 * packaged callable can also arrive as an accessor, a method or a class expression. The source
 * span answers for all of them and is the same idiom `activateEscapedCallables` uses for its
 * own cycle detection.
 *
 * @param node - Node being identified.
 *
 * @returns identity stable across one analysis.
 *
 * @example
 * ```ts
 * nodeKey({ node });
 * ```
 */
function nodeKey({ node, }: { readonly node: Node; },): string {
  return `${node.getSourceFile()
    .fileName}:${String(node.pos,)}:${String(node.end,)}`;
}

/**
 * Collects caller origins a callable reaches directly and through same-file callees.
 *
 * @param project - TypeScript project resolving call targets and binding symbols.
 *
 * @param bindingOriginBySymbolId - Origins of the callable being summarised.
 *
 * @param packaged - Callable whose reach is being computed.
 *
 * @returns parameter slots reachable through that callable and everything it calls nearby.
 *
 * @example
 * ```ts
 * transitiveCallableOrigins({ project, bindingOriginBySymbolId, packaged });
 * ```
 */
export function transitiveCallableOrigins({
  project,
  bindingOriginBySymbolId,
  packaged,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly packaged: Node;
},): ReadonlySet<EffectSlot> {
  /**
   * File every followed callee must share, since only a callable written inside the one being
   * summarised can capture its bindings.
   */
  const { fileName, } = packaged.getSourceFile();
  /**
   * Origins reachable through the callable and everything it calls nearby.
   */
  const origins = new Set<EffectSlot>();
  /**
   * Callables already folded in, keyed so a recursive or mutually recursive pair terminates.
   */
  const visited = new Set<string>([nodeKey({ node: packaged, },),],);
  /**
   * Callables still to fold in.
   */
  const pending: Node[] = [packaged,];
  while (pending.length > 0) {
    /**
     * Next callable whose reach is being folded in.
     */
    const current = pending.pop();
    if (current === undefined)
      continue;
    packagedCallableOrigins({
      project,
      bindingOriginBySymbolId,
      packaged: current,
    },)
      .forEach(function collectOrigin(origin,): void {
        origins.add(origin,);
      },);
    calledCallables({
      project,
      within: current,
      fileName,
    },)
      .forEach(function enqueueCallee(callee,): void {
        /**
         * Stable key for the callee, so each is folded in once.
         */
        const key = nodeKey({ node: callee, },);
        if (visited.has(key,))
          return;
        visited.add(key,);
        pending.push(callee,);
      },);
  }
  return origins;
}

/**
 * Resolves every call inside one callable to a same-file callable declaration.
 *
 * The callee expression is resolved rather than the call, because `callableDeclaration` answers
 * what a value is and the value here is whatever sits before the parentheses. That is what
 * follows `read()` to the arrow `read` was bound to.
 *
 * @param project - TypeScript project resolving call targets.
 *
 * @param within - Callable whose body is scanned for calls.
 *
 * @param fileName - File a callee must share to be followed.
 *
 * @returns callable declarations this body calls in the same file.
 *
 * @example
 * ```ts
 * calledCallables({ project, within, fileName });
 * ```
 */
function calledCallables({
  project,
  within,
  fileName,
}: {
  readonly project: Project;
  readonly within: Node;
  readonly fileName: string;
},): readonly Node[] {
  return collectAstNodes(within,)
    .filter(function isCall(node,): node is CallExpression {
      return isCallExpression(node,);
    },)
    .flatMap(function resolveCallee(call,): readonly Node[] {
      /**
       * Callable the callee expression resolves to, absent when nothing owned answers.
       */
      const callee = callableDeclaration({
        project,
        node: call.expression,
      },);
      if (callee === OWNED_CALLABLE_UNAVAILABLE)
        return [];
      /**
       * File the resolved callee is written in.
       */
      const { fileName: calleeFileName, } = callee.getSourceFile();
      if (calleeFileName !== fileName)
        return [];
      return [callee,];
    },);
}
