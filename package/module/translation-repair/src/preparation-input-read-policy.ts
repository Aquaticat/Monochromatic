import type { ArchiveOriginalSpan, } from './archive-original-note.ts';
import type { ArchiveRetainedLine, } from './corpus-run/archive-stub.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type { PreparationRootOriginalPolicy, } from './preparation-root-population-model.ts';
import {
  preparationInputFields,
  preparationInputInteger,
  preparationInputItems,
  preparationInputLiteral,
  preparationInputNonblankString,
  preparationInputString,
  type PreparationInputField,
} from './preparation-input-read-value.ts';

//region Original-language observations and retained archive-line provenance

/**
 These classifications remain producer observations, not model votes or reader decisions.
 */
const ORIGINAL_KINDS = [
  'none',
  'spans',
  'whole-page',
] as const;

/**
 Reads an original-English span without reclassifying its note or reconstructing omitted prose.

 @internal

 @param value - owned parsed protected span

 @param path - authored span position within original-policy evidence

 @returns Frozen interval and unchanged declaration text

 @throws PreparationRootError when span fields or interval order differ

 @example
 ```ts
 const span = preparationInputOriginalSpan({ value, path });
 ```
 */
export function preparationInputOriginalSpan({
  value,
  path,
}: PreparationInputField): ArchiveOriginalSpan {
  /**
   Notes are retained as text rather than interpolated into errors or treated as code.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'startOffset',
      'endOffset',
      'note',
    ],
  });
  /**
   An end-of-document declaration can represent an empty interval.
   */
  const span: ArchiveOriginalSpan = {
    startOffset: preparationInputInteger(field('startOffset')),
    endOffset: preparationInputInteger(field('endOffset')),
    note: preparationInputNonblankString(field('note')),
  };
  if (span.endOffset < span.startOffset)
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(span);
}

/**
 Retains inherited and normalized policy observations as separate roles.
 Eligibility of an entry carrying these observations is checked by the entry decoder.

 @internal

 @param value - owned parsed original-policy projection

 @param path - authored policy position

 @returns Frozen classifications with exactly the normalized span collection

 @throws PreparationRootError when policy fields or normalized span presence differ

 @example
 ```ts
 const policy = preparationInputOriginalPolicy({ value, path });
 ```
 */
export function preparationInputOriginalPolicy({
  value,
  path,
}: PreparationInputField): PreparationRootOriginalPolicy {
  /**
   Normalization does not imply that the inherited classification must equal the new one.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'inherited',
      'normalized',
      'spans',
    ],
  });
  /**
   The producer includes protected spans only for the normalized spans classification.
   */
  const policy: PreparationRootOriginalPolicy = {
    inherited: preparationInputLiteral({
      ...field('inherited'),
      choices: ORIGINAL_KINDS,
    }),
    normalized: preparationInputLiteral({
      ...field('normalized'),
      choices: ORIGINAL_KINDS,
    }),
    spans: preparationInputItems({
      ...field('spans'),
      read: preparationInputOriginalSpan,
    }),
  };
  if ((policy.normalized === 'spans') !== (policy.spans.length > 0))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(policy);
}

/**
 Reads one exact normalized archive line with its original one-based pinned-file position.

 @internal

 @param value - owned parsed retained-line record

 @param path - authored retained-line position

 @returns Frozen line text and positive origin coordinate

 @throws PreparationRootError when fields, line extent or origin domain differ

 @example
 ```ts
 const line = preparationInputArchiveLine({ value, path });
 ```
 */
export function preparationInputArchiveLine({
  value,
  path,
}: PreparationInputField): ArchiveRetainedLine {
  /**
   Empty text is a represented blank line rather than a missing record.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'text',
      'lineNumber',
    ],
  });
  /**
   Native splitting uses LF only, so lone CR and Unicode line separators remain text.
   */
  const line: ArchiveRetainedLine = {
    text: preparationInputString(field('text')),
    lineNumber: preparationInputInteger(field('lineNumber')),
  };
  if ((line.lineNumber === 0) || line.text.includes('\n'))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(line);
}

//endregion Original-language observations and retained archive-line provenance
