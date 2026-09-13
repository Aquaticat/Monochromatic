import { createHash, } from 'node:crypto';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import { readFrozenPreparationSelection, } from './read-frozen-preparation-selection.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import { isJsonRecord, } from './json-guard.ts';
import { preparationArtifactProperty, } from './preparation-artifact-property.ts';
import type {
  MatchedPreparationArtifact,
  PreparationArtifactInput,
  PreparationSelectionEvidence,
} from './preparation-selection-evidence-model.ts';

//region Frozen supporting-artifact byte ownership

/**
 * Copies raw bytes before hashing so later caller mutation cannot change the matched content.
 *
 * @param content - caller-loaded bytes, never text decoded before hashing
 *
 * @returns Owned byte snapshot
 *
 * @throws PreparationRootError when content is not readable byte-array data
 *
 * @example
 * ```ts
 * const owned = artifactBytes(content);
 * ```
 */
function artifactBytes(content: unknown,): Uint8Array<ArrayBuffer> {
  if (!(content instanceof Uint8Array))
    throw new PreparationRootError({ kind: 'reference-content', },);
  try {
    return new Uint8Array(content,);
  }
  catch (error) {
    if (!(error instanceof TypeError))
      throw error;
    throw new PreparationRootError({ kind: 'reference-content', },);
  }
}

/**
 * Matches complete supplied artifact bytes to an independently re-read frozen selection.
 * No path is opened or executed, no semantic role is guessed and no root/phase approval is granted.
 * Callers must load size-bounded bytes at their authorized I/O boundary; this operation does not bound allocation.
 * Matching is point-in-time evidence. A downstream owner must rehash these bytes, not trust a previously returned hash.
 *
 * @param text - complete original frozen-selection bytes as text
 *
 * @param expectedDigest - separately recorded selection authority, never a digest derived from this input
 *
 * @param artifacts - explicit caller-loaded raw supporting bytes
 *
 * @param l - caller logger retaining frozen evidence scope
 *
 * @returns Owned exact supporting-byte inventory in original reference order
 *
 * @throws PreparationRootError when selection, inventory or supporting content differs
 *
 * @example
 * ```ts
 * const matched = readPreparationSelectionEvidence({ text, expectedDigest, artifacts, l });
 * ```
 */
export function readPreparationSelectionEvidence({
  text,
  expectedDigest,
  artifacts,
  l,
}: {
  readonly text: string;
  readonly expectedDigest: string;
  readonly artifacts: readonly PreparationArtifactInput[];
  readonly l: Logger;
},): PreparationSelectionEvidence {
  /**
   * The entry point itself checks independent selection bytes rather than trusting a caller-fabricated typed result.
   */
  const pl = tagged({
    tag: readPreparationSelectionEvidence.name,
    l,
  },);
  /**
   * The raw artifact is checked here even when another caller already decoded it.
   */
  const selection = readFrozenPreparationSelection({
    text,
    expectedDigest,
    l: pl,
  },);
  if (!Array.isArray(artifacts,))
    throw new PreparationRootError({ kind: 'reference-inventory', },);
  /** The frozen reference count bounds indexed traversal, independent of a custom array iterator. */
  const required = selection.references.length;
  if (preparationArtifactProperty({ record: artifacts, key: 'length', kind: 'reference-inventory', l: pl, },) !== required)
    throw new PreparationRootError({ kind: 'reference-inventory', },);
  /**
   * Exact frozen locators, not input order or caller-declared hashes, select the records to read.
   */
  const expectedPaths = new Set(selection.references
    .map(function path(reference,): string {
    return reference.path;
  },),);
  /**
   * Inventory is checked before any supplied content is copied or hashed.
   */
  const inputs = new Map<string, Record<string, unknown>>();
  for (let index = 0; index < required; index += 1) {
    /** Indexed descriptor access cannot delegate inventory selection to a caller's iterator. */
    const input = preparationArtifactProperty({ record: artifacts, key: index, kind: 'reference-inventory', l: pl, },);
    if (Array.isArray(input,) || (!isJsonRecord(input,)))
      throw new PreparationRootError({ kind: 'reference-inventory', },);
    /**
     * Snapshot locator once so callback-backed descriptors cannot select different keys during this pass.
     */
    const path = preparationArtifactProperty({ record: input, key: 'path', kind: 'reference-inventory', l: pl, },);
    if (((typeof path) !== 'string') || (!expectedPaths.has(path,))
      || inputs.has(path,))
      throw new PreparationRootError({ kind: 'reference-inventory', },);
    inputs.set(
      path,
      input,
    );
  }
  if (inputs.size !== required)
    throw new PreparationRootError({ kind: 'reference-inventory', },);
  /**
   * Each independently expected hash is checked against owned raw bytes, without lossy decoding.
   */
  const matched = selection.references
    .map(function match(reference,): MatchedPreparationArtifact {
    /**
     * Every expected locator must be present exactly once despite any caller ordering.
     */
    const input = nonNullishOrThrow(inputs.get(reference.path,),);
    /**
     * Copy precedes the digest and the recorded byte extent.
     */
    const content = artifactBytes(preparationArtifactProperty({ record: input, key: 'content', kind: 'reference-content', l: pl, },),);
    /**
     * Raw SHA-256 preserves CRLF, invalid UTF-8 and all other byte distinctions.
     */
    const digest = createHash('sha256',)
      .update(content,)
      .digest('hex',);
    if (digest !== reference.hash)
      throw new PreparationRootError({ kind: 'reference-content', },);
    return {
      path: reference.path,
      hash: reference.hash,
      bytes: content.byteLength,
      content,
    };
  },);
  pl.info(`matched ${String(matched.length,)} frozen supporting artifacts without role or acquisition authority`,);
  return {
    scope: 'matched-selection-artifacts',
    selection,
    artifacts: matched,
  };
}

//endregion Frozen supporting-artifact byte ownership
