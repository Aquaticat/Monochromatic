import type {
  PreparationRootReference,
  PreparationRootReferenceBinding,
} from './preparation-root-reference-model.ts';
import type { PreparationRootRawDocument, } from './preparation-root-population-model.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import {
  preparationInputDigest,
  preparationInputFields,
  preparationInputInteger,
  preparationInputItems,
  preparationInputLiteral,
  preparationInputNonblankString,
  type PreparationInputField,
} from './preparation-input-read-value.ts';

//region Reference attribution and omitted-body identities

/**
 Reads one explicit reference role without granting execution or model authority.

 @internal

 @param value - owned parsed attribution record

 @param path - authored schema position of this binding

 @returns Frozen role and consumer identity, with selection-only roles kept on selection

 @throws PreparationRootError when fields or role attribution differ

 @example
 ```ts
 const binding = preparationInputReferenceBinding({ value, path });
 ```
 */
export function preparationInputReferenceBinding({
  value,
  path,
}: PreparationInputField): PreparationRootReferenceBinding {
  /**
   Unknown attribution fields cannot add authority to a reference.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'role',
      'consumer',
    ],
  });
  /**
   Every supported role comes from the producer's explicit vocabulary.
   */
  const binding: PreparationRootReferenceBinding = {
    role: preparationInputLiteral({
      ...field('role'),
      choices: [
        'policy-pool',
        'reading-journal',
        'prior-reading-journal',
        'complete-entry-reading-frame',
        'reading-note',
        'opaque-selection-support',
      ],
    }),
    consumer: preparationInputNonblankString(field('consumer')),
  };
  if ((binding.role !== 'complete-entry-reading-frame')
    && (binding.role !== 'reading-note')
    && (binding.consumer !== 'selection'))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(binding);
}

/**
 Keeps complete reference attribution as evidence data without opening the original locator.

 @internal

 @param value - owned parsed reference record

 @param path - authored schema position of this reference

 @returns Frozen reference and distinct ordered attribution records

 @throws PreparationRootError when fields, empty attribution or duplicate bindings differ

 @example
 ```ts
 const reference = preparationInputReference({ value, path });
 ```
 */
export function preparationInputReference({
  value,
  path,
}: PreparationInputField): PreparationRootReference {
  /**
   Raw byte extent remains distinct from the recorded text digest.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'path',
      'hash',
      'bytes',
      'bindings',
    ],
  });
  /**
   Binding pairs retain their boundaries rather than using an ambiguous delimiter key.
   */
  const bindings = preparationInputItems({
    ...field('bindings'),
    read: preparationInputReferenceBinding,
  });
  /**
   Native attribution de-duplicates exact role/consumer pairs before persistence.
   */
  const identities = bindings.map(function identity(binding): string {
    return JSON.stringify([
      binding.role,
      binding.consumer,
    ]);
  });
  if ((bindings.length === 0) || (new Set(identities).size !== bindings.length))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze({
    path: preparationInputNonblankString(field('path')),
    hash: preparationInputDigest({
      ...field('hash'),
      algorithm: 'sha256',
    }),
    bytes: preparationInputInteger(field('bytes')),
    bindings,
  });
}

/**
 Reads only the raw/effective identity evidence the DTO actually carries.
 No missing corpus bytes are reconstructed or read through the retained locator.

 @internal

 @param value - owned parsed document identity

 @param path - authored schema position of this raw-document record

 @returns Frozen extent, hashes and explicit CRLF-folding count

 @throws PreparationRootError when identity fields, folding extent or zero-folding consistency differ

 @example
 ```ts
 const raw = preparationInputRawDocument({ value, path });
 ```
 */
export function preparationInputRawDocument({
  value,
  path,
}: PreparationInputField): PreparationRootRawDocument {
  /**
   All raw/effective identity channels remain separately represented.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'relPath',
      'bytes',
      'rawHash',
      'decodedHash',
      'effectiveHash',
      'foldedCrLf',
    ],
  });
  /**
   Typed fields do not claim that omitted raw bytes have been recovered.
   */
  const raw: PreparationRootRawDocument = {
    relPath: preparationInputNonblankString(field('relPath')),
    bytes: preparationInputInteger(field('bytes')),
    rawHash: preparationInputDigest({
      ...field('rawHash'),
      algorithm: 'sha256',
    }),
    decodedHash: preparationInputDigest({
      ...field('decodedHash'),
      algorithm: 'sha256',
    }),
    effectiveHash: preparationInputDigest({
      ...field('effectiveHash'),
      algorithm: 'sha256',
    }),
    foldedCrLf: preparationInputInteger(field('foldedCrLf')),
  };
  if (raw.foldedCrLf > (raw.bytes / 2))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  if ((raw.foldedCrLf === 0) && (raw.decodedHash !== raw.effectiveHash))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(raw);
}

//endregion Reference attribution and omitted-body identities
