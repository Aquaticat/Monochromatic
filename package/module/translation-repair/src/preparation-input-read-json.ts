import { createHash, } from 'node:crypto';
import { isUint8Array, } from 'node:util/types';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { PreparationRootError, } from './preparation-root-error.ts';

//region Owned compact JSON before complete DTO interpretation

/**
 Invocation-local parsed bytes remain unknown until every DTO field is decoded.
 Neither observed identity nor this type grants review or admission.

 @internal

 @example
 ```ts
 const parsed = preparationInputJson(content);
 ```
 */
export type PreparationInputJson = {
  /**
   Newly parsed native JSON, not a caller-owned object or typed certificate.
   */
  readonly value: unknown;
  /**
   Extent and SHA-256 describe the same copied bytes that were parsed.
   */
  readonly identity: {
    readonly bytes: number;
    readonly sha256: string;
  };
};

/**
 Copies genuine byte views without observing their own state or iterator overrides.
 The authorized I/O owner must bound input allocation before calling this helper.

 @internal

 @param content - borrowed file bytes, never an object claiming a prior byte match

 @returns Owned bytes isolated from later caller mutation

 @throws PreparationRootError when the native byte view cannot be copied

 @example
 ```ts
 const owned = preparationInputBytes(content);
 ```
 */
export function preparationInputBytes(content: ForeignBorrowed<Uint8Array>): Uint8Array<ArrayBuffer> {
  if (!isUint8Array(content))
    throw new PreparationRootError({ kind: 'input-bytes' });
  try {
    return new Uint8Array(content);
  }
  catch (error) {
    // Native-copy failures never retain caller-selected exception metadata.
    void error;
    throw new PreparationRootError({ kind: 'input-bytes' });
  }
}

/**
 Decodes only the new private byte view without accepting replacement characters.

 @param content - owned bytes already copied from the foreign view

 @returns Exact text supplied to the native JSON parser

 @throws PreparationRootError when UTF-8 decoding fails

 @example
 ```ts
 const text = preparationInputText(owned);
 ```
 */
function preparationInputText(content: Uint8Array<ArrayBuffer>): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(content);
  }
  catch (error) {
    // Input text and thrown metadata must not enter the refusal.
    void error;
    throw new PreparationRootError({ kind: 'input-bytes' });
  }
}

/**
 Rejects non-native spelling without exporting parser excerpts or partially decoded values.

 @param text - decoded content of the owned byte snapshot

 @param content - original copied bytes whose spelling must match native JSON output

 @returns Unknown JSON awaiting complete DTO interpretation

 @throws PreparationRootError when native compact JSON cannot be read

 @example
 ```ts
 const value = preparationInputValue({ text, content: owned });
 ```
 */
function preparationInputValue({ text, content }: {
  readonly text: string;
  readonly content: Uint8Array<ArrayBuffer>;
}): unknown {
  try {
    /**
     No parsed property becomes typed evidence through JSON parsing alone.
     */
    const value: unknown = JSON.parse(text);
    /**
     Byte equality also rejects a removed UTF-8 BOM without relying on decoded-string equality.
     */
    const serialized = JSON.stringify(value);
    if ((typeof serialized === 'string') && Buffer.from(serialized, 'utf8').equals(content))
      return value;
  }
  catch (error) {
    // Class identity never authenticates a native or foreign parser exception.
    void error;
    throw new PreparationRootError({ kind: 'input-json' });
  }
  throw new PreparationRootError({ kind: 'input-json' });
}

/**
 Checks the exact compact JSON grammar emitted by the fixed Task47 writer.
 Re-serialization detects duplicate keys and non-native whitespace/escape spellings before schema decoding.
 Complete DTO validation remains the subsequent owner; valid JSON alone supplies no typed input evidence.

 @internal

 @param content - size-bounded retained bytes copied before decoding or hashing

 @returns Owned unknown JSON and its point-in-time raw-byte identity

 @throws PreparationRootError when UTF-8 or native compact JSON cannot be read

 @example
 ```ts
 const parsed = preparationInputJson(content);
 const record = preparationInputRecord(parsed.value);
 ```
 */
export function preparationInputJson(content: ForeignBorrowed<Uint8Array>): PreparationInputJson {
  /**
   Only this new byte view reaches native decoding and identity computation.
   */
  const owned = preparationInputBytes(content);
  /**
   Decoder failures are distinguished without retaining native excerpts or causes.
   */
  const text = preparationInputText(owned);
  /**
   Parsing remains untyped and accepts no alternate serialized spelling.
   */
  const value = preparationInputValue({ text, content: owned });
  return {
    value,
    identity: Object.freeze({
      bytes: owned.byteLength,
      sha256: createHash('sha256').update(owned).digest('hex'),
    }),
  };
}

//endregion Owned compact JSON before complete DTO interpretation
