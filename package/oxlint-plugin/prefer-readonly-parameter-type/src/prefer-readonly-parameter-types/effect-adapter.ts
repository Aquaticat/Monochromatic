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
import { originBoundaryName, } from './effect-origin-location.ts';

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
  /**
   * Boundary name compared without origin-location enrichment.
   */
  const boundaryName = originBoundaryName(provenance,);
  if (boundaryName === STRING_OBJECT_COERCION_PROVENANCE)
    return STRING_COERCION_CONTRACT_TERMS.every(function includesTerm(term,): boolean {
      return description.includes(term,);
    },);
  if (description.includes(boundaryName,))
    return true;
  /**
   * Final callable member retained for matching documentation links.
   */
  const finalMemberSeparator = boundaryName.lastIndexOf('.',);
  /**
   * Callable member text after final property separator.
   */
  const member = boundaryName.slice(finalMemberSeparator + 1,);
  return (description.includes('https://')
      || description.includes('http://'))
    && description.includes(member,);
}

/**
 * Lists boundary names no supplied contract explanation documents, in the
 * plain form a `@mutates` explanation must contain, deduplicated and sorted.
 * The verifier includes these in the unresolved-effect diagnostic so an
 * incomplete contract learns exactly which calls it still has to name,
 * instead of leaving the author to diff prose against the boundary list.
 *
 * @param facts - Unresolved provenance facts affecting one parameter.
 *
 * @param contracts - Contract blocks targeting that same parameter.
 *
 * @returns Sorted plain boundary names no contract documents.
 *
 * @example
 * ```ts
 * undocumentedBoundaries({ facts: uncertainty.facts, contracts: parameterBlocks });
 * ```
 */
export function undocumentedBoundaries(
  {
    facts,
    contracts,
  }: {
    readonly facts: readonly string[];
    readonly contracts: readonly { readonly description: string; }[];
  },
): readonly string[] {
  /**
   * Plain boundary names whose provenance no contract explanation documents.
   */
  const uncovered = facts
    .filter(function lacksContract(provenance,): boolean {
      return !contracts.some(function namesBoundary(block,): boolean {
        return descriptionDocumentsBoundary({
          description: block.description,
          provenance,
        },);
      },);
    },)
    .map(function plainName(provenance,): string {
      return originBoundaryName(provenance,);
    },);
  return [...new Set(uncovered,),].toSorted();
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
