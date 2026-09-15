import { verifyPreparationInputEntryRelations, } from './preparation-input-read-entry-relations.ts';
import {
  preparationInputAlignmentFinding,
  preparationInputParseFinding,
} from './preparation-input-read-finding.ts';
import { preparationInputEntryId, } from './preparation-input-read-identity.ts';
import {
  preparationInputArchiveLine,
  preparationInputOriginalPolicy,
} from './preparation-input-read-policy.ts';
import type { PreparationRootEntry, } from './preparation-root-population-model.ts';
import {
  preparationInputDigest,
  preparationInputFields,
  preparationInputItems,
  preparationInputString,
  type PreparationInputField,
} from './preparation-input-read-value.ts';

//region Complete represented entry reconstruction without external acquisition

/**
 Decodes every complete-entry field before checking relations supported by its represented texts.
 No corpus locator is opened and no parser, provider or policy classifier is invoked.

 @internal

 @param value - invocation-owned parsed complete-entry candidate

 @param path - authored complete-entry position within root inputs

 @returns Frozen rebuilt entry with unchanged texts and independently retained evidence roles

 @throws PreparationRootError when any entry field or local relation differs

 @example
 ```ts
 const entry = preparationInputEntry({ value, path });
 ```
 */
export function preparationInputEntry({
  value,
  path,
}: PreparationInputField): PreparationRootEntry {
  /**
   A closed inventory prevents unvalidated evidence subtrees from passing through the reader.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'entryId',
      'sourceText',
      'archiveText',
      'targetText',
      'sourceHash',
      'archiveHash',
      'targetHash',
      'originalPolicy',
      'archiveLines',
      'sourceFindings',
      'targetFindings',
      'alignmentFindings',
    ],
  });
  /**
   Explicit reconstruction cannot assign an unchecked JSON subtree to a native DTO type.
   */
  const entry: PreparationRootEntry = {
    entryId: preparationInputEntryId(field('entryId')),
    sourceText: preparationInputString(field('sourceText')),
    archiveText: preparationInputString(field('archiveText')),
    targetText: preparationInputString(field('targetText')),
    sourceHash: preparationInputDigest({
      ...field('sourceHash'),
      algorithm: 'sha256',
    }),
    archiveHash: preparationInputDigest({
      ...field('archiveHash'),
      algorithm: 'sha256',
    }),
    targetHash: preparationInputDigest({
      ...field('targetHash'),
      algorithm: 'sha256',
    }),
    originalPolicy: preparationInputOriginalPolicy(field('originalPolicy')),
    archiveLines: preparationInputItems({
      ...field('archiveLines'),
      read: preparationInputArchiveLine,
    }),
    sourceFindings: preparationInputItems({
      ...field('sourceFindings'),
      read: preparationInputParseFinding,
    }),
    targetFindings: preparationInputItems({
      ...field('targetFindings'),
      read: preparationInputParseFinding,
    }),
    alignmentFindings: preparationInputItems({
      ...field('alignmentFindings'),
      read: preparationInputAlignmentFinding,
    }),
  };
  verifyPreparationInputEntryRelations({
    entry,
    path,
  });
  return Object.freeze(entry);
}

//endregion Complete represented entry reconstruction without external acquisition
