import type { NumberedBlock, } from './pair-blocks-wire.ts';
import { preparationInputProtocol, } from './preparation-input-read-protocol.ts';
import {
  preparationInputFields,
  preparationInputInteger,
  preparationInputItems,
  preparationInputString,
  type PreparationInputField,
} from './preparation-input-read-value.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type { PreparationReceiptQuestion, } from './preparation-receipt-model.ts';

//region Native numbered question data without acquisition or interpretation products

/**
 Decodes one exact numbered block without normalizing text or borrowing document-node identity.

 @internal

 @param value - invocation-owned parsed numbered block

 @param path - authored source or target block position

 @returns Frozen nonnegative local index and unchanged text

 @throws PreparationRootError when block fields or primitive domains differ

 @example
 ```ts
 const block = preparationInputNumberedBlock({ value, path });
 ```
 */
export function preparationInputNumberedBlock({
  value,
  path,
}: PreparationInputField): NumberedBlock {
  /**
   Indexes and prose remain distinct fields rather than a parsed listing string.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'index',
      'text',
    ],
  });
  return Object.freeze({
    index: preparationInputInteger(field('index')),
    text: preparationInputString(field('text')),
  });
}

/**
 Preserves complete native zero-based numbering in the represented array order.
 Empty sides and empty block text remain representable; dispatch is checked by the registration owner.

 @internal

 @param value - invocation-owned parsed numbered side

 @param path - authored numbered-side position

 @returns Frozen contiguous block array without renumbering supplied values

 @throws PreparationRootError when array shape or index-to-position correspondence differs

 @example
 ```ts
 const sourceBlocks = preparationInputNumberedBlocks({ value, path });
 ```
 */
export function preparationInputNumberedBlocks({
  value,
  path,
}: PreparationInputField): readonly NumberedBlock[] {
  /**
   Individual blocks are rebuilt before their shared numbering relation is checked.
   */
  const blocks = preparationInputItems({
    value,
    path,
    read: preparationInputNumberedBlock,
  });
  if (!blocks.every(function matchesPosition(
    block,
    index,
  ): boolean {
    return block.index === index;
  }))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return blocks;
}

/**
 Reads every receipt-shaped question field using the existing native protocol constructor.
 No outcome, free-order interpretation, cache authority or additional invocation is introduced.

 @internal

 @param value - invocation-owned parsed model-neutral question

 @param path - authored question position in a queried registration

 @returns Deeply frozen reconstructed question in producer field order

 @throws PreparationRootError when question shape, numbering or native protocol differs

 @example
 ```ts
 const question = preparationInputQuestion({ value, path });
 ```
 */
export function preparationInputQuestion({
  value,
  path,
}: PreparationInputField): PreparationReceiptQuestion {
  /**
   Receipt-shaped question data contains neither provider outcomes nor interpretation metadata.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'sourceBlocks',
      'targetBlocks',
      'protocol',
    ],
  });
  /**
   Source positions are local to the complete current parent, not full-document node IDs.
   */
  const sourceBlocks = preparationInputNumberedBlocks(field('sourceBlocks'));
  /**
   Target positions have their own zero-based local domain.
   */
  const targetBlocks = preparationInputNumberedBlocks(field('targetBlocks'));
  return Object.freeze({
    sourceBlocks,
    targetBlocks,
    protocol: preparationInputProtocol({
      ...field('protocol'),
      sourceBlocks,
      targetBlocks,
    }),
  });
}

//endregion Native numbered question data without acquisition or interpretation products
