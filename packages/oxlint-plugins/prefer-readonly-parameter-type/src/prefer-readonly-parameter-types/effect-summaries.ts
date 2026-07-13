/**
 * Whole-project parameter mutation summaries over TypeScript 7 semantic AST.
 *
 * @module
 */

import type { SourceFile, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import { directEffectSummary, } from './direct-effect-summary.ts';
import {
  directSummariesForSource,
  pruneDirectSummaryCache,
} from './effect-summary-cache.ts';
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
  readonly opaqueProvenanceByParameter: ReadonlyMap<number, ReadonlySet<string>>;
};

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

/**
 * Sentinel when declaration is outside indexed owned source.
 */
export const NO_EFFECT_SUMMARY: unique symbol = Symbol(
  'declaration lacks indexed CallableEffectSummary',
);

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
 * @mutates target - Adds caller indexes affected by callee effects.
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
  /**
   * Whether any caller effect index was added.
   */
  let changed = false;
  for (const calleeIndex of calleeIndexes) {
    /**
     * Caller parameters packaged into affected callee parameter.
     */
    const callerIndexes = edge.arguments[calleeIndex] ?? [];
    for (const callerIndex of callerIndexes) {
      changed = addEffectIndex({
        target,
        value: callerIndex,
      },) || changed;
    }
  }
  return changed;
}

/**
 * Adds opaque provenance facts for one caller parameter.
 *
 * @param target - Caller provenance map receiving facts.
 *
 * @param parameterIndex - Caller parameter affected by opaque boundary.
 *
 * @param provenanceFacts - Callee provenance facts to propagate.
 *
 * @returns whether target changed.
 *
 * @mutates target - Adds previously unseen provenance facts.
 */
function addOpaqueProvenance({
  target,
  parameterIndex,
  provenanceFacts,
}: {
  readonly target: Map<number, Set<string>>;
  readonly parameterIndex: number | typeof PARAMETER_INDEX_UNAVAILABLE;
  readonly provenanceFacts: ReadonlySet<string>;
},): boolean {
  if (parameterIndex === PARAMETER_INDEX_UNAVAILABLE)
    return false;
  /**
   * Existing caller provenance or new accumulator.
   */
  const callerFacts = target.get(parameterIndex,) ?? new Set<string>();
  /**
   * Size before union detects fixed-point progress.
   */
  const priorSize = callerFacts.size;
  provenanceFacts.forEach(function add(provenance,): void {
    callerFacts.add(provenance,);
  },);
  target.set(
    parameterIndex,
    callerFacts,
  );
  return callerFacts.size !== priorSize;
}

/**
 * Maps opaque provenance through one owned call edge.
 *
 * @param summary - Caller summary receiving provenance.
 *
 * @param calleeSummary - Callee summary providing opaque facts.
 *
 * @param edge - Caller-to-callee argument mapping.
 *
 * @returns whether caller provenance changed.
 *
 * @mutates summary - Adds caller opaque provenance inherited from callee.
 */
function propagateOpaqueProvenance({
  summary,
  calleeSummary,
  edge,
}: {
  readonly summary: MutableEffectSummary;
  readonly calleeSummary: MutableEffectSummary;
  readonly edge: CallEdge;
},): boolean {
  /**
   * Whether any caller provenance fact was added.
   */
  let changed = false;
  for (const calleeIndex of calleeSummary.opaque) {
    /**
     * Caller parameters packaged into opaque callee parameter.
     */
    const callerIndexes = edge.arguments[calleeIndex] ?? [];
    /**
     * Provenance facts attached to opaque callee parameter.
     */
    const provenanceFacts = calleeSummary.opaqueProvenanceByParameter
      .get(calleeIndex,)
      ?? new Set<string>();
    for (const callerIndex of callerIndexes) {
      changed = addOpaqueProvenance({
        target: summary.opaqueProvenanceByParameter,
        parameterIndex: callerIndex,
        provenanceFacts,
      },) || changed;
    }
  }
  return changed;
}

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
  /**
   * Whether any callback relation changed caller summary.
   */
  let changed = false;
  for (const relation of calleeSummary.relations) {
    /**
     * Callback declaration key passed to callback parameter.
     */
    const callbackKey = edge.callbackKeys[relation.callbackParameterIndex];
    if ((callbackKey === undefined)
      || (callbackKey === OWNED_CALLABLE_UNAVAILABLE))
      continue;
    /**
     * Summary for passed callback declaration.
     */
    const callbackSummary = summaries.get(callbackKey,);
    if (callbackSummary === undefined)
      continue;
    /**
     * Caller parameters packaged as callback source value.
     */
    const sourceCallerIndexes = edge.arguments[relation.sourceParameterIndex]
      ?? [];
    /**
     * Whether callback argument carries mutation effect.
     */
    const callbackArgumentMutated = callbackSummary.mutated
      .has(relation.callbackArgumentIndex,);
    /**
     * Whether callback argument carries opaque effect.
     */
    const callbackArgumentOpaque = callbackSummary.opaque
      .has(relation.callbackArgumentIndex,);
    for (const sourceCallerIndex of sourceCallerIndexes) {
      /**
       * Whether mutation propagation changed caller summary.
       */
      const mutationChanged = callbackArgumentMutated
        && addEffectIndex({
          target: summary.mutated,
          value: sourceCallerIndex,
        },);
      /**
       * Whether opaque propagation changed caller summary.
       */
      const opaqueChanged = callbackArgumentOpaque
        && addEffectIndex({
          target: summary.opaque,
          value: sourceCallerIndex,
        },);
      /**
       * Whether callback opaque provenance changed caller summary.
       */
      const opaqueProvenanceChanged = callbackArgumentOpaque
        && addOpaqueProvenance({
          target: summary.opaqueProvenanceByParameter,
          parameterIndex: sourceCallerIndex,
          provenanceFacts: callbackSummary.opaqueProvenanceByParameter
            .get(relation.callbackArgumentIndex,)
            ?? new Set<string>(),
        },);
      changed = mutationChanged
        || opaqueChanged
        || opaqueProvenanceChanged
        || changed;
    }
  }
  return changed;
}

/**
 * Propagates direct, transitive, recursive, and higher-order effects to fixed point.
 *
 * @param summaries - Mutable summaries keyed by declaration.
 *
 * @mutates summaries - Propagates call effects to fixed point.
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
    summaries.forEach(
      /**
       * Propagates every owned call edge from one caller summary.
       *
       * @param summary - Caller summary receiving transitive effects.
       *
       * @mutates summary - Adds callee and callback effects.
       */
      function propagateSummary(summary,): void {
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
            state.changed = propagateOpaqueProvenance({
              summary,
              calleeSummary,
              edge,
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

/**
 * Builds effect summaries for owned non-declaration source in project.
 *
 * @param project - TypeScript project snapshot to analyze.
 *
 * @param activeSourceFile - Current overlay source wrapper used by verifier.
 *
 * @returns exact declaration summary lookup.
 *
 * @example
 * ```ts
 * const effects = buildEffectSummaryIndex({ project, activeSourceFile });
 * ```
 */
export function buildEffectSummaryIndex({
  project,
  activeSourceFile,
}: {
  readonly project: Project;
  readonly activeSourceFile: SourceFile;
},): EffectSummaryIndex {
  /**
   * Mutable summaries keyed by stable declaration identity.
   */
  const summaries = new Map<string, MutableEffectSummary>();
  /**
   * Current owned source paths used to prune rename and deletion residue.
   */
  const activeFiles = new Set<string>();
  new Set([
    ...project.program
      .getSourceFileNames(),
    activeSourceFile.fileName,
  ],)
    .forEach(function gatherSource(fileName,): void {
    /**
     * Program source file matching configured file name, using active wrapper
     * shared with verifier when identities match.
     */
    const sourceFile = fileName === activeSourceFile.fileName
      ? activeSourceFile
      : project.program
        .getSourceFile(fileName,);
    if ((sourceFile === undefined) || sourceFile.isDeclarationFile)
      return;
    /**
     * Whether source is current lint target whose ownership is already proven
     * by configured-project discovery.
     */
    const isActiveSource = sourceFile.fileName === activeSourceFile.fileName;
    /**
     * Whether configured dependency source belongs to external library graph.
     */
    const isExternalLibrary = project.program
      .isSourceFileFromExternalLibrary(sourceFile,);
    if ((!isActiveSource) && isExternalLibrary)
      return;
    activeFiles.add(fileName,);
    /**
     * Callable declarations present in current decoded source wrapper.
     */
    const declarations = collectAstNodes(sourceFile,)
      .filter(function retainEffectCallable(node,): node is EffectCallableDeclaration {
        return isEffectCallableDeclaration(node,);
      },);
    /**
     * Stable callable identities required from any exact-text cache hit.
     */
    const expectedKeys = new Set(declarations
      .map(function declarationKey(declaration,): string {
        return callableKey(declaration,);
      },),);
    /**
     * Direct summaries reused when exact source text and declarations remain unchanged.
     */
    const fileSummaries = directSummariesForSource({
      projectKey: project.configFileName,
      fileName,
      sourceText: sourceFile.text,
      expectedKeys,
      create(): ReadonlyMap<string, MutableEffectSummary> {
        return new Map(declarations.map(function gatherCallable(declaration,): [
          string,
          MutableEffectSummary,
        ] {
          return [
            callableKey(declaration,),
            directEffectSummary({
              project,
              declaration,
            },),
          ];
        },),);
      },
    },);
    fileSummaries.forEach(function addSummary(
      summary,
      key,
    ): void {
      summaries.set(
        key,
        summary,
      );
    },);
  },);
  pruneDirectSummaryCache({
    projectKey: project.configFileName,
    activeFiles,
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
        opaqueProvenanceByParameter: summary.opaqueProvenanceByParameter,
      };
    },
  };
}
