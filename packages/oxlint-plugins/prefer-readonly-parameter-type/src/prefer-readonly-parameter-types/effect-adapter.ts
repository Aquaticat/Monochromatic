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
import { STRING_OBJECT_COERCION_PROVENANCE, } from './string-coercion-effect.ts';

/**
 * Terms required for deliberate global String object-coercion contract.
 */
const STRING_COERCION_CONTRACT_TERMS: readonly string[] = [
  'String',
  'getters',
  'proxy traps',
  'Symbol.toPrimitive',
  'toString',
  'valueOf',
];

/**
 * Tests whether one contract identifies an exact unresolved boundary.
 *
 * Global String conversion accepts explicit hook enumeration because its
 * generated provenance explanation is not reasonable authored prose.
 * Other boundaries retain exact-name or linked-member requirements.
 *
 * @param description - Authored mutation-contract explanation.
 *
 * @param provenance - Generated exact boundary provenance.
 *
 * @returns Whether description identifies boundary with required detail.
 *
 * @example
 * ```ts
 * descriptionDocumentsBoundary({ description, provenance });
 * ```
 */
function descriptionDocumentsBoundary({
  description,
  provenance,
}: {
  readonly description: string;
  readonly provenance: string;
},): boolean {
  if (provenance === STRING_OBJECT_COERCION_PROVENANCE)
    return STRING_COERCION_CONTRACT_TERMS.every(function includesTerm(term,): boolean {
      return description.includes(term,);
    },);
  if (description.includes(provenance,))
    return true;
  /**
   * Final callable member retained for matching documentation links.
   */
  const finalMemberSeparator = provenance.lastIndexOf('.',);
  /**
   * Callable member text after final property separator.
   */
  const member = provenance.slice(finalMemberSeparator + 1,);
  return (description.includes('https://')
      || description.includes('http://'))
    && description.includes(member,);
}

/**
 * Converts documented direct opaque boundary into conservative uncertainty.
 *
 * @param declaration - Callable whose contracts describe boundary.
 *
 * @param summary - Summary containing direct opaque provenance.
 *
 * @mutates summary - Reclassifies fully documented opaque indexes as documented uncertainty.
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
      return parameterContracts.some(function namesBoundary(block,): boolean {
        return descriptionDocumentsBoundary({
          description: block.description,
          provenance,
        },);
      },);
    },);
    if (!fullyDocumented)
      return;
    summary.directOpaque
      .delete(affectedParameterIndex,);
    summary.directDocumentedUncertain
      .add(affectedParameterIndex,);
  },);
}
