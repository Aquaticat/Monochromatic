import type { PreparationRootExclusion, } from './preparation-root-reference-model.ts';
import { preparationInputEntryId, } from './preparation-input-read-identity.ts';
import {
  preparationInputDigest,
  preparationInputFields,
  preparationInputLiteral,
  preparationInputObject,
  preparationInputProperty,
  type PreparationInputField,
} from './preparation-input-read-value.ts';

//region Existing eligibility exclusions, not new plan choices

/**
 Decodes each existing exclusion shape without treating a missing side as an original-English declaration.

 @internal

 @param value - owned parsed exclusion candidate

 @param path - authored schema position within the exclusion inventory

 @returns Frozen existing policy evidence without reclassifying entry eligibility

 @throws PreparationRootError when discriminant or complete field inventory differs

 @example
 ```ts
 const excluded = preparationInputExclusion({ value, path });
 ```
 */
export function preparationInputExclusion({
  value,
  path,
}: PreparationInputField): PreparationRootExclusion {
  /**
   Object shape is established before its discriminant selects the complete supported keys.
   */
  const object = preparationInputObject({
    value,
    path,
  });
  /**
   These literals name observations already made by the native eligibility owner.
   */
  const kind = preparationInputLiteral({
    ...preparationInputProperty({
      value: object,
      path,
      key: 'kind',
    }),
    choices: [
      'missing-corpus-side',
      'production-whole-page-original',
      'normalized-whole-page-original',
    ],
  });
  if (kind === 'missing-corpus-side') {
    /**
     Absence does not acquire archive-hash or declaration evidence fields.
     */
    const field = preparationInputFields({
      value: object,
      path,
      keys: [
        'entryId',
        'kind',
      ],
    });
    return Object.freeze({
      kind,
      entryId: preparationInputEntryId(field('entryId')),
    });
  }
  if (kind === 'production-whole-page-original') {
    /**
     The inherited declaration does not invent a normalized target identity.
     */
    const field = preparationInputFields({
      value: object,
      path,
      keys: [
        'entryId',
        'kind',
        'archiveHash',
        'noteHash',
      ],
    });
    return Object.freeze({
      kind,
      entryId: preparationInputEntryId(field('entryId')),
      archiveHash: preparationInputDigest({
        ...field('archiveHash'),
        algorithm: 'sha256',
      }),
      noteHash: preparationInputDigest({
        ...field('noteHash'),
        algorithm: 'sha256',
      }),
    });
  }
  /**
   The narrowed normalized declaration retains both archive and normalized target identities.
   */
  const field = preparationInputFields({
    value: object,
    path,
    keys: [
      'entryId',
      'kind',
      'archiveHash',
      'targetHash',
      'noteHash',
    ],
  });
  return Object.freeze({
    kind,
    entryId: preparationInputEntryId(field('entryId')),
    archiveHash: preparationInputDigest({
      ...field('archiveHash'),
      algorithm: 'sha256',
    }),
    targetHash: preparationInputDigest({
      ...field('targetHash'),
      algorithm: 'sha256',
    }),
    noteHash: preparationInputDigest({
      ...field('noteHash'),
      algorithm: 'sha256',
    }),
  });
}

//endregion Existing eligibility exclusions, not new plan choices
