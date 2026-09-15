import { preparationInputEntryId, } from './preparation-input-read-identity.ts';
import {
  preparationInputParentSide,
  preparationInputProtection,
} from './preparation-input-read-node.ts';
import {
  verifyPreparationInputParentRelations,
  verifyPreparationInputParentText,
} from './preparation-input-read-parent-relations.ts';
import {
  preparationInputFields,
  preparationInputInteger,
  preparationInputString,
  type PreparationInputField,
} from './preparation-input-read-value.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type {
  PreparationRootParent,
  PreparationRootPopulationParent,
} from './preparation-root-population-model.ts';

//region Population metadata and selected parent prose stay separate serialized families

/**
 Shared native fields are present in both population rows and selected complete parents.
 */
const PARENT_KEYS = [
  'id',
  'entryId',
  'pairIndex',
  'sourceSectionIndex',
  'targetSectionIndex',
  'source',
  'target',
  'originalProtection',
] as const;

/**
 A selector already bound to the exact authored key inventory retains values as unknown.
 */
type ParentField = (key: (typeof PARENT_KEYS)[number]) => PreparationInputField;

/**
 Rebuilds shared metadata without reading any optional or absent prose field.

 @param field - selector for an already checked native parent record

 @param path - authored parent position for identity and protection relation errors

 @returns Frozen shared metadata without creating a population-to-text reconstruction path

 @throws PreparationRootError when native metadata fields or local relations differ

 @example
 ```ts
 const metadata = readParentFields({ field, path });
 ```
 */
function readParentFields({
  field,
  path,
}: {
  readonly field: ParentField;
  readonly path: string;
}): PreparationRootPopulationParent {
  /**
   Every represented metadata field passes its own decoder before relation checking.
   */
  const parent: PreparationRootPopulationParent = {
    id: preparationInputString(field('id')),
    entryId: preparationInputEntryId(field('entryId')),
    pairIndex: preparationInputInteger(field('pairIndex')),
    sourceSectionIndex: preparationInputInteger(field('sourceSectionIndex')),
    targetSectionIndex: preparationInputInteger(field('targetSectionIndex')),
    source: preparationInputParentSide(field('source')),
    target: preparationInputParentSide(field('target')),
    originalProtection: preparationInputProtection(field('originalProtection')),
  };
  verifyPreparationInputParentRelations({
    parent,
    path,
  });
  return Object.freeze(parent);
}

/**
 Reads population accounting without accepting selected-parent prose or inventing missing text.

 @internal

 @param value - invocation-owned parsed population row

 @param path - authored population position

 @returns Frozen complete population metadata in native field order

 @throws PreparationRootError when population fields or local relations differ

 @example
 ```ts
 const parent = preparationInputPopulationParent({ value, path });
 ```
 */
export function preparationInputPopulationParent({
  value,
  path,
}: PreparationInputField): PreparationRootPopulationParent {
  /**
   Population rows cannot smuggle complete-parent text or its historical index alias.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: PARENT_KEYS,
  });
  return readParentFields({
    field,
    path,
  });
}

/**
 Reads a complete selected parent and verifies only its actually represented side and node texts.

 @internal

 @param value - invocation-owned parsed selected parent

 @param path - authored selected-parent position

 @returns Frozen complete parent without collapsing side indexes into combined pair position

 @throws PreparationRootError when fields, index alias, text identities or local relations differ

 @example
 ```ts
 const parent = preparationInputParent({ value, path });
 ```
 */
export function preparationInputParent({
  value,
  path,
}: PreparationInputField): PreparationRootParent {
  /**
   Complete-parent prose is required here but forbidden by the population reader.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      ...PARENT_KEYS,
      'index',
      'sourceText',
      'incumbentText',
    ],
  });
  /**
   Shared metadata already carries checked identity and target-local protection relations.
   */
  const metadata = readParentFields({
    field,
    path,
  });
  /**
   The historical index alias names the source section, not the combined pair position.
   */
  const index = preparationInputInteger(field('index'));
  if (index !== metadata.sourceSectionIndex)
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.index`,
    });
  /**
   Empty source parents remain exact represented empty strings.
   */
  const sourceText = preparationInputString(field('sourceText'));
  /**
   Empty incumbent parents retain native insertion or structural semantics.
   */
  const incumbentText = preparationInputString(field('incumbentText'));
  verifyPreparationInputParentText({
    side: metadata.source,
    text: sourceText,
    path: `${path}.source`,
  });
  verifyPreparationInputParentText({
    side: metadata.target,
    text: incumbentText,
    path: `${path}.target`,
  });
  return Object.freeze({
    id: metadata.id,
    entryId: metadata.entryId,
    index,
    pairIndex: metadata.pairIndex,
    sourceSectionIndex: metadata.sourceSectionIndex,
    targetSectionIndex: metadata.targetSectionIndex,
    sourceText,
    incumbentText,
    source: metadata.source,
    target: metadata.target,
    originalProtection: metadata.originalProtection,
  });
}

//endregion Population metadata and selected parent prose stay separate serialized families
