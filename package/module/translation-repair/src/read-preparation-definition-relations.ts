import { isDeepStrictEqual, } from 'node:util';
import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ChunkPair, } from './chunk-document.ts';
import type { DocumentNode, } from './document-node.ts';
import { definitionIndexes, definitionLabelsOf, } from './pair-definition-order.ts';
import type { PreparedBlockEvidence, } from './prepare-block-pairing-model.ts';
import type { PreparationDefinitionDomain, PreparationDefinitionEndpoint, PreparationDefinitionEvidence, PreparationDefinitionRelation, } from './preparation-definition-model.ts';
import { PreparationQualificationError, } from './preparation-qualification-error.ts';
import { replayPreparedBlockEvidence, } from './replay-prepared-block-evidence.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Restricted current definition evidence

/**
 * Names one current parser-readable definition without inventing a label for malformed input.
 * @param nodes - current parent side backing the numbered question
 * @param blockIndex - native endorsed relation index
 * @returns Current endpoint restricted to deterministic footnote operations
 * @throws PreparationQualificationError when no unique current definition label backs the endpoint
 * @example
 * ```ts
 * const endpoint = definitionEndpoint({ nodes, blockIndex: 1 });
 * ```
 */
function definitionEndpoint({ nodes, blockIndex, }: { readonly nodes: readonly DocumentNode[]; readonly blockIndex: number; },): PreparationDefinitionEndpoint {
  /** Native agreement has validated the index, but malformed runtime inputs still receive a scoped refusal. */
  const node = nodes[blockIndex];
  if (node === undefined)
    throw new PreparationQualificationError({ kind: 'definition-domain', },);
  /** Reuse the production label reader rather than inferring identity from spelling or position. */
  const labels = definitionLabelsOf({ node, },);
  /** Explicit narrowing preserves the unique-label requirement for runtime callers. */
  const [label,] = labels;
  if ((labels.length !== 1) || (label === undefined))
    throw new PreparationQualificationError({ kind: 'definition-label', },);
  return { nodeId: node.id, blockIndex, label, };
}

/**
 * Projects usable current question evidence to independently endorsed definition endpoints only.
 * Unrelated body coverage need not qualify here, and no body/media/decline/slicer authority is returned.
 * The owning journal must independently bind receipt provenance, complete documents and allowed target transitions.
 * Empty output grants no correspondence; zero-question dispatch belongs to structural accounting instead.
 *
 * @param pair - current parser-owned parent from occurrence reconstruction
 * @param evidence - exact retained acquisition evidence for this current question
 * @param modelIds - independently configured preparation electorate
 * @param domain - complete current definition inventory derived from the preregistered domain
 * @param l - caller logger retaining dependency scope
 * @returns Owned definition-only projection with configured usable-quorum accounting
 * @throws PreparationQualificationError when dispatch, domain, current evidence or definition labels cannot be checked
 * @example
 * ```ts
 * const definitions = readPreparationDefinitionRelations({ pair, evidence, modelIds, domain, l });
 * ```
 */
export function readPreparationDefinitionRelations({ pair, evidence, modelIds, domain, l, }: {
  readonly pair: ChunkPair;
  readonly evidence: PreparedBlockEvidence;
  readonly modelIds: readonly RosterModelId[];
  readonly domain: PreparationDefinitionDomain;
  readonly l: Logger;
},): PreparationDefinitionEvidence {
  /** This logger cannot promote the dependency into full-parent preparation authority. */
  const pl = tagged({ tag: readPreparationDefinitionRelations.name, l, },);
  if ((pair.source.nodes.length === 0) || (pair.target.nodes.length === 0)
    || ((pair.source.nodes.length === 1) && (pair.target.nodes.length === 1)))
    throw new PreparationQualificationError({ kind: 'definition-question', },);
  /** Definition classification uses the same parser zones as production pairing. */
  const sourceIndexes = definitionIndexes({ nodes: pair.source.nodes, },);
  /** Target classification is independent of body relation or media-placement success. */
  const targetIndexes = definitionIndexes({ nodes: pair.target.nodes, },);
  /** Exact inventory comparison prevents silently widening or narrowing the registered current domain. */
  const currentDomain: PreparationDefinitionDomain = {
    sourceIds: pair.source.nodes.filter(function isDefinition(_node, index,): boolean {
      return sourceIndexes.has(index,);
    },).map(function nodeId(node,): string { return node.id; },),
    targetIds: pair.target.nodes.filter(function isDefinition(_node, index,): boolean {
      return targetIndexes.has(index,);
    },).map(function nodeId(node,): string { return node.id; },),
  };
  if (!isDeepStrictEqual(currentDomain, domain,))
    throw new PreparationQualificationError({ kind: 'definition-domain', },);
  /** Shared replay checks actual independent voters and usable quorum, not cache eligibility. */
  const { question, outcome, requiredUsable, } = replayPreparedBlockEvidence({ pair, evidence, modelIds, l: pl, },);
  /** Only raw native agreement is projected; deterministic media widening is deliberately absent. */
  const definitionRelations = outcome.pairs.filter(function bothDefinitions(relation,): boolean {
    return sourceIndexes.has(relation.source,) && targetIndexes.has(relation.target,);
  },).map(function currentEndpoints(relation,): PreparationDefinitionRelation {
    return {
      source: definitionEndpoint({ nodes: pair.source.nodes, blockIndex: relation.source, },),
      target: definitionEndpoint({ nodes: pair.target.nodes, blockIndex: relation.target, },),
      authority: 'independent-endorsement',
    };
  },);
  pl.info(`projected ${String(definitionRelations.length,)} endorsed definition relations without body placement authority`,);
  return structuredClone({
    qualification: 'pairing-only',
    scope: 'footnote-definitions',
    questionKey: question.key,
    modelIds,
    requiredUsable,
    usable: outcome.usable,
    domain: currentDomain,
    definitionRelations,
  },);
}

//endregion Restricted current definition evidence
