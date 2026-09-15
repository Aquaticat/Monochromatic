import type { PreparationDefinitionDomain, } from './preparation-definition-model.ts';
import { preparationInputNodeId, } from './preparation-input-read-identity.ts';
import {
  preparationInputFields,
  preparationInputInteger,
  preparationInputItems,
  type PreparationInputField,
} from './preparation-input-read-value.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type { PreparationRootDefinitionOrder, } from './preparation-root-registration-model.ts';

//region Definition identity and local interpretation indexes remain separate domains

/**
 Reads ordered native definition identities without interpreting labels or choosing correspondence.

 @internal

 @param value - invocation-owned parsed definition identity collection

 @param path - authored source or target definition-domain position

 @returns Frozen unique canonical node IDs in supplied order

 @throws PreparationRootError when identity grammar or uniqueness differs

 @example
 ```ts
 const ids = preparationInputDefinitionIds({ value, path });
 ```
 */
export function preparationInputDefinitionIds({
  value,
  path,
}: PreparationInputField): readonly string[] {
  /**
   Identity order is retained for later comparison with the parent's actual node inventory.
   */
  const ids = preparationInputItems({
    value,
    path,
    read: preparationInputNodeId,
  });
  if (new Set(ids).size !== ids.length)
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return ids;
}

/**
 Rebuilds both native definition domains without borrowing authority from an ordinary writer parent.

 @internal

 @param value - invocation-owned parsed definition-domain record

 @param path - authored registered definition-domain position

 @returns Frozen independent source and target identity collections

 @throws PreparationRootError when fields or either identity collection differ

 @example
 ```ts
 const domain = preparationInputDefinitionDomain({ value, path });
 ```
 */
export function preparationInputDefinitionDomain({
  value,
  path,
}: PreparationInputField): PreparationDefinitionDomain {
  /**
   Neither side can be inferred from the other's presence or absence.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'sourceIds',
      'targetIds',
    ],
  });
  return Object.freeze({
    sourceIds: preparationInputDefinitionIds(field('sourceIds')),
    targetIds: preparationInputDefinitionIds(field('targetIds')),
  });
}

/**
 Reads explicit JSON-bound definition indexes in native increasing local order.
 The former lost Set representation is never interpreted as an empty collection.

 @internal

 @param value - invocation-owned parsed local definition indexes

 @param path - authored source or target order-metadata position

 @returns Frozen nonnegative strictly increasing indexes, including an explicit empty array

 @throws PreparationRootError when array shape, numeric domain or native order differs

 @example
 ```ts
 const indexes = preparationInputDefinitionIndexes({ value, path });
 ```
 */
export function preparationInputDefinitionIndexes({
  value,
  path,
}: PreparationInputField): readonly number[] {
  /**
   Numeric indexes remain separate from full-document node identity strings.
   */
  const indexes = preparationInputItems({
    value,
    path,
    read: preparationInputInteger,
  });
  if (!indexes.every(function increasing(
    index,
    position,
  ): boolean {
    /**
     The initial local position has no predecessor; all subsequent values must advance.
     */
    const previous = indexes[position - 1];
    return (previous === undefined) || (previous < index);
  }))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return indexes;
}

/**
 Decodes the corrected serializable interpretation metadata without constructing runtime sets.

 @internal

 @param value - invocation-owned parsed definition-order record

 @param path - authored queried-registration order position

 @returns Frozen independent local-index arrays

 @throws PreparationRootError when fields or either index array differ

 @example
 ```ts
 const order = preparationInputDefinitionOrder({ value, path });
 ```
 */
export function preparationInputDefinitionOrder({
  value,
  path,
}: PreparationInputField): PreparationRootDefinitionOrder {
  /**
   The root DTO uses arrays even though the separate native pairing question uses sets.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'source',
      'target',
    ],
  });
  return Object.freeze({
    source: preparationInputDefinitionIndexes(field('source')),
    target: preparationInputDefinitionIndexes(field('target')),
  });
}

//endregion Definition identity and local interpretation indexes remain separate domains
