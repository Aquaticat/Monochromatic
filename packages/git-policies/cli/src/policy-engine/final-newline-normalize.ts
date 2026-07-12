/**
 * Exact-byte final-newline classification and normalization.
 *
 * @module
 */
import { isUtf8, } from 'node:buffer';

/**
 * LF byte required at end of selected text files.
 */
const LINE_FEED = 0x0A;
/**
 * NUL byte used by binary-looking content classification.
 */
const NUL = 0;
/**
 * Segment offset proving matched Node directory contains a descendant file.
 */
const PATH_AFTER_NODE_OFFSET = 3;

/**
 * Result when candidate bytes need no policy patch.
 */
export type UnchangedFinalNewline = Readonly<{
  /**
   * Stable result discriminator.
   */
  kind: 'unchanged';
}>;

/**
 * Result containing canonical replacement bytes.
 */
export type ChangedFinalNewline = Readonly<{
  /**
   * Stable result discriminator.
   */
  kind: 'changed';
  /**
   * Exact replacement bytes ending in one LF.
   */
  bytes: Uint8Array;
}>;

/**
 * Exact final-newline normalization result.
 */
export type FinalNewlineNormalization = UnchangedFinalNewline | ChangedFinalNewline;

/**
 * Shared immutable unchanged result.
 */
const UNCHANGED: UnchangedFinalNewline = { kind: 'unchanged', };

/**
 * Tests exact-byte fixture and generated-output exclusions.
 *
 * @param path - repository-relative Git path
 *
 * @returns whether policy must preserve path bytes
 *
 * @example
 * ```ts
 * isFinalNewlineExcluded('pkg/dist/final/node/index.mjs');
 * // => true
 * ```
 */
export function isFinalNewlineExcluded(path: string,): boolean {
  if (path.startsWith('packages/fuzz/forbidden-strings/seeds/',)
    || path.startsWith('packages/rust-module/forbidden-regex.fuzz/seeds/',)
    || path.startsWith('packages/test-fixture/toml-edit/src/',))
    return true;
  /**
   * Repository path segments used for directory-family matching.
   */
  const segments = path.split('/',);
  for (let index = 0; index < segments.length; index += 1) {
    if ((segments[index] === 'dist')
      && (segments[index + 1] === 'final')
      && (segments[index + 2] === 'node')
      && ((index + PATH_AFTER_NODE_OFFSET) < segments.length))
      return true;
  }
  return false;
}

/**
 * Produces canonical bytes for selected non-empty UTF-8 text.
 *
 * @param bytes - exact candidate bytes
 *
 * @returns unchanged result or exact replacement
 *
 * @example
 * ```ts
 * normalizeFinalNewline(new TextEncoder().encode('value'));
 * // => { kind: 'changed', bytes: Uint8Array(...) }
 * ```
 */
export function normalizeFinalNewline(bytes: Uint8Array,): FinalNewlineNormalization {
  if ((bytes.length === 0) || bytes.includes(NUL,)
    || (!isUtf8(bytes,)))
    return UNCHANGED;
  /**
   * Cursor immediately after final non-LF byte.
   */
  const contentEnd = bytes.findLastIndex(function isContentByte(byte,) {
    return byte !== LINE_FEED;
  },) + 1;
  if ((contentEnd === (bytes.length - 1)) && (bytes.at(-1) === LINE_FEED))
    return UNCHANGED;
  /**
   * Exact canonical output with one reserved terminal byte.
   */
  const normalized = new Uint8Array(contentEnd + 1,);
  normalized.set(bytes.subarray(
    0,
    contentEnd,
  ),);
  normalized[contentEnd] = LINE_FEED;
  return {
    kind: 'changed',
    bytes: normalized,
  };
}
