/**
 * Whole-project parameter mutation summaries over TypeScript 7 semantic AST.
 *
 * @module
 */

import type { Project, } from 'typescript/unstable/sync';

import { directEffectSummary, } from './direct-effect-summary.ts';
import {
  addEffectIndex,
  callableKey,
  type CallEdge,
  collectAstNodes,
  type EffectCallableDeclaration,
  isEffectCallableDeclaration,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';

/**
 * Readonly effect summary exposed to rule verification.
 *
 * @example
 * ```ts
 * if (summary.mutatedParameterIndexes.has(0)) {
 *   // first parameter may be mutated
 * }
 * ```
 */
export type CallableEffectSummary = {
  readonly mutatedParameterIndexes: ReadonlySet<number>;
  readonly opaqueParameterIndexes: ReadonlySet<number>;
};

/* oxlint-disable typescript/prefer-readonly-parameter-types -- FunctionLikeDeclaration mirrors TypeScript semantic identity required for exact lookup. */
/**
 * Whole-project effect lookup tied to one TypeScript snapshot project.
 */
export type EffectSummaryIndex = {
  /**
   * Looks up summary for exact callable declaration node.
   */
  readonly get: (
    declaration: EffectCallableDeclaration,
  ) => CallableEffectSummary | typeof NO_EFFECT_SUMMARY;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/**
 * Sentinel when declaration is outside indexed owned source.
 */
export const NO_EFFECT_SUMMARY: unique symbol = Symbol(
  'declaration lacks indexed CallableEffectSummary',
);

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Mutable effect set is intentional fixed-point accumulator. */
/**
 * Maps callee parameter effects through one call edge.
 *
 * @param target - Caller effect set receiving propagated index.
 *
 * @param edge - Call edge with caller argument roots.
 *
 * @param calleeIndexes - Callee parameter indexes carrying effect.
 *
 * @returns whether target changed.
 *
 * @mutates target - Adds caller parameter indexes carrying callee effects.
 */
function propagateCalleeIndexes({
  target,
  edge,
  calleeIndexes,
}: {
  readonly target: Set<number>;
  readonly edge: CallEdge;
  readonly calleeIndexes: ReadonlySet<number>;
},): boolean {
  return [...calleeIndexes,].reduce(
    function propagate(
    changed,
    calleeIndex,
  ): boolean {
    /**
     * Caller parameter passed to affected callee parameter.
     */
    const callerIndex = edge.arguments[calleeIndex];
    return addEffectIndex({
      target,
      value: callerIndex ?? PARAMETER_INDEX_UNAVAILABLE,
    },) || changed;
  },
    false,
  );
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Mutable summary is intentional fixed-point accumulator. */
/**
 * Propagates callback relation through one owned call edge.
 *
 * @param summaries - All owned callable summaries.
 *
 * @param summary - Caller summary receiving propagated effect.
 *
 * @param calleeSummary - Callee summary defining callback relation.
 *
 * @param edge - Caller-to-callee argument edge.
 *
 * @returns whether caller summary changed.
 *
 * @mutates summary - Adds effects propagated through callback relation.
 */
function propagateCallbackRelations({
  summaries,
  summary,
  calleeSummary,
  edge,
}: {
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
  readonly summary: MutableEffectSummary;
  readonly calleeSummary: MutableEffectSummary;
  readonly edge: CallEdge;
},): boolean {
  return calleeSummary.relations
    .reduce(
      function propagateRelation(
    changed,
    relation,
  ): boolean {
    /**
     * Callback declaration key passed to callback parameter.
     */
    const callbackKey = edge.callbackKeys[relation.callbackParameterIndex];
    if ((callbackKey === undefined)
      || (callbackKey === OWNED_CALLABLE_UNAVAILABLE))
      return changed;
    /**
     * Summary for passed callback declaration.
     */
    const callbackSummary = summaries.get(callbackKey,);
    if (callbackSummary === undefined)
      return changed;
    /**
     * Caller parameter passed as callback source value.
     */
    const sourceCallerIndex = edge.arguments[relation.sourceParameterIndex]
      ?? PARAMETER_INDEX_UNAVAILABLE;
    /**
     * Whether mutation propagation changed caller summary.
     */
    const mutationChanged = callbackSummary.mutated
      .has(relation.callbackArgumentIndex,)
      && addEffectIndex({
        target: summary.mutated,
        value: sourceCallerIndex,
      },);
    /**
     * Whether opaque propagation changed caller summary.
     */
    const opaqueChanged = callbackSummary.opaque
      .has(relation.callbackArgumentIndex,)
      && addEffectIndex({
        target: summary.opaque,
        value: sourceCallerIndex,
      },);
    return changed || mutationChanged
      || opaqueChanged;
  },
      false,
    );
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/**
 * Propagates direct, transitive, recursive, and higher-order effects to fixed point.
 *
 * @param summaries - Mutable summaries keyed by declaration.
 */
function propagateEffects(
  summaries: ReadonlyMap<string, MutableEffectSummary>,
): void {
  /**
   * Total effect bits that can change before fixed point.
   */
  const effectBitCount = [...summaries.values(),].reduce(
    function total(
    totalCount,
    summary,
  ): number {
    return totalCount + (summary.parameterCount * 2);
  },
    0,
  );
  /**
   * Mutable convergence state shared across each propagation pass.
   */
  const state = {
    changed: true,
    pass: 0,
  };
  while (state.changed && (state.pass <= effectBitCount)) {
    state.changed = false;
    state.pass++;
    summaries.forEach(function propagateSummary(summary,): void {
      summary.calls
        .forEach(function propagateCall(edge,): void {
        /**
         * Summary for owned callee edge.
         */
        const calleeSummary = summaries.get(edge.calleeKey,);
        if (calleeSummary === undefined)
          return;
        state.changed = propagateCalleeIndexes({
          target: summary.mutated,
          edge,
          calleeIndexes: calleeSummary.mutated,
        },) || state.changed;
        state.changed = propagateCalleeIndexes({
          target: summary.opaque,
          edge,
          calleeIndexes: calleeSummary.opaque,
        },) || state.changed;
        state.changed = propagateCallbackRelations({
          summaries,
          summary,
          calleeSummary,
          edge,
        },) || state.changed;
      },);
    },);
  }
}

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Project and declarations mirror TypeScript semantic identities required for project-wide summaries. */
/**
 * Builds effect summaries for owned non-declaration source in project.
 *
 * @param project - TypeScript project snapshot to analyze.
 *
 * @returns exact declaration summary lookup.
 *
 * @example
 * ```ts
 * const effects = buildEffectSummaryIndex({ project });
 * ```
 */
export function buildEffectSummaryIndex({
  project,
}: {
  readonly project: Project;
},): EffectSummaryIndex {
  /**
   * Mutable summaries keyed by stable declaration identity.
   */
  const summaries = new Map<string, MutableEffectSummary>();
  project.program
    .getSourceFileNames()
    .forEach(function gatherSource(fileName,): void {
    /**
     * Program source file matching configured file name.
     */
    const sourceFile = project.program
      .getSourceFile(fileName,);
    if ((sourceFile === undefined)
      || sourceFile.isDeclarationFile
      || project.program
      .isSourceFileFromExternalLibrary(sourceFile,))
      return;
    collectAstNodes(sourceFile,)
      .forEach(function gatherCallable(node,): void {
      if (isEffectCallableDeclaration(node,)) {
        summaries.set(
          callableKey(node,),
          directEffectSummary({
            project,
            declaration: node,
          },),
        );
      }
    },);
  },);
  propagateEffects(summaries,);
  return {
    get(declaration,): CallableEffectSummary | typeof NO_EFFECT_SUMMARY {
      /**
       * Internal summary matching declaration identity.
       */
      const summary = summaries.get(callableKey(declaration,),);
      if (summary === undefined)
        return NO_EFFECT_SUMMARY;
      return {
        mutatedParameterIndexes: summary.mutated,
        opaqueParameterIndexes: summary.opaque,
      };
    },
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
