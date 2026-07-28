/**
 * Public immutable effect-summary lookup model.
 *
 * Everything here is keyed by parameter, deliberately, even though effects are recorded
 * against slots internally. A parameter position is the only thing that means the same on
 * both sides of a project boundary, in an overload comparison, and in a diagnostic, and a
 * branded `ParameterIndex` is what stops a slot arriving where one of those is expected.
 * `effect-public-summary.ts` performs the projection.
 *
 * The brand earns its keep here more than anywhere else. A branded number is still assignable
 * to `number`, so declaring these sets as `ReadonlySet<number>` would have let slot-keyed sets
 * through untouched and unprojected, which reads as a parameter that carries no effect.
 *
 * @module
 */

import type { ParameterIndex, } from './effect-slot-identity.ts';
import type { EffectCallableDeclaration, } from './effect-summary-model.ts';

/**
 * One callback relation as a consumer outside the analyzer sees it.
 *
 * Both positions are parameter positions of the declaring callable, projected from the slots
 * the relation was inferred against.
 */
export type PublicCallbackRelation = {
  readonly callbackParameterIndex: ParameterIndex;
  readonly callbackArgumentPosition: number;
  readonly sourceParameterIndex: ParameterIndex;
};

/**
 * Readonly effect summary exposed to rule verification.
 *
 * @example
 * ```ts
 * if (summary.mutatedParameterIndexes.has(asParameterIndex(0,),)) {
 *   // first parameter may be affected
 * }
 * ```
 */
export type CallableEffectSummary = {
  readonly mutatedParameterIndexes: ReadonlySet<ParameterIndex>;
  readonly referentMutatedParameterIndexes: ReadonlySet<ParameterIndex>;
  readonly returnedParameterIndexes: ReadonlySet<ParameterIndex>;
  readonly invokedParameterIndexes: ReadonlySet<ParameterIndex>;
  readonly opaqueParameterIndexes: ReadonlySet<ParameterIndex>;
  readonly opaqueProvenanceByParameter: ReadonlyMap<ParameterIndex, ReadonlySet<string>>;
  readonly foreignBorrowedParameterIndexes: ReadonlySet<ParameterIndex>;
  readonly callbackRelations: readonly PublicCallbackRelation[];
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
