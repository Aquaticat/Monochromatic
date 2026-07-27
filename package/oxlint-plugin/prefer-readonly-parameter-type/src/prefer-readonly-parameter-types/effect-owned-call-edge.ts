/**
 * Owned call-edge construction for effect propagation.
 *
 * @module
 */

import type { CallExpression, } from 'typescript/unstable/ast';
import { isIdentifier, } from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { expressionContainsForeignBorrowed, } from './foreign-borrowed-classifier.ts';
import {
  callableKey,
  type EffectCallableDeclaration,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
  type ParameterOrigins,
} from './effect-summary-model.ts';
import {
  ALL_PACKAGED_PROPERTIES,
  callableDeclaration,
  parameterIndexes,
} from './effect-call-resolution.ts';
import {
  MUTATION_CONTRACT_UNAVAILABLE,
  mutationContractsForDeclaration,
} from './mutation-contract-query.ts';

/**
 * Adds one owned call edge with caller-relative parameter roots.
 *
 * @param project - TypeScript project resolving callbacks and provenance.
 *
 * @param bindingOriginBySymbolId - Current callable binding origins.
 *
 * @param call - Owned call expression.
 *
 * @param callee - Exact owned callable declaration.
 *
 * @param allArgumentIndexes - Caller roots packaged by each argument.
 *
 * @param summary - Caller summary receiving edge.
 *
 * @param foreignInbound - Whether call belongs directly to caller summary.
 *
 * @param analysisRoot - Optional external implementation root.
 *
 * @mutates summary - Appends exact owned call edge.
 *
 * @example
 * ```ts
 * addOwnedCallEdge({ project, bindingOriginBySymbolId, call, callee, allArgumentIndexes, summary, foreignInbound });
 * ```
 */
export function addOwnedCallEdge({
  project,
  bindingOriginBySymbolId,
  call,
  callee,
  allArgumentIndexes,
  summary,
  foreignInbound,
  analysisRoot,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, ParameterOrigins>;
  readonly call: CallExpression;
  readonly callee: EffectCallableDeclaration;
  readonly allArgumentIndexes: readonly (readonly number[])[];
  readonly summary: MutableEffectSummary;
  readonly foreignInbound: boolean;
  readonly analysisRoot?: string;
}): void {
  /**
   * Authored contracts identifying destructured callee targets.
   */
  const contracts = mutationContractsForDeclaration({
    declaration: callee,
    sourceFile: callee.getSourceFile(),
  },);
  /**
   * Object property names that callee declares as mutable.
   */
  const mutatedPropertyNames = contracts === MUTATION_CONTRACT_UNAVAILABLE
    ? ALL_PACKAGED_PROPERTIES
    : new Set(contracts.blocks
      .map(function mutationTarget(block,): string {
        return block.parameterName;
      },),);
  /**
   * Caller origins narrowed to declared destructured mutation targets.
   */
  const argumentIndexes = call.arguments
    .map(function ownedArgumentIndex(
      argument,
      argumentIndex,
    ): readonly number[] {
      /**
       * Callee parameter receiving current argument.
       */
      const parameter = callee.parameters[argumentIndex];
      return parameterIndexes({
        project,
        bindingOriginBySymbolId,
        node: argument,
        includedPropertyNames: (parameter !== undefined)
          && isIdentifier(parameter.name,)
          ? ALL_PACKAGED_PROPERTIES
          : mutatedPropertyNames,
      },);
    },);
  /**
   * Owned callback declarations paired with argument positions.
   */
  const callbacks = call.arguments
    .map(function callbackDeclaration(argument,) {
      return callableDeclaration({
        project,
        node: argument,
        ...(analysisRoot === undefined) ? {} : { analysisRoot, },
      },);
    },);
  summary.calls
    .push({
    calleeKey: callableKey(callee,),
    calleeFileName: callee.getSourceFile()
      .fileName,
    arguments: argumentIndexes,
    foreignArguments: allArgumentIndexes,
    directForeignArguments: call.arguments
      .map(function foreignArgument(argument,): boolean {
        return expressionContainsForeignBorrowed({
          project,
          node: argument,
        },);
      },),
    foreignInbound,
    callbackKeys: callbacks
      .map(function callbackKey(candidate,) {
        return candidate === OWNED_CALLABLE_UNAVAILABLE
          ? OWNED_CALLABLE_UNAVAILABLE
          : callableKey(candidate,);
      },),
    callbackFileNames: callbacks
      .map(function callbackFileName(candidate,) {
        return candidate === OWNED_CALLABLE_UNAVAILABLE
          ? OWNED_CALLABLE_UNAVAILABLE
          : candidate.getSourceFile()
            .fileName;
      },),
  },);
}
