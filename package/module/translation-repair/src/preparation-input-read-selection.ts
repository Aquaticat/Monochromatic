import { PreparationRootError, } from './preparation-root-error.ts';
import { preparationInputEntryId, } from './preparation-input-read-identity.ts';
import type {
  FrozenPreparationObligation,
  FrozenPreparationParent,
  FrozenPreparationReference,
  FrozenPreparationSelection,
} from './preparation-selection-model.ts';
import {
  preparationInputBoolean,
  preparationInputDigest,
  preparationInputFields,
  preparationInputInteger,
  preparationInputItems,
  preparationInputNonblankString,
  preparationInputString,
  type PreparationInputField,
} from './preparation-input-read-value.ts';

//region Frozen selection projection, never original-artifact verification

/**
 Decodes explicit parent coordinates without substituting an identity from another collection.

 @internal

 @param value - owned parsed parent identity

 @param path - authored position within the persisted selection

 @returns Fresh parent identity with matching canonical coordinates

 @throws PreparationRootError when shape or identity correspondence differs

 @example
 ```ts
 const parent = preparationInputSelectionParent({ value, path });
 ```
 */
export function preparationInputSelectionParent({
  value,
  path,
}: PreparationInputField): FrozenPreparationParent {
  /**
   Parent identities retain every field in the producer's projection.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'parentId',
      'entryId',
      'sourceIndex',
      'targetIndex',
    ],
  });
  /**
   Primitive validation precedes canonical identity comparison.
   */
  const parent: FrozenPreparationParent = {
    parentId: preparationInputString(field('parentId')),
    entryId: preparationInputEntryId(field('entryId')),
    sourceIndex: preparationInputInteger(field('sourceIndex')),
    targetIndex: preparationInputInteger(field('targetIndex')),
  };
  if (parent.parentId !== `${parent.entryId}/source-section/${String(parent.sourceIndex)}/target-section/${String(parent.targetIndex)}`)
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(parent);
}

/**
 Preserves reference locators as data without opening or interpreting their contents.

 @internal

 @param value - owned parsed reference identity

 @param path - authored position within the persisted selection

 @returns Frozen locator and digest with no byte-match or semantic approval

 @throws PreparationRootError when reference shape differs

 @example
 ```ts
 const reference = preparationInputSelectionReference({ value, path });
 ```
 */
export function preparationInputSelectionReference({
  value,
  path,
}: PreparationInputField): FrozenPreparationReference {
  /**
   Original locators do not become file reads through decoding.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'path',
      'hash',
    ],
  });
  return Object.freeze({
    path: preparationInputNonblankString(field('path')),
    hash: preparationInputDigest({
      ...field('hash'),
      algorithm: 'sha256',
    }),
  });
}

/**
 Keeps source-reading obligations distinct from authority to create another invocation.

 @internal

 @param value - owned parsed source obligation

 @param path - authored position within its evidence collection

 @returns Explicit original context and unresolved flags

 @throws PreparationRootError when obligation shape differs

 @example
 ```ts
 const obligation = preparationInputObligation({ value, path });
 ```
 */
export function preparationInputObligation({
  value,
  path,
}: PreparationInputField): FrozenPreparationObligation {
  /**
   Every flag remains explicit even when false or the context array is empty.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'parentId',
      'requiredContext',
      'pictureEvidenceNeeded',
      'scopeQualificationOpen',
    ],
  });
  return Object.freeze({
    parentId: preparationInputNonblankString(field('parentId')),
    requiredContext: preparationInputItems({
      ...field('requiredContext'),
      read: preparationInputNonblankString,
    }),
    pictureEvidenceNeeded: preparationInputBoolean(field('pictureEvidenceNeeded')),
    scopeQualificationOpen: preparationInputBoolean(field('scopeQualificationOpen')),
  });
}

/**
 Reads the complete frozen-selection projection, not the omitted original selection artifact.
 Current-plan census and independent original-byte verification remain owning-plan checks.

 @internal

 @param value - owned parsed selection projection

 @param path - authored position within the complete input DTO

 @returns Frozen typed projection without review or acquisition authority

 @throws PreparationRootError when scope, fields or primitive domains differ

 @example
 ```ts
 const selection = preparationInputSelection({ value, path });
 ```
 */
export function preparationInputSelection({
  value,
  path,
}: PreparationInputField): FrozenPreparationSelection {
  /**
   The projection is unversioned and admits no fabricated extra metadata.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'scope',
      'digest',
      'bytes',
      'corpusCommitSha',
      'populationDigest',
      'poolDigest',
      'parents',
      'references',
      'obligations',
      'selectionRuntimeDigest',
      'samplerNodeVersion',
      'samplerIcuVersion',
    ],
  });
  if (preparationInputString(field('scope')) !== 'frozen-selection-identity')
    throw new PreparationRootError({
      kind: 'input-shape',
      input: path,
    });
  /**
   Typed construction does not infer any unprojected original selection fields.
   */
  const selection: FrozenPreparationSelection = {
    scope: 'frozen-selection-identity',
    digest: preparationInputDigest({
      ...field('digest'),
      algorithm: 'sha256',
    }),
    bytes: preparationInputInteger(field('bytes')),
    corpusCommitSha: preparationInputDigest({
      ...field('corpusCommitSha'),
      algorithm: 'sha1',
    }),
    populationDigest: preparationInputDigest({
      ...field('populationDigest'),
      algorithm: 'sha256',
    }),
    poolDigest: preparationInputDigest({
      ...field('poolDigest'),
      algorithm: 'sha256',
    }),
    parents: preparationInputItems({
      ...field('parents'),
      read: preparationInputSelectionParent,
    }),
    references: preparationInputItems({
      ...field('references'),
      read: preparationInputSelectionReference,
    }),
    obligations: preparationInputItems({
      ...field('obligations'),
      read: preparationInputObligation,
    }),
    selectionRuntimeDigest: preparationInputDigest({
      ...field('selectionRuntimeDigest'),
      algorithm: 'sha256',
    }),
    samplerNodeVersion: preparationInputNonblankString(field('samplerNodeVersion')),
    samplerIcuVersion: preparationInputNonblankString(field('samplerIcuVersion')),
  };
  /**
   Collection relationships use one decoded selection, never caller-owned collections.
   */
  const {
    parents,
    references,
    obligations,
  } = selection;
  /**
   Parent order remains the obligation domain even when no current-plan census is imposed here.
   */
  const parentIds = parents.map(function identity(parent): string {
    return parent.parentId;
  });
  /**
   Distinct locators may share content, but the same locator cannot occur twice in the projection.
   */
  const referencePaths = references.map(function locator(reference): string {
    return reference.path;
  });
  if ((selection.bytes === 0)
    || (new Set(parentIds).size !== parentIds.length)
    || (new Set(referencePaths).size !== referencePaths.length)
    || (obligations.length !== parentIds.length)
    || (!obligations.every(function matches(
      obligation,
      index,
    ): boolean {
      return obligation.parentId === parentIds[index];
    })))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(selection);
}

//endregion Frozen selection projection, never original-artifact verification
