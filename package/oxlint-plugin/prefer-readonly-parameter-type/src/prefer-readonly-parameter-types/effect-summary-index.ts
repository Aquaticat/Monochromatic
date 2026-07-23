/**
 * Public immutable effect-summary lookup model.
 *
 * @module
 */

import type {
  CallbackRelation,
  EffectCallableDeclaration,
} from './effect-summary-model.ts';

/**
 * Readonly effect summary exposed to rule verification.
 *
 * @example
 * ```ts
 * if (summary.mutatedParameterIndexes.has(0)) {
 *   // first parameter may be affected
 * }
 * ```
 */
export type CallableEffectSummary = {
  readonly mutatedParameterIndexes: ReadonlySet<number>;
  readonly referentMutatedParameterIndexes: ReadonlySet<number>;
  readonly invokedParameterIndexes: ReadonlySet<number>;
  readonly opaqueParameterIndexes: ReadonlySet<number>;
  readonly opaqueProvenanceByParameter: ReadonlyMap<number, ReadonlySet<string>>;
  readonly foreignBorrowedParameterIndexes: ReadonlySet<number>;
  readonly callbackRelations: readonly CallbackRelation[];
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
