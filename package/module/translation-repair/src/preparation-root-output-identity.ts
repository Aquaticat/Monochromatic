import { isProxy, } from 'node:util/types';
import { hashContent, } from './document-node.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type { PreparationRootInputs, } from './preparation-root-reference-model.ts';
import { selectionDigest, } from './preparation-selection-value.ts';

//region Exact reconstruction identity without review authority

/**
 * Independently retained identity of compact UTF-8 unqualified-input JSON.
 * Matching this identity establishes reconstruction parity, never approval.
 *
 * @example
 * ```ts
 * const identity: PreparationRootOutputIdentity = { bytes, sha256 };
 * ```
 */
export type PreparationRootOutputIdentity = {
  /** Exact serialized byte extent, not UTF-16 text length. */
  readonly bytes: number;
  /** Independently retained raw artifact digest, not a self-issued review token. */
  readonly sha256: string;
};

/**
 * Snapshots optional comparison authority before logger callbacks or asynchronous corpus work.
 * Data properties are required so nested accessors cannot redefine either primitive during capture.
 *
 * @param input - native root arguments after process context and independent corpus pin are owned
 *
 * @returns Owned primitive identity, or absence for initial input construction
 *
 * @throws PreparationRootError when supplied identity cannot be safely captured or validated
 *
 * @example
 * ```ts
 * const expected = ownPreparationRootOutputIdentity(input);
 * ```
 */
export function ownPreparationRootOutputIdentity(input: {
  readonly expectedOutput?: PreparationRootOutputIdentity;
},): PreparationRootOutputIdentity | undefined {
  try {
    /** Caller property is read once; subsequent mutations cannot change captured primitives. */
    const value = input.expectedOutput;
    if (value === undefined)
      return undefined;
    if ((typeof value !== 'object') || (value === null) || isProxy(value))
      throw new PreparationRootError({ kind: 'output-identity', });
    /** Closed own keys exclude unrelated authority claims without reading their values. */
    const keys = Reflect.ownKeys(value);
    if ((keys.length !== 2) || !keys.includes('bytes') || !keys.includes('sha256'))
      throw new PreparationRootError({ kind: 'output-identity', });
    /** Data descriptors avoid executing caller-controlled nested getters. */
    const extent = Object.getOwnPropertyDescriptor(value, 'bytes');
    /** Digest ownership is checked independently of extent ownership. */
    const digest = Object.getOwnPropertyDescriptor(value, 'sha256');
    if ((extent === undefined) || (digest === undefined) || !Object.hasOwn(extent, 'value')
      || !Object.hasOwn(digest, 'value'))
      throw new PreparationRootError({ kind: 'output-identity', });
    /** Descriptor values remain unknown until their primitive grammars have been checked. */
    const bytes: unknown = extent.value;
    /** No native descriptor's permissive value type crosses this boundary. */
    const sha256: unknown = digest.value;
    if ((typeof bytes !== 'number') || !Number.isSafeInteger(bytes) || (bytes <= 0))
      throw new PreparationRootError({ kind: 'output-identity', });
    return { bytes, sha256: selectionDigest({ value: sha256, kind: 'output-identity', }), };
  }
  catch (error) {
    if (error instanceof PreparationRootError)
      throw error;
    // Caller accessor and reflection failures do not retain private native cause text.
    throw new PreparationRootError({ kind: 'output-identity', });
  }
}

/**
 * Compares fresh native reconstruction with an independent artifact identity.
 * No supplied node table or parsed artifact is used to create the current graph.
 *
 * @param inputs - exclusively owned result of complete native input reconstruction
 *
 * @param expected - identity captured before reconstruction, absent only during initial construction
 *
 * @throws PreparationRootError when compact UTF-8 JSON extent or raw digest differs
 *
 * @example
 * ```ts
 * assertPreparationRootOutputIdentity({ inputs, expected });
 * ```
 */
export function assertPreparationRootOutputIdentity({
  inputs,
  expected,
}: {
  readonly inputs: PreparationRootInputs;
  readonly expected: PreparationRootOutputIdentity | undefined;
},): void {
  if (expected === undefined)
    return;
  /** The sealed input application uses this exact compact JSON serialization. */
  const text = JSON.stringify(inputs);
  if ((Buffer.byteLength(text, 'utf8') !== expected.bytes)
    || (hashContent({ content: text, }) !== expected.sha256))
    throw new PreparationRootError({ kind: 'output-reconstruction', });
}

//endregion Exact reconstruction identity without review authority
