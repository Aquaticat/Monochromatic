import type { ArchiveOriginalSpan, } from './archive-original-note.ts';
import { preparationRootProtection, } from './preparation-root-protection.ts';
import type { ChunkPair, } from './chunk-document.ts';
import {
  hashContent,
  type DocumentNode,
} from './document-node.ts';
import type {
  PreparationRootNode,
  PreparationRootParent,
  PreparationRootPopulationParent,
} from './preparation-root-population-model.ts';

//region Native parent snapshots under the frozen producer's schema

/**
 Projects native node identity without carrying unrelated node text into population accounting.

 @internal
 
 @param node - node reconstructed from a complete pinned document
 
 @returns Exact historical node projection
 
 @example
 ```ts
 const identity = preparationRootNode(node);
 ```
 */
export function preparationRootNode(node: DocumentNode,): PreparationRootNode {
  return {
    id: node.id,
    kind: node.kind,
    zone: node.zone,
    startOffset: node.startOffset,
    endOffset: node.endOffset,
    contentHash: node.contentHash,
  };
}

/**
 Reconstructs one parent without changing native section, insertion or protected-original semantics.

 @internal
 
 @param entryId - current corpus entry
 
 @param pairIndex - combined native parent position
 
 @param pair - current complete source/target parent
 
 @param spans - current original-English declarations
 
 @returns Exact frozen pool representation for later whole-record comparison
 
 @example
 ```ts
 const parent = preparationRootParent({ entryId, pairIndex, pair, spans });
 ```
 */
export function preparationRootParent({
  entryId,
  pairIndex,
  pair,
  spans,
}: {
  readonly entryId: string;
  readonly pairIndex: number;
  readonly pair: ChunkPair;
  readonly spans: readonly ArchiveOriginalSpan[];
},): PreparationRootParent {
  /**
   Shared geometry preserves original protection before remaining parent identities are constructed.
   */
  const originalProtection = preparationRootProtection({
    target: pair.target,
    spans,
  });
  return {
    id: `${entryId}/source-section/${String(pair.source
      .sliceIndex,)}/target-section/${String(pair.target
        .sliceIndex,)}`,
    entryId,
    index: pair.source
      .sliceIndex,
    pairIndex,
    sourceSectionIndex: pair.source
      .sliceIndex,
    targetSectionIndex: pair.target
      .sliceIndex,
    sourceText: pair.source
      .text,
    incumbentText: pair.target
      .text,
    source: {
      startOffset: pair.source
        .startOffset,
      endOffset: pair.source
        .endOffset,
      hash: hashContent({ content: pair.source
        .text, },),
      nodes: pair.source
        .nodes
        .map(preparationRootNode,),
    },
    target: {
      startOffset: pair.target
        .startOffset,
      endOffset: pair.target
        .endOffset,
      hash: hashContent({ content: pair.target
        .text, },),
      nodes: pair.target
        .nodes
        .map(preparationRootNode,),
    },
    originalProtection,
  };
}

/**
 Preserves the frozen full-population projection without widening its retained prose scope.

 @internal
 
 @param parent - independently reconstructed parent
 
 @returns Metadata used by the original population record
 
 @example
 ```ts
 const row = preparationRootPopulationParent(parent);
 ```
 */
export function preparationRootPopulationParent(parent: PreparationRootParent,): PreparationRootPopulationParent {
  return structuredClone({
    id: parent.id,
    entryId: parent.entryId,
    pairIndex: parent.pairIndex,
    sourceSectionIndex: parent.sourceSectionIndex,
    targetSectionIndex: parent.targetSectionIndex,
    source: parent.source,
    target: parent.target,
    originalProtection: parent.originalProtection,
  },);
}

//endregion Native parent snapshots under the frozen producer's schema
