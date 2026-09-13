import { isDeepStrictEqual, } from 'node:util';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { DocumentNode, } from './document-node.ts';
import {
  definitionIndexes,
  definitionLabelsOf,
} from './pair-definition-order.ts';
import type {
  PreparationDefinitionDomain,
  PreparationDefinitionEndpoint,
  PreparationDefinitionEvidence,
  PreparationDefinitionRelation,
} from './preparation-definition-model.ts';
import type { PreparationEvidenceOccurrence, } from './preparation-occurrence-model.ts';
import { PreparationQualificationError, } from './preparation-qualification-error.ts';
import { replayPreparedBlockEvidence, } from './replay-prepared-block-evidence.ts';

//region Internal projection from owned receipt-bound occurrence data

/**
 * Names an owned parser-readable definition without inventing a label.
 *
 * @param node - definition from fresh complete-document parsing
 *
 * @param blockIndex - index already checked by native agreement
 *
 * @returns Current endpoint restricted to deterministic footnote operations
 *
 * @example
 * ```ts
 * const endpoint = definitionEndpoint({ node, blockIndex: 1 });
 * ```
 */
function definitionEndpoint({
  node,
  blockIndex,
}: {
  readonly node: DocumentNode;
  readonly blockIndex: number
},): PreparationDefinitionEndpoint {
  /**
   * The native definition reader returns its opening label; parser invariant failures must throw.
   */
  const label = nonNullishOrThrow(definitionLabelsOf({ node, },)[0],);
  return {
    nodeId: node.id,
    blockIndex,
    label,
  };
}

/**
 * Applies definition-only policy to an owned fresh occurrence, never caller-provided node tables or aggregates.
 * This helper is not part of the package barrel and supplies no body placement authority.
 *
 * @param occurrence - owned output of the receipt/current-document reconstruction boundary
 *
 * @param domain - independently registered current definition inventory
 *
 * @param l - caller logger retaining dependency scope
 *
 * @returns Owned definition projection with its complete occurrence binding
 *
 * @throws PreparationQualificationError when the domain or usable quorum cannot qualify
 *
 * @example
 * ```ts
 * const definitions = projectPreparationDefinitionRelations({ occurrence, domain, l });
 * ```
 */
export function projectPreparationDefinitionRelations({
  occurrence,
  domain,
  l,
}: {
  readonly occurrence: PreparationEvidenceOccurrence;
  readonly domain: PreparationDefinitionDomain;
  readonly l: Logger;
},): PreparationDefinitionEvidence {
  /**
   * Scoped telemetry cannot promote definition evidence into body authority.
   */
  const pl = tagged({
    tag: projectPreparationDefinitionRelations.name,
    l,
  },);
  /**
   * All data comes from an owned completed reconstruction, not a caller-mutated naked parent.
   */
  const {
    pair,
    evidence,
    expected,
  } = occurrence;
  /**
   * Native parser zones classify definition endpoints.
   */
  const sourceIndexes = definitionIndexes({ nodes: pair.source
    .nodes, },);
  /**
   * Target classification is independent of unrelated body coverage.
   */
  const targetIndexes = definitionIndexes({ nodes: pair.target
    .nodes, },);
  /**
   * Complete local inventory must agree with the preregistered occurrence's definition domain.
   */
  const currentDomain: PreparationDefinitionDomain = {
    sourceIds: pair.source
      .nodes
      .filter(function isDefinition(
        _node,
        index,
      ): boolean {
      return sourceIndexes.has(index,);
    },)
      .map(function nodeId(node,): string { return node.id; },),
    targetIds: pair.target
      .nodes
      .filter(function isDefinition(
        _node,
        index,
      ): boolean {
      return targetIndexes.has(index,);
    },)
      .map(function nodeId(node,): string { return node.id; },),
  };
  if (!isDeepStrictEqual(
    currentDomain,
    domain,
  ))
    throw new PreparationQualificationError({ kind: 'definition-domain', },);
  if ((sourceIndexes.size === 0) && (targetIndexes.size === 0))
    throw new PreparationQualificationError({ kind: 'definition-domain-empty', },);
  /**
   * Replay remains transient; only the restricted projection crosses this boundary.
   */
  const {
    question,
    outcome,
    requiredUsable,
  } = replayPreparedBlockEvidence({
    pair,
    evidence,
    modelIds: expected.binding
      .modelIds,
    l: pl,
  },);
  /**
   * Only raw native agreement is projected, never deterministic media widening or a stored aggregate.
   */
  const definitionRelations = outcome.pairs
    .filter(function bothDefinitions(relation,): boolean {
    return sourceIndexes.has(relation.source,) && targetIndexes.has(relation.target,);
  },)
    .map(function currentEndpoints(relation,): PreparationDefinitionRelation {
    /**
     * Native replay has checked these indexes against this same owned parent.
     */
    const source = nonNullishOrThrow(pair.source
      .nodes[relation.source],);
    /**
     * Target access shares the same checked index boundary.
     */
    const target = nonNullishOrThrow(pair.target
      .nodes[relation.target],);
    return {
      source: definitionEndpoint({
        node: source,
        blockIndex: relation.source,
      },),
      target: definitionEndpoint({
        node: target,
        blockIndex: relation.target,
      },),
      authority: 'independent-endorsement',
    };
  },);
  pl.info(`projected ${String(definitionRelations.length,)} endorsed definition relations without body placement authority`,);
  return structuredClone({
    qualification: 'pairing-only',
    scope: 'footnote-definitions',
    occurrence: expected,
    questionKey: question.key,
    modelIds: expected.binding
      .modelIds,
    requiredUsable,
    usable: outcome.usable,
    domain: currentDomain,
    definitionRelations,
  },);
}

//endregion Internal projection from owned receipt-bound occurrence data
