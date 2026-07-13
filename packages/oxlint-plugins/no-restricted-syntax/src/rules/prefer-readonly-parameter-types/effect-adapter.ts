/**
 * Structural verification for local opaque-effect adapters.
 *
 * @module
 */

import type {
  EffectCallableDeclaration,
  MutableEffectSummary,
} from './effect-summary-model.ts';
import {
  MUTATION_CONTRACT_UNAVAILABLE,
  mutationContractsForDeclaration,
  mutationTargetIndexes,
} from './mutation-contract-query.ts';

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Mutable summary is intentional effect accumulator. */
/**
 * Converts documented direct opaque boundary into verified adapter mutation.
 *
 * @param declaration - Callable whose contracts describe boundary.
 *
 * @param summary - Summary containing direct opaque provenance.
 *
 * @mutates summary - Reclassifies fully documented opaque indexes as mutation.
 *
 * @example
 * ```ts
 * applyVerifiedAdapterContracts({ declaration, summary });
 * ```
 */
export function applyVerifiedAdapterContracts({
  declaration,
  summary,
}: {
  readonly declaration: EffectCallableDeclaration;
  readonly summary: MutableEffectSummary;
},): void {
  /**
   * Source file owning contracts and callable.
   */
  const sourceFile = declaration.getSourceFile();
  /**
   * Attached mutation contracts required for adapter verification.
   */
  const contracts = mutationContractsForDeclaration({
    declaration,
    sourceFile,
  },);
  if (contracts === MUTATION_CONTRACT_UNAVAILABLE)
    return;
  /**
   * Authored target names mapped to source parameter indexes.
   */
  const targetIndexes = mutationTargetIndexes({
    declaration,
    sourceFile,
  },);
  summary.directOpaque
    .forEach(function verifyParameter(affectedParameterIndex,): void {
    /**
     * Provenance names for every opaque call affecting parameter.
     */
    const provenanceFacts = summary.opaqueProvenanceByParameter
      .get(affectedParameterIndex,);
    if ((provenanceFacts === undefined) || (provenanceFacts.size === 0))
      return;
    /**
     * Contracts targeting current semantic parameter.
     */
    const parameterContracts = contracts.blocks
      .filter(function matchingContract(block,): boolean {
      return targetIndexes.get(block.parameterName,) === affectedParameterIndex;
    },);
    /**
     * Whether every opaque call is named or linked by matching contract.
     */
    const fullyDocumented = [...provenanceFacts,].every(function documented(provenance,): boolean {
      /**
       * Final callable member retained for matching documentation links.
       */
      const finalMemberSeparator = provenance.lastIndexOf('.',);
      /**
       * Callable member text after final property separator.
       */
      const member = provenance.slice(finalMemberSeparator + 1,);
      return parameterContracts.some(function namesBoundary(block,): boolean {
        /**
         * Whether contract names exact authored call expression.
         */
        const namesExactBoundary = block.description
          .includes(provenance,);
        /**
         * Whether contract links documentation while naming callable member.
         */
        const linksNamedBoundary = (block.description
          .includes('https://',)
          || block.description
          .includes('http://',))
          && block.description
          .includes(member,);
        return namesExactBoundary || linksNamedBoundary;
      },);
    },);
    if (!fullyDocumented)
      return;
    summary.directOpaque
      .delete(affectedParameterIndex,);
    summary.directMutated
      .add(affectedParameterIndex,);
  },);
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
