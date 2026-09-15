import type { ArchiveOriginalSpan, } from './archive-original-note.ts';
import { hashContent, } from './document-node.ts';
import type {
  PreparationRootParentSide,
  PreparationRootProtection,
} from './preparation-root-population-model.ts';
import { sealedNodeIds, } from './sealed-node-ids.ts';

//region Shared protection projection uses explicit geometry, never note classification

/**
 Projects original-language protection from already declared spans and target-node bounds.
 Full intersecting declarations remain intact; sealed nodes cannot also become straddling nodes.

 @internal

 @param target - target-local node inventory and parent extent

 @param spans - explicit current declarations, already classified by their owning producer

 @returns Fresh native protection metadata without parsing or classifying declaration text

 @example
 ```ts
 const protection = preparationRootProtection({ target, spans });
 ```
 */
export function preparationRootProtection({
  target,
  spans,
}: {
  readonly target: Pick<PreparationRootParentSide, 'nodes' | 'startOffset' | 'endOffset'>;
  readonly spans: readonly ArchiveOriginalSpan[];
}): PreparationRootProtection {
  /**
   The target coordinate domain is independent of source alignment or writer membership.
   */
  const {
    nodes,
    startOffset,
    endOffset,
  } = target;
  /**
   Native whole-node protection is distinct from a straddling declaration.
   */
  const sealed = sealedNodeIds({
    nodes,
    spans,
  });
  /**
   Parent-local intersections retain complete declaration geometry and identity, not clipped intervals.
   */
  const intersections = spans.filter(function intersects(span): boolean {
    return (span.startOffset < endOffset) && (span.endOffset > startOffset);
  })
    .map(function intersection(span): PreparationRootProtection['intersections'][number] {
      return {
        startOffset: span.startOffset,
        endOffset: span.endOffset,
        noteHash: hashContent({ content: span.note, }),
      };
    });
  /**
   A partly protected node must not become an unqualified writable fragment.
   */
  const straddlingNodeIds = nodes.filter(function straddles(node): boolean {
    return (!sealed.has(node.id)) && spans.some(function intersects(span): boolean {
      return (span.startOffset < node.endOffset) && (span.endOffset > node.startOffset);
    });
  })
    .map(function identity(node): string {
      return node.id;
    });
  return {
    intersections,
    sealedTargetNodeIds: [...sealed],
    straddlingNodeIds,
    allTargetNodesSealed: (nodes.length > 0) && (sealed.size === nodes.length),
  };
}

//endregion Shared protection projection uses explicit geometry, never note classification
