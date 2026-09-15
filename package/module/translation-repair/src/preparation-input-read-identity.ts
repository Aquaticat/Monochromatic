import { validParentEntry, } from './preparation-selection-records.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import {
  preparationInputDigest,
  preparationInputNonblankString,
  type PreparationInputField,
} from './preparation-input-read-value.ts';

//region Corpus identity components remain data

/**
 Applies the existing entry-component grammar without turning a name into a filesystem request.

 @internal

 @param value - owned parsed entry identity

 @param path - authored schema position for the affected input

 @returns Original component without traversal, separators or control characters

 @throws PreparationRootError when the entry-component grammar differs

 @example
 ```ts
 const entryId = preparationInputEntryId({ value, path });
 ```
 */
export function preparationInputEntryId({
  value,
  path,
}: PreparationInputField): string {
  /**
   The shared grammar checks controls and edge whitespace; this field additionally excludes slash separators.
   */
  const entryId = preparationInputNonblankString({
    value,
    path,
  });
  if ((!validParentEntry(entryId)) || entryId.includes('/'))
    throw new PreparationRootError({
      kind: 'input-shape',
      input: path,
    });
  return entryId;
}

/**
 Historical implementation identities use the original frozen-selection tree-digest grammar.
 */
const TREE_DIGEST_PREFIX = 'sha256-tree-v1:';

/**
 Preserves the tagged historical tree identity instead of accepting a bare artifact digest.

 @internal

 @param value - owned parsed historical implementation identity

 @param path - authored schema position for the affected input

 @returns Unmodified tagged identity with a checked SHA-256 suffix

 @throws PreparationRootError when prefix or suffix grammar differs

 @example
 ```ts
 const digest = preparationInputTreeDigest({ value, path });
 ```
 */
export function preparationInputTreeDigest({
  value,
  path,
}: PreparationInputField): string {
  /**
   The algorithm tag remains part of the persisted identity rather than being normalized away.
   */
  const text = preparationInputNonblankString({
    value,
    path,
  });
  if (!text.startsWith(TREE_DIGEST_PREFIX))
    throw new PreparationRootError({
      kind: 'input-shape',
      input: path,
    });
  preparationInputDigest({
    value: text.slice(TREE_DIGEST_PREFIX.length),
    path,
    algorithm: 'sha256',
  });
  return text;
}

//endregion Corpus identity components remain data
