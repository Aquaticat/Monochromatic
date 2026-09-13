import { blockPairingProtocol, } from './block-pairing-protocol.ts';
import { blockPairingQuestion, } from './block-pairing-question.ts';
import type { ChunkPair, } from './chunk-document.ts';
import { hashContent, } from './document-node.ts';
import type { RepairDocument, } from './parse-document.ts';
import { preparationRootNode, } from './preparation-root-parent.ts';
import type {
  PreparationRootParentIdentity,
  PreparationRootParentRole,
  PreparationRootQuestionAliases,
  PreparationRootRegistration,
  PreparationRootUnalignedDefinitions,
} from './preparation-root-registration-model.ts';
import type { PreparationReceiptQuestion, } from './preparation-receipt-model.ts';

//region Frozen roots and deterministic definition dependencies

/**
 * Registers only frozen writer parents and definition-bearing parents in their complete selected entries.
 * No whole-entry section question, image reading or writer invocation is created.
 *
 * @param entryId - complete selected entry
 *
 * @param source - current parsed original
 *
 * @param target - current parsed normalized archive
 *
 * @param pairs - deterministic native parent alignment, with no section override
 *
 * @param selectedParentIds - original frozen identities, never a replacement draw
 *
 * @returns Current structural records and exact native questions for the initial closure
 *
 * @example
 * ```ts
 * const registry = preparationRootRegistrations({ entryId, source, target, pairs, selectedParentIds });
 * ```
 */
export function preparationRootRegistrations({
  entryId,
  source,
  target,
  pairs,
  selectedParentIds,
}: {
  readonly entryId: string;
  readonly source: RepairDocument;
  readonly target: RepairDocument;
  readonly pairs: readonly ChunkPair[];
  readonly selectedParentIds: ReadonlySet<string>;
},): readonly PreparationRootRegistration[] {
  return pairs.flatMap(function registration(
    pair,
    pairIndex,
  ): PreparationRootRegistration[] {
    /**
     * Current section identities retain the original frozen spelling convention.
     */
    const parentId = `${entryId}/source-section/${String(pair.source
      .sliceIndex,)}/target-section/${String(pair.target
        .sliceIndex,)}`;
    /**
     * Definition scope is derived from the parsed native nodes rather than matching label spellings.
     */
    const definitionDomain = {
      sourceIds: pair.source
        .nodes
        .filter(function definition(node,): boolean { return node.zone === 'footnote-definition'; },)
        .map(function identity(node,): string { return node.id; },),
      targetIds: pair.target
        .nodes
        .filter(function definition(node,): boolean { return node.zone === 'footnote-definition'; },)
        .map(function identity(node,): string { return node.id; },),
    };
    /**
     * Existing frozen membership is independent of whether this parent also owns definitions.
     */
    const selected = selectedParentIds.has(parentId,);
    /**
     * Definition-only dependencies cannot gain body or writer authority from membership in the closure.
     */
    const definitions = (definitionDomain.sourceIds
      .length
      > 0) || (definitionDomain.targetIds
        .length
        > 0);
    if ((!selected) && (!definitions))
      return [];
    /**
     * Explicit roles retain both responsibilities when a frozen writer parent owns definitions.
     */
    const roles: readonly PreparationRootParentRole[] = [
      ...selected ? ['writer-parent' as const,] : [],
      ...definitions ? ['footnote-definitions' as const,] : [],
    ];
    /**
     * Complete-document identity remains independent of identical local questions.
     */
    const identity: PreparationRootParentIdentity = {
      parentId,
      entryId,
      roles,
      sourceHash: source.documentHash,
      targetHash: target.documentHash,
      pairIndex,
      sourceIndex: pair.source
        .sliceIndex,
      targetIndex: pair.target
        .sliceIndex,
      definitionDomain,
    };
    if ((pair.source
      .nodes
      .length
      === 0) || (pair.target
        .nodes
        .length
        === 0))
      return [{
        ...identity,
        dispatch: 'empty',
      },];
    if ((pair.source
      .nodes
      .length
      === 1) && (pair.target
        .nodes
        .length
        === 1))
      return [{
        ...identity,
        dispatch: 'implicit',
      },];
    /**
     * Shared production construction owns numbering and definition-order interpretation.
     */
    const numbered = blockPairingQuestion({ pair, },);
    /**
     * Receipt-shaped questions carry exact native messages and schema, without any acquired outcomes.
     */
    const question: PreparationReceiptQuestion = {
      sourceBlocks: numbered.sourceBlocks,
      targetBlocks: numbered.targetBlocks,
      protocol: blockPairingProtocol(numbered,),
    };
    return [{
      ...identity,
      dispatch: 'queried',
      question,
      questionKey: numbered.key,
      questionDigest: hashContent({ content: JSON.stringify(question,), },),
      freeOrder: numbered.freeOrder,
    },];
  },);
}

/**
 * Retains definitions outside native aligned parents as namespace-only evidence.
 *
 * @param entryId - current complete entry
 *
 * @param source - parsed original retaining unaligned nodes
 *
 * @param target - parsed normalized archive retaining its separate namespace
 *
 * @param pairs - exact deterministic alignment already used for registered parents
 *
 * @returns Unaligned definition inventory without widening prompt or acquisition scope
 *
 * @example
 * ```ts
 * const namespace = preparationRootUnalignedDefinitions({ entryId, source, target, pairs });
 * ```
 */
export function preparationRootUnalignedDefinitions({
  entryId,
  source,
  target,
  pairs,
}: {
  readonly entryId: string;
  readonly source: RepairDocument;
  readonly target: RepairDocument;
  readonly pairs: readonly ChunkPair[];
},): PreparationRootUnalignedDefinitions {
  /**
   * Source and target coverage are separate domains even when node IDs have the same spelling.
   */
  const sourceCovered = new Set(pairs.flatMap(function sourceIds(pair,): string[] {
    return pair.source.nodes.map(function identity(node,): string { return node.id; },);
  },),);
  /**
   * No target coverage is inferred from the source side's membership.
   */
  const targetCovered = new Set(pairs.flatMap(function targetIds(pair,): string[] {
    return pair.target.nodes.map(function identity(node,): string { return node.id; },);
  },),);
  return {
    scope: 'unaligned-definition-namespace',
    entryId,
    source: source.nodes
      .filter(function unaligned(node,): boolean { return (node.zone === 'footnote-definition') && (!sourceCovered.has(node.id,)); },)
      .map(function identity(node,): ReturnType<typeof preparationRootNode> { return preparationRootNode(node,); },),
    target: target.nodes
      .filter(function unaligned(node,): boolean { return (node.zone === 'footnote-definition') && (!targetCovered.has(node.id,)); },)
      .map(function identity(node,): ReturnType<typeof preparationRootNode> { return preparationRootNode(node,); },),
  };
}

/**
 * Finds exact initial question aliases without reusing occurrence qualifications or making a provider call.
 *
 * @param registry - already ordered current parent registrations
 *
 * @returns Only question identities shared by distinct registered parents
 *
 * @example
 * ```ts
 * const aliases = preparationRootQuestionAliases(registry);
 * ```
 */
export function preparationRootQuestionAliases(registry: readonly PreparationRootRegistration[],): readonly PreparationRootQuestionAliases[] {
  /**
   * Exact serialized questions, not digest equality alone, own initial alias membership.
   */
  const groups = new Map<string, string[]>();
  for (const record of registry) {
    if (record.dispatch !== 'queried')
      continue;
    /**
     * The canonical native question contains both numbered sides and the exact protocol.
     */
    const bytes = JSON.stringify(record.question,);
    /**
     * Parent order remains the already registered order within each exact question.
     */
    const existing = groups.get(bytes,);
    if (existing === undefined)
      groups.set(
        bytes,
        [record.parentId,],
      );
    else
      existing.push(record.parentId,);
  }
  return [...groups,].filter(function shared([, parentIds,],): boolean {
    return parentIds.length > 1;
  },)
    .map(function group([bytes, parentIds,],): PreparationRootQuestionAliases {
    return {
      questionDigest: hashContent({ content: bytes, },),
      parentIds: [...parentIds,],
    };
  },);
}

//endregion Frozen roots and deterministic definition dependencies
