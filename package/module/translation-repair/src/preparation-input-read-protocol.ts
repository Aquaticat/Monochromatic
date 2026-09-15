import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  blockPairingProtocol,
  type BlockPairingProtocol,
} from './block-pairing-protocol.ts';
import type { NumberedBlock, } from './pair-blocks-wire.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import {
  preparationInputArray,
  preparationInputObject,
  preparationInputRecord,
  type PreparationInputField,
} from './preparation-input-read-value.ts';

//region Compare actual native protocol values without interpreting JSON Schema

/**
 One position in the supplied JSON and freshly generated native protocol.
 Expected structure comes only from the production constructor, never from caller-supplied schema.
 */
type ProtocolComparison = {
  /**
   Current invocation-owned parsed candidate.
   */
  readonly value: unknown;
  /**
   Corresponding value owned by the fresh native protocol.
   */
  readonly expected: unknown;
  /**
   Authored protocol position, extended only by native keys or array indexes.
   */
  readonly path: string;
};

/**
 Compares every supplied protocol field with the actual constructor's output and freezes that owned output.
 This is literal-value comparison, not a second message builder or a JSON Schema interpreter.
 The candidate is invocation-owned parsed JSON, not a foreign object-capability interface.

 @internal

 @param value - owned parsed protocol candidate

 @param path - authored question-protocol position

 @param sourceBlocks - already decoded current original numbering and text

 @param targetBlocks - already decoded current incumbent numbering and text

 @returns Deeply frozen factory-owned protocol with no supplied object aliases

 @throws PreparationRootError when shape or any native protocol value differs

 @example
 ```ts
 const protocol = preparationInputProtocol({ value, path, sourceBlocks, targetBlocks });
 ```
 */
export function preparationInputProtocol({
  value,
  path,
  sourceBlocks,
  targetBlocks,
}: PreparationInputField & {
  readonly sourceBlocks: readonly NumberedBlock[];
  readonly targetBlocks: readonly NumberedBlock[];
}): BlockPairingProtocol {
  /**
   Native production remains the sole owner of messages, fences and response schema.
   */
  const protocol = blockPairingProtocol({
    sourceBlocks,
    targetBlocks,
  });
  /**
   Iterative traversal follows the constructor's structure and never descends into prose strings.
   */
  const pending: ProtocolComparison[] = [{
    value,
    expected: protocol,
    path,
  }];
  while (pending.length > 0) {
    /**
     Work positions contain no caller-supplied field names or executable declarations.
     */
    const {
      value: actual,
      expected,
      path: position,
    } = nonNullishOrThrow(pending.pop());
    if ((expected === null) || ((typeof expected) !== 'object')) {
      if (!Object.is(
        actual,
        expected,
      ))
        throw new PreparationRootError({
          kind: 'input-relations',
          input: position,
        });
      continue;
    }
    if (Array.isArray(expected)) {
      /**
       Arrays must retain native extent and own-key inventory, including dense positions.
       */
      const items = preparationInputArray({
        value: actual,
        path: position,
      });
      /**
       Typed unknown elements avoid inheriting Array.isArray's broad element type.
       */
      const expectedItems = preparationInputArray({
        value: expected,
        path: position,
      });
      /**
       The native array owns only positional keys and its length property.
       */
      const expectedArrayKeys = Reflect.ownKeys(expectedItems);
      /**
       Extra, symbolic or absent candidate positions cannot disappear during comparison.
       */
      const actualKeys = Reflect.ownKeys(items);
      if ((Object.getPrototypeOf(items) !== Object.getPrototypeOf(expectedItems))
        || (items.length !== expectedItems.length)
        || (expectedArrayKeys.length !== actualKeys.length)
        || (!expectedArrayKeys.every(function present(key): boolean {
          return actualKeys.includes(key);
        })))
        throw new PreparationRootError({
          kind: 'input-shape',
          input: position,
        });
      for (const [index, item] of expectedItems.entries()) {
        pending.push({
          value: items[index],
          expected: item,
          path: `${position}[${String(index)}]`,
        });
      }
      Object.freeze(expectedItems);
      continue;
    }
    /**
     Native object fields are checked without interpreting their JSON Schema meanings.
     */
    const expectedRecord = preparationInputObject({
      value: expected,
      path: position,
    });
    /**
     The actual native protocol uses enumerable string fields that survive serialization.
     */
    const keys = Object.keys(expectedRecord);
    /**
     Native non-enumerable or symbolic fields would not survive the persisted JSON contract.
     */
    const ownKeys = Reflect.ownKeys(expectedRecord);
    if (ownKeys.length !== keys.length)
      throw new PreparationRootError({
        kind: 'input-relations',
        input: position,
      });
    /**
     Unknown JSON cannot carry an unchecked response-schema or message subtree.
     */
    const record = preparationInputRecord({
      value: actual,
      path: position,
      keys,
    });
    for (const key of keys) {
      pending.push({
        value: record[key],
        expected: expectedRecord[key],
        path: `${position}.${key}`,
      });
    }
    Object.freeze(expectedRecord);
  }
  return Object.freeze(protocol);
}

//endregion Compare actual native protocol values without interpreting JSON Schema
