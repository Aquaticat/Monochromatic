/**
 * Callables a body reaches by reading a property rather than by calling anything.
 *
 * The reach walk follows calls, so it answers for a closure that calls a sibling and misses one that
 * reads an accessor. Measured, with the configuration offered:
 *
 * ```ts
 * const holder = {
 *   get row(): Row {
 *     return gottenOut.row;
 *   },
 * };
 * registry.keep((): Row => holder.row,);
 * ```
 *
 * The handed closure names `holder` and nothing else. Resolving `holder` finds no parameter origin,
 * because it is a local rather than a parameter, and the call walk finds no call, because a property
 * read is not one. So the reach walk answered empty while reading `holder.row` runs a body that
 * hands back the caller's row.
 *
 * A getter is the sharp case and the walk does not stop there. Any callable a literal declares is
 * collected, accessors and methods alike, because a property read can hand a method onward as a
 * value just as it can run a getter. Which property was read is not tracked, exactly as the
 * aggregate descent elsewhere declines to track keys: narrowing to one member would need a claim
 * this walk cannot support, and taking all of them can only add an origin.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import {
  isClassExpression,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { reachableValueSources, } from './effect-result-reach.ts';
import {
  collectAstNodes,
  isEffectCallableDeclaration,
} from './effect-summary-model.ts';

/**
 * Collects every callable a body can reach through a property read.
 *
 * @param project - TypeScript project resolving what a receiver holds.
 *
 * @param within - Body scanned for property reads.
 *
 * @param fileName - File a reached callable must share, bounding work rather than deciding an
 * answer, exactly as the call walk's bound does.
 *
 * @returns callables declared by the aggregates those reads name.
 *
 * @example
 * ```ts
 * accessedCallables({ project, within, fileName });
 * ```
 */
export function accessedCallables({
  project,
  within,
  fileName,
}: {
  readonly project: Project;
  readonly within: Node;
  readonly fileName: string;
},): readonly Node[] {
  return collectAstNodes(within,)
    .filter(function isRead(node,): boolean {
      return isPropertyAccessExpression(node,);
    },)
    .flatMap(function declaredCallables(read,): readonly Node[] {
      if (!isPropertyAccessExpression(read,))
        return [];
      return reachableValueSources({
        project,
        node: read.expression,
      },)
        .flatMap(function membersOfSource(source,): readonly Node[] {
          return aggregateCallables({ source, },);
        },);
    },)
    .filter(function sameFile(callable,): boolean {
      /**
       * File the reached callable is written in.
       */
      const { fileName: reachedFileName, } = callable.getSourceFile();
      return reachedFileName === fileName;
    },);
}

/**
 * Names every callable one authored aggregate declares.
 *
 * Only an authored literal or class expression answers. A value read out of something else is
 * reached by the layers the normalisation walk already strips, and guessing at the members of
 * anything else would claim a declaration the source never wrote.
 *
 * @param source - Expression that may be an authored aggregate.
 *
 * @returns callables it declares.
 *
 * @example
 * ```ts
 * aggregateCallables({ source });
 * ```
 */
function aggregateCallables({ source, }: { readonly source: Node; },): readonly Node[] {
  if (!(isObjectLiteralExpression(source,) || isClassExpression(source,)))
    return [];
  return collectAstNodes(source,)
    .filter(function isCallable(node,): boolean {
      return isEffectCallableDeclaration(node,);
    },);
}
