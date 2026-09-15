import { hashContent, } from './document-node.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type {
  PreparationRootParentSide,
  PreparationRootPopulationParent,
} from './preparation-root-population-model.ts';

//region Parent identity and protection relations do not depend on omitted population prose

/**
 Checks canonical parent identity and target-local protection membership.
 Full overlapping declaration intervals are retained rather than clipped to parent bounds.

 @internal

 @param parent - invocation-owned decoded parent metadata

 @param path - authored parent position

 @throws PreparationRootError when identity, protection membership or summary differs

 @example
 ```ts
 verifyPreparationInputParentRelations({ parent, path });
 ```
 */
export function verifyPreparationInputParentRelations({
  parent,
  path,
}: {
  readonly parent: PreparationRootPopulationParent;
  readonly path: string;
}): void {
  /**
   Combined pair position remains separate from each side's native section index.
   */
  const {
    id,
    entryId,
    sourceSectionIndex,
    targetSectionIndex,
    target,
    originalProtection,
  } = parent;
  if (id !== `${entryId}/source-section/${String(sourceSectionIndex)}/target-section/${String(targetSectionIndex)}`)
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.id`,
    });
  /**
   Protection collections describe only nodes in this parent's target coordinate domain.
   */
  const {
    nodes,
    startOffset,
    endOffset,
  } = target;
  /**
   Sealed and straddling identities preserve separate roles and native target-node order.
   */
  const {
    intersections,
    sealedTargetNodeIds,
    straddlingNodeIds,
    allTargetNodesSealed,
  } = originalProtection;
  /**
   Membership sets do not replace the persisted ordered identity arrays.
   */
  const sealed = new Set(sealedTargetNodeIds);
  /**
   Native straddling classification explicitly excludes sealed nodes.
   */
  const straddling = new Set(straddlingNodeIds);
  /**
   Each node identity can contribute at most once within its decoded target side.
   */
  const targetIds = nodes.map(function identity(node): string {
    return node.id;
  });
  /**
   Filtering native node order detects both unknown identities and reordered protection lists.
   */
  const memberships = [
    {
      field: 'sealedTargetNodeIds',
      declared: sealedTargetNodeIds,
      selected: targetIds.filter(function selected(nodeId): boolean {
        return sealed.has(nodeId);
      }),
    },
    {
      field: 'straddlingNodeIds',
      declared: straddlingNodeIds,
      selected: targetIds.filter(function selected(nodeId): boolean {
        return straddling.has(nodeId);
      }),
    },
  ];
  for (const membership of memberships) {
    /**
     Ordered declarations and their target-derived counterpart share this role only.
     */
    const {
      declared,
      selected,
    } = membership;
    if ((declared.length !== selected.length) || (!declared.every(function matches(
      nodeId,
      index,
    ): boolean {
      return nodeId === selected[index];
    })))
      throw new PreparationRootError({
        kind: 'input-relations',
        input: `${path}.originalProtection.${membership.field}`,
      });
  }
  if (straddlingNodeIds.some(function alsoSealed(nodeId): boolean {
    return sealed.has(nodeId);
  }))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.originalProtection.straddlingNodeIds`,
    });
  if (allTargetNodesSealed !== ((nodes.length > 0) && (sealed.size === nodes.length)))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.originalProtection.allTargetNodesSealed`,
    });
  if (!intersections.every(function overlaps(span): boolean {
    return (span.startOffset < endOffset) && (span.endOffset > startOffset);
  }))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.originalProtection.intersections`,
    });
}

/**
 Verifies side and node identities only when their exact parent text is represented.
 Population-only metadata cannot use this boundary to reconstruct omitted text.

 @internal

 @param side - invocation-owned decoded parent-side metadata

 @param text - represented complete parent-side text

 @param path - authored source or target side position

 @throws PreparationRootError when text extent, side hash or any node hash differs

 @example
 ```ts
 verifyPreparationInputParentText({ side, text, path });
 ```
 */
export function verifyPreparationInputParentText({
  side,
  text,
  path,
}: {
  readonly side: PreparationRootParentSide;
  readonly text: string;
  readonly path: string;
}): void {
  /**
   Node offsets are absolute; text slices use the same side's relative origin.
   */
  const {
    startOffset,
    endOffset,
    hash,
    nodes,
  } = side;
  if ((text.length !== (endOffset - startOffset)) || (hashContent({ content: text, }) !== hash))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  for (const [index, node] of nodes.entries()) {
    /**
     Native node construction and container widening both hash the exact corresponding text slice.
     */
    const content = text.slice(
      node.startOffset - startOffset,
      node.endOffset - startOffset,
    );
    if (hashContent({ content, }) !== node.contentHash)
      throw new PreparationRootError({
        kind: 'input-relations',
        input: `${path}.nodes[${String(index)}].contentHash`,
      });
  }
}

//endregion Parent identity and protection relations do not depend on omitted population prose
