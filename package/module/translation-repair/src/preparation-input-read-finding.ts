import type { AlignmentAttachment, AlignmentFinding, } from './chunk-document.ts';
import type { ParseFinding, } from './parse-document.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import {
  preparationInputFields,
  preparationInputInteger,
  preparationInputLiteral,
  preparationInputObject,
  preparationInputProperty,
  preparationInputString,
  type PreparationInputField,
} from './preparation-input-read-value.ts';

//region Findings remain observations rather than acquisition or repair authority

/**
 Preserves parser observations without parsing documents again or promoting detail text to authority.

 @internal

 @param value - owned parsed parser observation

 @param path - authored position within source or target findings

 @returns Frozen known finding class, interval and unchanged detail

 @throws PreparationRootError when finding shape or interval order differs

 @example
 ```ts
 const finding = preparationInputParseFinding({ value, path });
 ```
 */
export function preparationInputParseFinding({
  value,
  path,
}: PreparationInputField): ParseFinding {
  /**
   All currently emitted finding fields are mandatory.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'kind',
      'startOffset',
      'endOffset',
      'detail',
    ],
  });
  /**
   Unknown classes cannot acquire an existing class's interpretation.
   */
  const finding: ParseFinding = {
    kind: preparationInputLiteral({
      ...field('kind'),
      choices: [
        'html-comment-skipped',
        'unterminated-html-comment',
        'invisible-line-masked',
        'mdx-downgraded',
      ],
    }),
    startOffset: preparationInputInteger(field('startOffset')),
    endOffset: preparationInputInteger(field('endOffset')),
    detail: preparationInputString(field('detail')),
  };
  if (finding.endOffset < finding.startOffset)
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(finding);
}

/**
 Retains the aligner's separate whole-document, source-section and target-section domains.

 @internal

 @param value - owned parsed attachment

 @param path - authored attachment position within an alignment finding

 @returns Frozen attachment without translating section indexes into pair indexes

 @throws PreparationRootError when variant, keys or index domain differs

 @example
 ```ts
 const attachedTo = preparationInputAlignmentAttachment({ value, path });
 ```
 */
export function preparationInputAlignmentAttachment({
  value,
  path,
}: PreparationInputField): AlignmentAttachment {
  /**
   Object shape is checked before consulting its discriminant.
   */
  const record = preparationInputObject({
    value,
    path,
  });
  /**
   A supported discriminant selects the exact key inventory, not an unchecked cast.
   */
  const kind = preparationInputLiteral({
    ...preparationInputProperty({
      value: record,
      key: 'kind',
      path,
    }),
    choices: [
      'whole-document',
      'source-section',
      'target-section',
    ],
  });
  /**
   Whole-document observations cannot secretly carry a section index.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: kind === 'whole-document' ? ['kind'] : [
      'kind',
      'index',
    ],
  });
  if (kind === 'whole-document')
    return Object.freeze({ kind, });
  return Object.freeze({
    kind,
    index: preparationInputInteger(field('index')),
  });
}

/**
 Reads current deterministic alignment observations without activating section pairing.

 @internal

 @param value - owned parsed alignment observation

 @param path - authored alignment-finding position

 @returns Frozen supported observation and independent attachment domain

 @throws PreparationRootError when fields or attachment grammar differ

 @example
 ```ts
 const finding = preparationInputAlignmentFinding({ value, path });
 ```
 */
export function preparationInputAlignmentFinding({
  value,
  path,
}: PreparationInputField): AlignmentFinding {
  /**
   Retired finding classes are not admitted through their prose interpretation.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'kind',
      'attachedTo',
      'detail',
    ],
  });
  return Object.freeze({
    kind: preparationInputLiteral({
      ...field('kind'),
      choices: ['structure-mismatch'],
    }),
    attachedTo: preparationInputAlignmentAttachment(field('attachedTo')),
    detail: preparationInputString(field('detail')),
  });
}

//endregion Findings remain observations rather than acquisition or repair authority
