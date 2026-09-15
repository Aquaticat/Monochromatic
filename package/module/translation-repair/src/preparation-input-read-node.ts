import type {
  PreparationRootNode,
  PreparationRootParentSide,
  PreparationRootProtection,
} from './preparation-root-population-model.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import { preparationInputNodeId, } from './preparation-input-read-identity.ts';
import {
  preparationInputBoolean,
  preparationInputDigest,
  preparationInputFields,
  preparationInputInteger,
  preparationInputItems,
  preparationInputLiteral,
  preparationInputNonblankString,
  type PreparationInputField,
} from './preparation-input-read-value.ts';

//region Persisted node coordinates and independent protection evidence

/**
 Reads the represented node projection without inventing its omitted text.

 @internal

 @param value - owned parsed node metadata

 @param path - authored schema position in the node inventory

 @returns Frozen native identity, extensible kind, zone, coordinates and content hash

 @throws PreparationRootError when node fields or canonical identity/extent differ

 @example
 ```ts
 const node = preparationInputNode({ value, path });
 ```
 */
export function preparationInputNode({
  value,
  path,
}: PreparationInputField): PreparationRootNode {
  /**
   Node kinds remain strings because native remark plugins extend that vocabulary.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'id',
      'kind',
      'zone',
      'startOffset',
      'endOffset',
      'contentHash',
    ],
  });
  /**
   Typed construction does not derive text from a content hash.
   */
  const node: PreparationRootNode = {
    id: preparationInputNodeId(field('id')),
    kind: preparationInputNonblankString(field('kind')),
    zone: preparationInputLiteral({
      ...field('zone'),
      choices: [
        'body',
        'footnote-definition',
      ],
    }),
    startOffset: preparationInputInteger(field('startOffset')),
    endOffset: preparationInputInteger(field('endOffset')),
    contentHash: preparationInputDigest({
      ...field('contentHash'),
      algorithm: 'sha256',
    }),
  };
  if (node.endOffset < node.startOffset)
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(node);
}

/**
 Reads one complete parent-side inventory without confusing parent hash with document hash.

 @internal

 @param value - owned parsed parent side

 @param path - authored schema position of this side

 @returns Frozen side coordinates and uniquely identified represented nodes

 @throws PreparationRootError when fields, containment or node identities differ

 @example
 ```ts
 const side = preparationInputParentSide({ value, path });
 ```
 */
export function preparationInputParentSide({
  value,
  path,
}: PreparationInputField): PreparationRootParentSide {
  /**
   Every side field remains explicit, including an empty node collection.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'startOffset',
      'endOffset',
      'hash',
      'nodes',
    ],
  });
  /**
   Side membership is checked within its own source or target coordinate domain.
   */
  const side: PreparationRootParentSide = {
    startOffset: preparationInputInteger(field('startOffset')),
    endOffset: preparationInputInteger(field('endOffset')),
    hash: preparationInputDigest({
      ...field('hash'),
      algorithm: 'sha256',
    }),
    nodes: preparationInputItems({
      ...field('nodes'),
      read: preparationInputNode,
    }),
  };
  /**
   Collection and extent refer to the same newly decoded side.
   */
  const {
    nodes,
    startOffset,
    endOffset,
  } = side;
  /**
   Repeating an identity cannot manufacture a second represented node.
   */
  const ids = nodes.map(function identity(node): string {
    return node.id;
  });
  if ((endOffset < startOffset)
    || (new Set(ids).size !== ids.length)
    || (!nodes.every(function contained(node): boolean {
      return (node.startOffset >= startOffset) && (node.endOffset <= endOffset);
    })))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(side);
}

/**
 Reads one existing protection intersection without exporting the declaration's omitted text.

 @internal

 @param value - owned parsed intersection

 @param path - authored position within protection evidence

 @returns Frozen interval and declaration identity

 @throws PreparationRootError when fields or interval order differ

 @example
 ```ts
 const interval = preparationInputProtectionIntersection({ value, path });
 ```
 */
export function preparationInputProtectionIntersection({
  value,
  path,
}: PreparationInputField): PreparationRootProtection['intersections'][number] {
  /**
   A note hash is evidence identity, not an original-English classification decision.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'startOffset',
      'endOffset',
      'noteHash',
    ],
  });
  /**
   Input coordinates are never reordered to make an invalid interval appear valid.
   */
  const intersection = {
    startOffset: preparationInputInteger(field('startOffset')),
    endOffset: preparationInputInteger(field('endOffset')),
    noteHash: preparationInputDigest({
      ...field('noteHash'),
      algorithm: 'sha256',
    }),
  };
  if (intersection.endOffset < intersection.startOffset)
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(intersection);
}

/**
 Preserves sealed and straddling target-node evidence as separate ordered collections.
 Node membership and original-policy correspondence remain complete-DTO relation checks.

 @internal

 @param value - owned parsed parent protection

 @param path - authored schema position of protection evidence

 @returns Frozen explicit protection data without reclassifying authority

 @throws PreparationRootError when protection shape or duplicate identities differ

 @example
 ```ts
 const protection = preparationInputProtection({ value, path });
 ```
 */
export function preparationInputProtection({
  value,
  path,
}: PreparationInputField): PreparationRootProtection {
  /**
   Absent protection fields cannot become an invented unprotected parent.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'intersections',
      'sealedTargetNodeIds',
      'straddlingNodeIds',
      'allTargetNodesSealed',
    ],
  });
  /**
   Each collection retains its own declared role and order.
   */
  const protection: PreparationRootProtection = {
    intersections: preparationInputItems({
      ...field('intersections'),
      read: preparationInputProtectionIntersection,
    }),
    sealedTargetNodeIds: preparationInputItems({
      ...field('sealedTargetNodeIds'),
      read: preparationInputNonblankString,
    }),
    straddlingNodeIds: preparationInputItems({
      ...field('straddlingNodeIds'),
      read: preparationInputNonblankString,
    }),
    allTargetNodesSealed: preparationInputBoolean(field('allTargetNodesSealed')),
  };
  /**
   Identity uniqueness is checked separately for the two protection roles.
   */
  const {
    sealedTargetNodeIds,
    straddlingNodeIds,
  } = protection;
  if ((new Set(sealedTargetNodeIds).size !== sealedTargetNodeIds.length)
    || (new Set(straddlingNodeIds).size !== straddlingNodeIds.length))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(protection);
}

//endregion Persisted node coordinates and independent protection evidence
